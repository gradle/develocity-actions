import fs from 'fs'
import os from 'os'
import path from 'path'

import * as buildTools from '../src/buildTools'
import {SupportedBuildTool} from '../src/buildTools'

describe('Build tools', () => {
    let rootDir: string

    beforeEach(() => {
        rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-develocity-'))
    })

    afterEach(() => {
        fs.rmSync(rootDir, {recursive: true, force: true})
    })

    function writeFile(relativePath: string): void {
        fs.mkdirSync(path.dirname(path.join(rootDir, relativePath)), {recursive: true})
        fs.writeFileSync(path.join(rootDir, relativePath), '')
    }

    it('detects the build tools from the files at the root of the project', () => {
        // given
        writeFile('pom.xml')
        writeFile('package.json')
        writeFile('requirements.txt')
        writeFile('Dockerfile')

        // when
        const detected = buildTools.getBuildTools('', rootDir)

        // then
        expect(detected).toEqual([
            SupportedBuildTool.MAVEN,
            SupportedBuildTool.NPM,
            SupportedBuildTool.PYTHON,
            SupportedBuildTool.DOCKER
        ])
    })

    it.each([
        ['setup.cfg', SupportedBuildTool.PYTHON],
        ['Pipfile', SupportedBuildTool.PYTHON]
    ])('detects %s as %s', (markerFile, buildTool) => {
        // given
        writeFile(markerFile)

        // when
        const detected = buildTools.getBuildTools('', rootDir)

        // then
        expect(detected).toEqual([buildTool])
    })

    it('injects the Develocity Maven extension version the capture extension is built against', () => {
        // given
        const pom = fs.readFileSync(
            new URL('../../maven-build-scan-capture-extension/pom.xml', import.meta.url),
            'utf8'
        )

        // when
        const version = /<artifactId>develocity-maven-extension<\/artifactId>\s*<version>([^<]+)<\/version>/.exec(
            pom
        )?.[1]

        // then
        expect(buildTools.DEFAULT_DEVELOCITY_MAVEN_EXTENSION_VERSION).toBe(version)
    })

    it('ignores the files in subdirectories', () => {
        // given
        writeFile('frontend/package.json')
        writeFile('pyproject.toml')

        // when
        const detected = buildTools.getBuildTools('', rootDir)

        // then
        expect(detected).toEqual([SupportedBuildTool.PYTHON])
    })

    it('detects nothing in a project without a supported build tool', () => {
        // given
        writeFile('build.gradle')

        // when
        const detected = buildTools.getBuildTools('', rootDir)

        // then
        expect(detected).toEqual([])
    })

    it('uses the build tools of the input instead of detecting them', () => {
        // given
        writeFile('pom.xml')

        // when
        const selected = buildTools.getBuildTools(' NPM, docker\npython,npm ', rootDir)

        // then
        expect(selected).toEqual([SupportedBuildTool.NPM, SupportedBuildTool.DOCKER, SupportedBuildTool.PYTHON])
    })

    it('rejects an unsupported build tool', () => {
        expect(() => buildTools.parseBuildTools('maven,gradle')).toThrow(
            "Unsupported build tool 'gradle' in build-tools. Valid values are: [maven, npm, python, docker]"
        )
    })
})
