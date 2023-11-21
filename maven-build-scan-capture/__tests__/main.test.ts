import * as github from '@actions/github'

import * as main from '../src/main'
import * as io from '../src/utils/io'
import * as layout from '../src/utils/layout'

const runMock = jest.spyOn(main, 'run')

function githubContext() {
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

describe('capture', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Setup build scan capture succeeds', async () => {
        // Given
        githubContext()
        const layoutSourceMock = jest
            .spyOn(layout, 'mavenBuildScanCaptureExtensionSource')
            .mockReturnValue('sourceFileName')
        const layoutTargetMock = jest
            .spyOn(layout, 'mavenBuildScanCaptureExtensionTarget')
            .mockReturnValue(Promise.resolve('targetFileName'))
        const ioMock = jest.spyOn(io, 'copyFileSync').mockReturnValue()

        // when
        await main.run()

        // then
        expect(runMock).toHaveReturned()
        expect(layoutSourceMock).toHaveBeenCalled()
        expect(layoutTargetMock).toHaveBeenCalled()
        expect(ioMock).toHaveBeenCalled()
    })

    it('Setup when Maven home is not found fails', async () => {
        // Given
        githubContext()
        const errorMsg = 'Maven home not found'
        const layoutTargetMock = jest.spyOn(layout, 'mavenBuildScanCaptureExtensionTarget').mockRejectedValue(errorMsg)
        const ioMock = jest.spyOn(io, 'copyFileSync').mockReturnValue()

        // when
        await main.run()

        // then
        expect(runMock).toHaveReturned()
        expect(layoutTargetMock).rejects.toEqual(errorMsg)
        expect(ioMock).not.toHaveBeenCalled()
    })
})
