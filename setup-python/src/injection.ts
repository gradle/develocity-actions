import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as io from '@actions/io'

import * as input from '../../build-scan-shared/src/setup/input'
import * as pythonInput from './input'

/**
 * Installs the Develocity Python agent into the interpreter that runs the instrumented tools. Python has no
 * equivalent of NODE_PATH that would load the agent into any interpreter, so it only instruments the tools run by
 * that interpreter and its environment.
 */
export async function installDevelocity(accessToken: string): Promise<void> {
    if (!input.getDevelocityInjectionEnabled()) {
        return
    }

    const requirement = pythonInput.getAgentRequirement()
    if (!requirement.includes('#sha256=')) {
        core.warning('No SHA-256 is known for this Develocity Python agent, so the download is not verified')
    }

    const python = pythonInput.getPythonExecutable()
    core.info(`Installing the Develocity Python agent into ${python}: ${requirement}`)
    await exec.exec(...(await installCommand(python, requirement)))

    configureEnvironment(accessToken)
}

/**
 * pip when the interpreter has it, otherwise uv, which creates environments without pip.
 */
async function installCommand(python: string, requirement: string): Promise<[string, string[]]> {
    const hasPip = (await exec.exec(python, ['-m', 'pip', '--version'], {ignoreReturnCode: true, silent: true})) === 0
    if (hasPip) {
        return [python, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-input', requirement]]
    }
    const uv = await io.which('uv', false)
    if (uv) {
        return [uv, ['pip', 'install', '--python', python, requirement]]
    }
    throw new Error(
        `${python} has no pip and uv is not on the PATH, so the Develocity Python agent cannot be installed`
    )
}

function configureEnvironment(accessToken: string): void {
    core.exportVariable('DEVELOCITY_URL', pythonInput.getDevelocityUrl())
    if (accessToken) {
        core.setSecret(accessToken)
        core.exportVariable('DEVELOCITY_ACCESS_KEY', accessToken)
    }
    // The Python agent's equivalent of DEVELOCITY_ALLOW_UNTRUSTED_SERVER
    const allowUntrustedServer = input.getDevelocityAllowUntrustedServer()
    if (allowUntrustedServer) {
        core.exportVariable('DEVELOCITY_ALLOW_INSECURE_PROTOCOL', allowUntrustedServer)
    }
    core.exportVariable('DEVELOCITY_VALUE_CIAutoInjection', 'GitHub')
}
