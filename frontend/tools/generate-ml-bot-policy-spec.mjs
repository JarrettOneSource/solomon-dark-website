import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  ML_BOT_POLICY_ACTION_HEADS,
  ML_BOT_POLICY_BLOCKS,
  ML_BOT_POLICY_OBSERVATION_NAMES,
  ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES,
  ML_BOT_POLICY_SCALES,
  ML_BOT_POLICY_SPEC,
} from '../src/game/core-server/ml-bot-policy/spec.ts'

const outputPath = resolve(
  import.meta.dirname,
  '../src/game/core-server/ml-bot-policy/policy-spec-v5.json',
)
const artifact = {
  ...ML_BOT_POLICY_SPEC,
  actionHeads: ML_BOT_POLICY_ACTION_HEADS,
  blocks: ML_BOT_POLICY_BLOCKS,
  observationNames: ML_BOT_POLICY_OBSERVATION_NAMES,
  optionDescriptorNames: ML_BOT_POLICY_OPTION_DESCRIPTOR_NAMES,
  scales: ML_BOT_POLICY_SCALES,
}
const expected = `${JSON.stringify(artifact, null, 2)}\n`

if (process.argv.includes('--check')) {
  const actual = await readFile(outputPath, 'utf8').catch(() => '')
  if (actual !== expected) {
    console.error('ML bot policy spec artifact is stale. Run npm run generate:ml-bot-policy-spec.')
    process.exitCode = 1
  }
} else {
  await writeFile(outputPath, expected)
  console.log(`Wrote ${outputPath}`)
}
