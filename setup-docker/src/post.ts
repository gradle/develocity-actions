import * as core from '@actions/core'

import * as agent from './agent'
import * as errorHandler from '../../build-scan-shared/src/error'
import * as input from './input'

// Catch and log any unhandled exceptions.
process.on('uncaughtException', e => errorHandler.handle(e))

/**
 * The post-execution entry point for the action, called after completing all steps for the Job
 */
export async function run(): Promise<void> {
    try {
        const scans = await agent.stop(input.getDrainTimeout(), input.getShutdownTimeout())
        await dumpSummary(scans, input.getAddJobSummary())
    } catch (error) {
        errorHandler.handle(error)
    }
}

async function dumpSummary(scans: string[], addJobSummary: boolean): Promise<void> {
    if (scans.length === 0) {
        core.info('No Docker Build Scan was published')
        return
    }

    for (const scan of scans) {
        core.info(`Docker Build Scan published: ${scan}`)
    }

    if (!addJobSummary) {
        return
    }
    core.summary.addHeading('Docker Build Scans', 3)
    core.summary.addList(scans.map(scan => `<a href="${scan}">${scan}</a>`))
    await core.summary.write()
}

void run()
