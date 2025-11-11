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
    const version = input.getDevelocityNpmAgentVersion();
    const agentInstallLocation = input.getDevelocityNpmAgentInstallLocation();
    const expandedInstallLocation = agentInstallLocation.replace(/^~/, os.homedir());
    await installDevelocityAgent(version, expandedInstallLocation);
    await createNpmWrapper(expandedInstallLocation);
  }
}

/**
 * Install the Develocity npm agent to the specified location
 */
async function installDevelocityAgent(version: string, develocityAgentInstallLocation: string): Promise<void> {
  const agentDir = path.join(develocityAgentInstallLocation, '@gradle-tech', 'develocity-agent');

  core.info(`Installing Develocity npm agent version ${version} to ${agentDir}`);

  // Create the directory
  io.mkdirSync(agentDir);

  // Use pacote to extract the agent
  const packageName = version === 'latest' 
    ? '@gradle-tech/develocity-agent'
    : `@gradle-tech/develocity-agent@${version}`;

  try {
    await exec.exec('npm', ['exec', '-y', '--', 'pacote', 'extract', packageName, agentDir]);
    core.info('Develocity npm agent installed successfully');
  } catch (error) {
    throw new Error(`Failed to install Develocity npm agent: ${error}`);
  }
}

async function createNpmWrapper(develocityAgentInstallLocation: string): Promise<void> {
  // Create a wrapper directory for the npm script
  const wrapperDir = path.join(os.homedir(), '.develocity-npm-wrapper');
  io.mkdirSync(wrapperDir);

  // Find the actual npm binary
  let actualNpm: string;
  try {
    actualNpm = await actionsIo.which('npm', true);
    core.info(`Found npm at: ${actualNpm}`);
  } catch (error) {
    throw new Error('npm not found in PATH');
  }

  // Verify it's a valid npm binary
  try {
    await exec.exec(actualNpm, ['--version'], { silent: true });
  } catch (error) {
    throw new Error(`Found npm at ${actualNpm} but it's not executable or not a valid npm binary`);
  }

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

  // Create the npm wrapper script
  const wrapperScript = `#!/bin/bash
# This wrapper sets NODE_OPTIONS and NODE_PATH to preload the Develocity agent
export NODE_PATH="${develocityAgentInstallLocation}\${NODE_PATH:+:\$NODE_PATH}"

# Preserves any existing NODE_OPTIONS by appending them
export NODE_OPTIONS="-r @gradle-tech/develocity-agent/preload\${NODE_OPTIONS:+ \$NODE_OPTIONS}"

# The instrumented project may not have configured our reporter, so
# we enable auto-injection of the Jest reporter to collect test results.
export DEVELOCITY_INTERNAL_ENABLE_JEST_REPORTER_INJECTION=true

exec "${actualNpm}" "$@"
`;

  const wrapperPath = path.join(wrapperDir, 'npm');
  fs.writeFileSync(wrapperPath, wrapperScript, { mode: 0o755 });

  core.info(`Created npm wrapper at: ${wrapperPath}`);

  // Add wrapper directory to PATH
  core.addPath(wrapperDir);
}

