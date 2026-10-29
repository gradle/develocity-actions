import path from 'path'

import * as io from '../../build-scan-shared/src/utils/io'

export const STATE_BUILD_TOOLS = 'develocity-build-tools'

export enum SupportedBuildTool {
    MAVEN = 'maven',
    NPM = 'npm',
    PYTHON = 'python',
    DOCKER = 'docker'
}

/**
 * Files whose presence at the root of the project denotes a build tool
 */
const MARKER_FILES: Record<SupportedBuildTool, string[]> = {
    [SupportedBuildTool.MAVEN]: ['pom.xml'],
    [SupportedBuildTool.NPM]: ['package.json'],
    [SupportedBuildTool.PYTHON]: ['pyproject.toml', 'requirements.txt', 'setup.py'],
    [SupportedBuildTool.DOCKER]: ['Dockerfile']
}

/**
 * The build tools listed in the input, or the ones detected at the root of the project when the input is empty
 */
export function getBuildTools(buildToolsInput: string, rootDir: string): SupportedBuildTool[] {
    return buildToolsInput.trim() ? parseBuildTools(buildToolsInput) : detectBuildTools(rootDir)
}

export function parseBuildTools(value: string): SupportedBuildTool[] {
    const supported = Object.values(SupportedBuildTool) as string[]
    const buildTools = new Set<SupportedBuildTool>()
    for (const name of value.split(/[\s,]+/).filter(Boolean)) {
        const buildTool = name.toLowerCase()
        if (!supported.includes(buildTool)) {
            throw new Error(
                `Unsupported build tool '${name}' in build-tools. Valid values are: [${supported.join(', ')}]`
            )
        }
        buildTools.add(buildTool as SupportedBuildTool)
    }
    return [...buildTools]
}

export function detectBuildTools(rootDir: string): SupportedBuildTool[] {
    return Object.values(SupportedBuildTool).filter(buildTool =>
        MARKER_FILES[buildTool].some(markerFile => io.existsSync(path.resolve(rootDir, markerFile)))
    )
}
