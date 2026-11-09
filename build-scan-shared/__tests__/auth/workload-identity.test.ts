import {jest} from '@jest/globals'
import nock from 'nock'

const oidcToken = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJyZXBvOmZvby9iYXIifQ.c2lnbmF0dXJl'

const mockGetIDToken = jest.fn<(audience?: string) => Promise<string>>()
const mockWarning = jest.fn()
const mockInfo = jest.fn()

jest.unstable_mockModule('@actions/core', () => ({
    getIDToken: mockGetIDToken,
    setSecret: jest.fn(),
    warning: mockWarning,
    info: mockInfo,
    debug: jest.fn()
}))

const auth = await import('../../src/auth/auth')

describe('auth with workload identity', () => {
    beforeEach(() => {
        // Remove access keys from environment not to interfere with test results.
        process.env[auth.ENV_KEY_DEVELOCITY_ACCESS_KEY] = ''
        process.env[auth.ENV_KEY_GRADLE_ENTERPRISE_ACCESS_KEY] = ''
        process.env['ACTIONS_ID_TOKEN_REQUEST_URL'] = 'https://oidc.example.com'
        mockGetIDToken.mockResolvedValue(oidcToken)
    })

    afterEach(() => {
        delete process.env['ACTIONS_ID_TOKEN_REQUEST_URL']
        jest.clearAllMocks()
        nock.cleanAll()
    })

    it('Exchanges the GitHub OIDC token for a short-lived token', async () => {
        // given
        nock('https://dev')
            .matchHeader('Authorization', `Bearer ${oidcToken}`)
            .post('/api/auth/token')
            .reply(200, 'token1')

        // when
        const accessToken = await auth.getAccessToken('', '', {develocityUrl: 'https://dev', audience: ''})

        // then
        expect(mockGetIDToken).toHaveBeenCalledWith('https://dev')
        expect(accessToken).toBe('dev=token1')
    })

    it('Requests the GitHub OIDC token for the origin of the Develocity URL by default', async () => {
        // given
        nock('https://dev:8443').post('/api/auth/token').reply(200, 'token1')

        // when
        const accessToken = await auth.getAccessToken('', '', {
            develocityUrl: 'https://dev:8443/develocity/',
            audience: ''
        })

        // then
        expect(mockGetIDToken).toHaveBeenCalledWith('https://dev:8443')
        expect(accessToken).toBe('dev:8443=token1')
    })

    it('Requests the GitHub OIDC token for the configured audience and ignores the access key', async () => {
        // given
        nock('https://dev:8443')
            .matchHeader('Authorization', `Bearer ${oidcToken}`)
            .post('/api/auth/token')
            .reply(200, 'token1')

        // when
        const accessToken = await auth.getAccessToken('dev=key1', '', {
            develocityUrl: 'https://dev:8443',
            audience: 'https://dev:8443/'
        })

        // then
        expect(mockGetIDToken).toHaveBeenCalledWith('https://dev:8443/')
        expect(mockWarning).toHaveBeenCalledWith(
            'Ignoring develocity-access-key as develocity-auth is workload-identity'
        )
        expect(accessToken).toBe('dev:8443=token1')
    })

    it('Points to the workload identity rule when Develocity rejects the GitHub OIDC token', async () => {
        // given
        nock('https://dev').post('/api/auth/token').times(3).reply(500, 'Internal error')

        // when
        const accessToken = await auth.getAccessToken('', '', {develocityUrl: 'https://dev', audience: ''})

        // then
        expect(mockWarning).toHaveBeenCalledWith(
            expect.stringMatching(
                /^No short-lived token could be obtained, running without Develocity authentication\. Check that a workload identity rule .*_services\/token\/actions.*the audience 'https:\/\/dev'/
            )
        )
        expect(accessToken).toBe('')
    })

    it('Runs without authentication when the job has no GitHub OIDC token', async () => {
        // given
        delete process.env['ACTIONS_ID_TOKEN_REQUEST_URL']
        process.env[auth.ENV_KEY_DEVELOCITY_ACCESS_KEY] = 'dev=foo'

        // when
        const accessToken = await auth.getAccessToken('', '', {develocityUrl: 'https://dev', audience: ''})

        // then
        expect(mockGetIDToken).not.toHaveBeenCalled()
        expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining("'id-token: write' permission"))
        expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('pull requests from forks'))
        expect(accessToken).toBe('')
    })

    it('Reports the audience when the GitHub OIDC token cannot be minted', async () => {
        // given
        mockGetIDToken.mockRejectedValue(new Error('Failed to get ID Token'))

        // when
        const accessToken = await auth.getAccessToken('', '', {develocityUrl: 'https://dev', audience: ''})

        // then
        expect(mockWarning).toHaveBeenCalledWith(
            "Failed to get a GitHub OIDC token for audience 'https://dev': Error: Failed to get ID Token"
        )
        expect(accessToken).toBe('')
    })

    it('Does not fall back to the access key when the job has no GitHub OIDC token', async () => {
        // given
        delete process.env['ACTIONS_ID_TOKEN_REQUEST_URL']

        // when
        const accessToken = await auth.getAccessToken('dev=key1', '', {develocityUrl: 'https://dev', audience: ''})

        // then
        expect(mockWarning).toHaveBeenCalledWith(
            'No short-lived token could be obtained, running without Develocity authentication'
        )
        expect(accessToken).toBe('')
    })

    it('Logs the selected credential', async () => {
        // given
        nock('https://dev').post('/api/auth/token').reply(200, 'token1')

        // when
        await auth.getAccessToken('', '', {develocityUrl: 'https://dev', audience: ''})

        // then
        expect(mockInfo).toHaveBeenCalledWith(
            "Authenticating with workload identity, with a GitHub OIDC token for audience 'https://dev'"
        )
    })

    it('Reports an invalid Develocity URL without requesting a GitHub OIDC token', async () => {
        // when
        const accessToken = await auth.getAccessToken('', '', {develocityUrl: 'dev.example.com', audience: ''})

        // then
        expect(mockGetIDToken).not.toHaveBeenCalled()
        expect(mockWarning).toHaveBeenCalledWith(
            "Workload identity requires a valid develocity-url: 'dev.example.com' is not a URL"
        )
        expect(accessToken).toBe('')
    })

    it('Requires an audience when the Develocity URL has no origin', async () => {
        // when
        const accessToken = await auth.getAccessToken('', '', {develocityUrl: 'dev:443', audience: ''})

        // then
        expect(mockGetIDToken).not.toHaveBeenCalled()
        expect(mockWarning).toHaveBeenCalledWith(expect.stringContaining('set develocity-oidc-audience'))
        expect(accessToken).toBe('')
    })

    it('Uses anonymous access when the Develocity URL is not set', async () => {
        // when
        const accessToken = await auth.getAccessToken('', '', {develocityUrl: '', audience: ''})

        // then
        expect(mockGetIDToken).not.toHaveBeenCalled()
        expect(accessToken).toBe('')
    })
})
