import {
  NATIVE_STAFF_CONTACT_EVENT_TICKS,
  NATIVE_STAFF_MELEE_ACCELERATION,
  NATIVE_STAFF_MELEE_BASE_PROGRESS,
  NATIVE_STAFF_PIKE_BREAK_LIFETIME_TICKS,
  type NativePlayerStaffTransient,
  type NativeStaffProcSound,
} from '../../core-kernels/native-player-staff-action.ts'
import { MAX_PRIMARY_SPELL_HIT_TARGETS } from '../game-protocol-limits.ts'
import { nativeRngState, vector } from './native-state.ts'
import {
  GameProtocolError,
  finite,
  limitedArray,
  limitedString,
  memberString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  positiveInteger,
  validatedPlayerId,
} from './values.ts'

export function nativePlayerStaffTransient(
  source: Record<string, unknown>,
  field: string,
): NativePlayerStaffTransient {
  const kind = source.kind as NativePlayerStaffTransient['kind']
  const common = {
    ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
    id: positiveInteger(source.id, `${field}.id`),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
  if (kind === 'player-staff-melee' || kind === 'player-staff-spin') {
    const sharedKeys = [
      'ageTicks', 'contactSequence', 'headingDegrees', 'id', 'kind', 'origin',
      'outcome', 'ownerId', 'swooshPitch', 'worldKey',
    ]
    onlyKeys(source, field, kind === 'player-staff-melee'
      ? [...sharedKeys, 'actionTimingFactor', 'baseProgressPerTick', 'lane', 'progress']
      : [...sharedKeys, 'countdown', 'turnSign'])
    const headingDegrees = staffHeading(source.headingDegrees, `${field}.headingDegrees`)
    const outcome = staffOutcome(source.outcome, `${field}.outcome`)
    const contactSequence = nonnegativeInteger(
      source.contactSequence,
      `${field}.contactSequence`,
    )
    if (contactSequence > 1) {
      throw new GameProtocolError(`${field}.contactSequence exceeds the Staff marker`)
    }
    const swooshPitch = staffPitch(source.swooshPitch, `${field}.swooshPitch`)
    const actionCommon = {
      ...common,
      contactSequence,
      headingDegrees,
      origin: vector(source.origin, `${field}.origin`),
      outcome,
      swooshPitch,
    }
    if (kind === 'player-staff-spin') {
      if (outcome !== 'whirl') throw new GameProtocolError(`${field}.outcome must be Whirl`)
      const countdown = positiveFinite(source.countdown, `${field}.countdown`)
      if (countdown > 360 || countdown % 20 !== 0) {
        throw new GameProtocolError(`${field}.countdown is outside the StaffSpin program`)
      }
      const turnSign = finite(source.turnSign, `${field}.turnSign`)
      if (turnSign !== -1 && turnSign !== 1) {
        throw new GameProtocolError(`${field}.turnSign must be -1 or 1`)
      }
      if (
        swooshPitch !== 1
        || contactSequence !== 0
        || common.ageTicks > 17
        || countdown !== 360 - common.ageTicks * 20
      ) throw new GameProtocolError(`${field} does not match the live StaffSpin program`)
      return { ...actionCommon, countdown, kind, turnSign }
    }
    if (outcome === 'whirl') throw new GameProtocolError(`${field}.outcome cannot be Whirl`)
    const lane = source.lane
    if (lane !== 'primary' && lane !== 'secondary') {
      throw new GameProtocolError(`${field}.lane is not a Staff melee bank`)
    }
    const actionTimingFactor = positiveFinite(
      source.actionTimingFactor,
      `${field}.actionTimingFactor`,
    )
    const baseProgressPerTick = positiveFinite(
      source.baseProgressPerTick,
      `${field}.baseProgressPerTick`,
    )
    const progress = nonnegativeFinite(source.progress, `${field}.progress`)
    const expectedSwooshPitch = Math.fround(
      (baseProgressPerTick - NATIVE_STAFF_MELEE_BASE_PROGRESS) + 1,
    )
    if (
      progress > 8
      || baseProgressPerTick < Math.fround(NATIVE_STAFF_MELEE_BASE_PROGRESS)
      || baseProgressPerTick > Math.fround(
        Math.fround(NATIVE_STAFF_MELEE_BASE_PROGRESS + Math.fround(0.05))
          * NATIVE_STAFF_MELEE_ACCELERATION,
      )
      || (actionTimingFactor !== 1 && actionTimingFactor !== 1.75)
      || swooshPitch !== expectedSwooshPitch
    ) {
      throw new GameProtocolError(`${field} is outside the StaffMelee program`)
    }
    return {
      ...actionCommon,
      actionTimingFactor,
      baseProgressPerTick,
      kind,
      lane,
      progress,
    }
  }
  if (kind === 'player-staff-contact') {
    onlyKeys(source, field, [
      'ageTicks', 'id', 'impactSoundPitches', 'kind', 'origin', 'outcome',
      'ownerId', 'pikeBreakSoundIndexes', 'procSound', 'procSoundPitches',
      'swooshPitch', 'targetIds', 'worldKey',
    ])
    const ageTicks = nonnegativeInteger(source.ageTicks, `${field}.ageTicks`)
    if (ageTicks >= NATIVE_STAFF_CONTACT_EVENT_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks exceeds contact retention`)
    }
    const outcome = staffOutcome(source.outcome, `${field}.outcome`)
    const procSound = source.procSound === null
      ? null
      : memberString(
          source.procSound,
          `${field}.procSound`,
          ['critical-hit', 'disable-enemy', 'knockback', 'spin-attack'] as const,
        ) as NativeStaffProcSound
    const procSoundPitches = limitedArray(
      source.procSoundPitches,
      `${field}.procSoundPitches`,
      3,
    ).map((pitch, index) => staffPitch(
      pitch,
      `${field}.procSoundPitches[${index}]`,
    ))
    const impactSoundPitches = limitedArray(
      source.impactSoundPitches,
      `${field}.impactSoundPitches`,
      MAX_PRIMARY_SPELL_HIT_TARGETS,
    ).map((pitch, index) => {
      const decoded = staffPitch(pitch, `${field}.impactSoundPitches[${index}]`)
      if (decoded < Math.fround(0.9) || decoded > Math.fround(1.1)) {
        throw new GameProtocolError(`${field}.impactSoundPitches[${index}] is outside StaffHitWood`)
      }
      return decoded
    })
    const pikeBreakSoundIndexes = limitedArray(
      source.pikeBreakSoundIndexes,
      `${field}.pikeBreakSoundIndexes`,
      MAX_PRIMARY_SPELL_HIT_TARGETS,
    ).map((value, index) => {
      const decoded = nonnegativeInteger(value, `${field}.pikeBreakSoundIndexes[${index}]`)
      if (decoded >= impactSoundPitches.length) {
        throw new GameProtocolError(`${field}.pikeBreakSoundIndexes[${index}] has no impact`)
      }
      return decoded
    })
    if (new Set(pikeBreakSoundIndexes).size !== pikeBreakSoundIndexes.length) {
      throw new GameProtocolError(`${field}.pikeBreakSoundIndexes contains a duplicate`)
    }
    const targetIds = staffTargetIds(source.targetIds, `${field}.targetIds`)
    const expectedSound: Readonly<Record<typeof outcome, NativeStaffProcSound | null>> = {
      'critical-hit': 'critical-hit',
      'disabling-hit': 'disable-enemy',
      knockback: 'knockback',
      normal: null,
      whirl: 'spin-attack',
    }
    const procSucceeded = targetIds.length > 0 && outcome !== 'normal'
    const expectedProcSound = procSucceeded ? expectedSound[outcome] : null
    const expectedPitchCount = !procSucceeded ? 0 : outcome === 'whirl' ? 3 : 1
    const pitchesMatch = !procSucceeded
      ? procSoundPitches.length === 0
      : outcome === 'disabling-hit'
        ? procSoundPitches.length === 1 && procSoundPitches[0] === 1
        : outcome === 'whirl'
          ? procSoundPitches.length === 3
            && procSoundPitches[0] === 1
            && procSoundPitches[1] === Math.fround(0.9)
            && procSoundPitches[2] === Math.fround(1.1)
          : procSoundPitches.length === 1
            && procSoundPitches[0]! >= Math.fround(0.9)
            && procSoundPitches[0]! <= Math.fround(1.1)
    const swooshPitch = staffPitch(source.swooshPitch, `${field}.swooshPitch`)
    if (
      procSound !== expectedProcSound
      || procSoundPitches.length !== expectedPitchCount
      || !pitchesMatch
      || swooshPitch < 1
      || swooshPitch > Math.fround((
        Math.fround(
          Math.fround(NATIVE_STAFF_MELEE_BASE_PROGRESS + Math.fround(0.05))
            * NATIVE_STAFF_MELEE_ACCELERATION,
        ) - NATIVE_STAFF_MELEE_BASE_PROGRESS
      ) + 1)
    ) {
      throw new GameProtocolError(`${field} proc sound does not match its outcome`)
    }
    return {
      ...common,
      ageTicks,
      impactSoundPitches,
      kind,
      origin: vector(source.origin, `${field}.origin`),
      outcome,
      procSound,
      procSoundPitches,
      pikeBreakSoundIndexes,
      swooshPitch,
      targetIds,
    }
  }
  if (kind === 'player-staff-contact-knockback') {
    onlyKeys(source, field, [
      'ageTicks', 'delta', 'id', 'kind', 'ownerId', 'remainingTicks',
      'targetId', 'worldKey',
    ])
    const delta = vector(source.delta, `${field}.delta`)
    const magnitude = Math.hypot(delta.x, delta.y)
    if (magnitude !== 0 && Math.abs(magnitude - 6) > 1e-5) {
      throw new GameProtocolError(`${field}.delta is not the native contact Knockback step`)
    }
    const remainingTicks = positiveInteger(source.remainingTicks, `${field}.remainingTicks`)
    if (remainingTicks > 5 || common.ageTicks + remainingTicks !== 5) {
      throw new GameProtocolError(`${field} is outside the five-tick contact Knockback`)
    }
    return {
      ...common,
      delta,
      kind,
      remainingTicks,
      targetId: staffTargetId(source.targetId, `${field}.targetId`),
    }
  }
  if (kind === 'player-staff-pike-break') {
    onlyKeys(source, field, [
      'ageTicks', 'headingDegrees', 'id', 'kind', 'ownerId', 'position',
      'presentationRng', 'targetId', 'worldKey',
    ])
    if (common.ageTicks >= NATIVE_STAFF_PIKE_BREAK_LIFETIME_TICKS) {
      throw new GameProtocolError(`${field}.ageTicks outlived native Pike-break debris`)
    }
    return {
      ...common,
      headingDegrees: staffHeading(source.headingDegrees, `${field}.headingDegrees`),
      kind,
      position: vector(source.position, `${field}.position`),
      presentationRng: nativeRngState(source.presentationRng, `${field}.presentationRng`),
      targetId: staffTargetId(source.targetId, `${field}.targetId`),
    }
  }
  if (kind === 'player-staff-knockback') {
    onlyKeys(source, field, [
      'ageTicks', 'arcDegrees', 'id', 'kind', 'origin', 'ownerId',
      'remainingDistance', 'targetIds', 'worldKey',
    ])
    const arcDegrees = finite(source.arcDegrees, `${field}.arcDegrees`)
    if (arcDegrees !== 60 && arcDegrees !== 80 && arcDegrees !== 365) {
      throw new GameProtocolError(`${field}.arcDegrees is not a native Staff arc`)
    }
    const remainingDistance = positiveFinite(
      source.remainingDistance,
      `${field}.remainingDistance`,
    )
    if (remainingDistance > 150 || remainingDistance % 10 !== 0) {
      throw new GameProtocolError(`${field}.remainingDistance is outside Knockback`)
    }
    return {
      ...common,
      arcDegrees,
      kind,
      origin: vector(source.origin, `${field}.origin`),
      remainingDistance,
      targetIds: staffTargetIds(source.targetIds, `${field}.targetIds`),
    }
  }
  if (kind === 'player-staff-smoke') {
    onlyKeys(source, field, [
      'ageTicks', 'alpha', 'alphaLoss', 'angularVelocityDegrees', 'entry', 'id',
      'kind', 'ownerId', 'position', 'rotationDegrees', 'scale', 'worldKey',
    ])
    if (source.entry !== 15 || source.scale !== 8 || source.alphaLoss !== Math.fround(0.05)) {
      throw new GameProtocolError(`${field} does not match native SmokePuff constants`)
    }
    const alpha = positiveFinite(source.alpha, `${field}.alpha`)
    const angularVelocityDegrees = finite(
      source.angularVelocityDegrees,
      `${field}.angularVelocityDegrees`,
    )
    if (
      angularVelocityDegrees < Math.fround(2 / 3)
      || angularVelocityDegrees > Math.fround(4 / 3)
      || alpha !== staffFadeAlpha(1, Math.fround(0.05), common.ageTicks)
    ) throw new GameProtocolError(`${field} does not match native SmokePuff recurrence`)
    return {
      ...common,
      alpha,
      alphaLoss: Math.fround(0.05),
      angularVelocityDegrees,
      entry: 15,
      kind,
      position: vector(source.position, `${field}.position`),
      rotationDegrees: staffHeading(source.rotationDegrees, `${field}.rotationDegrees`),
      scale: 8,
    }
  }
  if (kind === 'player-staff-move-fade') {
    onlyKeys(source, field, [
      'ageTicks', 'alpha', 'alphaLoss', 'entry', 'id', 'kind', 'ownerId',
      'position', 'rotationDegrees', 'scale', 'tint', 'velocity',
      'velocityFactor', 'worldKey',
    ])
    const entry = source.entry
    if (entry !== 40 && entry !== 45) {
      throw new GameProtocolError(`${field}.entry is not a Staff MoveFade record`)
    }
    const tint = nonnegativeInteger(source.tint, `${field}.tint`)
    const alpha = positiveFinite(source.alpha, `${field}.alpha`)
    const alphaLoss = positiveFinite(source.alphaLoss, `${field}.alphaLoss`)
    const scale = positiveFinite(source.scale, `${field}.scale`)
    const velocityFactor = nonnegativeFinite(
      source.velocityFactor,
      `${field}.velocityFactor`,
    )
    if (
      !staffElementTint(tint)
      || (entry === 40 && (
        alphaLoss !== Math.fround(0.25)
        || scale !== 4
        || velocityFactor !== 1
        || alpha !== staffFadeAlpha(2, Math.fround(0.25), common.ageTicks)
      ))
      || (entry === 45 && (
        alphaLoss !== Math.fround(0.05)
        || scale < Math.fround(0.25)
        || scale > 1
        || velocityFactor !== Math.fround(0.92)
        || alpha !== staffFadeAlpha(Math.fround(1.5), Math.fround(0.05), common.ageTicks)
      ))
    ) throw new GameProtocolError(`${field} does not match native Staff MoveFade`)
    return {
      ...common,
      alpha,
      alphaLoss,
      entry,
      kind,
      position: vector(source.position, `${field}.position`),
      rotationDegrees: finite(source.rotationDegrees, `${field}.rotationDegrees`),
      scale,
      tint,
      velocity: vector(source.velocity, `${field}.velocity`),
      velocityFactor,
    }
  }
  onlyKeys(source, field, [
    'ageTicks', 'alpha', 'alphaLoss', 'entry', 'id', 'kind', 'ownerId',
    'position', 'rotationDegrees', 'scale', 'tint', 'worldKey',
  ])
  if (source.entry !== 88 || source.scale !== 3) {
    throw new GameProtocolError(`${field} does not match native Whirl fade constants`)
  }
  const tint = nonnegativeInteger(source.tint, `${field}.tint`)
  const alpha = positiveFinite(source.alpha, `${field}.alpha`)
  if (
    !staffElementTint(tint)
    || source.alphaLoss !== Math.fround(0.1)
    || alpha !== staffFadeAlpha(Math.fround(1.25), Math.fround(0.1), common.ageTicks)
  ) throw new GameProtocolError(`${field} does not match native Whirl fade recurrence`)
  return {
    ...common,
    alpha,
    alphaLoss: Math.fround(0.1),
    entry: 88,
    kind: 'player-staff-perspective-fade',
    position: vector(source.position, `${field}.position`),
    rotationDegrees: staffHeading(source.rotationDegrees, `${field}.rotationDegrees`),
    scale: 3,
    tint,
  }
}

function staffOutcome(value: unknown, field: string) {
  return memberString(value, field, [
    'normal', 'knockback', 'disabling-hit', 'critical-hit', 'whirl',
  ] as const)
}

function staffHeading(value: unknown, field: string): number {
  const heading = finite(value, field)
  if (heading < 0 || heading >= 360) {
    throw new GameProtocolError(`${field} must be within [0,360)`)
  }
  return heading
}

function staffPitch(value: unknown, field: string): number {
  const pitch = nonnegativeFinite(value, field)
  if (pitch > 2) throw new GameProtocolError(`${field} must be within [0,2]`)
  return pitch
}

function staffTargetIds(value: unknown, field: string): readonly string[] {
  const targetIds = limitedArray(value, field, MAX_PRIMARY_SPELL_HIT_TARGETS).map(
    (targetId, index) => limitedString(targetId, `${field}[${index}]`, 256),
  )
  if (targetIds.some((targetId) => !/^enemy:[1-9]\d*$/.test(targetId))) {
    throw new GameProtocolError(`${field} contains a non-enemy Staff target`)
  }
  if (new Set(targetIds).size !== targetIds.length) {
    throw new GameProtocolError(`${field} contains a duplicate target`)
  }
  return targetIds
}

function staffTargetId(value: unknown, field: string): string {
  const targetId = limitedString(value, field, 256)
  if (!/^enemy:[1-9]\d*$/.test(targetId)) {
    throw new GameProtocolError(`${field} is not an enemy Staff target`)
  }
  return targetId
}

function staffFadeAlpha(initial: number, loss: number, ageTicks: number): number {
  let alpha = Math.fround(initial)
  for (let tick = 0; tick < ageTicks; tick += 1) {
    alpha = Math.fround(alpha - loss)
  }
  return alpha
}

function staffElementTint(tint: number): boolean {
  return tint === 0xa0c3c3
    || tint === 0x90b390
    || tint === 0x886688
    || tint === 0x998077
    || tint === 0x5e6e81
}
