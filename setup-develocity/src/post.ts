import * as core from '@actions/core'

import * as buildTools from './buildTools'
import * as dockerSetup from '../../setup-docker/src/setup'
import * as errorHandler from '../../build-scan-shared/src/error'
import * as maven from '../../build-scan-shared/src/buildTool/maven'
import * as setup from '../../build-scan-shared/src/setup/post'
import {SupportedBuildTool} from './buildTools'

// Catch and log any unhandled exceptions.
process.on('uncaughtException', e => errorHandler.handle(e))

/**
 * The post-execution entry point for the action, called after completing all steps for the Job
 */
export async function run(): Promise<void> {
    const setUpBuildTools = core.getState(buildTools.STATE_BUILD_TOOLS).split(',').filter(Boolean)
    for (const buildTool of setUpBuildTools) {
        try {
            await post(buildTool as SupportedBuildTool)
        } catch (error) {
            errorHandler.handle(error)
        }
    }
}

async function post(buildTool: SupportedBuildTool): Promise<void> {
    switch (buildTool) {
        case SupportedBuildTool.MAVEN:
            return await setup.post(maven.mavenBuildTool)
        case SupportedBuildTool.DOCKER:
            return await dockerSetup.stop()
    }
}

void run()
