import * as errorHandler from '../../build-scan-shared/src/error'
import * as setup from './setup'

// Catch and log any unhandled exceptions.
process.on('uncaughtException', e => errorHandler.handle(e))

/**
 * The post-execution entry point for the action, called after completing all steps for the Job
 */
export async function run(): Promise<void> {
    try {
        await setup.stop()
    } catch (error) {
        errorHandler.handle(error)
    }
}

void run()
