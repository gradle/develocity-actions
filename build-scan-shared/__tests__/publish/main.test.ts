import {jest} from '@jest/globals'

process.env['RUNNER_TEMP'] = '/tmp'
const mockedArtifactIds = [42]
const mockIsPublicationAllowed = jest.fn()
const mockDownloadBuildScanData = jest.fn()
const mockLogOriginWorkflowLink = jest.fn()
const mockDeleteWorkflowArtifacts = jest.fn()

jest.unstable_mockModule('../../src/utils/github', () => ({
    isPublicationAllowed: mockIsPublicationAllowed,
    downloadBuildScanData: mockDownloadBuildScanData,
    logOriginWorkflowLink: mockLogOriginWorkflowLink,
    deleteWorkflowArtifacts: mockDeleteWorkflowArtifacts
}))

const mockDump = jest.fn()

jest.unstable_mockModule('../../src/summary/dump', () => ({
    dump: mockDump
}))

const {publish} = await import('../../src/publish/main')
import * as commonBuildTool from '../../src/buildTool/common'
import * as maven from '../../src/buildTool/maven'
const buildTool = maven.mavenBuildTool

const buildScanPublishMock = jest
    .spyOn(commonBuildTool.PostPublishingBuildTool.prototype, 'buildScanPublish')
    .mockResolvedValue()

describe('main', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Publish build scan succeeds', async () => {
        // Given
        mockIsPublicationAllowed.mockReturnValue(true)
        mockDownloadBuildScanData.mockReturnValue(Promise.resolve(mockedArtifactIds))

        // when
        await publish(buildTool)

        // then
        expect(buildScanPublishMock).toHaveBeenCalled()
        expect(mockDeleteWorkflowArtifacts).toHaveBeenCalled()
        expect(mockDump).toHaveBeenCalled()
    })

    it('Publish on non workflow_run event does nothing', async () => {
        // Given
        mockIsPublicationAllowed.mockReturnValue(false)
        mockDownloadBuildScanData.mockReturnValue(Promise.resolve(mockedArtifactIds))

        // when
        await publish(buildTool)

        // then
        expect(buildScanPublishMock).not.toHaveBeenCalled()
        expect(mockDeleteWorkflowArtifacts).not.toHaveBeenCalled()
        expect(mockDump).not.toHaveBeenCalled()
    })
})
