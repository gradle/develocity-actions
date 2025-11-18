import * as core from '@actions/core'

import * as commonBuildTool from '../buildTool/common'
import * as githubUtils from '../utils/github'
import * as input from './input'
import * as summary from '../summary/dump'

export async function publish(buildTool: commonBuildTool.PostPublishingBuildTool): Promise<void> {
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

        //FIXME this is already done in the setup post action but need to be here to allow Quarkus report to consume the summary
        // Dump summary
        await summary.dump(buildTool.getType(), buildTool.getBuildScanMetadataDir(), buildTool.getBuildScanWorkDir())
    } else {
        core.info('Skipping the publication: Unsupported event trigger')
    }
}
