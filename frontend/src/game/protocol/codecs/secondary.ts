import {
  NATIVE_SECONDARY_AUDIO_CUES,
  NATIVE_SECONDARY_EVENT_KINDS,
  NATIVE_SECONDARY_GLOBAL_COOLDOWN_TICKS,
  NATIVE_SECONDARY_MOVEMENT_MODIFIER_KINDS,
  type NativeSecondaryAudioCue,
  type NativeSecondaryEventKind,
  type NativeSecondaryEventState,
  type NativeSecondaryMovementModifierKind,
  type NativeSecondaryPlayerState,
  type NativeSecondaryScreenFlashState,
  type NativeSecondaryTargetEffectState,
} from '../../core-kernels/native-secondary-abilities.ts'
import {
  MAX_PLAYERS,
  MAX_SECONDARY_ACTORS,
  MAX_SECONDARY_EVENTS,
  MAX_SECONDARY_TARGET_EFFECTS,
} from '../game-protocol-limits.ts'
import type {
  NativeSecondarySnapshotState as ProtocolNativeSecondarySnapshotState,
  ProtocolPlayerSnapshotFrame,
} from '../game-state.ts'
import { vector } from './native-state.ts'
import { nativeSecondaryActor, nativeSecondarySkillId } from './secondary-actors.ts'
import {
  GameProtocolError,
  boolean,
  limitedArray,
  limitedString,
  memberString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  positiveInteger,
  record,
  unitInterval,
  validatedPlayerId,
} from './values.ts'

export function nativeSecondaryState(
  value: unknown,
  field: string,
  players: Readonly<Record<string, ProtocolPlayerSnapshotFrame>>,
): ProtocolNativeSecondarySnapshotState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'actors', 'events', 'nextActorId', 'nextEventId', 'players', 'targetEffects',
  ])
  const actors = limitedArray(source.actors, `${field}.actors`, MAX_SECONDARY_ACTORS)
    .map((actor, index) => nativeSecondaryActor(actor, `${field}.actors[${index}]`, players))
  uniqueAscendingIds(actors, `${field}.actors`)
  const events = limitedArray(source.events, `${field}.events`, MAX_SECONDARY_EVENTS)
    .map((event, index) => nativeSecondaryEvent(event, `${field}.events[${index}]`))
  uniqueAscendingIds(events, `${field}.events`)
  const rawPlayerStates = record(source.players, `${field}.players`)
  if (Object.keys(rawPlayerStates).length > MAX_PLAYERS) {
    throw new GameProtocolError(`${field}.players may contain at most ${MAX_PLAYERS} entries`)
  }
  const playerStates: Record<string, NativeSecondaryPlayerState> = {}
  for (const [rawPlayerId, state] of Object.entries(rawPlayerStates)) {
    const playerId = validatedPlayerId(rawPlayerId, `${field} player id`)
    if (!players[playerId]) {
      throw new GameProtocolError(`${field}.players.${playerId} has no player snapshot`)
    }
    playerStates[playerId] = nativeSecondaryPlayer(state, `${field}.players.${playerId}`)
  }
  const targetEffects = limitedArray(
    source.targetEffects,
    `${field}.targetEffects`,
    MAX_SECONDARY_TARGET_EFFECTS,
  ).map((effect, index) => nativeSecondaryTargetEffectState(
    effect,
    `${field}.targetEffects[${index}]`,
  ))
  const effectKeys = new Set<string>()
  for (const effect of targetEffects) {
    const key = `${effect.worldKey}\u0000${effect.targetId}`
    if (effectKeys.has(key)) {
      throw new GameProtocolError(`${field}.targetEffects must have unique world/target keys`)
    }
    effectKeys.add(key)
    const frostBurnActive = effect.frostBurnTicks > 0
    if (frostBurnActive !== (
      effect.frostBurnDamagePerTick > 0
      && effect.frostBurnOwnerId !== null
      && effect.frostBurnSkillId !== null
      && effect.frostBurnSourceActorId !== null
    )) {
      throw new GameProtocolError(`${field}.targetEffects FrostBurn ownership is inconsistent`)
    }
    if (effect.frostBurnOwnerId !== null && !players[effect.frostBurnOwnerId]) {
      throw new GameProtocolError(`${field}.targetEffects FrostBurn owner has no player snapshot`)
    }
  }
  const nextActorId = positiveInteger(source.nextActorId, `${field}.nextActorId`)
  const nextEventId = positiveInteger(source.nextEventId, `${field}.nextEventId`)
  if (actors.some(({ id }) => id >= nextActorId)) {
    throw new GameProtocolError(`${field}.nextActorId is not ahead of live actors`)
  }
  if (events.some(({ eventId }) => eventId >= nextEventId)) {
    throw new GameProtocolError(`${field}.nextEventId is not ahead of retained events`)
  }
  return {
    actors,
    events,
    nextActorId,
    nextEventId,
    players: playerStates,
    targetEffects,
  }
}

function nativeSecondaryEvent(
  value: unknown,
  field: string,
): NativeSecondaryEventState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'actorId', 'cameraDisplacement', 'cameraMagnitude', 'cue', 'eventId', 'gain', 'kind',
    'ownerId', 'pitch', 'position', 'screenFlash', 'skillId', 'tick', 'worldKey',
  ])
  const cue = source.cue === null
    ? null
    : memberString(
        source.cue,
        `${field}.cue`,
        NATIVE_SECONDARY_AUDIO_CUES,
      ) as NativeSecondaryAudioCue
  const kind = memberString(
    source.kind,
    `${field}.kind`,
    NATIVE_SECONDARY_EVENT_KINDS,
  ) as NativeSecondaryEventKind
  const screenFlash = source.screenFlash === null
    ? null
    : nativeSecondaryScreenFlash(source.screenFlash, `${field}.screenFlash`)
  const skillId = source.skillId === null
    ? null
    : source.skillId === 22 || source.skillId === 36
      ? source.skillId
      : source.skillId === 53
        ? 53
      : nativeSecondarySkillId(source.skillId, `${field}.skillId`)
  if (skillId === 53 && (
    cue !== 'flash-spell' || kind !== 'impact' || screenFlash === null
  )) {
    throw new GameProtocolError(`${field} skill 53 is reserved for Flash response feedback`)
  }
  if (skillId === 36 && (
    (cue !== 'harden' && cue !== 'ice-shatter') || kind !== 'impact' || screenFlash !== null
  )) throw new GameProtocolError(`${field} skill 36 requires Harden audio feedback`)
  if (skillId === null && (cue !== null || kind !== 'impact' || screenFlash === null)) {
    throw new GameProtocolError(`${field} null skillId is reserved for player-effect feedback`)
  }
  return {
    actorId: source.actorId === null
      ? null
      : positiveInteger(source.actorId, `${field}.actorId`),
    cameraDisplacement: source.cameraDisplacement === null
      ? null
      : vector(source.cameraDisplacement, `${field}.cameraDisplacement`),
    cameraMagnitude: nonnegativeFinite(source.cameraMagnitude, `${field}.cameraMagnitude`),
    gain: nonnegativeFinite(source.gain, `${field}.gain`),
    cue,
    eventId: positiveInteger(source.eventId, `${field}.eventId`),
    kind,
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    pitch: positiveFinite(source.pitch, `${field}.pitch`),
    position: vector(source.position, `${field}.position`),
    screenFlash,
    skillId,
    tick: nonnegativeInteger(source.tick, `${field}.tick`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
}

function nativeSecondaryScreenFlash(
  value: unknown,
  field: string,
): NativeSecondaryScreenFlashState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'alpha', 'blue', 'decayPerTick', 'green', 'pointAttenuated', 'red',
  ])
  const decayPerTick = positiveFinite(source.decayPerTick, `${field}.decayPerTick`)
  if (decayPerTick > 1) {
    throw new GameProtocolError(`${field}.decayPerTick must be between zero and one`)
  }
  return {
    alpha: unitInterval(source.alpha, `${field}.alpha`),
    blue: unitInterval(source.blue, `${field}.blue`),
    decayPerTick,
    green: unitInterval(source.green, `${field}.green`),
    pointAttenuated: boolean(source.pointAttenuated, `${field}.pointAttenuated`),
    red: unitInterval(source.red, `${field}.red`),
  }
}

export function nativeSecondaryPlayer(value: unknown, field: string): NativeSecondaryPlayerState {
  const source = record(value, field)
  let castAction: NativeSecondaryPlayerState['castAction'] = null
  if (source.castAction !== null) {
    const action = record(source.castAction, `${field}.castAction`)
    onlyKeys(action, `${field}.castAction`, ['weaponKind', 'progress'])
    const weaponKind = action.weaponKind
    if (weaponKind !== null && weaponKind !== 'staff' && weaponKind !== 'wand') {
      throw new GameProtocolError(`${field}.castAction.weaponKind is not supported`)
    }
    const progress = nonnegativeFinite(action.progress, `${field}.castAction.progress`)
    if (progress > (weaponKind === 'staff' ? 5 : 6)) {
      throw new GameProtocolError(`${field}.castAction.progress exceeds the native action end`)
    }
    castAction = { weaponKind, progress }
  }
  onlyKeys(source, field, [
    'castSequence', 'castSpinTicksRemaining', 'cooldownTicksBySkill', 'firewalker',
    'cooldownMaximumTicksBySkill',
    'fizzleSequence', 'globalCooldownTicks', 'heldSlot', 'lastSkillId', 'magicShieldAbsorb',
    'magicShieldExplosionDamage',
    'magicShieldMaximum', 'magicShieldPulseTicks', 'mindstar', 'planeOrbHeld',
    'planewalkerTicksRemaining', 'regenerate', 'reservedMana',
    'castAction', 'stoneskinTicksRemaining',
  ])
  const cooldownMaximumTicksBySkill = limitedArray(
    source.cooldownMaximumTicksBySkill,
    `${field}.cooldownMaximumTicksBySkill`,
    83,
  ).map((ticks, index) => nonnegativeInteger(
    ticks,
    `${field}.cooldownMaximumTicksBySkill[${index}]`,
  ))
  if (cooldownMaximumTicksBySkill.length !== 83) {
    throw new GameProtocolError(`${field}.cooldownMaximumTicksBySkill must contain 83 rows`)
  }
  const cooldownTicksBySkill = limitedArray(
    source.cooldownTicksBySkill,
    `${field}.cooldownTicksBySkill`,
    83,
  ).map((ticks, index) => nonnegativeFinite(
    ticks,
    `${field}.cooldownTicksBySkill[${index}]`,
  ))
  if (cooldownTicksBySkill.length !== 83) {
    throw new GameProtocolError(`${field}.cooldownTicksBySkill must contain 83 rows`)
  }
  if (cooldownTicksBySkill.some((ticks, index) => (
    ticks > cooldownMaximumTicksBySkill[index]!
  ))) {
    throw new GameProtocolError(`${field}.cooldownTicksBySkill exceeds a capacity`)
  }
  const globalCooldownTicks = nonnegativeFinite(
    source.globalCooldownTicks,
    `${field}.globalCooldownTicks`,
  )
  if (globalCooldownTicks > NATIVE_SECONDARY_GLOBAL_COOLDOWN_TICKS) {
    throw new GameProtocolError(`${field}.globalCooldownTicks exceeds its native capacity`)
  }
  const heldSlot = source.heldSlot === null
    ? null
    : nonnegativeInteger(source.heldSlot, `${field}.heldSlot`)
  if (heldSlot !== null && heldSlot >= 8) {
    throw new GameProtocolError(`${field}.heldSlot is outside the skill quickbar`)
  }
  const lastSkillId = source.lastSkillId === null
    ? null
    : nativeSecondarySkillId(source.lastSkillId, `${field}.lastSkillId`)
  const magicShieldAbsorb = nonnegativeFinite(
    source.magicShieldAbsorb,
    `${field}.magicShieldAbsorb`,
  )
  const magicShieldMaximum = nonnegativeFinite(
    source.magicShieldMaximum,
    `${field}.magicShieldMaximum`,
  )
  if (magicShieldAbsorb > magicShieldMaximum) {
    throw new GameProtocolError(`${field}.magicShieldAbsorb exceeds its maximum`)
  }
  return {
    castSequence: nonnegativeInteger(source.castSequence, `${field}.castSequence`),
    castSpinTicksRemaining: nonnegativeInteger(
      source.castSpinTicksRemaining,
      `${field}.castSpinTicksRemaining`,
    ),
    cooldownMaximumTicksBySkill,
    cooldownTicksBySkill,
    firewalker: boolean(source.firewalker, `${field}.firewalker`),
    fizzleSequence: nonnegativeInteger(source.fizzleSequence, `${field}.fizzleSequence`),
    globalCooldownTicks,
    heldSlot,
    lastSkillId,
    magicShieldAbsorb,
    magicShieldExplosionDamage: nonnegativeFinite(
      source.magicShieldExplosionDamage,
      `${field}.magicShieldExplosionDamage`,
    ),
    magicShieldMaximum,
    magicShieldPulseTicks: nonnegativeInteger(
      source.magicShieldPulseTicks,
      `${field}.magicShieldPulseTicks`,
    ),
    mindstar: boolean(source.mindstar, `${field}.mindstar`),
    planeOrbHeld: boolean(source.planeOrbHeld, `${field}.planeOrbHeld`),
    planewalkerTicksRemaining: nonnegativeInteger(
      source.planewalkerTicksRemaining,
      `${field}.planewalkerTicksRemaining`,
    ),
    regenerate: boolean(source.regenerate, `${field}.regenerate`),
    reservedMana: nonnegativeFinite(source.reservedMana, `${field}.reservedMana`),
    castAction,
    stoneskinTicksRemaining: nonnegativeInteger(
      source.stoneskinTicksRemaining,
      `${field}.stoneskinTicksRemaining`,
    ),
  }
}

export function nativeSecondaryTargetEffectState(
  value: unknown,
  field: string,
): NativeSecondaryTargetEffectState {
  const source = record(value, field)
  onlyKeys(source, field, [
    'circleSlowFactor', 'circleSlowTicks',
    'coldSlowFactor', 'coldSlowMaterial', 'coldSlowTicks', 'dazzleMaximumTicks',
    'dazzleTicks', 'disruptedTicks', 'electricBurn', 'fleeTicks', 'frostBurnDamagePerTick',
    'frostBurnOwnerId', 'frostBurnSkillId', 'frostBurnSourceActorId', 'frostBurnTicks',
    'frozenTicks', 'frozenTimeScale', 'movementModifierOrder', 'prismaticTicks',
    'stunFactor', 'stunTicks',
    'steamed', 'targetId', 'timeScale', 'weakenFactor', 'worldKey',
  ])
  const dazzleMaximumTicks = nonnegativeInteger(
    source.dazzleMaximumTicks,
    `${field}.dazzleMaximumTicks`,
  )
  const dazzleTicks = nonnegativeInteger(source.dazzleTicks, `${field}.dazzleTicks`)
  if (dazzleTicks > dazzleMaximumTicks) {
    throw new GameProtocolError(`${field}.dazzleTicks exceeds its maximum`)
  }
  const frostBurnSkillId = source.frostBurnSkillId === null
    ? null
    : nonnegativeInteger(source.frostBurnSkillId, `${field}.frostBurnSkillId`)
  if (frostBurnSkillId !== null && frostBurnSkillId !== 35 && frostBurnSkillId !== 76) {
    throw new GameProtocolError(`${field}.frostBurnSkillId must be 35 or 76`)
  }
  const circleSlowFactor = unitInterval(source.circleSlowFactor, `${field}.circleSlowFactor`)
  const circleSlowTicks = nonnegativeInteger(source.circleSlowTicks, `${field}.circleSlowTicks`)
  const coldSlowFactor = unitInterval(source.coldSlowFactor, `${field}.coldSlowFactor`)
  const coldSlowTicks = nonnegativeInteger(source.coldSlowTicks, `${field}.coldSlowTicks`)
  const frozenTicks = nonnegativeInteger(source.frozenTicks, `${field}.frozenTicks`)
  const frozenTimeScale = unitInterval(source.frozenTimeScale, `${field}.frozenTimeScale`)
  const stunFactor = unitInterval(source.stunFactor, `${field}.stunFactor`)
  const stunTicks = nonnegativeInteger(source.stunTicks, `${field}.stunTicks`)
  const timeScale = unitInterval(source.timeScale, `${field}.timeScale`)
  const movementModifierOrder = limitedArray(
    source.movementModifierOrder,
    `${field}.movementModifierOrder`,
    NATIVE_SECONDARY_MOVEMENT_MODIFIER_KINDS.length,
  ).map((kind, index) => memberString(
    kind,
    `${field}.movementModifierOrder[${index}]`,
    NATIVE_SECONDARY_MOVEMENT_MODIFIER_KINDS,
  ) as NativeSecondaryMovementModifierKind)
  if (new Set(movementModifierOrder).size !== movementModifierOrder.length) {
    throw new GameProtocolError(`${field}.movementModifierOrder contains duplicates`)
  }
  const expectedMovementModifiers = [
    coldSlowTicks > 0 ? 'cold-slow' : null,
    circleSlowTicks > 0 ? 'circle-slow' : null,
    frozenTicks > 0 ? 'frozen' : null,
    stunTicks > 0 ? 'stun' : null,
    dazzleTicks > 0 ? 'dazzle' : null,
  ].filter((kind): kind is NativeSecondaryMovementModifierKind => kind !== null)
  const movementModifierSet = new Set(movementModifierOrder)
  if (
    movementModifierOrder.length !== expectedMovementModifiers.length
    || expectedMovementModifiers.some((kind) => !movementModifierSet.has(kind))
  ) throw new GameProtocolError(`${field}.movementModifierOrder does not match active clocks`)
  const dazzleFactor = dazzleTicks <= 0 || dazzleMaximumTicks <= 0
    ? 1
    : Math.max(1 / dazzleMaximumTicks, 1 - dazzleTicks / dazzleMaximumTicks)
  const factors: Readonly<Record<NativeSecondaryMovementModifierKind, number>> = {
    'circle-slow': circleSlowFactor,
    'cold-slow': coldSlowFactor,
    dazzle: dazzleFactor,
    frozen: frozenTimeScale,
    stun: stunFactor,
  }
  const expectedTimeScale = movementModifierOrder.reduce(
    (scale, kind) => Math.fround(scale * factors[kind]),
    Math.fround(1),
  )
  if (timeScale !== expectedTimeScale) {
    throw new GameProtocolError(`${field}.timeScale does not match modifier order`)
  }
  return {
    circleSlowFactor,
    circleSlowTicks,
    coldSlowFactor,
    coldSlowMaterial: boolean(source.coldSlowMaterial, `${field}.coldSlowMaterial`),
    coldSlowTicks,
    dazzleMaximumTicks,
    dazzleTicks,
    disruptedTicks: nonnegativeInteger(source.disruptedTicks, `${field}.disruptedTicks`),
    electricBurn: nativeSecondaryElectricBurnEffect(source.electricBurn, `${field}.electricBurn`),
    fleeTicks: nonnegativeInteger(source.fleeTicks, `${field}.fleeTicks`),
    frostBurnDamagePerTick: nonnegativeFinite(
      source.frostBurnDamagePerTick,
      `${field}.frostBurnDamagePerTick`,
    ),
    frostBurnOwnerId: source.frostBurnOwnerId === null
      ? null
      : validatedPlayerId(source.frostBurnOwnerId, `${field}.frostBurnOwnerId`),
    frostBurnSkillId: frostBurnSkillId as 35 | 76 | null,
    frostBurnSourceActorId: source.frostBurnSourceActorId === null
      ? null
      : positiveInteger(source.frostBurnSourceActorId, `${field}.frostBurnSourceActorId`),
    frostBurnTicks: nonnegativeInteger(source.frostBurnTicks, `${field}.frostBurnTicks`),
    frozenTicks,
    frozenTimeScale,
    movementModifierOrder,
    prismaticTicks: nonnegativeInteger(source.prismaticTicks, `${field}.prismaticTicks`),
    stunFactor,
    stunTicks,
    steamed: nativeSecondarySteamedEffect(source.steamed, `${field}.steamed`),
    targetId: nonnegativeInteger(source.targetId, `${field}.targetId`),
    timeScale,
    weakenFactor: unitInterval(source.weakenFactor, `${field}.weakenFactor`),
    worldKey: limitedString(source.worldKey, `${field}.worldKey`, 256),
  }
}

function nativeSecondaryElectricBurnEffect(
  value: unknown,
  field: string,
): NativeSecondaryTargetEffectState['electricBurn'] {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'arcCount', 'damagePerTick', 'ownerId', 'sourceActorId', 'stunFactor', 'ticks',
  ])
  return {
    arcCount: nonnegativeInteger(source.arcCount, `${field}.arcCount`),
    damagePerTick: nonnegativeFinite(source.damagePerTick, `${field}.damagePerTick`),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    sourceActorId: positiveInteger(source.sourceActorId, `${field}.sourceActorId`),
    stunFactor: unitInterval(source.stunFactor, `${field}.stunFactor`),
    ticks: positiveInteger(source.ticks, `${field}.ticks`),
  }
}

function nativeSecondarySteamedEffect(
  value: unknown,
  field: string,
): NativeSecondaryTargetEffectState['steamed'] {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'damagePerTick', 'emberDamage', 'emberFragments', 'explodeDamage', 'explodeRadius',
    'ownerId', 'sourceActorId', 'ticks',
  ])
  return {
    damagePerTick: nonnegativeFinite(source.damagePerTick, `${field}.damagePerTick`),
    emberDamage: nonnegativeFinite(source.emberDamage, `${field}.emberDamage`),
    emberFragments: nonnegativeInteger(source.emberFragments, `${field}.emberFragments`),
    explodeDamage: nonnegativeFinite(source.explodeDamage, `${field}.explodeDamage`),
    explodeRadius: nonnegativeFinite(source.explodeRadius, `${field}.explodeRadius`),
    ownerId: validatedPlayerId(source.ownerId, `${field}.ownerId`),
    sourceActorId: positiveInteger(source.sourceActorId, `${field}.sourceActorId`),
    ticks: positiveInteger(source.ticks, `${field}.ticks`),
  }
}

export function uniqueAscendingIds(
  values: readonly Readonly<{ id?: number; eventId?: number }>[],
  field: string,
): void {
  let previous = 0
  for (const value of values) {
    const id = value.id ?? value.eventId
    if (id === undefined || id <= previous) {
      throw new GameProtocolError(`${field} IDs must be unique and sorted`)
    }
    previous = id
  }
}
