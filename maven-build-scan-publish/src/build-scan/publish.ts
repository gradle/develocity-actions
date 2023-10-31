import * as core from '@actions/core'
import {getExecOutput} from '@actions/exec'
import * as glob from '@actions/glob'

import * as io from '../shared/io'
import * as params from '../shared/params'
import * as layout from '../shared/layout'

const PROJECT_DIR = 'maven-build-scan-publisher'
const MAVEN_DIR = `${PROJECT_DIR}/.mvn`
const REPLACE_ME_TOKEN = `REPLACE_ME`

export async function publishBuildScan(): Promise<string[]> {
    createMavenProjectStructure()

    return await publishBuildScans()
}

function createMavenProjectStructure(): void {
    // Create Maven directory
    if (!io.existsSync(MAVEN_DIR)) {
        core.debug(`Creating ${MAVEN_DIR}`)
        io.mkdirSync(MAVEN_DIR, {recursive: true})
    }

    createFile(`${PROJECT_DIR}/pom.xml`, getPomContent())
    createFile(`${MAVEN_DIR}/gradle-enterprise.xml`, getGradleEnterpriseConfigurationContent())
}

function createFile(filename: string, content: string): void {
    io.writeContentToFileSync(filename, content)
}

function getPomContent(): string {
    return `
        <project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/maven-v4_0_0.xsd">
            <modelVersion>4.0.0</modelVersion>
            <groupId>com.gradle</groupId>
            <artifactId>${PROJECT_DIR}</artifactId>
            <version>1.0</version>
            <name>Maven Build Scan Publisher</name>
        </project>
    `.replace(/  +/g, '')
}

function getExtensionsContent(): string {
    return `
        <?xml version="1.0" encoding="UTF-8"?>
        <extensions>
            <extension>
                <groupId>com.gradle</groupId>
                <artifactId>gradle-enterprise-maven-extension</artifactId>
                <version>${REPLACE_ME_TOKEN}</version>
            </extension>
        </extensions>
    `.replace(/  +/g, '')
}

function getGradleEnterpriseConfigurationContent(): string {
    return `
        <?xml version="1.0" encoding="UTF-8" standalone="yes" ?>
        <gradleEnterprise
            xmlns="https://www.gradle.com/gradle-enterprise-maven" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="https://www.gradle.com/gradle-enterprise-maven https://www.gradle.com/schema/gradle-enterprise-maven.xsd">
            <server>
                <url>${params.getDevelocityUrl()}</url>
                <allowUntrusted>${params.isDevelocityAllowUntrusted()}</allowUntrusted>
            </server>
        </gradleEnterprise>
    `.replace(/  +/g, '')
}

async function publishBuildScans(): Promise<string[]> {
    const buildScanLinks = []

    // Display Java version
    let res = await getExecOutput('java', ['-version'], {cwd: PROJECT_DIR})
    if (res.stderr !== '' && res.exitCode) {
        throw new Error(`Java execution failed: ${res.stderr}`)
    }

    // Display Maven version
    res = await getExecOutput('mvn', ['-version'], {cwd: PROJECT_DIR})
    if (res.stderr !== '' && res.exitCode) {
        throw new Error(`Maven execution failed: ${res.stderr}`)
    }

    const globber = await glob.create(`${layout.mavenBuildScanData()}/**/scan.scan`)
    const scanFiles = await globber.glob()

    for (const scanFile of scanFiles) {
        // parse current version
        core.debug(`Publishing ${scanFile}`)

        // capture extension version assuming scan name is ${HOME}/.m2/build-scan-data/<VERSION>/previous/<UUID>/scan.scan
        const versionMatch = scanFile.match(/^.*\/build-scan-data\/(.*)\/previous\/.*$/)
        const version = versionMatch?.at(1)
        if (!version) {
            throw new Error(`Version could not be parsed in : ${scanFile}`)
        }
        core.debug(`Extension version = ${version}`)

        // replace version in template
        createFile(`${MAVEN_DIR}/extensions.xml`, getExtensionsContent().replace(REPLACE_ME_TOKEN, version))

        // Run Maven build
        res = await getExecOutput('mvn', ['gradle-enterprise:build-scan-publish-previous'], {
            cwd: PROJECT_DIR,
            env: {GRADLE_ENTERPRISE_ACCESS_KEY: params.getDevelocityAccessKey()}
        })
        if (res.stderr !== '' && res.exitCode) {
            throw new Error(`Maven execution failed: ${res.stderr}`)
        }

        const buildScanLinkMatch = res.stdout.match(/^.*Publishing build scan.*$\n^.*(http.*)$/m)
        const buildScanLink = buildScanLinkMatch?.at(1)
        if (buildScanLink) {
            core.debug(`Found Build Scan Link ${buildScanLink}`)
            buildScanLinks.push(buildScanLink)
        }
    }

    return buildScanLinks
}
