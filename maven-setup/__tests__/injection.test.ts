import {XMLParser} from 'fast-xml-parser'

import * as injection from '../src/injection'
import * as input from '../../build-scan-shared/src/setup/input'
import * as io from '../../build-scan-shared/src/utils/io'

jest.mock('fast-xml-parser')

const DOWNLOAD_FOLDER: string = 'foo'

describe('Injection', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('returns empty string when Develocity injection is disabled', async () => {
        // given
        jest.spyOn(input, 'getDevelocityInjectionEnabled').mockReturnValue(false)

        // when
        const result = await injection.constructDevelocityMavenOpts(DOWNLOAD_FOLDER)

        // then
        expect(result).toBe('')
    })

    it('returns empty string when Develocity URL is not configured', async () => {
        // given
        jest.spyOn(input, 'getDevelocityUrl').mockReturnValue('')

        // when
        const result = await injection.constructDevelocityMavenOpts(DOWNLOAD_FOLDER)

        // then
        expect(result).toBe('')
    })

    it('returns enforced Develocity URL when Develocity extension is already applied', async () => {
        // given
        jest.spyOn(input, 'getDevelocityInjectionEnabled').mockReturnValue(true)
        jest.spyOn(input, 'getDevelocityUrl').mockReturnValue('http://example.com')
        jest.spyOn(input, 'getDevelocityEnforceUrl').mockReturnValue(true)
        jest.spyOn(io, 'getAbsoluteFilePath').mockReturnValue('/absolute/path/.mvn/extensions.xml')
        jest.spyOn(io, 'existsSync').mockReturnValue(true)
        const mockXmlContent = `
            <extensions>
                <extension>
                    <artifactId>develocity-maven-extension</artifactId>
                </extension>
            </extensions>
        `
        jest.spyOn(io, 'readFileSync').mockReturnValue(mockXmlContent)
        XMLParser.prototype.parse = jest.fn().mockReturnValueOnce({
            extensions: {
                extension: {artifactId: 'develocity-maven-extension'}
            }
        })

        // when
        const result = await injection.constructDevelocityMavenOpts(DOWNLOAD_FOLDER)

        // then
        expect(result).toContain('-Dgradle.enterprise.url=http://example.com')
        expect(result).toContain('-Ddevelocity.url=http://example.com')
    })

    it('injects Develocity Maven extension', async () => {
        // given
        jest.spyOn(input, 'getDevelocityInjectionEnabled').mockReturnValue(true)
        jest.spyOn(input, 'getDevelocityUrl').mockReturnValue('http://example.com')
        jest.spyOn(io, 'getAbsoluteFilePath').mockReturnValue('/absolute/path/.mvn/extensions.xml')
        jest.spyOn(io, 'existsSync').mockReturnValue(false)
        jest.spyOn(io, 'mkdirSync').mockReturnValue()
        jest.spyOn(io, 'downloadFile').mockResolvedValue('develocity-maven-extension-42.0.jar')
        jest.spyOn(input, 'getDevelocityMavenExtensionVersion').mockReturnValue('42.0')

        const mockXmlContent = `
            <extensions>
                <extension>
                    <artifactId>develocity-maven-extension</artifactId>
                </extension>
            </extensions>
        `
        jest.spyOn(io, 'readFileSync').mockReturnValue(mockXmlContent)
        XMLParser.prototype.parse = jest.fn().mockReturnValueOnce({
            extensions: {
                extension: {artifactId: 'develocity-maven-extension'}
            }
        })

        // when
        const result = await injection.constructDevelocityMavenOpts(DOWNLOAD_FOLDER)

        // then
        expect(result).toContain(':develocity-maven-extension-42.0.jar')
        expect(result).toContain('-Dgradle.enterprise.url=http://example.com')
        expect(result).toContain('-Ddevelocity.url=http://example.com')
    })

    it('injects CCUD Maven extension', async () => {
        // given
        jest.spyOn(input, 'getDevelocityInjectionEnabled').mockReturnValue(true)
        jest.spyOn(input, 'getDevelocityUrl').mockReturnValue('http://example.com')
        jest.spyOn(io, 'getAbsoluteFilePath').mockReturnValue('/absolute/path/.mvn/extensions.xml')
        jest.spyOn(io, 'existsSync').mockReturnValue(false)
        jest.spyOn(io, 'mkdirSync').mockReturnValue()
        jest.spyOn(io, 'downloadFile').mockResolvedValue('common-custom-user-data-maven-extension-42.0.jar')
        jest.spyOn(input, 'getCcudExtensionVersion').mockReturnValue('42.0')

        const mockXmlContent = `
            <extensions>
                <extension>
                    <artifactId>develocity-maven-extension</artifactId>
                </extension>
            </extensions>
        `
        jest.spyOn(io, 'readFileSync').mockReturnValue(mockXmlContent)
        XMLParser.prototype.parse = jest.fn().mockReturnValueOnce({
            extensions: {
                extension: {artifactId: 'common-custom-user-data-maven-extension'}
            }
        })

        // when
        const result = await injection.constructDevelocityMavenOpts(DOWNLOAD_FOLDER)

        // then
        expect(result).toContain('common-custom-user-data-maven-extension-42.0.jar')
    })
})
