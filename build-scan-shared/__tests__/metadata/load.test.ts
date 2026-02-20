import {jest} from '@jest/globals'

const mockGlob = jest.fn<() => Promise<string[]>>()
const mockCreate = jest.fn<(patterns: string, options?: object) => Promise<{glob: () => Promise<string[]>}>>()

jest.unstable_mockModule('@actions/glob', () => ({
    create: mockCreate
}))

function setupGlob(matchedFiles: string[]): void {
    mockGlob.mockResolvedValue(matchedFiles)
    mockCreate.mockResolvedValue({glob: mockGlob})
}

const mockedPrNumber = 4242

const mockReader = {
    get(): string {
        return mockedPrNumber.toString()
    }
}

jest.unstable_mockModule('properties-reader', () => ({
    default: jest.fn(() => mockReader)
}))

const {loadJobMetadata} = await import('../../src/metadata/load')
const {BuildToolType} = await import('../../src/buildTool/common')

describe('load', () => {
    afterEach(() => {
        jest.resetAllMocks()
    })

    it('Load build scan metadata succeeds', async () => {
        // given
        setupGlob([
            '/home/foo/.m2/build-scan-data/1.42/previous/abcdef/scan.scan',
            '/home/foo/.m2/build-scan-data/1.42/previous/ghijkl/scan.scan'
        ])

        // when
        const buildScanData = await loadJobMetadata(BuildToolType.MAVEN, 'buildScanMetadataDir')

        // then
        expect(buildScanData?.builds).toHaveLength(2)
        expect(buildScanData?.prNumber).toBe(mockedPrNumber)
    })

    it('Load build scan metadata does nothing without metadata file', async () => {
        // given
        setupGlob([])

        // when
        const buildScanData = await loadJobMetadata(BuildToolType.MAVEN, 'buildScanMetadataDir')

        // then
        expect(buildScanData?.builds).toBeUndefined()
        expect(buildScanData?.prNumber).toBeUndefined()
    })
})
