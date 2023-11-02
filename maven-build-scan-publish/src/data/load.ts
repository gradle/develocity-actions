import * as core from '@actions/core'
import * as github from '@actions/github'
import * as glob from '@actions/glob'
import {GitHub} from '@actions/github/lib/utils'

import * as githubInternal from '../shared/github'
import * as params from '../shared/params'
import * as layout from '../shared/layout'
import * as io from '../shared/io'
import {Contributor} from "../tos-acceptance/persistence";

const BUILD_SCAN_DATA_ARTIFACT_NAME = 'maven-build-scan-data'
const ZIP_EXTENSION = 'zip'

export interface BuildScanData {
    prNumber: number,
    artifactId: number
}

export async function loadBuildScanData(): Promise<BuildScanData | null> {
    const octokit = githubInternal.getOctokit()

    let buildScanArtifactId
    if (githubInternal.isEventWorkflowRun()) {
        buildScanArtifactId = await getArtifactIdForWorkflowRun(octokit)
    } else {
        buildScanArtifactId = await getArtifactIdForIssueComment(octokit)
    }

    if (buildScanArtifactId) {
        let download
        try {
            // Download the Build Scan artifact
            core.debug(`Downloading artifact ${buildScanArtifactId}`)
            download = await octokit.rest.actions.downloadArtifact({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                artifact_id: buildScanArtifactId,
                archive_format: ZIP_EXTENSION
            })
        } catch (error) {
            // @ts-ignore
            if (error.status === 410) {
                core.debug(`Artifact deleted or expired`)
                return null
            } else {
                throw error;
            }
        }

        // Create Build Scan directory
        const mavenBuildScanData = layout.mavenBuildScanData()
        if (!io.existsSync(mavenBuildScanData)) {
            core.debug(`Creating ${mavenBuildScanData}`)
            io.mkdirSync(mavenBuildScanData, {recursive: true})
        }

        // Write artifact
        const downloadZip = `${BUILD_SCAN_DATA_ARTIFACT_NAME}.${ZIP_EXTENSION}`
        core.debug(`Writing data to ${downloadZip}`)
        io.writeFileSync(mavenBuildScanData, downloadZip, download.data as ArrayBuffer)

        // Expand the archive
        core.debug(`Extracting to ${mavenBuildScanData}`)
        const extracted = await io.extractZip(downloadZip, mavenBuildScanData)
        core.debug(`Extracted Build Scan artifact to ${extracted}: ${io.readdirSync(extracted)}`)

        // Collect pull-request number
        const globber = await glob.create(`${layout.mavenBuildScanData()}/**/pr-number.properties`)
        const prNumberFiles = await globber.glob()
        const prNumberFile = prNumberFiles?.at(0)
        if (!prNumberFile) {
            throw new Error(`Build Scan metadata not found`)
        }

        const prNumberFileContent = io.readFileSync(prNumberFile)
        const prNumber = prNumberFileContent.split(/\r?\n/)?.at(0)?.split('=')?.at(1)

        core.debug(`Publishing Build Scans for Pull-request ${prNumber}`)

        return {prNumber: Number(prNumber), artifactId: buildScanArtifactId}
    }

    return null
}

async function getArtifactIdForWorkflowRun(octokit: InstanceType<typeof GitHub>): Promise<undefined | number> {
    const runId = github.context.payload.workflow_run.id

    // Find the workflow run artifacts named 'maven-build-scan-data'
    const artifacts = await octokit.rest.actions.listWorkflowRunArtifacts({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        run_id: runId
    })

    const matchArtifact = getBuildScanArtifact(artifacts)

    return matchArtifact?.id
}

async function getArtifactIdForIssueComment(octokit: InstanceType<typeof GitHub>): Promise<undefined | number> {
    const pull = await octokit.rest.pulls.get({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pull_number: github.context.issue.number
    })
    const commit = pull.data.head.sha

    core.debug(
        `Looking for workflow runs matching ${github.context.repo.owner}/${
            github.context.repo.repo
        }/${params.getBuildWorkflowFileName()}/${commit}`
    )
    for await (const runs of octokit.paginate.iterator(octokit.rest.actions.listWorkflowRuns, {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        workflow_id: params.getBuildWorkflowFileName(),
        head_sha: commit
    })) {
        for (const run of runs.data) {
            core.debug(`Looking for artifacts for workflow ${run.id}`)
            const artifacts = await octokit.rest.actions.listWorkflowRunArtifacts({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                run_id: run.id
            })

            const matchArtifact = getBuildScanArtifact(artifacts)
            if (matchArtifact) {
                return matchArtifact.id
            }
        }
    }

    return undefined
}

function getBuildScanArtifact(artifacts: any) {
    // @ts-ignore
    return artifacts.data.artifacts.find(candidate => {
        return candidate.name === BUILD_SCAN_DATA_ARTIFACT_NAME
    })
}

export const exportedForTesting = {
    getArtifactIdForWorkflowRun,
    getArtifactIdForIssueComment
}