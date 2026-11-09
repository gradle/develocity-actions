import * as errorHandler from '../../build-scan-shared/src/error'
import * as setup from './setup'
import * as setupInput from '../../build-scan-shared/src/setup/input'

/**
 * Main entrypoint for the action
 */
export async function run(): Promise<void> {
    try {
        const accessToken = await setupInput.getAccessToken()

        await setup.start(accessToken)
    } catch (error) {
        errorHandler.handle(error)
    }
}

void run()
