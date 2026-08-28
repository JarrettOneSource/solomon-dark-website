import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import {
  assetSourceRoot,
  fetchAssetSource,
  readAssetSources,
} from './assets.mjs'

const execFileAsync = promisify(execFile)
const BLENDER_SCRIPT = fileURLToPath(new URL('./render-directional-sprite.py', import.meta.url))

export async function renderSprite(args, io = console) {
  const [recipeArg] = args
  if (!recipeArg) throw new Error('usage: sdmod render-sprite <recipe.json>')
  const recipePath = resolve(recipeArg)
  const recipeBytes = await readFile(recipePath)
  const recipe = JSON.parse(recipeBytes)
  const catalog = await readAssetSources()
  const source = catalog.sources.find(candidate => candidate.id === recipe.source)
  if (!source) throw new Error(`sprite recipe uses unknown asset source: ${recipe.source}`)
  await fetchAssetSource(source)
  const output = resolve(dirname(recipePath), recipe.output)
  if (!output.endsWith('.png')) throw new Error('sprite recipe output must be a PNG path')
  const blender = process.env.SDR_BLENDER_PATH || 'blender'
  const { stdout, stderr } = await execFileAsync(blender, [
    '--background',
    '--factory-startup',
    '--python', BLENDER_SCRIPT,
    '--',
    '--recipe', recipePath,
    '--source-root', assetSourceRoot(source.id),
    '--output', output,
  ], { maxBuffer: 32 * 1024 * 1024 })
  const rendered = stdout.split('\n').find(line => line.startsWith('SDR_SPRITE_RESULT='))
  if (!rendered) {
    throw new Error(`Blender sprite render failed:\n${stdout}${stderr}`.trim())
  }
  const outputBytes = await readFile(output)
  const receipt = {
    blender: stdout.match(/Blender ([0-9.]+)/)?.[1] ?? 'unknown',
    output,
    outputSha256: sha256(outputBytes),
    recipeSha256: sha256(recipeBytes),
    source: source.id,
    sourceSha256: source.sha256,
  }
  io.log(JSON.stringify(receipt, null, 2))
  return receipt
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}
