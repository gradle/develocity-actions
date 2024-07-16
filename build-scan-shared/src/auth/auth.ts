import * as core from '@actions/core'

import {getToken} from './short-lived-token'

export const ENV_KEY_DEVELOCITY_ACCESS_KEY = 'DEVELOCITY_ACCESS_KEY'
export const ENV_KEY_GRADLE_ENTERPRISE_ACCESS_KEY = 'GRADLE_ENTERPRISE_ACCESS_KEY'

export async function getAccessToken(
    develocityAccessKeyFomInput: string,
    develocityTokenExpiryFromInput: string
): Promise<string> {
    if (develocityAccessKeyFomInput) {
        try {
            core.debug('Fetching short-lived token...')
            const tokens = await getToken(develocityAccessKeyFomInput, develocityTokenExpiryFromInput)
            if (tokens != null && !tokens.isEmpty()) {
                core.debug(`Got token(s), setting the access key env vars`)
                return tokens.raw()
            } else {
                core.warning(`Failed to fetch short-lived token`)
            }
        } catch (e) {
            core.warning(`Failed to fetch short-lived token, reason: ${e}`)
        }

        core.info(`Falling back to using the access key from the input`)
        return develocityAccessKeyFomInput
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
