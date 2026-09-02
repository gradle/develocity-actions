import * as httpm from 'typed-rest-client/HttpClient'
import * as core from '@actions/core'

// MODIFICATIONS START HERE
// This file is copied from https://github.com/gradle/actions/blob/main/sources/src/develocity/short-lived-token.ts
// and trimmed to fit the needs of this project
//
// import {BuildScanConfig} from '../configuration'
// import {recordDeprecation} from '../deprecation-collector'

// export async function setupToken(develocityAccessKey: string, develocityTokenExpiry: string): Promise<void> {
//     if (develocityAccessKey) {
//         try {
//             core.debug('Fetching short-lived token...')
//             const tokens = await getToken(develocityAccessKey, develocityTokenExpiry)
//             if (tokens != null && !tokens.isEmpty()) {
//                 core.debug(`Got token(s), setting the access key env vars`)
//                 const token = tokens.raw()
//                 core.setSecret(token)
//                 exportAccessKeyEnvVars(token)
//             } else {
//                 handleMissingAccessToken()
//             }
//         } catch (e) {
//             handleMissingAccessToken()
//             core.warning(`Failed to fetch short-lived token, reason: ${e}`)
//         }
//     }
// }
//
// function exportAccessKeyEnvVars(value: string): void {
//     ;[BuildScanConfig.DevelocityAccessKeyEnvVar, BuildScanConfig.GradleEnterpriseAccessKeyEnvVar].forEach(key =>
//         core.exportVariable(key, value)
//     )
// }
//
// function handleMissingAccessToken(): void {
//     core.warning(`Failed to fetch short-lived token for Develocity`)
//
//     if (process.env[BuildScanConfig.GradleEnterpriseAccessKeyEnvVar]) {
//         // We do not clear the GRADLE_ENTERPRISE_ACCESS_KEY env var in v3, to let the users upgrade to DV 2024.1
//         recordDeprecation(`The ${BuildScanConfig.GradleEnterpriseAccessKeyEnvVar} env var is deprecated`)
//     }
//     if (process.env[BuildScanConfig.DevelocityAccessKeyEnvVar]) {
//         core.warning(`The ${BuildScanConfig.DevelocityAccessKeyEnvVar} env var should be mapped to a short-lived token`)
//     }
// }
// MODIFICATIONS END HERE

export async function getToken(accessKey: string, expiry: string): Promise<DevelocityAccessCredentials | null> {
    const empty: Promise<DevelocityAccessCredentials | null> = new Promise(r => r(null))
    const develocityAccessKey = DevelocityAccessCredentials.parse(accessKey)
    const shortLivedTokenClient = new ShortLivedTokenClient()

    if (develocityAccessKey == null) {
        return empty
    }
    const tokens = new Array<HostnameAccessKey>()
    for (const k of develocityAccessKey.keys) {
        try {
            core.info(`Requesting short-lived Develocity access token for ${k.hostname}`)
            const token = await shortLivedTokenClient.fetchToken(`https://${k.hostname}`, k, expiry)
            tokens.push(token)
        } catch (e) {
            // Ignore failure to obtain token
            core.info(`Failed to obtain short-lived Develocity access token for ${k.hostname}: ${e}`)
        }
    }
    if (tokens.length > 0) {
        return DevelocityAccessCredentials.of(tokens)
    }
    return empty
}

class ShortLivedTokenClient {
    httpc = new httpm.HttpClient('gradle/actions/setup-gradle')
    maxRetries = 3
    retryInterval = 1000

    async fetchToken(serverUrl: string, accessKey: HostnameAccessKey, expiry: string): Promise<HostnameAccessKey> {
        const queryParams = expiry ? `?expiresInHours=${expiry}` : ''
        const sanitizedServerUrl = !serverUrl.endsWith('/') ? `${serverUrl}/` : serverUrl
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessKey.key}`
        }

        let attempts = 0
        while (attempts < this.maxRetries) {
            try {
                const requestUrl = `${sanitizedServerUrl}api/auth/token${queryParams}`
                core.debug(`Attempt ${attempts} to fetch short lived token at ${requestUrl}`)
                const response = await this.httpc.post(requestUrl, '', headers)
                if (response.message.statusCode === 200) {
                    const text = await response.readBody()
                    return new Promise<HostnameAccessKey>(resolve => resolve({hostname: accessKey.hostname, key: text}))
                }
                // This should be only 404
                attempts++
                if (attempts === this.maxRetries) {
                    return new Promise((resolve, reject) =>
                        reject(
                            new Error(
                                `Develocity short lived token request failed ${serverUrl} with status code ${response.message.statusCode}`
                            )
                        )
                    )
                }
            } catch (error) {
                attempts++
                if (attempts === this.maxRetries) {
                    return new Promise((resolve, reject) => reject(error))
                }
            }
            await new Promise(resolve => setTimeout(resolve, this.retryInterval))
        }
        return new Promise((resolve, reject) => reject(new Error('Illegal state')))
    }
}

type HostnameAccessKey = {
    hostname: string
    key: string
}

export class DevelocityAccessCredentials {
    readonly keys: HostnameAccessKey[]

    private constructor(allKeys: HostnameAccessKey[]) {
        this.keys = allKeys
    }

    static of(allKeys: HostnameAccessKey[]): DevelocityAccessCredentials {
        return new DevelocityAccessCredentials(allKeys)
    }

    private static readonly keyDelimiter = ';'
    private static readonly hostDelimiter = '='
    private static readonly whitespace = /\s/

    /**
     * Parse a `host=key[;host=key]*` access key value.
     *
     * Only the structure needed to split the value is validated: entries are separated by `;`, and
     * each entry is a hostname followed by `=` and a key, where the hostname contains no `=`, `;` or
     * whitespace, and the key is non-empty and contains no `;` or whitespace. Nothing else is
     * assumed about the key: it may be an OIDC token containing `.`, `-`, `_` and `=` padding, so
     * each entry is split on its _first_ `=` only.
     *
     * Returns `null` if the value doesn't match, emitting a warning that describes what is wrong.
     */
    static parse(rawKey: string): DevelocityAccessCredentials | null {
        const trimmedKey = rawKey.trim()
        if (!trimmedKey) {
            return null
        }
        const keys = new Array<HostnameAccessKey>()
        const entries = trimmedKey.split(this.keyDelimiter)
        for (const [index, entry] of entries.entries()) {
            const separatorIndex = entry.indexOf(this.hostDelimiter)
            if (separatorIndex === -1) {
                return this.warnBadlyFormed(index, entries.length, `no '${this.hostDelimiter}' separator`)
            }
            const hostname = entry.substring(0, separatorIndex)
            const key = entry.substring(separatorIndex + 1)
            if (!hostname) {
                return this.warnBadlyFormed(index, entries.length, 'empty server name')
            }
            if (!key) {
                return this.warnBadlyFormed(index, entries.length, 'empty key')
            }
            if (this.whitespace.test(hostname)) {
                return this.warnBadlyFormed(index, entries.length, 'whitespace in the server name')
            }
            if (this.whitespace.test(key)) {
                return this.warnBadlyFormed(index, entries.length, 'whitespace in the key')
            }
            keys.push({hostname, key})
        }
        return new DevelocityAccessCredentials(keys)
    }

    /**
     * Warn that an access key value is badly formed and cannot be parsed. Reports only the position
     * of the offending entry and the reason: the value is a secret, and is not yet registered for
     * masking at this point, so no part of it is ever included in the message.
     */
    private static warnBadlyFormed(index: number, entryCount: number, reason: string): null {
        const location = entryCount > 1 ? `entry ${index + 1} of ${entryCount}` : 'the value'
        core.warning(
            `Ignoring badly formed Develocity access key: ${reason} in ${location}. ` +
                `The expected format is 'server${this.hostDelimiter}key` +
                `[${this.keyDelimiter}server${this.hostDelimiter}key]*'.`
        )
        return null
    }

    isEmpty(): boolean {
        return this.keys.length === 0
    }

    raw(): string {
        return this.keys
            .map(k => `${k.hostname}${DevelocityAccessCredentials.hostDelimiter}${k.key}`)
            .join(DevelocityAccessCredentials.keyDelimiter)
    }
}
