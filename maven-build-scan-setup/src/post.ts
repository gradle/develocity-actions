import * as core from '@actions/core'
import {create} from '@actions/artifact'
import * as glob from '@actions/glob'

import * as constant from '../../maven-build-scan-shared/src/constant'
import * as layout from '../../maven-build-scan-shared/src/layout'
import * as errorHandler from '../../maven-build-scan-shared/src/error'

// Catch and log any unhandled exceptions.
process.on('uncaughtException', e => errorHandler.handle(e))

/**
 * The post-execution entry point for the action, called after completing all steps for the Job
 */
export async function run(): Promise<void> {
    try {
        // Retrieve Build Scan data files
        const buildScanDataFiles = await getBuildScanDataFiles()
        if (buildScanDataFiles && buildScanDataFiles.length) {
            // Upload Build Scan data as workflow artifact
            await uploadArtifacts(buildScanDataFiles)
        } else {
            core.debug(`No Build Scan to process`)
        }
    } catch (error) {
        errorHandler.handle(error)
    }
}

async function getBuildScanDataFiles(): Promise<string[]> {
    const globber = await glob.create(`${layout.mavenBuildScanDataCopy()}/**`)
    return await globber.glob()
}

async function uploadArtifacts(files: string[]): Promise<void> {
    const artifactClient = create()

    await artifactClient.uploadArtifact(constant.BUILD_SCAN_ARTIFACT_NAME, files, layout.mavenBuildScanDataCopy(), {
        retentionDays: 1
    })
}

run()
