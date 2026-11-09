import * as errorHandler from '../../build-scan-shared/src/error'
import * as injection from './injection'
import * as input from '../../build-scan-shared/src/setup/input'

export async function main(): Promise<void> {
    try {
        const accessToken = await input.getAccessToken()

        await injection.installDevelocity()

        input.exportAccessToken(accessToken)
    } catch (error) {
        errorHandler.handle(error)
    }
}

void main()
