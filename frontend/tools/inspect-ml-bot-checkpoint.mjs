import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  decodeMlBotPolicyCheckpoint,
  encodeMlBotPolicyCheckpoint,
} from '../src/game/core-server/ml-bot-policy/checkpoint.ts'
import { MlBotPolicyRuntime } from '../src/game/core-server/ml-bot-policy/runtime.ts'

const checkpointPath = process.argv[2]
if (!checkpointPath) throw new Error('usage: inspect-ml-bot-checkpoint.mjs CHECKPOINT')
const source = new Uint8Array(await readFile(resolve(checkpointPath)))
const checkpoint = decodeMlBotPolicyCheckpoint(source)
const runtime = new MlBotPolicyRuntime(checkpoint)
const observation = new Float32Array(1_784)
for (let index = 0; index < observation.length; index += 1) {
  observation[index] = Math.fround(((index % 97) - 48) / 48)
}
const movement = new Uint8Array(9).fill(1)
const target = new Uint8Array(9).fill(1)
const ability = new Uint8Array(22).fill(1)
const aim = new Uint8Array(9).fill(1)
const result = runtime.inferAutoregressive(
  observation,
  { movement, target },
  () => ability,
  () => aim,
  { mode: 'argmax' },
)
const choiceDescriptors = new Float32Array(3 * 56)
for (let index = 0; index < choiceDescriptors.length; index += 1) {
  choiceDescriptors[index] = Math.fround(((index % 31) - 15) / 15)
}
const choice = runtime.choose(
  observation,
  choiceDescriptors,
  Uint8Array.from([1, 1, 0]),
  { mode: 'argmax' },
)
const reencoded = encodeMlBotPolicyCheckpoint(checkpoint)
process.stdout.write(`${JSON.stringify({
  actions: result.actions,
  bytes: source.byteLength,
  choice: {
    logProbability: choice.logProbability,
    selectedOption: choice.selectedOption,
    value: choice.value,
  },
  logProbability: result.logProbability,
  modelVersion: checkpoint.metadata.modelVersion,
  observationVersion: checkpoint.metadata.observationVersion,
  reencodedSha256: createHash('sha256').update(reencoded).digest('hex'),
  sha256: createHash('sha256').update(source).digest('hex'),
  status: 'ok',
  value: result.value,
})}\n`)
