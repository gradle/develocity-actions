import fs from 'fs'

export function copyFileSync(source: string, dest: string): void {
    fs.copyFileSync(source, dest)
}
