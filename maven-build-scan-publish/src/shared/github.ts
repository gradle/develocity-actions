import * as github from '@actions/github'
import {GitHub} from '@actions/github/lib/utils'

import * as params from './params'

export function getOctokit(): InstanceType<typeof GitHub> {
    return github.getOctokit(params.getGithubToken())
}

export function isEventWorkflowRun(): boolean {
    return github.context.eventName === 'workflow_run'
}

export function isEventIssueWithTosAcceptanceComment(): boolean {
    return (
        github.context.eventName === 'issue_comment' &&
        (github.context.payload?.comment?.body === 'recheck' ||
            github.context.payload?.comment?.body === params.getCommentTosAcceptanceRequest())
    )
}
