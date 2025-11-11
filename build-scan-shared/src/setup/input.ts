import * as core from '@actions/core'
import * as github from '@actions/github'

import * as auth from '../auth/auth'
import * as commonBuildTool from '../buildTool/common'
import * as sharedInput from '../input'
import {getBooleanInput} from '../input'

export function getDevelocityUrl(): string {
    return sharedInput.getInput('develocity-url')
}

export function getDevelocityInjectionEnabled(): boolean {
    return sharedInput.getBooleanInput('develocity-injection-enabled')
}

export function getDevelocityMavenExtensionVersion(): string {
    return sharedInput.getInput('develocity-maven-extension-version')
}

export function getDevelocityNpmAgentVersion(): string {
    return sharedInput.getInput('develocity-npm-agent-version')
}

export function getDevelocityNpmAgentInstallLocation(): string {
    return sharedInput.getInput('develocity-npm-agent-install-location')
}

export function getCcudExtensionVersion(): string {
    return sharedInput.getInput('develocity-ccud-extension-version')
}

export function getDevelocityMavenRepositoryUrl(): string {
    return sharedInput.getInput('develocity-maven-repository-url')
}

export function getDevelocityMavenRepositoryUsername(): string {
    return sharedInput.getInput('develocity-maven-repository-username')
}

export function getDevelocityMavenRepositoryPassword(): string {
    return sharedInput.getInput('develocity-maven-repository-password')
}

export function getDevelocityCustomMavenExtensionCoordinates(): string {
    return sharedInput.getInput('develocity-custom-develocity-maven-extension-coordinates')
}

export function getDevelocityCustomCcudExtensionCoordinates(): string {
    return sharedInput.getInput('develocity-custom-ccud-extension-coordinates')
}

export function getDevelocityAllowUntrustedServer(): string {
    return sharedInput.getInput('develocity-allow-untrusted-server')
}

export function getDevelocityEnforceUrl(): boolean {
    return getBooleanInput('develocity-enforce-url')
}

export function getDevelocityCaptureFileFingerprints(): boolean {
    return getBooleanInput('develocity-capture-file-fingerprints')
}

export function getDevelocityAccessKey(): string {
    return sharedInput.getInput('develocity-access-key')
}

export function getDevelocityTokenExpiry(): string {
    return sharedInput.getInput('develocity-token-expiry')
}

export function getWorkflowName(): string {
    // workflow name should always be populated https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
    return process.env['GITHUB_WORKFLOW'] ? process.env['GITHUB_WORKFLOW'] : 'unknown workflow name'
}

export function getJobName(): string {
    const jobNameInput = sharedInput.getInput('job-name')
    if (jobNameInput) {
        return jobNameInput
    } else {
        let currentMatrixValue = ''
        const jobMatrixInput = sharedInput.getInput('job-matrix')
        if (jobMatrixInput) {
            const jobMatrix = JSON.parse(jobMatrixInput)
            if (jobMatrix) {
                core.debug(`using matrix ${jobMatrix}`)
                currentMatrixValue = Object.values(jobMatrix).join('-')
                core.debug(`currentMatrixValue = ${currentMatrixValue}`)
            }
        }
        return currentMatrixValue ? `${github.context.job}-${currentMatrixValue}` : `${github.context.job}`
    }
}

function getCaptureStrategy(): string {
    return sharedInput.getInput('capture-strategy')
}

function getCaptureUnpublishedBuildScans(): string {
    return sharedInput.getInput('capture-unpublished-build-scans')
}

function getCaptureBuildScanLinks(): string {
    return sharedInput.getInput('capture-build-scan-links')
}

export function isAddPrComment(): boolean {
    return getBooleanInput('add-pr-comment')
}

export function isAddJobSummary(): boolean {
    return getBooleanInput('add-job-summary')
}

export function isAddProjectIdInJobSummary(): boolean {
    return getBooleanInput('add-project-id-in-job-summary')
}

export function exportVariables(accessToken: string, buildTool: commonBuildTool.BuildTool): void {
    if (accessToken) {
        core.setSecret(accessToken)
        core.exportVariable(auth.ENV_KEY_DEVELOCITY_ACCESS_KEY, accessToken)
    }
    core.exportVariable('INPUT_CAPTURE_STRATEGY', getCaptureStrategy())
    core.exportVariable('INPUT_CAPTURE_UNPUBLISHED_BUILD_SCANS', getCaptureUnpublishedBuildScans())
    core.exportVariable('INPUT_CAPTURE_BUILD_SCAN_LINKS', getCaptureBuildScanLinks())
    core.exportVariable('INPUT_JOB_NAME', getJobName())
    core.exportVariable('SETUP_WORKFLOW_NAME', getWorkflowName())
    core.exportVariable('PR_NUMBER', github.context.issue.number)
    core.exportVariable('BUILD_SCAN_DATA_DIR', buildTool.getBuildScanDataDir())
    core.exportVariable('BUILD_SCAN_DATA_COPY_DIR', buildTool.getBuildScanDataCopyDir())
    core.exportVariable('BUILD_SCAN_METADATA_DIR', buildTool.getBuildScanMetadataDir())
    core.exportVariable('BUILD_SCAN_METADATA_COPY_DIR', buildTool.getBuildScanMetadataCopyDir())
}
