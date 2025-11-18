import * as auth from '../../build-scan-shared/src/auth/auth'
import * as errorHandler from '../../build-scan-shared/src/error'
import * as injection from './injection'
import * as input from '../../build-scan-shared/src/setup/input'
import * as npm from '../../build-scan-shared/src/buildTool/npm'

/**
 * Main entrypoint for the action
 */
export async function run(): Promise<void> {
    try {
        // configure authentication
        const accessToken = await auth.getAccessToken(input.getDevelocityAccessKey(), input.getDevelocityTokenExpiry())

        await injection.installDevelocity()

        // Propagate environment variables to subsequent steps
        input.exportVariables(accessToken, npm.npmBuildTool)
    } catch (error) {
        errorHandler.handle(error)
    }
}

void run()
