import * as github from '@actions/github'

import * as comment from '../../src/pull-request/comment'
import * as githubInternal from '../../src/shared/github'

const runMock = jest.spyOn(comment, 'commentPullRequestWithBuildScanLinks')

describe('comment', () => {
    let createCommentMock: any

    beforeEach(() => {
        Object.defineProperty(github, 'context', {
            value: {
                repo: {
                    owner: 'foo',
                    repo: 'bar'
                }
            }
        })

        const octokit = github.getOctokit('fake-token')
        jest.spyOn(githubInternal, 'getOctokit').mockReturnValue(octokit)
        createCommentMock = jest
            .spyOn(octokit.rest.issues, 'createComment')
            .mockImplementation(() => Promise.resolve({} as any))
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Comment with links succeeds', async () => {
        // when
        await comment.commentPullRequestWithBuildScanLinks(42, ['https://foo.bar'])

        // then
        expect(runMock).toHaveReturned()
        expect(createCommentMock).toHaveBeenCalled()
    })

    it('Comment without links does nothing', async () => {
        // when
        await comment.commentPullRequestWithBuildScanLinks(42, [])

        // then
        expect(runMock).toHaveReturned()
        expect(createCommentMock).not.toHaveBeenCalled()
    })
})
