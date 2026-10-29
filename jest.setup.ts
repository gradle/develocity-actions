import {beforeEach, jest} from '@jest/globals'

// `@actions/core` writes workflow commands (`::warning::`, `::error::`, ...) to stdout, and on a runner each one
// becomes an annotation on the job. Replace the leading `::` so the warnings exercised by tests are still printed,
// but the runner no longer treats them as commands. Tests asserting on these commands spy on `process.stdout.write`
// themselves, which replaces this implementation.
const write = process.stdout.write.bind(process.stdout) as (...args: unknown[]) => boolean

function printWorkflowCommandsAsText(): void {
    jest.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown, ...args: unknown[]) =>
        write(
            typeof chunk === 'string' ? chunk.replace(/^(\s*)::/gm, '$1[test output] ') : chunk,
            ...args
        )) as typeof process.stdout.write)
}

// Entry points call `run()` when imported, so also cover the output written while a test file loads.
printWorkflowCommandsAsText()
beforeEach(printWorkflowCommandsAsText)
