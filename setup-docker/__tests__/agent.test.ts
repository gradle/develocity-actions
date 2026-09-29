import {countHistoryRecords, parseJavaMajorVersion, publishedScanUrls} from '../src/agent'

describe('Develocity Docker agent', () => {
    it('parses the Java major version', () => {
        expect(parseJavaMajorVersion('openjdk version "21.0.4" 2024-07-16 LTS')).toBe(21)
        expect(parseJavaMajorVersion('java version "1.8.0_412"')).toBe(1)
        expect(parseJavaMajorVersion('garbage')).toBe(0)
    })

    it('counts BuildKit history records without the header', () => {
        const output = [
            'BUILD ID                    NAME        STATUS     CREATED AT     DURATION',
            'qu2gsuo8ejqrwdfii23xkkckt   foo         Completed  3 minutes ago  1.4s',
            'qsiifiuf1ad9pa9qvppc0z1l3   bar         Completed  5 minutes ago  0.9s',
            ''
        ].join('\n')

        expect(countHistoryRecords(output)).toBe(2)
        expect(countHistoryRecords('BUILD ID   NAME   STATUS\n')).toBe(0)
    })

    it('extracts published Build Scan URLs from the agent log', () => {
        const log = [
            '12:00:00 INFO waiting for builds',
            '12:00:05 INFO scan published: https://develocity.example.com/s/abc',
            '12:00:06 DEBUG SO_KEEPALIVE',
            '12:00:09 INFO scan published: https://develocity.example.com/s/def'
        ].join('\n')

        expect(publishedScanUrls(log)).toEqual([
            'https://develocity.example.com/s/abc',
            'https://develocity.example.com/s/def'
        ])
    })
})
