import {jest} from '@jest/globals'
import {spawn, spawnSync} from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Runs start() and stop() against a fake `docker` and a fake JDK whose `java -jar` runs $FAKE_AGENT

jest.unstable_mockModule('@actions/tool-cache', () => ({
    downloadTool: jest.fn(async (_url: string, destination: string) => {
        fs.writeFileSync(destination, 'not a jar')
        return destination
    }),
    extractTar: jest.fn(),
    extractZip: jest.fn()
}))

const {start, stop} = await import('../src/agent')

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-docker-lifecycle-'))
const bin = path.join(fixture, 'bin')
const javaHome = path.join(fixture, 'jdk')
const history = path.join(fixture, 'history.json')
const stateFile = path.join(fixture, 'state')
const started: number[] = []

function executable(file: string, content: string): void {
    fs.mkdirSync(path.dirname(file), {recursive: true})
    fs.writeFileSync(file, content)
    fs.chmodSync(file, 0o755)
}

executable(
    path.join(bin, 'docker'),
    `#!/bin/sh
case "$1 $2" in
  "buildx inspect") echo "Name:          resolved-builder" ;;
  "buildx history") cat "${history}" 2>/dev/null ;;
esac
`
)
executable(
    path.join(javaHome, 'bin', 'java'),
    `#!/bin/sh
if [ "$1" = "-version" ]; then echo 'openjdk version "21.0.2" 2024-01-16' >&2; exit 0; fi
exec sh -c "$FAKE_AGENT"
`
)

const configuration = {
    develocityUrl: 'https://develocity.example.com',
    accessKey: '',
    projectId: '',
    agentUrl: 'https://agent.example.com/agent.jar',
    packageScanEnabled: false,
    allowUntrustedServer: undefined,
    buildxBuilder: '',
    javaHome,
    shutdownTimeoutSeconds: 1
}

/** The values the last start() saved, as the post step would read them. */
function savedState(): Record<string, string> {
    const state: Record<string, string> = {}
    const pattern = /^(.+?)<<(ghadelimiter_[^\n]+)\n([\s\S]*?)\n\2$/gm
    for (const match of fs.readFileSync(stateFile, 'utf-8').matchAll(pattern)) {
        state[match[1]] = match[3]
    }
    return state
}

function restoreState(state: Record<string, string>): void {
    for (const [name, value] of Object.entries(state)) {
        process.env[`STATE_${name}`] = value
    }
}

function waitForExit(pid: number): void {
    spawnSync('sh', ['-c', `while kill -0 ${pid} 2>/dev/null; do sleep 0.1; done`])
}

describe('Develocity Docker agent lifecycle', () => {
    jest.setTimeout(30000)

    beforeEach(() => {
        process.env['PATH'] = `${bin}${path.delimiter}${process.env['PATH']}`
        process.env['RUNNER_TEMP'] = fixture
        process.env['GITHUB_STATE'] = stateFile
        fs.writeFileSync(stateFile, '')
        fs.writeFileSync(history, '')
        jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
    })

    afterEach(() => {
        for (const pid of started.splice(0)) {
            try {
                process.kill(pid, 'SIGKILL')
            } catch {
                // already gone
            }
        }
        jest.restoreAllMocks()
    })

    it('gives each setup its own log and attaches the agent to the builder resolved at start', async () => {
        process.env['FAKE_AGENT'] = 'echo "BUILDX_BUILDER=$BUILDX_BUILDER"; echo "waiting for builds"; sleep 30'

        await start(configuration)
        const first = savedState()
        fs.writeFileSync(stateFile, '')
        await start(configuration)
        const second = savedState()
        started.push(Number(first['develocity-docker-agent-pid']), Number(second['develocity-docker-agent-pid']))

        expect(first['develocity-docker-agent-log']).not.toBe(second['develocity-docker-agent-log'])
        expect(first['develocity-docker-agent-buildx-builder']).toBe('resolved-builder')
        expect(fs.readFileSync(first['develocity-docker-agent-log'], 'utf-8')).toContain(
            'BUILDX_BUILDER=resolved-builder'
        )
    })

    it('stops waiting as soon as the agent exits before subscribing', async () => {
        process.env['FAKE_AGENT'] = 'echo "bad configuration"; exit 3'
        const startedAt = Date.now()

        await expect(start(configuration)).rejects.toThrow('exited with 3')

        expect(Date.now() - startedAt).toBeLessThan(10000)
        expect(savedState()['develocity-docker-agent-pid']).toBe('')
    })

    it('stops draining once the agent is gone', async () => {
        const agent = spawn('sh', ['-c', 'exit 0'])
        await new Promise(resolve => agent.once('exit', resolve))
        fs.writeFileSync(
            history,
            '{"completed_at":"2026-10-02T12:00:01Z","created_at":"2026-10-02T12:00:00Z","ref":"b/n/new"}\n'
        )
        const log = path.join(fixture, 'dead-agent.log')
        fs.writeFileSync(log, '')
        restoreState({
            'develocity-docker-agent-pid': String(agent.pid),
            'develocity-docker-agent-log': log,
            'develocity-docker-agent-history-baseline': '[]',
            'develocity-docker-agent-buildx-builder': 'resolved-builder'
        })
        const startedAt = Date.now()

        await expect(stop(30, 1)).resolves.toEqual([])

        expect(Date.now() - startedAt).toBeLessThan(5000)
    })

    it('gives the agent longer than its grace period to exit before killing it', async () => {
        const agent = spawn('sh', ['-c', "trap 'sleep 2; exit 0' TERM; while true; do sleep 0.2; done"])
        started.push(agent.pid as number)
        const exit = new Promise<string | null>(resolve => agent.once('exit', (_code, signal) => resolve(signal)))
        const log = path.join(fixture, 'slow-agent.log')
        fs.writeFileSync(log, '')
        restoreState({
            'develocity-docker-agent-pid': String(agent.pid),
            'develocity-docker-agent-log': log,
            'develocity-docker-agent-history-baseline': '[]',
            'develocity-docker-agent-buildx-builder': 'resolved-builder'
        })

        await stop(0, 1)
        waitForExit(agent.pid as number)

        await expect(exit).resolves.toBeNull()
    })
})
