import path from "path"

import * as params from "./params"
import * as core from "@actions/core"
import * as glob from "@actions/glob"

const BUILD_SCAN_DIR_ORIGINAL = '.m2/.gradle-enterprise/build-scan-data/'
const BUILD_SCAN_DIR_COPY = 'build-scan-data'
const MAVEN_BUILD_SCAN_CAPTURE_EXTENSION = 'maven-build-scan-capture-extension.jar';
const LIB_EXT = '/lib/ext/'

function home(): string {
    // https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners/about-github-hosted-runners#file-systems
    return process.env[`HOME`] || ''
}

export async function mavenBuildScanCaptureExtensionTarget(): Promise<string> {
    const mavenHome = process.env['MAVEN_HOME']

    if(mavenHome) {
        core.info(`Using MAVEN_HOME=${mavenHome}`)
        return `${mavenHome}${LIB_EXT}${MAVEN_BUILD_SCAN_CAPTURE_EXTENSION}`
    } else {
        core.info(`Searching maven home in ${params.getMavenHomeSearchPatterns()}`)
        const globber = await glob.create(params.getMavenHomeSearchPatterns().replace(',','\n'))
        const mavenHome = await globber.glob()
        if(mavenHome && mavenHome.at(0)) {
            core.info(`Found maven home in ${mavenHome.at(0)}`)
            return path.resolve(`${mavenHome.at(0)}${LIB_EXT}`, MAVEN_BUILD_SCAN_CAPTURE_EXTENSION)
        }
    }

    return ''
}

export function mavenBuildScanDataOriginal(): string {
    return path.resolve(home(), BUILD_SCAN_DIR_ORIGINAL)
}

export function mavenBuildScanDataCopy(): string {
    return path.resolve(BUILD_SCAN_DIR_COPY)
}

export function mavenBuildScanCaptureExtensionSource(): string {
    return path.resolve(__dirname, '..', '..', '..', 'maven-build-scan-capture-extension', 'dist', MAVEN_BUILD_SCAN_CAPTURE_EXTENSION)
}
