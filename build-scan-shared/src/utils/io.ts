import * as core from '@actions/core'
import fs from 'fs'
import path from 'path'
import * as toolCache from '@actions/tool-cache'
import https from 'https'

export function getDelimiter(): string {
    return path.delimiter
}

export function getAbsoluteFilePath(extensionsFileName: string): string {
    return path.resolve(process.cwd(), extensionsFileName)
}

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

export type Credentials = {
    username: string
    password: string
}

export async function downloadFile(url: string, downloadFolder: string, credentials?: Credentials): Promise<string> {
    const fileName = path.basename(url)
    const filePath = path.join(downloadFolder, fileName)
    const options = credentials ? {auth: `${credentials.username}:${credentials.password}`} : {}

    function close(file: fs.WriteStream): void {
        file.close()
        fs.unlink(filePath, unlinkErr => core.debug(`Could not cleanup ${filePath} after close error: ${unlinkErr}`))
    }

    return new Promise((resolve, reject) => {
        // Ensure the download folder exists
        if (!existsSync(downloadFolder)) {
            mkdirSync(downloadFolder)
        }

        const file: fs.WriteStream = fs.createWriteStream(filePath)
        https
            .get(url, options, response => {
                if (response.statusCode !== 200) {
                    response.resume()
                    close(file)
                    reject(new Error(`Failed to get '${url}' (${response.statusCode})`))
                } else {
                    response.pipe(file)
                    file.on('finish', () => {
                        file.close()
                        resolve(filePath)
                    })
                }
            })
            .on('error', err => {
                close(file)
                reject(err)
            })
    })
}
