import * as errorHandler from '../../build-scan-shared/src/error'
import * as input from '../../build-scan-shared/src/setup/input'
import * as setup from './setup'

/**
 * Main entrypoint for the action
 */
export async function run(): Promise<void> {
    try {
        // configure authentication
        const accessToken = await input.getAccessToken()

        await setup.setup()

        // Propagate environment variables to subsequent steps
        input.exportAccessToken(accessToken)
    } catch (error) {
        errorHandler.handle(error)
    }
}

void run()
