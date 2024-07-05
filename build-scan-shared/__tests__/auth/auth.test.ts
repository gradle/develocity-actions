import nock from 'nock'

import * as auth from '../../src/auth/auth'

describe('auth', () => {
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

    it('Fall back to Develocity access key when short-lived token retrieval fails', async () => {
        // given
        const fallbackAccessKey = 'dev=foo'
        process.env[auth.ENV_KEY_DEVELOCITY_ACCESS_KEY] = fallbackAccessKey
        const develocityAccessKeyFromInput = 'dev=key1'
        const develocityTokenExpiryFromInput = ''
        nock('http://dev').post('/api/auth/token').times(3).reply(500, 'Internal error')

        // when
        const accessToken = await auth.getAccessToken(develocityAccessKeyFromInput, develocityTokenExpiryFromInput)

        // then
        expect(accessToken).toBe(fallbackAccessKey)
    })

    it('Fall back to Gradle Enterprise access key when short-lived token retrieval fails', async () => {
        // given
        const fallbackAccessKey = 'dev=bar'
        process.env[auth.ENV_KEY_DEVELOCITY_ACCESS_KEY] = ''
        process.env[auth.ENV_KEY_GRADLE_ENTERPRISE_ACCESS_KEY] = fallbackAccessKey
        const develocityAccessKeyFromInput = 'dev=key1'
        const develocityTokenExpiryFromInput = ''
        nock('http://dev').post('/api/auth/token').times(3).reply(500, 'Internal error')

        // when
        const accessToken = await auth.getAccessToken(develocityAccessKeyFromInput, develocityTokenExpiryFromInput)

        // then
        expect(accessToken).toBe(fallbackAccessKey)
    })
})
