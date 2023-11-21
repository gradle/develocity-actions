import * as output from '../../src/build-summary/dump'
import * as input from '../../src/utils/input'
import * as io from '../../src/utils/io'
import * as githubUtils from '../../src/utils/github'

const outputMock = jest.spyOn(output, 'dump')

describe('dump', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Dump triggers pull request comment', async () => {
        // Given
        jest.spyOn(input, 'isSkipComment').mockReturnValue(false)
        const githubCommentMock = jest
            .spyOn(githubUtils, 'commentPullRequest')
            .mockReturnValue(Promise.resolve(undefined))
        const ioReadMock = jest.spyOn(io, 'readFileSync').mockReturnValue('foo=https://foo.bar/s/1234')
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump({
            artifactId: 0,
            builds: [
                {jobName: 'foo', buildFailure: false, mavenGoals: 'clean package', workflowName: 'bar', buildId: 'foo'}
            ],
            prNumber: 42
        })

        // then
        expect(outputMock).toHaveReturned()
        expect(ioReadMock).toHaveBeenCalled()
        expect(githubCommentMock).toHaveBeenCalled()
        expect(ioWriteMock).not.toHaveBeenCalled()
    })

    it('Dump with skip-comment dumps output to file', async () => {
        // Given
        jest.spyOn(input, 'isSkipComment').mockReturnValue(true)
        const githubCommentMock = jest
            .spyOn(githubUtils, 'commentPullRequest')
            .mockReturnValue(Promise.resolve(undefined))
        const ioReadMock = jest.spyOn(io, 'readFileSync').mockReturnValue('foo=https://foo.bar/s/1234')
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump({
            artifactId: 0,
            builds: [
                {jobName: 'foo', buildFailure: false, mavenGoals: 'clean package', workflowName: 'bar', buildId: 'foo'}
            ],
            prNumber: 42
        })

        // then
        expect(outputMock).toHaveReturned()
        expect(ioReadMock).toHaveBeenCalled()
        expect(githubCommentMock).not.toHaveBeenCalled()
        expect(ioWriteMock).toHaveBeenCalled()
    })

    it('Dump without build scan does nothing', async () => {
        // Given
        jest.spyOn(input, 'isSkipComment').mockReturnValue(false)
        const githubCommentMock = jest
            .spyOn(githubUtils, 'commentPullRequest')
            .mockReturnValue(Promise.resolve(undefined))
        const ioReadMock = jest.spyOn(io, 'readFileSync').mockReturnValue('foo=https://foo.bar/s/1234')
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump({artifactId: 0, builds: [], prNumber: 42})

        // then
        expect(outputMock).toHaveReturned()
        expect(ioReadMock).toHaveBeenCalled()
        expect(githubCommentMock).not.toHaveBeenCalled()
        expect(ioWriteMock).not.toHaveBeenCalled()
    })

    it('Dump with skip-comment and without build scan does nothing', async () => {
        // Given
        jest.spyOn(input, 'isSkipComment').mockReturnValue(false)
        const githubCommentMock = jest
            .spyOn(githubUtils, 'commentPullRequest')
            .mockReturnValue(Promise.resolve(undefined))
        const ioReadMock = jest.spyOn(io, 'readFileSync').mockReturnValue('foo=https://foo.bar/s/1234')
        const ioWriteMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()

        // when
        await output.dump({artifactId: 0, builds: [], prNumber: 42})

        // then
        expect(outputMock).toHaveReturned()
        expect(ioReadMock).toHaveBeenCalled()
        expect(githubCommentMock).not.toHaveBeenCalled()
        expect(ioWriteMock).not.toHaveBeenCalled()
    })
})
