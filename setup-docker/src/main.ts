import * as core from '@actions/core'

import * as agent from './agent'
import * as auth from '../../build-scan-shared/src/auth/auth'
import * as errorHandler from '../../build-scan-shared/src/error'
import * as input from './input'

/**
 * Main entrypoint for the action
 */
export async function run(): Promise<void> {
    try {
        const accessKey = input.getDevelocityAccessKey()
        const accessToken = await auth.getAccessToken(accessKey, input.getDevelocityTokenExpiry())
        if (accessKey && accessToken === accessKey) {
            core.warning('No short-lived token could be fetched, so the Docker agent holds the long-lived access key')
        }

        await agent.start({
            develocityUrl: input.getDevelocityUrl(),
            accessKey: accessToken,
            projectId: input.getDevelocityProjectId(),
            agentUrl: input.getAgentUrl(),
            packageScanEnabled: input.getPackageScanEnabled(),
            allowUntrustedServer: input.getDevelocityAllowUntrustedServer(),
            buildxBuilder: input.getBuildxBuilder(),
            javaHome: input.getJavaHome(),
            shutdownTimeoutSeconds: input.getShutdownTimeout()
        })
    } catch (error) {
        errorHandler.handle(error)
    }
}

void run()
