import * as core from '@actions/core'

import * as commonBuildTool from '../buildTool/common'
import * as githubUtils from '../utils/github'
import * as input from './input'

export async function publish(buildTool: commonBuildTool.BuildTool): Promise<void> {
    githubUtils.logOriginWorkflowLink()

    if (githubUtils.isPublicationAllowed(input.getAuthorizedUsersList().trim())) {
        const artifactIds = await githubUtils.downloadBuildScanData(
            buildTool.getArtifactName(),
            buildTool.getDevelocityDir()
        )

        // Publish build scans
        await buildTool.buildScanPublish()

        // delete workflow artifacts
        await githubUtils.deleteWorkflowArtifacts(artifactIds)
    } else {
        core.info('Skipping the publication: Unsupported event trigger')
    }
}
