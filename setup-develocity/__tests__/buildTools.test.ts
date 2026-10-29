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
