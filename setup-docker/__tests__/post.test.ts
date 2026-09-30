import {jest} from '@jest/globals'

process.env['RUNNER_TEMP'] = '/tmp'

const mockStop = jest.fn<(drainTimeout: number, shutdownTimeout: number) => Promise<string[]>>()

jest.unstable_mockModule('../src/agent', () => ({
    stop: mockStop
}))

const mockAddHeading = jest.fn()
const mockAddList = jest.fn()
const mockWrite = jest.fn()

jest.unstable_mockModule('@actions/core', () => ({
    getInput: jest.fn<() => string>().mockReturnValue(''),
    getState: jest.fn<() => string>().mockReturnValue(''),
    info: jest.fn(),
    warning: jest.fn(),
    debug: jest.fn(),
    summary: {
        addHeading: mockAddHeading,
        addList: mockAddList,
        write: mockWrite
    }
}))

const {run} = await import('../src/post')

describe('Post Setup Docker', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Writes the published scans to the job summary', async () => {
        // given
        mockStop.mockResolvedValue(['https://develocity.example.com/s/aaaaaaaaaaaaa'])

        // when
        await run()

        // then
        expect(mockStop).toHaveBeenCalled()
        expect(mockAddHeading).toHaveBeenCalledWith('Docker Build Scans', 3)
        expect(mockWrite).toHaveBeenCalled()
    })

    it('Writes no summary when nothing was published', async () => {
        // given
        mockStop.mockResolvedValue([])

        // when
        await run()

        // then
        expect(mockStop).toHaveBeenCalled()
        expect(mockAddHeading).not.toHaveBeenCalled()
        expect(mockWrite).not.toHaveBeenCalled()
    })

    it('Does not fail the job when the agent cannot be stopped', async () => {
        // given
        mockStop.mockRejectedValue(new Error('boom'))

        // when, then
        await expect(run()).resolves.toBeUndefined()
    })
})
