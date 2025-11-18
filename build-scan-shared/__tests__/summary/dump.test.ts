import {Job} from '../../src/metadata/load'

process.env['RUNNER_TEMP'] = '/tmp'

import * as githubUtils from '../../src/utils/github'
import * as input from '../../src/setup/input'
import * as io from '../../src/utils/io'
import * as load from '../../src/metadata/load'
import * as output from '../../src/summary/dump'
import {BuildToolType} from '../../src/buildTool/common'

const outputMock = jest.spyOn(output, 'dump')

function job(buildTool: BuildToolType) {
    return {
        prNumber: 42,
        builds: [
            {
                projectId: 'projectId',
                workflowName: 'workflow',
                jobName: 'job',
                buildToolVersion: '42',
                requestedTasks: 'install',
                buildId: 'abcde',
                buildFailure: false,
                buildTimestamp: '0',
                isRepublished: false
            }
        ],
        buildToolType: buildTool
    }
}

describe('dump', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it.each([BuildToolType.MAVEN, BuildToolType.NPM])(
        'Dump triggers pull request comment and summary with %s',
        async buildTool => {
            // Given
            jest.spyOn(load, 'loadJobMetadata').mockResolvedValue(job(buildTool))
            jest.spyOn(input, 'isAddPrComment').mockReturnValue(true)
            jest.spyOn(input, 'isAddJobSummary').mockReturnValue(true)
            const githubCommentMock = jest
                .spyOn(githubUtils, 'commentPullRequest')
                .mockReturnValue(Promise.resolve(undefined))
            const githubSummaryMock = jest.spyOn(githubUtils, 'addSummary').mockReturnValue(Promise.resolve(undefined))
            const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()
            jest.spyOn(io, 'existsSync').mockReturnValue(true)

            // when
            await output.dump(buildTool, '', '')

            // then
            expect(outputMock).toHaveReturned()
            expect(ioWriteMock).toHaveBeenCalled()
            expect(githubCommentMock).toHaveBeenCalled()
            expect(githubSummaryMock).toHaveBeenCalled()
        }
    )

    it.each([BuildToolType.MAVEN, BuildToolType.NPM])(
        'Dump with add-pr-comment=false dumps output to file with %s',
        async buildTool => {
            // Given
            jest.spyOn(load, 'loadJobMetadata').mockResolvedValue(job(buildTool))
            jest.spyOn(input, 'isAddPrComment').mockReturnValue(false)
            jest.spyOn(input, 'isAddJobSummary').mockReturnValue(true)
            const githubCommentMock = jest
                .spyOn(githubUtils, 'commentPullRequest')
                .mockReturnValue(Promise.resolve(undefined))
            const githubSummaryMock = jest.spyOn(githubUtils, 'addSummary').mockReturnValue(Promise.resolve(undefined))
            const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()
            jest.spyOn(io, 'existsSync').mockReturnValue(true)

            // when
            await output.dump(buildTool, '', '')

            // then
            expect(outputMock).toHaveReturned()
            expect(ioWriteMock).toHaveBeenCalled()
            expect(githubCommentMock).not.toHaveBeenCalled()
            expect(githubSummaryMock).toHaveBeenCalled()
        }
    )

    it.each([BuildToolType.MAVEN, BuildToolType.NPM])(
        'Dump with add-job-summary=false does not add summary with %s',
        async buildTool => {
            // Given
            jest.spyOn(load, 'loadJobMetadata').mockResolvedValue(job(buildTool))
            jest.spyOn(input, 'isAddPrComment').mockReturnValue(false)
            jest.spyOn(input, 'isAddJobSummary').mockReturnValue(false)
            const githubCommentMock = jest
                .spyOn(githubUtils, 'commentPullRequest')
                .mockReturnValue(Promise.resolve(undefined))
            const githubSummaryMock = jest.spyOn(githubUtils, 'addSummary').mockReturnValue(Promise.resolve(undefined))
            const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()
            jest.spyOn(io, 'existsSync').mockReturnValue(true)

            // when
            await output.dump(buildTool, '', '')

            // then
            expect(outputMock).toHaveReturned()
            expect(ioWriteMock).toHaveBeenCalled()
            expect(githubCommentMock).not.toHaveBeenCalled()
            expect(githubSummaryMock).not.toHaveBeenCalled()
        }
    )

    it.each([BuildToolType.MAVEN, BuildToolType.NPM])(
        'Dump without build scan does nothing with %s',
        async buildTool => {
            // Given
            jest.spyOn(load, 'loadJobMetadata').mockResolvedValue(<Job>{})
            jest.spyOn(input, 'isAddPrComment').mockReturnValue(false)
            jest.spyOn(input, 'isAddJobSummary').mockReturnValue(false)
            const githubCommentMock = jest
                .spyOn(githubUtils, 'commentPullRequest')
                .mockReturnValue(Promise.resolve(undefined))
            const githubSummaryMock = jest.spyOn(githubUtils, 'addSummary').mockReturnValue(Promise.resolve(undefined))
            const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

            // when
            await output.dump(buildTool, '', '')

            // then
            expect(outputMock).toHaveReturned()
            expect(ioWriteMock).not.toHaveBeenCalled()
            expect(githubCommentMock).not.toHaveBeenCalled()
            expect(githubSummaryMock).not.toHaveBeenCalled()
        }
    )

    it.each([BuildToolType.MAVEN, BuildToolType.NPM])(
        'Dump with add-pr-comment=true and without build scan does nothing with %s',
        async buildTool => {
            // Given
            jest.spyOn(load, 'loadJobMetadata').mockResolvedValue(<Job>{})
            jest.spyOn(input, 'isAddPrComment').mockReturnValue(true)
            jest.spyOn(input, 'isAddJobSummary').mockReturnValue(false)
            const githubCommentMock = jest
                .spyOn(githubUtils, 'commentPullRequest')
                .mockReturnValue(Promise.resolve(undefined))
            const githubSummaryMock = jest.spyOn(githubUtils, 'addSummary').mockReturnValue(Promise.resolve(undefined))
            const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

            // when
            await output.dump(buildTool, '', '')

            // then
            expect(outputMock).toHaveReturned()
            expect(ioWriteMock).not.toHaveBeenCalled()
            expect(githubCommentMock).not.toHaveBeenCalled()
            expect(githubSummaryMock).not.toHaveBeenCalled()
        }
    )
})
