import type { LoadedBoneyard, NativeBoneyardTemplate } from '../core-kernels/boneyard.ts'
import { startBoneyardWaveDirector } from '../core-kernels/boneyard-wave-director.ts'
import {
  createIdlePlayerCharacterInput,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import {
  addPlayerCharacter,
  applyGameSimulationHubAction,
  createGameSimulation,
  enterBoneyardWorld,
  gameSimulationPlayerRecords,
  stepGameSimulationTick,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'
import {
  ML_BOT_POLICY_ACTION_STRIDE,
  resolveMlBotPolicyDecision,
  type MlBotPolicyActionMasks,
} from '../core-server/ml-bot-policy/actions.ts'
import { MlBotPolicyObserver, type MlBotPolicyFrame } from '../core-server/ml-bot-policy/observer.ts'
import { resolveMlBotPolicySkillOffers } from '../core-server/ml-bot-policy/skill-chooser.ts'
import { NATIVE_GENERATED_BONEYARDS } from '../host/native-generated-boneyards.ts'
import { deterministicStateHash } from './hub-headless-environment.ts'

export { ML_BOT_POLICY_ACTION_STRIDE as BONEYARD_HEADLESS_ACTION_STRIDE }
export const BONEYARD_HEADLESS_OBSERVATION_LENGTH = 1_784

const HEADLESS_PLAYER_ID = 'agent'
const DEFAULT_AGENT: PlayerCharacterConfig = Object.freeze({
  discipline: 'arcane',
  displayName: 'Headless Agent',
  element: 'fire',
})

export interface BoneyardHeadlessResetOptions {
  readonly seed: number
}

export interface BoneyardHeadlessEnvironmentOptions extends BoneyardHeadlessResetOptions {
  readonly agent?: PlayerCharacterConfig
  readonly allies?: readonly PlayerCharacterConfig[]
}

export class BoneyardHeadlessEnvironment {
  readonly observationLength = BONEYARD_HEADLESS_OBSERVATION_LENGTH
  private readonly agent: PlayerCharacterConfig
  private readonly allies: readonly PlayerCharacterConfig[]
  private frame: MlBotPolicyFrame
  private lastMasks: MlBotPolicyActionMasks
  private readonly observer = new MlBotPolicyObserver(HEADLESS_PLAYER_ID)
  private resetOptions: BoneyardHeadlessResetOptions
  private simulation: GameSimulationState

  constructor(options: BoneyardHeadlessEnvironmentOptions) {
    this.agent = Object.freeze({ ...(options.agent ?? DEFAULT_AGENT) })
    this.allies = Object.freeze((options.allies ?? []).map((ally) => Object.freeze({ ...ally })))
    this.resetOptions = validatedResetOptions(options)
    this.simulation = this.createSimulation(this.resetOptions)
    this.frame = this.observeState({})
    this.lastMasks = resolveMlBotPolicyDecision(this.simulation, HEADLESS_PLAYER_ID, this.frame, {
      ability: 0,
      aim: 0,
      movement: 0,
      target: 0,
    }).masks
  }

  reset(options: BoneyardHeadlessResetOptions = this.resetOptions): Float32Array {
    this.resetOptions = validatedResetOptions(options)
    this.observer.reset()
    this.simulation = this.createSimulation(this.resetOptions)
    this.frame = this.observeState({})
    this.lastMasks = resolveMlBotPolicyDecision(this.simulation, HEADLESS_PLAYER_ID, this.frame, {
      ability: 0,
      aim: 0,
      movement: 0,
      target: 0,
    }).masks
    return this.observe()
  }

  step(actions: Float32Array, ticks = 1): Float32Array {
    this.stepPacked(actions, 0, ticks)
    return this.observe()
  }

  stepPacked(actions: Float32Array, offset: number, ticks = 1): void {
    validateActionSlice(actions, offset)
    validateTicks(ticks)
    const selected = {
      movement: actions[offset]!,
      target: actions[offset + 1]!,
      ability: actions[offset + 2]!,
      aim: actions[offset + 3]!,
    }
    const decision = resolveMlBotPolicyDecision(
      this.simulation,
      HEADLESS_PLAYER_ID,
      this.frame,
      selected,
    )
    this.lastMasks = decision.masks
    this.observer.commit(decision.committedAction, decision.targetId)
    if (this.simulation.levelUpBarrier !== null) {
      this.simulation = resolveMlBotPolicySkillOffers(
        this.simulation,
        this.playerIds(),
      ).state
    }
    if (decision.hubAction) {
      const applied = applyGameSimulationHubAction(
        this.simulation,
        HEADLESS_PLAYER_ID,
        decision.hubAction,
      )
      if (!applied.accepted) {
        throw new Error(`ML bot policy legal potion action was rejected: ${applied.reason}`)
      }
      this.simulation = applied.state
    }
    for (let tick = 0; tick < ticks; tick += 1) {
      const inputs: Record<string, PlayerCharacterInput> = {
        [HEADLESS_PLAYER_ID]: decision.input,
      }
      for (const allyId of this.allyIds()) inputs[allyId] = scriptedAllyInput(this.simulation, allyId)
      this.simulation = stepGameSimulationTick(this.simulation, inputs)
      this.frame = this.observeState(inputs)
    }
  }

  observe(
    target = new Float32Array(this.observationLength),
    offset = 0,
  ): Float32Array {
    if (offset < 0 || offset + this.observationLength > target.length) {
      throw new RangeError('observation target does not contain the Boneyard environment stride')
    }
    target.set(this.frame.values, offset)
    return target
  }

  actionMasks(targetAction = 0, abilityAction = 0): MlBotPolicyActionMasks {
    return resolveMlBotPolicyDecision(this.simulation, HEADLESS_PLAYER_ID, this.frame, {
      ability: abilityAction,
      aim: 0,
      movement: 0,
      target: targetAction,
    }).masks
  }

  lastActionMasks(): MlBotPolicyActionMasks {
    return this.lastMasks
  }

  stateHash(): string {
    return deterministicStateHash(authoritativeHashState(this.simulation))
  }

  state(): Readonly<GameSimulationState> {
    return this.simulation
  }

  private createSimulation(options: BoneyardHeadlessResetOptions): GameSimulationState {
    let simulation = createGameSimulation({}, {
      combatRngSeed: options.seed,
      gameRngSeed: options.seed,
    })
    simulation = addPlayerCharacter(simulation, HEADLESS_PLAYER_ID, this.agent)
    for (const [index, ally] of this.allies.entries()) {
      simulation = addPlayerCharacter(simulation, `ally-${index + 1}`, ally)
    }
    simulation = enterBoneyardWorld(simulation, deterministicBoneyard(options.seed))
    if (simulation.world.kind !== 'boneyard' || simulation.world.waves === null) {
      throw new Error('headless Boneyard did not materialize its wave director')
    }
    return {
      ...simulation,
      world: {
        ...simulation.world,
        arenaTransition: null,
        encounter: null,
        waves: startBoneyardWaveDirector(simulation.world.waves),
      },
    }
  }

  private observeState(activeInputs: Readonly<Record<string, PlayerCharacterInput>>): MlBotPolicyFrame {
    return this.observer.observe(this.simulation, {
      activeInputs,
      controllers: Object.fromEntries(this.playerIds().map((playerId) => [playerId, 'bot' as const])),
    })
  }

  private allyIds(): readonly string[] {
    return this.allies.map((_, index) => `ally-${index + 1}`)
  }

  private playerIds(): readonly string[] {
    return [HEADLESS_PLAYER_ID, ...this.allyIds()]
  }
}

export function createBoneyardHeadlessActionBuffer(worldCount = 1): Float32Array {
  if (!Number.isInteger(worldCount) || worldCount < 1) {
    throw new RangeError('worldCount must be a positive integer')
  }
  return new Float32Array(worldCount * ML_BOT_POLICY_ACTION_STRIDE)
}

function deterministicBoneyard(seed: number): LoadedBoneyard {
  const template: NativeBoneyardTemplate = NATIVE_GENERATED_BONEYARDS[
    seed % NATIVE_GENERATED_BONEYARDS.length
  ]!
  const word = seed.toString(16).padStart(8, '0')
  return {
    choice: { id: 'default-random', name: 'Random Boneyard', source: 'default' },
    geometrySha256: template.geometrySha256,
    runId: `headless-${word}`,
    scene: template.scene,
    seed: word,
    sourceSha256: template.sourceSha256,
  }
}

function scriptedAllyInput(state: GameSimulationState, playerId: string): PlayerCharacterInput {
  if (state.world.kind !== 'boneyard') return createIdlePlayerCharacterInput()
  const player = gameSimulationPlayerRecords(state)[playerId]
  if (!player) return createIdlePlayerCharacterInput()
  const enemies = [
    ...state.world.enemies.actors.filter(({ lifeState }) => lifeState === 'alive'),
    ...state.world.enemies.maggots.filter(({ lifeState }) => lifeState === 'alive'),
  ].sort((left, right) => (
    distanceSquared(left.position, player.position) - distanceSquared(right.position, player.position)
    || left.id - right.id
  ))
  const target = enemies[0]
  if (!target) return createIdlePlayerCharacterInput()
  const dx = target.position.x - player.position.x
  const dy = target.position.y - player.position.y
  const distance = Math.hypot(dx, dy)
  const scale = distance > 1e-9 ? 1 / distance : 0
  return {
    aim: { ...target.position },
    cast: { primary: true, quickbar: null },
    movement: distance > 180 ? { x: dx * scale, y: dy * scale } : { x: 0, y: 0 },
  }
}

function authoritativeHashState(simulation: GameSimulationState): unknown {
  return simulation
}

function validatedResetOptions(options: BoneyardHeadlessResetOptions): BoneyardHeadlessResetOptions {
  if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffff_ffff) {
    throw new RangeError('headless seed must be a uint32')
  }
  return { seed: options.seed }
}

function validateActionSlice(actions: Float32Array, offset: number): void {
  if (
    !Number.isInteger(offset)
    || offset < 0
    || offset + ML_BOT_POLICY_ACTION_STRIDE > actions.length
  ) throw new RangeError('packed Boneyard action slice is out of bounds')
}

function validateTicks(ticks: number): void {
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 100_000) {
    throw new RangeError('ticks must be an integer within 1..100000')
  }
}

function distanceSquared(
  left: Readonly<{ x: number; y: number }>,
  right: Readonly<{ x: number; y: number }>,
): number {
  return (left.x - right.x) ** 2 + (left.y - right.y) ** 2
}
