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
    let develocityAccessKey: string
    if (workloadIdentityFromInput) {
        core.info('Authenticating with workload identity')
        if (develocityAccessKeyFromInput) {
            core.warning('Ignoring develocity-access-key as develocity-auth is workload-identity')
        }
        develocityAccessKey = await getWorkloadIdentityAccessKey(workloadIdentityFromInput)
    } else if (develocityAccessKeyFromInput) {
        core.info('Authenticating with develocity-access-key')
        develocityAccessKey = develocityAccessKeyFromInput
    } else {
        return getAccessKeyFromEnv()
    }

    let reason = ''
    if (develocityAccessKey) {
        try {
            core.debug('Fetching short-lived token...')
            const tokens = await getToken(develocityAccessKey, develocityTokenExpiryFromInput)
            if (tokens != null && !tokens.isEmpty()) {
                core.debug('Got short-lived token(s)')
                return tokens.raw()
            }
        } catch (e) {
            reason = `, reason: ${e}`
        }
    }

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
 * Mint a GitHub OIDC token for the Develocity server, in the `host=token` access key format. Develocity exchanges it
 * for an access token when a workload identity rule matches its claims. The token audience has to match the audience
 * of that rule exactly, which defaults to the origin of the Develocity URL.
 */
async function getWorkloadIdentityAccessKey(workloadIdentity: WorkloadIdentity): Promise<string> {
    let url: URL
    try {
        url = new URL(workloadIdentity.develocityUrl)
    } catch {
        core.warning(
            workloadIdentity.develocityUrl
                ? `Workload identity requires a valid develocity-url: '${workloadIdentity.develocityUrl}' is not a URL`
                : 'Workload identity requires develocity-url to be set'
        )
        return ''
    }
    try {
        const idToken = await core.getIDToken(workloadIdentity.audience || url.origin)
        core.setSecret(idToken)
        return `${url.host}=${idToken}`
    } catch (e) {
        core.warning(
            `Failed to get a GitHub OIDC token for workload identity, the job requires the 'id-token: write' permission: ${e}`
        )
        return ''
    }
}
