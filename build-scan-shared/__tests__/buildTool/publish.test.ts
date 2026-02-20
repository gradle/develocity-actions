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

const mockExecOutput = jest.fn<() => Promise<object>>()

jest.unstable_mockModule('@actions/exec', () => ({
    getExecOutput: mockExecOutput
}))

jest.unstable_mockModule('../../src/utils/io', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    writeContentToFileSync: jest.fn()
}))

process.env['RUNNER_TEMP'] = '/tmp'

const {mavenBuildTool} = await import('../../src/buildTool/maven')

describe('publish', () => {
    let createPublisherProjectMock: any
    let createPluginDescriptorMock: any

    beforeEach(() => {
        createPublisherProjectMock = jest.spyOn(mavenBuildTool, 'createPublisherProjectStructure').mockReturnValue()
        createPluginDescriptorMock = jest
            .spyOn(mavenBuildTool, 'createPluginDescriptorFileWithCurrentVersion')
            .mockReturnValue()
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Publish build scan succeeds', async () => {
        // given
        mockExecOutput
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: 'Java 1.0'}))
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: 'Maven 1.0'}))
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: 'Build Successful'}))
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: 'Build Successful'}))
        setupGlob([
            '/home/foo/.m2/build-scan-data/1.42/previous/abcdef/scan.scan',
            '/home/foo/.m2/build-scan-data/1.42/previous/ghijkl/scan.scan'
        ])

        // when
        await mavenBuildTool.buildScanPublish()

        // then
        expect(createPublisherProjectMock).toHaveBeenCalledTimes(1)
        expect(createPluginDescriptorMock).toHaveBeenCalledTimes(2)
        expect(mockExecOutput).toHaveBeenCalledTimes(4)
    })

    it('Publish build scan throws an error when java command fails', async () => {
        // given
        mockExecOutput.mockReturnValueOnce(Promise.resolve({stderr: 'java not found', exitCode: 1, stdout: ''}))
        setupGlob([
            '/home/foo/.m2/build-scan-data/1.42/previous/abcdef/scan.scan',
            '/home/foo/.m2/build-scan-data/1.42/previous/ghijkl/scan.scan'
        ])

        // when / then
        await expect(async () => mavenBuildTool.buildScanPublish()).rejects.toThrow(Error)
    })

    it('Publish build scan throws an error when maven version command fails', async () => {
        // given
        mockExecOutput
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: 'Java 1.0'}))
            .mockReturnValueOnce(Promise.resolve({stderr: 'mvn not found', exitCode: 1, stdout: ''}))
        setupGlob([
            '/home/foo/.m2/build-scan-data/1.42/previous/abcdef/scan.scan',
            '/home/foo/.m2/build-scan-data/1.42/previous/ghijkl/scan.scan'
        ])

        // when / then
        await expect(async () => mavenBuildTool.buildScanPublish()).rejects.toThrow(Error)
    })

    it('Publish build scan succeeds when maven publish command fails', async () => {
        // given
        mockExecOutput
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: 'Java 1.0'}))
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: 'Maven 1.0'}))
            .mockReturnValueOnce(Promise.resolve({stderr: 'mvn publication failed', exitCode: 1, stdout: ''}))
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: 'Build Scan published'}))
        setupGlob([
            '/home/foo/.m2/build-scan-data/1.42/previous/abcdef/scan.scan',
            '/home/foo/.m2/build-scan-data/1.42/previous/ghijkl/scan.scan'
        ])

        // when / then
        await mavenBuildTool.buildScanPublish()

        // then
        expect(createPublisherProjectMock).toHaveBeenCalledTimes(1)
        expect(createPluginDescriptorMock).toHaveBeenCalledTimes(2)
        expect(mockExecOutput).toHaveBeenCalledTimes(4)
    })
})
