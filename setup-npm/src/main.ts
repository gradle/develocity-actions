import * as errorHandler from '../../build-scan-shared/src/error'
import * as injection from './injection'
import * as input from '../../build-scan-shared/src/setup/input'

/**
 * Main entrypoint for the action
 */
export async function run(): Promise<void> {
    try {
        // configure authentication
        const accessToken = await input.getAccessToken()

        await injection.installDevelocity()

        // Propagate environment variables to subsequent steps
        input.exportAccessToken(accessToken)
    } catch (error) {
        errorHandler.handle(error)
    }
}

void run()
