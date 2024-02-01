process.env['RUNNER_TEMP'] = '/tmp'

import * as githubUtils from '../../../src/publish/utils/github'
import * as input from '../../../src/publish/input'
import * as io from '../../../src/io'
import * as output from '../../../src/publish/summary/dump'
import {BuildToolType} from '../../../src/buildTool/common'


const outputMock = jest.spyOn(output, 'dump')

describe('dump', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Dump triggers pull request comment and summary', async () => {
        // Given
        jest.spyOn(input, 'isSkipPrComment').mockReturnValue(false)
        jest.spyOn(input, 'isSkipJobSummary').mockReturnValue(false)
        const githubCommentMock = jest
            .spyOn(githubUtils, 'commentPullRequest')
            .mockReturnValue(Promise.resolve(undefined))
        const githubSummaryMock = jest
            .spyOn(githubUtils, 'addSummary')
            .mockReturnValue(Promise.resolve(undefined))
        const ioExistMock = jest.spyOn(io, 'existsSync').mockReturnValue(true)
        const ioReadMock = jest.spyOn(io, 'readFileSync').mockReturnValue('foo=https://foo.bar/s/1234')
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump({
            buildToolType: BuildToolType.MAVEN,
            artifactIds: [0],
            builds: [
                {jobName: 'foo', buildFailure: false, projectId: 'foo', requestedTasks: 'clean package', workflowName: 'bar', buildId: 'foo', buildToolVersion:'3.9'}
            ],
            prNumber: 42
        }, '')

        // then
        expect(outputMock).toHaveReturned()
        expect(ioExistMock).toHaveBeenCalled()
        expect(ioReadMock).toHaveBeenCalled()
        expect(githubCommentMock).toHaveBeenCalled()
        expect(githubSummaryMock).toHaveBeenCalled()
        expect(ioWriteMock).not.toHaveBeenCalled()
    })

    it('Dump with skip-pr-comment dumps output to file', async () => {
        // Given
        jest.spyOn(input, 'isSkipPrComment').mockReturnValue(true)
        jest.spyOn(input, 'isSkipJobSummary').mockReturnValue(false)
        const githubCommentMock = jest
            .spyOn(githubUtils, 'commentPullRequest')
            .mockReturnValue(Promise.resolve(undefined))
        const githubSummaryMock = jest
            .spyOn(githubUtils, 'addSummary')
            .mockReturnValue(Promise.resolve(undefined))
        const ioExistMock = jest.spyOn(io, 'existsSync').mockReturnValue(true)
        const ioReadMock = jest.spyOn(io, 'readFileSync').mockReturnValue('foo=https://foo.bar/s/1234')
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump({
            buildToolType: BuildToolType.MAVEN,
            artifactIds: [0],
            builds: [
                {jobName: 'foo', buildFailure: false, projectId: 'foo', requestedTasks: 'clean package', workflowName: 'bar', buildId: 'foo', buildToolVersion:'3.9'}
            ],
            prNumber: 42
        }, '')

        // then
        expect(outputMock).toHaveReturned()
        expect(ioExistMock).toHaveBeenCalled()
        expect(ioReadMock).toHaveBeenCalled()
        expect(githubCommentMock).not.toHaveBeenCalled()
        expect(ioWriteMock).toHaveBeenCalled()
    })

    it('Dump with skip-job-summary does not add summary', async () => {
        // Given
        jest.spyOn(input, 'isSkipPrComment').mockReturnValue(true)
        jest.spyOn(input, 'isSkipJobSummary').mockReturnValue(true)
        const githubSummaryMock = jest
            .spyOn(githubUtils, 'addSummary')
            .mockReturnValue(Promise.resolve(undefined))
        const ioExistMock = jest.spyOn(io, 'existsSync').mockReturnValue(true)
        const ioReadMock = jest.spyOn(io, 'readFileSync').mockReturnValue('foo=https://foo.bar/s/1234')
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump({
            buildToolType: BuildToolType.MAVEN,
            artifactIds: [0],
            builds: [
                {jobName: 'foo', buildFailure: false, projectId: 'foo', requestedTasks: 'clean package', workflowName: 'bar', buildId: 'foo', buildToolVersion:'3.9'}
            ],
            prNumber: 42
        }, '')

        // then
        expect(outputMock).toHaveReturned()
        expect(ioExistMock).toHaveBeenCalled()
        expect(ioReadMock).toHaveBeenCalled()
        expect(githubSummaryMock).not.toHaveBeenCalled()
        expect(ioWriteMock).toHaveBeenCalled()
    })

    it('Dump without build scan does nothing', async () => {
        // Given
        jest.spyOn(input, 'isSkipPrComment').mockReturnValue(false)
        const githubCommentMock = jest
            .spyOn(githubUtils, 'commentPullRequest')
            .mockReturnValue(Promise.resolve(undefined))
        const githubSummaryMock = jest
            .spyOn(githubUtils, 'addSummary')
            .mockReturnValue(Promise.resolve(undefined))
        const ioExistMock = jest.spyOn(io, 'existsSync').mockReturnValue(true)
        const ioReadMock = jest.spyOn(io, 'readFileSync').mockReturnValue('foo=https://foo.bar/s/1234')
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump({buildToolType: BuildToolType.MAVEN, artifactIds: [], builds: [], prNumber: 42}, '')

        // then
        expect(outputMock).toHaveReturned()
        expect(ioExistMock).toHaveBeenCalled()
        expect(ioReadMock).toHaveBeenCalled()
        expect(githubCommentMock).not.toHaveBeenCalled()
        expect(githubSummaryMock).not.toHaveBeenCalled()
        expect(ioWriteMock).not.toHaveBeenCalled()
    })

    it('Dump with skip-pr-comment and without build scan does nothing', async () => {
        // Given
        jest.spyOn(input, 'isSkipPrComment').mockReturnValue(false)
        const githubCommentMock = jest
            .spyOn(githubUtils, 'commentPullRequest')
            .mockReturnValue(Promise.resolve(undefined))
        const githubSummaryMock = jest
            .spyOn(githubUtils, 'addSummary')
            .mockReturnValue(Promise.resolve(undefined))
        const ioExistMock = jest.spyOn(io, 'existsSync').mockReturnValue(true)
        const ioReadMock = jest.spyOn(io, 'readFileSync').mockReturnValue('foo=https://foo.bar/s/1234')
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump({buildToolType: BuildToolType.MAVEN, artifactIds: [], builds: [], prNumber: 42}, '')

        // then
        expect(outputMock).toHaveReturned()
        expect(ioExistMock).toHaveBeenCalled()
        expect(ioReadMock).toHaveBeenCalled()
        expect(githubCommentMock).not.toHaveBeenCalled()
        expect(githubSummaryMock).not.toHaveBeenCalled()
        expect(ioWriteMock).not.toHaveBeenCalled()
    })
})
