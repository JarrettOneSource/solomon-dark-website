import { NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES } from '../../core-kernels/boneyard-mage-lightning.ts'
import {
  boneyardMageLightningPulseFrameIsValid,
  materializeBoneyardMageLightningPulse,
} from '../boneyard-mage-lightning-replication.ts'
import {
  MAX_BONEYARD_ENEMY_EVENTS,
  MAX_BONEYARD_MAGE_LIGHTNING_PULSES,
} from '../game-protocol-limits.ts'
import {
  BONEYARD_ENEMY_ACTION_SOUNDS,
  BONEYARD_ENEMY_DAMAGE_SOUNDS,
  BONEYARD_ENEMY_DEATH_EFFECT_KINDS,
  BONEYARD_ENEMY_DEATH_EFFECT_PRESENTATION_OWNERS,
  BONEYARD_ENEMY_DEATH_SOUNDS,
  BONEYARD_ENEMY_EVENT_TYPES,
  BONEYARD_ENEMY_TERMINAL_OUTPUTS,
  BONEYARD_PLAYER_DAMAGE_SOUNDS,
  BONEYARD_PLAYER_STATUS_SOUNDS,
  type BoneyardEnemyDeathEffectSnapshot,
  type BoneyardEnemyEventSnapshot,
  type BoneyardMageLightningPulseFrame,
  type BoneyardMageLightningPulseSnapshot,
} from '../game-state.ts'
import {
  absentNativeWorldManagerRegistration,
  boneyardPoint,
  nativeWorldManagerRegistration,
  nativeWorldPainterRegistrations,
  vector,
} from './native-state.ts'
import {
  GameProtocolError,
  boolean,
  finite,
  limitedArray,
  limitedString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveFinite,
  positiveInteger,
  record,
  validatedPlayerId,
} from './values.ts'

export function boneyardEnemyDeathEffectSnapshot(
  value: unknown,
  field: string,
): BoneyardEnemyDeathEffectSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, [
    'ageTicks',
    'alpha',
    'atlas',
    'blendMode',
    'entry',
    'height',
    'id',
    'kind',
    'ownerActorId',
    'painterRegistration',
    'presentationOwner',
    'position',
    'rotationRadians',
    'scale',
    'scaleY',
    'shadow',
    'spawnTick',
    'tint',
  ])
  const alpha = finite(source.alpha, `${field}.alpha`)
  const atlas = limitedString(source.atlas, `${field}.atlas`, 32)
  if (atlas !== 'BadGuys' && atlas !== 'DeadHawg' && atlas !== 'Demon') {
    throw new GameProtocolError(`${field}.atlas is not supported`)
  }
  const blendMode = limitedString(source.blendMode, `${field}.blendMode`, 16)
  if (blendMode !== 'add' && blendMode !== 'normal') {
    throw new GameProtocolError(`${field}.blendMode is not supported`)
  }
  const kind = limitedString(source.kind, `${field}.kind`, 32)
  if (!(BONEYARD_ENEMY_DEATH_EFFECT_KINDS as readonly string[]).includes(kind)) {
    throw new GameProtocolError(`${field}.kind is not supported`)
  }
  const presentationOwner = limitedString(
    source.presentationOwner,
    `${field}.presentationOwner`,
    32,
  )
  if (!(
    BONEYARD_ENEMY_DEATH_EFFECT_PRESENTATION_OWNERS as readonly string[]
  ).includes(presentationOwner)) {
    throw new GameProtocolError(`${field}.presentationOwner is not supported`)
  }
  const entry = nonnegativeInteger(source.entry, `${field}.entry`)
  const maximumAlpha = atlas === 'BadGuys'
    && blendMode === 'add'
    && entry === 69
    && kind === 'fade'
    ? 1.25
    : 1
  if (alpha < 0 || alpha > maximumAlpha) {
    throw new GameProtocolError(`${field}.alpha must be within [0,${maximumAlpha}]`)
  }
  const tint = nonnegativeInteger(source.tint, `${field}.tint`)
  if (tint > 0xffffff) {
    throw new GameProtocolError(`${field}.tint must be a 24-bit RGB value`)
  }
  return {
    ageTicks: nonnegativeFinite(source.ageTicks, `${field}.ageTicks`),
    alpha,
    atlas,
    blendMode,
    entry,
    height: finite(source.height, `${field}.height`),
    id: positiveInteger(source.id, `${field}.id`),
    kind: kind as BoneyardEnemyDeathEffectSnapshot['kind'],
    ownerActorId: positiveInteger(source.ownerActorId, `${field}.ownerActorId`),
    painterRegistration: presentationOwner === 'world-sorted'
      ? nativeWorldManagerRegistration(
          source.painterRegistration,
          `${field}.painterRegistration`,
          'actor',
        )
      : absentNativeWorldManagerRegistration(
          source.painterRegistration,
          `${field}.painterRegistration`,
        ),
    presentationOwner:
      presentationOwner as BoneyardEnemyDeathEffectSnapshot['presentationOwner'],
    position: boneyardPoint(source.position, `${field}.position`),
    rotationRadians: finite(source.rotationRadians, `${field}.rotationRadians`),
    scale: positiveFinite(source.scale, `${field}.scale`),
    scaleY: positiveFinite(source.scaleY, `${field}.scaleY`),
    shadow: boolean(source.shadow, `${field}.shadow`),
    spawnTick: nonnegativeInteger(source.spawnTick, `${field}.spawnTick`),
    tint,
  }
}

export function boneyardEnemyEvents(
  value: unknown,
  field: string,
  runId: string,
  snapshotTick: number,
): BoneyardEnemyEventSnapshot[] {
  let previousEventId = 0
  let previousTick = -1
  return limitedArray(value, field, MAX_BONEYARD_ENEMY_EVENTS).map((event, index) => {
    const eventField = `${field}[${index}]`
    const source = record(event, eventField)
    const rawType = limitedString(source.type, `${eventField}.type`, 64)
    if (!(BONEYARD_ENEMY_EVENT_TYPES as readonly string[]).includes(rawType)) {
      throw new GameProtocolError(`${eventField}.type is not supported`)
    }
    const type = rawType as BoneyardEnemyEventSnapshot['type']
    const payloadKeys = (() => {
      switch (type) {
        case 'attack-marker': return [
          'deflectPitch',
          'painterRegistration',
          'targetPlayerId',
        ]
        case 'player-deflected': return ['deflectPitch', 'targetPlayerId']
        case 'mage-lightning-contact': return ['deflectPitch', 'targetPlayerId']
        case 'enemy-spawned':
        case 'reward': return ['targetPlayerId']
        case 'coffin-maggot-release': return ['count']
        case 'enemy-death':
        case 'cocoon-released':
        case 'enemy-retired': return []
        case 'enemy-action-sound':
        case 'enemy-damage-sound':
        case 'enemy-death-sound': return [
          'gainScale',
          'pitch',
          'sound',
          'sourcePosition',
        ]
        case 'player-status-sound':
        case 'player-damage-sound': return [
          'gainScale',
          'pitch',
          'sound',
          'sourcePosition',
          'targetPlayerId',
        ]
        case 'enemy-terminal-output': return ['count', 'output']
        case 'projectile-impact': return [
          'deflectPitch',
          'projectileId',
          'targetPlayerId',
        ]
        case 'projectile-retired':
        case 'projectile-spawned': return ['projectileId', 'targetPlayerId']
      }
    })()
    onlyKeys(source, eventField, [
      'actorId',
      'eventId',
      'runId',
      'tick',
      'type',
      ...payloadKeys,
    ])
    const eventRunId = limitedString(source.runId, `${eventField}.runId`, 128)
    if (eventRunId !== runId) {
      throw new GameProtocolError(`${eventField}.runId does not match its Boneyard world`)
    }
    const eventId = positiveInteger(source.eventId, `${eventField}.eventId`)
    if (eventId <= previousEventId) {
      throw new GameProtocolError(`${field} eventIds must increase`)
    }
    const tick = nonnegativeInteger(source.tick, `${eventField}.tick`)
    if (tick < previousTick) {
      throw new GameProtocolError(`${field} ticks must not decrease`)
    }
    if (tick > snapshotTick) {
      throw new GameProtocolError(`${eventField}.tick exceeds its snapshot tick`)
    }
    previousEventId = eventId
    previousTick = tick
    const base = {
      actorId: type === 'player-deflected'
        ? nonnegativeInteger(source.actorId, `${eventField}.actorId`)
        : positiveInteger(source.actorId, `${eventField}.actorId`),
      eventId,
      runId,
      tick,
      type,
    }
    switch (type) {
      case 'attack-marker': {
        const targetPlayerId = nullablePlayerId(
          source.targetPlayerId,
          `${eventField}.targetPlayerId`,
        )
        const deflect = deflectPitchPayload(source.deflectPitch, eventField)
        if (deflect.deflectPitch !== undefined && targetPlayerId === null) {
          throw new GameProtocolError(`${eventField}.deflectPitch requires a targetPlayerId`)
        }
        return {
          ...base,
          ...deflect,
          ...(source.painterRegistration === undefined
            ? {}
            : {
                painterRegistration: nativeWorldManagerRegistration(
                  source.painterRegistration,
                  `${eventField}.painterRegistration`,
                  'transient',
                ),
              }),
          targetPlayerId,
        }
      }
      case 'enemy-spawned':
      case 'reward': return {
        ...base,
        targetPlayerId: nullablePlayerId(source.targetPlayerId, `${eventField}.targetPlayerId`),
      }
      case 'coffin-maggot-release': return {
        ...base,
        count: nonnegativeInteger(source.count, `${eventField}.count`),
      }
      case 'enemy-death':
      case 'cocoon-released':
      case 'enemy-retired': return base
      case 'enemy-action-sound':
      case 'enemy-damage-sound':
      case 'enemy-death-sound':
      case 'player-status-sound':
      case 'player-damage-sound': {
        const sound = limitedString(source.sound, `${eventField}.sound`, 64)
        const supportedSounds = type === 'enemy-action-sound'
          ? BONEYARD_ENEMY_ACTION_SOUNDS
          : type === 'enemy-damage-sound'
            ? BONEYARD_ENEMY_DAMAGE_SOUNDS
            : type === 'enemy-death-sound'
              ? BONEYARD_ENEMY_DEATH_SOUNDS
              : type === 'player-status-sound' ? BONEYARD_PLAYER_STATUS_SOUNDS : BONEYARD_PLAYER_DAMAGE_SOUNDS
        if (!(supportedSounds as readonly string[]).includes(sound)) {
          throw new GameProtocolError(`${eventField}.sound is not supported`)
        }
        const pitch = positiveFinite(source.pitch, `${eventField}.pitch`)
        if (pitch > 2) {
          throw new GameProtocolError(`${eventField}.pitch must be within (0,2]`)
        }
        const gainScale = nonnegativeFinite(
          source.gainScale,
          `${eventField}.gainScale`,
        )
        const maximumGain = type === 'enemy-action-sound' && (sound === 'fireball-hit' || sound === 'throw-fire') ? 2 : 1
        if (gainScale > maximumGain) {
          throw new GameProtocolError(`${eventField}.gainScale must be within [0,${maximumGain}]`)
        }
        return {
          ...base,
          gainScale,
          pitch,
          sound: sound as BoneyardEnemyEventSnapshot['sound'],
          sourcePosition: vector(source.sourcePosition, `${eventField}.sourcePosition`),
          ...(type === 'player-damage-sound' || type === 'player-status-sound'
            ? {
                targetPlayerId: nullablePlayerId(
                  source.targetPlayerId,
                  `${eventField}.targetPlayerId`,
                ),
              }
            : {}),
        }
      }
      case 'enemy-terminal-output': {
        const output = limitedString(source.output, `${eventField}.output`, 64)
        if (!(BONEYARD_ENEMY_TERMINAL_OUTPUTS as readonly string[]).includes(output)) {
          throw new GameProtocolError(`${eventField}.output is not supported`)
        }
        return {
          ...base,
          output: output as BoneyardEnemyEventSnapshot['output'],
          ...(source.count === undefined
            ? {}
            : { count: nonnegativeInteger(source.count, `${eventField}.count`) }),
        }
      }
      case 'player-deflected': return {
        ...base,
        deflectPitch: positiveFinite(source.deflectPitch, `${eventField}.deflectPitch`),
        targetPlayerId: validatedPlayerId(source.targetPlayerId, `${eventField}.targetPlayerId`),
      }
      case 'mage-lightning-contact': return {
        ...base,
        ...deflectPitchPayload(source.deflectPitch, eventField),
        targetPlayerId: validatedPlayerId(source.targetPlayerId, `${eventField}.targetPlayerId`),
      }
      case 'projectile-impact': {
        const targetPlayerId = nullablePlayerId(
          source.targetPlayerId,
          `${eventField}.targetPlayerId`,
        )
        const deflect = deflectPitchPayload(source.deflectPitch, eventField)
        if (deflect.deflectPitch !== undefined && targetPlayerId === null) {
          throw new GameProtocolError(`${eventField}.deflectPitch requires a targetPlayerId`)
        }
        return {
          ...base,
          ...deflect,
          projectileId: positiveInteger(source.projectileId, `${eventField}.projectileId`),
          targetPlayerId,
        }
      }
      case 'projectile-retired':
      case 'projectile-spawned': return {
        ...base,
        projectileId: positiveInteger(source.projectileId, `${eventField}.projectileId`),
        targetPlayerId: nullablePlayerId(source.targetPlayerId, `${eventField}.targetPlayerId`),
      }
    }
  })
}

function deflectPitchPayload(
  value: unknown,
  field: string,
): Readonly<{ deflectPitch?: number }> {
  if (value === undefined) return {}
  const deflectPitch = nonnegativeFinite(value, `${field}.deflectPitch`)
  if (deflectPitch > 2) {
    throw new GameProtocolError(`${field}.deflectPitch must be within [0,2]`)
  }
  return { deflectPitch }
}

export function boneyardMageLightningPulses(
  value: unknown,
  field: string,
  snapshotTick: number,
): BoneyardMageLightningPulseSnapshot[] {
  const pulses = limitedArray(
    value,
    field,
    MAX_BONEYARD_MAGE_LIGHTNING_PULSES,
  ).map((pulse, index): BoneyardMageLightningPulseSnapshot => {
    const pulseField = `${field}[${index}]`
    const source = record(pulse, pulseField)
    onlyKeys(source, pulseField, [
      'contact',
      'endpoint',
      'id',
      'midpoint',
      'ownerActorId',
      'painterRegistrations',
      'seed',
      'source',
      'tick',
    ])
    const contactField = `${pulseField}.contact`
    const contactSource = record(source.contact, contactField)
    const kind = limitedString(contactSource.kind, `${contactField}.kind`, 32)
    const contact = (() => {
      if (kind === 'world') {
        onlyKeys(contactSource, contactField, ['kind', 'position'])
        return {
          kind: 'world' as const,
          position: vector(contactSource.position, `${contactField}.position`),
        }
      }
      if (kind === 'target-attached') {
        onlyKeys(contactSource, contactField, ['kind', 'localOffset', 'targetPlayerId'])
        return {
          kind: 'target-attached' as const,
          localOffset: vector(contactSource.localOffset, `${contactField}.localOffset`),
          targetPlayerId: validatedPlayerId(
            contactSource.targetPlayerId,
            `${contactField}.targetPlayerId`,
          ),
        }
      }
      throw new GameProtocolError(`${contactField}.kind is not supported`)
    })()
    const seed = nonnegativeInteger(source.seed, `${pulseField}.seed`)
    if (seed > 0xffff_ffff) {
      throw new GameProtocolError(`${pulseField}.seed must be an unsigned 32-bit integer`)
    }
    return {
      contact,
      endpoint: vector(source.endpoint, `${pulseField}.endpoint`),
      id: positiveInteger(source.id, `${pulseField}.id`),
      midpoint: vector(source.midpoint, `${pulseField}.midpoint`),
      ownerActorId: positiveInteger(source.ownerActorId, `${pulseField}.ownerActorId`),
      painterRegistrations: nativeWorldPainterRegistrations(
        source.painterRegistrations,
        `${pulseField}.painterRegistrations`,
        'actor',
        contact.kind === 'world' ? 3 : 2,
      ),
      seed,
      source: vector(source.source, `${pulseField}.source`),
      tick: nonnegativeInteger(source.tick, `${pulseField}.tick`),
    }
  })
  validateBoneyardMageLightningPulseSequence(pulses, field, snapshotTick)
  return pulses
}

function validateBoneyardMageLightningPulseSequence(
  pulses: readonly BoneyardMageLightningPulseSnapshot[],
  field: string,
  snapshotTick: number,
): void {
  let previousId = 0
  let previousTick = -1
  pulses.forEach((pulse, index) => {
    const pulseField = `${field}[${index}]`
    if (pulse.id <= previousId) {
      throw new GameProtocolError(`${field} ids must increase`)
    }
    if (pulse.tick < previousTick) {
      throw new GameProtocolError(`${field} ticks must not decrease`)
    }
    if (pulse.tick > snapshotTick) {
      throw new GameProtocolError(`${pulseField}.tick exceeds its snapshot tick`)
    }
    if (snapshotTick - pulse.tick >= NATIVE_MAGE_LIGHTNING_MAX_PULSE_AGES) {
      throw new GameProtocolError(`${pulseField} exceeds the live pulse age limit`)
    }
    previousId = pulse.id
    previousTick = pulse.tick
  })
}

export function boneyardMageLightningPulseFrames(
  value: unknown,
  field: string,
  snapshotTick: number,
): BoneyardMageLightningPulseFrame[] {
  const frames = limitedArray(
    value,
    field,
    MAX_BONEYARD_MAGE_LIGHTNING_PULSES,
  ).map((frame, index) => {
    if (!boneyardMageLightningPulseFrameIsValid(frame)) {
      throw new GameProtocolError(`${field}[${index}] is not a valid compact pulse`)
    }
    return [...frame] as BoneyardMageLightningPulseFrame
  })
  validateBoneyardMageLightningPulseSequence(
    frames.map(materializeBoneyardMageLightningPulse),
    field,
    snapshotTick,
  )
  return frames
}

function nullablePlayerId(value: unknown, field: string): string | null {
  return value === null ? null : validatedPlayerId(value, field)
}
