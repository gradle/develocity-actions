import * as auth from '../../build-scan-shared/src/auth/auth'
import * as errorHandler from '../../build-scan-shared/src/error'
import * as input from '../../build-scan-shared/src/setup/input'
import * as maven from '../../build-scan-shared/src/buildTool/maven'
import * as setup from './setup'

/**
 * Main entrypoint for the action
 */
export async function run(): Promise<void> {
    try {
        // configure authentication
        const accessToken = await auth.getAccessToken(
            input.getDevelocityAccessKey(),
            input.getDevelocityTokenExpiry(),
            input.getWorkloadIdentity()
        )

        await setup.setup()

        // Propagate environment variables to subsequent steps
        input.exportVariables(accessToken, maven.mavenBuildTool)
    } catch (error) {
        errorHandler.handle(error)
    }
}

void run()
