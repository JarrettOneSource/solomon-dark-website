import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const assetsDirectory = resolve(import.meta.dirname, '../../backend/wwwroot/assets')
const javascriptFiles = (await readdir(assetsDirectory))
  .filter((name) => name.endsWith('.js'))

const offenders = []
for (const name of javascriptFiles) {
  const source = await readFile(join(assetsDirectory, name), 'utf8')
  if (/data:audio\//i.test(source)) offenders.push(name)
}

if (offenders.length > 0) {
  throw new Error(
    `Production JavaScript embeds audio blocked by media-src 'self': ${offenders.join(', ')}`,
  )
}

console.log('Production media assets comply with the deployment CSP.')
