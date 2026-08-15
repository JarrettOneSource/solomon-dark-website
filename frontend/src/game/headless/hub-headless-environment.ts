import type { PlayerCharacterInput } from '../core-kernels/player-character.ts'
import { createHubStudentFixturePopulation } from '../core-server/hub-student-fixtures.ts'
import type { HubStudentRouteEndBehavior } from '../core-server/hub-students.ts'
import {
  createGameSimulation,
  gameSimulationPlayerRecords,
  getPlayerCharacter,
  stepGameSimulationTick,
  type GameSimulationState,
} from '../core-server/game-simulation.ts'

export const HUB_HEADLESS_ACTION_STRIDE = 6
export const HUB_HEADLESS_OBSERVATION_HEADER = 10
export const HUB_HEADLESS_STUDENT_STRIDE = 8

const HEADLESS_PLAYER_ID = 'agent'
const HEADLESS_CHARACTER = {
  discipline: 'arcane',
  displayName: 'Headless Agent',
  element: 'ether',
} as const

export interface HubHeadlessResetOptions {
  seed: number
  studentCount: number
}

export interface HubHeadlessEnvironmentOptions extends HubHeadlessResetOptions {
  maximumStudents?: number
  routeEndBehavior?: HubStudentRouteEndBehavior
}

export class HubHeadlessEnvironment {
  readonly observationLength: number
  private readonly action: PlayerCharacterInput = {
    aim: null,
    cast: { primary: false, secondary: null },
    movement: { x: 0, y: 0 },
  }
  private readonly maximumStudents: number
  private resetOptions: HubHeadlessResetOptions
  private readonly routeEndBehavior: HubStudentRouteEndBehavior
  private simulation: GameSimulationState

  constructor(options: HubHeadlessEnvironmentOptions) {
    this.maximumStudents = options.maximumStudents ?? options.studentCount
    if (!Number.isInteger(this.maximumStudents) || this.maximumStudents < options.studentCount) {
      throw new RangeError('maximumStudents must cover the reset Student population')
    }
    this.observationLength = HUB_HEADLESS_OBSERVATION_HEADER
      + this.maximumStudents * HUB_HEADLESS_STUDENT_STRIDE
    this.routeEndBehavior = options.routeEndBehavior ?? 'retire'
    this.resetOptions = validatedResetOptions(options)
    this.simulation = this.createSimulation(this.resetOptions)
  }

  reset(options: HubHeadlessResetOptions = this.resetOptions): Float32Array {
    if (options.studentCount > this.maximumStudents) {
      throw new RangeError('reset Student population exceeds observation capacity')
    }
    this.resetOptions = validatedResetOptions(options)
    this.simulation = this.createSimulation(this.resetOptions)
    return this.observe()
  }

  step(actions: Float32Array, ticks = 1): Float32Array {
    this.stepPacked(actions, 0, ticks)
    return this.observe()
  }

  stepPacked(actions: Float32Array, offset: number, ticks = 1): void {
    validateActionSlice(actions, offset)
    validateTicks(ticks)
    const movementX = finiteAction(actions[offset])
    const movementY = finiteAction(actions[offset + 1])
    const magnitude = Math.hypot(movementX, movementY)
    const scale = magnitude > 1 ? 1 / magnitude : 1
    this.action.movement.x = movementX * scale
    this.action.movement.y = movementY * scale
    const aimX = actions[offset + 2]
    const aimY = actions[offset + 3]
    this.action.aim = Number.isFinite(aimX) && Number.isFinite(aimY)
      ? { x: aimX, y: aimY }
      : null
    this.action.cast.primary = actions[offset + 4] > 0
    this.action.cast.secondary = actions[offset + 5] > 0 ? 0 : null
    const inputs = { [HEADLESS_PLAYER_ID]: this.action }
    for (let tick = 0; tick < ticks; tick += 1) {
      this.simulation = stepGameSimulationTick(this.simulation, inputs)
    }
  }

  observe(target = new Float32Array(this.observationLength), offset = 0): Float32Array {
    if (offset < 0 || offset + this.observationLength > target.length) {
      throw new RangeError('observation target does not contain the environment stride')
    }
    target.fill(0, offset, offset + this.observationLength)
    const player = getPlayerCharacter(this.simulation, HEADLESS_PLAYER_ID)
    if (this.simulation.world.kind !== 'hub') {
      throw new Error('headless environment lost its Hub agent')
    }
    const store = this.simulation.world.studentPopulation.store
    target[offset] = this.simulation.tick
    target[offset + 1] = player.position.x
    target[offset + 2] = player.position.y
    target[offset + 3] = player.velocity.x
    target[offset + 4] = player.velocity.y
    target[offset + 5] = player.headingIndex
    target[offset + 6] = player.gaitDegrees
    target[offset + 7] = player.walkCyclePrimary
    target[offset + 8] = player.footstepTick
    target[offset + 9] = store.size
    const count = Math.min(store.size, this.maximumStudents)
    for (let index = 0; index < count; index += 1) {
      const slot = store.slotAt(index)
      const start = offset + HUB_HEADLESS_OBSERVATION_HEADER
        + index * HUB_HEADLESS_STUDENT_STRIDE
      target[start] = store.entityId[slot]
      target[start + 1] = store.positionX[slot]
      target[start + 2] = store.positionY[slot]
      target[start + 3] = store.heading[slot]
      target[start + 4] = store.framePhase[slot]
      target[start + 5] = store.scale[slot]
      target[start + 6] = Number(store.readingAt(slot))
      target[start + 7] = store.radius[slot]
    }
    return target
  }

  stateHash(): string {
    return deterministicStateHash(authoritativeHashState(this.simulation))
  }

  state(): Readonly<GameSimulationState> {
    return this.simulation
  }

  private createSimulation(options: HubHeadlessResetOptions): GameSimulationState {
    return createGameSimulation({ [HEADLESS_PLAYER_ID]: HEADLESS_CHARACTER }, {
      hubStudentPopulation: createHubStudentFixturePopulation({
        count: options.studentCount,
        routeEndBehavior: this.routeEndBehavior,
        seed: options.seed,
      }),
    })
  }
}

function authoritativeHashState(simulation: GameSimulationState): unknown {
  if (simulation.world.kind !== 'hub') throw new Error('headless environment left the Hub')
  const population = simulation.world.studentPopulation
  return {
    accumulatorSeconds: simulation.accumulatorSeconds,
    players: gameSimulationPlayerRecords(simulation),
    tick: simulation.tick,
    world: {
      ambient: simulation.world.ambient,
      collisionRngState: simulation.world.collisionRngState,
      kind: simulation.world.kind,
      participants: simulation.world.participants,
      studentPopulation: {
        nextId: population.nextId,
        rarePathDenominator: population.rarePathDenominator,
        rngState: population.rngState,
        routeEndBehavior: population.routeEndBehavior,
        spawningEnabled: population.spawningEnabled,
        spawnRequestPending: population.spawnRequestPending,
        spawnTickerCounter: population.spawnTickerCounter,
        students: population.store.states(),
      },
    },
  }
}

export function createHubHeadlessActionBuffer(worldCount = 1): Float32Array {
  if (!Number.isInteger(worldCount) || worldCount < 1) {
    throw new RangeError('worldCount must be a positive integer')
  }
  const actions = new Float32Array(worldCount * HUB_HEADLESS_ACTION_STRIDE)
  for (let index = 0; index < worldCount; index += 1) {
    actions[index * HUB_HEADLESS_ACTION_STRIDE + 2] = Number.NaN
    actions[index * HUB_HEADLESS_ACTION_STRIDE + 3] = Number.NaN
  }
  return actions
}

export function deterministicStateHash(value: unknown): string {
  const hasher = new StableHasher()
  hasher.value(value)
  return hasher.hex()
}

class StableHasher {
  private hash = 0xcbf29ce484222325n
  private readonly numberBuffer = new ArrayBuffer(8)
  private readonly numberView = new DataView(this.numberBuffer)
  private readonly textEncoder = new TextEncoder()

  value(value: unknown): void {
    if (value === undefined) {
      this.tag(10)
      return
    }
    if (value === null) {
      this.tag(0)
      return
    }
    if (typeof value === 'boolean') {
      this.tag(value ? 2 : 1)
      return
    }
    if (typeof value === 'number') {
      this.tag(3)
      this.numberView.setFloat64(0, value, true)
      this.bytes(new Uint8Array(this.numberBuffer))
      return
    }
    if (typeof value === 'string') {
      this.tag(4)
      const bytes = this.textEncoder.encode(value)
      this.length(bytes.length)
      this.bytes(bytes)
      return
    }
    if (Array.isArray(value)) {
      this.tag(5)
      this.length(value.length)
      for (const entry of value) this.value(entry)
      return
    }
    if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      this.tag(6)
      const source = value as unknown as { length: number; [index: number]: number }
      this.length(source.length)
      for (let index = 0; index < source.length; index += 1) this.value(source[index])
      return
    }
    if (value instanceof Map) {
      this.tag(7)
      const entries = [...value.entries()].sort(([first], [second]) => (
        String(first).localeCompare(String(second))
      ))
      this.length(entries.length)
      for (const [key, entry] of entries) {
        this.value(key)
        this.value(entry)
      }
      return
    }
    if (value instanceof Set) {
      this.tag(8)
      const entries = [...value].sort((first, second) => (
        String(first).localeCompare(String(second))
      ))
      this.length(entries.length)
      for (const entry of entries) this.value(entry)
      return
    }
    if (typeof value === 'object') {
      this.tag(9)
      const source = value as Record<string, unknown>
      const keys = Object.keys(source).sort()
      this.length(keys.length)
      for (const key of keys) {
        this.value(key)
        this.value(source[key])
      }
      return
    }
    throw new TypeError(`Unsupported deterministic hash value: ${typeof value}`)
  }

  hex(): string {
    return this.hash.toString(16).padStart(16, '0')
  }

  private tag(value: number): void {
    this.byte(value)
  }

  private length(value: number): void {
    this.numberView.setUint32(0, value, true)
    this.bytes(new Uint8Array(this.numberBuffer, 0, 4))
  }

  private bytes(values: Uint8Array): void {
    for (const value of values) this.byte(value)
  }

  private byte(value: number): void {
    this.hash ^= BigInt(value)
    this.hash = BigInt.asUintN(64, this.hash * 0x100000001b3n)
  }
}

function validatedResetOptions(options: HubHeadlessResetOptions): HubHeadlessResetOptions {
  if (!Number.isInteger(options.seed) || options.seed < 0 || options.seed > 0xffff_ffff) {
    throw new RangeError('headless seed must be a uint32')
  }
  if (!Number.isInteger(options.studentCount) || options.studentCount < 0) {
    throw new RangeError('headless Student count must be a nonnegative integer')
  }
  return { seed: options.seed, studentCount: options.studentCount }
}

function validateActionSlice(actions: Float32Array, offset: number): void {
  if (!Number.isInteger(offset) || offset < 0 || offset + HUB_HEADLESS_ACTION_STRIDE > actions.length) {
    throw new RangeError('packed action slice is out of bounds')
  }
}

function validateTicks(ticks: number): void {
  if (!Number.isInteger(ticks) || ticks < 1 || ticks > 100_000) {
    throw new RangeError('ticks must be an integer within 1..100000')
  }
}

function finiteAction(value: number): number {
  return Number.isFinite(value) ? value : 0
}
