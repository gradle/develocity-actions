import * as core from '@actions/core'

import * as agent from './agent'
import * as auth from '../../build-scan-shared/src/auth/auth'
import * as errorHandler from '../../build-scan-shared/src/error'
import * as input from './input'
import * as setupInput from '../../build-scan-shared/src/setup/input'

/**
 * Main entrypoint for the action
 */
export async function run(): Promise<void> {
    try {
        const accessKey = await auth.getAccessToken(
            setupInput.getDevelocityAccessKey(),
            setupInput.getDevelocityTokenExpiry()
        )
        if (accessKey) {
            core.setSecret(accessKey)
        }

        await agent.start({
            develocityUrl: setupInput.getDevelocityUrl(),
            accessKey,
            version: input.getDevelocityDockerAgentVersion(),
            projectId: input.getDevelocityProjectId(),
            buildxBuilder: input.getBuildxBuilder(),
            packageScanEnabled: input.isPackageScanEnabled()
        })
    } catch (error) {
        errorHandler.handle(error)
    }
}

void run()
