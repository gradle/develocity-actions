import * as core from '@actions/core'

import * as githubInternal from './shared/github'
import * as loader from './data/load'
import * as tosAcceptance from './tos-acceptance/check'
import * as buildScan from './build-scan/publish'
import * as pr from './pull-request/comment'
import * as cleaner from './data/cleanup'

/**
 * Main entrypoint for the Publish Maven Build Scan action
 */
export async function run(): Promise<void> {
    try {
        if (isEventTriggerSupported()) {
            core.info(`Starting Publish Maven Build Scans action`)

            const {prNumber, artifactId} = await loader.loadBuildScanData()
            if (prNumber && artifactId) {
                if (await tosAcceptance.isAccepted(prNumber)) {
                    const buildScanLinks = await buildScan.publishBuildScan()

                    await pr.commentPullRequestWithBuildScanLinks(prNumber, buildScanLinks)

                    await cleaner.deleteWorkflowArtifacts(artifactId)
                } else {
                    core.info('Skipping the publication: Terms of Service not accepted')
                }
            } else {
                core.info('Skipping the publication: No artifact found')
            }
        } else {
            core.info('Skipping the publication: Unsupported event trigger')
        }
    } catch (error) {
        // Fail the workflow run if an error occurs
        if (error instanceof Error) core.setFailed(error.message)
    }
}

function isEventTriggerSupported(): boolean {
    return githubInternal.isEventWorkflowRun() || githubInternal.isEventIssueWithTosAcceptanceComment()
}
