import * as core from '@actions/core'
import * as glob from '@actions/glob'
import {DefaultArtifactClient} from '@actions/artifact'

import * as input from './input'
import * as commonBuildTool from '../buildTool/common'
import * as summary from '../summary/dump'

export async function post(buildTool: commonBuildTool.BuildTool): Promise<void> {
    await uploadBuildScanDataFiles(buildTool)

    await summary.dump(buildTool.getType(), buildTool.getBuildScanMetadataDir(), buildTool.getBuildScanWorkDir())
}

async function uploadBuildScanDataFiles(buildTool: commonBuildTool.BuildTool): Promise<void> {
    // Retrieve Build Scan data and metadata files
    const buildScanFiles = await getBuildScanDataFiles(buildTool.getBuildScanWorkDir())
    if (hasBuildScanDumpToUpload(buildScanFiles, buildTool.getBuildScanDataCopyDir())) {
        // Upload Build Scan data as workflow artifact if unpublished scans are present
        await uploadArtifacts(buildScanFiles, buildTool.getBuildScanWorkDir(), buildTool.getArtifactName())
    } else {
        core.info(`No unpublished build scan to process`)
    }
}

function hasBuildScanDumpToUpload(buildScanFiles: string[], buildScanDataWorkDir: string): boolean {
    return buildScanFiles && buildScanFiles.some(buildScanFile => buildScanFile.startsWith(buildScanDataWorkDir))
}

async function getBuildScanDataFiles(buildScanDataFolder: string): Promise<string[]> {
    core.debug(`Collecting build scan files in ${buildScanDataFolder}/**`)
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
