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
  | 'nuke'
  | 'phase'
  | 'pop-shield'
  | 'pickup-bag'
  | 'pickup-coin'
  | 'rock-hit'
  | 'ring-of-ice'
  | 'skeleton-die'
  | 'shock-1'
  | 'shock-2'
  | 'shock-3'
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

export const NATIVE_MUSIC_MODULE_SHA256 = '32bf92cc3191e136b6d186d77d75de48ad28f4bd58acae0c278204455fa57c82'

interface NativeMusicEntry {
  musicTxtOrder: number
  moduleSubsong: number
  sourceName: string
}

interface NativeSoundEntry {
  registryOffset: number | null
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
  combat: { musicTxtOrder: 5, moduleSubsong: 1, sourceName: 'combat' },
  prelude: { musicTxtOrder: 0, moduleSubsong: 0, sourceName: 'prelude' },
  selection: { musicTxtOrder: 116, moduleSubsong: 7, sourceName: 'selection' },
  solomondarktheme: {
    musicTxtOrder: 95,
    moduleSubsong: 5,
    sourceName: 'solomondarktheme',
  },
} as const satisfies Readonly<Partial<Record<GameMusicCue, NativeMusicEntry>>>

export const NATIVE_SOUND_MANIFEST = {
  'backpack-close': {
    registryOffset: 0xc8,
    sourceName: 'sounds\\backpack_close',
    sourceSha256: '32fa4ca58d0fe1eb967bb50f20dffc0edb98b25ca74c719edc2b70b9e4312319',
  },
  'bad-action': {
    registryOffset: 0x120,
    sourceName: 'sounds\\badaction',
    sourceSha256: '0ca71924473e6a45156f0dbd450ff7a158d39015179697c83c7b04824e3256d6',
  },
  'acid-sizzle': {
    registryOffset: 0x9c,
    sourceName: 'sounds\\acidsizzle',
    sourceSha256: '14b50ede8d3b280d65877a0c5d51a331e0da5c6b0d70da20c9345584c7453341',
  },
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
  'big-fire': {
    registryOffset: 0x1a4,
    sourceName: 'sounds\\bigfire',
    sourceSha256: 'd70d4a94b490b7ea7f72d26a06edb50e7906a6a5ca095e1e80744fd17bf17868',
  },
  'bite-1': {
    registryOffset: 0x1d30,
    sourceName: 'sounds\\Bite\\bite1',
    sourceSha256: '8f2f7fb4e8275e42785e912bd9b5cdcaa41e517e2335912d3bf3bb026bd789e1',
  },
  'bite-2': {
    registryOffset: 0x1d5c,
    sourceName: 'sounds\\Bite\\bite2',
    sourceSha256: 'fb2b04c05ee084245826233934c752e39e9ba45572b946e887fb9850a674d32f',
  },
  'bite-3': {
    registryOffset: 0x1d88,
    sourceName: 'sounds\\Bite\\bite3',
    sourceSha256: '6b4f1c15073cde2958b448adea63ff55d1ca35627bc86b46d4da82709ca31657',
  },
  click: {
    registryOffset: 0x18,
    sourceName: 'sounds\\click',
    sourceSha256: '8aeebcfeb69625bee2ee78fe9c63939e6b40edcc89d5facf2c0d35e1b5920307',
  },
  concentrate: {
    registryOffset: 0x304,
    sourceName: 'sounds\\concentrate',
    sourceSha256: 'ca8b10ff2ce00ca913a382c05f3e1c0c600a22d2e206e386e52a4e83d704a47c',
  },
  'coffin-break': {
    registryOffset: 0x2ac,
    sourceName: 'sounds\\coffinbreak',
    sourceSha256: '5b1e1bceae4338878309256cfa083a8621efb26250fd72325d635f719b547dca',
  },
  'critical-hit': {
    registryOffset: 0x330,
    sourceName: 'sounds\\CriticalHit',
    sourceSha256: 'ccf8ffc6bea19fd51c18a51d04cc9ef2d6d727213573fd47859a23325677b03b',
  },
  'comet-whistle': {
    registryOffset: 0x2d8,
    sourceName: 'sounds\\cometwhistle',
    sourceSha256: 'd0ca5910d9dbe434937c1d11ddfe1957fd287a13b81b7ee27f63fb969a3d4cb6',
  },
  'demon-die': {
    registryOffset: 0x388,
    sourceName: 'sounds\\demondies',
    sourceSha256: 'b22c5da10273648ef2f56d3375aaf667e8da408f134f2c2f5cd1a6a29617efa4',
  },
  'disable-enemy': {
    registryOffset: 0x3b4,
    sourceName: 'sounds\\DisableEnemy',
    sourceSha256: 'e7e0dfed0c7e10745a545ef18ac872094d35b16535bc249b6022e8964ed186f4',
  },
  drink: {
    registryOffset: 0x438,
    sourceName: 'sounds\\drink',
    sourceSha256: '61fdcc02a31b1c1c43264cb6ed8d02717e9dba2c5123167ad6e309053e28f322',
  },
  'distort-reality': {
    registryOffset: 0x40c,
    sourceName: 'sounds\\distortreality',
    sourceSha256: '3fa59accc564838ea1896f95539ee0acecd9345c3e2c1adceaadee0dd870194e',
  },
  'drop-bag-1': {
    registryOffset: 0x1fe4,
    sourceName: 'sounds\\dropbag\\dropbag1',
    sourceSha256: 'c2f0b7f9111d727a9e66b7e47e80aa79ba21dc5bc83781e01be0409755651379',
  },
  'drop-bag-2': {
    registryOffset: 0x2010,
    sourceName: 'sounds\\dropbag\\dropbag2',
    sourceSha256: '1ec0a6ecf46d8d7ca0b92bb4ed62f78ca4582abc5365aa8d17c2916f05c22203',
  },
  'drop-coins': {
    registryOffset: 0x464,
    sourceName: 'sounds\\dropcoins',
    sourceSha256: 'b72d44080d99fdae8e7dce83b5f1b6a553d503a753df2deacea7ee8829ba4376',
  },
  'drop-potion': {
    registryOffset: 0x490,
    sourceName: 'sounds\\droppotion',
    sourceSha256: 'c538d651ff612cfb56b9c618cec60eaa4b96da78ecc81b20950977cade359e45',
  },
  'explode-steam': {
    registryOffset: 0x4bc,
    sourceName: 'sounds\\explodesteam',
    sourceSha256: 'f93fca2917072811b96f4ec4c3c864c66f0bb785f05c6113e1931661471df090',
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
  'flame-lash-start': {
    registryOffset: 0x5c4,
    sourceName: 'sounds\\flamelashstart',
    sourceSha256: 'd563633ce5ed2701050884b11806898da500581858238d45fb881e820db0a1dc',
  },
  flash: {
    registryOffset: 0x5f0,
    sourceName: 'sounds\\flash',
    sourceSha256: 'dfbee90531011a439650ee0bbf30a3c5ea9469ccd97a9979c05ba73f3db9c05c',
  },
  'flash-spell': {
    registryOffset: 0x61c,
    sourceName: 'sounds\\flashspell',
    sourceSha256: 'fda25c45eab0290011b1f3ba859757578586b30c3e7f1c905077f801af0ee5be',
  },
  'frost-missile': {
    registryOffset: 0x6a0,
    sourceName: 'sounds\\frostmissile',
    sourceSha256: 'c1d3a682766c53071dc95717d267955128c7be472dc1329da0f5d12700c13d9b',
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
  'goto-orb': {
    registryOffset: 0x70,
    sourceName: 'sounds\\gotorb',
    sourceSha256: 'e971ea0fcc9fee14e93936b83768862ff24cc61106e741c66e48f709b9c5893a',
  },
  'hail-bounce-0': {
    registryOffset: 0x1f14,
    sourceName: 'sounds\\hail\\hail3',
    sourceSha256: '8ea84a40e9193020b3f20d64c6a8c3cf262f641c21c5076d37a6eee24d54ca9f',
  },
  'hail-bounce-1': {
    registryOffset: 0x1f40,
    sourceName: 'sounds\\hail\\hail4',
    sourceSha256: '299c21af5030e1b4cf1770f85875fc0afa85ec74a9a0c24d9166d176ce2df4e9',
  },
  'hail-bounce-2': {
    registryOffset: 0x1f6c,
    sourceName: 'sounds\\hail\\ice1',
    sourceSha256: 'b7f5133bdc6969de1e62bec2c5d10e7655f350fbf40de6fcc991d058a81e2a24',
  },
  'hail-bounce-3': {
    registryOffset: 0x1f98,
    sourceName: 'sounds\\hail\\ice2',
    sourceSha256: 'aef26122ad82c8663ab579bd25a3a37f16120d5dda7ac98590ffdc85c24f1a50',
  },
  'hail-shot': {
    registryOffset: 0x6f8,
    sourceName: 'sounds\\hailshot',
    sourceSha256: '3190570e01141d2036b0aabc7fae77e70204ceaa7119e26e811f2a45a954b6a2',
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
  'imp-vocal-1': {
    registryOffset: 0x1fc4,
    sourceName: 'sounds\\imp\\imp1',
    sourceSha256: '309a72706858886e6b9f0111d1ac354b9310cede4c25d559b7f6401850471d26',
  },
  'imp-vocal-2': {
    registryOffset: 0x1ff0,
    sourceName: 'sounds\\imp\\imp2',
    sourceSha256: '3e8ba5c8ca15a08213dca2eda7f4e8b272220adb7aa615b3a4391fd7c02b463b',
  },
  'imp-vocal-3': {
    registryOffset: 0x201c,
    sourceName: 'sounds\\imp\\imp3',
    sourceSha256: '5a26b6440b4e3d4446dbe2726f9cd8c034d56146b573d1b5b64ac7482d381b85',
  },
  'imp-vocal-4': {
    registryOffset: 0x2048,
    sourceName: 'sounds\\imp\\imp4',
    sourceSha256: '877e7cb891256837bc1359851be5bb975931f2a4171642d81a0648b789cf4fe3',
  },
  'imp-vocal-5': {
    registryOffset: 0x2074,
    sourceName: 'sounds\\imp\\imp5',
    sourceSha256: '2bcdc7927c3769adcd64f78472f4891a61d85c3718d47c4db86a2fbf08f6068d',
  },
  'imp-vocal-6': {
    registryOffset: 0x20a0,
    sourceName: 'sounds\\imp\\imp6',
    sourceSha256: '31e9dac6699ccc1c25e93d401af690d7451d100c1b7e23ee1386e8795d3a9f56',
  },
  'imp-vocal-7': {
    registryOffset: 0x20cc,
    sourceName: 'sounds\\imp\\imp7',
    sourceSha256: 'bc4de125342eeb704d90d8ef55fb4cd0cd3686f074d5851b14e6fb3da5bd4a41',
  },
  'imp-vocal-8': {
    registryOffset: 0x20f8,
    sourceName: 'sounds\\imp\\imp8',
    sourceSha256: 'f2e0ad120a67c89dcf19fd9387a098d92fe58f653953891815dec61c6e9bc495',
  },
  ignite: {
    registryOffset: 0x800,
    sourceName: 'sounds\\ignite',
    sourceSha256: '0c0a6f6055b0746e8f1921d04214e47a359ee36b6ea88301f73047f7f45e935f',
  },
  'knockback-golem': {
    registryOffset: 0x8dc,
    sourceName: 'sounds\\KnockbackGolem',
    sourceSha256: '2452f75de45f6e6c30d7bc9993ba6f86e638ef0b2a101daca38814e65946e090',
  },
  knockback: {
    registryOffset: 0x8b0,
    sourceName: 'sounds\\Knockback',
    sourceSha256: '16fee24874ab67546e35b8a08469760088c3da387e4ae8f7243a0a31263cc4dd',
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
  'magic-circle': {
    registryOffset: 0x9b8,
    sourceName: 'sounds\\magiccircle',
    sourceSha256: '18e8efdd324e9c3f96aca245d109d50796418ada18685c8e391c5f122921e4c3',
  },
  'magic-shield-explode': {
    registryOffset: 0xa3c,
    sourceName: 'sounds\\magicshieldexplode',
    sourceSha256: '5a3abd93fc1d490b0f9988f1acebc948c5fed9669f070012c97c778010854b8a',
  },
  'magic-shield-up': {
    registryOffset: 0xa68,
    sourceName: 'sounds\\magicshieldup',
    sourceSha256: '74305127ff81aaf41abe9001d8498f7c14b46fed099d7b28c49bad4bc23f06cc',
  },
  'magic-storm': {
    registryOffset: 0xa94,
    sourceName: 'sounds\\magicstorm',
    sourceSha256: '87a2987ef6a67c21a8c57e8c5f17d88b78e6071b97cf34c6fd9a12ff613ebdcb',
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
  nuke: {
    registryOffset: 0xaec,
    sourceName: 'sounds\\nuke',
    sourceSha256: 'a8ab88bb44f30289f7b473bc9f153b4cfc03b1985e77b7b29a7ec0761f8b2cfb',
  },
  phase: {
    registryOffset: 0xb9c,
    sourceName: 'sounds\\phase',
    sourceSha256: 'cbd9572e6910191bab3b856120e39c67573efd708514b3443eac27bc0c6f48d3',
  },
  'pop-shield': {
    registryOffset: 0xcd0,
    sourceName: 'sounds\\popshield',
    sourceSha256: 'b4d6bf4d9a68f11bab92def6e823a53f6b8534c49b96e80bbf25d99972af2503',
  },
  'pickup-bag': {
    registryOffset: 0xbc8,
    sourceName: 'sounds\\pickupbag',
    sourceSha256: '8b299623b5b51dc6b56dfb1acc3821664d8857a02a70179f6ba3330182443902',
  },
  'pickup-coin': {
    registryOffset: 0xbf4,
    sourceName: 'sounds\\pickupcoin',
    sourceSha256: '04a1ea7b62cdaf0fd55cf237911594d75d79c0cf5cdf7962078f2949b9f4da34',
  },
  'rock-hit': {
    registryOffset: 0xd54,
    sourceName: 'sounds\\rockhit',
    sourceSha256: '865484cf3d7c2e199fb46f069973c43893122e934f0f46ba33d30eeeac4de25b',
  },
  'shovel-1': {
    registryOffset: 0x22dc,
    sourceName: 'sounds\\shovel\\shovel1',
    sourceSha256: 'be06d2e6eaacf2e0b35aaf14293e41420a0efd5ae364894cda193398838ebce6',
  },
  'shovel-2': {
    registryOffset: 0x2308,
    sourceName: 'sounds\\shovel\\shovel2',
    sourceSha256: '4697492d7f5e07a78613b60c44122c7e3193d17d898eccf8ffe62f229d4c0fdd',
  },
  'ring-of-ice': {
    registryOffset: 0xd28,
    sourceName: 'sounds\\ringofice',
    sourceSha256: 'b6442d06818350c43d135684916f05216ed90dccf2b27f2a5667c2c31482013b',
  },
  'skeleton-die': {
    registryOffset: 0xdac,
    sourceName: 'sounds\\skeleton_die',
    sourceSha256: 'ab38f903e828bd695ffd153dfacea5701f36376ad24cb96be96d3d059f52fb18',
  },
  'shock-1': {
    registryOffset: 0x21d4,
    sourceName: 'sounds\\Shock\\s1',
    sourceSha256: '25994dac57db5b28d0e17c9880f6769fb941ebabfd3c91211baf5a616604859c',
  },
  'shock-2': {
    registryOffset: 0x2200,
    sourceName: 'sounds\\Shock\\s2',
    sourceSha256: '69ce707d2d3baabf1543a0a2ec4a606840dc9568779f06e91c3b6c75b3b9cf05',
  },
  'shock-3': {
    registryOffset: 0x222c,
    sourceName: 'sounds\\Shock\\s3',
    sourceSha256: '5ca5ce12ad76cd77f0ab856928a4048c8b466b3637783f16b6947e42b46b46d4',
  },
  'spin-attack': {
    registryOffset: 0xe5c,
    sourceName: 'sounds\\spinattack',
    sourceSha256: 'dbe81e2ce3a19074efa975be444072614995216b9f880c14b287ab552bcbff4f',
  },
  'staff-swoosh': {
    registryOffset: 0xee0,
    sourceName: 'sounds\\staffswoosh',
    sourceSha256: '04da914c919485d68cd49752a0726649cc5395bb47febcfcabee4765d71f2809',
  },
  'staff-hit-wood': {
    registryOffset: 0xeb4,
    sourceName: 'sounds\\staffhitwood',
    sourceSha256: '0e682ef1ba77ba08cd3b52c5a98eefe0fcb31797275a07fdce6a03abfa484b50',
  },
  'start-boulder': {
    registryOffset: 0xf0c,
    sourceName: 'sounds\\startboulder',
    sourceSha256: 'c7bbd54f293ae2b8a9dbde4d8a6810a5f98f46ee6fb20912b378631a5033d503',
  },
  'stone-break': {
    registryOffset: 0xf64,
    sourceName: 'sounds\\stonebreak',
    sourceSha256: '1bb6ea8c298424eddedad619ec713b23f8187986a8ecdc28173a0b17d2070abc',
  },
  stoneskin: {
    registryOffset: 0xf90,
    sourceName: 'sounds\\stoneskin',
    sourceSha256: '7d3337d2d05ddfb63f0129406c6f1867de0262535b055b9aa69d633dbd261635',
  },
  'stone-step': {
    registryOffset: 0xfe8,
    sourceName: 'sounds\\stonestep',
    sourceSha256: 'd02824968e070e0efdeb3c350afd004ff9252dd6da806aebf9c6b3da5d01c5f5',
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
  swipe: {
    registryOffset: 0x1040,
    sourceName: 'sounds\\swipe',
    sourceSha256: 'a7ceda1c35fc9896f10ef808c626267eb3b58d958323fef76f47e2bff7716198',
  },
  teleport: {
    registryOffset: 0x106c,
    sourceName: 'sounds\\teleport',
    sourceSha256: 'a91651f4369aa2147729d043e0b29b758ec1481877b931bb800fe1828ca329a2',
  },
  'throw-fire': {
    registryOffset: 0x10c4,
    sourceName: 'sounds\\throwfire',
    sourceSha256: 'b6e14b90d00e27a9b2ceba404ea1c113a7d7bf5f14aa69987ec9629669b53de0',
  },
  'throw-lightning-1': {
    registryOffset: 0x2570,
    sourceName: 'sounds\\throwlightning\\1',
    sourceSha256: '282f45f33c27522c442248b7f12641492499dedca709341d2e5503863ba15625',
  },
  'throw-lightning-2': {
    registryOffset: 0x259c,
    sourceName: 'sounds\\throwlightning\\2',
    sourceSha256: 'a412108b979fb5b6a744ae5a3618c5ef699ad916cd2927f5b95bbf5788e80f17',
  },
  'throw-dirt-1': {
    registryOffset: 0x2518,
    sourceName: 'sounds\\throwdirt\\throwdirt1',
    sourceSha256: 'de233771aae5e806e4bdba0553729d1744605f512243fd30733e2e0dbd00a1ef',
  },
  'throw-dirt-2': {
    registryOffset: 0x2544,
    sourceName: 'sounds\\throwdirt\\throwdirt2',
    sourceSha256: 'e527b1df105d2a2fabc65aa576d76fcf7379d3bf0d9f6a51fabb81011ffc947f',
  },
  'unlock-skill': {
    registryOffset: 0x11a0,
    sourceName: 'sounds\\unlockskill',
    sourceSha256: '2013053abdd8a969f7c63b2c735cedb5a571fc999bf1474543cd608cee74ffaa',
  },
  unforge: {
    registryOffset: 0x1148,
    sourceName: 'sounds\\unforge',
    sourceSha256: '173db629737f50f3a958358dc9f88fb3b25528ee93298f2f95416517747fa9e2',
  },
  'wizard-ouch-1': {
    registryOffset: 0x2620,
    sourceName: 'sounds\\Wizard_Ouch\\SAY_OUCH1',
    sourceSha256: '3e851ee873c9798923624d2b117c6fc91d656f66d7961a00935cfb182393b638',
  },
  'wizard-ouch-2': {
    registryOffset: 0x264c,
    sourceName: 'sounds\\Wizard_Ouch\\SAY_OUCH2',
    sourceSha256: '509ce875de5322ebc4ee883cf2f1db9ba172b1cf22a6a6da6e31a0e2c91d12b7',
  },
  'wizard-ouch-3': {
    registryOffset: 0x2678,
    sourceName: 'sounds\\Wizard_Ouch\\SAY_OUCH3',
    sourceSha256: '26cd8bea5d55a47b6476f130481bad26887f7af1cf12ec43b2989e495323e5ea',
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
  ) {
    return null
  }
  return {
    cue: event.sound as GameSoundCue,
    playbackRate: event.pitch!,
    sourcePosition: event.sourcePosition!,
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

export const NATIVE_LOOP_MANIFEST = {
  'comet-loop': {
    registryOffset: 0x14cc,
    sourceName: 'sounds\\comet__loop',
    sourceSha256: 'b8c4c69e2220778492eb25118a6c4a72169f5db3ee9e14e56210e8aba6d8fc80',
  },
  'electric-loop': {
    registryOffset: 0x164c,
    sourceName: 'sounds\\electric__loop',
    sourceSha256: '809601e64da07ac0adfffec5f5e29dfc61ee79725fdbf85ceb501d80d6cb0db4',
  },
  'earthquake-loop': {
    registryOffset: 0x158c,
    sourceName: 'sounds\\earthquake__loop',
    sourceSha256: 'ac56c68d267f5d9c7431b8cadd5b6bd4e73ae6101e144ff9769d2aac1a529068',
  },
  'fire-loop': {
    registryOffset: 0x16ac,
    sourceName: 'sounds\\fire__loop',
    sourceSha256: 'afb0963aa7b68590aa2faea31e86e2e080c524513d32f3c23ebe9e7dc001e00b',
  },
  'flyblown-loop': {
    registryOffset: 0x170c,
    sourceName: 'sounds\\flyblown__loop',
    sourceSha256: 'e4dd23bbe5a2d36762ec54587dacb7cd5465dba64268b0b4b1db198b953422d6',
  },
  'gather-rocks-loop': {
    registryOffset: 0x176c,
    sourceName: 'sounds\\gatherrocksloop__loop',
    sourceSha256: '143cfa6a54d77570d3d929c3c536fe0306a9a1f1f5292cf4c1521481d5895990',
  },
  'ice-beam-loop': {
    registryOffset: 0x17cc,
    sourceName: 'sounds\\icebeam__loop',
    sourceSha256: '7bb84b1df2a8cc54f0c6cc3bef5ab6f5dec6b2ce2151cd853cd4e42afd595bc6',
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
  'low-fire-loop': {
    registryOffset: 0x18ec,
    sourceName: 'sounds\\lowfire__loop',
    sourceSha256: '8d42e14b1848f1f2b45fabb52c1f83620a986557416f59ee08f78e630439ce8a',
  },
  'maggots-loop': {
    registryOffset: 0x194c,
    sourceName: 'sounds\\maggots__loop',
    sourceSha256: '725332465d0f7d85bd84043ae4a691f0827b227c3ee2aa9fd3226d72bece40db',
  },
  'meteor-loop': {
    registryOffset: 0x19ac,
    sourceName: 'sounds\\meteor__loop',
    sourceSha256: '0161a346a636790b0e5e2ca105c2f6d6ac9d22359742ae1f8469634393e39bcd',
  },
  'plane-cross-loop': {
    registryOffset: 0x1a0c,
    sourceName: 'sounds\\PlaneCross__Loop',
    sourceSha256: '04d3bc7b433ef47b758933456e9feecb83924fa9b0ec31e0aeedb0946cd14a24',
  },
  'polisher-wipe': {
    registryOffset: null,
    sourceName: 'dynamic_sounds\\wipeglass.wav',
    sourceSha256: 'ad5043df28f0ee18e881ffe709fc819218533b080d6d1ec4093603d8447e4d57',
  },
  'rainfall-loop': {
    registryOffset: 0x1a6c,
    sourceName: 'sounds\\rainfall__loop',
    sourceSha256: 'a27e5ea5d44bb5daf6b80dee6f0f5c9123a5bddfc198340c633b8791c4733a79',
  },
  'rolling-stone-loop': {
    registryOffset: 0x1acc,
    sourceName: 'sounds\\rollingstoneloop__loop',
    sourceSha256: '66a306a2ebe8443cb017ce8c3737477f196600a82af7472201cc123f70cee706',
  },
  'soul-loop': {
    registryOffset: 0x1b8c,
    sourceName: 'sounds\\Soul__Loop',
    sourceSha256: '661515f9ac51cfb7be5aaa08d7d87667f5b06b6a1e7a530e1a8863b1c46450b4',
  },
  'steady-wind-loop': {
    registryOffset: 0x1bec,
    sourceName: 'sounds\\steadywind__loop',
    sourceSha256: '2c87905f66fa7b02ab18c6b9e5d875ed2c9258ce37c961ba858c17d031141487',
  },
  'steam-loop': {
    registryOffset: 0x1c4c,
    sourceName: 'sounds\\steam__loop',
    sourceSha256: 'd817fd149e8b87fa6b7a87bf3b05255749c2d3955469cbe00a0af32d61b5a649',
  },
} as const satisfies Readonly<Record<GameLoopCue, NativeSoundEntry>>

export const NATIVE_STREAM_MANIFEST = {
  dye: {
    registryOffset: 0x1374,
    sourceName: 'sounds\\dye__Stream',
    sourceSha256: '113708c96aafc98bae7c0d449d9d9d639e9f5290c0109d7bab0b4c781af2976e',
  },
  dampen: {
    registryOffset: 0x135c,
    sourceName: 'sounds\\dampen__stream',
    sourceSha256: 'afc7ef6fa91604257c17abf6276190343c7a556709426c9c9ba4f7e165c106b1',
  },
  'golem-die': {
    registryOffset: 0x139c,
    sourceName: 'sounds\\GolemDie__Stream',
    sourceSha256: 'cee482491c4aa21672bf7bbd4c314ab185a5e15f9daadfaa5351d0e3ca8fea56',
  },
  'golem-provoke': {
    registryOffset: 0x13a4,
    sourceName: 'sounds\\GolemProvoke__Stream',
    sourceSha256: '88394eabae8728019803317c69dc8a7e991bb2ce32863f250a2d0726e7f15228',
  },
  'leviathan-roar': {
    registryOffset: 0x13ac,
    sourceName: 'sounds\\LeviathanRoar__Stream',
    sourceSha256: '67d19694db3f9865e8083365bdb2986dbae4827868f335a7070b5e46e632fcec',
  },
  mindstar: {
    registryOffset: 0x13d4,
    sourceName: 'sounds\\mindstar__stream',
    sourceSha256: '8a4310894e1401f9d47e58ae4f9202aec1e1eb0f6dd34db6987e6e3e753b5de8',
  },
  'pike-break': {
    registryOffset: 0x13e4,
    sourceName: 'sounds\\pikebreak__stream',
    sourceSha256: '7095f48810f60a759aef5f584d5eb52b7a0c82030b27abb1af782a9281441e82',
  },
  'planewalker-off': {
    registryOffset: 0x13ec,
    sourceName: 'sounds\\PlanewalkerOff__Stream',
    sourceSha256: 'f95191b9c552b177d96d7269259350695727636d6287af7bbf93ffc08dc8d322',
  },
  'planewalker-on': {
    registryOffset: 0x13f4,
    sourceName: 'sounds\\planewalker__Stream',
    sourceSha256: '1243f30337c134c4d59f1cf8fbd2eb79fa0ce4a8e6e053866ec82ac0ec7689ea',
  },
  'prismatic-shock': {
    registryOffset: 0x13fc,
    sourceName: 'sounds\\prismaticspray__stream',
    sourceSha256: '3eabc7fb5d4ecb30476dc0dee52305f66e47ae212ca47bdf8d087961a77cdc7d',
  },
  'quake-crack-small': {
    registryOffset: 0x1404,
    sourceName: 'sounds\\QuakeCrackSmall__Stream',
    sourceSha256: 'bc66694a8413cddaf3ca22b05de99ba3d8d59090317e3d89c983a1d3b09ef09f',
  },
  'quake-cracks': {
    registryOffset: 0x140c,
    sourceName: 'sounds\\QuakeCracks__Stream',
    sourceSha256: '86e0ff907b480cde99a14ad4743946214040fca0fb3fe0f26036762f559375c8',
  },
  'set-trap': {
    registryOffset: 0x1414,
    sourceName: 'sounds\\settrap__Stream',
    sourceSha256: '32e4b7ab20002a21895d1e314a8641b01b4c17d3bd76789997acbb0cf43b2ea4',
  },
  'stoneskin-on': {
    registryOffset: 0x1424,
    sourceName: 'sounds\\StoneSkin__Stream',
    sourceSha256: '033f53f0529caac2f5f59f7501a60917e30b1af44035e1ab92a27d0959511d62',
  },
  thunder: {
    registryOffset: 0x142c,
    sourceName: 'sounds\\thunder__Stream',
    sourceSha256: 'c2bc1376ed9a5bc8de7b96f08c16448253a7cfbe35b35a085a282d0a50d12f0a',
  },
  trap: {
    registryOffset: 0x1434,
    sourceName: 'sounds\\trap__stream',
    sourceSha256: 'f575c617afd3da0eb5a65016b9eec178e82da536a9bf410e617dd76dc8c158d8',
  },
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
} as const satisfies Readonly<
  Record<CreateStreamCue | SecondaryStreamCue | 'death-guitar' | 'dye', NativeSoundEntry>
>

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
  'solomon-laugh-big': {
    durationTicks: 483,
    sourceName: 'voices\\SAY_SOLOMON_LAUGHBIG1.wav',
    sourceSha256: '579e3f1ba524644c50cb371ef481bf8960cca34f1eb6fcd694ce350889eee42b',
  },
  'solomon-get-him-boys': {
    durationTicks: 245,
    sourceName: 'voices\\SAY_GETHIMBOYS.wav',
    sourceSha256: 'c26e56af5c5036bdfdda8dee9c5ba8270a75156b45c0afe9f00c83b850b34541',
  },
} as const satisfies Readonly<
  Record<BoneyardSolomonVoiceCue | GameOverSolomonVoiceCue, NativeVoiceEntry>
>

export const NATIVE_COLLEGE_OFFICE_AUDIO_MANIFEST = {
  archIntro: {
    durationTicks: 698,
    sourceName: 'voices\\ARCH_INTRO_0.wav',
    sourceSha256: 'b819a5aa7397df964ec9f9e03149941450d65d10fe207f71c3643419fd071255',
  },
  polisherWipe: {
    sourceName: 'dynamic_sounds\\wipeglass.wav',
    sourceSha256: 'ad5043df28f0ee18e881ffe709fc819218533b080d6d1ec4093603d8447e4d57',
  },
} as const

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
