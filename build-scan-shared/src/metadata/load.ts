import path from 'path'

import * as core from '@actions/core'
import * as glob from '@actions/glob'
import PropertiesReader from 'properties-reader'

import * as props from './properties'
import {BuildToolType} from '../buildTool/common'

export interface Job {
    prNumber?: number
    builds: BuildMetadata[]
    buildToolType: BuildToolType
}

export interface BuildMetadata {
    projectId: string
    workflowName: string
    jobName: string
    buildToolVersion: string
    requestedTasks: string
    buildId: string
    buildFailure: boolean
    buildTimestamp: string
    buildScanLink?: string
}

export async function loadJobMetadata(buildToolType: BuildToolType, buildScanMetadataDir: string): Promise<Job> {
    let prNumber
    const builds: BuildMetadata[] = []

    // Collect build scan metadata
    const globber = await glob.create(`${buildScanMetadataDir}/*.txt`, {matchDirectories: false})
    const metadataFiles = await globber.glob()
    if (!metadataFiles || metadataFiles.length === 0) {
        core.info(`No build Scan metadata to process`)
        return <Job>{}
    }

    for (const metadataFile of metadataFiles) {
        const currentMetadata = toBuildMetadata(metadataFile)
        builds.push(currentMetadata.buildMetadata)
        prNumber = currentMetadata.prNumber
    }

    return {
        buildToolType,
        prNumber,
        builds: builds.sort(
            (a, b) =>
                a.jobName.localeCompare(b.jobName) ||
                a.buildTimestamp.toString().localeCompare(b.buildTimestamp.toString())
        )
    }
}

function toBuildMetadata(metadataFile: string): {buildMetadata: BuildMetadata; prNumber: number} {
    const buildId = path.parse(metadataFile).name
    const metadataReader = props.create(metadataFile)
    const prNumber = Number((metadataReader as PropertiesReader.Reader).get('PR_NUMBER'))
    const projectId = (metadataReader as PropertiesReader.Reader).get('PROJECT_ID') as string
    const workflowName = (metadataReader as PropertiesReader.Reader).get('WORKFLOW_NAME') as string
    const jobName = (metadataReader as PropertiesReader.Reader).get('JOB_NAME') as string
    const buildToolVersion = (metadataReader as PropertiesReader.Reader).get('BUILD_TOOL_VERSION') as string
    const requestedTasks = (metadataReader as PropertiesReader.Reader).get('REQUESTED_TASKS') as string
    const buildFailure = (metadataReader as PropertiesReader.Reader).get('BUILD_FAILURE')?.valueOf() as boolean
    const buildTimestamp = (metadataReader as PropertiesReader.Reader).get('TIMESTAMP') as string
    const buildScanLink = (metadataReader as PropertiesReader.Reader).get('BUILD_SCAN_LINK') as string
    if (!workflowName || !jobName || !requestedTasks) {
        core.info(
            `Unexpected Build Scan metadata content [${buildId},${prNumber},${workflowName},${jobName},${requestedTasks}]`
        )
    }

    return {
        buildMetadata: {
            projectId,
            workflowName,
            jobName,
            buildToolVersion,
            requestedTasks,
            buildId,
            buildFailure,
            buildTimestamp,
            buildScanLink
        },
        prNumber
    }
}
