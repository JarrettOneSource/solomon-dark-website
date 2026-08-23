import { parentPort } from 'node:worker_threads'

import { decodeMlBotPolicyCheckpoint } from '../core-server/ml-bot-policy/checkpoint.ts'
import { MlBotPolicyRuntime } from '../core-server/ml-bot-policy/runtime.ts'

type WorkerRequest =
  | { readonly checkpoint: ArrayBuffer; readonly id: number; readonly type: 'initialize' }
  | {
      readonly abilityByTarget: ArrayBuffer
      readonly aimByAbility: ArrayBuffer
      readonly id: number
      readonly movement: ArrayBuffer
      readonly observation: ArrayBuffer
      readonly target: ArrayBuffer
      readonly type: 'infer'
    }
  | {
      readonly id: number
      readonly observation: ArrayBuffer
      readonly optionDescriptors: ArrayBuffer
      readonly optionMask: ArrayBuffer
      readonly type: 'choose'
    }

if (!parentPort) throw new Error('ML bot policy worker requires a parent port')

let runtime: MlBotPolicyRuntime | null = null
parentPort.on('message', (message: WorkerRequest) => {
  try {
    if (message.type === 'initialize') {
      runtime = new MlBotPolicyRuntime(decodeMlBotPolicyCheckpoint(new Uint8Array(message.checkpoint)))
      parentPort!.postMessage({ id: message.id, type: 'initialized' })
      return
    }
    if (runtime === null) throw new Error('ML bot policy worker is not initialized')
    if (message.type === 'choose') {
      const result = runtime.choose(
        float32(message.observation, 1_784, 'choice observation'),
        float32Any(message.optionDescriptors, 'choice descriptors'),
        uint8Any(message.optionMask, 'choice mask'),
        { mode: 'argmax' },
      )
      parentPort!.postMessage({
        id: message.id,
        logProbability: result.logProbability,
        selectedOption: result.selectedOption,
        type: 'choice-result',
        value: result.value,
      })
      return
    }
    const observation = float32(message.observation, 1_784, 'observation')
    const movement = uint8(message.movement, 9, 'movement mask')
    const target = uint8(message.target, 9, 'target mask')
    const abilityByTarget = uint8(message.abilityByTarget, 9 * 22, 'ability mask plan')
    const aimByAbility = uint8(message.aimByAbility, 22 * 9, 'aim mask plan')
    const result = runtime.inferAutoregressive(
      observation,
      { movement, target },
      targetAction => abilityByTarget.subarray(targetAction * 22, (targetAction + 1) * 22),
      (_targetAction, abilityAction) => (
        aimByAbility.subarray(abilityAction * 9, (abilityAction + 1) * 9)
      ),
      { mode: 'argmax' },
    )
    parentPort!.postMessage({
      actions: result.actions,
      id: message.id,
      logProbability: result.logProbability,
      type: 'result',
      value: result.value,
    })
  } catch (error) {
    parentPort!.postMessage({
      error: error instanceof Error ? error.message : String(error),
      id: message.id,
      type: 'error',
    })
  }
})

function float32(value: ArrayBuffer, length: number, label: string): Float32Array {
  const result = new Float32Array(value)
  if (result.length !== length) throw new RangeError(`ML bot policy worker ${label} length is invalid`)
  return result
}

function uint8(value: ArrayBuffer, length: number, label: string): Uint8Array {
  const result = new Uint8Array(value)
  if (result.length !== length) throw new RangeError(`ML bot policy worker ${label} length is invalid`)
  return result
}

function float32Any(value: ArrayBuffer, label: string): Float32Array {
  const result = new Float32Array(value)
  if (result.length === 0) throw new RangeError(`ML bot policy worker ${label} must not be empty`)
  return result
}

function uint8Any(value: ArrayBuffer, label: string): Uint8Array {
  const result = new Uint8Array(value)
  if (result.length === 0) throw new RangeError(`ML bot policy worker ${label} must not be empty`)
  return result
}
