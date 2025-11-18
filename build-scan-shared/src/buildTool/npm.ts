import path from 'path'

import * as commonBuildTool from './common'

class NpmBuildTool extends commonBuildTool.BuildTool {
    private readonly BUILD_SCAN_ARTIFACT_NAME = 'npm-build-scan-data'
    private readonly DEVELOCITY_DIR = '.develocity/'
    private readonly COMMAND = 'npm'

    constructor() {
        super(commonBuildTool.BuildToolType.NPM)
    }

    getBuildToolHome(): string {
        return path.resolve(this.getHome(), '.develocity', 'npm')
    }

    getArtifactName(): string {
        return this.BUILD_SCAN_ARTIFACT_NAME
    }

    getDevelocityDir(): string {
        return path.resolve(this.getBuildToolHome(), this.DEVELOCITY_DIR)
    }

    getCommand(): string {
        return this.COMMAND
    }
}

export const npmBuildTool = new NpmBuildTool()
