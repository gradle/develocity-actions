import * as core from '@actions/core'

export function getTosAcceptanceFileBranch(): string {
    return core.getInput('tos-acceptance-file-branch')
}

export function getTosAcceptanceFile(): string {
    return core.getInput('tos-acceptance-file')
}

export function isDevelocityAllowUntrusted(): boolean {
    return getBooleanInput('develocity-allow-untrusted')
}

export function getDevelocityUrl(): string {
    return core.getInput('develocity-url')
}

export function getDevelocityAccessKey(): string {
    return core.getInput('develocity-access-key')
}

export function getTosLocation(): string {
    return core.getInput('tos-location')
}

export function getBuildWorkflowFileName(): string {
    return core.getInput('build-workflow-filename')
}

export function getCommentTosAcceptanceRequest(): string {
    return core.getInput('pr-comment-tos-acceptance-request')
}

export function getCommentTosAcceptanceMissing(): string {
    return core.getInput('pr-comment-tos-acceptance-missing')
}

export function getCommentTosAcceptanceValidation(): string {
    return core.getInput('pr-comment-tos-acceptance-validation')
}

export function getWhiteList(): string {
    return core.getInput('white-list')
}

// Internal parameters
export function getGithubToken(): string {
    return core.getInput('github-token', {required: true})
}

function getBooleanInput(paramName: string, paramDefault = false): boolean {
    const paramValue = core.getInput(paramName)
    switch (paramValue.toLowerCase().trim()) {
        case '':
            return paramDefault
        case 'false':
            return false
        case 'true':
            return true
    }
    throw TypeError(`The value '${paramValue} is not valid for '${paramName}. Valid values are: [true, false]`)
}
