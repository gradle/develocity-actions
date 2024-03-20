import * as maven from '../../src/buildTool/maven'

process.env['RUNNER_TEMP'] = '/tmp'

import * as commonBuildTool from '../../src/buildTool/common'
import * as githubUtils from '../../src/utils/github'
import * as main from '../../src/publish/main'

const buildTool = maven.mavenBuildTool
const mockedArtifactIds = [42]

describe('main', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Publish build scan succeeds', async () => {
        // Given
        jest.spyOn(githubUtils, 'isPublicationAllowed').mockReturnValue(true)
        jest.spyOn(githubUtils, 'downloadBuildScanData').mockReturnValue(Promise.resolve(mockedArtifactIds))
        jest.spyOn(githubUtils, 'logOriginWorkflowLink').mockReturnValue()
        const deleteMock = jest.spyOn(githubUtils, 'deleteWorkflowArtifacts').mockResolvedValue()
        const buildScanPublishMock = jest
            .spyOn(commonBuildTool.BuildTool.prototype, 'buildScanPublish')
            .mockResolvedValue()

        // when
        await main.publish(buildTool)

        // then
        expect(buildScanPublishMock).toHaveBeenCalled()
        expect(deleteMock).toHaveBeenCalled()
    })

    it('Publish on non workflow_run event does nothing', async () => {
        // Given
        jest.spyOn(githubUtils, 'isPublicationAllowed').mockReturnValue(false)
        jest.spyOn(githubUtils, 'downloadBuildScanData').mockReturnValue(Promise.resolve(mockedArtifactIds))
        jest.spyOn(githubUtils, 'logOriginWorkflowLink').mockReturnValue()
        const deleteMock = jest.spyOn(githubUtils, 'deleteWorkflowArtifacts').mockResolvedValue()
        const buildScanPublishMock = jest
            .spyOn(commonBuildTool.BuildTool.prototype, 'buildScanPublish')
            .mockResolvedValue()

        // when
        await main.publish(buildTool)

        // then
        expect(buildScanPublishMock).not.toHaveBeenCalled()
        expect(buildScanPublishMock).not.toHaveBeenCalled()
        expect(deleteMock).not.toHaveBeenCalled()
    })
})
