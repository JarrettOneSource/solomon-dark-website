import { performance } from 'node:perf_hooks'

import {
  HubHeadlessEnvironment,
  createHubHeadlessActionBuffer,
} from '../src/game/headless/hub-headless-environment.ts'

const counts = integerList(process.env.SDR_HUB_BENCH_COUNTS ?? '16,32,64,128,256')
const measuredTicks = positiveInteger(process.env.SDR_HUB_BENCH_TICKS ?? '1000', 'SDR_HUB_BENCH_TICKS')
const episodeTicks = nonnegativeInteger(
  process.env.SDR_HUB_BENCH_EPISODE_TICKS ?? '0',
  'SDR_HUB_BENCH_EPISODE_TICKS',
)
const warmupTicks = nonnegativeInteger(process.env.SDR_HUB_BENCH_WARMUP ?? '50', 'SDR_HUB_BENCH_WARMUP')
const seed = nonnegativeInteger(process.env.SDR_HUB_BENCH_SEED ?? '1372610135', 'SDR_HUB_BENCH_SEED')
const results = []

for (const studentCount of counts) {
  const environment = new HubHeadlessEnvironment({
    routeEndBehavior: 'reverse',
    seed,
    studentCount,
  })
  const actions = createHubHeadlessActionBuffer()
  for (let tick = 0; tick < warmupTicks; tick += 1) {
    environment.stepPacked(actions, 0)
  }
  environment.reset({ seed, studentCount })
  const startedAt = performance.now()
  if (episodeTicks === 0) {
    environment.stepPacked(actions, 0, measuredTicks)
  } else {
    let remainingTicks = measuredTicks
    while (remainingTicks > 0) {
      const ticks = Math.min(episodeTicks, remainingTicks)
      environment.stepPacked(actions, 0, ticks)
      remainingTicks -= ticks
      if (remainingTicks > 0) environment.reset({ seed, studentCount })
    }
  }
  const elapsedMs = performance.now() - startedAt
  const simulation = environment.state()
  if (simulation.world.kind !== 'hub') throw new Error('Hub benchmark left the Hub world')
  results.push({
    elapsedMs,
    finalStudentCount: simulation.world.studentPopulation.students.length,
    millisecondsPerTick: elapsedMs / measuredTicks,
    stateHash: environment.stateHash(),
    studentCount,
    ticksPerSecond: measuredTicks * 1000 / elapsedMs,
  })
}

process.stdout.write(`${JSON.stringify({
  measuredTicks,
  node: process.version,
  episodeTicks,
  results,
  seed,
  warmupTicks,
}, null, 2)}\n`)

function integerList(value) {
  const values = value.split(',').map((entry) => positiveInteger(entry.trim(), 'SDR_HUB_BENCH_COUNTS'))
  if (values.length === 0) throw new Error('SDR_HUB_BENCH_COUNTS must not be empty')
  return values
}

function nonnegativeInteger(value, name) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must be a nonnegative integer`)
  return parsed
}

function positiveInteger(value, name) {
  const parsed = nonnegativeInteger(value, name)
  if (parsed === 0) throw new Error(`${name} must be positive`)
  return parsed
}
