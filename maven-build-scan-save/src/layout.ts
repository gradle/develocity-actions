export const BUILD_SCAN_DIR = '.m2/.gradle-enterprise/build-scan-data/'

export function home(): string {
    // https://docs.github.com/en/actions/using-github-hosted-runners/about-github-hosted-runners/about-github-hosted-runners#file-systems
    return process.env[`HOME`] || ''
}

export function mavenBuildScanData(): string {
    return `${home()}/${BUILD_SCAN_DIR}`
}
