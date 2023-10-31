import fs from 'fs'

export function writeContentToFileSync(fileName: string, content: string): void {
    fs.writeFileSync(fileName, content)
}
