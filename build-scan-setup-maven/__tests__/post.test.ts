import * as artifact from '@actions/artifact'
import * as glob from '@actions/glob'
import * as github from '@actions/github'

process.env['RUNNER_TEMP'] = '/tmp'

import * as post from '../src/post'

const runMock = jest.spyOn(post, 'run')

jest.mock('@actions/artifact')

describe('Post Setup Maven', () => {
    beforeEach(() => {
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
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Post-execution with build scan succeeds', async () => {
        // Given
        jest.spyOn(glob, 'create').mockReturnValue(
            Promise.resolve({
                // @ts-ignore
                glob() {
                    return ['foo.scan']
                }
            })
        )
        jest
            .spyOn(artifact, 'DefaultArtifactClient')
            .mockImplementation()
        const uploadArtifactMock = jest
            .spyOn(artifact.DefaultArtifactClient.prototype, 'uploadArtifact')
            .mockImplementation()


        // when
        await post.run()

        // then
        expect(runMock).toHaveReturned()
        expect(uploadArtifactMock).toHaveBeenCalled()
    })

    it('Post-execution without build scan does not upload artifact', async () => {
        // Given
        jest.spyOn(glob, 'create').mockReturnValue(
            Promise.resolve({
                // @ts-ignore
                glob() {
                    return []
                }
            })
        )
        jest
            .spyOn(artifact, 'DefaultArtifactClient')
            .mockImplementation()
        const uploadArtifactMock = jest
            .spyOn(artifact.DefaultArtifactClient.prototype, 'uploadArtifact')
            .mockImplementation()

        // when
        await post.run()

        // then
        expect(runMock).toHaveReturned()
        expect(uploadArtifactMock).not.toHaveBeenCalled()
    })
})
