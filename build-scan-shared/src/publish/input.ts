import * as sharedInput from '../input'

export function getBuildScanCaptureStrategy(): boolean {
    return sharedInput.getBooleanInput('develocity-allow-untrusted')
}

export function isDevelocityAllowUntrusted(): boolean {
    return sharedInput.getBooleanInput('develocity-allow-untrusted')
}

export function getDevelocityUrl(): string {
    return sharedInput.getInput('develocity-url')
}

export function getDevelocityAccessKey(): string {
    return sharedInput.getInput('develocity-access-key')
}

export function isSkipPrComment(): boolean {
    return sharedInput.getBooleanInput('skip-pr-comment')
}

export function isSkipJobSummary(): boolean {
    return sharedInput.getBooleanInput('skip-job-summary')
}

export function isSkipProjectIdInJobSummary(): boolean {
    return sharedInput.getBooleanInput('skip-project-id-in-job-summary')
}

export function getAuthorizedUsersList(): string {
    return sharedInput.getInput('authorized-users-list')
}

// Internal parameters
export function getGithubToken(): string {
    return sharedInput.getInput('github-token', {required: true})
}
