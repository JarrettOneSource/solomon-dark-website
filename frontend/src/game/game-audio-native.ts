import {
  HUB_TEACHER_CAST_SECONDS,
  HUB_TEACHER_CYCLE_SECONDS,
} from './hub-teacher.ts'
import type {
  BoneyardSolomonVoiceCue,
  BoneyardSolomonVoiceEvent,
} from './core-kernels/boneyard-encounter.ts'
import type { BoneyardEnemyEventSnapshot } from './protocol/game-state.ts'

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
  | 'banshee-die'
  | 'bone-crack'
  | 'click'
  | 'coffin-break'
  | 'demon-die'
  | 'fireball-hit'
  | 'firey-death'
  | 'flash'
  | 'fizzle'
  | 'hit-shield'
  | 'ice-start'
  | 'imp-split'
  | 'level-up'
  | 'lightning-start'
  | 'magic-missile'
  | 'magic-missile-hit'
  | 'maggot-squeak-1'
  | 'maggot-squeak-2'
  | 'maggot-squish-1'
  | 'maggot-squish-2'
  | 'maggot-squish-3'
  | 'open-panel'
  | 'pick-skill'
  | 'pop-shield'
  | 'rock-hit'
  | 'skeleton-die'
  | 'start-boulder'
  | 'step-1'
  | 'step-2'
  | 'summon'
  | 'throw-fire'
  | 'unlock-skill'
  | 'zombie-die'
  | 'zombie-die-groan'
  | 'zombie-ouch'
  | 'zombie-poison-splat'
export type CreateStreamCue = 'catch-it' | 'choose-element' | 'start-cast'
export type GameStreamCue = CreateStreamCue | BoneyardSolomonVoiceCue | 'death-guitar'
export type GameLoopCue =
  | 'gather-rocks-loop'
  | 'ice-loop'
  | 'lightning-loop'
  | 'rolling-stone-loop'

export interface GameAudioSources {
  loops: Readonly<Record<GameLoopCue, string>>
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

interface NativeVoiceEntry {
  durationTicks: number
  sourceName: string
  sourceSha256: string
}

export const NATIVE_MUSIC_MANIFEST = {
  academy: { musicTxtOrder: 101, moduleSubsong: 6, sourceName: 'academy' },
  prelude: { musicTxtOrder: 0, moduleSubsong: 0, sourceName: 'prelude' },
  selection: { musicTxtOrder: 116, moduleSubsong: 7, sourceName: 'selection' },
  solomondarktheme: {
    musicTxtOrder: 95,
    moduleSubsong: 5,
    sourceName: 'solomondarktheme',
  },
} as const satisfies Readonly<Partial<Record<GameMusicCue, NativeMusicEntry>>>

export const NATIVE_SOUND_MANIFEST = {
  'banshee-die': {
    registryOffset: 0x178,
    sourceName: 'sounds\\bansheedie',
    sourceSha256: 'e6419e4437ee457dffdf1b2d5e488971f60cdf98e737b1a4443a8333f8a0a80d',
  },
  'bone-crack': {
    registryOffset: 0x228,
    sourceName: 'sounds\\bonecrack',
    sourceSha256: '9b42d96a3d505cc1d631d43b6fde4b7fb9670ed2fa758a7692207f2c514047c4',
  },
  click: {
    registryOffset: 0x18,
    sourceName: 'sounds\\click',
    sourceSha256: '8aeebcfeb69625bee2ee78fe9c63939e6b40edcc89d5facf2c0d35e1b5920307',
  },
  'coffin-break': {
    registryOffset: 0x2ac,
    sourceName: 'sounds\\coffinbreak',
    sourceSha256: '5b1e1bceae4338878309256cfa083a8621efb26250fd72325d635f719b547dca',
  },
  'demon-die': {
    registryOffset: 0x388,
    sourceName: 'sounds\\demondies',
    sourceSha256: 'b22c5da10273648ef2f56d3375aaf667e8da408f134f2c2f5cd1a6a29617efa4',
  },
  'fireball-hit': {
    registryOffset: 0x540,
    sourceName: 'sounds\\fireballhit',
    sourceSha256: '9bfad709cfb932b7e836c58f781a42ee78907a0211bac5d14a2583d721192738',
  },
  'firey-death': {
    registryOffset: 0x56c,
    sourceName: 'sounds\\fireydeath',
    sourceSha256: '171da05d45168042f6042e58279be0b7255161c65d0d1d58caeb4d4d6b2ccc2e',
  },
  flash: {
    registryOffset: 0x5f0,
    sourceName: 'sounds\\flash',
    sourceSha256: 'dfbee90531011a439650ee0bbf30a3c5ea9469ccd97a9979c05ba73f3db9c05c',
  },
  fizzle: {
    registryOffset: 0x598,
    sourceName: 'sounds\\fizzle',
    sourceSha256: '938420950d859ebc00a9b1a37e548c7c2183a8504689b32aab3de3c683899e76',
  },
  'hit-shield': {
    registryOffset: 0x750,
    sourceName: 'sounds\\hitshield',
    sourceSha256: 'ad5a4870955e5393c17a03c847af274f7a054b62a4c712582206623d1d92ad3f',
  },
  'ice-start': {
    registryOffset: 0x7a8,
    sourceName: 'sounds\\icestart',
    sourceSha256: '28cfda1e9d59f39dfacfd808cdb267465592ae5ce0d34a9aa4495a3f659b9694',
  },
  'imp-split': {
    registryOffset: 0x82c,
    sourceName: 'sounds\\ImpSplit',
    sourceSha256: 'd5b3bca86d9d981701a8dba3e17e07e7ad50aa3ed183817813b048997b5103b0',
  },
  'level-up': {
    registryOffset: 0x908,
    sourceName: 'sounds\\levelup',
    sourceSha256: 'ca01cafec3167ee5bb37f0cb6605196d38bca45c7b755d5fa11781d3e4a5ea92',
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
  'magic-missile-hit': {
    registryOffset: 0xa10,
    sourceName: 'sounds\\magicmissilehit',
    sourceSha256: '2ac1154c78ee7b9cf5b7b0477113293ff8f16aa743269ad3648ed603e1aaf608',
  },
  'maggot-squeak-1': {
    registryOffset: 0x2124,
    sourceName: 'sounds\\MaggotSqueak\\squeak1',
    sourceSha256: 'cefed419346a320ada92f4fb1332ebf2fce6a0265ed520efd11a98b04751216d',
  },
  'maggot-squeak-2': {
    registryOffset: 0x2150,
    sourceName: 'sounds\\MaggotSqueak\\squeak2',
    sourceSha256: '8ca249e20ee5f96ccfa49c9dff37ba5c2040f342aa553170e283c9ee89b5fd3a',
  },
  'maggot-squish-1': {
    registryOffset: 0x2334,
    sourceName: 'sounds\\Squish\\squish',
    sourceSha256: '9b4b14b927596642b71a83d02be58459b6e06c78c9a4b5cb659104d86c2fa482',
  },
  'maggot-squish-2': {
    registryOffset: 0x2360,
    sourceName: 'sounds\\Squish\\SQUISH2',
    sourceSha256: '48286066eefe73a5d1d3468e9d9fbc668d646ce691335b0115d8a05e4c3a85e2',
  },
  'maggot-squish-3': {
    registryOffset: 0x238c,
    sourceName: 'sounds\\Squish\\Squish3',
    sourceSha256: '1e8a7b2bde79e7ed6fe9267c489f9ac085966a56dfd5b2ad072f16ed39c10516',
  },
  'open-panel': {
    registryOffset: 0xb18,
    sourceName: 'sounds\\openpanel',
    sourceSha256: '637a76288c852d813921c7789b211f573f88c56d6036e2e1f3e1cf558f0ae743',
  },
  'pick-skill': {
    registryOffset: 0x44,
    sourceName: 'sounds\\pickskill',
    sourceSha256: '494d1b973bd3f319199199ec9cf851491caee10c3d72dbe61acda69d28daabe4',
  },
  'pop-shield': {
    registryOffset: 0xcd0,
    sourceName: 'sounds\\popshield',
    sourceSha256: 'b4d6bf4d9a68f11bab92def6e823a53f6b8534c49b96e80bbf25d99972af2503',
  },
  'rock-hit': {
    registryOffset: 0xd54,
    sourceName: 'sounds\\rockhit',
    sourceSha256: '865484cf3d7c2e199fb46f069973c43893122e934f0f46ba33d30eeeac4de25b',
  },
  'skeleton-die': {
    registryOffset: 0xdac,
    sourceName: 'sounds\\skeleton_die',
    sourceSha256: 'ab38f903e828bd695ffd153dfacea5701f36376ad24cb96be96d3d059f52fb18',
  },
  'start-boulder': {
    registryOffset: 0xf0c,
    sourceName: 'sounds\\startboulder',
    sourceSha256: 'c7bbd54f293ae2b8a9dbde4d8a6810a5f98f46ee6fb20912b378631a5033d503',
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
  'unlock-skill': {
    registryOffset: 0x11a0,
    sourceName: 'sounds\\unlockskill',
    sourceSha256: '2013053abdd8a969f7c63b2c735cedb5a571fc999bf1474543cd608cee74ffaa',
  },
  'zombie-die': {
    registryOffset: 0x1224,
    sourceName: 'sounds\\zombiedie',
    sourceSha256: '983aaff23ce36bdab7ec0d97f5fa783d6b25b109e5c2a2d7ab88c7cd960760a3',
  },
  'zombie-die-groan': {
    registryOffset: 0x1300,
    sourceName: 'sounds\\zombie_die_groan',
    sourceSha256: 'd2e664024a50f1153f2874e6feaa08799e1113593da49227dd1fffb3254ae2e9',
  },
  'zombie-ouch': {
    registryOffset: 0x127c,
    sourceName: 'sounds\\zombieouch',
    sourceSha256: 'db5400fa0d40ec3507d56d6d29c77ca23dfff4686abe97193b13945da0772d32',
  },
  'zombie-poison-splat': {
    registryOffset: 0x12a8,
    sourceName: 'sounds\\zombiepoisonsplat',
    sourceSha256: 'd2ca2cc1ec6d61b8bb431582ee7335a239b645c105e3a6b42704ace683513da4',
  },
} as const satisfies Readonly<Record<GameSoundCue, NativeSoundEntry>>

export const NATIVE_LEVEL_UP_SOUND_REQUEST = Object.freeze({
  cue: 'level-up' as const,
  playbackRate: 1,
})

export interface NativeEnemyEventSoundRequest {
  cue: GameSoundCue
  playbackRate: number
  sourcePosition: Readonly<{ x: number; y: number }>
  volume: number
}

export function nativeEnemyEventSoundRequest(
  event: BoneyardEnemyEventSnapshot,
): NativeEnemyEventSoundRequest | null {
  if (event.type !== 'enemy-damage-sound' && event.type !== 'enemy-death-sound') {
    return null
  }
  return {
    cue: event.sound as GameSoundCue,
    playbackRate: event.pitch!,
    sourcePosition: event.sourcePosition!,
    volume: event.gainScale!,
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

export const NATIVE_LOOP_MANIFEST = {
  'gather-rocks-loop': {
    registryOffset: 0x176c,
    sourceName: 'sounds\\gatherrocksloop__loop',
    sourceSha256: '143cfa6a54d77570d3d929c3c536fe0306a9a1f1f5292cf4c1521481d5895990',
  },
  'ice-loop': {
    registryOffset: 0x182c,
    sourceName: 'sounds\\iceloop__loop',
    sourceSha256: 'fd9aa082bd5bb3b6197528a5f2d6771aac7e2f478d8bdca0abd3d521c70fc89a',
  },
  'lightning-loop': {
    registryOffset: 0x188c,
    sourceName: 'sounds\\lightningloop__loop',
    sourceSha256: '4bdd74a6734206d1212c52d623d0b7fe994bf4beeaa2119d34f3d1fad7d68281',
  },
  'rolling-stone-loop': {
    registryOffset: 0x1acc,
    sourceName: 'sounds\\rollingstoneloop__loop',
    sourceSha256: '66a306a2ebe8443cb017ce8c3737477f196600a82af7472201cc123f70cee706',
  },
} as const satisfies Readonly<Record<GameLoopCue, NativeSoundEntry>>

export const NATIVE_STREAM_MANIFEST = {
  'death-guitar': {
    registryOffset: 118,
    sourceName: 'sounds\\DeathGuitar__Stream',
    sourceSha256: '67423fcd66ff8fba55acfb09f4dedb495754bfb962a90dc7ba1cbc0c28e353e8',
  },
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
} as const satisfies Readonly<Record<CreateStreamCue | 'death-guitar', NativeSoundEntry>>

export const NATIVE_SOLOMON_VOICE_MANIFEST = {
  'solomon-hello-1': {
    durationTicks: 783,
    sourceName: 'voices\\SAY_SOLOMON_HELLO1.wav',
    sourceSha256: 'dd460115df4f6880d7e067fc1c8c93492413f103ea9b94855f11e955293a564d',
  },
  'solomon-hello-2': {
    durationTicks: 570,
    sourceName: 'voices\\SAY_SOLOMON_HELLO2.wav',
    sourceSha256: '2e4702214f3aad252eb46e9000a8ef6bdec1dd95964d312cfbc1168a59a4bd94',
  },
  'solomon-hello-3': {
    durationTicks: 554,
    sourceName: 'voices\\SAY_SOLOMON_HELLO3.wav',
    sourceSha256: '07693b871183c7d7d14fb4472aaa2ede983ebe5447bbcf031aee93649f909df2',
  },
  'solomon-hello-4': {
    durationTicks: 735,
    sourceName: 'voices\\SAY_SOLOMON_HELLO4.wav',
    sourceSha256: 'a2748ccc9fbe13c2ae80e238ea8dd5a170b1dd7e2b2c7fa050a0073470ce52a2',
  },
  'solomon-laugh-1': {
    durationTicks: 247,
    sourceName: 'voices\\SAY_SOLOMON_LAUGH1.wav',
    sourceSha256: '26463c3f557378c5409fe8b37c49c9f5585dee26ffc16face1db0770a08d5716',
  },
  'solomon-get-him-boys': {
    durationTicks: 245,
    sourceName: 'voices\\SAY_GETHIMBOYS.wav',
    sourceSha256: 'c26e56af5c5036bdfdda8dee9c5ba8270a75156b45c0afe9f00c83b850b34541',
  },
} as const satisfies Readonly<Record<BoneyardSolomonVoiceCue, NativeVoiceEntry>>

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
