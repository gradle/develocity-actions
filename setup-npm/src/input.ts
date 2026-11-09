import * as sharedInput from '../../build-scan-shared/src/input'

export function getDevelocityNpmAgentUrlOverride(): string {
    return sharedInput.getInput('develocity-npm-agent-url-override')
}

export function getDevelocityNpmAgentVersion(): string {
    return sharedInput.getInput('develocity-npm-agent-version') || 'latest'
}

export function getDevelocityNpmAgentInstallLocation(): string {
    return sharedInput.getInput('develocity-npm-agent-install-location') || '~/.node_libraries'
}

export function getDevelocityPacoteVersion(): string {
    return sharedInput.getInput('develocity-pacote-version') || '21.0.0'
}
