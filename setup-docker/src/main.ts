import * as agent from './agent'
import * as auth from '../../build-scan-shared/src/auth/auth'
import * as errorHandler from '../../build-scan-shared/src/error'
import * as input from './input'

/**
 * Main entrypoint for the action
 */
export async function run(): Promise<void> {
    try {
        const accessToken = await auth.getAccessToken(input.getDevelocityAccessKey(), input.getDevelocityTokenExpiry())

        await agent.start({
            develocityUrl: input.getDevelocityUrl(),
            accessKey: accessToken,
            projectId: input.getDevelocityProjectId(),
            agentVersion: input.getAgentVersion(),
            agentBaseUrl: input.getAgentBaseUrl(),
            capturePackageList: input.getCapturePackageList(),
            buildxBuilder: input.getBuildxBuilder(),
            javaHomeOverride: input.getJavaHomeOverride()
        })
    } catch (error) {
        errorHandler.handle(error)
    }
}

void run()
