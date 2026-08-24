import { actorHeadingIndex } from '../core-kernels/actor-heading.ts'
import type {
  BoneyardEnemyProjectileSnapshot,
  BoneyardEnemyProjectileEffectSnapshot,
  BoneyardEnemyDeathEffectSnapshot,
  BoneyardEnemySnapshot,
  BoneyardGoodieSnapshot,
  BoneyardLootSnapshot,
  BoneyardMaggotSnapshot,
  GameSnapshot,
  GameSnapshotFrame,
  ProtocolPlayerEconomy,
  ProtocolPlayerState,
  ProtocolPlayerSnapshotFrame,
  ProtocolStudentProp,
  ProtocolStudentState,
} from './game-state.ts'
import type {
  ReplicatedEntityDescriptor,
  ReplicatedEntityFrame,
  ReplicatedEntityKey,
  ReplicatedEntitySample,
} from './replicated-entity-types.ts'
import {
  BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_REGISTRATION,
  BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_TYPE_ID,
  boneyardEnemyDeathEffectDescriptor,
  boneyardEnemyDeathEffectSample,
  materializeBoneyardEnemyDeathEffect,
} from './boneyard-enemy-death-effect-replication.ts'
import {
  BONEYARD_ENEMY_ENTITY_REGISTRATION,
  BONEYARD_ENEMY_ENTITY_TYPE_ID,
  boneyardEnemyDescriptor,
  boneyardEnemySample,
  materializeBoneyardEnemy,
} from './boneyard-enemy-replication.ts'
import {
  BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_REGISTRATION,
  BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_TYPE_ID,
  boneyardEnemyProjectileEffectDescriptor,
  boneyardEnemyProjectileEffectSample,
  materializeBoneyardEnemyProjectileEffect,
} from './boneyard-enemy-projectile-effect-replication.ts'
import {
  BONEYARD_ENEMY_PROJECTILE_ENTITY_REGISTRATION,
  BONEYARD_ENEMY_PROJECTILE_ENTITY_TYPE_ID,
  boneyardEnemyProjectileDescriptor,
  boneyardEnemyProjectileSample,
  materializeBoneyardEnemyProjectile,
} from './boneyard-enemy-projectile-replication.ts'
import {
  BONEYARD_MAGGOT_ENTITY_REGISTRATION,
  BONEYARD_MAGGOT_ENTITY_TYPE_ID,
  boneyardMaggotDescriptor,
  boneyardMaggotSample,
  materializeBoneyardMaggot,
} from './boneyard-maggot-replication.ts'
import {
  boneyardMageLightningPulseFrame,
  materializeBoneyardMageLightningPulse,
} from './boneyard-mage-lightning-replication.ts'
import {
  BONEYARD_LOOT_ENTITY_REGISTRATION,
  BONEYARD_LOOT_ENTITY_TYPE_ID,
  boneyardLootDescriptor,
  boneyardLootSample,
  materializeBoneyardLoot,
} from './boneyard-loot-replication.ts'
import {
  BONEYARD_GOODIE_ENTITY_REGISTRATION,
  BONEYARD_GOODIE_ENTITY_TYPE_ID,
  boneyardGoodieDescriptor,
  boneyardGoodieSample,
  materializeBoneyardGoodie,
} from './boneyard-goodie-replication.ts'

export const REPLICATED_ENTITY_TYPES = {
  boneyardEnemy: BONEYARD_ENEMY_ENTITY_TYPE_ID,
  boneyardEnemyDeathEffect: BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_TYPE_ID,
  boneyardEnemyProjectile: BONEYARD_ENEMY_PROJECTILE_ENTITY_TYPE_ID,
  boneyardEnemyProjectileEffect: BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_TYPE_ID,
  boneyardMaggot: BONEYARD_MAGGOT_ENTITY_TYPE_ID,
  boneyardLoot: BONEYARD_LOOT_ENTITY_TYPE_ID,
  boneyardGoodie: BONEYARD_GOODIE_ENTITY_TYPE_ID,
  student: 1,
} as const

const POSITION_SCALE = 16
const HEADING_SCALE = 64
const FRAME_PHASE_SCALE = 1024
const STUDENT_DESCRIPTOR_HEADER = 5
const STUDENT_SAMPLE_LENGTH = 7

export interface ReplicatedEntityBaseline {
  readonly descriptors: ReadonlyMap<string, ReplicatedEntityDescriptor>
  readonly playerEconomyRevisions: ReadonlyMap<string, number>
  readonly worldIdentity: string
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
  [BONEYARD_ENEMY_ENTITY_REGISTRATION.typeId, BONEYARD_ENEMY_ENTITY_REGISTRATION],
  [
    BONEYARD_ENEMY_PROJECTILE_ENTITY_REGISTRATION.typeId,
    BONEYARD_ENEMY_PROJECTILE_ENTITY_REGISTRATION,
  ],
  [
    BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_REGISTRATION.typeId,
    BONEYARD_ENEMY_PROJECTILE_EFFECT_ENTITY_REGISTRATION,
  ],
  [BONEYARD_MAGGOT_ENTITY_REGISTRATION.typeId, BONEYARD_MAGGOT_ENTITY_REGISTRATION],
  [BONEYARD_LOOT_ENTITY_REGISTRATION.typeId, BONEYARD_LOOT_ENTITY_REGISTRATION],
  [BONEYARD_GOODIE_ENTITY_REGISTRATION.typeId, BONEYARD_GOODIE_ENTITY_REGISTRATION],
  [
    BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_REGISTRATION.typeId,
    BONEYARD_ENEMY_DEATH_EFFECT_ENTITY_REGISTRATION,
  ],
])

export function createReplicatedEntityBaseline(
  snapshot: GameSnapshot,
): ReplicatedEntityBaseline {
  return {
    descriptors: descriptorMap(snapshot),
    playerEconomyRevisions: new Map(Object.entries(snapshot.players).map(
      ([playerId, player]) => [playerId, player.economy.revision],
    )),
    worldIdentity: replicatedWorldIdentity(snapshot),
  }
}

export function createGameSnapshotFrame(
  snapshot: GameSnapshot,
  baselineSequence: number,
  baseline: ReplicatedEntityBaseline | undefined,
  forceKeyframe = false,
): GameSnapshotFrame {
  const currentDescriptors = descriptorMap(snapshot)
  const keyframe = forceKeyframe
    || !baseline
    || baseline.worldIdentity !== replicatedWorldIdentity(snapshot)
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
  const samples = snapshot.world.kind === 'hub'
    ? snapshot.world.students.map((student) => studentCodec.sample(student))
    : [
        ...snapshot.world.enemies.map(boneyardEnemySample),
        ...snapshot.world.deathEffects.map(boneyardEnemyDeathEffectSample),
        ...snapshot.world.enemyProjectiles.map(boneyardEnemyProjectileSample),
        ...snapshot.world.enemyProjectileEffects.map(boneyardEnemyProjectileEffectSample),
        ...snapshot.world.maggots.map(boneyardMaggotSample),
        ...snapshot.world.loot.map(boneyardLootSample),
        ...snapshot.world.goodies.map(boneyardGoodieSample),
      ]
  const entities: ReplicatedEntityFrame = {
    baselineSequence: keyframe ? 0 : baselineSequence,
    keyframe,
    retired,
    samples,
    spawned,
  }
  const common = {
    hostPlayerId: snapshot.hostPlayerId,
    levelUpBarrier: snapshot.levelUpBarrier,
    modEffects: snapshot.modEffects,
    players: playerSnapshotFrames(snapshot.players, baseline, keyframe),
    primarySpells: snapshot.primarySpells,
    secondaryAbilities: snapshot.secondaryAbilities,
    run: snapshot.run,
    tick: snapshot.tick,
  }
  if (snapshot.world.kind === 'hub') {
    return {
      ...common,
      world: {
        ambient: snapshot.world.ambient,
        collisionRngState: snapshot.world.collisionRngState,
        entities,
        kind: 'hub',
        participants: snapshot.world.participants,
        traderAnimationSeed: snapshot.world.traderAnimationSeed,
      },
    }
  }
  return {
    ...common,
    world: {
      arenaTransition: snapshot.world.arenaTransition,
      encounter: snapshot.world.encounter,
      entities,
      enemyEvents: snapshot.world.enemyEvents,
      enemyWorldFeedback: snapshot.world.enemyWorldFeedback,
      lootEvents: snapshot.world.lootEvents,
      gateLeaves: snapshot.world.gateLeaves,
      hallOfFameRuns: snapshot.world.hallOfFameRuns,
      kind: 'boneyard',
      lanternLightRegistration: snapshot.world.lanternLightRegistration,
      mageLightningPulses: snapshot.world.mageLightningPulses.map(
        boneyardMageLightningPulseFrame,
      ),
      runId: snapshot.world.runId,
      tutorial: snapshot.world.tutorial,
      waves: snapshot.world.waves,
    },
  }
}

function playerSnapshotFrames(
  players: Readonly<Record<string, ProtocolPlayerState>>,
  baseline: ReplicatedEntityBaseline | undefined,
  keyframe: boolean,
): Readonly<Record<string, ProtocolPlayerSnapshotFrame>> {
  return Object.fromEntries(Object.entries(players).map(([playerId, player]) => {
    const includeEconomy = keyframe
      || baseline?.playerEconomyRevisions.get(playerId) !== player.economy.revision
    if (includeEconomy) return [playerId, player]
    const { economy: _economy, ...frame } = player
    return [playerId, frame]
  }))
}

function materializePlayerSnapshotFrames(
  frames: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
  economies: Map<string, ProtocolPlayerEconomy>,
): Readonly<Record<string, ProtocolPlayerState>> {
  const livePlayerIds = new Set(Object.keys(frames))
  const players = Object.fromEntries(Object.entries(frames).map(([playerId, frame]) => {
    const economy = frame.economy ?? economies.get(playerId)
    if (!economy) {
      throw new EntityReplicationGapError('player frame is missing its economy baseline')
    }
    economies.set(playerId, economy)
    return [playerId, { ...frame, economy }]
  }))
  for (const playerId of economies.keys()) {
    if (!livePlayerIds.has(playerId)) economies.delete(playerId)
  }
  return players
}

export class EntityReplicationReconstructor {
  private readonly descriptors = new Map<string, ReplicatedEntityDescriptor>()
  private readonly playerEconomies = new Map<string, ProtocolPlayerEconomy>()
  private lastSequence = 0
  private worldIdentity: string | null = null

  reset(snapshot: GameSnapshot, sequence: number): void {
    this.descriptors.clear()
    this.playerEconomies.clear()
    for (const descriptor of descriptorMap(snapshot).values()) {
      this.descriptors.set(entityKey(descriptor[0], descriptor[1]), descriptor)
    }
    for (const [playerId, player] of Object.entries(snapshot.players)) {
      this.playerEconomies.set(playerId, player.economy)
    }
    this.lastSequence = sequence
    this.worldIdentity = replicatedWorldIdentity(snapshot)
  }

  apply(frame: GameSnapshotFrame, sequence: number): GameSnapshot {
    if (sequence <= this.lastSequence) {
      throw new EntityReplicationGapError('snapshot sequence is not newer')
    }
    const entities = frame.world.entities
    const nextWorldIdentity = replicatedFrameWorldIdentity(frame)
    if (nextWorldIdentity !== this.worldIdentity && !entities.keyframe) {
      throw new EntityReplicationGapError('world identity changed without an entity keyframe')
    }
    if (!entities.keyframe && entities.baselineSequence > this.lastSequence) {
      throw new EntityReplicationGapError('entity baseline has not been applied')
    }
    if (entities.keyframe) {
      this.descriptors.clear()
      this.playerEconomies.clear()
    }
    for (const key of entities.retired) this.descriptors.delete(entityKey(key[0], key[1]))
    for (const descriptor of entities.spawned) {
      const registration = REPLICATED_ENTITY_TYPE_REGISTRY.get(descriptor[0])
      if (!registration?.descriptorIsValid(descriptor)) {
        throw new EntityReplicationGapError('entity descriptor shape is invalid')
      }
      this.descriptors.set(entityKey(descriptor[0], descriptor[1]), descriptor)
    }
    const students: ProtocolStudentState[] = []
    const enemies: BoneyardEnemySnapshot[] = []
    const deathEffects: BoneyardEnemyDeathEffectSnapshot[] = []
    const enemyProjectiles: BoneyardEnemyProjectileSnapshot[] = []
    const enemyProjectileEffects: BoneyardEnemyProjectileEffectSnapshot[] = []
    const maggots: BoneyardMaggotSnapshot[] = []
    const loot: BoneyardLootSnapshot[] = []
    const goodies: BoneyardGoodieSnapshot[] = []
    for (const sample of entities.samples) {
      const registration = REPLICATED_ENTITY_TYPE_REGISTRY.get(sample[0])
      const descriptor = this.descriptors.get(entityKey(sample[0], sample[1]))
      if (!registration?.sampleIsValid(sample) || !descriptor) {
        throw new EntityReplicationGapError('entity sample is missing its descriptor')
      }
      if (sample[0] === REPLICATED_ENTITY_TYPES.student) {
        if (frame.world.kind !== 'hub') {
          throw new EntityReplicationGapError('student sample is outside the Hub')
        }
        students.push(studentCodec.materialize(descriptor, sample))
      } else if (sample[0] === REPLICATED_ENTITY_TYPES.boneyardEnemy) {
        if (frame.world.kind !== 'boneyard') {
          throw new EntityReplicationGapError('enemy sample is outside the Boneyard')
        }
        enemies.push(materializeBoneyardEnemy(descriptor, sample))
      } else if (sample[0] === REPLICATED_ENTITY_TYPES.boneyardEnemyProjectile) {
        if (frame.world.kind !== 'boneyard') {
          throw new EntityReplicationGapError('enemy projectile sample is outside the Boneyard')
        }
        enemyProjectiles.push(materializeBoneyardEnemyProjectile(descriptor, sample))
      } else if (sample[0] === REPLICATED_ENTITY_TYPES.boneyardEnemyProjectileEffect) {
        if (frame.world.kind !== 'boneyard') {
          throw new EntityReplicationGapError('enemy projectile-effect sample is outside the Boneyard')
        }
        enemyProjectileEffects.push(
          materializeBoneyardEnemyProjectileEffect(descriptor, sample),
        )
      } else if (sample[0] === REPLICATED_ENTITY_TYPES.boneyardMaggot) {
        if (frame.world.kind !== 'boneyard') {
          throw new EntityReplicationGapError('Maggot sample is outside the Boneyard')
        }
        maggots.push(materializeBoneyardMaggot(descriptor, sample))
      } else if (sample[0] === REPLICATED_ENTITY_TYPES.boneyardEnemyDeathEffect) {
        if (frame.world.kind !== 'boneyard') {
          throw new EntityReplicationGapError('enemy death-effect sample is outside the Boneyard')
        }
        deathEffects.push(materializeBoneyardEnemyDeathEffect(descriptor, sample))
      } else if (sample[0] === REPLICATED_ENTITY_TYPES.boneyardLoot) {
        if (frame.world.kind !== 'boneyard') {
          throw new EntityReplicationGapError('loot sample is outside the Boneyard')
        }
        loot.push(materializeBoneyardLoot(descriptor, sample))
      } else if (sample[0] === REPLICATED_ENTITY_TYPES.boneyardGoodie) {
        if (frame.world.kind !== 'boneyard') {
          throw new EntityReplicationGapError('Goodie sample is outside the Boneyard')
        }
        goodies.push(materializeBoneyardGoodie(descriptor, sample))
      }
    }
    const players = materializePlayerSnapshotFrames(frame.players, this.playerEconomies)
    this.lastSequence = sequence
    this.worldIdentity = nextWorldIdentity
    const common = {
      hostPlayerId: frame.hostPlayerId,
      levelUpBarrier: frame.levelUpBarrier,
      modEffects: frame.modEffects,
      players,
      primarySpells: frame.primarySpells,
      secondaryAbilities: frame.secondaryAbilities,
      run: frame.run,
      tick: frame.tick,
    }
    if (frame.world.kind === 'hub') {
      return {
        ...common,
        world: {
          ambient: frame.world.ambient,
          collisionRngState: frame.world.collisionRngState,
          kind: 'hub',
          participants: frame.world.participants,
          students,
          traderAnimationSeed: frame.world.traderAnimationSeed,
        },
      }
    }
    return {
      ...common,
      world: {
        arenaTransition: frame.world.arenaTransition,
        deathEffects,
        encounter: frame.world.encounter,
        enemies,
        enemyEvents: frame.world.enemyEvents,
        enemyWorldFeedback: frame.world.enemyWorldFeedback,
        enemyProjectileEffects,
        enemyProjectiles,
        gateLeaves: frame.world.gateLeaves,
        goodies,
        hallOfFameRuns: frame.world.hallOfFameRuns,
        kind: 'boneyard',
        lanternLightRegistration: frame.world.lanternLightRegistration,
        loot,
        lootEvents: frame.world.lootEvents,
        mageLightningPulses: frame.world.mageLightningPulses.map(
          materializeBoneyardMageLightningPulse,
        ),
        maggots,
        runId: frame.world.runId,
        tutorial: frame.world.tutorial,
        waves: frame.world.waves,
      },
    }
  }
}

export class EntityReplicationGapError extends Error {
  override name = 'EntityReplicationGapError'
}

function descriptorMap(snapshot: GameSnapshot): Map<string, ReplicatedEntityDescriptor> {
  const descriptors = new Map<string, ReplicatedEntityDescriptor>()
  if (snapshot.world.kind === 'hub') {
    for (const student of snapshot.world.students) {
      const descriptor = studentCodec.descriptor(student)
      descriptors.set(entityKey(descriptor[0], descriptor[1]), descriptor)
    }
  } else {
    for (const effect of snapshot.world.deathEffects) {
      const descriptor = boneyardEnemyDeathEffectDescriptor(effect)
      descriptors.set(entityKey(descriptor[0], descriptor[1]), descriptor)
    }
    for (const enemy of snapshot.world.enemies) {
      const descriptor = boneyardEnemyDescriptor(enemy)
      descriptors.set(entityKey(descriptor[0], descriptor[1]), descriptor)
    }
    for (const projectile of snapshot.world.enemyProjectiles) {
      const descriptor = boneyardEnemyProjectileDescriptor(projectile)
      descriptors.set(entityKey(descriptor[0], descriptor[1]), descriptor)
    }
    for (const effect of snapshot.world.enemyProjectileEffects) {
      const descriptor = boneyardEnemyProjectileEffectDescriptor(effect)
      descriptors.set(entityKey(descriptor[0], descriptor[1]), descriptor)
    }
    for (const maggot of snapshot.world.maggots) {
      const descriptor = boneyardMaggotDescriptor(maggot)
      descriptors.set(entityKey(descriptor[0], descriptor[1]), descriptor)
    }
    for (const loot of snapshot.world.loot) {
      const descriptor = boneyardLootDescriptor(loot)
      descriptors.set(entityKey(descriptor[0], descriptor[1]), descriptor)
    }
    for (const goodie of snapshot.world.goodies) {
      const descriptor = boneyardGoodieDescriptor(goodie)
      descriptors.set(entityKey(descriptor[0], descriptor[1]), descriptor)
    }
  }
  return descriptors
}

function replicatedWorldIdentity(snapshot: GameSnapshot): string {
  return snapshot.world.kind === 'hub'
    ? 'hub'
    : `boneyard:${snapshot.world.runId}`
}

function replicatedFrameWorldIdentity(frame: GameSnapshotFrame): string {
  return frame.world.kind === 'hub'
    ? 'hub'
    : `boneyard:${frame.world.runId}`
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
