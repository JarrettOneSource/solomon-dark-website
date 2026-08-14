import { actorHeadingIndex } from '../core-kernels/actor-heading.ts'
import type {
  GameSnapshot,
  GameSnapshotFrame,
  ProtocolStudentProp,
  ProtocolStudentState,
} from './game-state.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntityFrame,
  ReplicatedEntityKey,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'

export const REPLICATED_ENTITY_TYPES = {
  student: 1,
} as const

const POSITION_SCALE = 16
const HEADING_SCALE = 64
const FRAME_PHASE_SCALE = 1024
const STUDENT_DESCRIPTOR_HEADER = 5
const STUDENT_SAMPLE_LENGTH = 7

export interface ReplicatedEntityBaseline {
  readonly descriptors: ReadonlyMap<string, ReplicatedEntityDescriptor>
  readonly worldKind: GameSnapshot['world']['kind']
}

export interface ReplicatedEntityTypeRegistration {
  readonly name: string
  readonly typeId: number
  descriptorIsValid(descriptor: ReplicatedEntityDescriptor): boolean
  sampleIsValid(sample: ReplicatedEntitySample): boolean
}

interface ReplicatedEntityCodec extends ReplicatedEntityTypeRegistration {
  descriptor(student: ProtocolStudentState): ReplicatedEntityDescriptor
  materialize(
    descriptor: ReplicatedEntityDescriptor,
    sample: ReplicatedEntitySample,
  ): ProtocolStudentState
  sample(student: ProtocolStudentState): ReplicatedEntitySample
}

const studentCodec: ReplicatedEntityCodec = {
  name: 'student',
  typeId: REPLICATED_ENTITY_TYPES.student,
  descriptorIsValid(descriptor) {
    if (
      descriptor[0] !== REPLICATED_ENTITY_TYPES.student
      || !isEntityId(descriptor[1])
      || !Number.isFinite(descriptor[2])
      || descriptor[2] <= 0
      || (descriptor[3] !== 0 && descriptor[3] !== 1)
    ) return false
    const propCount = descriptor[4]
    if (
      !Number.isInteger(propCount)
      || propCount < 0
      || propCount > 8
      || descriptor.length !== STUDENT_DESCRIPTOR_HEADER + propCount * 3
    ) return false
    for (let index = 0; index < propCount; index += 1) {
      const start = STUDENT_DESCRIPTOR_HEADER + index * 3
      if (
        !Number.isFinite(descriptor[start])
        || !Number.isInteger(descriptor[start + 1])
        || descriptor[start + 1] < 0
        || descriptor[start + 1] >= 5
        || !Number.isFinite(descriptor[start + 2])
      ) return false
    }
    return true
  },
  sampleIsValid(sample) {
    return sample.length === STUDENT_SAMPLE_LENGTH
      && sample[0] === REPLICATED_ENTITY_TYPES.student
      && isEntityId(sample[1])
      && isQuantizedInteger(sample[2])
      && isQuantizedInteger(sample[3])
      && isCyclicQuantizedInteger(sample[4], 360, HEADING_SCALE)
      && isCyclicQuantizedInteger(sample[5], 5, FRAME_PHASE_SCALE)
      && isCyclicQuantizedInteger(sample[6], 360, HEADING_SCALE)
  },
  descriptor(student) {
    return [
      REPLICATED_ENTITY_TYPES.student,
      student.id,
      student.scale,
      Number(student.reading),
      student.props.length,
      ...student.props.flatMap((prop) => [prop.angle, prop.paletteIndex, prop.radius]),
    ]
  },
  sample(student) {
    return [
      REPLICATED_ENTITY_TYPES.student,
      student.id,
      quantize(student.position.x, POSITION_SCALE),
      quantize(student.position.y, POSITION_SCALE),
      quantizeCyclic(student.heading, 360, HEADING_SCALE),
      quantizeCyclic(student.framePhase, 5, FRAME_PHASE_SCALE),
      quantizeCyclic(student.gaitDegrees, 360, HEADING_SCALE),
    ]
  },
  materialize(descriptor, sample) {
    if (!studentCodec.sampleIsValid(sample)) {
      throw new EntityReplicationGapError('Student sample shape is invalid')
    }
    if (!studentCodec.descriptorIsValid(descriptor)) {
      throw new EntityReplicationGapError('Student descriptor shape is invalid')
    }
    const propCount = descriptor[4]
    const props = new Array<ProtocolStudentProp>(propCount)
    for (let index = 0; index < propCount; index += 1) {
      const start = STUDENT_DESCRIPTOR_HEADER + index * 3
      props[index] = {
        angle: descriptor[start],
        paletteIndex: descriptor[start + 1],
        radius: descriptor[start + 2],
      }
    }
    const heading = dequantize(sample[4], HEADING_SCALE)
    return {
      framePhase: dequantize(sample[5], FRAME_PHASE_SCALE),
      gaitDegrees: dequantize(sample[6], HEADING_SCALE),
      heading,
      headingIndex: actorHeadingIndex(heading),
      id: descriptor[1],
      position: {
        x: dequantize(sample[2], POSITION_SCALE),
        y: dequantize(sample[3], POSITION_SCALE),
      },
      props,
      reading: descriptor[3] === 1,
      scale: descriptor[2],
    }
  },
}

export const REPLICATED_ENTITY_TYPE_REGISTRY: ReadonlyMap<
  number,
  ReplicatedEntityTypeRegistration
> = new Map([
  [studentCodec.typeId, studentCodec],
])

export function createReplicatedEntityBaseline(
  snapshot: GameSnapshot,
): ReplicatedEntityBaseline {
  return {
    descriptors: descriptorMap(snapshot),
    worldKind: snapshot.world.kind,
  }
}

export function createGameSnapshotFrame(
  snapshot: GameSnapshot,
  baselineSequence: number,
  baseline: ReplicatedEntityBaseline | undefined,
  forceKeyframe = false,
): GameSnapshotFrame {
  if (snapshot.world.kind === 'boneyard') {
    return {
      hostPlayerId: snapshot.hostPlayerId,
      players: snapshot.players,
      primarySpells: snapshot.primarySpells,
      tick: snapshot.tick,
      world: snapshot.world,
    }
  }
  const currentDescriptors = descriptorMap(snapshot)
  const keyframe = forceKeyframe || !baseline || baseline.worldKind !== 'hub'
  const spawned: ReplicatedEntityDescriptor[] = []
  const retired: ReplicatedEntityKey[] = []
  for (const [key, descriptor] of currentDescriptors) {
    const previous = baseline?.descriptors.get(key)
    if (keyframe || !previous || !sameNumbers(previous, descriptor)) spawned.push(descriptor)
  }
  if (!keyframe && baseline) {
    for (const [key, descriptor] of baseline.descriptors) {
      if (!currentDescriptors.has(key)) retired.push([descriptor[0], descriptor[1]])
    }
  }
  const samples = snapshot.world.students.map((student) => studentCodec.sample(student))
  const entities: ReplicatedEntityFrame = {
    baselineSequence: keyframe ? 0 : baselineSequence,
    keyframe,
    retired,
    samples,
    spawned,
  }
  return {
    hostPlayerId: snapshot.hostPlayerId,
    players: snapshot.players,
    primarySpells: snapshot.primarySpells,
    tick: snapshot.tick,
    world: {
      ambient: snapshot.world.ambient,
      collisionRngState: snapshot.world.collisionRngState,
      entities,
      kind: 'hub',
      participants: snapshot.world.participants,
    },
  }
}

export class EntityReplicationReconstructor {
  private readonly descriptors = new Map<string, ReplicatedEntityDescriptor>()
  private lastSequence = 0

  reset(snapshot: GameSnapshot, sequence: number): void {
    this.descriptors.clear()
    for (const descriptor of descriptorMap(snapshot).values()) {
      this.descriptors.set(entityKey(descriptor[0], descriptor[1]), descriptor)
    }
    this.lastSequence = sequence
  }

  apply(frame: GameSnapshotFrame, sequence: number): GameSnapshot {
    if (sequence <= this.lastSequence) {
      throw new EntityReplicationGapError('snapshot sequence is not newer')
    }
    if (frame.world.kind === 'boneyard') {
      this.descriptors.clear()
      this.lastSequence = sequence
      return {
        hostPlayerId: frame.hostPlayerId,
        players: frame.players,
        primarySpells: frame.primarySpells,
        tick: frame.tick,
        world: frame.world,
      }
    }
    const entities = frame.world.entities
    if (!entities.keyframe && entities.baselineSequence > this.lastSequence) {
      throw new EntityReplicationGapError('entity baseline has not been applied')
    }
    if (entities.keyframe) this.descriptors.clear()
    for (const key of entities.retired) this.descriptors.delete(entityKey(key[0], key[1]))
    for (const descriptor of entities.spawned) {
      const registration = REPLICATED_ENTITY_TYPE_REGISTRY.get(descriptor[0])
      if (!registration?.descriptorIsValid(descriptor)) {
        throw new EntityReplicationGapError('entity descriptor shape is invalid')
      }
      this.descriptors.set(entityKey(descriptor[0], descriptor[1]), descriptor)
    }
    const students: ProtocolStudentState[] = []
    for (const sample of entities.samples) {
      const registration = REPLICATED_ENTITY_TYPE_REGISTRY.get(sample[0])
      const descriptor = this.descriptors.get(entityKey(sample[0], sample[1]))
      if (!registration?.sampleIsValid(sample) || !descriptor) {
        throw new EntityReplicationGapError('entity sample is missing its descriptor')
      }
      if (sample[0] === REPLICATED_ENTITY_TYPES.student) {
        students.push(studentCodec.materialize(descriptor, sample))
      }
    }
    this.lastSequence = sequence
    return {
      hostPlayerId: frame.hostPlayerId,
      players: frame.players,
      primarySpells: frame.primarySpells,
      tick: frame.tick,
      world: {
        ambient: frame.world.ambient,
        collisionRngState: frame.world.collisionRngState,
        kind: 'hub',
        participants: frame.world.participants,
        students,
      },
    }
  }
}

export class EntityReplicationGapError extends Error {
  override name = 'EntityReplicationGapError'
}

function descriptorMap(snapshot: GameSnapshot): Map<string, ReplicatedEntityDescriptor> {
  const descriptors = new Map<string, ReplicatedEntityDescriptor>()
  if (snapshot.world.kind !== 'hub') return descriptors
  for (const student of snapshot.world.students) {
    const descriptor = studentCodec.descriptor(student)
    descriptors.set(entityKey(descriptor[0], descriptor[1]), descriptor)
  }
  return descriptors
}

function entityKey(typeId: number, entityId: number): string {
  return `${typeId}:${entityId}`
}

function sameNumbers(first: readonly number[], second: readonly number[]): boolean {
  return first.length === second.length
    && first.every((value, index) => Object.is(value, second[index]))
}

function quantize(value: number, scale: number): number {
  return Math.round(value * scale)
}

function quantizeCyclic(value: number, period: number, scale: number): number {
  return Math.round(wrap(value, period) * scale) % (period * scale)
}

function dequantize(value: number, scale: number): number {
  return value / scale
}

function wrap(value: number, period: number): number {
  return ((value % period) + period) % period
}

function isEntityId(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function isQuantizedInteger(value: number): boolean {
  return Number.isSafeInteger(value)
}

function isCyclicQuantizedInteger(value: number, period: number, scale: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value < period * scale
}
