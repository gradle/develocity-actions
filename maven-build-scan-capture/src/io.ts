import fs from 'fs'

export function writeContentToFileSync(fileName: string, content: string): void {
    fs.writeFileSync(fileName, content)
}

export function copyFileSync(source: string, dest: string): void {
    fs.copyFileSync(source, dest)
}
