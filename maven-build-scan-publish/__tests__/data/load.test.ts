import * as glob from '@actions/glob'
import * as github from '@actions/github'

import * as load from '../../src/data/load'
import * as githubInternal from '../../src/shared/github'
import * as io from '../../src/shared/io'

const runMock = jest.spyOn(load, 'loadBuildScanData')

const mockedArtifactId = 42
const mockedPrNumber = 4242

function contextWithWorkflowRunEvent() {
    Object.defineProperty(github, 'context', {
        value: {
            repo: {
                owner: 'foo',
                repo: 'bar'
            },
            payload: {
                workflow_run: {
                    id: 42
                }
            }
        }
    })
}

function contextWithIssueCommentEvent() {
    Object.defineProperty(github, 'context', {
        value: {
            repo: {
                owner: 'foo',
                repo: 'bar'
            },
            issue: {
                number: 42
            }
        }
    })
}

describe('load', () => {
    let octokit: any

    beforeEach(() => {
        jest.spyOn(io, 'existsSync').mockReturnValue(true)
        jest.spyOn(io, 'extractZip').mockImplementation(() => Promise.resolve('extracted'))
        jest.spyOn(io, 'readdirSync').mockImplementation(() => ['foo'])
        jest.spyOn(io, 'writeFileSync').mockReturnValue()
        jest.spyOn(io, 'readFileSync').mockImplementation(() => `PR_NUMBER=${mockedPrNumber}`)

        // @ts-ignore
        jest.spyOn(glob, 'create').mockReturnValue(
            Promise.resolve({
                // @ts-ignore
                glob() {
                    return ['prNumberFilePath']
                }
            })
        )

        octokit = github.getOctokit('fake-token')
        jest.spyOn(githubInternal, 'getOctokit').mockReturnValue(octokit)
        // @ts-ignore
        jest.spyOn(octokit.rest.actions, 'listWorkflowRuns').mockImplementation(() =>
            Promise.resolve({data: [{id: 42}]})
        )
        // @ts-ignore
        jest.spyOn(octokit.rest.actions, 'listWorkflowRunArtifacts').mockImplementation(() =>
            Promise.resolve({data: {artifacts: [{id: mockedArtifactId, name: 'maven-build-scan-data'}]}})
        )
        // @ts-ignore
        jest.spyOn(octokit.rest.actions, 'downloadArtifact').mockImplementation(() =>
            Promise.resolve({data: Buffer.from('foo')})
        )
        // @ts-ignore
        jest.spyOn(octokit.rest.pulls, 'get').mockImplementation(() => Promise.resolve({data: {head: {sha: 42}}}))
        // @ts-ignore
        octokit.paginate.iterator = async function* (listFunction, args) {
            yield listFunction(args)
        }
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Load build scan metadata succeeds on workflow run event', async () => {
        // given
        contextWithWorkflowRunEvent()
        jest.spyOn(githubInternal, 'isEventWorkflowRun').mockReturnValue(true)

        // when
        const {prNumber, artifactId} = await load.loadBuildScanData()

        // then
        expect(runMock).toHaveReturned()
        expect(artifactId).toBe(mockedArtifactId)
        expect(prNumber).toBe(mockedPrNumber)
    })

    it('load build scan metadata succeeds on issue comment event', async () => {
        // given
        contextWithIssueCommentEvent()
        jest.spyOn(githubInternal, 'isEventWorkflowRun').mockReturnValue(false)

        // when
        const {prNumber, artifactId} = await load.loadBuildScanData()

        // then
        expect(runMock).toHaveReturned()
        expect(artifactId).toBe(mockedArtifactId)
        expect(prNumber).toBe(mockedPrNumber)
    })

    it('Load build scan metadata does nothing when build scan artifact is not found', async () => {
        // given
        contextWithWorkflowRunEvent()
        // @ts-ignore
        jest.spyOn(octokit.rest.actions, 'listWorkflowRunArtifacts').mockImplementation(() =>
            Promise.resolve({data: {artifacts: []}})
        )
        jest.spyOn(githubInternal, 'isEventWorkflowRun').mockReturnValue(true)

        // when
        const {prNumber, artifactId} = await load.loadBuildScanData()

        // then
        expect(runMock).toHaveReturned()
        expect(artifactId).toBeUndefined()
        expect(prNumber).toBeUndefined()
    })

    it('Load build scan metadata fails when file containing pull-request number is not found', async () => {
        // given
        contextWithWorkflowRunEvent()
        jest.spyOn(githubInternal, 'isEventWorkflowRun').mockReturnValue(true)
        // @ts-ignore
        jest.spyOn(glob, 'create').mockReturnValue(
            Promise.resolve({
                // @ts-ignore
                glob() {
                    return []
                }
            })
        )

        // when / then
        expect(async () => await load.loadBuildScanData()).rejects.toThrow(Error)
    })
})
