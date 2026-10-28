import {isAllowedArtifactEntry} from '../../src/utils/github'

describe('isAllowedArtifactEntry', () => {
    it.each(['build-scan-data/1.42/previous/abcdef-123/scan.scan', 'build-scan-metadata/abcdef-123.txt'])(
        'accepts %s',
        entry => {
            expect(isAllowedArtifactEntry(entry)).toBe(true)
        }
    )

    it.each([
        'settings.xml',
        'develocity.xml',
        'build-scan-publish/.mvn/extensions.xml',
        'build-scan-data/../../settings.xml',
        'build-scan-data/1.42/../../develocity.xml',
        'build-scan-data/1.42</version>/previous/abcdef/scan.scan',
        '/build-scan-data/1.42/previous/abcdef/scan.scan'
    ])('rejects %s', entry => {
        expect(isAllowedArtifactEntry(entry)).toBe(false)
    })
})
