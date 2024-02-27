import * as core from '@actions/core'
import {InputOptions} from "@actions/core";

export function getInput(key: string, options?: InputOptions): string {
    return core.getInput(key, options)
}

export function getBooleanInput(paramName: string, paramDefault = false): boolean {
    const paramValue = core.getInput(paramName)
    switch (paramValue.toLowerCase().trim()) {
        case '':
            return paramDefault
        case 'false':
            return false
        case 'true':
            return true
    }
    throw TypeError(`The value '${paramValue} is not valid for '${paramName}. Valid values are: [true, false]`)
}

// Internal parameters
export function getGithubToken(): string {
    return getInput('github-token', {required: true})
}
