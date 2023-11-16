import * as core from '@actions/core'

import * as params from "./params"
import * as layout from './layout'
import * as io from './io'
import {mavenBuildScanCaptureExtensionTarget} from "./layout";

/**
 * Main entrypoint for the Save Maven Build Scan action
 */
export async function run(): Promise<void> {
    try {
        // Propagate environment variables to subsequent steps
        core.exportVariable('INPUT_BUILD_SCAN_CAPTURE_STRATEGY', params.getBuildScanCaptureStrategy())
        core.exportVariable('INPUT_BUILD_SCAN_CAPTURE_UNPUBLISHED_ENABLED', params.getBuildScanCaptureUnpublishedEnabled())
        core.exportVariable('INPUT_BUILD_SCAN_CAPTURE_LINK_ENABLED', params.getBuildScanCaptureLinkEnabled())

        // Retrieve Maven lib/ext folder
        const mavenBuildScanCaptureExtensionTarget = await layout.mavenBuildScanCaptureExtensionTarget()
        if(!mavenBuildScanCaptureExtensionTarget) {
            throw new Error(`Maven home not found`)
        }

        // copy Maven extension in $MAVEN_HOME/lib/ext
        core.debug(`Copy ${layout.mavenBuildScanCaptureExtensionSource()} to ${mavenBuildScanCaptureExtensionTarget}`)
        io.copyFileSync(layout.mavenBuildScanCaptureExtensionSource(), mavenBuildScanCaptureExtensionTarget)
    } catch (error) {
        // Fail the workflow run if an error occurs
        if (error instanceof Error) core.setFailed(error.message)
    }
}

run()