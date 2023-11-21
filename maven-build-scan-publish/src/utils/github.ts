import * as github from '@actions/github'
import {GitHub} from '@actions/github/lib/utils'
import {OctokitResponse} from '@octokit/types' // eslint-disable-line import/named
import * as core from '@actions/core'

import * as input from './input'
import * as io from './io'

const ZIP_EXTENSION = 'zip'
const BUILD_SCAN_DATA_ARTIFACT_NAME = 'maven-build-scan-data'

export function getOctokit(): InstanceType<typeof GitHub> {
    return github.getOctokit(input.getGithubToken())
}

export function isPublicationAllowed(): boolean {
    return isEventSupported() && isUserAuthorized()
}
function isEventSupported(): boolean {
    return github.context.eventName === 'workflow_run'
}

function isUserAuthorized(): boolean {
    const authorizedList = input.getAuthorizedList().trim()
    const prSubmitter = github.context.payload.workflow_run.actor.login

    core.debug(`prSubmitter = ${prSubmitter}`)
    if (authorizedList && !authorizedList.split(',').includes(prSubmitter)) {
        core.info(`user ${prSubmitter} not authorized to publish Build Scans`)
        return false
    }

    return true
}

export async function extractArtifactToDirectory(artifactId: number, folderName: string): Promise<boolean> {
    let isDownLoadArtifactToFile = false
    try {
        const archiveName = `${BUILD_SCAN_DATA_ARTIFACT_NAME}.${ZIP_EXTENSION}`

        // Download the Build Scan artifact
        core.debug(`Downloading artifact ${artifactId}`)
        const download = await getOctokit().rest.actions.downloadArtifact({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            artifact_id: artifactId,
            archive_format: ZIP_EXTENSION
        })
        if (download && download.data) {
            // Create Build Scan directory
            if (!io.existsSync(folderName)) {
                core.debug(`Creating ${folderName}`)
                io.mkdirSync(folderName, {recursive: true})
            }

            // Write artifact
            core.debug(`Writing data to ${archiveName}`)
            io.writeFileSync(folderName, archiveName, download.data as ArrayBuffer)

            // Expand archive
            core.debug(`Extracting to ${folderName}`)
            const extracted = await io.extractZip(archiveName, folderName)
            if (core.isDebug()) {
                core.debug(`Extracted Build Scan artifact to ${extracted}: ${io.readdirSync(extracted)}`)
            }

            isDownLoadArtifactToFile = true
        } else {
            core.warning(`Unable to download artifact ${artifactId}`)
        }
    } catch (error) {
        const typedError = error as OctokitResponse<unknown>
        if (typedError && typedError.status === 410) {
            core.debug(`Artifact deleted or expired`)
        } else {
            throw error
        }
    }

    return isDownLoadArtifactToFile
}

export async function getArtifactIdForWorkflowRun(): Promise<undefined | number> {
    const runId = github.context.payload.workflow_run.id

    // Find the workflow run artifacts named 'maven-build-scan-data'
    const artifacts = await getOctokit().rest.actions.listWorkflowRunArtifacts({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        run_id: runId
    })

    const matchArtifact = getBuildScanArtifact(artifacts)

    return matchArtifact?.id
}

function getBuildScanArtifact(artifacts: any): any {
    return artifacts.data.artifacts.find((candidate: any) => {
        return candidate.name === BUILD_SCAN_DATA_ARTIFACT_NAME
    })
}

export async function deleteWorkflowArtifacts(artifactId: number): Promise<void> {
    core.debug(`Deleting artifact with id ${artifactId}`)
    await getOctokit().rest.actions.deleteArtifact({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        artifact_id: artifactId
    })
}

export async function commentPullRequest(prNumber: number, comment: string): Promise<void> {
    await getOctokit().rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: prNumber,
        body: comment
    })
}
