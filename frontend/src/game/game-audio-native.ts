import {
  HUB_TEACHER_CAST_SECONDS,
  HUB_TEACHER_CYCLE_SECONDS,
} from './hub-teacher.ts'
import type {
  BoneyardSolomonDigCue,
  BoneyardSolomonDigEvent,
  BoneyardSolomonVoiceCue,
  BoneyardSolomonVoiceEvent,
} from './core-kernels/boneyard-encounter.ts'
import type {
  BoneyardEnemyEventSnapshot,
  BoneyardLootEventSnapshot,
} from './protocol/game-state.ts'
import type { NativeTutorialCue } from './core-kernels/native-tutorial.ts'

export const NATIVE_AUDIO_TICK_MS = 10

export type GameAudioScene =
  | 'boneyard'
  | 'boneyard-combat'
  | 'create'
  | 'game-over'
  | 'hub'
  | 'title'
export type GameMusicCue =
  | 'academy'
  | 'combat'
  | 'death'
  | 'prelude'
  | 'selection'
  | 'solomondarktheme'
export type GameSoundCue =
  | BoneyardSolomonDigCue
  | 'backpack-close'
  | 'backpack-open'
  | 'bad-action'
  | 'acid-sizzle'
  | 'banshee-die'
  | 'big-fire'
  | 'bite-1'
  | 'bite-2'
  | 'bite-3'
  | 'bone-crack'
  | 'click'
  | 'concentrate'
  | 'coffin-break'
  | 'critical-hit'
  | 'comet-whistle'
  | 'demon-die'
  | 'disable-enemy'
  | 'drink'
  | 'harden'
  | 'ice-shatter'
  | 'distort-reality'
  | 'drop-bag-1'
  | 'drop-bag-2'
  | 'drop-coins'
  | 'drop-potion'
  | 'explode-steam'
  | 'fireball-hit'
  | 'firey-death'
  | 'flame-lash-start'
  | 'flash'
  | 'flash-spell'
  | 'fizzle'
  | 'frost-missile'
  | 'hit-shield'
  | 'goto-orb'
  | 'hail-bounce-0'
  | 'hail-bounce-1'
  | 'hail-bounce-2'
  | 'hail-bounce-3'
  | 'hail-shot'
  | 'ice-start'
  | 'imp-split'
  | 'imp-vocal-1'
  | 'imp-vocal-2'
  | 'imp-vocal-3'
  | 'imp-vocal-4'
  | 'imp-vocal-5'
  | 'imp-vocal-6'
  | 'imp-vocal-7'
  | 'imp-vocal-8'
  | 'ignite'
  | 'knockback-golem'
  | 'knockback'
  | 'level-up'
  | 'lightning-start'
  | 'magic-missile'
  | 'magic-missile-hit'
  | 'magic-circle'
  | 'magic-shield-explode'
  | 'magic-shield-up'
  | 'magic-storm'
  | 'maggot-squeak-1'
  | 'maggot-squeak-2'
  | 'maggot-squish-1'
  | 'maggot-squish-2'
  | 'maggot-squish-3'
  | 'open-panel'
  | 'pick-skill'
  | 'poof'
  | 'nuke'
  | 'phase'
  | 'portal-die'
  | 'portal-hurt'
  | 'portal-open'
  | 'pop-shield'
  | 'pickup-bag'
  | 'pickup-coin'
  | 'rock-hit'
  | 'ring-of-ice'
  | 'skeleton-die'
  | 'shock-1'
  | 'shock-2'
  | 'shock-3'
  | 'shoot-arrow'
  | 'spin-attack'
  | 'staff-swoosh'
  | 'staff-hit-wood'
  | 'start-boulder'
  | 'stone-break'
  | 'stone-step'
  | 'stoneskin'
  | 'step-1'
  | 'step-2'
  | 'summon'
  | 'swipe'
  | 'teleport'
  | 'throw-fire'
  | 'throw-lightning-1'
  | 'throw-lightning-2'
  | 'unforge'
  | 'unlock-skill'
  | 'wizard-ouch-1'
  | 'frosted'
  | 'poisoned'
  | 'wizard-ouch-2'
  | 'wizard-ouch-3'
  | 'zombie-die'
  | 'zombie-die-groan'
  | 'zombie-ouch'
  | 'zombie-poison-splat'
export type CreateStreamCue = 'catch-it' | 'choose-element' | 'start-cast'
export type SecondaryStreamCue =
  | 'dampen'
  | 'golem-die'
  | 'golem-provoke'
  | 'leviathan-roar'
  | 'mindstar'
  | 'planewalker-off'
  | 'planewalker-on'
  | 'pike-break'
  | 'prismatic-shock'
  | 'quake-crack-small'
  | 'quake-cracks'
  | 'set-trap'
  | 'stoneskin-on'
  | 'thunder'
  | 'trap'
export type GameOverSolomonVoiceCue = 'solomon-laugh-big'
export type GameStreamCue =
  | CreateStreamCue
  | SecondaryStreamCue
  | BoneyardSolomonVoiceCue
  | GameOverSolomonVoiceCue
  | NativeTutorialCue
  | 'death-guitar'
  | 'dye'
  | 'arch-intro-0'
  | 'boast-failure'
export type GameLoopCue =
  | 'comet-loop'
  | 'electric-loop'
  | 'earthquake-loop'
  | 'fire-loop'
  | 'flyblown-loop'
  | 'gather-rocks-loop'
  | 'ice-beam-loop'
  | 'ice-loop'
  | 'lightning-loop'
  | 'low-fire-loop'
  | 'maggots-loop'
  | 'meteor-loop'
  | 'plane-cross-loop'
  | 'polisher-wipe'
  | 'rainfall-loop'
  | 'rolling-stone-loop'
  | 'soul-loop'
  | 'steady-wind-loop'
  | 'steam-loop'

export interface GameAudioSources {
  loops: Readonly<Record<GameLoopCue, string>>
  music: Readonly<Record<GameMusicCue, string>>
  sounds: Readonly<Record<GameSoundCue, string>>
  streams: Readonly<Record<GameStreamCue, string>>
}

export const NATIVE_SOUND_MAXIMUM_VOICES: Readonly<Partial<
  Record<GameSoundCue, number>
>> = Object.freeze({
  harden: 10,
  'ice-shatter': 10,
  'hail-bounce-0': 10,
  'hail-bounce-1': 10,
  'hail-bounce-2': 10,
  'hail-bounce-3': 10,
})

export const NATIVE_LEVEL_UP_SOUND_REQUEST = Object.freeze({
  cue: 'level-up' as const,
  playbackRate: 1,
})

export interface NativeEnemyEventSoundRequest {
  cue: GameSoundCue
  playbackRate: number
  sourcePosition: Readonly<{ x: number; y: number }> | null
  volume: number
}

export interface NativeSolomonDigSoundRequest {
  cue: BoneyardSolomonDigCue
  playbackRate: 1
  volume: 0.5 | 1
}

export function nativeSolomonDigSoundRequest(
  event: BoneyardSolomonDigEvent,
): NativeSolomonDigSoundRequest {
  return {
    cue: event.cue,
    playbackRate: 1,
    volume: event.cue === 'shovel-1' || event.cue === 'shovel-2' ? 0.5 : 1,
  }
}

export function nativeEnemyEventSoundRequest(
  event: BoneyardEnemyEventSnapshot,
): NativeEnemyEventSoundRequest | null {
  if (event.deflectPitch !== undefined) {
    return {
      cue: 'swipe',
      playbackRate: event.deflectPitch,
      sourcePosition: null,
      volume: 1,
    }
  }
  if (
    event.type !== 'enemy-action-sound'
    && event.type !== 'enemy-damage-sound'
    && event.type !== 'enemy-death-sound'
    && event.type !== 'player-damage-sound'
    && event.type !== 'player-status-sound'
  ) {
    return null
  }
  return {
    cue: event.sound as GameSoundCue,
    playbackRate: event.pitch!,
    sourcePosition: event.sound === 'poisoned' ? null : event.sourcePosition!,
    volume: event.gainScale!,
  }
}

export function nativeLootEventSoundRequest(
  event: BoneyardLootEventSnapshot,
): NativeEnemyEventSoundRequest | null {
  if (event.sound === undefined || event.playbackRate === undefined) return null
  return {
    cue: event.sound as GameSoundCue,
    playbackRate: event.playbackRate,
    sourcePosition: event.position,
    volume: 1,
  }
}

export function nativeBoneyardPointGain(
  sourcePosition: Readonly<{ x: number; y: number }>,
  cameraCenter: Readonly<{ x: number; y: number }>,
  visibleWorldWidth: number,
  localPlayerInDeathPresentation: boolean,
): number {
  const distance = Math.hypot(
    sourcePosition.x - cameraCenter.x,
    sourcePosition.y - cameraCenter.y,
  )
  const innerRadius = visibleWorldWidth * 0.25
  const outerRadius = visibleWorldWidth * 1.1
  const spatialGain = distance <= innerRadius
    ? 1
    : distance >= outerRadius
      ? 0
      : 1 - (distance - innerRadius) / (outerRadius - innerRadius)
  return spatialGain * (localPlayerInDeathPresentation ? 0.1 : 1)
}

export function nativeBoneyardHitPointGain(
  sourcePosition: Readonly<{ x: number; y: number }>,
  cameraCenter: Readonly<{ x: number; y: number }>,
  visibleWorldWidth: number,
  localPlayerInDeathPresentation: boolean,
): number {
  const distance = Math.hypot(
    sourcePosition.x - cameraCenter.x,
    sourcePosition.y - cameraCenter.y,
  )
  const innerRadius = visibleWorldWidth * 0.1
  const outerRadius = visibleWorldWidth * 0.5
  if (distance < innerRadius) return 1
  if (distance > outerRadius) return 0
  const gain = 1 - (distance - innerRadius) / (outerRadius - innerRadius)
  return gain * (localPlayerInDeathPresentation ? 0.1 : 1)
}

export const GAME_SCENE_MUSIC = {
  boneyard: { cue: 'prelude', transitionTicks: 100 },
  'boneyard-combat': { cue: 'combat', transitionTicks: 100 },
  create: { cue: 'selection', transitionTicks: 100 },
  'game-over': { cue: 'death', transitionTicks: 0 },
  hub: { cue: 'academy', transitionTicks: 2 },
  title: { cue: 'solomondarktheme', transitionTicks: 100 },
} as const satisfies Readonly<Record<GameAudioScene, {
  cue: GameMusicCue
  transitionTicks: number
}>>

export type CreateWizardElement = 'air' | 'earth' | 'ether' | 'fire' | 'water'

export type CreateAudioEvent =
  | { action: 'pause-stream'; cue: CreateStreamCue }
  | { action: 'play-sound'; cue: GameSoundCue }
  | { action: 'play-stream'; cue: CreateStreamCue }

export const CREATE_ENTRY_START_CAST_MS = 200
export const CREATE_ENTRY_CHOOSE_ELEMENT_MS = 1_340
export const CREATE_SELECTION_ELEMENT_SOUND_MS = 980
export const CREATE_SELECTION_START_CAST_MS = 990
export const CREATE_SELECTION_CHOOSE_DISCIPLINE_MS = 1_640
export const CREATE_DISCIPLINE_FINALIZE_MS = 880

export const CREATE_ELEMENT_SOUND = {
  air: 'lightning-start',
  earth: 'rock-hit',
  ether: 'magic-missile',
  fire: 'throw-fire',
  water: 'ice-start',
} as const satisfies Readonly<Record<CreateWizardElement, GameSoundCue>>

function crossed(previousMs: number, currentMs: number, thresholdMs: number): boolean {
  return previousMs < thresholdMs && currentMs >= thresholdMs
}

export function createEntryAudioEvents(
  previousMs: number,
  currentMs: number,
): CreateAudioEvent[] {
  const events: CreateAudioEvent[] = []
  if (crossed(previousMs, currentMs, CREATE_ENTRY_START_CAST_MS)) {
    events.push({ action: 'play-stream', cue: 'start-cast' })
  }
  if (crossed(previousMs, currentMs, CREATE_ENTRY_CHOOSE_ELEMENT_MS)) {
    events.push(
      { action: 'pause-stream', cue: 'start-cast' },
      { action: 'play-stream', cue: 'choose-element' },
    )
  }
  return events
}

export function createSelectionAudioEvents(
  element: CreateWizardElement,
  previousMs: number,
  currentMs: number,
): CreateAudioEvent[] {
  const events: CreateAudioEvent[] = []
  if (crossed(previousMs, currentMs, CREATE_SELECTION_ELEMENT_SOUND_MS)) {
    events.push({ action: 'play-sound', cue: CREATE_ELEMENT_SOUND[element] })
  }
  if (crossed(previousMs, currentMs, CREATE_SELECTION_START_CAST_MS)) {
    events.push({ action: 'play-stream', cue: 'start-cast' })
  }
  if (crossed(previousMs, currentMs, CREATE_SELECTION_CHOOSE_DISCIPLINE_MS)) {
    events.push(
      { action: 'pause-stream', cue: 'start-cast' },
      { action: 'play-stream', cue: 'choose-element' },
    )
  }
  return events
}

export interface AudioPoint {
  x: number
  y: number
}

export interface FootstepEventSample {
  footstepTick: number
}

export function newNativeFootstepTick(
  previous: FootstepEventSample | undefined,
  current: FootstepEventSample,
): number | undefined {
  if (!previous || current.footstepTick === 0) return undefined
  return previous.footstepTick === current.footstepTick
    ? undefined
    : current.footstepTick
}

export function newSolomonVoiceEvent(
  lastSeenEventId: number,
  current: readonly BoneyardSolomonVoiceEvent[],
): BoneyardSolomonVoiceEvent | null {
  const latest = current.at(-1)
  return latest && latest.id > lastSeenEventId ? latest : null
}

export interface SolomonDigAudioCursor {
  eventId: number
  runId: string
}

export function solomonDigAudioDelta(
  cursor: SolomonDigAudioCursor | null,
  runId: string,
  current: readonly BoneyardSolomonDigEvent[],
): Readonly<{
  cursor: SolomonDigAudioCursor
  events: readonly BoneyardSolomonDigEvent[]
}> {
  const latestEventId = current.at(-1)?.id ?? 0
  if (cursor === null || cursor.runId !== runId) {
    return {
      cursor: { eventId: latestEventId, runId },
      events: [],
    }
  }
  const events = current.filter((event) => event.id > cursor.eventId)
  return {
    cursor: {
      eventId: events.at(-1)?.id ?? cursor.eventId,
      runId,
    },
    events,
  }
}

function stableHash(value: string, salt: number): number {
  let hash = (0x811c9dc5 ^ salt) >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  hash ^= hash >>> 16
  return Math.imul(hash, 0x45d9f3b) >>> 0
}

export function nativeFootstepCue(tick: number, playerId: string): 'step-1' | 'step-2' {
  return (stableHash(playerId, tick) & 1) === 0 ? 'step-1' : 'step-2'
}

export const HUB_AUDIO_VIEW_WIDTH = 1_600
export const HUB_AUDIO_FULL_GAIN_RADIUS = 150
export const HUB_AUDIO_ATTENUATION_RADIUS = HUB_AUDIO_VIEW_WIDTH / 2
export const HUB_AUDIO_MINIMUM_ATTENUATION = 0.25
export const HUB_TEACHER_SOUND_GAIN = 0.25

export function hubAudioAttenuation(distance: number): number {
  if (distance < HUB_AUDIO_FULL_GAIN_RADIUS) return 1
  if (distance > HUB_AUDIO_ATTENUATION_RADIUS) return HUB_AUDIO_MINIMUM_ATTENUATION
  const attenuation = 1 - (
    (distance - HUB_AUDIO_FULL_GAIN_RADIUS)
    / (HUB_AUDIO_ATTENUATION_RADIUS - HUB_AUDIO_FULL_GAIN_RADIUS)
  )
  return Math.max(HUB_AUDIO_MINIMUM_ATTENUATION, attenuation)
}

export function hubTeacherSummonVolume(source: AudioPoint, listener: AudioPoint): number {
  return HUB_TEACHER_SOUND_GAIN * hubAudioAttenuation(
    Math.hypot(source.x - listener.x, source.y - listener.y),
  )
}

function teacherReleaseCountAt(elapsedSeconds: number): number {
  if (elapsedSeconds < HUB_TEACHER_CAST_SECONDS) return 0
  return Math.floor(
    (elapsedSeconds - HUB_TEACHER_CAST_SECONDS) / HUB_TEACHER_CYCLE_SECONDS,
  ) + 1
}

export function hubTeacherReleasesBetween(
  previousSeconds: number,
  currentSeconds: number,
): number[] {
  if (currentSeconds <= previousSeconds) return []
  const previousCount = teacherReleaseCountAt(Math.max(0, previousSeconds))
  const currentCount = teacherReleaseCountAt(Math.max(0, currentSeconds))
  return Array.from(
    { length: currentCount - previousCount },
    (_, index) => previousCount + index,
  )
}

export function hubTeacherSummonPitch(releaseIndex: number): number {
  return 1 + stableHash('teacher-summon', releaseIndex) / 0x1_0000_0000 * 0.1
}
