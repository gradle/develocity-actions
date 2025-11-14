import * as core from '@actions/core'
import * as exec from '@actions/exec';

import * as input from '../../build-scan-shared/src/setup/input'
import * as io from '../../build-scan-shared/src/utils/io'
import * as os from 'os';
import * as path from 'path';
import * as actionsIo from '@actions/io';
import fs from 'fs';

export async function installDevelocity(): Promise<void> {
  if (input.getDevelocityInjectionEnabled()) {
    const agentUrlOverride = input.getDevelocityNpmAgentUrlOverride();
    const version = input.getDevelocityNpmAgentVersion();
    const agentInstallLocation = input.getDevelocityNpmAgentInstallLocation();
    const expandedInstallLocation = agentInstallLocation.replace(/^~/, os.homedir());
    const wrappersDir = path.join(expandedInstallLocation, '.develocity-npm-wrapper');

    io.mkdirSync(wrappersDir);

    await installDevelocityAgent(agentUrlOverride, version, expandedInstallLocation);
    await createWrapperScripts(wrappersDir, expandedInstallLocation);

    configureEnvironment(wrappersDir)
  }
}

/**
 * Install the Develocity npm agent to the specified location
 */
async function installDevelocityAgent(agentUrlOverride: string, version: string, develocityAgentInstallLocation: string): Promise<void> {
  const agentDir = path.join(develocityAgentInstallLocation, '@gradle-tech', 'develocity-agent');

  if (agentUrlOverride) {
    core.info(`Installing Develocity npm agent from overridden url ${agentUrlOverride} to ${agentDir}`);
  } else {
    core.info(`Installing Develocity npm agent version ${version} to ${agentDir}`);
  }

  // Create the directory
  io.mkdirSync(agentDir);

  // Use pacote to extract the agent
  const packageName = agentUrlOverride
    ? agentUrlOverride
    : version === 'latest'
    ? '@gradle-tech/develocity-agent'
    : `@gradle-tech/develocity-agent@${version}`;

  const pacoteVersion = input.getDevelocityPacoteVersion();

  try {
    await exec.exec('npm', ['exec', '-y', '--', `pacote@${pacoteVersion}`, 'extract', packageName, agentDir]);
    core.info('Develocity npm agent installed successfully');
  } catch (error) {
    throw new Error(`Failed to install Develocity npm agent: ${error}`);
  }
}

async function createWrapperScripts(wrappersDir: string, develocityAgentInstallLocation: string): Promise<void> {
  await createWrapper('npm', wrappersDir, develocityAgentInstallLocation);
  await createWrapper('npx', wrappersDir, develocityAgentInstallLocation);
}

/**
 * Create a wrapper script in `wrappersDir` that invokes `binaryName`.
 *
 * The wrapper script ensures NODE_PATH and NODE_OPTIONS are set appropriately so that the
 * Develocity npm build agent is enabled.
 */
async function createWrapper(binaryName: string, wrappersDir: string, develocityAgentInstallLocation: string): Promise<void> {
  const actualBinary = await findAndVerifyBinary(binaryName);

  // Create the wrapper script
  const wrapperScript = `#!/bin/bash
# This wrapper sets NODE_OPTIONS and NODE_PATH to preload the Develocity agent
export NODE_PATH="${develocityAgentInstallLocation}\${NODE_PATH:+:\$NODE_PATH}"

# Preserves any existing NODE_OPTIONS by appending them
export NODE_OPTIONS="-r @gradle-tech/develocity-agent/preload\${NODE_OPTIONS:+ \$NODE_OPTIONS}"

# The instrumented project may not have configured our reporter, so
# we enable auto-injection of the Jest reporter to collect test results.
export DEVELOCITY_INTERNAL_ENABLE_JEST_REPORTER_INJECTION=true

exec "${actualBinary}" "$@"
`;

  const wrapperPath = path.join(wrappersDir, binaryName);
  fs.writeFileSync(wrapperPath, wrapperScript, { mode: 0o755 });

  core.info(`Created ${binaryName} wrapper at: ${wrapperPath}`);
}

function configureEnvironment(wrappersDir: string): void {

  // Add wrapper directory to PATH
  core.addPath(wrappersDir);

  // Set environment variables if server URL and access key are provided
  const develocityUrl = input.getDevelocityUrl();
  if (develocityUrl) {
    core.exportVariable('DEVELOCITY_URL', develocityUrl);
    core.info(`Set DEVELOCITY_URL=${develocityUrl}`);
  }

  const develocityAccessKey = input.getDevelocityAccessKey();
  if (develocityAccessKey) {
    if (!develocityUrl) {
      core.warning('develocity-access-key was provided but develocity-server-url was not. The access key will not be set.');
    } else {
      core.exportVariable('DEVELOCITY_ACCESS_KEY', develocityAccessKey);

      // Mask the access key to prevent it from being logged
      core.setSecret(develocityAccessKey);
    }
  }

  const allowUntrustedServer = input.getDevelocityAllowUntrustedServer()
  if (allowUntrustedServer) {
    core.exportVariable('DEVELOCITY_ALLOW_UNTRUSTED_SERVER', allowUntrustedServer);
  }
}


async function findAndVerifyBinary(binaryName: string): Promise<string> {
  // Find the actual npm binary
  let actualBinary: string;
  try {
    actualBinary = await actionsIo.which(binaryName, true);
    core.info(`Found ${binaryName} at: ${actualBinary}`);
  } catch (error) {
    throw new Error(`${binaryName} not found in PATH`);
  }

  // Verify it's a valid npm binary
  try {
    await exec.exec(actualBinary, ['--version'], { silent: true });
  } catch (error) {
    throw new Error(`Found ${binaryName} at ${actualBinary} but it's not executable or not a valid ${binaryName} binary`);
  }

  return actualBinary;
}
