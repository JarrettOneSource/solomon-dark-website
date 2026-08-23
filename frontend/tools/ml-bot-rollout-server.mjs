import readline from 'node:readline'

import {
  BoneyardHeadlessWorkerPool,
} from '../src/game/headless/boneyard-headless-worker-pool.ts'

const PROTOCOL = 'solomon-dark-ml-rollout-v5'
let pool = null

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of input) {
  if (line.trim().length === 0) continue
  let request
  try {
    request = JSON.parse(line)
    const result = await dispatch(request)
    respond({ id: request.id, ok: true, protocol: PROTOCOL, ...result })
    if (request.type === 'close') {
      input.close()
      process.stdin.pause()
      break
    }
  } catch (error) {
    respond({
      error: error instanceof Error ? error.message : String(error),
      id: request?.id ?? null,
      ok: false,
      protocol: PROTOCOL,
    })
  }
}

await pool?.close()

async function dispatch(request) {
  requireRequest(request)
  if (request.type === 'initialize') {
    if (pool !== null) throw new Error('ML rollout server is already initialized')
    const seeds = requireSeeds(request.seeds, false)
    pool = await BoneyardHeadlessWorkerPool.create({
      environments: seeds.map(seed => ({ seed })),
      workerCount: optionalPositiveInteger(request.workerCount, seeds.length, 'workerCount'),
    })
    return stateResult(await pool.reset(seeds.map(seed => ({ seed }))), 'initialized')
  }
  if (request.type === 'close') {
    if (pool !== null) {
      await pool.close()
      pool = null
    }
    return { type: 'closed' }
  }
  if (pool === null) throw new Error('ML rollout server is not initialized')
  if (request.type === 'reset') {
    const seeds = requireSeeds(request.seeds, true)
    if (seeds.length !== pool.worldCount) throw new Error('reset seeds must match world count')
    return stateResult(await pool.reset(seeds.map(seed => seed === null ? null : { seed })), 'reset')
  }
  const ticks = optionalPositiveInteger(request.ticks, 1, 'ticks')
  if (request.type === 'expert-step') {
    return stepResult(await pool.expertStep(ticks), 'expert-step')
  }
  if (request.type === 'step') {
    const packed = decodeBytes(request.actions, pool.worldCount * 4, 'actions')
    return stepResult(await pool.step(Float32Array.from(packed), ticks), 'step')
  }
  throw new Error(`unknown ML rollout request type ${String(request.type)}`)
}

function stateResult(result, type) {
  return {
    hashes: result.hashes,
    metadata: result.metadata,
    observationLength: pool.observationLength,
    observations: encodeView(result.observations),
    plans: encodePlans(result.plans),
    type,
    worldCount: pool.worldCount,
  }
}

function stepResult(result, type) {
  const transition = result.transition
  return {
    ...stateResult(result, type),
    transition: {
      actions: encodeView(transition.actions),
      choiceEvents: transition.choiceEvents.map(encodeIndexedChoiceEvent),
      choiceIntervals: transition.choiceIntervals.map(encodeIndexedChoiceInterval),
      dones: encodeView(transition.dones),
      masks: {
        ability: encodeView(transition.masks.ability),
        aim: encodeView(transition.masks.aim),
        movement: encodeView(transition.masks.movement),
        target: encodeView(transition.masks.target),
      },
      nextSimulationTicks: encodeView(transition.nextSimulationTicks),
      nextStateHashes: transition.nextStateHashes,
      observations: encodeView(transition.observations),
      rawRewards: encodeView(transition.rawRewards),
      rewardClamped: encodeView(transition.rewardClamped),
      rewards: encodeView(transition.rewards),
      rewardTerms: Object.fromEntries(Object.entries(transition.rewardTerms).map(
        ([name, values]) => [name, encodeView(values)],
      )),
      simulationTicks: encodeView(transition.simulationTicks),
      skillSelections: transition.skillSelections,
      stateHashes: transition.stateHashes,
      ticks: encodeView(transition.ticks),
    },
  }
}

function encodePlans(plans) {
  return {
    abilityByTarget: encodeView(plans.abilityByTarget),
    aimByAbility: encodeView(plans.aimByAbility),
    movement: encodeView(plans.movement),
    target: encodeView(plans.target),
  }
}

function encodeIndexedChoiceEvent({ value, worldIndex }) {
  return {
    value: {
      ...value,
      observation: encodeView(value.observation),
      optionDescriptors: encodeView(value.optionDescriptors),
      optionMask: encodeView(value.optionMask),
    },
    worldIndex,
  }
}

function encodeIndexedChoiceInterval({ value, worldIndex }) {
  return {
    value: {
      ...value,
      observation: encodeView(value.observation),
      optionDescriptors: encodeView(value.optionDescriptors),
      optionMask: encodeView(value.optionMask),
    },
    worldIndex,
  }
}

function encodeView(view) {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString('base64')
}

function decodeBytes(value, length, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be base64`)
  const result = Buffer.from(value, 'base64')
  if (result.length !== length) throw new Error(`${label} byte length is invalid`)
  return new Uint8Array(result.buffer, result.byteOffset, result.byteLength)
}

function requireRequest(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('ML rollout request must be an object')
  }
  if (!Number.isSafeInteger(value.id) || value.id < 1) {
    throw new Error('ML rollout request id must be a positive integer')
  }
  if (typeof value.type !== 'string') throw new Error('ML rollout request type is required')
}

function requireSeeds(value, allowNull) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('ML rollout seeds must be a nonempty array')
  }
  return value.map((seed) => {
    if (allowNull && seed === null) return null
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
      throw new Error('ML rollout seeds must be uint32 values')
    }
    return seed
  })
}

function optionalPositiveInteger(value, fallback, label) {
  const result = value ?? fallback
  if (!Number.isSafeInteger(result) || result < 1 || result > 100_000) {
    throw new Error(`${label} must be an integer within 1..100000`)
  }
  return result
}

function respond(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}
