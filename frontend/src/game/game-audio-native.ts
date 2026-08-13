import {
  HUB_TEACHER_CAST_SECONDS,
  HUB_TEACHER_CYCLE_SECONDS,
} from './hub-teacher.ts'

export const NATIVE_AUDIO_TICK_MS = 10

export type GameAudioScene = 'create' | 'hub' | 'title'
export type GameMusicCue = 'academy' | 'selection' | 'solomondarktheme'
export type GameSoundCue =
  | 'click'
  | 'ice-start'
  | 'lightning-start'
  | 'magic-missile'
  | 'pick-skill'
  | 'rock-hit'
  | 'step-1'
  | 'step-2'
  | 'summon'
  | 'throw-fire'
export type GameStreamCue = 'catch-it' | 'choose-element' | 'start-cast'

export interface GameAudioSources {
  music: Readonly<Record<GameMusicCue, string>>
  sounds: Readonly<Record<GameSoundCue, string>>
  streams: Readonly<Record<GameStreamCue, string>>
}

export const NATIVE_MUSIC_MODULE_SHA256 = '32bf92cc3191e136b6d186d77d75de48ad28f4bd58acae0c278204455fa57c82'

interface NativeMusicEntry {
  musicTxtOrder: number
  moduleSubsong: number
  sourceName: string
}

interface NativeSoundEntry {
  registryOffset: number
  sourceName: string
  sourceSha256: string
}

export const NATIVE_MUSIC_MANIFEST = {
  academy: { musicTxtOrder: 101, moduleSubsong: 6, sourceName: 'academy' },
  selection: { musicTxtOrder: 116, moduleSubsong: 7, sourceName: 'selection' },
  solomondarktheme: {
    musicTxtOrder: 95,
    moduleSubsong: 5,
    sourceName: 'solomondarktheme',
  },
} as const satisfies Readonly<Record<GameMusicCue, NativeMusicEntry>>

export const NATIVE_SOUND_MANIFEST = {
  click: {
    registryOffset: 0x18,
    sourceName: 'sounds\\click',
    sourceSha256: '8aeebcfeb69625bee2ee78fe9c63939e6b40edcc89d5facf2c0d35e1b5920307',
  },
  'ice-start': {
    registryOffset: 0x7a8,
    sourceName: 'sounds\\icestart',
    sourceSha256: '28cfda1e9d59f39dfacfd808cdb267465592ae5ce0d34a9aa4495a3f659b9694',
  },
  'lightning-start': {
    registryOffset: 0x960,
    sourceName: 'sounds\\lightningstart',
    sourceSha256: '1542ec3ab4e41624b5e8d073000a02bb36a3f8c733bf709835768f095494dceb',
  },
  'magic-missile': {
    registryOffset: 0x9e4,
    sourceName: 'sounds\\magicmissile',
    sourceSha256: 'a7765b778d5cc49546c5e7e7822f38aac6a3edd8636d91e4ae92ec78611ac567',
  },
  'pick-skill': {
    registryOffset: 0x44,
    sourceName: 'sounds\\pickskill',
    sourceSha256: '494d1b973bd3f319199199ec9cf851491caee10c3d72dbe61acda69d28daabe4',
  },
  'rock-hit': {
    registryOffset: 0xd54,
    sourceName: 'sounds\\rockhit',
    sourceSha256: '865484cf3d7c2e199fb46f069973c43893122e934f0f46ba33d30eeeac4de25b',
  },
  'step-1': {
    registryOffset: 0x23b8,
    sourceName: 'sounds\\Step\\step1',
    sourceSha256: 'ded73389ae0481167c73a904f95c1dc12c89c7e807b5815bb65b8a786582322a',
  },
  'step-2': {
    registryOffset: 0x23e4,
    sourceName: 'sounds\\Step\\step2',
    sourceSha256: '62c9ef1c7dfd68762dc32aca8d718e385821c102f4ada11502f93bf23ae50dba',
  },
  summon: {
    registryOffset: 0x1014,
    sourceName: 'sounds\\summon',
    sourceSha256: '3c910b3918c0f45558123464301ed423974bf2356dfb8934c7d9321addac38cd',
  },
  'throw-fire': {
    registryOffset: 0x10c4,
    sourceName: 'sounds\\throwfire',
    sourceSha256: 'b6e14b90d00e27a9b2ceba404ea1c113a7d7bf5f14aa69987ec9629669b53de0',
  },
} as const satisfies Readonly<Record<GameSoundCue, NativeSoundEntry>>

export const NATIVE_STREAM_MANIFEST = {
  'catch-it': {
    registryOffset: 0x1344,
    sourceName: 'sounds\\catchit__stream',
    sourceSha256: 'd2d26d32d0701fb7c08432f59eca099d75e33842f01ec89eae60b467ad90bf39',
  },
  'choose-element': {
    registryOffset: 0x134c,
    sourceName: 'sounds\\ChooseElement__Stream',
    sourceSha256: '04c30a7b387bb5173bebe181a4e3540004c9be09e782b897ac6c67bf14dca406',
  },
  'start-cast': {
    registryOffset: 0x141c,
    sourceName: 'sounds\\StartCast__Stream',
    sourceSha256: 'bccf1c352893ee24d515b09df4fd0d44c733dc3bdab71fe2bf0710bdc14d93a8',
  },
} as const satisfies Readonly<Record<GameStreamCue, NativeSoundEntry>>

export const GAME_SCENE_MUSIC = {
  create: { cue: 'selection', transitionTicks: 100 },
  hub: { cue: 'academy', transitionTicks: 2 },
  title: { cue: 'solomondarktheme', transitionTicks: 100 },
} as const satisfies Readonly<Record<GameAudioScene, {
  cue: GameMusicCue
  transitionTicks: number
}>>

export type CreateWizardElement = 'air' | 'earth' | 'ether' | 'fire' | 'water'

export type CreateAudioEvent =
  | { action: 'pause-stream'; cue: GameStreamCue }
  | { action: 'play-sound'; cue: GameSoundCue }
  | { action: 'play-stream'; cue: GameStreamCue }

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
