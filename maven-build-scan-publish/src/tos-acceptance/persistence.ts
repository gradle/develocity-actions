import * as github from '@actions/github'
import * as core from '@actions/core'

import * as params from '../shared/params'
import * as githubInternal from '../shared/github'
import {OctokitResponse} from "@octokit/types";
export interface Contributor {
    id: number
    name: string
    pullRequestNo: number
    created_at: string
}
export interface Contributors {
    sha: string
    list: Contributor[]
}

const EMPTY_CONTRIBUTORS = {sha: '', list: []}

export async function load(): Promise<Contributors> {
    try {
        core.debug(
            `Loading ${github.context.repo.owner}/${
                github.context.repo.repo
            }/${params.getTosAcceptanceFile()}@${params.getTosAcceptanceFileBranch()}`
        )
        const result = await githubInternal.getOctokit().rest.repos.getContent({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            path: params.getTosAcceptanceFile(),
            ref: params.getTosAcceptanceFileBranch()
        })

        if('sha' in result.data && 'content' in result.data) {
            const sha = result.data.sha

            const tosAcceptanceFileAsString = Buffer.from(result.data.content.toString(), 'base64').toString()
            let tosAcceptanceAsArray = JSON.parse(tosAcceptanceFileAsString)

            if (!Array.isArray(tosAcceptanceAsArray)) {
                core.info(`Initializing TOS acceptance data`)
                tosAcceptanceAsArray = []
            }

            return {
                sha,
                list: tosAcceptanceAsArray
            }
        }
        return EMPTY_CONTRIBUTORS
    } catch (error) {
        const typedError = error as OctokitResponse<unknown>
        if (typedError && typedError.status === 404) {
            await createOrUpdateTosAcceptanceFile(EMPTY_CONTRIBUTORS, 'Creating Terms Of Service acceptance file')
            return EMPTY_CONTRIBUTORS
        } else {
            throw new Error(`Could not parse TOS acceptance file: ${error}`)
        }
    }
}

export async function add(contributor: Contributor, prNumber: number): Promise<void> {
    const contributors = await load()
    contributors.list.push(contributor)
    await createOrUpdateTosAcceptanceFile(
        contributors,
        `@${contributor.name} has accepted the Terms Of Service in ${github.context.repo.owner}/${github.context.repo.repo}#${prNumber}`
    )
}
export async function createOrUpdateTosAcceptanceFile(contributors: Contributors, message: string): Promise<void> {
    const contentString = JSON.stringify(contributors.list, null, 2)

    try {
        await githubInternal.getOctokit().rest.repos.createOrUpdateFileContents({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            path: params.getTosAcceptanceFile(),
            message,
            content: Buffer.from(contentString).toString('base64'),
            branch: params.getTosAcceptanceFileBranch(),
            sha: contributors.sha
        })
    } catch (error) {
        throw new Error(`Error creating TOS acceptance file: ${error}`)
    }
}
