import * as core from '@actions/core'
import {create} from "@actions/artifact"
import * as glob from "@actions/glob"
import * as github from "@actions/github"

import * as io from "./io"
import * as params from "./params"
import * as layout from "./layout"

// Catch and log any unhandled exceptions.
process.on('uncaughtException', e => handleFailure(e))

/**
 * The post-execution entry point for the action, called by Github Actions after completing all steps for the Job.
 */
export async function run(): Promise<void> {
    try {
        // Retrieve Build Scan Data files
        const buildScanDataFiles = await getBuildScanDataFiles()
        if (buildScanDataFiles && buildScanDataFiles.length) {
            // Create Build Scan metadata
            const buildScanMetadataFile = createBuildScanMetadataFile()

            // Add it to the list of files to upload
            buildScanDataFiles.push(buildScanMetadataFile)

            // Upload Build Scan data as workflow artifact
            await uploadArtifacts(buildScanDataFiles)
        } else {
            core.debug(`No Build Scan to process`)
        }
    } catch (error) {
        handleFailure(error)
    }
}

async function getBuildScanDataFiles(): Promise<string[]> {
    const globber = await glob.create(`${layout.mavenBuildScanDataCopy()}/**`)
    return await globber.glob()
}

function createBuildScanMetadataFile(): string {
    // Dump pull-request number
    const buildScanMetadataFileName = `${layout.mavenBuildScanDataCopy()}/build-metadata.properties`

    const metadataContent = `
        PR_NUMBER=${github.context.issue.number}
        WORKFLOW_NAME=${params.getWorkflowName()}
        JOB_NAME=${params.getJobName()}
    `.replace(/$\s+/g, '')

    io.writeContentToFileSync(buildScanMetadataFileName, metadataContent)

    return buildScanMetadataFileName
}

async function uploadArtifacts(files: string[]): Promise<void> {
    const artifactClient = create()

    await artifactClient.uploadArtifact('maven-build-scan-data', files, layout.mavenBuildScanDataCopy(), {retentionDays: 1})
}

function handleFailure(error: unknown): void {
    core.warning(`Unhandled error in Gradle post-action - job will continue: ${error}`)
    if (error instanceof Error && error.stack) {
        core.info(error.stack)
    }
}

run()