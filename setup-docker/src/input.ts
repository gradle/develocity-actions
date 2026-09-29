import * as sharedInput from '../../build-scan-shared/src/input'

export function getDevelocityDockerAgentVersion(): string {
    return sharedInput.getInput('develocity-docker-agent-version')
}

export function getDevelocityProjectId(): string {
    return sharedInput.getInput('develocity-project-id')
}

export function getBuildxBuilder(): string {
    return sharedInput.getInput('buildx-builder')
}

export function isPackageScanEnabled(): boolean {
    return sharedInput.getBooleanInput('package-scan-enabled', true)
}

export function getDrainTimeoutSeconds(): number {
    return getSeconds('drain-timeout-seconds')
}

export function getShutdownTimeoutSeconds(): number {
    return getSeconds('shutdown-timeout-seconds')
}

function getSeconds(key: string): number {
    const value = sharedInput.getInput(key)
    const seconds = Number(value)
    if (!Number.isInteger(seconds) || seconds < 0) {
        throw TypeError(`The value '${value}' is not valid for '${key}'. Expected a non-negative integer`)
    }
    return seconds
}
