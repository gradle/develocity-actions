import * as core from '@actions/core'

import * as auth from '../../build-scan-shared/src/auth/auth'
import * as buildTools from './buildTools'
import * as dockerSetup from '../../setup-docker/src/setup'
import * as errorHandler from '../../build-scan-shared/src/error'
import * as input from '../../build-scan-shared/src/setup/input'
import * as maven from '../../build-scan-shared/src/buildTool/maven'
import * as mavenSetup from '../../setup-maven/src/setup'
import * as npm from '../../build-scan-shared/src/buildTool/npm'
import * as npmInjection from '../../setup-npm/src/injection'
import * as pythonInjection from '../../setup-python/src/injection'
import * as setupInput from './input'
import {SupportedBuildTool} from './buildTools'

/**
 * Main entrypoint for the action
 */
export async function run(): Promise<void> {
    try {
        const selectedBuildTools = buildTools.getBuildTools(setupInput.getBuildTools(), process.cwd())
        if (selectedBuildTools.length === 0) {
            core.info('No supported build tool detected, Develocity is not set up')
            return
        }
        core.info(`Build tools to set up: ${selectedBuildTools.join(', ')}`)

        // configure authentication once for all build tools
        const accessKey = input.getDevelocityAccessKey()
        const accessToken = await auth.getAccessToken(
            accessKey,
            input.getDevelocityTokenExpiry(),
            input.getWorkloadIdentity()
        )

        const setUpBuildTools: SupportedBuildTool[] = []
        for (const buildTool of selectedBuildTools) {
            try {
                await setup(buildTool, accessKey, accessToken)
                setUpBuildTools.push(buildTool)
            } catch (error) {
                errorHandler.handle(error)
            }
        }
        core.saveState(buildTools.STATE_BUILD_TOOLS, setUpBuildTools.join(','))

        // Maven and npm export the same variables, which only the Maven capture extension reads
        if (setUpBuildTools.includes(SupportedBuildTool.MAVEN)) {
            input.exportVariables(accessToken, maven.mavenBuildTool)
        } else if (setUpBuildTools.includes(SupportedBuildTool.NPM)) {
            input.exportVariables(accessToken, npm.npmBuildTool)
        }
    } catch (error) {
        errorHandler.handle(error)
    }
}

async function setup(buildTool: SupportedBuildTool, accessKey: string, accessToken: string): Promise<void> {
    core.info(`Setting up Develocity for ${buildTool}`)
    switch (buildTool) {
        case SupportedBuildTool.MAVEN:
            return await mavenSetup.setup()
        case SupportedBuildTool.NPM:
            return await npmInjection.installDevelocity()
        case SupportedBuildTool.PYTHON:
            return await pythonInjection.installDevelocity(accessToken)
        case SupportedBuildTool.DOCKER:
            return await dockerSetup.start(accessKey, accessToken)
    }
}

void run()
