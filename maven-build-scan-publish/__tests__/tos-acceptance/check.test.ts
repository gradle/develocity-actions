import * as github from '@actions/github'
import {OctokitResponse} from '@octokit/types'

import {isAccepted} from '../../src/tos-acceptance/check'
import * as check from '../../src/tos-acceptance/check'
import * as githubInternal from '../../src/shared/github'
import * as persistence from '../../src/tos-acceptance/persistence'
import * as params from '../../src/shared/params'

const runMock = jest.spyOn(check, 'isAccepted')

const CONTRIBUTORS_EMPTY: persistence.Contributors = {
    sha: '42',
    list: []
}
const CONTRIBUTORS_POPULATED: persistence.Contributors = {
    sha: '42',
    list: [{id: 42, name: 'foo', pullRequestNo: 42, created_at: ''}]
}

function contextWithoutComment() {
    Object.defineProperty(github, 'context', {
        value: {
            eventName: 'workflow_run',
            repo: {
                owner: 'foo',
                repo: 'bar'
            }
        }
    })
}

function contextWithTosAcceptanceComment() {
    Object.defineProperty(github, 'context', {
        value: {
            eventName: 'issue_comment',
            payload: {
                comment: {
                    body: 'recheck'
                }
            },
            repo: {
                owner: 'foo',
                repo: 'bar'
            }
        }
    })
}

function contextWithRandomComment() {
    Object.defineProperty(github, 'context', {
        value: {
            eventName: 'issue_comment',
            payload: {
                comment: {
                    body: 'random'
                }
            },
            repo: {
                owner: 'foo',
                repo: 'bar'
            }
        }
    })
}

describe('check', () => {
    let addUserMock: any
    let createCommentMock: any
    let updateCommentMock: any

    beforeEach(() => {
        // @ts-ignore
        addUserMock = jest.spyOn(persistence, 'add').mockReturnValue(Promise.resolve())

        const octokit = github.getOctokit('fake-token')
        jest.spyOn(githubInternal, 'getOctokit').mockReturnValue(octokit)
        createCommentMock = jest
            .spyOn(octokit.rest.issues, 'createComment')
            .mockImplementation(() => Promise.resolve({} as any))
        jest.spyOn(octokit.rest.issues, 'getComment').mockImplementation(() =>
            Promise.resolve({data: {user: {id: 42, login: 'foo'}}} as OctokitResponse<any, 200>)
        )
        updateCommentMock = jest
            .spyOn(octokit.rest.issues, 'updateComment')
            .mockImplementation(() => Promise.resolve({} as any))

        jest.spyOn(octokit.rest.pulls, 'get').mockImplementation(() =>
            Promise.resolve({data: {user: {id: 42, login: 'foo'}}} as OctokitResponse<any, 200>)
        )
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Check TOS acceptance is true when triggered by acceptance comment and user having already accepted the TOS', async () => {
        // given
        contextWithTosAcceptanceComment()
        jest.spyOn(persistence, 'load').mockReturnValueOnce(Promise.resolve(CONTRIBUTORS_POPULATED))

        // when
        const isAccepted = await check.isAccepted(42)

        // then
        expect(runMock).toHaveReturned()
        expect(addUserMock).not.toBeCalled()
        expect(createCommentMock).not.toBeCalled()
        expect(updateCommentMock).not.toBeCalled()
        expect(isAccepted).toBeTruthy()
    })

    it('Check TOS acceptance is true and record new user when triggered by acceptance comment and user not having already accepted the TOS', async () => {
        // given
        contextWithTosAcceptanceComment()
        jest.spyOn(persistence, 'load')
            .mockReturnValueOnce(Promise.resolve(CONTRIBUTORS_EMPTY))
            .mockReturnValueOnce(Promise.resolve(CONTRIBUTORS_POPULATED))

        // when
        const isAccepted = await check.isAccepted(42)

        // then
        expect(runMock).toHaveReturned()
        expect(addUserMock).toBeCalled()
        expect(updateCommentMock).toBeCalled()
        expect(isAccepted).toBeTruthy()
    })

    it('Check TOS acceptance is false when triggered by a random comment', async () => {
        // given
        contextWithRandomComment()
        jest.spyOn(persistence, 'load').mockReturnValueOnce(Promise.resolve(CONTRIBUTORS_EMPTY))

        // when
        const isAccepted = await check.isAccepted(42)

        // then
        expect(runMock).toHaveReturned()
        expect(addUserMock).not.toBeCalled()
        expect(createCommentMock).toBeCalled()
        expect(updateCommentMock).not.toBeCalled()
        expect(isAccepted).toBeFalsy()
    })

    it('Check TOS acceptance is true when user has already accepted the TOS', async () => {
        // given
        contextWithoutComment()
        jest.spyOn(persistence, 'load').mockReturnValueOnce(Promise.resolve(CONTRIBUTORS_POPULATED))

        // when
        const isAccepted = await check.isAccepted(42)

        // then
        expect(runMock).toHaveReturned()
        expect(addUserMock).not.toBeCalled()
        expect(updateCommentMock).not.toBeCalled()
        expect(isAccepted).toBeTruthy()
    })

    it('Check TOS acceptance succeeds when user is white listed', async () => {
        // given
        contextWithoutComment()
        jest.spyOn(persistence, 'load').mockReturnValueOnce(Promise.resolve(CONTRIBUTORS_EMPTY))
        jest.spyOn(params, 'getWhiteList').mockReturnValue('bar,foo,baz')

        // when
        const isAccepted = await check.isAccepted(42)

        // then
        expect(runMock).toHaveReturned()
        expect(addUserMock).not.toBeCalled()
        expect(updateCommentMock).not.toBeCalled()
        expect(isAccepted).toBeTruthy()
    })
})
