import {readFile, writeFile} from 'node:fs/promises'

const packagePath = new URL('../package.json', import.meta.url)
const manifestPath = new URL('../public/manifest.json', import.meta.url)

const packageJson = JSON.parse(await readFile(packagePath, 'utf8'))
const manifestJson = JSON.parse(await readFile(manifestPath, 'utf8'))

manifestJson.version = packageJson.version

await writeFile(manifestPath, `${JSON.stringify(manifestJson, null, 4)}\n`)
