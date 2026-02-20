import {jest} from '@jest/globals'

const mockGetDevelocityInjectionEnabled = jest.fn()
const mockGetDevelocityUrl = jest.fn()
const mockGetDevelocityCustomMavenExtensionCoordinates = jest.fn()

jest.unstable_mockModule('../../build-scan-shared/src/setup/input', () => ({
    getDevelocityInjectionEnabled: mockGetDevelocityInjectionEnabled,
    getDevelocityUrl: mockGetDevelocityUrl,
    getDevelocityEnforceUrl: jest.fn().mockReturnValue(true),
    getDevelocityMavenRepositoryUrl: jest.fn().mockReturnValue('https://some/repo/'),
    getDevelocityMavenRepositoryUsername: jest.fn().mockReturnValue('user'),
    getDevelocityMavenRepositoryPassword: jest.fn().mockReturnValue('passwd'),
    getCcudExtensionVersion: jest.fn().mockReturnValue('42.0'),
    getDevelocityCustomMavenExtensionCoordinates: mockGetDevelocityCustomMavenExtensionCoordinates,
    getDevelocityMavenExtensionVersion: jest.fn().mockReturnValue('42.0'),
    getDevelocityAllowUntrustedServer: jest.fn().mockReturnValue('true'),
    getDevelocityCaptureFileFingerprints: jest.fn().mockReturnValue('true'),
    getDevelocityCustomCcudExtensionCoordinates: jest.fn()
}))

const mockExistsSync = jest.fn()
const mockDownloadFile = jest.fn()

jest.unstable_mockModule('../../build-scan-shared/src/utils/io', () => ({
    getAbsoluteFilePath: jest.fn().mockReturnValue('/absolute/path/.mvn/extensions.xml'),
    existsSync: mockExistsSync,
    mkdirSync: jest.fn(),
    downloadFile: mockDownloadFile,
    readFileSync: jest.fn().mockReturnValue(`
            <extensions>
                <extension>
                    <artifactId>develocity-maven-extension</artifactId>
                </extension>
            </extensions>
        `),
    getDelimiter: jest.fn().mockReturnValue(':')
}))

const {constructDevelocityMavenOpts} = await import('../src/injection')

const DOWNLOAD_FOLDER: string = 'foo'

describe('Injection', () => {
    afterEach(() => {
        jest.clearAllMocks()
    })

    it('returns empty string when Develocity injection is disabled', async () => {
        // given
        mockGetDevelocityInjectionEnabled.mockReturnValue(false)

        // when
        const result = await constructDevelocityMavenOpts(DOWNLOAD_FOLDER)

        // then
        expect(result).toBe('')
    })

    it('returns empty string when Develocity URL is not configured', async () => {
        // given
        mockGetDevelocityInjectionEnabled.mockReturnValue(true)
        mockGetDevelocityUrl.mockReturnValue('')

        // when
        const result = await constructDevelocityMavenOpts(DOWNLOAD_FOLDER)

        // then
        expect(result).toBe('')
    })

    it('returns enforced Develocity URL when Develocity extension is already applied', async () => {
        // given
        mockGetDevelocityInjectionEnabled.mockReturnValue(true)
        mockGetDevelocityUrl.mockReturnValue('http://example.com')
        mockExistsSync.mockReturnValue(true)

        // when
        const result = await constructDevelocityMavenOpts(DOWNLOAD_FOLDER)

        // then
        expect(result).toContain('-Dgradle.enterprise.url=http://example.com')
        expect(result).toContain('-Ddevelocity.url=http://example.com')
        expect(result).not.toContain('-Dscan.value.CIAutoInjection=GitHub')
    })

    it('injects Develocity Maven extension', async () => {
        // given
        mockGetDevelocityInjectionEnabled.mockReturnValue(true)
        mockGetDevelocityUrl.mockReturnValue('http://example.com')
        mockExistsSync.mockReturnValue(false)
        mockDownloadFile.mockReturnValue('develocity-maven-extension-42.0.jar')

        // when
        const result = await constructDevelocityMavenOpts(DOWNLOAD_FOLDER)

        // then
        expect(mockDownloadFile).toHaveBeenCalledWith(
            'https://some/repo/com/gradle/develocity-maven-extension/42.0/develocity-maven-extension-42.0.jar',
            'foo',
            {username: 'user', password: 'passwd'}
        )
        expect(result).toContain(':develocity-maven-extension-42.0.jar')
        expect(result).toContain('-Dgradle.enterprise.url=http://example.com')
        expect(result).toContain('-Ddevelocity.url=http://example.com')
        expect(result).toContain('-Dscan.value.CIAutoInjection=GitHub')
    })

    it('injects CCUD Maven extension', async () => {
        // given
        mockGetDevelocityInjectionEnabled.mockReturnValue(true)
        mockGetDevelocityUrl.mockReturnValue('http://example.com')
        mockExistsSync.mockReturnValue(false)
        mockDownloadFile.mockReturnValue('common-custom-user-data-maven-extension-42.0.jar')

        // when
        const result = await constructDevelocityMavenOpts(DOWNLOAD_FOLDER)

        // then
        expect(mockDownloadFile).toHaveBeenCalledWith(
            'https://some/repo/com/gradle/common-custom-user-data-maven-extension/42.0/common-custom-user-data-maven-extension-42.0.jar',
            'foo',
            {username: 'user', password: 'passwd'}
        )
        expect(result).toContain('common-custom-user-data-maven-extension-42.0.jar')
    })
})
