import * as core from '@actions/core'
import path from "path"

import * as errorHandler from '../../build-scan-shared/src/error'
import * as input from '../../build-scan-shared/src/setup/input'
import * as maven from '../../build-scan-shared/src/buildTool/maven'

const MAVEN_BUILD_SCAN_CAPTURE_EXTENSION = `maven-build-scan-capture-extension`
const MAVEN_BUILD_SCAN_CAPTURE_EXTENSION_JAR = `${MAVEN_BUILD_SCAN_CAPTURE_EXTENSION}.jar`

const ENV_KEY_MAVEN_OPTS = 'MAVEN_OPTS'
const MAVEN_OPTS_EXT_CLASS_PATH = '-Dmaven.ext.class.path'

/**
 * Main entrypoint for the action
 */
export function run(): void {
    try {
        // Configure environment to inject capture extension on Maven builds
        configureEnvironment()

        // Propagate environment variables to subsequent steps
        input.exportVariables(maven.mavenBuildTool)
    } catch (error) {
        errorHandler.handle(error)
    }
}

function configureEnvironment(): void {
    const captureExtensionSourcePath = path.resolve(
        __dirname,
        '..',
        '..',
        MAVEN_BUILD_SCAN_CAPTURE_EXTENSION,
        MAVEN_BUILD_SCAN_CAPTURE_EXTENSION_JAR
    )

    const mavenOptsCurrent = process.env[ENV_KEY_MAVEN_OPTS]

    let mavenOptsNew = `${MAVEN_OPTS_EXT_CLASS_PATH}=${captureExtensionSourcePath}`
    if(mavenOptsCurrent) {
        const extClassPathIndex = mavenOptsCurrent.indexOf(`${MAVEN_OPTS_EXT_CLASS_PATH}=`)
        if(extClassPathIndex !== -1) {
            // MAVEN_OPTS already configured with -Dmaven.ext.class.path
            mavenOptsNew = mavenOptsCurrent.substring(0, extClassPathIndex) + mavenOptsNew + path.delimiter + mavenOptsCurrent.substring(extClassPathIndex + `${MAVEN_OPTS_EXT_CLASS_PATH}=`.length)
        } else {
            // MAVEN_OPTS already configured without -Dmaven.ext.class.path
            mavenOptsNew = `${mavenOptsCurrent} ${mavenOptsNew}`
        }
    } else {
        // MAVEN_OPTS not configured
    }

    core.exportVariable(ENV_KEY_MAVEN_OPTS, mavenOptsNew)
}

run()
