import * as glob from '@actions/glob'
import * as PropertiesReader from 'properties-reader'

import * as load from '../../src/metadata/load'
import * as props from '../../src/metadata/properties'
import {BuildToolType} from '../../src/buildTool/common'

const loadMock = jest.spyOn(load, 'loadJobMetadata')

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

        // when
        const buildScanData = await load.loadJobMetadata(BuildToolType.MAVEN, 'buildScanMetadataDir')

        // then
        expect(loadMock).toHaveReturned()
        expect(buildScanData?.builds).toHaveLength(2)
        expect(buildScanData?.prNumber).toBe(mockedPrNumber)
    })

    it('Load build scan metadata does nothing without metadata file', async () => {
        // given
        jest.spyOn(glob, 'create').mockReturnValue(
            Promise.resolve({
                // @ts-ignore
                glob() {
                    return []
                }
            })
        )

        // when
        const buildScanData = await load.loadJobMetadata(BuildToolType.MAVEN, 'buildScanMetadataDir')

        // then
        expect(loadMock).toHaveReturned()
        expect(buildScanData?.builds).toBeUndefined()
        expect(buildScanData?.prNumber).toBeUndefined()
    })
})
