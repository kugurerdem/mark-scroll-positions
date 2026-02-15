import {readFile, writeFile} from 'node:fs/promises'

const manifestPath = new URL('../build/manifest.json', import.meta.url)

const manifestJson = JSON.parse(await readFile(manifestPath, 'utf8'))

const background = manifestJson.background ?? {}

if (typeof background.service_worker === 'string') {
    const scripts = Array.isArray(background.scripts) ? background.scripts : []
    if (!scripts.includes(background.service_worker)) {
        scripts.push(background.service_worker)
    }
    background.scripts = scripts
}

manifestJson.background = background

await writeFile(manifestPath, `${JSON.stringify(manifestJson, null, 4)}\n`)
