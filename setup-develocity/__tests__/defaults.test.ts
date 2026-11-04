process.env['GITHUB_REPOSITORY'] = 'foo/bar'
process.env['RUNNER_TEMP'] = '/tmp'

import * as dockerInput from '../../setup-docker/src/input'
import * as input from '../../build-scan-shared/src/setup/input'
import * as maven from '../../build-scan-shared/src/buildTool/maven'
import * as npmInput from '../../setup-npm/src/input'
import * as pythonInput from '../../setup-python/src/input'

// setup-develocity does not declare the build tool specific inputs, so their defaults have to be applied in code
describe('Build tool defaults without inputs', () => {
    beforeEach(() => {
        for (const key of Object.keys(process.env).filter(k => k.startsWith('INPUT_'))) {
            delete process.env[key]
        }
    })

    it('applies the Maven defaults', () => {
        // when
        input.exportVariables('', maven.mavenBuildTool)

        // then
        expect(input.getDevelocityMavenExtensionVersion()).toBe('2.6.1')
        expect(input.getDevelocityCaptureFileFingerprints()).toBe(true)
        expect(input.isAddPrComment()).toBe(true)
        expect(input.isAddJobSummary()).toBe(true)
        expect(input.isAddProjectIdInJobSummary()).toBe(false)
        expect(process.env['INPUT_CAPTURE_STRATEGY']).toBe('ALWAYS')
        expect(process.env['INPUT_CAPTURE_UNPUBLISHED_BUILD_SCANS']).toBe('true')
        expect(process.env['INPUT_CAPTURE_BUILD_SCAN_LINKS']).toBe('true')
    })

    it('applies the npm defaults', () => {
        expect(npmInput.getDevelocityNpmAgentUrlOverride()).toBe('')
        expect(npmInput.getDevelocityNpmAgentVersion()).toBe('latest')
        expect(npmInput.getDevelocityNpmAgentInstallLocation()).toBe('~/.node_libraries')
        expect(npmInput.getDevelocityPacoteVersion()).toBe('21.0.0')
    })

    it('applies the Python defaults', () => {
        expect(pythonInput.getAgentRequirement()).toBe(
            'develocity-agent @ https://develocity-python-pkgs.gradle.com/develocity_agent-0.10.1-py3-none-any.whl#sha256=2bfc48f29b1c437daac718bb3d5c726b74ec60cf33723986341d9a262e6f4896'
        )
        expect(pythonInput.getPythonExecutable()).toBe('python')
    })

    it('applies the Docker defaults', () => {
        expect(dockerInput.getAgentUrl()).toBe(
            'https://develocity-docker-build-agent.gradle.com/develocity-docker-agent-0.9.0.jar'
        )
        expect(dockerInput.getPackageScanEnabled()).toBe(true)
        expect(dockerInput.getDrainTimeout()).toBe(300)
        expect(dockerInput.getShutdownTimeout()).toBe(120)
        expect(dockerInput.getAddJobSummary()).toBe(true)
    })
})
