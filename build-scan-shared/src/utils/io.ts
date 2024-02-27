import * as core from '@actions/core'
import fs from 'fs'
import path from 'path'
import * as toolCache from '@actions/tool-cache'

export function existsSync(fileName: string): boolean {
    return fs.existsSync(fileName)
}

export async function extractZip(zipFileName: string, extractDir: string): Promise<string> {
    return await toolCache.extractZip(zipFileName, extractDir)
}

export function mkdirSync(dir: string): void {
    fs.mkdirSync(dir, {recursive: true})
}

export function readdirSync(dirName: string): string[] {
    return fs.readdirSync(path.resolve(dirName))
}
export function readFileSync(fileName: string): string {
    return fs.readFileSync(path.resolve(fileName), 'utf-8')
}

export function writeFileSync(dirName: string, fileName: string, downloadBuffer: ArrayBuffer): void {
    if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, {recursive: true})
    }
    fs.writeFileSync(path.resolve(dirName, fileName), Buffer.from(downloadBuffer))
}

export function writeContentToFileSync(fileName: string, content: string): void {
    const parentDir = path.basename(path.dirname(fileName))
    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, {recursive: true})
    }
    fs.writeFileSync(fileName, content)
}

export function copyFileSync(source: string, dest: string): void {
    if (!existsSync(dest)) {
        fs.copyFileSync(source, dest)
    } else {
        core.info(`${dest} already present, skipping copy`)
    }
}

export function renameSync(oldPath: string, newPath: string): void {
    if (!fs.existsSync(newPath)) {
        fs.mkdirSync(newPath, {recursive: true})
    }
    fs.renameSync(oldPath, newPath)
}
