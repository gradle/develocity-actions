import * as core from '@actions/core'
import * as toolCache from '@actions/tool-cache'
import fs from 'fs'
import path from 'path'
import {execFileSync, spawn, spawnSync} from 'child_process'

const AGENT_JAR_NAME = 'develocity-docker-agent.jar'
const AGENT_LOG_NAME = 'develocity-docker-agent.log'
const SUBSCRIBED_MARKER = 'waiting for builds'
const SCAN_PUBLISHED_MARKER = 'scan published: '

const MINIMUM_JAVA_VERSION = 21
const SUBSCRIPTION_TIMEOUT_SECONDS = 60
const ADOPTIUM_API = 'https://api.adoptium.net/v3/binary/latest'

export const STATE_PID = 'develocity-docker-agent-pid'
export const STATE_LOG = 'develocity-docker-agent-log'
export const STATE_HISTORY_BASELINE = 'develocity-docker-agent-history-baseline'
export const STATE_BUILDX_BUILDER = 'develocity-docker-agent-buildx-builder'

export interface AgentConfiguration {
    develocityUrl: string
    accessKey: string
    projectId: string
    agentVersion: string
    agentBaseUrl: string
    capturePackageList: boolean
    buildxBuilder: string
    javaHomeOverride: string
}

/**
 * Downloads the agent, starts it, and waits until it has subscribed to BuildKit.
 *
 * Builds that start before the agent has subscribed are skipped by design, so the wait matters:
 * returning early would race the first build of the job.
 */
export async function start(configuration: AgentConfiguration): Promise<void> {
    const javaExecutable = await resolveJavaExecutable(configuration.javaHomeOverride)
    const agentJar = await downloadAgent(configuration.agentBaseUrl, configuration.agentVersion)

    // BuildKit's history is cumulative and a job may set the agent up more than once, so record how
    // deep it is now. The post step waits for one scan per record added after this point, rather than
    // for records a previous agent in the same job has already published.
    const historyBaseline = countBuildKitHistory(configuration.buildxBuilder)
    core.info(`BuildKit history holds ${historyBaseline} record(s) before the agent starts`)

    const logFile = path.join(runnerTemp(), AGENT_LOG_NAME)
    const pid = spawnAgent(javaExecutable, agentJar, logFile, configuration)

    core.saveState(STATE_PID, String(pid))
    core.saveState(STATE_LOG, logFile)
    core.saveState(STATE_HISTORY_BASELINE, String(historyBaseline))
    core.saveState(STATE_BUILDX_BUILDER, configuration.buildxBuilder)

    await waitForSubscription(logFile)
}

/**
 * Waits for the agent to publish everything it captured, then stops it.
 *
 * On SIGTERM the agent finishes the build it is currently processing and drops whatever is queued
 * behind it. Package scanning is synchronous, so signalling right after the last build of a job
 * would lose that build's scan.
 */
export async function stop(drainTimeoutSeconds: number, shutdownTimeoutSeconds: number): Promise<string[]> {
    const pid = Number.parseInt(core.getState(STATE_PID), 10)
    const logFile = core.getState(STATE_LOG)

    if (!Number.isFinite(pid) || !logFile) {
        core.info('No Develocity Docker agent was started by this job')
        return []
    }

    await drain(logFile, drainTimeoutSeconds)
    await shutdown(pid, shutdownTimeoutSeconds)

    return publishedScans(logFile)
}

async function drain(logFile: string, drainTimeoutSeconds: number): Promise<void> {
    const baseline = Number.parseInt(core.getState(STATE_HISTORY_BASELINE), 10)
    const builder = core.getState(STATE_BUILDX_BUILDER)
    const expected = Math.max(0, countBuildKitHistory(builder) - (Number.isFinite(baseline) ? baseline : 0))

    if (expected === 0) {
        core.info('BuildKit recorded no new builds since the agent started, nothing to drain')
        return
    }

    core.info(`BuildKit recorded ${expected} build(s) since the agent started, waiting for that many scans`)
    for (let elapsed = 0; elapsed < drainTimeoutSeconds; elapsed++) {
        if (publishedScans(logFile).length >= expected) {
            break
        }
        await sleep(1000)
    }

    const published = publishedScans(logFile).length
    if (published < expected) {
        core.warning(
            `${published} of ${expected} scans published after ${drainTimeoutSeconds}s, stopping the agent anyway`
        )
        core.info(readLog(logFile))
    } else {
        core.info(`All ${published} scan(s) published`)
    }
}

async function shutdown(pid: number, shutdownTimeoutSeconds: number): Promise<void> {
    if (!isAlive(pid)) {
        return
    }

    process.kill(pid, 'SIGTERM')
    for (let elapsed = 0; elapsed < shutdownTimeoutSeconds; elapsed++) {
        if (!isAlive(pid)) {
            return
        }
        await sleep(1000)
    }

    core.warning(`Agent still running after ${shutdownTimeoutSeconds}s, killing it. A Build Scan may be lost`)
    try {
        process.kill(pid, 'SIGKILL')
    } catch (error) {
        core.debug(`Could not kill the agent: ${error}`)
    }
}

export function publishedScans(logFile: string): string[] {
    return readLog(logFile)
        .split('\n')
        .filter(line => line.includes(SCAN_PUBLISHED_MARKER))
        .map(line => line.substring(line.indexOf(SCAN_PUBLISHED_MARKER) + SCAN_PUBLISHED_MARKER.length).trim())
        .filter(url => url.length > 0)
}

export function readLog(logFile: string): string {
    try {
        return fs.readFileSync(logFile, 'utf-8')
    } catch (error) {
        core.debug(`Could not read the agent log: ${error}`)
        return ''
    }
}

function spawnAgent(
    javaExecutable: string,
    agentJar: string,
    logFile: string,
    configuration: AgentConfiguration
): number {
    const environment: Record<string, string | undefined> = {
        ...process.env,
        DEVELOCITY_URL: configuration.develocityUrl,
        DEVELOCITY_DOCKER_PACKAGE_SCAN_ENABLED: String(configuration.capturePackageList)
    }
    if (configuration.accessKey) {
        environment['DEVELOCITY_ACCESS_KEY'] = configuration.accessKey
    }
    // An empty value is not the same as an unset one for either of these: an empty BUILDX_BUILDER
    // selects no builder, and an empty project id aborts the agent at startup.
    if (configuration.buildxBuilder) {
        environment['BUILDX_BUILDER'] = configuration.buildxBuilder
    }
    if (configuration.projectId) {
        environment['DEVELOCITY_PROJECT_ID'] = configuration.projectId
    }

    const logFd = fs.openSync(logFile, 'a')
    const agent = spawn(javaExecutable, ['-jar', agentJar], {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env: environment
    })
    agent.unref()

    if (!agent.pid) {
        throw new Error('Failed to start the Develocity Docker agent')
    }
    core.info(`Develocity Docker agent started, pid ${agent.pid}, logging to ${logFile}`)
    return agent.pid
}

async function waitForSubscription(logFile: string): Promise<void> {
    for (let elapsed = 0; elapsed < SUBSCRIPTION_TIMEOUT_SECONDS; elapsed++) {
        if (readLog(logFile).includes(SUBSCRIBED_MARKER)) {
            core.info('Develocity Docker agent subscribed to BuildKit')
            return
        }
        await sleep(1000)
    }
    core.info(readLog(logFile))
    throw new Error(`The Develocity Docker agent did not subscribe to BuildKit within ${SUBSCRIPTION_TIMEOUT_SECONDS}s`)
}

async function downloadAgent(baseUrl: string, version: string): Promise<string> {
    const url = `${baseUrl.replace(/\/$/, '')}/develocity-docker-agent-${version}.jar`
    core.info(`Downloading the Develocity Docker agent from ${url}`)
    const downloaded = await toolCache.downloadTool(url)

    const agentJar = path.join(runnerTemp(), AGENT_JAR_NAME)
    fs.copyFileSync(downloaded, agentJar)
    return agentJar
}

/**
 * Finds a JDK for the agent without touching the one the job builds with.
 *
 * Deliberately not actions/setup-java: that exports JAVA_HOME and prepends PATH for the whole job,
 * which changes the JDK the build under test compiles with.
 */
export async function resolveJavaExecutable(javaHomeOverride: string): Promise<string> {
    const candidates: string[] = []

    if (javaHomeOverride) {
        candidates.push(javaHomeOverride)
    }
    for (let version = MINIMUM_JAVA_VERSION; version <= MINIMUM_JAVA_VERSION + 10; version++) {
        for (const architecture of ['X64', 'ARM64']) {
            const fromEnv = process.env[`JAVA_HOME_${version}_${architecture}`]
            if (fromEnv) {
                candidates.push(fromEnv)
            }
        }
    }
    candidates.push(...preinstalledJavaHomes())

    for (const candidate of candidates) {
        const executable = javaExecutableIn(candidate)
        if (executable && majorVersionOf(executable) >= MINIMUM_JAVA_VERSION) {
            core.info(`Running the Develocity Docker agent on ${executable}`)
            return executable
        }
    }

    return await downloadJava()
}

function preinstalledJavaHomes(): string[] {
    const jvmDir = '/usr/lib/jvm'
    try {
        return fs
            .readdirSync(jvmDir)
            .filter(name => /^temurin-\d+-jdk/.test(name) || /^zulu-\d+/.test(name))
            .map(name => path.join(jvmDir, name))
    } catch (error) {
        core.debug(`No JDKs found in ${jvmDir}: ${error}`)
        return []
    }
}

function javaExecutableIn(javaHome: string): string | undefined {
    for (const relative of [path.join('bin', 'java'), path.join('Contents', 'Home', 'bin', 'java')]) {
        const executable = path.join(javaHome, relative)
        if (fs.existsSync(executable)) {
            return executable
        }
    }
    return undefined
}

function majorVersionOf(javaExecutable: string): number {
    // `java -version` writes to stderr on most JDKs and to stdout on others, so read both
    const result = spawnSync(javaExecutable, ['-version'], {encoding: 'utf-8'})
    if (result.error) {
        core.debug(`Could not run ${javaExecutable}: ${result.error}`)
        return 0
    }
    return parseMajorVersion(`${result.stderr ?? ''}\n${result.stdout ?? ''}`)
}

export function parseMajorVersion(javaVersionOutput: string): number {
    const match = javaVersionOutput.match(/version "(\d+)(?:\.(\d+))?/)
    if (!match) {
        return 0
    }
    const major = Number.parseInt(match[1], 10)
    // Java 8 and earlier report 1.8.0 rather than 8
    return major === 1 ? Number.parseInt(match[2] ?? '0', 10) : major
}

async function downloadJava(): Promise<string> {
    const operatingSystem = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux'
    const architecture = process.arch === 'arm64' ? 'aarch64' : 'x64'
    const url = `${ADOPTIUM_API}/${MINIMUM_JAVA_VERSION}/ga/${operatingSystem}/${architecture}/jdk/hotspot/normal/eclipse`

    core.info(`No JDK ${MINIMUM_JAVA_VERSION} or later found on the runner, downloading one from ${url}`)
    const archive = await toolCache.downloadTool(url)
    const extracted =
        operatingSystem === 'windows' ? await toolCache.extractZip(archive) : await toolCache.extractTar(archive)

    for (const entry of fs.readdirSync(extracted)) {
        const executable = javaExecutableIn(path.join(extracted, entry))
        if (executable) {
            core.info(`Running the Develocity Docker agent on ${executable}`)
            return executable
        }
    }
    throw new Error(`No java executable found in the JDK downloaded from ${url}`)
}

/**
 * Counts the build records `docker buildx history ls` reported, ignoring its header line.
 */
export function countHistoryRecords(dockerOutput: string): number {
    return dockerOutput
        .split('\n')
        .slice(1)
        .filter(line => line.trim().length > 0).length
}

export function countBuildKitHistory(buildxBuilder: string): number {
    try {
        const environment = buildxBuilder ? {...process.env, BUILDX_BUILDER: buildxBuilder} : process.env
        const output = execFileSync('docker', ['buildx', 'history', 'ls'], {
            encoding: 'utf-8',
            stdio: 'pipe',
            env: environment
        })
        return countHistoryRecords(output)
    } catch (error) {
        core.debug(`Could not read BuildKit's build history: ${error}`)
        return 0
    }
}

function isAlive(pid: number): boolean {
    try {
        process.kill(pid, 0)
        return true
    } catch (error) {
        core.debug(`Agent process ${pid} is gone: ${error}`)
        return false
    }
}

function runnerTemp(): string {
    return process.env['RUNNER_TEMP'] || process.env['TMPDIR'] || '/tmp'
}

async function sleep(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}
