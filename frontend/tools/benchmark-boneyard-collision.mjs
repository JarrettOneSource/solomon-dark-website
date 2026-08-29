import { performance } from 'node:perf_hooks'

import { NATIVE_GENERATED_BONEYARDS } from '../src/game/host/native-generated-boneyards.ts'
import {
  canPlaceBoneyardBody,
  createBoneyardCollisionWorld,
  createBoneyardCollisionWorldAllPairsOracle,
  firstBoneyardPathBlockProgress,
} from '../src/game/core-server/boneyard-collision.ts'

const pathsPerArena = integerArgument('--paths', 4)
const repetitions = integerArgument('--repetitions', 5)
const scenarios = NATIVE_GENERATED_BONEYARDS.flatMap((template, templateIndex) => {
  const indexed = createBoneyardCollisionWorld(template.scene)
  const allPairs = createBoneyardCollisionWorldAllPairsOracle(template.scene)
  const paths = clearPaths(template.scene.bounds, indexed, pathsPerArena, templateIndex)
  return paths.map(({ end, start }) => ({
    allPairs,
    bounds: template.scene.bounds,
    end,
    indexed,
    start,
    templateIndex,
  }))
})

for (const scenario of scenarios) {
  firstBoneyardPathBlockProgress(
    scenario.start,
    scenario.end,
    scenario.bounds,
    scenario.indexed,
    0,
  )
  firstBoneyardPathBlockProgress(
    scenario.start,
    scenario.end,
    scenario.bounds,
    scenario.allPairs,
    0,
  )
}

const indexed = measure('indexed')
const allPairs = measure('allPairs')
if (indexed.checksum !== allPairs.checksum) {
  throw new Error(`collision benchmark checksum diverged: ${indexed.checksum} != ${allPairs.checksum}`)
}

console.log(JSON.stringify({
  allPairs,
  indexed,
  node: process.version,
  pathsPerArena,
  repetitions,
  schema: 'solomon-dark-boneyard-collision-benchmark-v1',
  speedup: allPairs.wallMs / indexed.wallMs,
  templates: NATIVE_GENERATED_BONEYARDS.length,
}, null, 2))

function measure(mode) {
  let checksum = 0
  let operations = 0
  const started = performance.now()
  for (let repetition = 0; repetition < repetitions; repetition += 1) {
    for (const scenario of scenarios) {
      const result = firstBoneyardPathBlockProgress(
        scenario.start,
        scenario.end,
        scenario.bounds,
        scenario[mode],
        0,
      )
      checksum += result ?? 1
      operations += 1
    }
  }
  const wallMs = performance.now() - started
  return {
    checksum,
    meanMicros: wallMs * 1000 / operations,
    operations,
    wallMs,
  }
}

function clearPaths(bounds, world, count, templateIndex) {
  let randomState = (0x93a7_41d5 ^ Math.imul(templateIndex + 1, 0x9e37_79b1)) >>> 0
  const paths = []
  for (let attempt = 0; attempt < 20_000 && paths.length < count; attempt += 1) {
    const start = point()
    const end = point()
    if (Math.hypot(end.x - start.x, end.y - start.y) < 500) continue
    if (!canPlaceBoneyardBody(start, bounds, world, 0)) continue
    if (!canPlaceBoneyardBody(end, bounds, world, 0)) continue
    if (firstBoneyardPathBlockProgress(start, end, bounds, world, 0) !== null) continue
    paths.push({ end, start })
  }
  if (paths.length !== count) {
    throw new Error(`generated Arena ${templateIndex} has only ${paths.length} clear benchmark paths`)
  }
  return paths

  function point() {
    return {
      x: bounds.x + random() * bounds.w,
      y: bounds.y + random() * bounds.h,
    }
  }

  function random() {
    randomState ^= randomState << 13
    randomState ^= randomState >>> 17
    randomState ^= randomState << 5
    randomState >>>= 0
    return randomState / 0x1_0000_0000
  }
}

function integerArgument(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index < 0) return fallback
  const value = Number(process.argv[index + 1])
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new RangeError(`${name} must be an integer within 1..100`)
  }
  return value
}
