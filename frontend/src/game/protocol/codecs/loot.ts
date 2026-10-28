import { MAX_BONEYARD_LOOT_EVENTS } from '../game-protocol-limits.ts'
import {
  BONEYARD_LOOT_EVENT_TYPES,
  BONEYARD_LOOT_KINDS,
  BONEYARD_LOOT_SOUNDS,
  BONEYARD_LOOT_SOURCES,
  type BoneyardGoodieSnapshot,
  type BoneyardLootEventSnapshot,
  type BoneyardLootSnapshot,
} from '../game-state.ts'
import { boneyardPoint, nativeWorldManagerRegistration } from './native-state.ts'
import {
  GameProtocolError,
  boolean,
  boundedInteger,
  finite,
  integer,
  integerWithin,
  limitedArray,
  limitedString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveInteger,
  record,
  validatedPlayerId,
} from './values.ts'

export function boneyardLootSnapshot(value: unknown, field: string): BoneyardLootSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'activationDelayTicks',
    'ageTicks',
    'alpha',
    'amount',
    'animationPhase',
    'bonusKind',
    'bounceHeight',
    'framePhase',
    'id',
    'itemContentId',
    'itemNativeSubtype',
    'itemNativeTypeId',
    'kind',
    'nativeTypeId',
    'orbKind',
    'orbValue',
    'painterRegistration',
    'position',
    'rotationDeg',
    'scatterActive',
    'scatterProgress',
    'scatterSeed',
    'source',
    'spawnTick',
    'tier',
  ])
  const kind = limitedString(source.kind, `${field}.kind`, 16)
  if (!(BONEYARD_LOOT_KINDS as readonly string[]).includes(kind)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const expectedNativeType = { bonus: 2038, gold: 2012, orb: 2011, sack: 2013 }[kind]
  const nativeTypeId = positiveInteger(source.nativeTypeId, `${field}.nativeTypeId`)
  if (nativeTypeId !== expectedNativeType) {
    throw new GameProtocolError(`${field}.nativeTypeId does not match kind`)
  }
  const lootSource = limitedString(source.source, `${field}.source`, 16)
  if (!(BONEYARD_LOOT_SOURCES as readonly string[]).includes(lootSource)) {
    throw new GameProtocolError(`${field}.source is not supported`)
  }
  const orbKind = source.orbKind === null
    ? null
    : limitedString(source.orbKind, `${field}.orbKind`, 8)
  if ((kind === 'orb') !== (orbKind === 'health' || orbKind === 'mana')) {
    throw new GameProtocolError(`${field}.orbKind does not match kind`)
  }
  const bonusKind = source.bonusKind === null
    ? null
    : integerWithin(source.bonusKind, `${field}.bonusKind`, 0, 2) as 0 | 1 | 2
  if ((kind === 'bonus') !== (bonusKind !== null)) {
    throw new GameProtocolError(`${field}.bonusKind does not match kind`)
  }
  const itemNativeTypeId = source.itemNativeTypeId === null
    ? null
    : boundedInteger(source.itemNativeTypeId, `${field}.itemNativeTypeId`, 7001, 7013)
  const itemNativeSubtype = source.itemNativeSubtype === null
    ? null
    : boundedInteger(source.itemNativeSubtype, `${field}.itemNativeSubtype`, 0, 261)
  const itemContentId = source.itemContentId === null
    ? null
    : limitedString(source.itemContentId, `${field}.itemContentId`, 19)
  if (itemContentId !== null && !/^[1-9][0-9]{0,18}$/.test(itemContentId)) {
    throw new GameProtocolError(`${field}.itemContentId is invalid`)
  }
  if ((kind === 'sack') !== (itemNativeTypeId !== null)) {
    throw new GameProtocolError(`${field}.item identity does not match kind`)
  }
  if (
    kind === 'sack'
    && !validBoneyardSackItemIdentity(itemNativeTypeId!, itemNativeSubtype, itemContentId)
  ) throw new GameProtocolError(`${field}.item identity is not a native Sack payload`)
  const alpha = finite(source.alpha, `${field}.alpha`)
  const orbValue = nonnegativeFinite(source.orbValue, `${field}.orbValue`)
  if (alpha < 0 || alpha > 1 || orbValue > 1) {
    throw new GameProtocolError(`${field} alpha/value is outside [0,1]`)
  }
  const activationDelayTicks = integer(
    source.activationDelayTicks,
    `${field}.activationDelayTicks`,
  )
  const amount = nonnegativeInteger(source.amount, `${field}.amount`)
  const animationPhase = finite(source.animationPhase, `${field}.animationPhase`)
  const bounceHeight = finite(source.bounceHeight, `${field}.bounceHeight`)
  const framePhase = nonnegativeFinite(source.framePhase, `${field}.framePhase`)
  const rotationDeg = finite(source.rotationDeg, `${field}.rotationDeg`)
  const scatterActive = boolean(source.scatterActive, `${field}.scatterActive`)
  const scatterProgress = nonnegativeFinite(
    source.scatterProgress,
    `${field}.scatterProgress`,
  )
  const scatterSeed = nonnegativeInteger(source.scatterSeed, `${field}.scatterSeed`)
  const tier = integerWithin(source.tier, `${field}.tier`, 0, 3)
  if (!validBoneyardLootDynamicIdentity({
    activationDelayTicks,
    alpha,
    amount,
    animationPhase,
    bounceHeight,
    framePhase,
    kind: kind as BoneyardLootSnapshot['kind'],
    orbValue,
    rotationDeg,
    scatterActive,
    scatterProgress,
    scatterSeed,
    tier,
  })) throw new GameProtocolError(`${field} dynamic fields do not match kind`)
  return {
    activationDelayTicks,
    ageTicks: nonnegativeInteger(source.ageTicks, `${field}.ageTicks`),
    alpha,
    amount,
    animationPhase,
    bonusKind,
    bounceHeight,
    framePhase,
    id: boundedInteger(source.id, `${field}.id`, 1, 2_047),
    itemContentId,
    itemNativeSubtype,
    itemNativeTypeId,
    kind: kind as BoneyardLootSnapshot['kind'],
    nativeTypeId: nativeTypeId as BoneyardLootSnapshot['nativeTypeId'],
    orbKind: orbKind as BoneyardLootSnapshot['orbKind'],
    orbValue,
    painterRegistration: nativeWorldManagerRegistration(
      source.painterRegistration,
      `${field}.painterRegistration`,
      'actor',
    ),
    position: boneyardPoint(source.position, `${field}.position`),
    rotationDeg,
    scatterActive,
    scatterProgress,
    scatterSeed,
    source: lootSource as BoneyardLootSnapshot['source'],
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    tier,
  }
}

function validBoneyardSackItemIdentity(
  nativeTypeId: number,
  nativeSubtype: number | null,
  contentId: string | null,
): boolean {
  if (nativeTypeId === 7001) return nativeSubtype !== null && (
    nativeSubtype <= 5 ? contentId === null : contentId !== null
  )
  if (nativeTypeId === 7013) return nativeSubtype === null && contentId !== null
  if (contentId !== null) return false
  if (nativeTypeId === 7012) return nativeSubtype !== null && nativeSubtype <= 3
  if (nativeTypeId === 7008) return nativeSubtype === 0
  return [7002, 7003, 7004, 7005, 7006, 7011].includes(nativeTypeId)
    && nativeSubtype === null
}

function validBoneyardLootDynamicIdentity(
  loot: Pick<
    BoneyardLootSnapshot,
    | 'activationDelayTicks'
    | 'alpha'
    | 'amount'
    | 'animationPhase'
    | 'bounceHeight'
    | 'framePhase'
    | 'kind'
    | 'orbValue'
    | 'rotationDeg'
    | 'scatterActive'
    | 'scatterProgress'
    | 'scatterSeed'
    | 'tier'
  >,
): boolean {
  if (loot.kind === 'gold') {
    const tier = loot.amount < 3 ? 0 : loot.amount < 5 ? 1 : loot.amount < 8 ? 2 : 3
    return loot.amount > 0
      && loot.alpha === 0
      && loot.bounceHeight === 0
      && loot.framePhase === 0
      && loot.orbValue === 0
      && loot.scatterProgress <= 8.5
      && loot.scatterSeed <= 99_999
      && loot.tier === tier
  }
  if (
    loot.amount !== 0
    || loot.scatterActive
    || loot.scatterProgress !== 0
    || loot.scatterSeed !== 0
    || loot.tier !== 0
  ) return false
  if (loot.kind === 'sack') {
    return loot.alpha === 0
      && loot.animationPhase === 0
      && loot.bounceHeight <= 0
      && loot.framePhase === 0
      && loot.orbValue === 0
      && loot.rotationDeg === 0
  }
  if (loot.activationDelayTicks !== 0 || loot.bounceHeight !== 0) return false
  if (loot.kind === 'orb') {
    return loot.framePhase === 0 && loot.rotationDeg === 0
  }
  return loot.alpha > 0 && loot.framePhase <= 18 && loot.orbValue === 0
}

export function boneyardGoodieSnapshot(value: unknown, field: string): BoneyardGoodieSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'active', 'exhausted', 'id', 'phase', 'position',
    'sceneryRegistrationOrdinal', 'subtype', 'timer',
  ])
  const phase = integerWithin(source.phase, `${field}.phase`, 0, 2) as 0 | 1 | 2
  const timer = nonnegativeInteger(source.timer, `${field}.timer`)
  if (timer > 250) throw new GameProtocolError(`${field}.timer exceeds 250`)
  return {
    active: boolean(source.active, `${field}.active`),
    exhausted: boolean(source.exhausted, `${field}.exhausted`),
    id: positiveInteger(source.id, `${field}.id`),
    phase,
    position: boneyardPoint(source.position, `${field}.position`),
    sceneryRegistrationOrdinal: nonnegativeInteger(
      source.sceneryRegistrationOrdinal,
      `${field}.sceneryRegistrationOrdinal`,
    ),
    subtype: nonnegativeInteger(source.subtype, `${field}.subtype`),
    timer,
  }
}

export function boneyardLootEvents(
  value: unknown,
  field: string,
  runId: string,
  snapshotTick: number,
): BoneyardLootEventSnapshot[] {
  let priorEventId = 0
  let priorTick = -1
  return limitedArray(value, field, MAX_BONEYARD_LOOT_EVENTS).map((entry, index) => {
    const eventField = `${field}[${index}]`
    const source = record(entry, eventField)
    const type = limitedString(source.type, `${eventField}.type`, 32)
    if (!(BONEYARD_LOOT_EVENT_TYPES as readonly string[]).includes(type)) {
      throw new GameProtocolError(`${eventField}.type is not supported`)
    }
    const payloadKeys = type === 'goodie-phase'
      ? ['goodieId', 'phase']
      : type === 'goodie-key-needed'
        ? ['goodieId', 'playerId', 'text']
      : type === 'loot-drop-sound'
        ? ['playbackRate', 'sound']
        : ['playbackRate', 'playerId', 'sound', 'text']
    onlyKeys(source, eventField, [
      'actorId', 'eventId', 'position', 'runId', 'tick', 'type', ...payloadKeys,
    ])
    if (limitedString(source.runId, `${eventField}.runId`, 128) !== runId) {
      throw new GameProtocolError(`${eventField}.runId does not match its world`)
    }
    const eventId = positiveInteger(source.eventId, `${eventField}.eventId`)
    const tick = nonnegativeInteger(source.tick, `${eventField}.tick`)
    if (eventId <= priorEventId || tick < priorTick || tick > snapshotTick) {
      throw new GameProtocolError(`${eventField} is outside monotonic event order`)
    }
    priorEventId = eventId
    priorTick = tick
    const base = {
      actorId: positiveInteger(source.actorId, `${eventField}.actorId`),
      eventId,
      position: boneyardPoint(source.position, `${eventField}.position`),
      runId,
      tick,
      type: type as BoneyardLootEventSnapshot['type'],
    }
    if (type === 'goodie-phase') return {
      ...base,
      goodieId: positiveInteger(source.goodieId, `${eventField}.goodieId`),
      phase: integerWithin(source.phase, `${eventField}.phase`, 0, 2) as 0 | 1 | 2,
    }
    if (type === 'goodie-key-needed') {
      const text = limitedString(source.text, `${eventField}.text`, 128)
      if (text !== 'I need a key!') {
        throw new GameProtocolError(`${eventField}.text is not the native key prompt`)
      }
      return {
        ...base,
        goodieId: positiveInteger(source.goodieId, `${eventField}.goodieId`),
        playerId: validatedPlayerId(source.playerId, `${eventField}.playerId`),
        text,
      }
    }
    const sound = source.sound === undefined
      ? undefined
      : limitedString(source.sound, `${eventField}.sound`, 32)
    if (sound !== undefined && !(BONEYARD_LOOT_SOUNDS as readonly string[]).includes(sound)) {
      throw new GameProtocolError(`${eventField}.sound is not supported`)
    }
    const playbackRate = source.playbackRate === undefined
      ? undefined
      : finite(source.playbackRate, `${eventField}.playbackRate`)
    if (
      (sound === undefined) !== (playbackRate === undefined)
      || (playbackRate !== undefined && (playbackRate < 0.9 || playbackRate > 1.1))
    ) throw new GameProtocolError(`${eventField}.playbackRate does not match sound`)
    if (type === 'loot-drop-sound') {
      if (sound === undefined) throw new GameProtocolError(`${eventField}.sound is required`)
      return {
        ...base,
        playbackRate: playbackRate!,
        sound: sound as BoneyardLootEventSnapshot['sound'],
      }
    }
    return {
      ...base,
      playerId: validatedPlayerId(source.playerId, `${eventField}.playerId`),
      ...(playbackRate === undefined ? {} : { playbackRate }),
      ...(sound === undefined ? {} : { sound: sound as BoneyardLootEventSnapshot['sound'] }),
      ...(source.text === undefined
        ? {}
        : { text: limitedString(source.text, `${eventField}.text`, 128) }),
    }
  })
}
