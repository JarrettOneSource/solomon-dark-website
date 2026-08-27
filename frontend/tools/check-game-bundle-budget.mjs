import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const assetRoot = new URL('../../backend/wwwroot/assets/', import.meta.url)
const files = await readdir(assetRoot)
const entryFiles = files.filter((file) => /^Game-[A-Za-z0-9_-]+\.js$/.test(file))

assert.equal(entryFiles.length, 1, 'production build must contain one Game route entry')
for (const prefix of ['BoneyardScene-', 'HubScene-', 'SkillPicker-']) {
  assert.ok(
    files.some((file) => file.startsWith(prefix) && file.endsWith('.js')),
    `production build lost the ${prefix.slice(0, -1)} scene boundary`,
  )
}

const source = await readFile(new URL(entryFiles[0], assetRoot))
const gzipBytes = gzipSync(source).byteLength
const rawBytes = source.byteLength
const maximumRawBytes = 512 * 1024
// Protocol 85 and save schemas 16/17 add Tutorial acknowledgement and native provenance.
// Keep the route ceiling in whole-KiB steps while retaining the independent 512 KiB raw cap.
const maximumGzipBytes = 131 * 1024

assert.ok(
  rawBytes <= maximumRawBytes,
  `Game route entry is ${rawBytes} bytes; budget is ${maximumRawBytes}`,
)
assert.ok(
  gzipBytes <= maximumGzipBytes,
  `Game route entry gzip is ${gzipBytes} bytes; budget is ${maximumGzipBytes}`,
)

process.stdout.write(`${JSON.stringify({
  entry: entryFiles[0],
  gzipBytes,
  maximumGzipBytes,
  maximumRawBytes,
  rawBytes,
  status: 'ok',
})}\n`)
