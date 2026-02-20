import {jest} from '@jest/globals'

process.env['RUNNER_TEMP'] = '/tmp'

const mockGlob = jest.fn<() => Promise<string[]>>()
const mockCreate = jest.fn<(patterns: string, options?: object) => Promise<{glob: () => Promise<string[]>}>>()

jest.unstable_mockModule('@actions/glob', () => ({
    create: mockCreate
}))

function setupGlob(matchedFiles: string[]): void {
    mockGlob.mockResolvedValue(matchedFiles)
    mockCreate.mockResolvedValue({glob: mockGlob})
}

const mockUploadArtifact = jest.fn()

jest.unstable_mockModule('@actions/artifact', () => ({
    DefaultArtifactClient: jest.fn().mockImplementation(() => ({
        uploadArtifact: mockUploadArtifact
    }))
}))

const mockDumpSummary = jest.fn()

jest.unstable_mockModule('../../build-scan-shared/src/summary/dump', () => ({
    dump: mockDumpSummary
}))

const {run} = await import('../src/post')
await import('@actions/artifact')

describe('Post Setup Maven', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Post-execution with build scan succeeds', async () => {
        // Given
        setupGlob(['/tmp/maven-build-scan-data/build-scan-data/foo.scan'])

        // when
        await run()

        // then
        expect(mockUploadArtifact).toHaveBeenCalled()
        expect(mockDumpSummary).toHaveBeenCalled()
    })

    it('Post-execution without build scan does not upload artifact', async () => {
        // Given
        setupGlob([])

        // when
        await run()

        // then
        expect(mockUploadArtifact).not.toHaveBeenCalled()
        expect(mockDumpSummary).toHaveBeenCalled()
    })
})
