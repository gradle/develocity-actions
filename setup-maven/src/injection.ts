import * as core from '@actions/core'

import * as input from '../../build-scan-shared/src/setup/input'
import * as io from '../../build-scan-shared/src/utils/io'

export async function constructDevelocityMavenOpts(downloadFolder: string): Promise<string> {
    let develocityMavenExtensionMavenOpts = ''
    if (input.getDevelocityInjectionEnabled() && input.getDevelocityUrl()) {
        const extensionsFileName = '.mvn/extensions.xml'
        const absoluteFilePath = io.getAbsoluteFilePath(extensionsFileName)

        if (await develocityExtensionApplied(absoluteFilePath)) {
            core.info(`Develocity Maven extension is already configured in the project`)
            if (input.getDevelocityEnforceUrl()) {
                core.info(`Enforcing Develocity URL to: ${input.getDevelocityUrl()}`)
                develocityMavenExtensionMavenOpts = ` -Dgradle.enterprise.url=${input.getDevelocityUrl()} -Ddevelocity.url=${input.getDevelocityUrl()}`
            }
        } else {
            if (input.getDevelocityMavenExtensionVersion()) {
                const develocityMavenExtensionJar = await io.downloadFile('https://repo1.maven.org/maven2/com/gradle/develocity-maven-extension/' + input.getDevelocityMavenExtensionVersion() + '/develocity-maven-extension-' + input.getDevelocityMavenExtensionVersion() + '.jar', downloadFolder)
                develocityMavenExtensionMavenOpts = `${io.getDelimiter()}${develocityMavenExtensionJar} -Dgradle.enterprise.url=${input.getDevelocityUrl()} -Ddevelocity.url=${input.getDevelocityUrl()}`
                if (input.getDevelocityAllowUntrustedServer()) {
                    develocityMavenExtensionMavenOpts = `${develocityMavenExtensionMavenOpts} -Ddevelocity.allowUntrustedServer=${input.getDevelocityAllowUntrustedServer()}`
                }
                develocityMavenExtensionMavenOpts = `${develocityMavenExtensionMavenOpts} -Ddevelocity.captureFileFingerprints=${input.getDevelocityCaptureFileFingerprints()}`
            }
            if (input.getCcudExtensionVersion() && !(await ccudExtensionApplied(absoluteFilePath))) {
                const ccudMavenExtensionJar = await io.downloadFile('https://repo1.maven.org/maven2/com/gradle/common-custom-user-data-maven-extension/' + input.getCcudExtensionVersion() + '/common-custom-user-data-maven-extension-' + input.getCcudExtensionVersion() + '.jar', downloadFolder)
                develocityMavenExtensionMavenOpts = `${develocityMavenExtensionMavenOpts} ${ccudMavenExtensionJar}`
            }
        }
    }

    return develocityMavenExtensionMavenOpts
}

interface Extension {
    artifactId: string
}

interface Extensions {
    extensions: {
        extension: Extension | Extension[]
    }
}

async function develocityExtensionApplied(filePath: string): Promise<boolean> {
    return await extensionApplied(filePath, ["develocity-maven-extension", "gradle-enterprise-maven-extension"], input.getDevelocityCustomMavenExtensionCoordinates())
}

async function ccudExtensionApplied(filePath: string): Promise<boolean> {
    return await extensionApplied(filePath, ["common-custom-user-data-maven-extension"], input.getDevelocityCustomCcudExtensionCoordinates())
}

async function parseExtensions(xmlContent: string): Promise<Extensions> {
    const { XMLParser } = await import('fast-xml-parser')
    const parser = new XMLParser()
    return parser.parse(xmlContent) as Extensions
}

async function extensionApplied(filePath: string, artifacts: string[], customCoordinates: string): Promise<boolean> {
    if (!io.existsSync(filePath)) {
        return false
    }

    const xmlContent = io.readFileSync(filePath)

    const result = await parseExtensions(xmlContent)

    if (result.extensions && result.extensions.extension) {
        const extensions = Array.isArray(result.extensions.extension)
            ? result.extensions.extension
            : [result.extensions.extension]

        for (const ext of extensions) {
            const artifact = String(ext.artifactId)
            if (artifacts.includes(artifact) || artifact === customCoordinates) {
                return true
            }
        }
    }

    return false
}
