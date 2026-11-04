import * as auth from '../../build-scan-shared/src/auth/auth'
import * as errorHandler from '../../build-scan-shared/src/error'
import * as input from './input'
import * as setup from './setup'
import * as setupInput from '../../build-scan-shared/src/setup/input'

/**
 * Main entrypoint for the action
 */
export async function run(): Promise<void> {
    try {
        const accessKey = input.getDevelocityAccessKey()
        const accessToken = await auth.getAccessToken(
            accessKey,
            input.getDevelocityTokenExpiry(),
            setupInput.getWorkloadIdentity()
        )

        await setup.start(accessKey, accessToken)
    } catch (error) {
        errorHandler.handle(error)
    }
}

void run()
