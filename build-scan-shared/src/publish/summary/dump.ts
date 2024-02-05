import path from 'path'
import * as core from '@actions/core'

import {BuildArtifact, BuildMetadata} from '../data/load'
import * as githubUtils from '../utils/github'
import * as input from '../input'
import * as io from '../../io'
import * as sharedInput from '../../input'
import {BuildToolType} from '../../buildTool/common'

const DUMP_FILENAME = 'build-metadata.json'

export async function dump(buildArtifact: BuildArtifact, buildScanWorkDir: string): Promise<void> {
    updateBuildScanLinks(buildArtifact.builds, buildScanWorkDir)

    if (buildArtifact.builds.length > 0) {
        const htmlSummary = getHtmlSummary(buildArtifact)

        dumpToFile(buildArtifact, buildScanWorkDir)

        if (!input.isSkipPrComment()) {
            await dumpToPullRequestComment(buildArtifact.prNumber, htmlSummary)
        }

        if (!input.isSkipJobSummary()) {
            await dumpToWorkflowSummary(htmlSummary)
        }
    }
}

function updateBuildScanLinks(buildMetadata: BuildMetadata[], buildScanWorkDir: string): void {
    const buildScanLinkFile = path.resolve(buildScanWorkDir, sharedInput.BUILD_SCAN_LINK_FILE)
    if(io.existsSync(buildScanLinkFile)) {
        const buildScanLinks = io.readFileSync(path.resolve(buildScanWorkDir, sharedInput.BUILD_SCAN_LINK_FILE))
        if (buildScanLinks) {
            for (const buildScanLinksLine of buildScanLinks.split('\n')) {
                const buildScanLinkData = buildScanLinksLine.split('=')
                if (buildScanLinkData && buildScanLinkData.length === 2) {
                    const buildId = buildScanLinkData[0]
                    const buildScanLink = buildScanLinkData[1]
                    const match = buildMetadata.find(element => element.buildId === buildId)
                    if (match) {
                        match.buildScanLink = buildScanLink
                    }
                }
            }
        } else {
            core.warning(`Build scan link file is empty, build summary won't contain build scan links`)
        }
    } else {
        core.warning(`Build scan link file not found, build summary won't contain build scan links`)
    }
}

function dumpToFile(buildArtifact: BuildArtifact, buildScanWorkDir: string): void {
    io.writeContentToFileSync(path.resolve(buildScanWorkDir, DUMP_FILENAME), JSON.stringify(buildArtifact))
}

function getHtmlSummary(buildArtifact: BuildArtifact): string {
    return `
<table>
    <tr>${input.isSkipProjectIdInJobSummary() ? '' : `
        <th>Project</th>`}
        <th>Job</th>
        <th>Requested ${getWorkUnitName(buildArtifact.buildToolType)}</th>
        <th>Build Tool Version</th>
        <th>Build Outcome</th>
        <th>Build Scan®</th>
    </tr>${buildArtifact.builds.map(build => renderBuildResultRow(build)).join('')}
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
    <tr>${input.isSkipProjectIdInJobSummary() ? '' : `        
        <td>${build.projectId}</td>`}
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
    if(prNumber > 0) {
        await githubUtils.commentPullRequest(prNumber, htmlSummary)
    }
}

async function dumpToWorkflowSummary(htmlSummary: string): Promise<void> {
    await githubUtils.addSummary('Builds', htmlSummary)
}
