import * as core from '@actions/core'

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

export function getDevelocityAllowUntrustedServer(): boolean | undefined {
    if (!sharedInput.getInput('develocity-allow-untrusted-server')) {
        return undefined
    }
    return sharedInput.getBooleanInput('develocity-allow-untrusted-server')
}

export function getAgentUrl(): string {
    return agentDownloadUrl(
        sharedInput.getInput('develocity-docker-agent-url-override'),
        sharedInput.getInput('develocity-docker-agent-version')
    )
}

/**
 * The override is the full URL of the agent jar, so the version is ignored when it is set.
 */
export function agentDownloadUrl(urlOverride: string, version: string): string {
    return urlOverride || `${DEFAULT_AGENT_BASE_URL}/develocity-docker-agent-${version}.jar`
}

export function getPackageScanEnabled(): boolean {
    return sharedInput.getBooleanInput('develocity-package-scan-enabled', true)
}

export function getJavaHome(): string {
    return sharedInput.getInput('develocity-docker-agent-java-home')
}

export function getBuildxBuilder(): string {
    return sharedInput.getInput('buildx-builder')
}

export function getDrainTimeout(): number {
    return toSeconds('drain-timeout', sharedInput.getInput('drain-timeout'), 300)
}

export function getShutdownTimeout(): number {
    return toSeconds('shutdown-timeout', sharedInput.getInput('shutdown-timeout'), 120)
}

export function getAddJobSummary(): boolean {
    return sharedInput.getBooleanInput('add-job-summary', true)
}

export function toSeconds(name: string, value: string, fallback: number): number {
    if (!value.trim()) {
        return fallback
    }
    if (!/^\s*\d+\s*$/.test(value)) {
        core.warning(`Ignoring ${name}: '${value}' is not a whole number of seconds, using ${fallback}`)
        return fallback
    }
    return Number.parseInt(value, 10)
}
