import { parentPort } from 'node:worker_threads'

import {
  BoneyardHeadlessBatch,
  type BoneyardHeadlessBatchTransition,
} from './boneyard-headless-batch.ts'
import type {
  BoneyardHeadlessEnvironmentOptions,
  BoneyardHeadlessResetOptions,
} from './boneyard-headless-environment.ts'

type WorkerRequest =
  | { id: number; type: 'initialize'; options: readonly BoneyardHeadlessEnvironmentOptions[] }
  | { actions: ArrayBuffer; id: number; ticks: number; type: 'step' }
  | { id: number; options: readonly BoneyardHeadlessResetOptions[]; type: 'reset' }

if (!parentPort) throw new Error('Boneyard headless worker requires a parent port')

let batch: BoneyardHeadlessBatch | undefined
parentPort.on('message', (message: WorkerRequest) => {
  try {
    if (message.type === 'initialize') {
      batch = new BoneyardHeadlessBatch(message.options)
      parentPort!.postMessage({
        id: message.id,
        observationLength: batch.observationLength,
        type: 'initialized',
        worldCount: batch.worldCount,
      })
      return
    }
    if (!batch) throw new Error('Boneyard headless worker is not initialized')
    if (message.type === 'step') {
      postStepResult(
        message.id,
        batch.stepTransitions(new Float32Array(message.actions), message.ticks),
      )
      return
    }
    const observations = batch.reset(message.options)
    const masks = batch.lastActionMasks()
    const observationBuffer = observations.buffer as ArrayBuffer
    const ability = masks.ability.buffer as ArrayBuffer
    const aim = masks.aim.buffer as ArrayBuffer
    const movement = masks.movement.buffer as ArrayBuffer
    const target = masks.target.buffer as ArrayBuffer
    parentPort!.postMessage({
      hashes: batch.stateHashes(),
      id: message.id,
      masks: { ability, aim, movement, target },
      observations: observationBuffer,
      type: 'result',
    }, [observationBuffer, ability, aim, movement, target])
  } catch (error) {
    parentPort!.postMessage({
      error: error instanceof Error ? error.message : String(error),
      id: message.id,
      type: 'error',
    })
  }
})

function postStepResult(id: number, transition: BoneyardHeadlessBatchTransition): void {
  const observations = transition.nextObservations.buffer as ArrayBuffer
  const ability = transition.masks.ability.buffer as ArrayBuffer
  const aim = transition.masks.aim.buffer as ArrayBuffer
  const movement = transition.masks.movement.buffer as ArrayBuffer
  const target = transition.masks.target.buffer as ArrayBuffer
  const actions = transition.actions.buffer as ArrayBuffer
  const dones = transition.dones.buffer as ArrayBuffer
  const previousObservations = transition.observations.buffer as ArrayBuffer
  const rawRewards = transition.rawRewards.buffer as ArrayBuffer
  const rewardClamped = transition.rewardClamped.buffer as ArrayBuffer
  const rewards = transition.rewards.buffer as ArrayBuffer
  const simulationTicks = transition.simulationTicks.buffer as ArrayBuffer
  const nextSimulationTicks = transition.nextSimulationTicks.buffer as ArrayBuffer
  const ticks = transition.ticks.buffer as ArrayBuffer
  const death = transition.rewardTerms.death.buffer as ArrayBuffer
  const ownDamage = transition.rewardTerms.ownDamage.buffer as ArrayBuffer
  const selfHp = transition.rewardTerms.selfHp.buffer as ArrayBuffer
  const wave = transition.rewardTerms.wave.buffer as ArrayBuffer
  const xp = transition.rewardTerms.xp.buffer as ArrayBuffer
  parentPort!.postMessage({
    hashes: transition.nextStateHashes,
    id,
    masks: { ability, aim, movement, target },
    observations,
    transition: {
      actions,
      choiceEvents: transition.choiceEvents,
      choiceIntervals: transition.choiceIntervals,
      dones,
      nextSimulationTicks,
      nextStateHashes: transition.nextStateHashes,
      observations: previousObservations,
      rawRewards,
      rewardClamped,
      rewards,
      rewardTerms: { death, ownDamage, selfHp, wave, xp },
      simulationTicks,
      skillSelections: transition.skillSelections,
      stateHashes: transition.stateHashes,
      ticks,
    },
    type: 'step-result',
  }, [
    observations,
    ability,
    aim,
    movement,
    target,
    actions,
    dones,
    previousObservations,
    rawRewards,
    rewardClamped,
    rewards,
    simulationTicks,
    nextSimulationTicks,
    ticks,
    death,
    ownDamage,
    selfHp,
    wave,
    xp,
  ])
}
