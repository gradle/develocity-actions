import {Job} from '../../src/metadata/load'

process.env['RUNNER_TEMP'] = '/tmp'

import * as githubUtils from '../../src/utils/github'
import * as input from '../../src/setup/input'
import * as io from '../../src/utils/io'
import * as load from '../../src/metadata/load'
import * as output from '../../src/summary/dump'
import {BuildToolType} from '../../src/buildTool/common'

const outputMock = jest.spyOn(output, 'dump')

const job = {
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
    buildToolType: BuildToolType.MAVEN
}

describe('dump', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Dump triggers pull request comment and summary', async () => {
        // Given
        jest.spyOn(load, 'loadJobMetadata').mockResolvedValue(job)
        jest.spyOn(input, 'isSkipPrComment').mockReturnValue(false)
        jest.spyOn(input, 'isSkipJobSummary').mockReturnValue(false)
        const githubCommentMock = jest
            .spyOn(githubUtils, 'commentPullRequest')
            .mockReturnValue(Promise.resolve(undefined))
        const githubSummaryMock = jest.spyOn(githubUtils, 'addSummary').mockReturnValue(Promise.resolve(undefined))
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump(BuildToolType.MAVEN, '', '')

        // then
        expect(outputMock).toHaveReturned()
        expect(ioWriteMock).toHaveBeenCalled()
        expect(githubCommentMock).toHaveBeenCalled()
        expect(githubSummaryMock).toHaveBeenCalled()
    })

    it('Dump with skip-pr-comment dumps output to file', async () => {
        // Given
        jest.spyOn(load, 'loadJobMetadata').mockResolvedValue(job)
        jest.spyOn(input, 'isSkipPrComment').mockReturnValue(true)
        jest.spyOn(input, 'isSkipJobSummary').mockReturnValue(false)
        const githubCommentMock = jest
            .spyOn(githubUtils, 'commentPullRequest')
            .mockReturnValue(Promise.resolve(undefined))
        const githubSummaryMock = jest.spyOn(githubUtils, 'addSummary').mockReturnValue(Promise.resolve(undefined))
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump(BuildToolType.MAVEN, '', '')

        // then
        expect(outputMock).toHaveReturned()
        expect(ioWriteMock).toHaveBeenCalled()
        expect(githubCommentMock).not.toHaveBeenCalled()
        expect(githubSummaryMock).toHaveBeenCalled()
    })

    it('Dump with skip-job-summary does not add summary', async () => {
        // Given
        jest.spyOn(load, 'loadJobMetadata').mockResolvedValue(job)
        jest.spyOn(input, 'isSkipPrComment').mockReturnValue(true)
        jest.spyOn(input, 'isSkipJobSummary').mockReturnValue(true)
        const githubCommentMock = jest
            .spyOn(githubUtils, 'commentPullRequest')
            .mockReturnValue(Promise.resolve(undefined))
        const githubSummaryMock = jest.spyOn(githubUtils, 'addSummary').mockReturnValue(Promise.resolve(undefined))
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump(BuildToolType.MAVEN, '', '')

        // then
        expect(outputMock).toHaveReturned()
        expect(ioWriteMock).toHaveBeenCalled()
        expect(githubCommentMock).not.toHaveBeenCalled()
        expect(githubSummaryMock).not.toHaveBeenCalled()
    })

    it('Dump without build scan does nothing', async () => {
        // Given
        jest.spyOn(load, 'loadJobMetadata').mockResolvedValue(<Job>{})
        jest.spyOn(input, 'isSkipPrComment').mockReturnValue(true)
        jest.spyOn(input, 'isSkipJobSummary').mockReturnValue(true)
        const githubCommentMock = jest
            .spyOn(githubUtils, 'commentPullRequest')
            .mockReturnValue(Promise.resolve(undefined))
        const githubSummaryMock = jest.spyOn(githubUtils, 'addSummary').mockReturnValue(Promise.resolve(undefined))
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump(BuildToolType.MAVEN, '', '')

        // then
        expect(outputMock).toHaveReturned()
        expect(ioWriteMock).not.toHaveBeenCalled()
        expect(githubCommentMock).not.toHaveBeenCalled()
        expect(githubSummaryMock).not.toHaveBeenCalled()
    })

    it('Dump with skip-pr-comment and without build scan does nothing', async () => {
        // Given
        jest.spyOn(load, 'loadJobMetadata').mockResolvedValue(<Job>{})
        jest.spyOn(input, 'isSkipPrComment').mockReturnValue(false)
        jest.spyOn(input, 'isSkipJobSummary').mockReturnValue(true)
        const githubCommentMock = jest
            .spyOn(githubUtils, 'commentPullRequest')
            .mockReturnValue(Promise.resolve(undefined))
        const githubSummaryMock = jest.spyOn(githubUtils, 'addSummary').mockReturnValue(Promise.resolve(undefined))
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump(BuildToolType.MAVEN, '', '')

        // then
        expect(outputMock).toHaveReturned()
        expect(ioWriteMock).not.toHaveBeenCalled()
        expect(githubCommentMock).not.toHaveBeenCalled()
        expect(githubSummaryMock).not.toHaveBeenCalled()
    })
})
