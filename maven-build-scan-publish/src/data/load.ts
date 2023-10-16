import * as fs from 'fs'
import path from 'path'

import * as core from '@actions/core'
import * as github from '@actions/github'
import * as glob from '@actions/glob'
import * as toolCache from '@actions/tool-cache'
import {GitHub} from '@actions/github/lib/utils'

import * as githubInternal from '../shared/github'
import * as params from '../shared/params'
import * as layout from '../shared/layout'

const BUILD_SCAN_DATA_ARTIFACT_NAME = 'maven-build-scan-data'
const ZIP_EXTENSION = 'zip'

export async function loadBuildScanData(): Promise<{prNumber?: number; artifactId?: number}> {
    const octokit = githubInternal.getOctokit()

    let buildScanArtifactId
    if (githubInternal.isEventWorkflowRun()) {
        buildScanArtifactId = await getArtifactIdForWorkflowRun(octokit)
    } else {
        buildScanArtifactId = await getArtifactIdForIssueComment(octokit)
    }

    if (buildScanArtifactId) {
        // Download the Build Scan artifact
        core.debug(`Downloading artifact ${buildScanArtifactId}`)
        const download = await octokit.rest.actions.downloadArtifact({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            artifact_id: buildScanArtifactId,
            archive_format: ZIP_EXTENSION
        })

        // Create Build Scan directory
        const mavenBuildScanData = layout.mavenBuildScanData()
        if (!fs.existsSync(mavenBuildScanData)) {
            core.debug(`Creating ${mavenBuildScanData}`)
            fs.mkdirSync(mavenBuildScanData, {recursive: true})
        }

        const downloadBuffer = download.data as ArrayBuffer
        const downloadZip = path.resolve(mavenBuildScanData, `${BUILD_SCAN_DATA_ARTIFACT_NAME}.${ZIP_EXTENSION}`)
        core.debug(`Writing data to ${downloadZip}`)
        fs.writeFileSync(downloadZip, Buffer.from(downloadBuffer))

        // Expand the archive
        const extractDir = path.resolve(mavenBuildScanData)
        core.debug(`Extracting to ${extractDir}`)
        const extracted = await toolCache.extractZip(downloadZip, extractDir)
        core.debug(`Extracted Build Scan artifact to ${extracted}: ${fs.readdirSync(extracted)}`)

        // Collect pull-request number
        const globber = await glob.create(`${layout.mavenBuildScanData()}/**/pr-number.properties`)
        const prNumberFiles = await globber.glob()
        const prNumberFile = prNumberFiles?.at(0)
        if (!prNumberFile) {
            throw new Error(`Build Scan metadata not found`)
        }

        const prNumberFileContent = fs.readFileSync(path.resolve(prNumberFile), 'utf-8')
        const prNumber = prNumberFileContent.split(/\r?\n/)?.at(0)?.split('=')?.at(1)

        core.debug(`Publishing Build Scans for Pull-request ${prNumber}`)

        return {prNumber: Number(prNumber), artifactId: buildScanArtifactId}
    }

    return {prNumber: undefined, artifactId: undefined}
}

async function getArtifactIdForWorkflowRun(octokit: InstanceType<typeof GitHub>): Promise<undefined | number> {
    const runId = github.context.payload.workflow_run.id

    // Find the workflow run artifacts named 'maven-build-scan-data'
    const artifacts = await octokit.rest.actions.listWorkflowRunArtifacts({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        run_id: runId
    })

    const matchArtifact = artifacts.data.artifacts.find(candidate => {
        return candidate.name === BUILD_SCAN_DATA_ARTIFACT_NAME
    })

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
            const artifacts = await octokit.paginate(octokit.rest.actions.listWorkflowRunArtifacts, {
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                run_id: run.id
            })
            if (!artifacts || artifacts.length === 0) {
                continue
            }

            const matchArtifact = artifacts.find(candidate => {
                return candidate.name === BUILD_SCAN_DATA_ARTIFACT_NAME
            })

            if (!matchArtifact) {
                continue
            }

            return matchArtifact.id
        }
    }

    return undefined
}
