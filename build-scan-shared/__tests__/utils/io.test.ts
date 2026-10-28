import fs from 'fs'
import os from 'os'
import path from 'path'

import * as io from '../../src/utils/io'

describe('copyAllowedFilesSync', () => {
    let sourceDir: string
    let destDir: string

    beforeEach(() => {
        sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'io-test-source-'))
        destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'io-test-dest-'))
    })

    afterEach(() => {
        fs.rmSync(sourceDir, {recursive: true, force: true})
        fs.rmSync(destDir, {recursive: true, force: true})
    })

    function writeSourceFile(relativePath: string): void {
        fs.mkdirSync(path.dirname(path.join(sourceDir, relativePath)), {recursive: true})
        fs.writeFileSync(path.join(sourceDir, relativePath), relativePath)
    }

    it('copies allowed files only', () => {
        // given
        writeSourceFile('build-scan-data/1.42/previous/abcdef/scan.scan')
        writeSourceFile('settings.xml')

        // when
        const copied = io.copyAllowedFilesSync(sourceDir, destDir, p => p.startsWith('build-scan-data/'))

        // then
        expect(copied).toEqual(['build-scan-data/1.42/previous/abcdef/scan.scan'])
        expect(fs.existsSync(path.join(destDir, 'build-scan-data/1.42/previous/abcdef/scan.scan'))).toBe(true)
        expect(fs.existsSync(path.join(destDir, 'settings.xml'))).toBe(false)
    })

    it('does not follow symbolic links', () => {
        // given
        const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'io-test-outside-'))
        fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'secret')
        fs.mkdirSync(path.join(sourceDir, 'build-scan-data'))
        fs.symlinkSync(outsideDir, path.join(sourceDir, 'build-scan-data', 'link'))
        fs.symlinkSync(path.join(outsideDir, 'secret.txt'), path.join(sourceDir, 'build-scan-data', 'file-link'))

        // when
        const copied = io.copyAllowedFilesSync(sourceDir, destDir, () => true)

        // then
        expect(copied).toEqual([])
        expect(fs.existsSync(path.join(destDir, 'build-scan-data', 'link'))).toBe(false)
        expect(fs.existsSync(path.join(destDir, 'build-scan-data', 'file-link'))).toBe(false)
        fs.rmSync(outsideDir, {recursive: true, force: true})
    })
})
