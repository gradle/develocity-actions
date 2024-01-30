import * as core from '@actions/core'
import * as glob from '@actions/glob'
import {DefaultArtifactClient} from '@actions/artifact'

import * as input from './input'
import * as commonBuildTool from '../buildTool/common'

export async function uploadBuildScanDataFiles(buildTool: commonBuildTool.BuildTool): Promise<void> {
    // Retrieve Build Scan data files
    const buildScanDataFiles = await getBuildScanDataFiles(buildTool.getBuildScanDataCopyDir())
    if (buildScanDataFiles && buildScanDataFiles.length) {
        // Upload Build Scan data as workflow artifact
        await uploadArtifacts(buildScanDataFiles, buildTool.getBuildScanDataCopyDir(), buildTool.getArtifactName())
    } else {
        core.info(`No Build Scan to process`)
    }
}

async function getBuildScanDataFiles(buildScanDataFolder: string): Promise<string[]> {
    core.debug(`Collecting build scans in ${buildScanDataFolder}/**`)
    const globber = await glob.create(`${buildScanDataFolder}/**`, {matchDirectories: false})
    return await globber.glob()
}

async function uploadArtifacts(
    files: string[],
    buildScanDataFolder: string,
    buildScanArtifactName: string
): Promise<void> {
    const artifactClient = new DefaultArtifactClient()

    await artifactClient.uploadArtifact(getArtifactName(buildScanArtifactName), files, buildScanDataFolder, {
        retentionDays: 1
    })
}

function getArtifactName(buildScanArtifactName: string): string {
    return `${buildScanArtifactName}-${input.getWorkflowName().replaceAll(' ', '-')}-${input
        .getJobName()
        .replaceAll(' ', '-')}`
}
