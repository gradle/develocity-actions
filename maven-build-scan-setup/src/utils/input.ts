import * as sharedInput from '../../../maven-build-scan-shared/src/input'

export function getWorkflowName(): string {
    return sharedInput.getInput('workflow-name')
}

export function getJobName(): string {
    return sharedInput.getInput('job-name')
}

export function getMavenHomeSearchPatterns(): string {
    return sharedInput.getInput('maven-home-search-patterns')
}

export function getBuildScanCaptureStrategy(): string {
    return sharedInput.getInput('build-scan-capture-strategy')
}

export function getBuildScanCaptureUnpublishedEnabled(): string {
    return sharedInput.getInput('build-scan-capture-unpublished-enabled')
}

export function getBuildScanCaptureLinkEnabled(): string {
    return sharedInput.getInput('build-scan-capture-link-enabled')
}
