import * as sharedInput from '../input'

export function isDevelocityAllowUntrusted(): boolean {
    return sharedInput.getBooleanInput('develocity-allow-untrusted')
}

export function getDevelocityUrl(): string {
    return sharedInput.getInput('develocity-url')
}

export function getDevelocityAccessKey(): string {
    return sharedInput.getInput('develocity-access-key')
}

export function getAuthorizedUsersList(): string {
    return sharedInput.getInput('authorized-users-list')
}
