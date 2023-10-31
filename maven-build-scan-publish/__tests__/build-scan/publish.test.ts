import * as glob from '@actions/glob'
import * as exec from '@actions/exec'

import * as publish from '../../src/build-scan/publish'
import * as io from '../../src/shared/io'
import {getExecOutput} from '@actions/exec'

const runMock = jest.spyOn(publish, 'publishBuildScan')

describe('publish', () => {
    let createFileMock: any
    let execMock: any

    beforeEach(() => {
        jest.spyOn(io, 'existsSync').mockReturnValue(true)
        createFileMock = jest.spyOn(io, 'writeContentToFileSync').mockReturnValue()
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Publish build scan succeeds', async () => {
        // given
        const buildScanLink = 'https://foo.com/s/bxeblusov5lac'

        const output = `
        [INFO] ------------------------------------------------------------------------
        [INFO] BUILD SUCCESS
        [INFO] ------------------------------------------------------------------------
        [INFO] Total time:  02:53 min
        [INFO] Finished at: 2023-10-29T09:20:13Z
        [INFO] ------------------------------------------------------------------------
        [INFO] 4530 goals, 4145 executed, 385 from cache, saving at least 3m 48s
        [INFO] 
        [INFO] Publishing build scan...
        [INFO] ${buildScanLink}
        [INFO]         
        `.replace(/  +/g, '')

        execMock = jest
            .spyOn(exec, 'getExecOutput')
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: 'Java 1.0'}))
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: 'Maven 1.0'}))
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: output}))
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: output}))

        jest.spyOn(glob, 'create').mockReturnValue(
            Promise.resolve({
                // @ts-ignore
                glob() {
                    return [
                        '/home/foo/.m2/build-scan-data/1.42/previous/abcdef/scan.scan',
                        '/home/foo/.m2/build-scan-data/1.42/previous/ghijkl/scan.scan'
                    ]
                }
            })
        )

        // when
        const buildScanLinks = await publish.publishBuildScan()

        // then
        expect(runMock).toHaveReturned()
        expect(createFileMock).toHaveBeenCalledTimes(4)
        expect(execMock).toHaveBeenCalledTimes(4)
        expect(buildScanLinks).toHaveLength(2)
        expect(buildScanLinks).toContain(buildScanLink)
    })

    it('Publish build scan does nothing when java command fails', async () => {
        // given
        execMock = jest
            .spyOn(exec, 'getExecOutput')
            .mockReturnValueOnce(Promise.resolve({stderr: 'java not found', exitCode: 1, stdout: ''}))

        // when / then
        expect(async () => await publish.publishBuildScan()).rejects.toThrow(Error)
    })

    it('Publish build scan does nothing when maven version command fails', async () => {
        // given
        execMock = jest
            .spyOn(exec, 'getExecOutput')
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: 'Java 1.0'}))
            .mockReturnValueOnce(Promise.resolve({stderr: 'mvn not found', exitCode: 1, stdout: ''}))

        // when / then
        expect(async () => await publish.publishBuildScan()).rejects.toThrow(Error)
    })

    it('Publish build scan does nothing when maven publish command fails', async () => {
        // given
        execMock = jest
            .spyOn(exec, 'getExecOutput')
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: 'Java 1.0'}))
            .mockReturnValueOnce(Promise.resolve({stderr: '', exitCode: 0, stdout: 'Maven 1.0'}))
            .mockReturnValueOnce(Promise.resolve({stderr: 'mvn publication failed', exitCode: 1, stdout: ''}))

        // @ts-ignore
        jest.spyOn(glob, 'create').mockReturnValue(
            Promise.resolve({
                // @ts-ignore
                glob() {
                    return [
                        '/home/foo/.m2/build-scan-data/1.42/previous/abcdef/scan.scan',
                        '/home/foo/.m2/build-scan-data/1.42/previous/ghijkl/scan.scan'
                    ]
                }
            })
        )

        // when / then
        expect(async () => await publish.publishBuildScan()).rejects.toThrow(Error)
    })
})
