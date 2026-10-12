import * as sharedInput from '../../build-scan-shared/src/input'

const DEFAULT_AGENT_BASE_URL = 'https://develocity-python-pkgs.gradle.com'

/**
 * Checksums of the agent versions this action was tested with, so the default install is verified without
 * further input.
 */
const KNOWN_AGENT_SHA256: Record<string, string> = {
    '0.10.1': '2bfc48f29b1c437daac718bb3d5c726b74ec60cf33723986341d9a262e6f4896'
}

export function getDevelocityUrl(): string {
    return sharedInput.getInput('develocity-url', {required: true})
}

export function getPythonExecutable(): string {
    return sharedInput.getInput('python-executable') || 'python'
}

export function getAgentRequirement(): string {
    return agentRequirement(
        sharedInput.getInput('develocity-python-agent-url-override'),
        sharedInput.getInput('develocity-python-agent-version'),
        sharedInput.getInput('develocity-python-agent-sha256')
    )
}

/**
 * Builds the pip requirement for the agent. The override is the full URL of the wheel, so the version is ignored
 * when it is set. pip refuses a wheel whose hash differs from the one given in the URL fragment.
 */
export function agentRequirement(urlOverride: string, version: string, sha256: string): string {
    if (!urlOverride && !version) {
        throw new Error(
            'develocity-python-agent-version is empty: set it or develocity-python-agent-url-override, or remove it to use the default'
        )
    }
    const url = urlOverride || `${DEFAULT_AGENT_BASE_URL}/develocity_agent-${version}-py3-none-any.whl`
    const hash = sha256 || (urlOverride ? '' : KNOWN_AGENT_SHA256[version] || '')
    return hash ? `develocity-agent @ ${url}#sha256=${hash}` : `develocity-agent @ ${url}`
}
