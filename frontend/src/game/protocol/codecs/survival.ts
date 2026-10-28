import {
  BONEYARD_SOLOMON_DIG_CUES,
  BONEYARD_SOLOMON_PHASES,
  BONEYARD_SOLOMON_VOICE_CUES,
  type BoneyardSolomonDigCue,
  type BoneyardSolomonPhase,
  type BoneyardSolomonVoiceCue,
} from '../../core-kernels/boneyard-encounter.ts'
import {
  BONEYARD_WAVE_DIRECTOR_PHASES,
  type BoneyardWaveDirectorPhase,
  NATIVE_SLUMPGUT_PHASES,
  type NativeSlumpgutPhase,
} from '../../core-kernels/boneyard-wave-director.ts'
import {
  NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS,
  NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
  NATIVE_TUTORIAL_CUES,
  NATIVE_TUTORIAL_CUE_DEFINITIONS,
  NATIVE_TUTORIAL_STAGES,
  type NativeTutorialCue,
  type NativeTutorialState,
} from '../../core-kernels/native-tutorial.ts'
import { MAX_BONEYARD_DIG_EVENTS, MAX_BONEYARD_VOICE_EVENTS } from '../game-protocol-limits.ts'
import type { BoneyardSolomonSnapshot, BoneyardWaveSnapshot } from '../game-state.ts'
import { boneyardPoint, nativeRngState } from './native-state.ts'
import {
  GameProtocolError,
  boolean,
  boundedInteger,
  finite,
  limitedArray,
  limitedString,
  memberString,
  nonnegativeFinite,
  nonnegativeInteger,
  onlyKeys,
  positiveInteger,
  record,
  unitInterval,
  validatedPlayerId,
} from './values.ts'

export function boneyardSolomonSnapshot(
  value: unknown,
  field: string,
  snapshotTick: number,
): BoneyardSolomonSnapshot | null {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'acceleration',
    'digBodyOffsetY',
    'digEvents',
    'digFrame',
    'escapeSpeed',
    'headingDeg',
    'lifetimeTicksRemaining',
    'mouthPose',
    'mouthPoseTicksRemaining',
    'motion',
    'phase',
    'phaseTicksRemaining',
    'position',
    'runEventId',
    'targetPlayerId',
    'transitionOffsetY',
    'turnRate',
    'voiceEvents',
    'voiceTicksRemaining',
    'walkCycle',
  ])
  const phase = limitedString(source.phase, `${field}.phase`, 32)
  if (!(BONEYARD_SOLOMON_PHASES as readonly string[]).includes(phase)) {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  const headingDeg = finite(source.headingDeg, `${field}.headingDeg`)
  if (headingDeg < 0 || headingDeg > 360) {
    throw new GameProtocolError(`${field}.headingDeg must be within [0,360]`)
  }
  const mouthPose = nonnegativeInteger(source.mouthPose, `${field}.mouthPose`)
  if (mouthPose >= 3) {
    throw new GameProtocolError(`${field}.mouthPose must be within [0,3)`)
  }
  const digFrame = nonnegativeInteger(source.digFrame, `${field}.digFrame`)
  if (digFrame >= 18) {
    throw new GameProtocolError(`${field}.digFrame must be within [0,18)`)
  }
  const digBodyOffsetY = finite(source.digBodyOffsetY, `${field}.digBodyOffsetY`)
  if (digBodyOffsetY < -0.001 || digBodyOffsetY > 10) {
    throw new GameProtocolError(`${field}.digBodyOffsetY must be within [-0.001,10]`)
  }
  let previousDigEventId = 0
  let previousDigEventTick = 0
  const digEvents = limitedArray(
    source.digEvents,
    `${field}.digEvents`,
    MAX_BONEYARD_DIG_EVENTS,
  ).map((event, index) => {
    const eventField = `${field}.digEvents[${index}]`
    const item = record(event, eventField)
    onlyKeys(item, eventField, ['cue', 'id', 'tick'])
    const cue = limitedString(item.cue, `${eventField}.cue`, 64)
    if (!(BONEYARD_SOLOMON_DIG_CUES as readonly string[]).includes(cue)) {
      throw new GameProtocolError(`${eventField}.cue is not supported`)
    }
    const id = positiveInteger(item.id, `${eventField}.id`)
    const tick = nonnegativeInteger(item.tick, `${eventField}.tick`)
    if (id <= previousDigEventId || tick < previousDigEventTick || tick > snapshotTick) {
      throw new GameProtocolError(`${field}.digEvents must increase within snapshot tick`)
    }
    previousDigEventId = id
    previousDigEventTick = tick
    return { cue: cue as BoneyardSolomonDigCue, id, tick }
  })
  const transitionOffsetY = nonnegativeFinite(
    source.transitionOffsetY,
    `${field}.transitionOffsetY`,
  )
  if (transitionOffsetY > 15) {
    throw new GameProtocolError(`${field}.transitionOffsetY must be within [0,15]`)
  }
  const turnRate = nonnegativeFinite(source.turnRate, `${field}.turnRate`)
  if (turnRate > 10) {
    throw new GameProtocolError(`${field}.turnRate must be within [0,10]`)
  }
  const walkCycle = nonnegativeFinite(source.walkCycle, `${field}.walkCycle`)
  if (walkCycle > 6) {
    throw new GameProtocolError(`${field}.walkCycle must be within [0,6]`)
  }
  let previousVoiceEventId = 0
  const voiceEvents = limitedArray(
    source.voiceEvents,
    `${field}.voiceEvents`,
    MAX_BONEYARD_VOICE_EVENTS,
  ).map((event, index) => {
    const eventField = `${field}.voiceEvents[${index}]`
    const item = record(event, eventField)
    onlyKeys(item, eventField, ['cue', 'id'])
    const cue = limitedString(item.cue, `${eventField}.cue`, 64)
    if (!(BONEYARD_SOLOMON_VOICE_CUES as readonly string[]).includes(cue)) {
      throw new GameProtocolError(`${eventField}.cue is not supported`)
    }
    const id = positiveInteger(item.id, `${eventField}.id`)
    if (id <= previousVoiceEventId) {
      throw new GameProtocolError(`${field}.voiceEvents ids must increase`)
    }
    previousVoiceEventId = id
    return { cue: cue as BoneyardSolomonVoiceCue, id }
  })
  return {
    acceleration: finite(source.acceleration, `${field}.acceleration`),
    digBodyOffsetY,
    digEvents,
    digFrame,
    escapeSpeed: nonnegativeFinite(source.escapeSpeed, `${field}.escapeSpeed`),
    headingDeg,
    lifetimeTicksRemaining: nonnegativeInteger(
      source.lifetimeTicksRemaining,
      `${field}.lifetimeTicksRemaining`,
    ),
    mouthPose,
    mouthPoseTicksRemaining: nonnegativeInteger(
      source.mouthPoseTicksRemaining,
      `${field}.mouthPoseTicksRemaining`,
    ),
    motion: finite(source.motion, `${field}.motion`),
    phase: phase as BoneyardSolomonPhase,
    phaseTicksRemaining: nonnegativeInteger(
      source.phaseTicksRemaining,
      `${field}.phaseTicksRemaining`,
    ),
    position: boneyardPoint(source.position, `${field}.position`),
    runEventId: nonnegativeInteger(source.runEventId, `${field}.runEventId`),
    targetPlayerId: source.targetPlayerId === null
      ? null
      : validatedPlayerId(source.targetPlayerId, `${field}.targetPlayerId`),
    transitionOffsetY,
    turnRate,
    voiceEvents,
    voiceTicksRemaining: nonnegativeInteger(
      source.voiceTicksRemaining,
      `${field}.voiceTicksRemaining`,
    ),
    walkCycle,
  }
}

export function boneyardWaveSnapshot(
  value: unknown,
  field: string,
): BoneyardWaveSnapshot | null {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'interwaveDelayTicks',
    'pendingSpawnBudget',
    'phase',
    'scheduleIndex',
    'slumpgutPhase',
    'slumpgutTicksRemaining',
    'spawnDelayTicks',
    'waveEventId',
    'waveOrdinal',
  ])
  const phase = limitedString(source.phase, `${field}.phase`, 32)
  if (!(BONEYARD_WAVE_DIRECTOR_PHASES as readonly string[]).includes(phase)) {
    throw new GameProtocolError(`${field}.phase is not supported`)
  }
  const slumpgutPhase = limitedString(source.slumpgutPhase, `${field}.slumpgutPhase`, 32)
  if (!(NATIVE_SLUMPGUT_PHASES as readonly string[]).includes(slumpgutPhase)) {
    throw new GameProtocolError(`${field}.slumpgutPhase is not supported`)
  }
  return {
    interwaveDelayTicks: nonnegativeInteger(
      source.interwaveDelayTicks,
      `${field}.interwaveDelayTicks`,
    ),
    pendingSpawnBudget: nonnegativeInteger(
      source.pendingSpawnBudget,
      `${field}.pendingSpawnBudget`,
    ),
    phase: phase as BoneyardWaveDirectorPhase,
    scheduleIndex: nonnegativeInteger(source.scheduleIndex, `${field}.scheduleIndex`),
    slumpgutPhase: slumpgutPhase as NativeSlumpgutPhase,
    slumpgutTicksRemaining: nonnegativeInteger(
      source.slumpgutTicksRemaining,
      `${field}.slumpgutTicksRemaining`,
    ),
    spawnDelayTicks: nonnegativeInteger(
      source.spawnDelayTicks,
      `${field}.spawnDelayTicks`,
    ),
    waveEventId: nonnegativeInteger(source.waveEventId, `${field}.waveEventId`),
    waveOrdinal: nonnegativeInteger(source.waveOrdinal, `${field}.waveOrdinal`),
  }
}

export function nativeTutorialState(value: unknown, field: string): NativeTutorialState | null {
  if (value === null) return null
  const source = record(value, field)
  onlyKeys(source, field, [
    'active',
    'cameraLockAgeTicks',
    'cameraLockTriggered',
    'cameraLockTicksRemaining',
    'damageProtection',
    'dialogueArmed',
    'introActive',
    'introBlend',
    'introDelayTicksRemaining',
    'introFade',
    'introMovementTicksRemaining',
    'inventoryOpened',
    'inventorySeen',
    'itemDropArmed',
    'movementAnchor',
    'movementInstructionAcknowledged',
    'narration',
    'nextSpawnIntentId',
    'primaryCastSequenceAtStart',
    'rngState',
    'selectedSkillHudAcknowledged',
    'skillsOpened',
    'skillsSeen',
    'solomonDialogueQueued',
    'solomonRetreatQueued',
    'stage',
    'stageTicks',
    'survivalEnabled',
    'survivalIntervalCursor',
    'survivalLastCheckedTicks',
    'waveOrdinal',
    'waveSpawnCursor',
    'waveTicks',
  ])
  const stage = boundedInteger(source.stage, `${field}.stage`, 0, 19)
  if (!(NATIVE_TUTORIAL_STAGES as readonly number[]).includes(stage)) {
    throw new GameProtocolError(`${field}.stage is not supported`)
  }
  const active = boolean(source.active, `${field}.active`)
  if (!active && stage !== 19) {
    throw new GameProtocolError(`${field}.active may clear only at stage 19`)
  }
  const narrationSource = record(source.narration, `${field}.narration`)
  onlyKeys(narrationSource, `${field}.narration`, [
    'current',
    'nextEventId',
    'pending',
    'ticksRemaining',
  ])
  const nextEventId = positiveInteger(
    narrationSource.nextEventId,
    `${field}.narration.nextEventId`,
  )
  const pending = limitedArray(
    narrationSource.pending,
    `${field}.narration.pending`,
    64,
  ).map((cue, index) => tutorialCue(cue, `${field}.narration.pending[${index}]`))
  const current = narrationSource.current === null
    ? null
    : (() => {
        const currentField = `${field}.narration.current`
        const event = record(narrationSource.current, currentField)
        onlyKeys(event, currentField, ['cue', 'eventId', 'speaker', 'text'])
        const cueName = tutorialCue(event.cue, `${currentField}.cue`)
        const definition = NATIVE_TUTORIAL_CUE_DEFINITIONS[cueName]
        const eventId = positiveInteger(event.eventId, `${currentField}.eventId`)
        if (eventId >= nextEventId) {
          throw new GameProtocolError(`${currentField}.eventId must precede nextEventId`)
        }
        const speaker = memberString(
          event.speaker,
          `${currentField}.speaker`,
          ['sirmin', 'solomon'] as const,
        )
        const text = limitedString(event.text, `${currentField}.text`, 512)
        if (speaker !== definition.speaker || text !== definition.text) {
          throw new GameProtocolError(`${currentField} disagrees with its authored cue`)
        }
        return { cue: cueName, eventId, speaker, text }
      })()
  const ticksRemaining = boundedInteger(
    narrationSource.ticksRemaining,
    `${field}.narration.ticksRemaining`,
    0,
    100_000,
  )
  if ((current === null) !== (ticksRemaining === 0)) {
    throw new GameProtocolError(`${field}.narration current/ticks are inconsistent`)
  }
  if (
    current !== null
    && ticksRemaining > NATIVE_TUTORIAL_CUE_DEFINITIONS[current.cue].durationTicks
  ) throw new GameProtocolError(`${field}.narration ticks exceed the authored cue`)
  const intervalTicks = limitedArray(
    source.survivalLastCheckedTicks,
    `${field}.survivalLastCheckedTicks`,
    3,
  )
  if (intervalTicks.length !== 3) {
    throw new GameProtocolError(`${field}.survivalLastCheckedTicks needs three clocks`)
  }
  const introActive = boolean(source.introActive, `${field}.introActive`)
  const introBlend = unitInterval(source.introBlend, `${field}.introBlend`)
  const introDelayTicksRemaining = boundedInteger(
    source.introDelayTicksRemaining,
    `${field}.introDelayTicksRemaining`,
    0,
    25,
  )
  const introFade = unitInterval(source.introFade, `${field}.introFade`)
  if (!introActive && (
    introDelayTicksRemaining !== 0
    || introBlend !== 1
    || introFade !== 0
  )) throw new GameProtocolError(`${field} has an inconsistent completed intro`)
  if (introDelayTicksRemaining > 0 && (introBlend !== 0 || introFade !== 1)) {
    throw new GameProtocolError(`${field} has an inconsistent held intro`)
  }
  if (introBlend < 1 && introFade !== 1) {
    throw new GameProtocolError(`${field} fades before the intro blend completes`)
  }
  const cameraLockAgeTicks = boundedInteger(
    source.cameraLockAgeTicks,
    `${field}.cameraLockAgeTicks`,
    0,
    NATIVE_TUTORIAL_CAMERA_LOCK_SETTLE_TICKS,
  )
  const cameraLockTriggered = boolean(
    source.cameraLockTriggered,
    `${field}.cameraLockTriggered`,
  )
  const cameraLockTicksRemaining = boundedInteger(
    source.cameraLockTicksRemaining,
    `${field}.cameraLockTicksRemaining`,
    0,
    NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS,
  )
  if (!cameraLockTriggered && (cameraLockAgeTicks !== 0 || cameraLockTicksRemaining !== 0)) {
    throw new GameProtocolError(`${field} has camera-lock state before its trigger`)
  }
  if (
    cameraLockTriggered
    && cameraLockTicksRemaining !== Math.max(
      0,
      NATIVE_TUTORIAL_CAMERA_CLEANUP_TICKS - cameraLockAgeTicks,
    )
  ) throw new GameProtocolError(`${field} has inconsistent camera-lock clocks`)
  return {
    active,
    cameraLockAgeTicks,
    cameraLockTriggered,
    cameraLockTicksRemaining,
    damageProtection: boolean(source.damageProtection, `${field}.damageProtection`),
    dialogueArmed: boolean(source.dialogueArmed, `${field}.dialogueArmed`),
    introActive,
    introBlend,
    introDelayTicksRemaining,
    introFade,
    introMovementTicksRemaining: boundedInteger(
      source.introMovementTicksRemaining,
      `${field}.introMovementTicksRemaining`,
      0,
      250,
    ),
    inventoryOpened: boolean(source.inventoryOpened, `${field}.inventoryOpened`),
    inventorySeen: boolean(source.inventorySeen, `${field}.inventorySeen`),
    itemDropArmed: boolean(source.itemDropArmed, `${field}.itemDropArmed`),
    movementAnchor: boneyardPoint(source.movementAnchor, `${field}.movementAnchor`),
    movementInstructionAcknowledged: boolean(
      source.movementInstructionAcknowledged,
      `${field}.movementInstructionAcknowledged`,
    ),
    narration: { current, nextEventId, pending, ticksRemaining },
    nextSpawnIntentId: positiveInteger(source.nextSpawnIntentId, `${field}.nextSpawnIntentId`),
    primaryCastSequenceAtStart: nonnegativeInteger(
      source.primaryCastSequenceAtStart,
      `${field}.primaryCastSequenceAtStart`,
    ),
    rngState: nativeRngState(source.rngState, `${field}.rngState`),
    selectedSkillHudAcknowledged: boolean(
      source.selectedSkillHudAcknowledged,
      `${field}.selectedSkillHudAcknowledged`,
    ),
    skillsOpened: boolean(source.skillsOpened, `${field}.skillsOpened`),
    skillsSeen: boolean(source.skillsSeen, `${field}.skillsSeen`),
    solomonDialogueQueued: boolean(
      source.solomonDialogueQueued,
      `${field}.solomonDialogueQueued`,
    ),
    solomonRetreatQueued: boolean(
      source.solomonRetreatQueued,
      `${field}.solomonRetreatQueued`,
    ),
    stage: stage as NativeTutorialState['stage'],
    stageTicks: nonnegativeInteger(source.stageTicks, `${field}.stageTicks`),
    survivalEnabled: boolean(source.survivalEnabled, `${field}.survivalEnabled`),
    survivalIntervalCursor: boundedInteger(
      source.survivalIntervalCursor,
      `${field}.survivalIntervalCursor`,
      0,
      2,
    ) as 0 | 1 | 2,
    survivalLastCheckedTicks: intervalTicks.map((tick, index) => nonnegativeInteger(
      tick,
      `${field}.survivalLastCheckedTicks[${index}]`,
    )) as [number, number, number],
    waveOrdinal: boundedInteger(source.waveOrdinal, `${field}.waveOrdinal`, 0, 6),
    waveSpawnCursor: nonnegativeInteger(source.waveSpawnCursor, `${field}.waveSpawnCursor`),
    waveTicks: nonnegativeInteger(source.waveTicks, `${field}.waveTicks`),
  }
}

function tutorialCue(value: unknown, field: string): NativeTutorialCue {
  return memberString(value, field, NATIVE_TUTORIAL_CUES)
}
