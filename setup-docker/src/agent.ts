import * as core from '@actions/core'
import * as toolCache from '@actions/tool-cache'
import fs from 'fs'
import path from 'path'
import {ChildProcess, execFileSync, spawn, spawnSync} from 'child_process'

const AGENT_JAR_NAME = 'develocity-docker-agent.jar'
const AGENT_LOG_NAME = 'develocity-docker-agent.log'
const SUBSCRIBED_MARKER = 'waiting for builds'
// The agent's wording changed after 0.9.0, so accept both
const SCAN_PUBLISHED = /(?:scan published|Build Scan published to Develocity): (\S+)/
const BUILD_NOT_PUBLISHED = [
    /failed to publish scan for ref=(\S+)/,
    /build history consumer failed on type=COMPLETE ref=(\S+)/,
    /ignoring build created before the agent started at \S+ \(ref=([^)\s]+)\)/
]

const MINIMUM_JAVA_VERSION = 21
const SUBSCRIPTION_TIMEOUT_SECONDS = 60
const MAXIMUM_AGENT_GRACE_PERIOD_SECONDS = 3600
const SHUTDOWN_MARGIN_SECONDS = 10
const ADOPTIUM_API = 'https://api.adoptium.net/v3/binary/latest'

// `docker buildx history ls` lists at most this many records per call
const HISTORY_PAGE_SIZE = 50
const MAXIMUM_HISTORY_PAGES = 20

// The runner gives these to JavaScript actions only, never to `run` steps
const ACTION_ONLY_VARIABLES = [
    'ACTIONS_RUNTIME_TOKEN',
    'ACTIONS_RUNTIME_URL',
    'ACTIONS_CACHE_URL',
    'ACTIONS_RESULTS_URL'
]

export const STATE_PID = 'develocity-docker-agent-pid'
export const STATE_LOG = 'develocity-docker-agent-log'
export const STATE_HISTORY_BASELINE = 'develocity-docker-agent-history-baseline'
export const STATE_BUILDX_BUILDER = 'develocity-docker-agent-buildx-builder'

export interface AgentConfiguration {
    develocityUrl: string
    accessKey: string
    projectId: string
    agentUrl: string
    packageScanEnabled: boolean
    allowUntrustedServer: boolean | undefined
    buildxBuilder: string
    javaHome: string
    shutdownTimeoutSeconds: number
}

export interface HistoryRecord {
    ref: string
    createdAt: string
    completed: boolean
}

/**
 * Downloads the agent, starts it, and waits until it has subscribed to BuildKit.
 *
 * Builds that start before the agent has subscribed are skipped by design, so the wait matters:
 * returning early would race the first build of the job.
 */
export async function start(configuration: AgentConfiguration): Promise<void> {
    maskAccessKey(configuration.accessKey)

    // Each step gets its own directory, so a second setup in the same job reads and counts only its own agent
    const workDirectory = fs.mkdtempSync(path.join(runnerTemp(), 'develocity-docker-agent-'))
    const javaExecutable = await resolveJavaExecutable(configuration.javaHome)
    const agentJar = await downloadAgent(configuration.agentUrl, workDirectory)

    // The agent and the post step's history count both use the builder resolved now, even if a later step
    // switches the current one
    const builder = resolveBuilder(configuration.buildxBuilder)
    const baseline = readHistoryBaseline(builder)

    const logFile = path.join(workDirectory, AGENT_LOG_NAME)
    const agent = spawnAgent(javaExecutable, agentJar, logFile, {...configuration, buildxBuilder: builder})

    core.saveState(STATE_PID, String(agent.pid))
    core.saveState(STATE_LOG, logFile)
    core.saveState(STATE_HISTORY_BASELINE, baseline ? JSON.stringify(baseline) : '')
    core.saveState(STATE_BUILDX_BUILDER, builder)

    await waitForSubscription(agent, logFile)
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

    await drain(pid, logFile, drainTimeoutSeconds)
    await shutdown(pid, shutdownTimeoutSeconds)

    return publishedScans(readLog(logFile))
}

async function drain(pid: number, logFile: string, drainTimeoutSeconds: number): Promise<void> {
    const baseline = parseHistoryBaseline(core.getState(STATE_HISTORY_BASELINE))
    if (!baseline) {
        core.warning(
            'BuildKit history could not be read when the agent started, so the number of scans to wait for is unknown. Scans still queued in the agent may be lost'
        )
        return
    }

    const builder = core.getState(STATE_BUILDX_BUILDER)
    const expected = await readNewBuilds(builder, baseline)
    if (!expected) {
        core.warning(
            `BuildKit history of builder '${builder || 'current'}' could not be read, so the number of scans to wait for is unknown. Scans still queued in the agent may be lost`
        )
        return
    }
    if (expected.size === 0) {
        core.info('BuildKit recorded no builds since the agent started, nothing to drain')
        return
    }

    core.info(`BuildKit recorded ${expected.size} build(s) since the agent started, waiting for each to be published`)
    let outcome = buildOutcomes(readLog(logFile), expected)
    for (let elapsed = 0; elapsed < drainTimeoutSeconds && outcome.settled < expected.size; elapsed++) {
        if (!isAlive(pid)) {
            core.warning(`The agent exited after settling ${outcome.settled} of ${expected.size} build(s)`)
            core.info(readLog(logFile))
            return
        }
        await sleep(1000)
        outcome = buildOutcomes(readLog(logFile), expected)
    }

    if (outcome.settled < expected.size) {
        core.warning(
            `${outcome.settled} of ${expected.size} build(s) settled after ${drainTimeoutSeconds}s, stopping the agent anyway`
        )
        core.info(readLog(logFile))
    } else if (outcome.notPublished > 0) {
        core.warning(`${outcome.notPublished} of ${expected.size} build(s) were not published, see the agent log`)
        core.info(readLog(logFile))
    } else {
        core.info(`All ${outcome.published} scan(s) published`)
    }
}

async function shutdown(pid: number, shutdownTimeoutSeconds: number): Promise<void> {
    if (!isAlive(pid)) {
        return
    }

    // The agent spends up to shutdownTimeoutSeconds on the build in flight, so allow it a little longer to exit
    const deadline = shutdownTimeoutSeconds + SHUTDOWN_MARGIN_SECONDS
    process.kill(pid, 'SIGTERM')
    for (let elapsed = 0; elapsed < deadline; elapsed++) {
        if (!isAlive(pid)) {
            return
        }
        await sleep(1000)
    }

    core.warning(`Agent still running after ${deadline}s, killing it. A Build Scan may be lost`)
    try {
        process.kill(pid, 'SIGKILL')
    } catch (error) {
        core.debug(`Could not kill the agent: ${error}`)
    }
}

export function publishedScans(agentLog: string): string[] {
    return agentLog
        .split('\n')
        .map(line => SCAN_PUBLISHED.exec(line)?.[1])
        .filter((url): url is string => url !== undefined)
}

/**
 * Counts how many of the expected builds the agent has finished with, published or not.
 *
 * Published lines carry no ref, so every one counts. Every other outcome is matched by ref. That
 * keeps builds older than the agent out of the count.
 */
export function buildOutcomes(
    agentLog: string,
    expected: Set<string>
): {published: number; notPublished: number; settled: number} {
    const notPublished = new Set<string>()
    for (const line of agentLog.split('\n')) {
        for (const pattern of BUILD_NOT_PUBLISHED) {
            const ref = pattern.exec(line)?.[1]
            if (ref && expected.has(shortRef(ref))) {
                notPublished.add(shortRef(ref))
            }
        }
    }
    const published = publishedScans(agentLog).length
    return {published, notPublished: notPublished.size, settled: published + notPublished.size}
}

export function readLog(logFile: string): string {
    try {
        return fs.readFileSync(logFile, 'utf-8')
    } catch (error) {
        core.debug(`Could not read the agent log: ${error}`)
        return ''
    }
}

/**
 * Registers the access key as a secret, so that printing the agent log never shows it.
 *
 * The runner masks a registered value only where it appears whole. The agent holds the part after
 * `host=`, so each per-host key is registered as well.
 */
export function maskAccessKey(accessKey: string): void {
    if (!accessKey) {
        return
    }
    core.setSecret(accessKey)
    for (const entry of accessKey.split(';')) {
        const key = entry.substring(entry.indexOf('=') + 1).trim()
        if (key) {
            core.setSecret(key)
        }
    }
}

/**
 * Builds the agent's environment from the step's.
 *
 * The agent outlives this step, and later steps can read its environment. It therefore gets neither
 * the step's inputs, where the long-lived access key is, nor the credentials the runner gives only to
 * JavaScript actions.
 */
export function agentEnvironment(
    stepEnvironment: Record<string, string | undefined>,
    configuration: AgentConfiguration
): Record<string, string | undefined> {
    const environment: Record<string, string | undefined> = Object.fromEntries(
        Object.entries(stepEnvironment).filter(
            ([name]) => !name.startsWith('INPUT_') && !ACTION_ONLY_VARIABLES.includes(name)
        )
    )
    environment['DEVELOCITY_URL'] = configuration.develocityUrl
    environment['DEVELOCITY_DOCKER_PACKAGE_SCAN_ENABLED'] = String(configuration.packageScanEnabled)
    environment['DEVELOCITY_DOCKER_AGENT_SHUTDOWN_GRACE_PERIOD_SECONDS'] = String(
        Math.min(configuration.shutdownTimeoutSeconds, MAXIMUM_AGENT_GRACE_PERIOD_SECONDS)
    )
    if (configuration.allowUntrustedServer !== undefined) {
        environment['DEVELOCITY_ALLOW_UNTRUSTED_SERVER'] = String(configuration.allowUntrustedServer)
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
    return environment
}

function spawnAgent(
    javaExecutable: string,
    agentJar: string,
    logFile: string,
    configuration: AgentConfiguration
): ChildProcess {
    const logFd = fs.openSync(logFile, 'a')
    const agent = spawn(javaExecutable, ['-jar', agentJar], {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env: agentEnvironment(process.env, configuration)
    })
    agent.unref()
    fs.closeSync(logFd)
    // A failed spawn emits 'error'. Handling it lets the pid check below report the failure.
    agent.once('error', error => core.debug(`Could not start the agent: ${error}`))

    if (!agent.pid) {
        throw new Error('Failed to start the Develocity Docker agent')
    }
    core.info(`Develocity Docker agent started, pid ${agent.pid}, logging to ${logFile}`)
    return agent
}

async function waitForSubscription(agent: ChildProcess, logFile: string): Promise<void> {
    for (let elapsed = 0; elapsed < SUBSCRIPTION_TIMEOUT_SECONDS; elapsed++) {
        if (readLog(logFile).includes(SUBSCRIBED_MARKER)) {
            core.info('Develocity Docker agent subscribed to BuildKit')
            return
        }
        if (agent.exitCode !== null || agent.signalCode !== null) {
            // Leaves the post step nothing to drain or stop
            core.saveState(STATE_PID, '')
            core.info(readLog(logFile))
            throw new Error(
                `The Develocity Docker agent exited with ${agent.exitCode ?? agent.signalCode} before subscribing to BuildKit`
            )
        }
        await sleep(1000)
    }
    core.info(readLog(logFile))
    throw new Error(`The Develocity Docker agent did not subscribe to BuildKit within ${SUBSCRIPTION_TIMEOUT_SECONDS}s`)
}

async function downloadAgent(url: string, workDirectory: string): Promise<string> {
    core.info(`Downloading the Develocity Docker agent from ${url}`)
    return await toolCache.downloadTool(url, path.join(workDirectory, AGENT_JAR_NAME))
}

/**
 * Finds a JDK for the agent without touching the one the job builds with.
 *
 * Deliberately not actions/setup-java: that exports JAVA_HOME and prepends PATH for the whole job,
 * which changes the JDK the build under test compiles with.
 */
export async function resolveJavaExecutable(javaHomeOverride: string): Promise<string> {
    if (javaHomeOverride) {
        const executable = javaExecutableIn(javaHomeOverride)
        const version = executable ? majorVersionOf(executable) : 0
        if (executable && version >= MINIMUM_JAVA_VERSION) {
            core.info(`Running the Develocity Docker agent on ${executable}`)
            return executable
        }
        core.warning(
            executable
                ? `${javaHomeOverride} holds Java ${version || 'of an unknown version'}, the agent needs ${MINIMUM_JAVA_VERSION} or later. Looking for a JDK on the runner instead`
                : `${javaHomeOverride} holds no bin/java. Looking for a JDK on the runner instead`
        )
    }

    const candidates: string[] = []
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
 * Names the builder `buildxBuilder` refers to, or the current builder when it is empty.
 */
function resolveBuilder(buildxBuilder: string): string {
    try {
        const output = execFileSync('docker', ['buildx', 'inspect', ...(buildxBuilder ? [buildxBuilder] : [])], {
            encoding: 'utf-8',
            stdio: 'pipe',
            env: process.env
        })
        return parseBuilderName(output) ?? buildxBuilder
    } catch (error) {
        if (buildxBuilder) {
            core.warning(
                `The buildx builder '${buildxBuilder}' was not found. The Setup Docker step has to run after the step that creates it: ${error}`
            )
        } else {
            core.debug(`Could not resolve the current buildx builder: ${error}`)
        }
        return buildxBuilder
    }
}

export function parseBuilderName(inspectOutput: string): string | undefined {
    return /^Name:\s+(\S+)/m.exec(inspectOutput)?.[1]
}

function readHistoryBaseline(builder: string): string[] | undefined {
    try {
        const refs = listHistory(builder, []).map(record => record.ref)
        core.info(`BuildKit history holds ${refs.length} recent record(s) before the agent starts`)
        return refs
    } catch (error) {
        const reason = String(error).includes('unknown command')
            ? '`docker buildx history` needs buildx 0.20 or later'
            : error
        core.warning(
            `Could not read BuildKit's build history (${reason}). The post step cannot tell how many scans to wait for, so scans still queued when the job ends may be lost`
        )
        return undefined
    }
}

export function parseHistoryBaseline(state: string): Set<string> | undefined {
    if (!state) {
        return undefined
    }
    try {
        return new Set(JSON.parse(state) as string[])
    } catch (error) {
        core.debug(`Could not parse the history baseline: ${error}`)
        return undefined
    }
}

async function readNewBuilds(builder: string, baseline: Set<string>): Promise<Set<string> | undefined> {
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            return newBuilds(filters => listHistory(builder, filters), baseline)
        } catch (error) {
            core.debug(`Could not read BuildKit's build history (attempt ${attempt}): ${error}`)
            await sleep(2000)
        }
    }
    return undefined
}

/**
 * Collects the refs of every record newer than the baseline, paging past the listing's limit.
 *
 * buildx lists running records first, then completed ones newest first, so the first completed
 * record in the baseline ends the search. The paging filter only resolves seconds. Each page
 * therefore starts at the second the previous one ended in, leaving out the refs already seen there.
 */
export function newBuilds(list: (filters: string[]) => HistoryRecord[], baseline: Set<string>): Set<string> {
    const found = new Set<string>()
    let before: string | undefined
    let seenInBoundary: string[] = []
    for (let page = 0; page < MAXIMUM_HISTORY_PAGES; page++) {
        const filters = before ? [`startedAt<${before}`, ...seenInBoundary.map(ref => `ref!=${ref}`)] : []
        let records: HistoryRecord[]
        try {
            records = list(filters)
        } catch (error) {
            if (page === 0) {
                throw error
            }
            // buildx before 0.23 has no --filter, but it lists every record, so the first page was complete
            core.debug(`Stopped paging BuildKit history: ${error}`)
            return found
        }

        let added = 0
        for (const record of records) {
            if (baseline.has(record.ref)) {
                if (record.completed) {
                    return found
                }
                continue
            }
            if (!found.has(record.ref)) {
                found.add(record.ref)
                added++
            }
        }

        // Only a page holding exactly the limit can have more behind it. A buildx that does not limit
        // the listing returns more.
        const completed = records.filter(record => record.completed)
        if (completed.length !== HISTORY_PAGE_SIZE || added === 0) {
            return found
        }
        const boundary = secondAfter(completed[completed.length - 1].createdAt)
        const inBoundary = completed
            .filter(record => secondAfter(record.createdAt) === boundary)
            .map(record => record.ref)
        seenInBoundary = boundary === before ? [...seenInBoundary, ...inBoundary] : inBoundary
        before = boundary
    }
    core.warning(`Stopped counting builds after ${MAXIMUM_HISTORY_PAGES} pages of BuildKit history`)
    return found
}

function listHistory(builder: string, filters: string[]): HistoryRecord[] {
    const environment = builder ? {...process.env, BUILDX_BUILDER: builder} : process.env
    const output = execFileSync(
        'docker',
        ['buildx', 'history', 'ls', '--format', 'json', ...filters.flatMap(filter => ['--filter', filter])],
        {encoding: 'utf-8', stdio: 'pipe', env: environment}
    )
    return parseHistoryRecords(output)
}

/**
 * Reads the JSON lines `docker buildx history ls --format json` prints.
 */
export function parseHistoryRecords(dockerOutput: string): HistoryRecord[] {
    return dockerOutput
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => JSON.parse(line) as {ref: string; created_at: string; completed_at?: string})
        .map(record => ({
            ref: shortRef(record.ref),
            createdAt: record.created_at,
            completed: Boolean(record.completed_at)
        }))
}

// buildx prefixes a ref with its builder and node. The agent logs it bare.
function shortRef(ref: string): string {
    return ref.substring(ref.lastIndexOf('/') + 1)
}

function secondAfter(timestamp: string): string {
    const seconds = Math.floor(Date.parse(timestamp.replace(/(\.\d{3})\d+/, '$1')) / 1000) + 1
    return new Date(seconds * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function isAlive(pid: number): boolean {
    try {
        process.kill(pid, 0)
    } catch (error) {
        core.debug(`Agent process ${pid} is gone: ${error}`)
        return false
    }
    // An exited agent that nobody has reaped still answers signal 0. That happens in a container job.
    return !isZombie(readProcessStat(pid))
}

function readProcessStat(pid: number): string {
    try {
        return fs.readFileSync(`/proc/${pid}/stat`, 'utf-8')
    } catch {
        return ''
    }
}

export function isZombie(processStat: string): boolean {
    // The state follows the command name, which is in parentheses and may itself contain spaces
    return processStat.substring(processStat.lastIndexOf(')') + 2).startsWith('Z')
}

function runnerTemp(): string {
    return process.env['RUNNER_TEMP'] || process.env['TMPDIR'] || '/tmp'
}

async function sleep(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds))
}
