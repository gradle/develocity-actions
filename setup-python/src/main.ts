import * as auth from '../../build-scan-shared/src/auth/auth'
import * as errorHandler from '../../build-scan-shared/src/error'
import * as injection from './injection'
import * as input from '../../build-scan-shared/src/setup/input'

export async function main(): Promise<void> {
    try {
        const accessToken = await auth.getAccessToken(input.getDevelocityAccessKey(), input.getDevelocityTokenExpiry())

        await injection.installDevelocity(accessToken)
    } catch (error) {
        errorHandler.handle(error)
    }
}

void main()
