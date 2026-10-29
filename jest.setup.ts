import {beforeEach, jest} from '@jest/globals'

// `@actions/core` writes workflow commands (`::warning::`, `::error::`, ...) to stdout, and on a runner each one
// becomes an annotation on the job. Drop them so the warnings exercised by tests don't show up as annotations.
// Tests asserting on these commands spy on `process.stdout.write` themselves, which replaces this implementation.
const write = process.stdout.write.bind(process.stdout) as (...args: unknown[]) => boolean

function dropWorkflowCommands(): void {
    jest.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown, ...args: unknown[]) =>
        String(chunk).startsWith('::') ? true : write(chunk, ...args)) as typeof process.stdout.write)
}

// Entry points call `run()` when imported, so also cover the output written while a test file loads.
dropWorkflowCommands()
beforeEach(dropWorkflowCommands)
