import * as sharedInput from '../../build-scan-shared/src/input'

export function getBuildTools(): string {
    return sharedInput.getInput('build-tools')
}
