import * as core from '@actions/core'

import {getToken} from './short-lived-token'

export const ENV_KEY_DEVELOCITY_ACCESS_KEY = 'DEVELOCITY_ACCESS_KEY'
export const ENV_KEY_GRADLE_ENTERPRISE_ACCESS_KEY = 'GRADLE_ENTERPRISE_ACCESS_KEY'

export interface WorkloadIdentity {
    develocityUrl: string
    audience: string
}

export async function getAccessToken(
    develocityAccessKeyFromInput: string,
    develocityTokenExpiryFromInput: string,
    workloadIdentityFromInput?: WorkloadIdentity
): Promise<string> {
    const accessToken = await resolveAccessToken(
        develocityAccessKeyFromInput,
        develocityTokenExpiryFromInput,
        workloadIdentityFromInput
    )
    maskAccessKey(accessToken)
    return accessToken
}

/**
 * Registers the access key as a secret, so that it is never printed.
 *
 * The runner masks a registered value only where it appears whole. Build tools and agents use the part after
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
 * Use the credential selected by the inputs: the GitHub OIDC token when develocity-auth is workload-identity, the access
 * key otherwise. It is never replaced by another credential: when it cannot be exchanged for a short-lived token, the
 * build runs without authentication.
 */
async function resolveAccessToken(
    develocityAccessKeyFromInput: string,
    develocityTokenExpiryFromInput: string,
    workloadIdentityFromInput?: WorkloadIdentity
): Promise<string> {
    if (workloadIdentityFromInput) {
        if (develocityAccessKeyFromInput) {
            core.warning('Ignoring develocity-access-key as develocity-auth is workload-identity')
        }
        return getWorkloadIdentityAccessToken(workloadIdentityFromInput, develocityTokenExpiryFromInput)
    }
    if (develocityAccessKeyFromInput) {
        core.info('Authenticating with develocity-access-key')
        return exchangeForShortLivedToken(develocityAccessKeyFromInput, develocityTokenExpiryFromInput)
    }
    return getAccessKeyFromEnv()
}

async function exchangeForShortLivedToken(accessKey: string, expiry: string, hint = ''): Promise<string> {
    let reason = ''
    try {
        core.debug('Fetching short-lived token...')
        const tokens = await getToken(accessKey, expiry)
        if (tokens != null && !tokens.isEmpty()) {
            core.debug('Got short-lived token(s)')
            return tokens.raw()
        }
    } catch (e) {
        reason = `, reason: ${e}`
    }
    return runWithoutAuthentication(`${reason}${hint}`)
}

function runWithoutAuthentication(reason = ''): string {
    core.warning(`No short-lived token could be obtained, running without Develocity authentication${reason}`)
    return ''
}

function getAccessKeyFromEnv(): string {
    const develocityAccessKeyFromEnv = process.env[ENV_KEY_DEVELOCITY_ACCESS_KEY]
    if (develocityAccessKeyFromEnv) {
        core.warning(`The ${ENV_KEY_DEVELOCITY_ACCESS_KEY} env var should be mapped to a short-lived token`)
        return develocityAccessKeyFromEnv
    }
    const gradleEnterpriseAccessKeyFromEnv = process.env[ENV_KEY_GRADLE_ENTERPRISE_ACCESS_KEY]
    if (gradleEnterpriseAccessKeyFromEnv) {
        core.warning(`The ${ENV_KEY_GRADLE_ENTERPRISE_ACCESS_KEY} env var is deprecated`)
        return gradleEnterpriseAccessKeyFromEnv
    }

    core.debug('Using anonymous access')
    return ''
}

/**
 * Mint a GitHub OIDC token for the Develocity server, and exchange it for a short-lived token. Develocity accepts it
 * when a workload identity rule matches its issuer, audience and claims. The audience defaults to the origin of the
 * Develocity URL.
 */
async function getWorkloadIdentityAccessToken(workloadIdentity: WorkloadIdentity, expiry: string): Promise<string> {
    let url: URL
    try {
        url = new URL(workloadIdentity.develocityUrl)
    } catch {
        core.warning(
            workloadIdentity.develocityUrl
                ? `Workload identity requires a valid develocity-url: '${workloadIdentity.develocityUrl}' is not a URL`
                : 'Workload identity requires develocity-url to be set'
        )
        return runWithoutAuthentication()
    }
    // The origin of a URL that is not http(s) is the string 'null'
    const audience = workloadIdentity.audience || (url.origin === 'null' ? '' : url.origin)
    if (!audience) {
        core.warning(
            `Workload identity requires an audience: '${workloadIdentity.develocityUrl}' has no origin, set develocity-oidc-audience or use an http(s) develocity-url`
        )
        return runWithoutAuthentication()
    }

    core.info(`Authenticating with workload identity, with a GitHub OIDC token for audience '${audience}'`)
    if (!process.env['ACTIONS_ID_TOKEN_REQUEST_URL']) {
        core.warning(
            "No GitHub OIDC token is available to this job: grant the job the 'id-token: write' permission. GitHub provides " +
                'no OIDC token to pull requests from forks. To use an access key instead, remove develocity-auth: ' +
                'workload-identity and set develocity-access-key.'
        )
        return runWithoutAuthentication()
    }
    let idToken: string
    try {
        idToken = await core.getIDToken(audience)
        core.setSecret(idToken)
    } catch (e) {
        core.warning(`Failed to get a GitHub OIDC token for audience '${audience}': ${e}`)
        return runWithoutAuthentication()
    }

    return exchangeForShortLivedToken(
        `${url.host}=${idToken}`,
        expiry,
        `. Check that a workload identity rule matches the job's issuer (https://token.actions.githubusercontent.com, or ` +
            `https://HOSTNAME/_services/token/actions on GitHub Enterprise Server), the audience '${audience}' and the ` +
            `workflow's claims`
    )
}
