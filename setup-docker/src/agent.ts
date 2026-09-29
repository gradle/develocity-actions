import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import {execFileSync, spawn} from 'child_process'
import * as fs from 'fs'
import path from 'path'

const AGENT_DOWNLOAD_URL = 'https://develocity-docker-build-agent.gradle.com'
const AGENT_MIN_JAVA_VERSION = 21

// Log lines the agent prints once subscribed to BuildKit and after each publication
const LOG_SUBSCRIBED = 'waiting for builds'
const LOG_SCAN_PUBLISHED = 'scan published: '
// Logged by the agent's gRPC transport on every connection
const LOG_NOISE = 'SO_KEEPALIVE'

const SUBSCRIPTION_TIMEOUT_SECONDS = 60

const STATE_PID = 'agent-pid'
const STATE_LOG = 'agent-log'
const STATE_BUILDER = 'agent-builder'
const STATE_HISTORY_BASELINE = 'agent-history-baseline'

export interface AgentConfig {
    develocityUrl: string
    accessKey: string
    version: string
    projectId: string
    buildxBuilder: string
    packageScanEnabled: boolean
}

export async function start(config: AgentConfig): Promise<void> {
    const java = await findJava()
    const jar = await tc.downloadTool(`${AGENT_DOWNLOAD_URL}/develocity-docker-agent-${config.version}.jar`)

    const env: typeof process.env = {
        ...process.env,
        DEVELOCITY_URL: config.develocityUrl,
        DEVELOCITY_DOCKER_PACKAGE_SCAN_ENABLED: `${config.packageScanEnabled}`
    }
    if (config.accessKey) {
        env['DEVELOCITY_ACCESS_KEY'] = config.accessKey
    }
    // The agent rejects an empty value for either of these at startup
    if (config.buildxBuilder) {
        env['BUILDX_BUILDER'] = config.buildxBuilder
    }
    if (config.projectId) {
        env['DEVELOCITY_PROJECT_ID'] = config.projectId
    }

    // BuildKit history is per builder and cumulative, so the post step waits only for records added from here on
    const baseline = countBuildHistory(config.buildxBuilder)

    const log = path.join(getRunnerTemp(), 'develocity-docker-agent.log')
    const logFd = fs.openSync(log, 'w')
    const agent = spawn(java, ['-jar', jar], {env, detached: true, stdio: ['ignore', logFd, logFd]})
    agent.unref()
    fs.closeSync(logFd)

    core.saveState(STATE_PID, agent.pid)
    core.saveState(STATE_LOG, log)
    core.saveState(STATE_BUILDER, config.buildxBuilder)
    core.saveState(STATE_HISTORY_BASELINE, baseline)

    // The agent skips builds that started before it subscribed
    if (!(await waitFor(() => readLog(log).includes(LOG_SUBSCRIBED), SUBSCRIPTION_TIMEOUT_SECONDS))) {
        throw new Error(`Develocity Docker agent did not subscribe to BuildKit:\n${readLog(log)}`)
    }
    core.info(`Develocity Docker agent started, attached to ${config.buildxBuilder || 'the current buildx builder'}`)
}

export async function stop(drainTimeoutSeconds: number, shutdownTimeoutSeconds: number): Promise<void> {
    const pid = Number(core.getState(STATE_PID))
    const log = core.getState(STATE_LOG)
    if (!pid || !log) {
        core.info('Develocity Docker agent was not started')
        return
    }

    // On SIGTERM the agent drops its queue, so signal only once every recorded build has a Build Scan
    const expected = countBuildHistory(core.getState(STATE_BUILDER)) - Number(core.getState(STATE_HISTORY_BASELINE))
    if (expected > 0) {
        core.info(`Waiting for ${expected} Build Scan(s) to be published`)
        const drained = await waitFor(() => countPublished(log) >= expected || !isRunning(pid), drainTimeoutSeconds)
        const published = countPublished(log)
        if (!drained || published < expected) {
            core.warning(`${published} of ${expected} Docker Build Scan(s) published, stopping the agent anyway`)
        }
    }

    if (isRunning(pid)) {
        process.kill(pid, 'SIGTERM')
        if (!(await waitFor(() => !isRunning(pid), shutdownTimeoutSeconds))) {
            core.warning(`Develocity Docker agent still running after ${shutdownTimeoutSeconds}s, killing it`)
            process.kill(pid, 'SIGKILL')
        }
    }

    await addJobSummary(log)
    core.info(
        readLog(log)
            .split('\n')
            .filter(line => !line.includes(LOG_NOISE))
            .join('\n')
    )
}

async function findJava(): Promise<string> {
    // Not actions/setup-java: it changes JAVA_HOME and PATH for the rest of the job, and with them the JDK the
    // project builds with (openwhisk's Scala sources do not compile on 21)
    const candidates = [
        ...Object.entries(process.env)
            .filter(([key]) => /^JAVA_HOME_\d+_(X64|ARM64)$/.test(key))
            .map(([, value]) => value as string),
        process.env['JAVA_HOME'] ?? ''
    ]
    for (const home of candidates) {
        const java = path.join(home, 'bin', 'java')
        if (home && fs.existsSync(java) && javaMajorVersion(java) >= AGENT_MIN_JAVA_VERSION) {
            return java
        }
    }

    const arch = process.arch === 'arm64' ? 'aarch64' : 'x64'
    const archive = await tc.downloadTool(
        `https://api.adoptium.net/v3/binary/latest/${AGENT_MIN_JAVA_VERSION}/ga/linux/${arch}/jdk/hotspot/normal/eclipse`
    )
    const home = await tc.extractTar(archive, undefined, ['xz', '--strip-components=1'])
    return path.join(home, 'bin', 'java')
}

function javaMajorVersion(java: string): number {
    try {
        const output = execFileSync(java, ['-version'], {encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe']})
        return parseJavaMajorVersion(output)
    } catch (error) {
        // `java -version` prints to stderr
        const stderr = (error as {stderr?: string}).stderr
        return stderr ? parseJavaMajorVersion(stderr) : 0
    }
}

export function parseJavaMajorVersion(versionOutput: string): number {
    const match = versionOutput.match(/version "(\d+)/)
    return match ? Number(match[1]) : 0
}

function countBuildHistory(builder: string): number {
    const env = builder ? {...process.env, BUILDX_BUILDER: builder} : process.env
    try {
        const output = execFileSync('docker', ['buildx', 'history', 'ls'], {encoding: 'utf-8', env})
        return countHistoryRecords(output)
    } catch (error) {
        core.debug(`Could not read BuildKit history: ${error}`)
        return 0
    }
}

export function countHistoryRecords(historyLsOutput: string): number {
    return historyLsOutput
        .split('\n')
        .slice(1)
        .filter(line => line.trim()).length
}

export function publishedScanUrls(agentLog: string): string[] {
    return agentLog
        .split('\n')
        .filter(line => line.includes(LOG_SCAN_PUBLISHED))
        .map(line => line.substring(line.indexOf(LOG_SCAN_PUBLISHED) + LOG_SCAN_PUBLISHED.length).trim())
}

function countPublished(log: string): number {
    return publishedScanUrls(readLog(log)).length
}

async function addJobSummary(log: string): Promise<void> {
    const urls = publishedScanUrls(readLog(log))
    core.summary.addHeading('Develocity Docker Build Scans', 3)
    if (urls.length > 0) {
        core.summary.addList(urls.map(url => `<a href="${url}">${url}</a>`))
    } else {
        core.summary.addRaw('No Build Scan was published, see the agent log in the post step output.', true)
    }
    await core.summary.write()
}

function readLog(log: string): string {
    return fs.existsSync(log) ? fs.readFileSync(log, 'utf-8') : ''
}

function isRunning(pid: number): boolean {
    try {
        process.kill(pid, 0)
        return true
    } catch {
        return false
    }
}

async function waitFor(condition: () => boolean, timeoutSeconds: number): Promise<boolean> {
    for (let i = 0; i < timeoutSeconds; i++) {
        if (condition()) {
            return true
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
    }
    return condition()
}

function getRunnerTemp(): string {
    const runnerTemp = process.env['RUNNER_TEMP']
    if (!runnerTemp) {
        throw new Error('RUNNER_TEMP is not set')
    }
    return runnerTemp
}
