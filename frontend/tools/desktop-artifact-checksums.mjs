import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const platform = process.env.TARGET_PLATFORM || process.platform
if (!['win32', 'darwin', 'linux'].includes(platform)) throw new Error('Invalid desktop checksum platform')
const root = 'dist-desktop'
const files = (await readdir(root)).filter(name => /\.(exe|dmg|zip|AppImage|blockmap)$/.test(name) || /^latest.*\.yml$/.test(name)).sort()
if (!files.length) throw new Error('No desktop artifacts were built')
const rows = await Promise.all(files.map(async name => `${createHash('sha256').update(await readFile(join(root, name))).digest('hex')}  ${name}`))
await writeFile(join(root, `SHA256SUMS-${platform}.txt`), `${rows.join('\n')}\n`)
