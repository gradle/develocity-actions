import {jest} from '@jest/globals'
import nock from 'nock'

import * as auth from '../../src/auth/auth'

describe('auth', () => {
    beforeEach(() => {
        // Remove access keys from environment not to interfere with test results.
        process.env[auth.ENV_KEY_DEVELOCITY_ACCESS_KEY] = ''
        process.env[auth.ENV_KEY_GRADLE_ENTERPRISE_ACCESS_KEY] = ''
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    it('Using anonymous mode succeeds', async () => {
        // given
        const develocityAccessKeyFromInput = ''
        const develocityTokenExpiryFromInput = ''

        // when
        const accessToken = await auth.getAccessToken(develocityAccessKeyFromInput, develocityTokenExpiryFromInput)

        // then
        expect(accessToken).toBe('')
    })

    it('Get access key with short-lived token succeeds', async () => {
        // given
        const develocityAccessKeyFromInput = 'dev=key1'
        const develocityTokenExpiryFromInput = ''
        nock('https://dev').post('/api/auth/token').reply(200, 'token1')

        // when
        const accessToken = await auth.getAccessToken(develocityAccessKeyFromInput, develocityTokenExpiryFromInput)

        // then
        expect(accessToken).toBe('dev=token1')
    })

    it('Get access key with short-lived token succeeds when the access key holds an OIDC token', async () => {
        // given
        const oidcToken = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJyZXBvOmZvby9iYXIifQ.c2lnbmF0dXJl_-=='
        const develocityAccessKeyFromInput = `dev=${oidcToken}`
        const develocityTokenExpiryFromInput = ''
        nock('https://dev')
            .matchHeader('Authorization', `Bearer ${oidcToken}`)
            .post('/api/auth/token')
            .reply(200, 'token1')

        // when
        const accessToken = await auth.getAccessToken(develocityAccessKeyFromInput, develocityTokenExpiryFromInput)

        // then
        expect(accessToken).toBe('dev=token1')
    })

    it('Does not use the Develocity access key when short-lived token retrieval fails', async () => {
        // given
        const develocityAccessKeyFromInput = 'dev=key1'
        const develocityTokenExpiryFromInput = ''
        nock('https://dev').post('/api/auth/token').times(3).reply(500, 'Internal error')

        // when
        const accessToken = await auth.getAccessToken(develocityAccessKeyFromInput, develocityTokenExpiryFromInput)

        // then
        expect(accessToken).toBe('')
    })

    it('Does not use the access key from the environment when short-lived token retrieval fails', async () => {
        // given
        process.env[auth.ENV_KEY_DEVELOCITY_ACCESS_KEY] = 'dev=foo'
        nock('https://dev').post('/api/auth/token').times(3).reply(500, 'Internal error')

        // when
        const accessToken = await auth.getAccessToken('dev=key1', '')

        // then
        expect(accessToken).toBe('')
    })

    it('Runs without authentication when the access key is badly formed', async () => {
        // given
        process.env[auth.ENV_KEY_DEVELOCITY_ACCESS_KEY] = 'dev=foo'

        // when
        const accessToken = await auth.getAccessToken('key-without-host', '')

        // then
        expect(accessToken).toBe('')
    })

    it('Fall back to Develocity access key when no access key is provided as input', async () => {
        // given
        const fallbackAccessKey = 'dev=foo'
        process.env[auth.ENV_KEY_DEVELOCITY_ACCESS_KEY] = fallbackAccessKey
        const develocityAccessKeyFromInput = ''
        const develocityTokenExpiryFromInput = ''
        nock('http://dev').post('/api/auth/token').times(3).reply(500, 'Internal error')

        // when
        const accessToken = await auth.getAccessToken(develocityAccessKeyFromInput, develocityTokenExpiryFromInput)

        // then
        expect(accessToken).toBe(fallbackAccessKey)
    })

    it('Fall back to Gradle Enterprise access key when no access key is provided as input', async () => {
        // given
        const fallbackAccessKey = 'dev=bar'
        process.env[auth.ENV_KEY_DEVELOCITY_ACCESS_KEY] = ''
        process.env[auth.ENV_KEY_GRADLE_ENTERPRISE_ACCESS_KEY] = fallbackAccessKey
        const develocityAccessKeyFromInput = ''
        const develocityTokenExpiryFromInput = ''
        nock('http://dev').post('/api/auth/token').times(3).reply(500, 'Internal error')

        // when
        const accessToken = await auth.getAccessToken(develocityAccessKeyFromInput, develocityTokenExpiryFromInput)

        // then
        expect(accessToken).toBe(fallbackAccessKey)
    })

    it('Masks the short-lived token of each server', async () => {
        // given
        const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
        nock('https://dev1').post('/api/auth/token').reply(200, 'token1')
        nock('https://dev2').post('/api/auth/token').reply(200, 'token2')

        // when
        const accessToken = await auth.getAccessToken('dev1=key1;dev2=key2', '')

        // then
        const masked = write.mock.calls
            .map(call => String(call[0]).trim())
            .filter(line => line.startsWith('::add-mask::'))
        write.mockRestore()
        expect(accessToken).toBe('dev1=token1;dev2=token2')
        expect(masked).toEqual(['::add-mask::dev1=token1;dev2=token2', '::add-mask::token1', '::add-mask::token2'])
    })

    describe('maskAccessKey', () => {
        it('masks the whole value and every per-host key in it', () => {
            const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)

            auth.maskAccessKey('host1.example.com=key1;host2.example.com=key2')

            const masked = write.mock.calls.map(call => String(call[0]).trim())
            write.mockRestore()
            expect(masked).toEqual([
                '::add-mask::host1.example.com=key1;host2.example.com=key2',
                '::add-mask::key1',
                '::add-mask::key2'
            ])
        })

        it('masks nothing when there is no key', () => {
            const write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true)

            auth.maskAccessKey('')

            expect(write).not.toHaveBeenCalled()
            write.mockRestore()
        })
    })
})
