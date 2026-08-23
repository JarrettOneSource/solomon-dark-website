import { Worker } from 'node:worker_threads'

import type {
  PlayerCharacterConfig,
  PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import type { HubInventoryAction } from '../core-kernels/hub-economy.ts'
import type { GameSimulationState } from '../core-server/game-simulation.ts'
import {
  createMlBotPolicyActionMaskPlan,
  resolveMlBotPolicyDecision,
  type MlBotPolicyActionIndices,
  type MlBotPolicyActionMaskPlan,
} from '../core-server/ml-bot-policy/actions.ts'
import { decodeMlBotPolicyCheckpoint } from '../core-server/ml-bot-policy/checkpoint.ts'
import { MlBotPolicyObserver } from '../core-server/ml-bot-policy/observer.ts'
import { resolveMlBotPolicySkillOffers } from '../core-server/ml-bot-policy/skill-chooser.ts'
import { MlBotEntranceNavigator } from './ml-bot-entrance-navigation.ts'

export const ML_BOT_CHARACTER = Object.freeze({
  discipline: 'arcane',
  displayName: 'Policy Bot',
  element: 'fire',
} as const satisfies PlayerCharacterConfig)
export const ML_BOT_DECISION_INTERVAL_TICKS = 10

export interface MlBotPolicyContext {
  readonly activeInputs: Readonly<Record<string, PlayerCharacterInput>>
  readonly controllers: Readonly<Record<string, 'bot' | 'human'>>
  readonly state: GameSimulationState
}

export type MlBotHostIntent =
  | Readonly<{
      action: HubInventoryAction
      kind: 'hub-action'
    }>
  | Readonly<{
      input: PlayerCharacterInput
      kind: 'input'
    }>
  | Readonly<{
      input: PlayerCharacterInput
      kind: 'scripted-input'
    }>
  | Readonly<{
      choiceIndex: number
      kind: 'select-skill'
      offerSequence: number
      skillId: number
    }>
  | Readonly<{
      character: Pick<PlayerCharacterConfig, 'discipline' | 'element'>
      kind: 'confirm-loadout'
    }>

export interface MlBotHostControllerAdapter {
  readonly context: () => MlBotPolicyContext | null
  readonly dispatch: (intent: MlBotHostIntent) => void
  readonly fail: (error: Error) => void
}

export interface MlBotPolicyInferenceResult {
  readonly actions: MlBotPolicyActionIndices
  readonly logProbability: number
  readonly value: number
}

export interface MlBotPolicyInference {
  infer(
    observation: Float32Array,
    plan: MlBotPolicyActionMaskPlan,
  ): Promise<MlBotPolicyInferenceResult>
}

export class MlBotPolicyInferenceWorker implements MlBotPolicyInference {
  private closed = false
  private nextId = 1
  private readonly pending = new Map<number, {
    readonly reject: (error: Error) => void
    readonly resolve: (result: Record<string, unknown>) => void
  }>()
  private readonly worker: Worker

  private constructor() {
    const workerModule = import.meta.url.endsWith('.ts')
      ? './ml-bot-policy-worker.ts'
      : './ml-bot-policy-worker.mjs'
    this.worker = new Worker(new URL(workerModule, import.meta.url), {
      execArgv: workerModule.endsWith('.ts')
        && !process.execArgv.includes('--experimental-strip-types')
        ? [...process.execArgv, '--experimental-strip-types']
        : process.execArgv,
    })
    this.worker.on('message', (response: Record<string, unknown>) => {
      const id = requiredInteger(response.id, 'worker response id')
      const pending = this.pending.get(id)
      if (!pending) return
      this.pending.delete(id)
      if (response.type === 'error') pending.reject(new Error(String(response.error)))
      else pending.resolve(response)
    })
    this.worker.on('error', error => this.rejectAll(error))
    this.worker.on('exit', (code) => {
      if (!this.closed && code !== 0) {
        this.rejectAll(new Error(`ML bot policy worker exited with code ${code}`))
      }
    })
  }

  static async create(checkpoint: Uint8Array): Promise<MlBotPolicyInferenceWorker> {
    decodeMlBotPolicyCheckpoint(checkpoint)
    const inference = new MlBotPolicyInferenceWorker()
    const copy = checkpoint.slice()
    try {
      await inference.call({ checkpoint: copy.buffer, type: 'initialize' }, [copy.buffer])
      return inference
    } catch (error) {
      await inference.close()
      throw error
    }
  }

  async infer(
    observation: Float32Array,
    plan: MlBotPolicyActionMaskPlan,
  ): Promise<MlBotPolicyInferenceResult> {
    const observationCopy = observation.slice()
    const movement = plan.movement.slice()
    const target = plan.target.slice()
    const abilityByTarget = flattenMasks(plan.abilityByTarget, 9, 22, 'ability')
    const aimByAbility = flattenMasks(plan.aimByAbility, 22, 9, 'aim')
    const response = await this.call({
      abilityByTarget: abilityByTarget.buffer,
      aimByAbility: aimByAbility.buffer,
      movement: movement.buffer,
      observation: observationCopy.buffer,
      target: target.buffer,
      type: 'infer',
    }, [
      observationCopy.buffer,
      movement.buffer,
      target.buffer,
      abilityByTarget.buffer,
      aimByAbility.buffer,
    ])
    return {
      actions: requiredActions(response.actions),
      logProbability: requiredFinite(response.logProbability, 'worker log probability'),
      value: requiredFinite(response.value, 'worker value'),
    }
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    this.rejectAll(new Error('ML bot policy worker closed'))
    await this.worker.terminate()
  }

  private call(
    message: Record<string, unknown>,
    transfer: readonly ArrayBuffer[],
  ): Promise<Record<string, unknown>> {
    if (this.closed) return Promise.reject(new Error('ML bot policy worker is closed'))
    const id = this.nextId
    this.nextId += 1
    return new Promise((resolve, reject) => {
      this.pending.set(id, { reject, resolve })
      this.worker.postMessage({ ...message, id }, transfer)
    })
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }
}

export class MlBotHostController {
  private readonly adapter: MlBotHostControllerAdapter
  private readonly character: PlayerCharacterConfig
  private decisionPending = false
  private readonly entrance = new MlBotEntranceNavigator()
  private failed = false
  private readonly inference: MlBotPolicyInference
  private loadoutKey: string | null = null
  private nextDecisionTick = 0
  private readonly observer: MlBotPolicyObserver
  private readonly playerId: string
  private worldKey: string | null = null

  constructor(
    adapter: MlBotHostControllerAdapter,
    character: PlayerCharacterConfig,
    inference: MlBotPolicyInference,
    playerId: string,
  ) {
    this.adapter = adapter
    this.character = character
    this.inference = inference
    this.observer = new MlBotPolicyObserver(playerId)
    this.playerId = playerId
  }

  tick(): void {
    if (this.failed) return
    const context = this.adapter.context()
    if (!context) return
    const worldKey = policyWorldKey(context.state)
    if (worldKey !== this.worldKey) {
      this.worldKey = worldKey
      this.observer.reset()
      this.nextDecisionTick = context.state.tick
      this.loadoutKey = null
    }
    if (context.state.world.kind === 'hub') return
    if (context.state.run.phase === 'loadout') {
      const loadoutKey = context.state.run.lastCompletedRunId ?? 'post-run-loadout'
      if (loadoutKey !== this.loadoutKey) {
        this.loadoutKey = loadoutKey
        this.adapter.dispatch({
          character: {
            discipline: this.character.discipline,
            element: this.character.element,
          },
          kind: 'confirm-loadout',
        })
      }
      return
    }
    const entranceInput = this.entrance.input(context.state, this.playerId)
    if (entranceInput !== null) {
      this.adapter.dispatch({ input: entranceInput, kind: 'scripted-input' })
      return
    }
    const skillChoice = resolveMlBotPolicySkillOffers(
      context.state,
      [this.playerId],
    ).selections[0] ?? null
    if (skillChoice !== null) {
      this.adapter.dispatch({
        choiceIndex: skillChoice.choiceIndex,
        kind: 'select-skill',
        offerSequence: skillChoice.offerSequence,
        skillId: skillChoice.skillId,
      })
      return
    }
    if (
      context.state.run.phase !== 'active'
      || this.decisionPending
      || context.state.tick < this.nextDecisionTick
    ) return
    const frame = this.observer.observe(context.state, {
      activeInputs: context.activeInputs,
      controllers: context.controllers,
    })
    const plan = createMlBotPolicyActionMaskPlan(context.state, this.playerId, frame)
    const decisionWorldKey = worldKey
    this.decisionPending = true
    void this.inference.infer(frame.values, plan).then(({ actions }) => {
      const current = this.adapter.context()
      if (!current || policyWorldKey(current.state) !== decisionWorldKey) return
      const decision = resolveMlBotPolicyDecision(
        context.state,
        this.playerId,
        frame,
        actions,
      )
      this.observer.commit(decision.committedAction, decision.targetId)
      this.adapter.dispatch(decision.hubAction === null
        ? { input: decision.input, kind: 'input' }
        : { action: decision.hubAction, kind: 'hub-action' })
      this.nextDecisionTick = current.state.tick + ML_BOT_DECISION_INTERVAL_TICKS
    }).catch((error: unknown) => this.fail(error)).finally(() => {
      this.decisionPending = false
    })
  }

  private fail(error: unknown): void {
    if (this.failed) return
    this.failed = true
    this.adapter.fail(error instanceof Error ? error : new Error(String(error)))
  }
}

function flattenMasks(
  rows: readonly Uint8Array[],
  rowCount: number,
  width: number,
  label: string,
): Uint8Array<ArrayBuffer> {
  if (rows.length !== rowCount) throw new RangeError(`ML bot ${label} mask rows are invalid`)
  const result = new Uint8Array(new ArrayBuffer(rowCount * width))
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!
    if (row.length !== width) throw new RangeError(`ML bot ${label} mask width is invalid`)
    result.set(row, index * width)
  }
  return result
}

function requiredActions(value: unknown): MlBotPolicyActionIndices {
  if (value === null || typeof value !== 'object') {
    throw new Error('ML bot policy worker returned invalid actions')
  }
  const source = value as Record<string, unknown>
  return {
    ability: requiredAction(source.ability, 22, 'ability'),
    aim: requiredAction(source.aim, 9, 'aim'),
    movement: requiredAction(source.movement, 9, 'movement'),
    target: requiredAction(source.target, 9, 'target'),
  }
}

function requiredAction(value: unknown, count: number, label: string): number {
  const action = requiredInteger(value, `worker ${label} action`)
  if (action < 0 || action >= count) throw new RangeError(`ML bot worker ${label} action is invalid`)
  return action
}

function requiredInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value)) throw new Error(`ML bot policy ${label} must be an integer`)
  return value as number
}

function requiredFinite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`ML bot policy ${label} must be finite`)
  }
  return value
}

function policyWorldKey(state: GameSimulationState): string {
  return state.world.kind === 'boneyard' ? `boneyard:${state.world.runId}` : 'hub'
}
