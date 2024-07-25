import * as core from '@actions/core'
import path from "path"
import * as https from 'https'
import * as fs from 'fs';

import * as auth from '../../build-scan-shared/src/auth/auth'
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
export async function run(): Promise<void> {
    try {
        // configure authentication
        const accessToken = await auth.getAccessToken(input.getDevelocityAccessKey(), input.getDevelocityTokenExpiry())

        const downloadFolder = maven.mavenBuildTool.getBuildScanWorkDir()
        let develocityMavenExtensionJar = ''
        let ccudMavenExtensionJar = ''
        if (input.getDevelocityInjectionEnabled() && input.getDevelocityUrl()) {
            if (input.getDevelocityMavenExtensionVersion()) {
                develocityMavenExtensionJar = await downloadFile('https://repo1.maven.org/maven2/com/gradle/develocity-maven-extension/' + input.getDevelocityMavenExtensionVersion() + '/develocity-maven-extension-' + input.getDevelocityMavenExtensionVersion() + '.jar', downloadFolder);
            }
            if (input.getCcudExtensionVersion()) {
                ccudMavenExtensionJar = await downloadFile('https://repo1.maven.org/maven2/com/gradle/common-custom-user-data-maven-extension/' + input.getCcudExtensionVersion() + '/common-custom-user-data-maven-extension-' + input.getCcudExtensionVersion() + '.jar', downloadFolder);
            }
        }

        // Configure environment to inject capture extension on Maven builds
        configureEnvironment(develocityMavenExtensionJar, ccudMavenExtensionJar)

        // Propagate environment variables to subsequent steps
        input.exportVariables(accessToken, maven.mavenBuildTool)
    } catch (error) {
        errorHandler.handle(error)
    }
}

function configureEnvironment(develocityMavenExtensionJar: string, ccudMavenExtensionJar: string): void {
    const captureExtensionSourcePath = path.resolve(
        __dirname,
        '..',
        '..',
        MAVEN_BUILD_SCAN_CAPTURE_EXTENSION,
        MAVEN_BUILD_SCAN_CAPTURE_EXTENSION_JAR
    )

    const mavenOptsCurrent = process.env[ENV_KEY_MAVEN_OPTS]
    let mavenOptsNew = `${MAVEN_OPTS_EXT_CLASS_PATH}=${captureExtensionSourcePath}`
    if (develocityMavenExtensionJar != '') {
        mavenOptsNew = `${mavenOptsNew}${path.delimiter}${develocityMavenExtensionJar}`
    }

    if (ccudMavenExtensionJar != '') {
        mavenOptsNew = `${mavenOptsNew}${path.delimiter}${ccudMavenExtensionJar}`
    }

    if (input.getDevelocityAllowUntrustedServer()) {
        mavenOptsNew = `${mavenOptsNew}${path.delimiter}-Ddevelocity.allowUntrustedServer=${input.getDevelocityAllowUntrustedServer()}`
    }

    if (mavenOptsCurrent) {
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

    core.setOutput('build-metadata-file-path', path.resolve(maven.mavenBuildTool.getBuildScanWorkDir(), 'build-metadata.json'))
    core.exportVariable(ENV_KEY_MAVEN_OPTS, mavenOptsNew)
}

async function downloadFile(url: string, downloadFolder: string): Promise<string> {
    const fileName = path.basename(url);
    const filePath = path.join(downloadFolder, fileName);

    return new Promise((resolve, reject) => {
        // Ensure the download folder exists
        if (!fs.existsSync(downloadFolder)) {
            fs.mkdirSync(downloadFolder);
        }

        const file = fs.createWriteStream(filePath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(`Failed to get '${url}' (${response.statusCode})`);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(filePath);
            });
        }).on('error', (err) => {
            fs.unlink(filePath, () => reject(err.message));
        });
    });
}

run()