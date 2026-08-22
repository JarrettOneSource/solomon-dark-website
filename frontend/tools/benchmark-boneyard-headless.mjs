import {
  createBoneyardHeadlessActionBuffer,
} from '../src/game/headless/boneyard-headless-environment.ts'
import {
  BoneyardHeadlessWorkerPool,
} from '../src/game/headless/boneyard-headless-worker-pool.ts'

const ticks = integerArgument('--ticks', 500)
const workerCounts = listArgument('--workers', [1, 4, 8])
const results = []

for (const workerCount of workerCounts) {
  const environments = Array.from({ length: workerCount }, (_, index) => ({
    seed: (0x5eed_0000 + index) >>> 0,
  }))
  const pool = await BoneyardHeadlessWorkerPool.create({ environments, workerCount })
  try {
    const actions = createBoneyardHeadlessActionBuffer(workerCount)
    await pool.step(actions, 10)
    await pool.reset(environments)
    const started = process.hrtime.bigint()
    await pool.step(actions, ticks)
    const wallSeconds = Number(process.hrtime.bigint() - started) / 1e9
    const environmentSteps = workerCount * ticks
    results.push({
      environmentSteps,
      environmentStepsPerSecond: environmentSteps / wallSeconds,
      ticksPerWorld: ticks,
      wallSeconds,
      workers: workerCount,
      worlds: workerCount,
    })
  } finally {
    await pool.close()
  }
}

console.log(JSON.stringify({
  node: process.version,
  results,
  schema: 'solomon-dark-boneyard-headless-benchmark-v1',
}, null, 2))

function integerArgument(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index < 0) return fallback
  const value = Number(process.argv[index + 1])
  if (!Number.isInteger(value) || value < 1 || value > 100_000) {
    throw new RangeError(`${name} must be an integer within 1..100000`)
  }
  return value
}

function listArgument(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index < 0) return fallback
  const values = String(process.argv[index + 1] ?? '').split(',').map(Number)
  if (values.length === 0 || values.some((value) => !Number.isInteger(value) || value < 1)) {
    throw new RangeError(`${name} must be a comma-separated list of positive integers`)
  }
  return values
}
