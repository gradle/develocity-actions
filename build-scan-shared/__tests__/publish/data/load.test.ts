import * as glob from '@actions/glob'
import * as PropertiesReader from 'properties-reader'

import * as commonBuildTool from '../../../src/buildTool/common'
import * as githubUtils from '../../../src/publish/utils/github'
import * as load from '../../../src/publish/data/load'
import * as props from '../../../src/publish/data/properties'
import {BuildToolType} from '../../../src/buildTool/common'

const loadMock = jest.spyOn(load, 'loadBuildScanData')

const mockedArtifactIds = [42]
const mockedPrNumber = 4242

describe('load', () => {
    let octokit: any

    beforeEach(() => {
        // @ts-ignore
        jest.spyOn(glob, 'create').mockReturnValue(
            Promise.resolve({
                // @ts-ignore
                glob() {
                    return ['prNumberFilePath']
                }
            })
        )
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Load build scan metadata succeeds', async () => {
        // given
        jest.spyOn(githubUtils, 'getArtifactIdsForWorkflowRun').mockReturnValue(Promise.resolve(mockedArtifactIds))
        jest.spyOn(githubUtils, 'extractArtifactToDirectory').mockReturnValue(Promise.resolve(true))
        const reader: Partial<PropertiesReader.Reader> = {
            get(key: string) {
                switch (key) {
                    case 'PR_NUMBER':
                        return mockedPrNumber
                    default:
                        return `value for ${key}`
                }
            }
        }
        jest.spyOn(props, 'create').mockImplementation(_ => reader)
        jest.spyOn(commonBuildTool, 'parseScanDumpPath').mockReturnValue({buildId: 'foo', version: '1.42'})

        // when
        const buildScanData = await load.loadBuildScanData(BuildToolType.MAVEN,'artifactName','buildScanDataDir')

        // then
        expect(loadMock).toHaveReturned()
        expect(buildScanData?.artifactIds).toBe(mockedArtifactIds)
        expect(buildScanData?.prNumber).toBe(mockedPrNumber)
    })

    it('Load build scan metadata does nothing when build scan artifact is not found', async () => {
        // given
        jest.spyOn(githubUtils, 'getArtifactIdsForWorkflowRun').mockReturnValue(Promise.resolve([]))
        jest.spyOn(githubUtils, 'extractArtifactToDirectory').mockReturnValue(Promise.resolve(false))

        // when
        const buildScanData = await load.loadBuildScanData(BuildToolType.MAVEN,'artifactName','buildScanDataDir')

        // then
        expect(loadMock).toHaveReturned()
        expect(buildScanData?.artifactIds).toEqual([])
        expect(buildScanData?.prNumber).toBe(0)
    })

    it('Load build scan metadata fails when metadata file is not found', async () => {
        // given
        jest.spyOn(githubUtils, 'getArtifactIdsForWorkflowRun').mockReturnValue(Promise.resolve(mockedArtifactIds))
        jest.spyOn(githubUtils, 'extractArtifactToDirectory').mockReturnValue(Promise.resolve(true))
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
        await expect(async () => await load.loadBuildScanData(BuildToolType.MAVEN, 'artifactName','buildScanDataDir')).rejects.toThrow(Error)
    })
})
