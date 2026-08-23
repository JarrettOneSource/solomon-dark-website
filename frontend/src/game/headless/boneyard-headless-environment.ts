import type { LoadedBoneyard, NativeBoneyardTemplate } from '../core-kernels/boneyard.ts'
import { startBoneyardArenaTransition } from '../core-kernels/boneyard-arena-transition.ts'
import { startBoneyardWaveDirector } from '../core-kernels/boneyard-wave-director.ts'
import {
  createIdlePlayerCharacterInput,
  PLAYER_CHARACTER_RADIUS,
  type PlayerCharacterConfig,
  type PlayerCharacterInput,
} from '../core-kernels/player-character.ts'
import {
  addPlayerCharacter,
  applyGameSimulationHubAction,
  createGameSimulation,
  enterBoneyardWorld,
  gameSimulationPlayerRecords,
  getPlayerProgression,
  selectGameSimulationPlayerSkill,
  stepGameSimulationTick,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'
import { resolveBoneyardSpawnPosition } from '../core-server/boneyard-collision.ts'
import { replacePlayerCharacter } from '../core-server/player-entity-store.ts'
import {
  createMlBotPolicyActionMaskPlan,
  ML_BOT_POLICY_ACTION_STRIDE,
  resolveMlBotPolicyDecision,
  type MlBotPolicyActionIndices,
  type MlBotPolicyActionMaskPlan,
  type MlBotPolicyActionMasks,
} from '../core-server/ml-bot-policy/actions.ts'
import { evaluateMlBotPolicyDecision } from '../core-server/ml-bot-policy/agent.ts'
import { selectMlBotPolicyExpertAction } from '../core-server/ml-bot-policy/expert.ts'
import {
  MlBotPolicyChoiceTrajectoryTracker,
  type MlBotPolicyChoiceTrajectoryRecord,
} from '../core-server/ml-bot-policy/choice-trajectory.ts'
import { MlBotPolicyObserver, type MlBotPolicyFrame } from '../core-server/ml-bot-policy/observer.ts'
import {
  MlBotPolicyRewardAccumulator,
  mlBotPolicyTerminal,
  type MlBotPolicyRewardResult,
} from '../core-server/ml-bot-policy/reward.ts'
import {
  MlBotPolicyRuntime,
  type MlBotPolicySelectionOptions,
} from '../core-server/ml-bot-policy/runtime.ts'
import {
  resolveMlBotPolicySkillOffers,
  type MlBotPolicyScriptedChoiceEvent,
  type MlBotPolicySkillSelection,
} from '../core-server/ml-bot-policy/skill-chooser.ts'
import { describeMlBotPolicySkillOffer } from '../core-server/ml-bot-policy/skill-options.ts'
import { ML_BOT_POLICY_OBSERVATION_NAMES } from '../core-server/ml-bot-policy/spec.ts'
import type { MlBotPolicyMainTrajectoryRecord } from '../core-server/ml-bot-policy/trajectory.ts'
import { NATIVE_GENERATED_BONEYARDS } from '../host/native-generated-boneyards.ts'
import { deterministicStateHash } from './hub-headless-environment.ts'

export { ML_BOT_POLICY_ACTION_STRIDE as BONEYARD_HEADLESS_ACTION_STRIDE }
export const BONEYARD_HEADLESS_OBSERVATION_LENGTH = ML_BOT_POLICY_OBSERVATION_NAMES.length

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
  readonly choiceMode?: 'learned' | 'scripted'
}

export interface BoneyardHeadlessChoicePlan {
  readonly generation: number
  readonly observation: Float32Array
  readonly optionDescriptors: Float32Array
  readonly optionIds: readonly number[]
  readonly optionMask: Uint8Array
}

export interface BoneyardHeadlessLearnedChoice {
  readonly oldLogProbability: number
  readonly oldValue: number
  readonly selectedOption: number
}

export interface MlBotPolicyLearnedChoiceEvent {
  readonly accepted: true
  readonly choiceMode: 'learned'
  readonly generation: number
  readonly observation: Float32Array
  readonly oldLogProbability: number
  readonly oldValue: number
  readonly optionDescriptors: Float32Array
  readonly optionIds: readonly number[]
  readonly optionMask: Uint8Array
  readonly participantId: string
  readonly selectedOption: number
  readonly simulationTick: number
  readonly trainable: true
}

export type MlBotPolicyChoiceEvent =
  | MlBotPolicyLearnedChoiceEvent
  | MlBotPolicyScriptedChoiceEvent

export interface BoneyardHeadlessTransition {
  readonly actions: MlBotPolicyActionIndices
  readonly choiceEvents: readonly MlBotPolicyChoiceEvent[]
  readonly choiceIntervals: readonly MlBotPolicyChoiceTrajectoryRecord[]
  readonly done: boolean
  readonly masks: MlBotPolicyActionMasks
  readonly nextObservation: Float32Array
  readonly nextSimulationTick: number
  readonly nextStateHash: string
  readonly observation: Float32Array
  readonly reward: MlBotPolicyRewardResult
  readonly simulationTick: number
  readonly skillSelections: readonly MlBotPolicySkillSelection[]
  readonly stateHash: string
  readonly ticks: number
}

export interface BoneyardHeadlessPolicyStep {
  readonly nextObservation: Float32Array
  readonly record: MlBotPolicyMainTrajectoryRecord
  readonly transition: BoneyardHeadlessTransition
}

export interface BoneyardHeadlessEpisodeMetadata {
  readonly geometrySha256: string
  readonly runId: string
  readonly seed: number
}

export class BoneyardHeadlessEnvironment {
  readonly observationLength = BONEYARD_HEADLESS_OBSERVATION_LENGTH
  private readonly agent: PlayerCharacterConfig
  private readonly allies: readonly PlayerCharacterConfig[]
  private readonly choiceMode: 'learned' | 'scripted'
  private choiceTracker: MlBotPolicyChoiceTrajectoryTracker
  private frame: MlBotPolicyFrame
  private lastTransitionValue: BoneyardHeadlessTransition | null = null
  private lastMasks: MlBotPolicyActionMasks
  private readonly observer = new MlBotPolicyObserver(HEADLESS_PLAYER_ID)
  private readonly pendingChoiceEvents: MlBotPolicyChoiceEvent[] = []
  private readonly pendingSkillSelections: MlBotPolicySkillSelection[] = []
  private resetOptions: BoneyardHeadlessResetOptions
  private simulation: GameSimulationState

  constructor(options: BoneyardHeadlessEnvironmentOptions) {
    this.agent = Object.freeze({ ...(options.agent ?? DEFAULT_AGENT) })
    this.allies = Object.freeze((options.allies ?? []).map((ally) => Object.freeze({ ...ally })))
    this.choiceMode = options.choiceMode ?? 'scripted'
    this.resetOptions = validatedResetOptions(options)
    this.choiceTracker = this.createChoiceTracker(this.resetOptions)
    this.simulation = this.createSimulation(this.resetOptions)
    this.frame = this.observeState({})
    this.lastTransitionValue = null
    this.pendingChoiceEvents.length = 0
    this.pendingSkillSelections.length = 0
    this.lastMasks = resolveMlBotPolicyDecision(this.simulation, HEADLESS_PLAYER_ID, this.frame, {
      ability: 0,
      aim: 0,
      movement: 0,
      target: 0,
    }).masks
  }

  reset(options: BoneyardHeadlessResetOptions = this.resetOptions): Float32Array {
    this.resetOptions = validatedResetOptions(options)
    this.choiceTracker = this.createChoiceTracker(this.resetOptions)
    this.observer.reset()
    this.simulation = this.createSimulation(this.resetOptions)
    this.frame = this.observeState({})
    this.lastTransitionValue = null
    this.pendingChoiceEvents.length = 0
    this.pendingSkillSelections.length = 0
    this.lastMasks = resolveMlBotPolicyDecision(this.simulation, HEADLESS_PLAYER_ID, this.frame, {
      ability: 0,
      aim: 0,
      movement: 0,
      target: 0,
    }).masks
    return this.observe()
  }

  step(actions: Float32Array, ticks = 1): Float32Array {
    return this.stepTransition(actions, ticks).nextObservation
  }

  stepPacked(actions: Float32Array, offset: number, ticks = 1): void {
    this.stepPackedTransition(actions, offset, ticks)
  }

  stepTransition(actions: Float32Array, ticks = 1): BoneyardHeadlessTransition {
    return this.stepPackedTransition(actions, 0, ticks)
  }

  stepPolicy(
    runtime: MlBotPolicyRuntime,
    options: MlBotPolicySelectionOptions,
    ticks = 1,
  ): BoneyardHeadlessPolicyStep {
    const evaluated = evaluateMlBotPolicyDecision(
      runtime,
      this.simulation,
      HEADLESS_PLAYER_ID,
      this.frame,
      options,
    )
    const actions = createBoneyardHeadlessActionBuffer()
    actions[0] = evaluated.evaluation.actions.movement
    actions[1] = evaluated.evaluation.actions.target
    actions[2] = evaluated.evaluation.actions.ability
    actions[3] = evaluated.evaluation.actions.aim
    const transition = this.stepTransition(actions, ticks)
    const record: MlBotPolicyMainTrajectoryRecord = Object.freeze({
      actions: evaluated.evaluation.actions,
      done: transition.done,
      episodeId: deterministicBoneyard(this.resetOptions.seed).runId,
      masks: evaluated.evaluation.masks,
      observation: transition.observation,
      oldLogProbability: evaluated.evaluation.logProbability,
      oldValue: evaluated.evaluation.value,
      participantId: HEADLESS_PLAYER_ID,
      reward: transition.reward.reward,
      rewardTerms: transition.reward.terms,
      simulationTick: transition.simulationTick,
      ticks: transition.ticks,
      trajectoryVersion: 6,
    })
    return Object.freeze({
      nextObservation: transition.nextObservation,
      record,
      transition,
    })
  }

  stepPackedTransition(
    actions: Float32Array,
    offset: number,
    ticks = 1,
  ): BoneyardHeadlessTransition {
    validateActionSlice(actions, offset)
    validateTicks(ticks)
    if (this.choiceMode === 'learned') {
      if (this.choicePlan() !== null) {
        throw new Error('learned Boneyard skill choice must be selected before stepping')
      }
      this.resolveScriptedAllies()
    }
    const selected: MlBotPolicyActionIndices = {
      movement: actions[offset]!,
      target: actions[offset + 1]!,
      ability: actions[offset + 2]!,
      aim: actions[offset + 3]!,
    }
    if (mlBotPolicyTerminal(this.simulation, HEADLESS_PLAYER_ID)) {
      if (Object.values(selected).some(action => action !== 0)) {
        throw new Error('terminal Boneyard environments accept only null actions')
      }
      const stateHash = this.stateHash()
      const masks = terminalActionMasks()
      const transition: BoneyardHeadlessTransition = Object.freeze({
        actions: Object.freeze({ ...selected }),
        choiceEvents: Object.freeze([]),
        choiceIntervals: Object.freeze([]),
        done: true,
        masks,
        nextObservation: this.frame.values.slice(),
        nextSimulationTick: this.simulation.tick,
        nextStateHash: stateHash,
        observation: this.frame.values.slice(),
        reward: Object.freeze({
          clamped: false,
          gameplay: Object.freeze({
            enemyKills: 0,
            enemyKillsByKind: Object.freeze({}),
            goldCollected: 0,
            healthOrbsCollected: 0,
            itemKinds: Object.freeze({}),
            itemsCollected: 0,
            manaOrbsCollected: 0,
            potionsUsed: 0,
            powerupsCollected: 0,
            skillPicks: 0,
            wavesCompleted: 0,
          }),
          raw: 0,
          reward: 0,
          terms: Object.freeze({ death: 0, ownDamage: 0, selfHp: 0, wave: 0, xp: 0 }),
        }),
        simulationTick: this.simulation.tick,
        skillSelections: Object.freeze([]),
        stateHash,
        ticks: 0,
      })
      this.lastMasks = masks
      this.lastTransitionValue = transition
      return transition
    }
    const decision = resolveMlBotPolicyDecision(
      this.simulation,
      HEADLESS_PLAYER_ID,
      this.frame,
      selected,
    )
    const observation = this.frame.values.slice()
    const simulationTick = this.simulation.tick
    const stateHash = this.stateHash()
    this.lastMasks = decision.masks
    this.observer.commit(decision.committedAction, decision.targetId)
    const rewardAccumulator = new MlBotPolicyRewardAccumulator(HEADLESS_PLAYER_ID)
    rewardAccumulator.begin(this.simulation)
    const skillSelections: MlBotPolicySkillSelection[] = this.pendingSkillSelections.splice(0)
    const choiceEvents: MlBotPolicyChoiceEvent[] = this.pendingChoiceEvents.splice(0)
    if (this.choiceMode === 'scripted' && this.simulation.levelUpBarrier !== null) {
      const resolved = resolveMlBotPolicySkillOffers(
        this.simulation,
        this.playerIds(),
        { [HEADLESS_PLAYER_ID]: this.frame.values },
      )
      this.simulation = resolved.state
      skillSelections.push(...resolved.selections)
      choiceEvents.push(...resolved.events)
      for (const event of resolved.events) this.openScriptedChoice(event)
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
    let executedTicks = 0
    for (let tick = 0; tick < ticks; tick += 1) {
      const inputs: Record<string, PlayerCharacterInput> = {
        [HEADLESS_PLAYER_ID]: decision.input,
      }
      for (const allyId of this.allyIds()) inputs[allyId] = scriptedAllyInput(this.simulation, allyId)
      this.simulation = stepGameSimulationTick(this.simulation, inputs, {
        attributionObserver: rewardAccumulator.attributionObserver(),
      })
      executedTicks += 1
      this.frame = this.observeState(inputs)
      if (mlBotPolicyTerminal(this.simulation, HEADLESS_PLAYER_ID)) break
    }
    const done = mlBotPolicyTerminal(this.simulation, HEADLESS_PLAYER_ID)
    const baseReward = rewardAccumulator.finish(this.simulation, done)
    const reward = Object.freeze({
      ...baseReward,
      gameplay: Object.freeze({
        ...baseReward.gameplay,
        potionsUsed: Number(decision.hubAction?.type === 'consume'),
        skillPicks: skillSelections.filter(({ playerId }) => (
          playerId === HEADLESS_PLAYER_ID
        )).length,
      }),
    })
    this.choiceTracker.accumulate(reward.reward, executedTicks)
    if (done) this.choiceTracker.finish(true)
    const transition = Object.freeze({
      actions: Object.freeze({ ...selected }),
      choiceEvents: Object.freeze(choiceEvents),
      choiceIntervals: Object.freeze(this.choiceTracker.drain()),
      done,
      masks: decision.masks,
      nextObservation: this.frame.values.slice(),
      nextSimulationTick: this.simulation.tick,
      nextStateHash: this.stateHash(),
      observation,
      reward,
      simulationTick,
      skillSelections: Object.freeze(skillSelections),
      stateHash,
      ticks: executedTicks,
    })
    this.lastTransitionValue = transition
    return transition
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

  choicePlan(): BoneyardHeadlessChoicePlan | null {
    if (this.choiceMode !== 'learned') return null
    const description = describeMlBotPolicySkillOffer(this.simulation, HEADLESS_PLAYER_ID)
    if (description === null) return null
    return Object.freeze({
      generation: description.generation,
      observation: this.frame.values.slice(),
      optionDescriptors: description.descriptors.slice(),
      optionIds: Object.freeze([...description.optionIds]),
      optionMask: description.mask.slice(),
    })
  }

  selectLearnedChoice(choice: BoneyardHeadlessLearnedChoice): MlBotPolicySkillSelection {
    if (this.choiceMode !== 'learned') {
      throw new Error('scripted Boneyard environments do not accept learned skill choices')
    }
    if (!Number.isFinite(choice.oldLogProbability) || !Number.isFinite(choice.oldValue)) {
      throw new RangeError('learned Boneyard skill choice policy values must be finite')
    }
    const plan = this.choicePlan()
    const offer = getPlayerProgression(this.simulation, HEADLESS_PLAYER_ID).pendingOffer
    if (plan === null || offer === null) {
      throw new Error('learned Boneyard environment has no pending agent skill choice')
    }
    if (
      !Number.isInteger(choice.selectedOption)
      || choice.selectedOption < 0
      || choice.selectedOption >= offer.options.length
      || plan.optionMask[choice.selectedOption] !== 1
    ) throw new RangeError('learned Boneyard skill choice selected an illegal option')
    const option = offer.options[choice.selectedOption]!
    const selection: MlBotPolicySkillSelection = Object.freeze({
      choiceIndex: choice.selectedOption,
      offerSequence: offer.sequence,
      playerId: HEADLESS_PLAYER_ID,
      skillId: option.skillId,
    })
    const event: MlBotPolicyLearnedChoiceEvent = Object.freeze({
      accepted: true,
      choiceMode: 'learned',
      generation: plan.generation,
      observation: plan.observation,
      oldLogProbability: choice.oldLogProbability,
      oldValue: choice.oldValue,
      optionDescriptors: plan.optionDescriptors,
      optionIds: plan.optionIds,
      optionMask: plan.optionMask,
      participantId: HEADLESS_PLAYER_ID,
      selectedOption: choice.selectedOption,
      simulationTick: this.simulation.tick,
      trainable: true,
    })
    const applied = selectGameSimulationPlayerSkill(this.simulation, HEADLESS_PLAYER_ID, selection)
    if (applied === null) throw new Error('learned Boneyard agent skill choice was rejected')
    this.simulation = applied
    this.choiceTracker.open(event)
    this.pendingChoiceEvents.push(event)
    this.pendingSkillSelections.push(selection)
    this.resolveScriptedAllies()
    this.frame = this.observeState({})
    return selection
  }

  actionMasks(targetAction = 0, abilityAction = 0): MlBotPolicyActionMasks {
    return resolveMlBotPolicyDecision(this.simulation, HEADLESS_PLAYER_ID, this.frame, {
      ability: abilityAction,
      aim: 0,
      movement: 0,
      target: targetAction,
    }).masks
  }

  actionMaskPlan(): MlBotPolicyActionMaskPlan {
    return createMlBotPolicyActionMaskPlan(
      this.simulation,
      HEADLESS_PLAYER_ID,
      this.frame,
    )
  }

  expertAction(): MlBotPolicyActionIndices {
    return selectMlBotPolicyExpertAction(
      this.simulation,
      HEADLESS_PLAYER_ID,
      this.frame,
    )
  }

  lastActionMasks(): MlBotPolicyActionMasks {
    return this.lastMasks
  }

  lastTransition(): BoneyardHeadlessTransition {
    if (this.lastTransitionValue === null) {
      throw new Error('Boneyard headless environment has no completed transition')
    }
    return this.lastTransitionValue
  }

  stateHash(): string {
    return deterministicStateHash(authoritativeHashState(this.simulation))
  }

  state(): Readonly<GameSimulationState> {
    return this.simulation
  }

  episodeMetadata(): BoneyardHeadlessEpisodeMetadata {
    const boneyard = deterministicBoneyard(this.resetOptions.seed)
    return {
      geometrySha256: boneyard.geometrySha256,
      runId: boneyard.runId,
      seed: this.resetOptions.seed,
    }
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
    const world = simulation.world
    if (world.kind !== 'boneyard') {
      throw new Error('headless Boneyard did not materialize its retail encounter')
    }
    const encounter = world.encounter
    const sourceArenaTransition = world.arenaTransition
    const waves = world.waves
    if (encounter === null || sourceArenaTransition === null || waves === null) {
      throw new Error('headless Boneyard did not materialize its retail encounter')
    }
    const arenaTransition = startBoneyardArenaTransition(sourceArenaTransition)
    let playerEntities = simulation.playerEntities
    const players = gameSimulationPlayerRecords(simulation)
    const playerIds = this.playerIds()
    for (const [index, playerId] of playerIds.entries()) {
      const player = players[playerId]
      if (!player) throw new Error(`headless Boneyard has no player ${playerId}`)
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
      ...simulation,
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

  private createChoiceTracker(
    options: BoneyardHeadlessResetOptions,
  ): MlBotPolicyChoiceTrajectoryTracker {
    return new MlBotPolicyChoiceTrajectoryTracker(
      deterministicBoneyard(options.seed).runId,
      HEADLESS_PLAYER_ID,
    )
  }

  private openScriptedChoice(event: MlBotPolicyScriptedChoiceEvent): void {
    this.choiceTracker.open({
      ...event,
      oldLogProbability: 0,
      oldValue: 0,
    })
  }

  private resolveScriptedAllies(): void {
    if (this.simulation.levelUpBarrier === null || this.allies.length === 0) return
    const resolved = resolveMlBotPolicySkillOffers(this.simulation, this.allyIds())
    this.simulation = resolved.state
    this.pendingSkillSelections.push(...resolved.selections)
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
    ...createIdlePlayerCharacterInput(),
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

function terminalActionMasks(): MlBotPolicyActionMasks {
  const movement = new Uint8Array(9)
  const target = new Uint8Array(9)
  const ability = new Uint8Array(22)
  const aim = new Uint8Array(9)
  movement[0] = 1
  target[0] = 1
  ability[0] = 1
  aim[0] = 1
  return { ability, aim, movement, target }
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
