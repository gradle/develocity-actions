import * as core from '@actions/core'
import * as github from '@actions/github'

import * as input from './utils/input'
import * as layout from '../../maven-build-scan-shared/src/layout'
import * as io from '../../maven-build-scan-shared/src/io'
import * as errorHandler from '../../maven-build-scan-shared/src/error'

/**
 * Main entrypoint for the action
 */
export async function run(): Promise<void> {
    try {
        // Propagate environment variables to subsequent steps
        core.exportVariable('INPUT_BUILD_SCAN_CAPTURE_STRATEGY', input.getBuildScanCaptureStrategy())
        core.exportVariable(
            'INPUT_BUILD_SCAN_CAPTURE_UNPUBLISHED_ENABLED',
            input.getBuildScanCaptureUnpublishedEnabled()
        )
        core.exportVariable('INPUT_BUILD_SCAN_CAPTURE_LINK_ENABLED', input.getBuildScanCaptureLinkEnabled())
        core.exportVariable('INPUT_WORKFLOW_NAME', input.getWorkflowName())
        core.exportVariable('INPUT_JOB_NAME', input.getJobName())
        core.exportVariable('PR_NUMBER', github.context.issue.number)

        // Retrieve extension target filename (in Maven lib/ext folder)
        const mavenBuildScanCaptureExtensionTarget = await layout.mavenBuildScanCaptureExtensionTarget(input.getMavenHomeSearchPatterns())

        // copy Maven extension in $MAVEN_HOME/lib/ext
        core.debug(`Copy ${layout.mavenBuildScanCaptureExtensionSource()} to ${mavenBuildScanCaptureExtensionTarget}`)
        io.copyFileSync(layout.mavenBuildScanCaptureExtensionSource(), mavenBuildScanCaptureExtensionTarget)
    } catch (error) {
        errorHandler.handle(error)
    }
}

run()
