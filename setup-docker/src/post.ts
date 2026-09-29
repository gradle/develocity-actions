import * as agent from './agent'
import * as errorHandler from '../../build-scan-shared/src/error'
import * as input from './input'

// Catch and log any unhandled exceptions.
process.on('uncaughtException', e => errorHandler.handle(e))

/**
 * The post-execution entry point for the action, called after completing all steps for the Job
 */
export async function run(): Promise<void> {
    try {
        await agent.stop(input.getDrainTimeoutSeconds(), input.getShutdownTimeoutSeconds())
    } catch (error) {
        errorHandler.handle(error)
    }
}

void run()
