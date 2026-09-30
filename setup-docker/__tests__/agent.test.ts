import {jest} from '@jest/globals'
import fs from 'fs'
import os from 'os'
import path from 'path'

process.env['RUNNER_TEMP'] = '/tmp'

const {countHistoryRecords, parseMajorVersion, publishedScans, readLog, resolveJavaExecutable} =
    await import('../src/agent')

/** Writes a fake JDK whose `java -version` writes to stderr, as most real JDKs do. */
function fakeJdk(versionOutput: string): string {
    const javaHome = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-docker-jdk-'))
    fs.mkdirSync(path.join(javaHome, 'bin'))
    const java = path.join(javaHome, 'bin', 'java')
    fs.writeFileSync(java, `#!/bin/sh\ncat >&2 <<'EOF'\n${versionOutput}\nEOF\n`)
    fs.chmodSync(java, 0o755)
    return javaHome
}

function writeLog(content: string): string {
    const logFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dv-docker-')), 'agent.log')
    fs.writeFileSync(logFile, content)
    return logFile
}

describe('Develocity Docker agent', () => {
    afterEach(() => {
        jest.clearAllMocks()
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
        it('extracts every scan url', () => {
            const logFile = writeLog(
                [
                    '12:00:00 INFO subscribed to BuildKit, waiting for builds',
                    '12:00:10 INFO scan published: https://develocity.example.com/s/aaaaaaaaaaaaa',
                    '12:00:20 INFO scanned sha256:abc in 900 ms: 12 packages',
                    '12:00:30 INFO scan published: https://develocity.example.com/s/bbbbbbbbbbbbb'
                ].join('\n')
            )

            expect(publishedScans(logFile)).toEqual([
                'https://develocity.example.com/s/aaaaaaaaaaaaa',
                'https://develocity.example.com/s/bbbbbbbbbbbbb'
            ])
        })

        it('returns nothing when no scan was published', () => {
            expect(publishedScans(writeLog('12:00:00 INFO waiting for builds'))).toEqual([])
        })

        it('returns nothing when the log is missing', () => {
            expect(publishedScans('/does/not/exist.log')).toEqual([])
        })
    })

    describe('readLog', () => {
        it('returns an empty string rather than throwing when the log is missing', () => {
            expect(readLog('/does/not/exist.log')).toBe('')
        })
    })

    describe('resolveJavaExecutable', () => {
        it('accepts a JDK that reports its version on stderr', async () => {
            const javaHome = fakeJdk('openjdk version "21.0.2" 2024-01-16')

            await expect(resolveJavaExecutable(javaHome)).resolves.toBe(path.join(javaHome, 'bin', 'java'))
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

    describe('countHistoryRecords', () => {
        const header = 'BUILD ID                    NAME                 STATUS      CREATED AT'

        it('ignores the header line', () => {
            expect(countHistoryRecords(header)).toBe(0)
        })

        it('counts one record per build', () => {
            const output = [
                header,
                'z4p67fe9d75ega8n3zxflxlun   ctx/Dockerfile.1     Completed   2 minutes ago',
                'lj2ubzeseotzt7krdltcrvv5a   ctx/Dockerfile.2     Completed   1 minute ago'
            ].join('\n')

            expect(countHistoryRecords(output)).toBe(2)
        })

        it('ignores trailing blank lines', () => {
            expect(countHistoryRecords(`${header}\nid1  ctx  Completed  now\n\n`)).toBe(1)
        })

        it('returns 0 for empty output', () => {
            expect(countHistoryRecords('')).toBe(0)
        })
    })
})
