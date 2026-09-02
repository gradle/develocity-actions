import {jest} from '@jest/globals'

import {DevelocityAccessCredentials} from '../../src/auth/short-lived-token'

describe('access key parsing', () => {
    it('parse valid access key should return an object', async () => {
        // when
        const develocityAccessCredentials = DevelocityAccessCredentials.parse('some-host.local=key1;host2=key2')

        // then
        expect(develocityAccessCredentials).toStrictEqual(
            DevelocityAccessCredentials.of([
                {hostname: 'some-host.local', key: 'key1'},
                {hostname: 'host2', key: 'key2'}
            ])
        )
    })

    it('parse access key with an OIDC token value should return an object', async () => {
        // given
        const oidcToken = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJyZXBvOmZvby9iYXI_-x=.c2lnbmF0dXJl=='

        // when
        const develocityAccessCredentials = DevelocityAccessCredentials.parse(`some-host.local=${oidcToken}`)

        // then
        expect(develocityAccessCredentials).toStrictEqual(
            DevelocityAccessCredentials.of([{hostname: 'some-host.local', key: oidcToken}])
        )
    })

    it('parse access key splits each entry on the first separator only', async () => {
        // when
        const develocityAccessCredentials = DevelocityAccessCredentials.parse('host1=a=b==;host2=c=d')

        // then
        expect(develocityAccessCredentials).toStrictEqual(
            DevelocityAccessCredentials.of([
                {hostname: 'host1', key: 'a=b=='},
                {hostname: 'host2', key: 'c=d'}
            ])
        )
    })

    it('parse access key tolerates surrounding whitespace', async () => {
        // when
        const develocityAccessCredentials = DevelocityAccessCredentials.parse(' host1=key1\n')

        // then
        expect(develocityAccessCredentials).toStrictEqual(
            DevelocityAccessCredentials.of([{hostname: 'host1', key: 'key1'}])
        )
    })

    it('access key with an OIDC token value as raw string', async () => {
        // given
        const rawKey = 'host1=eyJhbGciOiJSUzI1NiJ9.payload.signature==;host2=key2'

        // when
        const develocityAccessCredentials = DevelocityAccessCredentials.parse(rawKey)

        // then
        expect(develocityAccessCredentials?.raw()).toBe(rawKey)
    })

    it.each([
        ['empty', ''],
        ['blank', '  '],
        ['no separator', 'host1'],
        ['a trailing separator', 'host1=key1;'],
        ['a leading separator', ';host1=key1'],
        ['an empty hostname', '=key1'],
        ['an empty key', 'host1='],
        ['whitespace in the hostname', 'ho st1=key1'],
        ['whitespace in the key', 'host1=ke y1'],
        ['whitespace around a separator', 'host1=key1; host2=key2'],
        ['one invalid entry', 'host1=key1;random']
    ])('parse access key with %s should return null', async (_description, rawKey) => {
        // expect
        expect(DevelocityAccessCredentials.parse(rawKey)).toBeNull()
    })
})

describe('access key format warnings', () => {
    // `core.warning` is an ESM export and cannot be spied on, so capture the workflow command it
    // writes to stdout instead.
    let stdout: jest.SpiedFunction<typeof process.stdout.write>

    const warnings = (): string[] =>
        stdout.mock.calls
            .map(call => String(call[0]))
            .filter(line => line.startsWith('::warning::'))
            .map(line => line.substring('::warning::'.length).trim())

    beforeEach(() => {
        stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
    })

    afterEach(() => {
        stdout.mockRestore()
    })

    it.each([
        ['no separator', 'host1', "no '=' separator in the value"],
        ['a trailing separator', 'host1=key1;', "no '=' separator in entry 2 of 2"],
        ['a leading separator', ';host1=key1', "no '=' separator in entry 1 of 2"],
        ['an empty hostname', '=key1', 'empty server name in the value'],
        ['an empty key', 'host1=', 'empty key in the value'],
        ['whitespace in the hostname', 'ho st1=key1', 'whitespace in the server name in the value'],
        ['whitespace in the key', 'host1=ke y1', 'whitespace in the key in the value'],
        ['whitespace around a separator', 'host1=key1; host2=key2', 'whitespace in the server name in entry 2 of 2']
    ])('warns about %s', (_description, rawKey, expectedReason) => {
        // when
        expect(DevelocityAccessCredentials.parse(rawKey)).toBeNull()

        // then
        expect(warnings()).toEqual([
            `Ignoring badly formed Develocity access key: ${expectedReason}. The expected format is 'server=key[;server=key]*'.`
        ])
    })

    it('never includes any part of the access key value in the warning', () => {
        // when
        expect(DevelocityAccessCredentials.parse('my-host=my sec ret')).toBeNull()

        // then
        const message = warnings()[0]
        expect(message).not.toContain('my-host')
        expect(message).not.toContain('sec')
    })

    it('does not warn for a valid access key', () => {
        // when
        expect(DevelocityAccessCredentials.parse('host1=key1;host2=key2')).not.toBeNull()

        // then
        expect(warnings()).toEqual([])
    })

    it('does not warn for an empty access key', () => {
        // when
        expect(DevelocityAccessCredentials.parse('  ')).toBeNull()

        // then
        expect(warnings()).toEqual([])
    })
})
