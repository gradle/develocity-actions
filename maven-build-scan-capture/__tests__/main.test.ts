import * as github from '@actions/github'
import * as glob from '@actions/glob'
import * as artifact from '@actions/artifact'

import * as main from '../src/main'
import * as io from '../src/io'

const runMock = jest.spyOn(main, 'run')

describe('save', () => {
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

    it('Save build scan succeeds', async () => {
        // given
        jest.spyOn(glob, 'create').mockReturnValue(
            Promise.resolve({
                // @ts-ignore
                glob() {
                    return ['foo/scan.scan', 'bar/scan.scan']
                }
            })
        )
        jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()
        const uploadArtifactMock = jest.fn()
        const mockArtifactClient: Partial<artifact.ArtifactClient> = {
            uploadArtifact: uploadArtifactMock
        }
        jest.spyOn(artifact, 'create').mockReturnValue(mockArtifactClient as artifact.ArtifactClient)

        // when
        await main.run()

        // then
        expect(runMock).toHaveReturned()
        expect(uploadArtifactMock).toHaveBeenCalled()
    })

    it('Save build scan does nothing without build scan', async () => {
        // given
        jest.spyOn(glob, 'create').mockReturnValue(
            Promise.resolve({
                // @ts-ignore
                glob() {
                    return ['foo/foo', 'bar/bar']
                }
            })
        )
        const uploadArtifactMock = jest.fn()
        const mockArtifactClient: Partial<artifact.ArtifactClient> = {
            uploadArtifact: uploadArtifactMock
        }
        jest.spyOn(artifact, 'create').mockReturnValue(mockArtifactClient as artifact.ArtifactClient)

        // when
        await main.run()

        // then
        expect(runMock).toHaveReturned()
        expect(uploadArtifactMock).not.toHaveBeenCalled()
    })
})
