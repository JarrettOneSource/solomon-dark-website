import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(SCRIPT_DIR, '../src/assets/game/audio/voice')
const SOURCE_DIR = process.argv[2]

if (!SOURCE_DIR) {
  throw new Error(
    'Usage: node tools/extract-native-solomon-voices.mjs <stock-game-voices-directory>',
  )
}

const VOICES = [
  {
    source: 'SAY_SOLOMON_HELLO1.wav',
    output: 'solomon-hello-1.wav',
    bytes: 690342,
    sha256: 'dd460115df4f6880d7e067fc1c8c93492413f103ea9b94855f11e955293a564d',
  },
  {
    source: 'SAY_SOLOMON_HELLO2.wav',
    output: 'solomon-hello-2.wav',
    bytes: 502370,
    sha256: '2e4702214f3aad252eb46e9000a8ef6bdec1dd95964d312cfbc1168a59a4bd94',
  },
  {
    source: 'SAY_SOLOMON_HELLO3.wav',
    output: 'solomon-hello-3.wav',
    bytes: 488614,
    sha256: '07693b871183c7d7d14fb4472aaa2ede983ebe5447bbcf031aee93649f909df2',
  },
  {
    source: 'SAY_SOLOMON_HELLO4.wav',
    output: 'solomon-hello-4.wav',
    bytes: 647716,
    sha256: 'a2748ccc9fbe13c2ae80e238ea8dd5a170b1dd7e2b2c7fa050a0073470ce52a2',
  },
  {
    source: 'SAY_SOLOMON_LAUGH1.wav',
    output: 'solomon-laugh-1.wav',
    bytes: 217282,
    sha256: '26463c3f557378c5409fe8b37c49c9f5585dee26ffc16face1db0770a08d5716',
  },
  {
    source: 'SAY_GETHIMBOYS.wav',
    output: 'solomon-get-him-boys.wav',
    bytes: 215348,
    sha256: 'c26e56af5c5036bdfdda8dee9c5ba8270a75156b45c0afe9f00c83b850b34541',
  },
]

await mkdir(OUTPUT_DIR, { recursive: true })
for (const voice of VOICES) {
  const source = resolve(SOURCE_DIR, voice.source)
  const bytes = await readFile(source)
  const actualSha256 = createHash('sha256').update(bytes).digest('hex')
  if (bytes.length !== voice.bytes || actualSha256 !== voice.sha256) {
    throw new Error(
      `${basename(source)} does not match the stock 0.72.5 voice: expected `
      + `${voice.bytes} bytes / ${voice.sha256}, found ${bytes.length} bytes / ${actualSha256}`,
    )
  }
  await copyFile(source, join(OUTPUT_DIR, voice.output))
}

console.log(`Extracted ${VOICES.length} verified stock Solomon voices to ${OUTPUT_DIR}`)
