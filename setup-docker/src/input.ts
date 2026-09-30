import * as sharedInput from '../../build-scan-shared/src/input'

const DEFAULT_AGENT_BASE_URL = 'https://develocity-docker-build-agent.gradle.com'

export function getDevelocityUrl(): string {
    return sharedInput.getInput('develocity-url', {required: true})
}

export function getDevelocityAccessKey(): string {
    return sharedInput.getInput('develocity-access-key')
}

export function getDevelocityTokenExpiry(): string {
    return sharedInput.getInput('develocity-token-expiry')
}

export function getDevelocityProjectId(): string {
    return sharedInput.getInput('develocity-project-id')
}

export function getAgentVersion(): string {
    return sharedInput.getInput('develocity-docker-agent-version')
}

export function getAgentBaseUrl(): string {
    return sharedInput.getInput('develocity-docker-agent-url-override') || DEFAULT_AGENT_BASE_URL
}

export function getCapturePackageList(): boolean {
    return sharedInput.getBooleanInput('capture-package-list', true)
}

export function getBuildxBuilder(): string {
    return sharedInput.getInput('buildx-builder')
}

export function getDrainTimeout(): number {
    return toPositiveInt(sharedInput.getInput('drain-timeout'), 300)
}

export function getShutdownTimeout(): number {
    return toPositiveInt(sharedInput.getInput('shutdown-timeout'), 120)
}

export function getJavaHomeOverride(): string {
    return sharedInput.getInput('java-home-override')
}

function toPositiveInt(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
