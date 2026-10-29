import * as core from '@actions/core'

import {getToken} from './short-lived-token'

export const ENV_KEY_DEVELOCITY_ACCESS_KEY = 'DEVELOCITY_ACCESS_KEY'
export const ENV_KEY_GRADLE_ENTERPRISE_ACCESS_KEY = 'GRADLE_ENTERPRISE_ACCESS_KEY'

export interface WorkloadIdentity {
    develocityUrl: string
    audience: string
}

export async function getAccessToken(
    develocityAccessKeyFomInput: string,
    develocityTokenExpiryFromInput: string,
    workloadIdentity?: WorkloadIdentity
): Promise<string> {
    let develocityAccessKey = develocityAccessKeyFomInput
    if (workloadIdentity) {
        if (develocityAccessKey) {
            core.warning('Ignoring develocity-access-key as workload identity is enabled')
        }
        develocityAccessKey = await getWorkloadIdentityAccessKey(workloadIdentity)
    }

    if (develocityAccessKey) {
        try {
            core.debug('Fetching short-lived token...')
            const tokens = await getToken(develocityAccessKey, develocityTokenExpiryFromInput)
            if (tokens != null && !tokens.isEmpty()) {
                core.debug(`Got token(s), setting the access key env vars`)
                return tokens.raw()
            } else {
                core.warning(`Failed to fetch short-lived token`)
            }
        } catch (e) {
            core.warning(`Failed to fetch short-lived token, reason: ${e}`)
        }

        if (workloadIdentity) {
            core.warning(`Falling back to using the GitHub OIDC token, which expires within minutes`)
        } else {
            core.info(`Falling back to using the access key from the input`)
        }
        return develocityAccessKey
    }

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
 * of that rule exactly.
 */
async function getWorkloadIdentityAccessKey(workloadIdentity: WorkloadIdentity): Promise<string> {
    if (!workloadIdentity.develocityUrl) {
        core.warning('Workload identity requires develocity-url to be set')
        return ''
    }
    try {
        const host = new URL(workloadIdentity.develocityUrl).host
        const idToken = await core.getIDToken(workloadIdentity.audience || workloadIdentity.develocityUrl)
        core.setSecret(idToken)
        return `${host}=${idToken}`
    } catch (e) {
        core.warning(
            `Failed to get a GitHub OIDC token for workload identity, the job requires the 'id-token: write' permission: ${e}`
        )
        return ''
    }
}
