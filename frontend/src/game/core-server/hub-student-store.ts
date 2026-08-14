import type {
  HubStudentProp,
  HubStudentState,
} from './hub-students.ts'
import { actorHeadingIndex } from '../core-kernels/actor-heading.ts'

const INITIAL_CAPACITY = 32
const FLAG_READING = 1 << 0
const FLAG_RETIRED = 1 << 1
const FLAG_STATIC_COLLISION = 1 << 2

export class HubStudentStore {
  activeSlots: Uint32Array
  currentSpeed: Float64Array
  desiredSpeed: Float64Array
  entityId: Uint32Array
  flags: Uint8Array
  framePhase: Float64Array
  gaitDegrees: Float64Array
  heading: Float64Array
  pathCursor: Float64Array
  pathId: Uint32Array
  pathStep: Int8Array
  positionX: Float64Array
  positionY: Float64Array
  propSets: Array<readonly HubStudentProp[] | undefined>
  pushResistance: Float64Array
  pushStrength: Float64Array
  radius: Float64Array
  rngState: Uint32Array
  scale: Float64Array
  tick: Uint32Array
  wanderX: Float64Array
  wanderY: Float64Array

  private activeLength = 0
  private capacity: number
  private readonly freeSlots: number[] = []
  private nextUnusedSlot = 0
  private readonly slotById = new Map<number, number>()

  constructor(initialCapacity = INITIAL_CAPACITY) {
    this.capacity = validCapacity(initialCapacity)
    this.activeSlots = new Uint32Array(this.capacity)
    this.currentSpeed = new Float64Array(this.capacity)
    this.desiredSpeed = new Float64Array(this.capacity)
    this.entityId = new Uint32Array(this.capacity)
    this.flags = new Uint8Array(this.capacity)
    this.framePhase = new Float64Array(this.capacity)
    this.gaitDegrees = new Float64Array(this.capacity)
    this.heading = new Float64Array(this.capacity)
    this.pathCursor = new Float64Array(this.capacity)
    this.pathId = new Uint32Array(this.capacity)
    this.pathStep = new Int8Array(this.capacity)
    this.positionX = new Float64Array(this.capacity)
    this.positionY = new Float64Array(this.capacity)
    this.propSets = new Array(this.capacity)
    this.pushResistance = new Float64Array(this.capacity)
    this.pushStrength = new Float64Array(this.capacity)
    this.radius = new Float64Array(this.capacity)
    this.rngState = new Uint32Array(this.capacity)
    this.scale = new Float64Array(this.capacity)
    this.tick = new Uint32Array(this.capacity)
    this.wanderX = new Float64Array(this.capacity)
    this.wanderY = new Float64Array(this.capacity)
  }

  static fromStates(states: readonly HubStudentState[]): HubStudentStore {
    const store = new HubStudentStore(Math.max(INITIAL_CAPACITY, states.length))
    for (const state of states) store.add(state)
    return store
  }

  get size(): number {
    return this.activeLength
  }

  add(state: HubStudentState): number {
    if (this.slotById.has(state.id)) {
      throw new Error(`Student ${state.id} already occupies a component slot`)
    }
    const slot = this.freeSlots.pop() ?? this.nextUnusedSlot
    if (slot === this.nextUnusedSlot) this.nextUnusedSlot += 1
    this.ensureCapacity(Math.max(this.nextUnusedSlot, this.activeLength + 1))
    this.activeSlots[this.activeLength] = slot
    this.activeLength += 1
    this.slotById.set(state.id, slot)
    this.write(slot, state)
    return slot
  }

  removeById(entityId: number): boolean {
    const slot = this.slotById.get(entityId)
    return slot === undefined ? false : this.removeSlot(slot)
  }

  removeSlot(slot: number): boolean {
    const entityId = this.entityId[slot]
    if (this.slotById.get(entityId) !== slot) return false
    let orderIndex = -1
    for (let index = 0; index < this.activeLength; index += 1) {
      if (this.activeSlots[index] === slot) {
        orderIndex = index
        break
      }
    }
    if (orderIndex < 0) throw new Error(`Student slot ${slot} lost active ordering`)
    this.activeSlots.copyWithin(orderIndex, orderIndex + 1, this.activeLength)
    this.activeLength -= 1
    this.slotById.delete(entityId)
    this.propSets[slot] = undefined
    this.freeSlots.push(slot)
    return true
  }

  replaceOrderedStates(states: readonly HubStudentState[]): void {
    let orderIndex = 0
    let stateIndex = 0
    while (orderIndex < this.activeLength) {
      const slot = this.activeSlots[orderIndex]
      const state = states[stateIndex]
      if (state && state.id === this.entityId[slot]) {
        if (state.retired) this.removeSlot(slot)
        else {
          this.write(slot, state)
          orderIndex += 1
        }
        stateIndex += 1
        continue
      }
      this.removeSlot(slot)
    }
    while (stateIndex < states.length) {
      const state = states[stateIndex]
      stateIndex += 1
      if (!state.retired) this.add(state)
    }
  }

  slotAt(orderIndex: number): number {
    if (!Number.isInteger(orderIndex) || orderIndex < 0 || orderIndex >= this.activeLength) {
      throw new RangeError(`Student order index ${orderIndex} is out of bounds`)
    }
    return this.activeSlots[orderIndex]
  }

  slotForId(entityId: number): number | undefined {
    return this.slotById.get(entityId)
  }

  stateAt(slot: number): HubStudentState {
    return this.readState(slot)
  }

  readingAt(slot: number): boolean {
    this.activeProps(slot)
    return (this.flags[slot] & FLAG_READING) !== 0
  }

  states(target = new Array<HubStudentState>(this.activeLength)): HubStudentState[] {
    target.length = this.activeLength
    for (let index = 0; index < this.activeLength; index += 1) {
      const slot = this.activeSlots[index]
      target[index] = this.readState(slot, target[index])
    }
    return target
  }

  private readState(slot: number, target?: HubStudentState): HubStudentState {
    const props = this.activeProps(slot)
    const flags = this.flags[slot]
    if (!target) return {
      currentSpeed: this.currentSpeed[slot],
      desiredSpeed: this.desiredSpeed[slot],
      framePhase: this.framePhase[slot],
      gaitDegrees: this.gaitDegrees[slot],
      heading: this.heading[slot],
      headingIndex: actorHeadingIndex(this.heading[slot]),
      id: this.entityId[slot],
      pathCursor: this.pathCursor[slot],
      pathId: this.pathId[slot],
      pathStep: this.pathStep[slot] as 1 | -1,
      position: { x: this.positionX[slot], y: this.positionY[slot] },
      profile: {
        pushResistance: this.pushResistance[slot],
        pushStrength: this.pushStrength[slot],
        radius: this.radius[slot],
      },
      props,
      reading: (flags & FLAG_READING) !== 0,
      retired: (flags & FLAG_RETIRED) !== 0,
      rngState: this.rngState[slot],
      scale: this.scale[slot],
      staticCollisionEnabled: (flags & FLAG_STATIC_COLLISION) !== 0,
      tick: this.tick[slot],
      wander: { x: this.wanderX[slot], y: this.wanderY[slot] },
    }
    target.currentSpeed = this.currentSpeed[slot]
    target.desiredSpeed = this.desiredSpeed[slot]
    target.framePhase = this.framePhase[slot]
    target.gaitDegrees = this.gaitDegrees[slot]
    target.heading = this.heading[slot]
    target.headingIndex = actorHeadingIndex(this.heading[slot])
    target.id = this.entityId[slot]
    target.pathCursor = this.pathCursor[slot]
    target.pathId = this.pathId[slot]
    target.pathStep = this.pathStep[slot] as 1 | -1
    target.position.x = this.positionX[slot]
    target.position.y = this.positionY[slot]
    target.profile.pushResistance = this.pushResistance[slot]
    target.profile.pushStrength = this.pushStrength[slot]
    target.profile.radius = this.radius[slot]
    target.props = props
    target.reading = (flags & FLAG_READING) !== 0
    target.retired = (flags & FLAG_RETIRED) !== 0
    target.rngState = this.rngState[slot]
    target.scale = this.scale[slot]
    target.staticCollisionEnabled = (flags & FLAG_STATIC_COLLISION) !== 0
    target.tick = this.tick[slot]
    target.wander.x = this.wanderX[slot]
    target.wander.y = this.wanderY[slot]
    return target
  }

  write(slot: number, state: HubStudentState): void {
    this.currentSpeed[slot] = state.currentSpeed
    this.desiredSpeed[slot] = state.desiredSpeed
    this.entityId[slot] = state.id
    this.flags[slot] = Number(state.reading) * FLAG_READING
      | Number(state.retired) * FLAG_RETIRED
      | Number(state.staticCollisionEnabled) * FLAG_STATIC_COLLISION
    this.framePhase[slot] = state.framePhase
    this.gaitDegrees[slot] = state.gaitDegrees
    this.heading[slot] = state.heading
    this.pathCursor[slot] = state.pathCursor
    this.pathId[slot] = state.pathId
    this.pathStep[slot] = state.pathStep
    this.positionX[slot] = state.position.x
    this.positionY[slot] = state.position.y
    if (!this.propSets[slot]) {
      this.propSets[slot] = state.props.map((prop) => ({ ...prop }))
    }
    this.pushResistance[slot] = state.profile.pushResistance
    this.pushStrength[slot] = state.profile.pushStrength
    this.radius[slot] = state.profile.radius
    this.rngState[slot] = state.rngState
    this.scale[slot] = state.scale
    this.tick[slot] = state.tick
    this.wanderX[slot] = state.wander.x
    this.wanderY[slot] = state.wander.y
  }

  clone(): HubStudentStore {
    return HubStudentStore.fromStates(this.states())
  }

  private activeProps(slot: number): readonly HubStudentProp[] {
    const props = this.propSets[slot]
    if (!props || this.slotById.get(this.entityId[slot]) !== slot) {
      throw new RangeError(`Student slot ${slot} is not active`)
    }
    return props
  }

  private ensureCapacity(required: number): void {
    if (required <= this.capacity) return
    let capacity = this.capacity
    while (capacity < required) capacity *= 2
    this.activeSlots = grow(this.activeSlots, capacity)
    this.currentSpeed = grow(this.currentSpeed, capacity)
    this.desiredSpeed = grow(this.desiredSpeed, capacity)
    this.entityId = grow(this.entityId, capacity)
    this.flags = grow(this.flags, capacity)
    this.framePhase = grow(this.framePhase, capacity)
    this.gaitDegrees = grow(this.gaitDegrees, capacity)
    this.heading = grow(this.heading, capacity)
    this.pathCursor = grow(this.pathCursor, capacity)
    this.pathId = grow(this.pathId, capacity)
    this.pathStep = grow(this.pathStep, capacity)
    this.positionX = grow(this.positionX, capacity)
    this.positionY = grow(this.positionY, capacity)
    this.propSets.length = capacity
    this.pushResistance = grow(this.pushResistance, capacity)
    this.pushStrength = grow(this.pushStrength, capacity)
    this.radius = grow(this.radius, capacity)
    this.rngState = grow(this.rngState, capacity)
    this.scale = grow(this.scale, capacity)
    this.tick = grow(this.tick, capacity)
    this.wanderX = grow(this.wanderX, capacity)
    this.wanderY = grow(this.wanderY, capacity)
    this.capacity = capacity
  }
}

type NumericArray =
  | Float64Array
  | Int8Array
  | Uint8Array
  | Uint32Array

function grow<ArrayType extends NumericArray>(source: ArrayType, length: number): ArrayType {
  const ArrayConstructor = source.constructor as new (length: number) => ArrayType
  const result = new ArrayConstructor(length)
  result.set(source)
  return result
}

function validCapacity(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError('Student store capacity must be a positive integer')
  }
  return value
}
