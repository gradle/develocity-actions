import {jest} from '@jest/globals'
import fs from 'fs'
import os from 'os'
import path from 'path'

process.env['RUNNER_TEMP'] = '/tmp'

const {
    agentEnvironment,
    buildOutcomes,
    isZombie,
    maskAccessKey,
    newBuilds,
    parseBuilderName,
    parseHistoryBaseline,
    parseHistoryRecords,
    parseMajorVersion,
    publishedScans,
    readLog,
    resolveJavaExecutable
} = await import('../src/agent')

type HistoryRecord = {ref: string; createdAt: string; completed: boolean}

/** Writes a fake JDK whose `java -version` writes to stderr, as most real JDKs do. */
function fakeJdk(versionOutput: string): string {
    const javaHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-docker-jdk-'))
    fs.mkdirSync(path.join(javaHome, 'bin'))
    const java = path.join(javaHome, 'bin', 'java')
    fs.writeFileSync(java, `#!/bin/sh\ncat >&2 <<'EOF'\n${versionOutput}\nEOF\n`)
    fs.chmodSync(java, 0o755)
    return javaHome
}

function record(ref: string, createdAt: string, completed = true): HistoryRecord {
    return {ref, createdAt, completed}
}

/** Lists `all` the way buildx 0.23 and later does: running records first, at most 50 completed ones, filtered. */
function cappedListing(all: HistoryRecord[]): {list: (filters: string[]) => HistoryRecord[]; calls: string[][]} {
    const calls: string[][] = []
    const list = (filters: string[]): HistoryRecord[] => {
        calls.push(filters)
        const before = filters.find(filter => filter.startsWith('startedAt<'))?.replace('startedAt<', '')
        const excluded = filters.filter(filter => filter.startsWith('ref!=')).map(filter => filter.replace('ref!=', ''))
        const matching = all.filter(
            entry =>
                (!before || Math.floor(Date.parse(entry.createdAt) / 1000) < Date.parse(before) / 1000) &&
                !excluded.includes(entry.ref)
        )
        return [
            ...matching.filter(entry => !entry.completed),
            ...matching.filter(entry => entry.completed).slice(0, 50)
        ]
    }
    return {list, calls}
}

const configuration = {
    develocityUrl: 'https://develocity.example.com',
    accessKey: 'develocity.example.com=short-lived',
    projectId: '',
    agentUrl: 'https://agent.example.com/agent.jar',
    packageScanEnabled: true,
    allowUntrustedServer: undefined,
    buildxBuilder: '',
    javaHome: '',
    shutdownTimeoutSeconds: 120
}

describe('Develocity Docker agent', () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    describe('parseMajorVersion', () => {
        it('reads a modern version', () => {
            expect(parseMajorVersion('openjdk version "21.0.2" 2024-01-16')).toBe(21)
        })

        it('reads a pre-9 version', () => {
            expect(parseMajorVersion('java version "1.8.0_392"')).toBe(8)
        })

        it('returns 0 when the output is not recognised', () => {
            expect(parseMajorVersion('command not found')).toBe(0)
        })
    })

    describe('publishedScans', () => {
        it('extracts every scan url, in either wording the agent uses', () => {
            const log = [
                '12:00:00 INFO subscribed to BuildKit, waiting for builds',
                '12:00:10 INFO scan published: https://develocity.example.com/s/aaaaaaaaaaaaa',
                '12:00:20 INFO scanned sha256:abc in 900 ms: 12 packages',
                '12:00:30 INFO Build Scan published to Develocity: https://develocity.example.com/s/bbbbbbbbbbbbb'
            ].join('\n')

            expect(publishedScans(log)).toEqual([
                'https://develocity.example.com/s/aaaaaaaaaaaaa',
                'https://develocity.example.com/s/bbbbbbbbbbbbb'
            ])
        })

        it('returns nothing when no scan was published', () => {
            expect(publishedScans('12:00:00 INFO waiting for builds')).toEqual([])
        })
    })

    describe('buildOutcomes', () => {
        it('counts published scans and the expected builds that were not published', () => {
            const log = [
                'INFO scan published: https://develocity.example.com/s/aaaaaaaaaaaaa',
                'ERROR failed to publish scan for ref=ref2',
                'ERROR build history consumer failed on type=COMPLETE ref=ref3'
            ].join('\n')

            expect(buildOutcomes(log, new Set(['ref1', 'ref2', 'ref3']))).toEqual({
                published: 1,
                notPublished: 2,
                settled: 3
            })
        })

        it('ignores builds that are not expected', () => {
            const log = [
                'INFO ignoring build created before the agent started at 2026-10-02T12:00:00Z (ref=old)',
                'ERROR failed to publish scan for ref=other'
            ].join('\n')

            expect(buildOutcomes(log, new Set(['new'])).settled).toBe(0)
        })

        it('counts an expected build the agent ignored', () => {
            const log = 'INFO ignoring build created before the agent started at 2026-10-02T12:00:00Z (ref=new)'

            expect(buildOutcomes(log, new Set(['new'])).settled).toBe(1)
        })

        it('does not count a failure on a non-final event', () => {
            const log = 'ERROR build history consumer failed on type=STARTED ref=new'

            expect(buildOutcomes(log, new Set(['new'])).settled).toBe(0)
        })
    })

    describe('readLog', () => {
        it('returns an empty string rather than throwing when the log is missing', () => {
            expect(readLog('/does/not/exist.log')).toBe('')
        })
    })

    describe('maskAccessKey', () => {
        it('masks the whole value and every per-host key in it', () => {
            const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)

            maskAccessKey('host1.example.com=key1;host2.example.com=key2')

            const masked = write.mock.calls.map(call => String(call[0]).trim())
            expect(masked).toEqual([
                '::add-mask::host1.example.com=key1;host2.example.com=key2',
                '::add-mask::key1',
                '::add-mask::key2'
            ])
        })

        it('masks nothing when there is no key', () => {
            const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)

            maskAccessKey('')

            expect(write).not.toHaveBeenCalled()
        })
    })

    describe('agentEnvironment', () => {
        it('leaves out the step inputs and the credentials only JavaScript actions get', () => {
            const environment = agentEnvironment(
                {
                    'INPUT_DEVELOCITY-ACCESS-KEY': 'long-lived',
                    ACTIONS_RUNTIME_TOKEN: 'runtime-token',
                    ACTIONS_RUNTIME_URL: 'https://runtime',
                    ACTIONS_CACHE_URL: 'https://cache',
                    ACTIONS_RESULTS_URL: 'https://results',
                    PATH: '/usr/bin',
                    HOME: '/home/runner',
                    DOCKER_HOST: 'unix:///var/run/docker.sock',
                    GITHUB_ACTIONS: 'true',
                    RUNNER_TRACKING_ID: 'github_1234'
                },
                configuration
            )

            expect(environment).not.toHaveProperty('INPUT_DEVELOCITY-ACCESS-KEY')
            expect(environment).not.toHaveProperty('ACTIONS_RUNTIME_TOKEN')
            expect(environment).not.toHaveProperty('ACTIONS_RUNTIME_URL')
            expect(environment).not.toHaveProperty('ACTIONS_CACHE_URL')
            expect(environment).not.toHaveProperty('ACTIONS_RESULTS_URL')
            expect(environment).toMatchObject({
                PATH: '/usr/bin',
                HOME: '/home/runner',
                DOCKER_HOST: 'unix:///var/run/docker.sock',
                GITHUB_ACTIONS: 'true',
                RUNNER_TRACKING_ID: 'github_1234',
                DEVELOCITY_URL: 'https://develocity.example.com',
                DEVELOCITY_ACCESS_KEY: 'develocity.example.com=short-lived',
                DEVELOCITY_DOCKER_PACKAGE_SCAN_ENABLED: 'true',
                DEVELOCITY_DOCKER_AGENT_SHUTDOWN_GRACE_PERIOD_SECONDS: '120'
            })
        })

        it('lets the allow-untrusted input override the step environment', () => {
            const environment = agentEnvironment(
                {DEVELOCITY_ALLOW_UNTRUSTED_SERVER: 'true'},
                {...configuration, allowUntrustedServer: false}
            )

            expect(environment['DEVELOCITY_ALLOW_UNTRUSTED_SERVER']).toBe('false')
        })

        it('keeps the step environment when allow-untrusted is not set', () => {
            const environment = agentEnvironment({DEVELOCITY_ALLOW_UNTRUSTED_SERVER: 'true'}, configuration)

            expect(environment['DEVELOCITY_ALLOW_UNTRUSTED_SERVER']).toBe('true')
        })

        it('caps the grace period at the most the agent accepts', () => {
            const environment = agentEnvironment({}, {...configuration, shutdownTimeoutSeconds: 7200})

            expect(environment['DEVELOCITY_DOCKER_AGENT_SHUTDOWN_GRACE_PERIOD_SECONDS']).toBe('3600')
        })

        it('sets the builder and project id only when they have a value', () => {
            expect(agentEnvironment({}, configuration)).not.toHaveProperty('BUILDX_BUILDER')
            expect(agentEnvironment({}, configuration)).not.toHaveProperty('DEVELOCITY_PROJECT_ID')
            expect(agentEnvironment({}, {...configuration, buildxBuilder: 'kafka-builder'})).toHaveProperty(
                'BUILDX_BUILDER',
                'kafka-builder'
            )
        })
    })

    describe('resolveJavaExecutable', () => {
        it('accepts a JDK that reports its version on stderr', async () => {
            const javaHome = fakeJdk('openjdk version "21.0.2" 2024-01-16')

            await expect(resolveJavaExecutable(javaHome)).resolves.toBe(path.join(javaHome, 'bin', 'java'))
        })

        it('warns and looks further when the configured JDK is too old', async () => {
            const tooOld = fakeJdk('openjdk version "17.0.2" 2022-01-18')
            const runnerJdk = fakeJdk('openjdk version "21.0.2" 2024-01-16')
            process.env['JAVA_HOME_21_X64'] = runnerJdk
            const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)

            try {
                await expect(resolveJavaExecutable(tooOld)).resolves.toBe(path.join(runnerJdk, 'bin', 'java'))
                expect(write.mock.calls.map(call => String(call[0]))).toContainEqual(
                    expect.stringContaining('::warning::')
                )
            } finally {
                delete process.env['JAVA_HOME_21_X64']
            }
        })

        it('prefers a runner JDK exposed through JAVA_HOME_<version>_<arch>', async () => {
            const javaHome = fakeJdk('openjdk version "21.0.2" 2024-01-16')
            process.env['JAVA_HOME_21_X64'] = javaHome

            try {
                await expect(resolveJavaExecutable('')).resolves.toBe(path.join(javaHome, 'bin', 'java'))
            } finally {
                delete process.env['JAVA_HOME_21_X64']
            }
        })
    })

    describe('parseBuilderName', () => {
        it('reads the name docker buildx inspect reports', () => {
            const output = [
                'Name:          desktop-linux',
                'Driver:        docker',
                '',
                'Nodes:',
                'Name: desktop-linux'
            ]

            expect(parseBuilderName(output.join('\n'))).toBe('desktop-linux')
        })

        it('returns undefined for unexpected output', () => {
            expect(parseBuilderName('ERROR: no builder')).toBeUndefined()
        })
    })

    describe('parseHistoryRecords', () => {
        it('reads the JSON lines and strips the builder and node from each ref', () => {
            const output = [
                '{"created_at":"2026-10-02T13:31:29.252562125Z","name":"a","ref":"default/default/ref2"}',
                '{"completed_at":"2026-10-02T13:30:01Z","created_at":"2026-10-02T13:30:00.1Z","ref":"default/default/ref1"}',
                ''
            ].join('\n')

            expect(parseHistoryRecords(output)).toEqual([
                record('ref2', '2026-10-02T13:31:29.252562125Z', false),
                record('ref1', '2026-10-02T13:30:00.1Z')
            ])
        })

        it('returns nothing for empty output', () => {
            expect(parseHistoryRecords('')).toEqual([])
        })
    })

    describe('parseHistoryBaseline', () => {
        it('reads the saved refs', () => {
            expect(parseHistoryBaseline('["ref1","ref2"]')).toEqual(new Set(['ref1', 'ref2']))
        })

        it('keeps an empty history apart from an unknown one', () => {
            expect(parseHistoryBaseline('[]')).toEqual(new Set())
            expect(parseHistoryBaseline('')).toBeUndefined()
        })
    })

    describe('newBuilds', () => {
        it('stops at the first completed record that was there before the agent started', () => {
            const list = jest.fn((): HistoryRecord[] => [
                record('new2', '2026-10-02T12:00:02Z'),
                record('new1', '2026-10-02T12:00:01Z'),
                record('old', '2026-10-02T11:00:00Z')
            ])

            expect(newBuilds(list, new Set(['old']))).toEqual(new Set(['new2', 'new1']))
            expect(list).toHaveBeenCalledTimes(1)
        })

        it('looks past a build from before the agent that is still running', () => {
            const list = (): HistoryRecord[] => [
                record('slow', '2026-10-02T11:59:00Z', false),
                record('new2', '2026-10-02T12:00:02Z'),
                record('new1', '2026-10-02T12:00:01Z'),
                record('old', '2026-10-02T11:00:00Z')
            ]

            expect(newBuilds(list, new Set(['slow', 'old']))).toEqual(new Set(['new2', 'new1']))
        })

        it('counts everything when the history was empty', () => {
            const list = (): HistoryRecord[] => [record('new1', '2026-10-02T12:00:01Z')]

            expect(newBuilds(list, new Set())).toEqual(new Set(['new1']))
        })

        it('pages past the 50 records a listing holds', () => {
            const all = Array.from({length: 55}, (_, index) =>
                record(`ref${54 - index}`, new Date(Date.UTC(2026, 9, 2, 12, 0, 54 - index)).toISOString())
            )
            const {list, calls} = cappedListing(all)

            expect(newBuilds(list, new Set()).size).toBe(55)
            expect(calls).toEqual([[], ['startedAt<2026-10-02T12:00:06Z', 'ref!=ref5']])
        })

        it('pages through more than 50 builds started in the same second', () => {
            const all = Array.from({length: 120}, (_, index) => record(`ref${index}`, '2026-10-02T12:00:00.5Z'))
            const {list} = cappedListing(all)

            expect(newBuilds(list, new Set()).size).toBe(120)
        })

        it('takes a listing longer than the limit as complete, as buildx before 0.23 lists', () => {
            const all = Array.from({length: 60}, (_, index) => record(`ref${index}`, '2026-10-02T12:00:00Z'))
            const list = jest.fn((): HistoryRecord[] => all)

            expect(newBuilds(list, new Set()).size).toBe(60)
            expect(list).toHaveBeenCalledTimes(1)
        })

        it('keeps the first page when the listing takes no filter, as buildx before 0.23 does', () => {
            const all = Array.from({length: 50}, (_, index) => record(`ref${index}`, '2026-10-02T12:00:00Z'))
            const list = (filters: string[]): HistoryRecord[] => {
                if (filters.length > 0) {
                    throw new Error('unknown flag: --filter')
                }
                return all
            }

            expect(newBuilds(list, new Set()).size).toBe(50)
        })

        it('fails when the first page cannot be read', () => {
            const list = (): HistoryRecord[] => {
                throw new Error('unknown command: history')
            }

            expect(() => newBuilds(list, new Set())).toThrow('unknown command')
        })
    })

    describe('isZombie', () => {
        it('detects a process that exited but was not reaped', () => {
            expect(isZombie('1234 (java) Z 1 1234 1234 0 -1 4194560')).toBe(true)
        })

        it('reads the state after a command name that contains spaces and parentheses', () => {
            expect(isZombie('1234 (my (odd) cmd) S 1 1234 1234 0 -1 4194560')).toBe(false)
        })

        it('treats a missing stat as alive, as on macOS', () => {
            expect(isZombie('')).toBe(false)
        })
    })
})
