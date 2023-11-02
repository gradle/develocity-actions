import * as core from '@actions/core'
import * as github from '@actions/github'

import * as persistence from './persistence'
import * as githubInternal from '../shared/github'
import * as params from '../shared/params'
import {Contributor, Contributors} from './persistence'

export async function isAccepted(prNumber: number): Promise<boolean> {
    if (params.isWhiteListOnly()) {
        return isAcceptedFromWhitelist(prNumber)
    } else {
        return isAcceptedFromTos(prNumber)
    }
}

async function isAcceptedFromWhitelist(prNumber: number): Promise<boolean> {
    const currentContributor = await getPullRequestSubmitter(prNumber)

    return isContributorWhiteListed(currentContributor.name)
}

async function isAcceptedFromTos(prNumber: number): Promise<boolean> {
    let contributorsWithTosAccepted = await persistence.load()

    const currentContributor = await getPullRequestSubmitter(prNumber)

    if (githubInternal.isEventIssueWithTosAcceptanceComment()) {
        const result = await githubInternal.getOctokit().rest.issues.getComment({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            // @ts-ignore
            comment_id: github.context.payload.comment.id
        })
        core.debug(`TOS acceptance comment found`)

        if (
            result.data.user &&
            isContributorCommentAuthor(currentContributor.id, result.data.user.id) &&
            !isContributorWithTosAccepted(contributorsWithTosAccepted, result.data.user?.id)
        ) {
            core.debug(`Adding user to TOS acceptance file`)
            await persistence.add(currentContributor, prNumber)
            await commentPullRequestWithAcceptanceConfirmation(
                currentContributor.name,
                // @ts-ignore
                github.context.payload.comment.id
            )
            contributorsWithTosAccepted = await persistence.load()
        }
    }

    if (!isContributorWhiteListed(currentContributor.name) && !isContributorWithTosAccepted(contributorsWithTosAccepted, currentContributor.id)) {
        core.debug(`User did not accept the TOS`)

        if(!await isPullRequestCommentedWithAcceptanceRequest(prNumber)) {
            await commentPullRequestWithAcceptanceRequest(prNumber)
        }

        return false
    }

    core.debug(`User did accept the TOS`)

    return true
}

async function getPullRequestSubmitter(prNumber: number): Promise<Contributor> {
    const result = await githubInternal.getOctokit().rest.pulls.get({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pull_number: prNumber
    })

    if (result.data.user && result.data.user.login) {
        core.debug(`${result.data.user.login} submitted the PR`)

        return {
            id: result.data.user.id,
            name: result.data.user.login,
            pullRequestNo: prNumber,
            created_at: result.data.created_at
        } as Contributor
    }

    throw new Error(`Submitter of pull-request '${prNumber}' not found`)
}

function isContributorCommentAuthor(contributorId: number, commentAuthorId: number): boolean {
    return contributorId === commentAuthorId
}

function isContributorWithTosAccepted(contributorsWithTosAccepted: Contributors, userId?: number): boolean {
    return contributorsWithTosAccepted.list.some(user => user.id === userId)
}

function isContributorWhiteListed(userName: string): boolean {
    if(params.getWhiteList()) {
        return params.getWhiteList().split(',').some(whiteListedUser => whiteListedUser === userName)
    }

    return false
}

async function commentPullRequestWithAcceptanceConfirmation(contributorName: string, commentId: number): Promise<void> {
    try {
        await githubInternal.getOctokit().rest.issues.updateComment({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            comment_id: commentId,
            body: params.getCommentTosAcceptanceValidation()
        })
    } catch (error) {
        throw new Error(`Error updating the pull request comment: ${error}`)
    }
}

async function commentPullRequestWithAcceptanceRequest(prNumber: number): Promise<void> {
    try {
        await githubInternal.getOctokit().rest.issues.createComment({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: prNumber,
            body: `${params.getCommentTosAcceptanceMissing()}<br/><br/>${params.getCommentTosAcceptanceRequest()}`
        })
    } catch (error) {
        throw new Error(`Error creating a pull request comment: ${error}`)
    }
}

async function isPullRequestCommentedWithAcceptanceRequest(prNumber: number) {
    try {
        const octokit = githubInternal.getOctokit();

        const { data: comments } = await octokit.rest.issues.listComments({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            issue_number: prNumber,
        })
        core.info(`STRING = ${params.getCommentTosAcceptanceMissing()}`)
        for(const comment of comments) {
            core.info(`COMMENTS = ${comment.body}`)
        }

        // @ts-ignore
        return comments.some((comment) =>
            comment?.body && comment.body.startsWith(params.getCommentTosAcceptanceMissing())
        )
    } catch (error) {
        throw new Error(`Error collecting pull request comments: ${error}`)
    }
}
