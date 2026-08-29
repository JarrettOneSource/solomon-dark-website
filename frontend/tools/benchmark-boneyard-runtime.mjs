import { performance } from 'node:perf_hooks'

import { startBoneyardArenaTransition } from '../src/game/core-kernels/boneyard-arena-transition.ts'
import { startBoneyardWaveDirector } from '../src/game/core-kernels/boneyard-wave-director.ts'
import {
  createIdlePlayerCharacterInput,
  PLAYER_CHARACTER_RADIUS,
} from '../src/game/core-kernels/player-character.ts'
import {
  addPlayerCharacter,
  createGameSimulation,
  enterBoneyardWorld,
  gameSimulationPlayerRecords,
  stepGameSimulationTick,
} from '../src/game/core-server/game-simulation.ts'
import { resolveBoneyardSpawnPosition } from '../src/game/core-server/boneyard-collision.ts'
import { prepareBoneyardWorldNavigation } from '../src/game/core-server/boneyard-world.ts'
import { replacePlayerCharacter } from '../src/game/core-server/player-entity-store.ts'
import { resolveMlBotPolicySkillOffers } from '../src/game/core-server/ml-bot-policy/skill-chooser.ts'
import { deterministicStateHash } from '../src/game/headless/hub-headless-environment.ts'
import { NATIVE_GENERATED_BONEYARDS } from '../src/game/host/native-generated-boneyards.ts'

const totalTicks = positiveInteger(process.env.SDR_REPLAY_TICKS ?? '62500', 'SDR_REPLAY_TICKS')
const arenaIndex = nonnegativeInteger(process.env.SDR_REPLAY_ARENA ?? '0', 'SDR_REPLAY_ARENA')
const seed = nonnegativeInteger(process.env.SDR_REPLAY_SEED ?? '1372610135', 'SDR_REPLAY_SEED')
const hashEvery = positiveInteger(
  process.env.SDR_REPLAY_HASH_EVERY ?? '500',
  'SDR_REPLAY_HASH_EVERY',
)
const crowdThreshold = positiveInteger(process.env.SDR_REPLAY_CROWD ?? '70', 'SDR_REPLAY_CROWD')

const PLAYERS = Object.freeze([
  Object.freeze({
    config: Object.freeze({ discipline: 'body', displayName: 'Ether Body', element: 'ether' }),
    id: 'wizard-ether',
  }),
  Object.freeze({
    config: Object.freeze({ discipline: 'mind', displayName: 'Water Mind', element: 'water' }),
    id: 'wizard-water',
  }),
])
const playerIds = PLAYERS.map(({ id }) => id)
const extensions = Object.freeze({
  createLootItems: () => [],
  filterDamage: () => 0,
  filterMana: (input) => input.delta,
  hasConsumable: () => false,
})
let simulation = createSimulation()
if (simulation.world.kind !== 'boneyard') throw new Error('runtime replay did not enter Boneyard')
prepareBoneyardWorldNavigation(simulation.world)

const hashes = []
const tickSamples = new Float64Array(totalTicks)
const liveEnemies = new Uint16Array(totalTicks)
const waveOrdinals = new Uint16Array(totalTicks)
const waveLog = []
let lastWaveKey = ''
let peakDynamicActors = 0
let peakLiveEnemies = 0
let executedTicks = 0
const populationSums = {
  deathEffects: 0,
  enemyActors: 0,
  enemyProjectiles: 0,
  liveEnemies: 0,
  lootActors: 0,
  mageLightningPulses: 0,
  maggots: 0,
  primaryProjectiles: 0,
  primaryTransients: 0,
  projectileEffects: 0,
  secondaryActors: 0,
}
const startedAt = performance.now()

for (let index = 0; index < totalTicks; index += 1) {
  const inputs = Object.fromEntries(playerIds.map((playerId) => [
    playerId,
    scriptedInput(simulation, playerId),
  ]))
  const before = performance.now()
  simulation = stepGameSimulationTick(simulation, inputs, { extensions })
  if (simulation.levelUpBarrier !== null) {
    simulation = resolveMlBotPolicySkillOffers(simulation, playerIds).state
  }
  executedTicks = index + 1
  tickSamples[index] = performance.now() - before

  const world = simulation.world
  if (world.kind !== 'boneyard') throw new Error(`runtime replay left Boneyard at ${simulation.tick}`)
  const live = world.enemies.actors.filter(({ lifeState }) => lifeState === 'alive').length
    + world.enemies.maggots.filter(({ lifeState }) => lifeState === 'alive').length
  liveEnemies[index] = live
  peakLiveEnemies = Math.max(peakLiveEnemies, live)
  const enemyCounts = {
    actors: world.enemies.actors.length,
    deathEffects: world.enemies.deathEffects.length,
    mageLightningPulses: world.enemies.mageLightningPulses.length,
    maggots: world.enemies.maggots.length,
    projectileEffects: world.enemies.projectileEffects.length,
    projectiles: world.enemies.projectiles.length,
  }
  const dynamic = enemyCounts.actors + enemyCounts.maggots
    + enemyCounts.projectiles + enemyCounts.projectileEffects
    + enemyCounts.deathEffects + enemyCounts.mageLightningPulses
    + world.loot.actors.length
    + simulation.primarySpells.projectiles.length
    + simulation.primarySpells.transients.length
    + simulation.secondaryAbilities.actors.length
  peakDynamicActors = Math.max(peakDynamicActors, dynamic)
  populationSums.deathEffects += enemyCounts.deathEffects
  populationSums.enemyActors += enemyCounts.actors
  populationSums.enemyProjectiles += enemyCounts.projectiles
  populationSums.liveEnemies += live
  populationSums.lootActors += world.loot.actors.length
  populationSums.mageLightningPulses += enemyCounts.mageLightningPulses
  populationSums.maggots += enemyCounts.maggots
  populationSums.primaryProjectiles += simulation.primarySpells.projectiles.length
  populationSums.primaryTransients += simulation.primarySpells.transients.length
  populationSums.projectileEffects += enemyCounts.projectileEffects
  populationSums.secondaryActors += simulation.secondaryAbilities.actors.length

  const waves = world.waves
  const wave = waves?.waveOrdinal ?? 0
  const phase = waves?.phase ?? 'none'
  waveOrdinals[index] = wave
  const waveKey = `${wave}:${phase}`
  if (waveKey !== lastWaveKey) {
    waveLog.push({ live, phase, tick: simulation.tick, wave })
    lastWaveKey = waveKey
  }
  if (simulation.tick % hashEvery === 0) {
    hashes.push({
      hash: deterministicStateHash(simulation),
      jsonHash: orderSensitiveHash(simulation),
      tick: simulation.tick,
    })
  }
  if (simulation.run.phase !== 'active') break
}

const elapsedMs = performance.now() - startedAt
const crowdSamples = []
const byWave = new Map()
for (let index = 0; index < executedTicks; index += 1) {
  const sample = tickSamples[index]
  const wave = waveOrdinals[index]
  const bucket = byWave.get(wave) ?? []
  bucket.push(sample)
  byWave.set(wave, bucket)
  if (liveEnemies[index] >= crowdThreshold) crowdSamples.push(sample)
}

const report = {
  arenaIndex,
  crowd: stats(crowdSamples),
  crowdThreshold,
  elapsedMs,
  executedTicks,
  finalHash: deterministicStateHash(simulation),
  finalJsonHash: orderSensitiveHash(simulation),
  finalTick: simulation.tick,
  geometrySha256: NATIVE_GENERATED_BONEYARDS[arenaIndex].geometrySha256,
  hashes,
  node: process.version,
  overall: stats(Array.from(tickSamples.subarray(0, executedTicks))),
  peakDynamicActors,
  peakLiveEnemies,
  populationSums,
  seed,
  waveLog,
  waveStats: [...byWave.entries()]
    .sort(([left], [right]) => left - right)
    .map(([wave, samples]) => ({ wave, ...stats(samples) })),
}
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

function createSimulation() {
  let state = createGameSimulation({}, { combatRngSeed: seed, gameRngSeed: seed })
  for (const { config, id } of PLAYERS) state = addPlayerCharacter(state, id, config)
  const template = NATIVE_GENERATED_BONEYARDS[arenaIndex]
  if (!template) throw new Error(`runtime replay has no generated Arena ${arenaIndex}`)
  const word = seed.toString(16).padStart(8, '0')
  state = enterBoneyardWorld(state, {
    choice: { id: 'default-random', name: 'Random Boneyard', source: 'default' },
    geometrySha256: template.geometrySha256,
    runId: `runtime-benchmark-${word}`,
    scene: template.scene,
    seed: word,
    sourceSha256: template.sourceSha256,
  })
  const world = state.world
  if (world.kind !== 'boneyard') throw new Error('runtime replay did not materialize Boneyard')
  const encounter = world.encounter
  const sourceArenaTransition = world.arenaTransition
  const waves = world.waves
  if (encounter === null || sourceArenaTransition === null || waves === null) {
    throw new Error('runtime replay lacks its retail encounter')
  }
  const arenaTransition = startBoneyardArenaTransition(sourceArenaTransition)
  let playerEntities = state.playerEntities
  const players = gameSimulationPlayerRecords(state)
  for (const [index, playerId] of playerIds.entries()) {
    const player = players[playerId]
    if (!player) throw new Error(`runtime replay has no player ${playerId}`)
    const angle = index * Math.PI * 2 / playerIds.length
    const distance = index === 0 ? 0 : PLAYER_CHARACTER_RADIUS * 3
    const position = resolveBoneyardSpawnPosition(
      {
        x: Math.fround(encounter.position.x + Math.cos(angle) * distance),
        y: Math.fround(encounter.position.y + Math.sin(angle) * distance),
      },
      arenaTransition.combatBounds,
      world.collision,
      PLAYER_CHARACTER_RADIUS,
      index * 137.5,
    )
    playerEntities = replacePlayerCharacter(playerEntities, playerId, {
      ...player,
      position,
      velocity: { x: 0, y: 0 },
    })
  }
  return {
    ...state,
    playerEntities,
    world: {
      ...world,
      arenaTransition,
      encounter: {
        ...encounter,
        phase: 'gone',
        runEventId: Math.max(1, encounter.runEventId),
        targetPlayerId: null,
      },
      waves: startBoneyardWaveDirector(waves),
    },
  }
}

function scriptedInput(state, playerId) {
  if (state.world.kind !== 'boneyard') return createIdlePlayerCharacterInput()
  const player = gameSimulationPlayerRecords(state)[playerId]
  if (!player) return createIdlePlayerCharacterInput()
  let target = null
  let targetDistance = Number.POSITIVE_INFINITY
  const consider = (candidate) => {
    if (candidate.lifeState !== 'alive') return
    const dx = candidate.position.x - player.position.x
    const dy = candidate.position.y - player.position.y
    const distance = dx * dx + dy * dy
    if (distance < targetDistance || (distance === targetDistance && candidate.id < target.id)) {
      target = candidate
      targetDistance = distance
    }
  }
  for (const actor of state.world.enemies.actors) consider(actor)
  for (const maggot of state.world.enemies.maggots) consider(maggot)
  if (!target) return createIdlePlayerCharacterInput()
  const dx = target.position.x - player.position.x
  const dy = target.position.y - player.position.y
  const distance = Math.hypot(dx, dy)
  const scale = distance > 1e-9 ? 1 / distance : 0
  return {
    ...createIdlePlayerCharacterInput(),
    aim: { ...target.position },
    cast: { primary: true, quickbar: null },
    movement: distance > 180 ? { x: dx * scale, y: dy * scale } : { x: 0, y: 0 },
  }
}

function orderSensitiveHash(value) {
  const text = JSON.stringify(value)
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    a = Math.imul(a ^ code, 0x01000193)
    b = (Math.imul(b, 31) + code) | 0
  }
  return `${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}:${text.length}`
}

function stats(samples) {
  if (samples.length === 0) return { count: 0 }
  const sorted = Float64Array.from(samples).sort()
  const sum = sorted.reduce((total, value) => total + value, 0)
  const at = (fraction) => sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))]
  return {
    count: sorted.length,
    max: sorted[sorted.length - 1],
    mean: sum / sorted.length,
    p50: at(0.5),
    p90: at(0.9),
    p99: at(0.99),
    total: sum,
  }
}

function nonnegativeInteger(value, name) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
  return parsed
}

function positiveInteger(value, name) {
  const parsed = nonnegativeInteger(value, name)
  if (parsed === 0) throw new Error(`${name} must be positive`)
  return parsed
}
