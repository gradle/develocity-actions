import * as core from '@actions/core'

import * as agent from './agent'
import * as input from './input'

/**
 * Start the Docker agent, holding the access token obtained from the access key input
 */
export async function start(accessKey: string, accessToken: string): Promise<void> {
    if (accessKey && accessToken === accessKey) {
        core.warning('No short-lived token could be fetched, so the Docker agent holds the long-lived access key')
    }

    await agent.start({
        develocityUrl: input.getDevelocityUrl(),
        accessKey: accessToken,
        projectId: input.getDevelocityProjectId(),
        agentUrl: input.getAgentUrl(),
        packageScanEnabled: input.getPackageScanEnabled(),
        allowUntrustedServer: input.getDevelocityAllowUntrustedServer(),
        buildxBuilder: input.getBuildxBuilder(),
        javaHome: input.getJavaHome(),
        shutdownTimeoutSeconds: input.getShutdownTimeout()
    })
}

/**
 * Stop the Docker agent and report the Build Scans it published
 */
export async function stop(): Promise<void> {
    const scans = await agent.stop(input.getDrainTimeout(), input.getShutdownTimeout())
    await dumpSummary(scans, input.getAddJobSummary())
}

async function dumpSummary(scans: string[], addJobSummary: boolean): Promise<void> {
    if (scans.length === 0) {
        core.info('No Docker Build Scan was published')
        return
    }

    for (const scan of scans) {
        core.info(`Docker Build Scan published: ${scan}`)
    }

    if (!addJobSummary) {
        return
    }
    core.summary.addHeading('Docker Build Scans', 3)
    core.summary.addList(scans.map(scan => `<a href="${scan}">${scan}</a>`))
    await core.summary.write()
}
