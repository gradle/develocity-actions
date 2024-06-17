import path from 'path'

import * as core from '@actions/core'

import {Job, BuildMetadata} from '../metadata/load'
import * as githubUtils from '../utils/github'
import * as input from '../setup/input'
import * as io from '../utils/io'
import {BuildToolType} from '../buildTool/common'
import * as loader from '../metadata/load'

const DUMP_FILENAME = 'build-metadata.json'

export async function dump(
    buildToolType: BuildToolType,
    buildScanMetadataDir: string,
    buildScanWorkDir: string
): Promise<void> {
    const job = await loader.loadJobMetadata(buildToolType, buildScanMetadataDir)
    if (job.builds && job.builds.length > 0) {
        const htmlSummary = getHtmlSummary(job)

        dumpToFile(job, buildScanWorkDir)

        if (input.isAddPrComment() && job.prNumber) {
            await dumpToPullRequestComment(job.prNumber, htmlSummary)
        }

        if (input.isAddJobSummary()) {
            await dumpToWorkflowSummary(htmlSummary)
        }
    }
}

function dumpToFile(job: Job, buildScanWorkDir: string): void {
    if (!io.existsSync(buildScanWorkDir)) {
        io.mkdirSync(buildScanWorkDir)
    }
    io.writeContentToFileSync(path.resolve(buildScanWorkDir, DUMP_FILENAME), JSON.stringify(job))
}

function getHtmlSummary(job: Job): string {
    return `
<table>
    <tr>${
        input.isAddProjectIdInJobSummary()
            ? `
        <th>Project</th>`
            : ''
    }
        <th>Job</th>
        <th>Requested ${getWorkUnitName(job.buildToolType)}</th>
        <th>Build Tool Version</th>
        <th>Build Outcome</th>
        <th>Build Scan®</th>
    </tr>${job.builds.map(build => renderBuildResultRow(build)).join('')}
</table>
    `
}

function getWorkUnitName(buildToolType: BuildToolType): string {
    switch (buildToolType) {
        case BuildToolType.GRADLE:
            return 'tasks'
        case BuildToolType.MAVEN:
            return 'goals'
    }
}

function renderBuildResultRow(build: BuildMetadata): string {
    return `
    <tr>${
        input.isAddProjectIdInJobSummary()
            ? `        
        <td>${build.projectId}</td>`
            : ''
    }
        <td>${build.jobName}</td>
        <td>${build.requestedTasks}</td>
        <td align='center'>${build.buildToolVersion}</td>
        <td align='center'>${renderOutcome(build)}</td>
        <td>${renderBuildScan(build)}</td>
    </tr>`
}

function renderOutcome(build: BuildMetadata): string {
    return build.buildFailure ? ':x:' : ':white_check_mark:'
}

function renderBuildScan(build: BuildMetadata): string {
    if (build.buildScanLink) {
        return renderBuildScanBadge('PUBLISHED', '06A0CE', build.buildScanLink)
    }
    return renderBuildScanBadge('NOT_PUBLISHED', 'lightgrey', 'https://scans.gradle.com')
}

function renderBuildScanBadge(outcomeText: string, outcomeColor: string, targetUrl: string): string {
    const badgeUrl = `https://img.shields.io/badge/Build%20Scan%C2%AE-${outcomeText}-${outcomeColor}?logo=Gradle`
    const badgeHtml = `<img src="${badgeUrl}" alt="Build Scan ${outcomeText}" />`
    return `<a href="${targetUrl}" rel="nofollow">${badgeHtml}</a>`
}

async function dumpToPullRequestComment(prNumber: number, htmlSummary: string): Promise<void> {
    if (prNumber > 0) {
        try {
            await githubUtils.commentPullRequest(prNumber, htmlSummary)
        } catch (error) {
            core.info(`Unable to comment PR ${prNumber}: ${error}`)
        }
    }
}

async function dumpToWorkflowSummary(htmlSummary: string): Promise<void> {
    await githubUtils.addSummary('Builds', htmlSummary)
}
