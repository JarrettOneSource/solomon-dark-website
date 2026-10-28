import type { NativeBouncerMotion } from '../../core-kernels/native-bouncer.ts'
import type { NativeDeathWeaponActor, NativeGolemDeathAnimation } from '../../core-kernels/native-death-animations.ts'
import { NATIVE_GOLEM_DEATH_FRAGMENT_COUNT } from '../../core-kernels/native-death-animations.ts'
import { MAX_BONEYARD_ENEMY_DEATH_EFFECTS } from '../game-protocol-limits.ts'
import { nativeWorldManagerRegistration, vector } from './native-state.ts'
import { GameProtocolError, boundedInteger, finite, limitedArray, memberString, nonnegativeInteger, onlyKeys,
  positiveFinite, positiveInteger, record, validatedPlayerId } from './values.ts'

export function nativeBouncerMotion(value: unknown, field: string): NativeBouncerMotion {
  const source = record(value, field)
  onlyKeys(source, field, ['bounceVelocity', 'height', 'position', 'rotationDegrees', 'rotationStepDegrees', 'velocity', 'verticalVelocity'])
  const bounceVelocity = finite(source.bounceVelocity, `${field}.bounceVelocity`)
  const height = finite(source.height, `${field}.height`)
  const verticalVelocity = finite(source.verticalVelocity, `${field}.verticalVelocity`)
  const rotationStepDegrees = finite(source.rotationStepDegrees, `${field}.rotationStepDegrees`)
  const velocity = vector(source.velocity, `${field}.velocity`)
  if (bounceVelocity < -5 || bounceVelocity > 0 || height > 0 || height < -64
    || verticalVelocity < -5 || verticalVelocity > 7 || Math.abs(rotationStepDegrees) > 20
    || Math.abs(velocity.x) > 2.25 || Math.abs(velocity.y) > 2.25) {
    throw new GameProtocolError(`${field} exceeds its native death Bouncer domains`)
  }
  if (bounceVelocity === 0 && (height !== 0 || verticalVelocity !== 0 || velocity.x !== 0
    || velocity.y !== 0 || rotationStepDegrees !== 0)) {
    throw new GameProtocolError(`${field} has motion after native settling`)
  }
  return { bounceVelocity, height, position: vector(source.position, `${field}.position`),
    rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`), rotationStepDegrees, velocity, verticalVelocity }
}

export function nativeGolemDeathAnimation(value: unknown, field: string, enhanced: boolean): NativeGolemDeathAnimation {
  const source = record(value, field)
  onlyKeys(source, field, ['fragments', 'starRotationDegrees', 'starStepDegrees'])
  const fragments = limitedArray(source.fragments, `${field}.fragments`, NATIVE_GOLEM_DEATH_FRAGMENT_COUNT).map((value, index) => {
    if (value === null) return null
    const path = `${field}.fragments[${index}]`
    const fragment = record(value, path)
    onlyKeys(fragment, path, ['bounceVelocity', 'height', 'life', 'position', 'rotationDegrees', 'rotationStepDegrees', 'velocity', 'verticalVelocity'])
    const { life: _life, ...motion } = fragment
    const life = positiveFinite(fragment.life, `${path}.life`)
    if (life > (enhanced ? 10 : 2)) throw new GameProtocolError(`${path}.life exceeds its born quality`)
    return { ...nativeBouncerMotion(motion, path), life }
  })
  if (fragments.length !== NATIVE_GOLEM_DEATH_FRAGMENT_COUNT) throw new GameProtocolError(`${field}.fragments must retain30 indexed slots`)
  const starRotationDegrees = finite(source.starRotationDegrees, `${field}.starRotationDegrees`)
  const starStepDegrees = finite(source.starStepDegrees, `${field}.starStepDegrees`)
  if (starRotationDegrees < 0 || starRotationDegrees > 360 || starStepDegrees < 0 || starStepDegrees > 7) {
    throw new GameProtocolError(`${field} exceeds its native Unbind constructor`)
  }
  return { fragments, starRotationDegrees, starStepDegrees }
}

export function nativeDeathWeapons(value: unknown, field: string, tick: number): readonly NativeDeathWeaponActor[] {
  const actors = limitedArray(value, field, MAX_BONEYARD_ENEMY_DEATH_EFFECTS).map((value, index): NativeDeathWeaponActor => {
    const path = `${field}[${index}]`
    const source = record(value, path)
    onlyKeys(source, path, ['ageTicks', 'birthTick', 'deathEpoch', 'id', 'life', 'motion', 'ownerId', 'painterRegistration', 'weapon'])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${path}.ageTicks`)
    const birthTick = nonnegativeInteger(source.birthTick, `${path}.birthTick`)
    const life = positiveFinite(source.life, `${path}.life`)
    if (birthTick > tick || ageTicks > tick - birthTick || life > 99999) throw new GameProtocolError(`${path} has invalid death-weapon clocks`)
    const weapon = record(source.weapon, `${path}.weapon`)
    onlyKeys(weapon, `${path}.weapon`, ['kind', 'selector'])
    return { ageTicks, birthTick, deathEpoch: positiveInteger(source.deathEpoch, `${path}.deathEpoch`),
      id: positiveInteger(source.id, `${path}.id`), life, motion: nativeBouncerMotion(source.motion, `${path}.motion`),
      ownerId: validatedPlayerId(source.ownerId, `${path}.ownerId`),
      painterRegistration: nativeWorldManagerRegistration(source.painterRegistration, `${path}.painterRegistration`, 'actor'),
      weapon: { kind: memberString(weapon.kind, `${path}.weapon.kind`, ['staff', 'wand'] as const),
        selector: boundedInteger(weapon.selector, `${path}.weapon.selector`, 0, 5) } }
  })
  if (new Set(actors.map(actor => actor.id)).size !== actors.length
    || new Set(actors.map(actor => `${actor.ownerId}:${actor.deathEpoch}`)).size !== actors.length
    || new Set(actors.map(actor => actor.painterRegistration.registrationOrdinal)).size !== actors.length) {
    throw new GameProtocolError(`${field} duplicates a death-weapon id, epoch or registration`)
  }
  return actors
}
