import * as input from '../../src/setup/input'

describe('develocity-auth input', () => {
    beforeEach(() => {
        process.env['INPUT_DEVELOCITY-URL'] = 'https://dev'
        process.env['INPUT_DEVELOCITY-WORKLOAD-IDENTITY-AUDIENCE'] = ''
    })

    afterEach(() => {
        delete process.env['INPUT_DEVELOCITY-AUTH']
        delete process.env['INPUT_DEVELOCITY-URL']
        delete process.env['INPUT_DEVELOCITY-WORKLOAD-IDENTITY-AUDIENCE']
    })

    it('uses the access key by default', () => {
        expect(input.getWorkloadIdentity()).toBeUndefined()
    })

    it('uses the access key when access-key is selected', () => {
        process.env['INPUT_DEVELOCITY-AUTH'] = 'access-key'

        expect(input.getWorkloadIdentity()).toBeUndefined()
    })

    it('uses workload identity when workload-identity is selected', () => {
        process.env['INPUT_DEVELOCITY-AUTH'] = 'workload-identity'

        expect(input.getWorkloadIdentity()).toEqual({develocityUrl: 'https://dev', audience: ''})
    })

    it('rejects an unsupported value', () => {
        process.env['INPUT_DEVELOCITY-AUTH'] = 'oidc'

        expect(() => input.getWorkloadIdentity()).toThrow(
            "Unsupported develocity-auth 'oidc'. Valid values are: [access-key, workload-identity]"
        )
    })
})
