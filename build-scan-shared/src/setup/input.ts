import * as core from '@actions/core'
import * as github from '@actions/github'

import * as commonBuildTool from '../buildTool/common'
import * as sharedInput from '../input'
import {getBooleanInput} from '../input'

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

export function isSkipPrComment(): boolean {
    return getBooleanInput('skip-pr-comment')
}

export function isSkipJobSummary(): boolean {
    return getBooleanInput('skip-job-summary')
}

export function isSkipProjectIdInJobSummary(): boolean {
    return getBooleanInput('skip-project-id-in-job-summary')
}

export function exportVariables(buildTool: commonBuildTool.BuildTool): void {
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
