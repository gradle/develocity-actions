import * as core from '@actions/core'

export function getWorkflowName(): string {
    return core.getInput('workflow-name')
}

export function getJobName(): string {
    return core.getInput('job-name')
}

export function getMavenHomeSearchPatterns(): string {
    return core.getInput('maven-home-search-patterns')
}

export function getBuildScanCaptureStrategy(): string {
    return core.getInput('build-scan-capture-strategy')
}

export function getBuildScanCaptureUnpublishedEnabled(): string {
    return core.getInput('build-scan-capture-unpublished-enabled')
}

export function getBuildScanCaptureLinkEnabled(): string {
    return core.getInput('build-scan-capture-link-enabled')
}
