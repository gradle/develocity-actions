import path from 'path'

import * as core from '@actions/core'
import * as github from '@actions/github'
import * as glob from '@actions/glob'
import {create} from '@actions/artifact'

import * as layout from './layout'
import * as io from './io'

/**
 * Main entrypoint for the Save Maven Build Scan action
 */
export async function run(): Promise<void> {
    try {
        core.info(`Save Maven Build Scan action`)

        // Retrieve Build Scan Data files
        const buildScanDataFiles = await getBuildScanDataFiles()
        if (buildScanDataFiles && buildScanDataFiles.length) {
            const buildScanFile = buildScanDataFiles.find(item => item.endsWith('scan.scan'))
            if (buildScanFile) {
                // Add Build Scan metadata
                addBuildScanMetadata(buildScanDataFiles, path.dirname(buildScanFile))

                // Upload Build Scan data as workflow artifact
                uploadArtifacts(buildScanDataFiles)
            }
        } else {
            core.info(`No Build Scan to process`)
        }
    } catch (error) {
        // Fail the workflow run if an error occurs
        if (error instanceof Error) core.setFailed(error.message)
    }
}

async function getBuildScanDataFiles(): Promise<string[]> {
    const globber = await glob.create(`${layout.mavenBuildScanData()}/**`)
    return await globber.glob()
}

function addBuildScanMetadata(buildScanDataFiles: string[], buildScanDir: string): string[] {
    // Dump pull-request number
    const pullRequestNumberFileName = `${buildScanDir}/pr-number.properties`
    core.info(`Adding metadata file ${pullRequestNumberFileName}`)

    io.writeContentToFileSync(pullRequestNumberFileName, `PR_NUMBER=${github.context.issue.number}\n`)

    buildScanDataFiles.push(pullRequestNumberFileName)

    return buildScanDataFiles
}

function uploadArtifacts(files: string[]): void {
    const artifactClient = create()

    artifactClient.uploadArtifact('maven-build-scan-data', files, layout.mavenBuildScanData(), {retentionDays: 1})
}
