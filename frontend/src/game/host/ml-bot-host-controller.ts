import { EventEmitter } from 'node:events'
import { Worker } from 'node:worker_threads'

import { WebSocket } from 'ws'

import type {
  PlayerCharacterConfig,
  PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import type { GameSimulationState } from '../core-server/game-simulation.ts'
import {
  createMlBotPolicyActionMaskPlan,
  resolveMlBotPolicyDecision,
  type MlBotPolicyActionIndices,
  type MlBotPolicyActionMaskPlan,
} from '../core-server/ml-bot-policy/actions.ts'
import { decodeMlBotPolicyCheckpoint } from '../core-server/ml-bot-policy/checkpoint.ts'
import { MlBotPolicyObserver } from '../core-server/ml-bot-policy/observer.ts'
import { chooseMlBotPolicySkillOffer } from '../core-server/ml-bot-policy/skill-chooser.ts'
import {
  encodeGameMessage,
  type ClientGameMessage,
} from '../protocol/game-protocol.ts'
import type { PlayerSocialProfile } from '../protocol/party-state.ts'

const DEFAULT_PROFILE: PlayerSocialProfile = Object.freeze({
  accountUsername: null,
  highestWave: null,
  totalPlaytimeMs: null,
})

export interface GameHostMlBotDefinition {
  readonly character: PlayerCharacterConfig
  readonly checkpoint: Uint8Array
  readonly credential: string
  readonly decisionIntervalTicks?: number
  readonly profile?: PlayerSocialProfile
}

export interface MlBotHostControllerContext {
  readonly activeInputs: Readonly<Record<string, PlayerCharacterInput>>
  readonly controllers: Readonly<Record<string, 'bot' | 'human'>>
  readonly state: GameSimulationState
}

export interface MlBotHostControllerAdapter {
  readonly context: () => MlBotHostControllerContext
  readonly dispatch: (message: ClientGameMessage) => void
  readonly fail: (error: Error) => void
  readonly isConnected: () => boolean
}

export interface MlBotPolicyWorkerResult {
  readonly actions: MlBotPolicyActionIndices
  readonly logProbability: number
  readonly value: number
}

export class MlBotHostConnection extends EventEmitter {
  readonly controller = 'bot' as const
  readyState: number = WebSocket.OPEN

  receive(message: ClientGameMessage): void {
    if (this.readyState !== WebSocket.OPEN) {
      throw new Error('ML bot host connection is closed')
    }
    this.emit('message', Buffer.from(encodeGameMessage(message)), false)
  }

  send(_payload: string): void {}

  close(code = 1_000, reason = ''): void {
    if (this.readyState === WebSocket.CLOSED) return
    this.readyState = WebSocket.CLOSED
    this.emit('close', code, Buffer.from(reason))
  }
}

export class MlBotPolicyInferenceWorker {
  private closed = false
  private nextId = 1
  private readonly pending = new Map<number, {
    readonly reject: (error: Error) => void
    readonly resolve: (result: Record<string, unknown>) => void
  }>()
  private readonly worker: Worker

  private constructor() {
    this.worker = new Worker(new URL('./ml-bot-policy-worker.ts', import.meta.url), {
      execArgv: process.execArgv.includes('--experimental-strip-types')
        ? process.execArgv
        : [...process.execArgv, '--experimental-strip-types'],
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
    const runtime = new MlBotPolicyInferenceWorker()
    const copy = checkpoint.slice()
    try {
      await runtime.call({ checkpoint: copy.buffer, type: 'initialize' }, [copy.buffer])
      return runtime
    } catch (error) {
      await runtime.close()
      throw error
    }
  }

  async infer(
    observation: Float32Array,
    plan: MlBotPolicyActionMaskPlan,
  ): Promise<MlBotPolicyWorkerResult> {
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
    const actions = requiredActions(response.actions)
    return {
      actions,
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
  private closed = false
  private decisionPending = false
  private readonly decisionIntervalTicks: number
  private nextDecisionTick = 0
  private readonly observer: MlBotPolicyObserver
  private readonly playerId: string
  private sequence = 1
  private worldKey: string | null = null

  private constructor(
    private readonly adapter: MlBotHostControllerAdapter,
    definition: GameHostMlBotDefinition,
    playerId: string,
    private readonly worker: MlBotPolicyInferenceWorker,
  ) {
    this.decisionIntervalTicks = definition.decisionIntervalTicks ?? 1
    this.observer = new MlBotPolicyObserver(playerId)
    this.playerId = playerId
  }

  static async create(
    adapter: MlBotHostControllerAdapter,
    definition: GameHostMlBotDefinition,
    playerId: string,
  ): Promise<MlBotHostController> {
    validateMlBotDefinition(definition)
    const worker = await MlBotPolicyInferenceWorker.create(definition.checkpoint)
    return new MlBotHostController(adapter, definition, playerId, worker)
  }

  tick(): void {
    if (this.closed || this.decisionPending || !this.adapter.isConnected()) return
    const context = this.adapter.context()
    const worldKey = policyWorldKey(context.state)
    if (worldKey !== this.worldKey) {
      this.worldKey = worldKey
      this.observer.reset()
      this.nextDecisionTick = context.state.tick
    }
    const skillChoice = chooseMlBotPolicySkillOffer(context.state, this.playerId)
    if (skillChoice !== null) {
      this.adapter.dispatch({
        choiceIndex: skillChoice.choiceIndex,
        offerSequence: skillChoice.offerSequence,
        skillId: skillChoice.skillId,
        type: 'client-select-skill',
      })
      return
    }
    if (context.state.tick < this.nextDecisionTick) return
    const frame = this.observer.observe(context.state, {
      activeInputs: context.activeInputs,
      controllers: context.controllers,
    })
    const plan = createMlBotPolicyActionMaskPlan(context.state, this.playerId, frame)
    this.decisionPending = true
    void this.worker.infer(frame.values, plan).then(({ actions }) => {
      if (this.closed || !this.adapter.isConnected()) return
      const decision = resolveMlBotPolicyDecision(context.state, this.playerId, frame, actions)
      this.observer.commit(decision.committedAction, decision.targetId)
      if (decision.hubAction !== null) {
        this.adapter.dispatch({ action: decision.hubAction, type: 'client-hub-action' })
      } else {
        this.adapter.dispatch({
          input: decision.input,
          sequence: this.sequence,
          targetTick: this.adapter.context().state.tick + 1,
          type: 'client-input',
        })
        this.sequence += 1
      }
      this.nextDecisionTick = this.adapter.context().state.tick + this.decisionIntervalTicks
    }).catch((error: unknown) => {
      if (!this.closed) {
        this.adapter.fail(error instanceof Error ? error : new Error(String(error)))
      }
    }).finally(() => {
      this.decisionPending = false
    })
  }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.worker.close()
  }
}

export function mlBotDefinitionProfile(
  definition: GameHostMlBotDefinition,
): PlayerSocialProfile {
  return definition.profile ?? DEFAULT_PROFILE
}

export function validateMlBotDefinition(definition: GameHostMlBotDefinition): void {
  if (definition.credential.length === 0) throw new Error('ML bot credential must not be empty')
  if (
    definition.decisionIntervalTicks !== undefined
    && (
      !Number.isSafeInteger(definition.decisionIntervalTicks)
      || definition.decisionIntervalTicks < 1
      || definition.decisionIntervalTicks > 100_000
    )
  ) throw new RangeError('ML bot decision interval must be within 1..100000 ticks')
  decodeMlBotPolicyCheckpoint(definition.checkpoint)
}

function flattenMasks(
  rows: readonly Uint8Array[],
  rowCount: number,
  width: number,
  label: string,
): Uint8Array {
  if (rows.length !== rowCount) throw new RangeError(`ML bot ${label} mask rows are invalid`)
  const result = new Uint8Array(rowCount * width)
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
