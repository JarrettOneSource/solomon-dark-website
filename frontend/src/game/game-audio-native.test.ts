import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { NATIVE_SECONDARY_ABILITY_CONTRACTS } from './core-kernels/native-secondary-ability-contract.ts'
import {
  NATIVE_TUTORIAL_CUES,
  NATIVE_TUTORIAL_CUE_DEFINITIONS,
} from './core-kernels/native-tutorial.ts'

import {
  CREATE_DISCIPLINE_FINALIZE_MS,
  GAME_SCENE_MUSIC,
  HUB_AUDIO_ATTENUATION_RADIUS,
  NATIVE_COLLEGE_OFFICE_AUDIO_MANIFEST,
  NATIVE_LEVEL_UP_SOUND_REQUEST,
  NATIVE_MUSIC_MODULE_SHA256,
  NATIVE_LOOP_MANIFEST,
  NATIVE_SOUND_MANIFEST,
  NATIVE_SOLOMON_VOICE_MANIFEST,
  NATIVE_STREAM_MANIFEST,
  createEntryAudioEvents,
  createSelectionAudioEvents,
  hubAudioAttenuation,
  hubTeacherReleasesBetween,
  hubTeacherSummonPitch,
  hubTeacherSummonVolume,
  nativeBoneyardHitPointGain,
  nativeBoneyardPointGain,
  nativeFootstepCue,
  nativeEnemyEventSoundRequest,
  nativeLootEventSoundRequest,
  nativeSolomonDigSoundRequest,
  newSolomonVoiceEvent,
  newNativeFootstepTick,
  solomonDigAudioDelta,
} from './game-audio-native.ts'
import {
  HUB_TEACHER_CAST_SECONDS,
  HUB_TEACHER_CYCLE_SECONDS,
} from './hub-teacher.ts'

test('maps each scene to the recovered module entry and transition clock', () => {
  assert.equal(
    NATIVE_MUSIC_MODULE_SHA256,
    '32bf92cc3191e136b6d186d77d75de48ad28f4bd58acae0c278204455fa57c82',
  )
  assert.deepEqual(GAME_SCENE_MUSIC, {
    boneyard: { cue: 'prelude', transitionTicks: 100 },
    'boneyard-combat': { cue: 'combat', transitionTicks: 100 },
    create: { cue: 'selection', transitionTicks: 100 },
    'game-over': { cue: 'death', transitionTicks: 0 },
    hub: { cue: 'academy', transitionTicks: 2 },
    title: { cue: 'solomondarktheme', transitionTicks: 100 },
  })
})

test('maps the stock Solomon dialogue files and authoritative PCM durations', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(NATIVE_SOLOMON_VOICE_MANIFEST).map(
      ([cue, entry]) => [cue, entry.durationTicks],
    )),
    {
      'solomon-hello-1': 783,
      'solomon-hello-2': 570,
      'solomon-hello-3': 554,
      'solomon-hello-4': 735,
      'solomon-laugh-1': 247,
      'solomon-laugh-big': 483,
      'solomon-get-him-boys': 245,
    },
  )
  assert.equal(
    NATIVE_SOLOMON_VOICE_MANIFEST['solomon-get-him-boys'].sourceName,
    'voices\\SAY_GETHIMBOYS.wav',
  )
})

test('pins every checked-in Solomon voice to its untouched stock WAV', () => {
  const filenames = {
    'solomon-get-him-boys': 'solomon-get-him-boys.wav',
    'solomon-hello-1': 'solomon-hello-1.wav',
    'solomon-hello-2': 'solomon-hello-2.wav',
    'solomon-hello-3': 'solomon-hello-3.wav',
    'solomon-hello-4': 'solomon-hello-4.wav',
    'solomon-laugh-1': 'solomon-laugh-1.wav',
    'solomon-laugh-big': 'solomon-laugh-big.wav',
  } as const
  for (const [cue, filename] of Object.entries(filenames)) {
    const source = readFileSync(new URL(
      `../assets/game/audio/voice/${filename}`,
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_SOLOMON_VOICE_MANIFEST[
        cue as keyof typeof NATIVE_SOLOMON_VOICE_MANIFEST
      ].sourceSha256,
    )
  }
})

test('pins the complete 24-cue Tutorial narration membership to stock PCM', () => {
  const files = {
    'tutorial-accept-your-fate': ['tutorial-accept-your-fate.wav', '609528847afb6161d2e3f178d81f80574eb3a5ebed63b2e8b096539d852b38a9'],
    'tutorial-acid-rain-huh': ['tutorial-acid-rain-huh.wav', '31100158ed53b65be98e7e9dedd6b5637b209e6aa9052fc32eaba187ee272ba4'],
    'tutorial-been-dispatched': ['tutorial-been-dispatched.wav', 'edaa508a9cf3fc6dc79714d0166934a7985964225d611435600500a61d830587'],
    'tutorial-came-prepared': ['tutorial-came-prepared.wav', 'f9704e8fae16a628f5aa163a9bafd0268f321dbfe4098b64b6b4be6ad3954693'],
    'tutorial-careless-fool': ['tutorial-careless-fool.wav', '4baa3d3d999f8395ad68f2b2014ef7e38c278503b7fddc541bd8a1071bfb9682'],
    'tutorial-coward-come-back': ['tutorial-coward-come-back.wav', 'e524548ebad58e35e20cdb87ce3c6c41e58c596807fcb1a799e0630772793605'],
    'tutorial-do-the-dispatching': ['tutorial-do-the-dispatching.wav', '5925f54d7a924941cabdb97204b332a8c634ff980adaccd0c79b26f063902b36'],
    'tutorial-easily-vanquished': ['tutorial-easily-vanquished.wav', '4b7eaede2a8903cdec1c25cc8dcd3e300dad70e21267989bc68b8741eca1c5c7'],
    'tutorial-face-the-wrath': ['tutorial-face-the-wrath.wav', 'c015f7fa573744bd89b4fed535bc54afd8b2bc8ecdc7f2774c2ec2929861d2f1'],
    'tutorial-i-am-sirmin': ['tutorial-i-am-sirmin.wav', '9be6dfcb15158215a11a2a1e00037dc46137c439665026f142835edce0634193'],
    'tutorial-im-bored': ['tutorial-im-bored.wav', '7215236be51cc86f319488b7f446e451fb16fa7033e733dc6b89fe383d118535'],
    'tutorial-levelling-up': ['tutorial-levelling-up.wav', '7124c578c133671366caf6285b15508b06efe8e174228d6853a24078ca456fb1'],
    'tutorial-looking-beat-up': ['tutorial-looking-beat-up.wav', '0956e770c3bba32053ece64a932c98559c56b71075c96818d01a6cb8d25a07d5'],
    'tutorial-make-me-stronger': ['tutorial-make-me-stronger.wav', '0d333cf07c0e08d61001d979806c448174d048653cd001147ca0a109d441b04d'],
    'tutorial-never-heard-of-you': ['tutorial-never-heard-of-you.wav', '1c10ee772039eda014d0a081422003531e0486694dc3ab876bd3426935ba7016'],
    'tutorial-oh-boy-another-wizard': ['tutorial-oh-boy-another-wizard.wav', '5d0ce3e49383bade90aa7ffea491be6cb11eb10e9c1c4f417976faa8b631c45f'],
    'tutorial-show-yourself': ['tutorial-show-yourself.wav', 'e1f8c9cea2b009a109354c223d2042d73ec450457a1eedf0130f0d093c9f4f6e'],
    'tutorial-sound-like-mother': ['tutorial-sound-like-mother.wav', 'efce4a898a667bb758c2df16d3e2d073cdeb1b3782435d57bf08a1cac361c012'],
    'tutorial-surrender': ['tutorial-surrender.wav', '7473e560efdda24c256a7d360aa765ab29cca444626aee642f53c9b657e00ee8'],
    'tutorial-to-death-exactly': ['tutorial-to-death-exactly.wav', 'd92e6cbbd0aad5d8784da89712e9d0e810a6fd8bfa1278dbaf9a23ac1298ee9c'],
    'tutorial-unredeemable': ['tutorial-unredeemable.wav', '937325457f6140b67e21276b9c573cabf4bcc254134b0831f56b8d9cb1458e2f'],
    'tutorial-your-perversions': ['tutorial-your-perversions.wav', '9faf1b8da6df4fbec57beaa6213c724d5b88f9d8db2092dd8eed6082e4c6fa92'],
  } as const
  assert.equal(NATIVE_TUTORIAL_CUES.length, 24)
  assert.equal(Object.keys(files).length, 22)
  for (const [cue, [filename, sha256]] of Object.entries(files)) {
    const source = readFileSync(new URL(
      `../assets/game/audio/voice/${filename}`,
      import.meta.url,
    ))
    assert.equal(createHash('sha256').update(source).digest('hex'), sha256, cue)
    assert.ok(NATIVE_TUTORIAL_CUE_DEFINITIONS[
      cue as keyof typeof NATIVE_TUTORIAL_CUE_DEFINITIONS
    ].durationTicks > 0)
  }
  assert.ok(NATIVE_TUTORIAL_CUES.includes('solomon-laugh-1'))
  assert.ok(NATIVE_TUTORIAL_CUES.includes('solomon-get-him-boys'))
})

test('pins the exact unnormalized Tutorial prelude and combat renders', () => {
  const rows = [
    ['prelude.mp3', '493b98c2395cdd5dd2a099dc4afecfc06cb35d8258f55c12c36649b0cccd1f45'],
    ['combat.mp3', '8663d4fa72d4b41ef511a0c6da129064351ac639ebce0c492c037a21b2f34675'],
  ] as const
  for (const [filename, sha256] of rows) {
    const source = readFileSync(new URL(
      `../assets/game/audio/music/${filename}`,
      import.meta.url,
    ))
    assert.equal(createHash('sha256').update(source).digest('hex'), sha256)
  }
})

test('pins every Solomon Dig one-shot to its exact native registry row and PCM', () => {
  const files = {
    'shovel-1': ['shovel-1.wav', 0x22dc, 'be06d2e6eaacf2e0b35aaf14293e41420a0efd5ae364894cda193398838ebce6'],
    'shovel-2': ['shovel-2.wav', 0x2308, '4697492d7f5e07a78613b60c44122c7e3193d17d898eccf8ffe62f229d4c0fdd'],
    'throw-dirt-1': ['throw-dirt-1.wav', 0x2518, 'de233771aae5e806e4bdba0553729d1744605f512243fd30733e2e0dbd00a1ef'],
    'throw-dirt-2': ['throw-dirt-2.wav', 0x2544, 'e527b1df105d2a2fabc65aa576d76fcf7379d3bf0d9f6a51fabb81011ffc947f'],
  } as const
  for (const [cue, [filename, registryOffset, sha256]] of Object.entries(files)) {
    const entry = NATIVE_SOUND_MANIFEST[cue as keyof typeof files]
    const source = readFileSync(new URL(
      `../assets/game/audio/sfx/${filename}`,
      import.meta.url,
    ))
    assert.equal(entry.registryOffset, registryOffset)
    assert.equal(entry.sourceSha256, sha256)
    assert.equal(createHash('sha256').update(source).digest('hex'), sha256)
  }
})

test('keeps native registry offsets on the browser cue manifest', () => {
  assert.equal(NATIVE_SOUND_MANIFEST['bone-crack'].registryOffset, 0x228)
  assert.equal(NATIVE_SOUND_MANIFEST.click.registryOffset, 0x18)
  assert.equal(NATIVE_SOUND_MANIFEST.drink.registryOffset, 0x438)
  assert.equal(NATIVE_SOUND_MANIFEST['fireball-hit'].registryOffset, 0x540)
  assert.equal(
    NATIVE_SOUND_MANIFEST['fireball-hit'].sourceSha256,
    '9bfad709cfb932b7e836c58f781a42ee78907a0211bac5d14a2583d721192738',
  )
  assert.equal(NATIVE_SOUND_MANIFEST['portal-open'].registryOffset, 0xb44)
  assert.equal(NATIVE_SOUND_MANIFEST['portal-hurt'].registryOffset, 0x77c)
  assert.equal(NATIVE_SOUND_MANIFEST['portal-die'].registryOffset, 0xcfc)
  assert.equal(NATIVE_SOUND_MANIFEST['flame-lash-start'].registryOffset, 0x5c4)
  assert.equal(NATIVE_SOUND_MANIFEST['frost-missile'].registryOffset, 0x6a0)
  assert.equal(NATIVE_SOUND_MANIFEST['shock-1'].registryOffset, 0x21d4)
  assert.equal(NATIVE_SOUND_MANIFEST['throw-lightning-1'].registryOffset, 0x2570)
  assert.equal(
    NATIVE_SOUND_MANIFEST['flame-lash-start'].sourceSha256,
    'd563633ce5ed2701050884b11806898da500581858238d45fb881e820db0a1dc',
  )
  assert.equal(NATIVE_SOUND_MANIFEST['pick-skill'].registryOffset, 0x44)
  assert.equal(NATIVE_SOUND_MANIFEST['open-panel'].registryOffset, 0xb18)
  assert.equal(NATIVE_SOUND_MANIFEST.unforge.registryOffset, 0x1148)
  assert.equal(NATIVE_SOUND_MANIFEST['unlock-skill'].registryOffset, 0x11a0)
  assert.equal(NATIVE_SOUND_MANIFEST['level-up'].registryOffset, 0x908)
  assert.equal(NATIVE_SOUND_MANIFEST['step-1'].registryOffset, 0x23b8)
  assert.equal(NATIVE_SOUND_MANIFEST['step-2'].registryOffset, 0x23e4)
  assert.equal(NATIVE_SOUND_MANIFEST['start-boulder'].registryOffset, 0xf0c)
  assert.equal(NATIVE_SOUND_MANIFEST['skeleton-die'].registryOffset, 0xdac)
  assert.equal(NATIVE_SOUND_MANIFEST['shoot-arrow'].registryOffset, 0xd80)
  assert.equal(NATIVE_SOUND_MANIFEST['critical-hit'].registryOffset, 0x330)
  assert.equal(NATIVE_SOUND_MANIFEST['disable-enemy'].registryOffset, 0x3b4)
  assert.equal(NATIVE_SOUND_MANIFEST.knockback.registryOffset, 0x8b0)
  assert.equal(NATIVE_SOUND_MANIFEST['spin-attack'].registryOffset, 0xe5c)
  assert.equal(NATIVE_SOUND_MANIFEST['staff-hit-wood'].registryOffset, 0xeb4)
  assert.equal(NATIVE_SOUND_MANIFEST['staff-swoosh'].registryOffset, 0xee0)
  assert.equal(NATIVE_SOUND_MANIFEST['hit-shield'].registryOffset, 0x750)
  assert.equal(NATIVE_SOUND_MANIFEST['pop-shield'].registryOffset, 0xcd0)
  assert.equal(NATIVE_SOUND_MANIFEST['zombie-ouch'].registryOffset, 0x127c)
  assert.equal(NATIVE_SOUND_MANIFEST['wizard-ouch-1'].registryOffset, 0x2620)
  assert.equal(NATIVE_SOUND_MANIFEST['wizard-ouch-2'].registryOffset, 0x264c)
  assert.equal(NATIVE_SOUND_MANIFEST['wizard-ouch-3'].registryOffset, 0x2678)
  assert.equal(NATIVE_LOOP_MANIFEST['electric-loop'].registryOffset, 0x164c)
  assert.equal(
    NATIVE_LOOP_MANIFEST['electric-loop'].sourceSha256,
    '809601e64da07ac0adfffec5f5e29dfc61ee79725fdbf85ceb501d80d6cb0db4',
  )
  assert.equal(NATIVE_LOOP_MANIFEST['flyblown-loop'].registryOffset, 0x170c)
  assert.equal(NATIVE_LOOP_MANIFEST['fire-loop'].registryOffset, 0x16ac)
  assert.equal(NATIVE_LOOP_MANIFEST['maggots-loop'].registryOffset, 0x194c)
  assert.equal(NATIVE_LOOP_MANIFEST['soul-loop'].registryOffset, 0x1b8c)
  assert.equal(NATIVE_LOOP_MANIFEST['gather-rocks-loop'].registryOffset, 0x176c)
  assert.equal(NATIVE_LOOP_MANIFEST['ice-beam-loop'].registryOffset, 0x17cc)
  assert.equal(NATIVE_LOOP_MANIFEST['ice-loop'].registryOffset, 0x182c)
  assert.equal(NATIVE_LOOP_MANIFEST['lightning-loop'].registryOffset, 0x188c)
  assert.equal(NATIVE_LOOP_MANIFEST['rolling-stone-loop'].registryOffset, 0x1acc)
  assert.equal(NATIVE_LOOP_MANIFEST['meteor-loop'].registryOffset, 0x19ac)
  assert.equal(NATIVE_LOOP_MANIFEST['steam-loop'].registryOffset, 0x1c4c)
  assert.equal(NATIVE_LOOP_MANIFEST['polisher-wipe'].registryOffset, null)
  assert.equal(NATIVE_STREAM_MANIFEST['catch-it'].registryOffset, 0x1344)
  assert.equal(NATIVE_STREAM_MANIFEST['choose-element'].registryOffset, 0x134c)
  assert.equal(NATIVE_STREAM_MANIFEST.dye.registryOffset, 0x1374)
  assert.equal(NATIVE_STREAM_MANIFEST['pike-break'].registryOffset, 0x13e4)
  assert.equal(NATIVE_STREAM_MANIFEST['start-cast'].registryOffset, 0x141c)
})

test('pins all three direct Portal cues and preserves the half-gain opening edge', () => {
  const files = {
    'portal-die': 'portal-die.wav',
    'portal-hurt': 'portal-hurt.wav',
    'portal-open': 'portal-open.wav',
  } as const
  for (const [cue, filename] of Object.entries(files)) {
    const source = readFileSync(new URL(
      `../assets/game/audio/sfx/${filename}`,
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_SOUND_MANIFEST[cue as keyof typeof files].sourceSha256,
    )
  }
  assert.deepEqual(nativeEnemyEventSoundRequest({
    actorId: 5,
    eventId: 8,
    gainScale: 0.5,
    pitch: 1,
    runId: 'run-1',
    sound: 'portal-open',
    sourcePosition: { x: 10, y: 20 },
    tick: 99,
    type: 'enemy-action-sound',
  }), {
    cue: 'portal-open',
    playbackRate: 1,
    sourcePosition: { x: 10, y: 20 },
    volume: 0.5,
  })
})

test('pins the first story Office voice and Polisher loop to stock PCM', () => {
  const voice = readFileSync(new URL(
    '../assets/game/audio/voice/arch-intro-0.wav',
    import.meta.url,
  ))
  const wipe = readFileSync(new URL(
    '../assets/game/audio/sfx/polisher-wipe-loop.wav',
    import.meta.url,
  ))
  assert.equal(
    createHash('sha256').update(voice).digest('hex'),
    NATIVE_COLLEGE_OFFICE_AUDIO_MANIFEST.archIntro.sourceSha256,
  )
  assert.equal(
    createHash('sha256').update(wipe).digest('hex'),
    NATIVE_COLLEGE_OFFICE_AUDIO_MANIFEST.polisherWipe.sourceSha256,
  )
  assert.equal(NATIVE_COLLEGE_OFFICE_AUDIO_MANIFEST.archIntro.durationTicks, 698)
})

test('pins every welded-primary cue to its untouched stock WAV', () => {
  const sounds = {
    'flame-lash-start': 'flame-lash-start.wav',
    'frost-missile': 'frost-missile.wav',
    'hail-shot': 'hail-shot.wav',
    'ice-start': 'ice-start.wav',
    'rock-hit': 'rock-hit.wav',
    'shock-1': 'shock-1.wav',
    'shock-2': 'shock-2.wav',
    'shock-3': 'shock-3.wav',
    'throw-lightning-1': 'throw-lightning-1.wav',
    'throw-lightning-2': 'throw-lightning-2.wav',
  } as const
  for (const [cue, filename] of Object.entries(sounds)) {
    const source = readFileSync(new URL(
      `../assets/game/audio/sfx/${filename}`,
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_SOUND_MANIFEST[cue as keyof typeof sounds].sourceSha256,
    )
  }
  const loops = {
    'fire-loop': 'fire-loop.wav',
    'ice-beam-loop': 'ice-beam-loop.wav',
    'meteor-loop': 'meteor-loop.wav',
    'steam-loop': 'steam-loop.wav',
  } as const
  for (const [cue, filename] of Object.entries(loops)) {
    const source = readFileSync(new URL(
      `../assets/game/audio/sfx/${filename}`,
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_LOOP_MANIFEST[cue as keyof typeof loops].sourceSha256,
    )
  }
})

test('pins every GoodImp landing and contact cue to its untouched stock WAV', () => {
  const files = {
    'bite-1': ['bite-1.wav', 0x1d30],
    'bite-2': ['bite-2.wav', 0x1d5c],
    'bite-3': ['bite-3.wav', 0x1d88],
    'imp-vocal-1': ['imp-1.wav', 0x1fc4],
    'imp-vocal-2': ['imp-2.wav', 0x1ff0],
    'imp-vocal-3': ['imp-3.wav', 0x201c],
    'imp-vocal-4': ['imp-4.wav', 0x2048],
    'imp-vocal-5': ['imp-5.wav', 0x2074],
    'imp-vocal-6': ['imp-6.wav', 0x20a0],
    'imp-vocal-7': ['imp-7.wav', 0x20cc],
    'imp-vocal-8': ['imp-8.wav', 0x20f8],
  } as const
  for (const [cue, [filename, registryOffset]] of Object.entries(files)) {
    const entry = NATIVE_SOUND_MANIFEST[cue as keyof typeof files]
    const source = readFileSync(new URL(
      `../assets/game/audio/sfx/${filename}`,
      import.meta.url,
    ))
    assert.equal(entry.registryOffset, registryOffset)
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      entry.sourceSha256,
    )
  }
})

test('pins every Staff contact cue to its untouched stock WAV', () => {
  for (const [cue, filename] of [
    ['critical-hit', 'critical-hit.wav'],
    ['disable-enemy', 'disable-enemy.wav'],
    ['knockback', 'knockback.wav'],
    ['spin-attack', 'spin-attack.wav'],
    ['staff-hit-wood', 'staff-hit-wood.wav'],
    ['staff-swoosh', 'staff-swoosh.wav'],
  ] as const) {
    const source = readFileSync(new URL(
      `../assets/game/audio/sfx/${filename}`,
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_SOUND_MANIFEST[cue].sourceSha256,
    )
  }
  const pikeBreak = readFileSync(new URL(
    '../assets/game/audio/sfx/pike-break.wav',
    import.meta.url,
  ))
  assert.equal(
    createHash('sha256').update(pikeBreak).digest('hex'),
    NATIVE_STREAM_MANIFEST['pike-break'].sourceSha256,
  )
})

test('pins the complete skill-picker lifecycle cues to the untouched stock WAVs', () => {
  for (const [cue, filename] of [
    ['open-panel', 'openpanel.wav'],
    ['unlock-skill', 'unlockskill.wav'],
  ] as const) {
    const source = readFileSync(new URL(
      `../assets/game/audio/sfx/${filename}`,
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_SOUND_MANIFEST[cue].sourceSha256,
    )
  }
})

test('pins the selected-skill HUD concentration cue to registry member 17', () => {
  const source = readFileSync(
    new URL('../assets/game/audio/sfx/concentrate.wav', import.meta.url),
  )
  assert.deepEqual(NATIVE_SOUND_MANIFEST.concentrate, {
    registryOffset: 0x304,
    sourceName: 'sounds\\concentrate',
    sourceSha256: 'ca8b10ff2ce00ca913a382c05f3e1c0c600a22d2e206e386e52a4e83d704a47c',
  })
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    NATIVE_SOUND_MANIFEST.concentrate.sourceSha256,
  )
})

test('pins Magic Trap ElectricBurn loop to the untouched stock WAV', () => {
  const source = readFileSync(
    new URL('../assets/game/audio/sfx/electric-loop.wav', import.meta.url),
  )
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    NATIVE_LOOP_MANIFEST['electric-loop'].sourceSha256,
  )
})

test('pins all three enemy ambient loops to the untouched stock WAVs', () => {
  for (const [cue, filename] of [
    ['flyblown-loop', 'flyblown-loop.wav'],
    ['maggots-loop', 'maggots-loop.wav'],
    ['soul-loop', 'soul-loop.wav'],
  ] as const) {
    const source = readFileSync(new URL(
      `../assets/game/audio/sfx/${filename}`,
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_LOOP_MANIFEST[cue].sourceSha256,
      cue,
    )
  }
})

test('pins every contracted right-click cue to its untouched stock WAV', () => {
  const manifestByCue = {
    ...NATIVE_SOUND_MANIFEST,
    ...NATIVE_STREAM_MANIFEST,
    ...NATIVE_LOOP_MANIFEST,
  } as Readonly<Record<string, Readonly<{ sourceSha256: string }>>>
  const cues = new Set(NATIVE_SECONDARY_ABILITY_CONTRACTS.flatMap(({ audio }) => (
    audio.map(({ event }) => event)
  )))
  for (const cue of cues) {
    const manifest = manifestByCue[cue]
    assert.ok(manifest, `missing native audio manifest for ${cue}`)
    const filename = cue === 'flash' ? 'enemy-flash.wav' : `${cue}.wav`
    const source = readFileSync(new URL(
      `../assets/game/audio/sfx/${filename}`,
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      manifest.sourceSha256,
      cue,
    )
  }
})

test('pins potion use to the untouched stock drink cue', () => {
  const source = readFileSync(
    new URL('../assets/game/audio/sfx/drink.wav', import.meta.url),
  )
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    NATIVE_SOUND_MANIFEST.drink.sourceSha256,
  )
})

test('pins DyeClothing confirmation to the untouched stock dye stream', () => {
  const source = readFileSync(
    new URL('../assets/game/audio/sfx/dye.wav', import.meta.url),
  )
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    NATIVE_STREAM_MANIFEST.dye.sourceSha256,
  )
})

test('pins every inventory and trader transaction cue to its untouched stock WAV', () => {
  for (const [cue, filename] of [
    ['backpack-close', 'backpack-close.wav'],
    ['backpack-open', 'backpack-open.wav'],
    ['bad-action', 'bad-action.wav'],
    ['distort-reality', 'distort-reality.wav'],
    ['drop-coins', 'drop-coins.wav'],
    ['fizzle', 'fizzle.wav'],
    ['open-panel', 'openpanel.wav'],
    ['unforge', 'unforge.wav'],
  ] as const) {
    const source = readFileSync(new URL(
      `../assets/game/audio/sfx/${filename}`,
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_SOUND_MANIFEST[cue].sourceSha256,
    )
  }
  assert.equal(NATIVE_SOUND_MANIFEST['backpack-close'].registryOffset, 0xc8)
  assert.equal(NATIVE_SOUND_MANIFEST['backpack-open'].registryOffset, 0xf4)
  assert.equal(NATIVE_SOUND_MANIFEST['bad-action'].registryOffset, 0x120)
  assert.equal(NATIVE_SOUND_MANIFEST['distort-reality'].registryOffset, 0x40c)
  assert.equal(NATIVE_SOUND_MANIFEST['drop-coins'].registryOffset, 0x464)
  assert.equal(NATIVE_SOUND_MANIFEST.fizzle.registryOffset, 0x598)
  assert.equal(NATIVE_SOUND_MANIFEST['open-panel'].registryOffset, 0xb18)
  assert.equal(NATIVE_SOUND_MANIFEST.unforge.registryOffset, 0x1148)
})

test('pins every ground-loot cue and request to its untouched registry WAV', () => {
  const rows = [
    ['drop-bag-1', 'drop-bag-1.wav', 0x1fe4],
    ['drop-bag-2', 'drop-bag-2.wav', 0x2010],
    ['drop-coins', 'drop-coins.wav', 0x464],
    ['drop-potion', 'drop-potion.wav', 0x490],
    ['goto-orb', 'goto-orb.wav', 0x70],
    ['pickup-bag', 'pickup-bag.wav', 0xbc8],
    ['pickup-coin', 'pickup-coin.wav', 0xbf4],
  ] as const
  for (const [cue, filename, registryOffset] of rows) {
    const source = readFileSync(new URL(`../assets/game/audio/sfx/${filename}`, import.meta.url))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_SOUND_MANIFEST[cue].sourceSha256,
      cue,
    )
    assert.equal(NATIVE_SOUND_MANIFEST[cue].registryOffset, registryOffset)
  }
  assert.deepEqual(nativeLootEventSoundRequest({
    actorId: 8,
    eventId: 4,
    playbackRate: 1.05,
    position: { x: 20, y: 30 },
    runId: 'loot-audio',
    sound: 'pickup-coin',
    tick: 9,
    type: 'loot-pickup',
  }), {
    cue: 'pickup-coin',
    playbackRate: 1.05,
    sourcePosition: { x: 20, y: 30 },
    volume: 1,
  })
})

test('pins every Hail bounce selector to its exact stock registry WAV', () => {
  const rows = [
    ['hail-bounce-0', 'hail-bounce-0.wav', 0x1f14],
    ['hail-bounce-1', 'hail-bounce-1.wav', 0x1f40],
    ['hail-bounce-2', 'hail-bounce-2.wav', 0x1f6c],
    ['hail-bounce-3', 'hail-bounce-3.wav', 0x1f98],
  ] as const
  for (const [cue, filename, registryOffset] of rows) {
    const source = readFileSync(new URL(`../assets/game/audio/sfx/${filename}`, import.meta.url))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_SOUND_MANIFEST[cue].sourceSha256,
      cue,
    )
    assert.equal(NATIVE_SOUND_MANIFEST[cue].registryOffset, registryOffset)
  }
})

test('pins defensive Flash response to its exact stock registry WAV', () => {
  const source = readFileSync(
    new URL('../assets/game/audio/sfx/flash-spell.wav', import.meta.url),
  )
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    NATIVE_SOUND_MANIFEST['flash-spell'].sourceSha256,
  )
  assert.equal(NATIVE_SOUND_MANIFEST['flash-spell'].registryOffset, 0x61c)
  assert.equal(NATIVE_SOUND_MANIFEST['flash-spell'].sourceName, 'sounds\\flashspell')
})

test('plays the untouched stock level-up cue once at scalar one per barrier', () => {
  const source = readFileSync(
    new URL('../assets/game/audio/sfx/level-up.wav', import.meta.url),
  )
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    NATIVE_SOUND_MANIFEST['level-up'].sourceSha256,
  )
  assert.deepEqual(NATIVE_LEVEL_UP_SOUND_REQUEST, {
    cue: 'level-up',
    playbackRate: 1,
  })
})

test('pins the checked-in Skeleton death cue to the untouched stock WAV', () => {
  const source = readFileSync(
    new URL('../assets/game/audio/sfx/skeleton-die.wav', import.meta.url),
  )
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    NATIVE_SOUND_MANIFEST['skeleton-die'].sourceSha256,
  )
})

test('pins every checked-in enemy death cue to its untouched stock WAV', () => {
  const filenames = {
    'banshee-die': 'banshee-die.wav',
    'coffin-break': 'coffin-break.wav',
    'demon-die': 'demon-die.wav',
    'firey-death': 'firey-death.wav',
    flash: 'enemy-flash.wav',
    'imp-split': 'imp-split.wav',
    'maggot-squeak-1': 'maggot-squeak-1.wav',
    'maggot-squeak-2': 'maggot-squeak-2.wav',
    'maggot-squish-1': 'maggot-squish-1.wav',
    'maggot-squish-2': 'maggot-squish-2.wav',
    'maggot-squish-3': 'maggot-squish-3.wav',
    'portal-die': 'portal-die.wav',
    'skeleton-die': 'skeleton-die.wav',
    'zombie-die': 'zombie-die.wav',
    'zombie-die-groan': 'zombie-die-groan.wav',
    'zombie-poison-splat': 'zombie-poison-splat.wav',
  } as const
  for (const [cue, filename] of Object.entries(filenames)) {
    const source = readFileSync(new URL(
      `../assets/game/audio/sfx/${filename}`,
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_SOUND_MANIFEST[cue as keyof typeof NATIVE_SOUND_MANIFEST].sourceSha256,
    )
  }
})

test('pins every checked-in enemy damage cue to its untouched stock WAV', () => {
  const filenames = {
    'bone-crack': 'bone-crack.wav',
    'hit-shield': 'hit-shield.wav',
    'pop-shield': 'pop-shield.wav',
    'portal-hurt': 'portal-hurt.wav',
    'zombie-ouch': 'zombie-ouch.wav',
  } as const
  for (const [cue, filename] of Object.entries(filenames)) {
    const source = readFileSync(new URL(
      `../assets/game/audio/sfx/${filename}`,
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_SOUND_MANIFEST[cue as keyof typeof NATIVE_SOUND_MANIFEST].sourceSha256,
    )
  }
})

test('pins all three Wizard ouch variants to the untouched stock WAVs', () => {
  for (const cue of ['wizard-ouch-1', 'wizard-ouch-2', 'wizard-ouch-3'] as const) {
    const source = readFileSync(new URL(
      `../assets/game/audio/sfx/${cue}.wav`,
      import.meta.url,
    ))
    assert.equal(
      createHash('sha256').update(source).digest('hex'),
      NATIVE_SOUND_MANIFEST[cue].sourceSha256,
    )
  }
})

test('pins Deflect swipe to its stock PCM and maps the successful global feedback edge', () => {
  const source = readFileSync(
    new URL('../assets/game/audio/sfx/swipe.wav', import.meta.url),
  )
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    NATIVE_SOUND_MANIFEST.swipe.sourceSha256,
  )
  assert.deepEqual(nativeEnemyEventSoundRequest({
    actorId: 9,
    deflectPitch: 1.125,
    eventId: 3,
    runId: 'run-1',
    targetPlayerId: 'wizard',
    tick: 120,
    type: 'attack-marker',
  }), {
    cue: 'swipe',
    playbackRate: 1.125,
    sourcePosition: null,
    volume: 1,
  })
  assert.deepEqual(nativeEnemyEventSoundRequest({
    actorId: 4,
    eventId: 4,
    gainScale: 1,
    pitch: 1.125,
    runId: 'run-1',
    sound: 'bite-2',
    sourcePosition: { x: 10, y: 20 },
    tick: 121,
    type: 'enemy-action-sound',
  }), {
    cue: 'bite-2',
    playbackRate: 1.125,
    sourcePosition: { x: 10, y: 20 },
    volume: 1,
  })
})

test('pins the Archer release cue and maps its authoritative positional pitch', () => {
  const source = readFileSync(
    new URL('../assets/game/audio/sfx/shoot-arrow.wav', import.meta.url),
  )
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    NATIVE_SOUND_MANIFEST['shoot-arrow'].sourceSha256,
  )
  assert.deepEqual(nativeEnemyEventSoundRequest({
    actorId: 4,
    eventId: 5,
    gainScale: 1,
    pitch: 0.95,
    runId: 'run-1',
    sound: 'shoot-arrow',
    sourcePosition: { x: 10, y: 20 },
    tick: 122,
    type: 'enemy-action-sound',
  }), {
    cue: 'shoot-arrow',
    playbackRate: 0.95,
    sourcePosition: { x: 10, y: 20 },
    volume: 1,
  })
})

test('maps authoritative combat sounds to host-authored requests', () => {
  const death = {
    actorId: 9,
    eventId: 3,
    gainScale: 0.375,
    pitch: 1.125,
    runId: 'run-1',
    sound: 'maggot-squeak-2' as const,
    sourcePosition: { x: 10, y: 20 },
    tick: 120,
    type: 'enemy-death-sound' as const,
  }
  assert.deepEqual(nativeEnemyEventSoundRequest(death), {
    cue: 'maggot-squeak-2',
    playbackRate: 1.125,
    sourcePosition: { x: 10, y: 20 },
    volume: 0.375,
  })
  assert.deepEqual(nativeEnemyEventSoundRequest({
    ...death,
    eventId: 4,
    pitch: 0.825,
    sound: 'hit-shield',
    type: 'enemy-damage-sound',
  }), {
    cue: 'hit-shield',
    playbackRate: 0.825,
    sourcePosition: { x: 10, y: 20 },
    volume: 0.375,
  })
  assert.deepEqual(nativeEnemyEventSoundRequest({
    ...death,
    eventId: 5,
    gainScale: 0.625,
    pitch: 1,
    sound: 'wizard-ouch-2',
    targetPlayerId: 'wizard',
    type: 'player-damage-sound',
  }), {
    cue: 'wizard-ouch-2',
    playbackRate: 1,
    sourcePosition: { x: 10, y: 20 },
    volume: 0.625,
  })
  assert.equal(nativeEnemyEventSoundRequest({
    ...death,
    type: 'enemy-death',
  }), null)
})

test('matches native Boneyard point attenuation and death-presentation damping', () => {
  const visibleWorldWidth = 1_600 / 1.35
  const camera = { x: 800, y: 450 }
  const inner = visibleWorldWidth * 0.25
  const outer = visibleWorldWidth * 1.1
  const midpoint = (inner + outer) / 2

  assert.equal(
    nativeBoneyardPointGain(
      { x: camera.x + inner, y: camera.y },
      camera,
      visibleWorldWidth,
      false,
    ),
    1,
  )
  assert.ok(Math.abs(
    nativeBoneyardPointGain(
      { x: camera.x + midpoint, y: camera.y },
      camera,
      visibleWorldWidth,
      false,
    ) - 0.5,
  ) < 1e-12)
  assert.equal(
    nativeBoneyardPointGain(
      { x: camera.x + outer, y: camera.y },
      camera,
      visibleWorldWidth,
      false,
    ),
    0,
  )
  assert.equal(
    nativeBoneyardPointGain(
      { x: camera.x, y: camera.y },
      camera,
      visibleWorldWidth,
      true,
    ),
    0.1,
  )
})

test('matches native Solomon Dig hit attenuation and fixed gain-only requests', () => {
  const width = 1_200
  const camera = { x: 800, y: 450 }
  const inner = width * 0.1
  const outer = width * 0.5
  const midpoint = (inner + outer) / 2

  assert.equal(nativeBoneyardHitPointGain(
    { x: camera.x + inner, y: camera.y }, camera, width, false,
  ), 1)
  assert.equal(nativeBoneyardHitPointGain(
    { x: camera.x + inner, y: camera.y }, camera, width, true,
  ), 0.1)
  assert.equal(nativeBoneyardHitPointGain(
    { x: camera.x + midpoint, y: camera.y }, camera, width, false,
  ), 0.5)
  assert.equal(nativeBoneyardHitPointGain(
    { x: camera.x + midpoint, y: camera.y }, camera, width, true,
  ), 0.05)
  assert.equal(nativeBoneyardHitPointGain(
    { x: camera.x, y: camera.y }, camera, width, true,
  ), 1)
  assert.equal(nativeBoneyardHitPointGain(
    { x: camera.x + outer, y: camera.y }, camera, width, true,
  ), 0)

  assert.deepEqual(nativeSolomonDigSoundRequest({ cue: 'shovel-2', id: 7, tick: 70 }), {
    cue: 'shovel-2',
    playbackRate: 1,
    volume: 0.5,
  })
  assert.deepEqual(nativeSolomonDigSoundRequest({ cue: 'throw-dirt-1', id: 8, tick: 80 }), {
    cue: 'throw-dirt-1',
    playbackRate: 1,
    volume: 1,
  })
})

test('emits Create entry stream commands on crossed native thresholds', () => {
  assert.deepEqual(createEntryAudioEvents(0, 199), [])
  assert.deepEqual(createEntryAudioEvents(199, 200), [
    { action: 'play-stream', cue: 'start-cast' },
  ])
  assert.deepEqual(createEntryAudioEvents(1_339, 1_340), [
    { action: 'pause-stream', cue: 'start-cast' },
    { action: 'play-stream', cue: 'choose-element' },
  ])
})

test('emits the selected element and discipline reveal sounds in native order', () => {
  assert.deepEqual(createSelectionAudioEvents('fire', 0, 1_640), [
    { action: 'play-sound', cue: 'throw-fire' },
    { action: 'play-stream', cue: 'start-cast' },
    { action: 'pause-stream', cue: 'start-cast' },
    { action: 'play-stream', cue: 'choose-element' },
  ])
  assert.deepEqual(createSelectionAudioEvents('air', 979, 980), [
    { action: 'play-sound', cue: 'lightning-start' },
  ])
  assert.equal(CREATE_DISCIPLINE_FINALIZE_MS, 880)
})

test('consumes each authoritative Courtyard footstep once without gap bursts', () => {
  assert.equal(newNativeFootstepTick(undefined, { footstepTick: 0 }), undefined)
  assert.equal(newNativeFootstepTick(
    { footstepTick: 0 },
    { footstepTick: 25 },
  ), 25)
  assert.equal(newNativeFootstepTick(
    { footstepTick: 25 },
    { footstepTick: 25 },
  ), undefined)
  assert.equal(newNativeFootstepTick(
    { footstepTick: 25 },
    { footstepTick: 75 },
  ), 75)
  assert.equal(nativeFootstepCue(25, 'player-1'), nativeFootstepCue(25, 'player-1'))
  assert.ok(['step-1', 'step-2'].includes(nativeFootstepCue(50, 'player-1')))
})

test('consumes only the newest unseen Solomon cue after sparse snapshots', () => {
  const events = [
    { cue: 'solomon-hello-3' as const, id: 1 },
    { cue: 'solomon-laugh-1' as const, id: 2 },
    { cue: 'solomon-get-him-boys' as const, id: 3 },
  ]
  assert.deepEqual(newSolomonVoiceEvent(0, events), events[2])
  assert.deepEqual(newSolomonVoiceEvent(1, events), events[2])
  assert.equal(newSolomonVoiceEvent(3, events), null)
  assert.equal(newSolomonVoiceEvent(0, []), null)
})

test('consumes ordered Solomon Dig events without replaying hydration or a new run', () => {
  const events = [
    { cue: 'shovel-1' as const, id: 4, tick: 40 },
    { cue: 'throw-dirt-2' as const, id: 5, tick: 50 },
    { cue: 'shovel-2' as const, id: 6, tick: 60 },
  ]
  const hydrated = solomonDigAudioDelta(null, 'run-1', events)
  assert.deepEqual(hydrated.events, [])
  assert.deepEqual(hydrated.cursor, { eventId: 6, runId: 'run-1' })

  const next = { cue: 'throw-dirt-1' as const, id: 7, tick: 70 }
  const advanced = solomonDigAudioDelta(
    hydrated.cursor,
    'run-1',
    [...events, next],
  )
  assert.deepEqual(advanced.events, [next])
  assert.deepEqual(advanced.cursor, { eventId: 7, runId: 'run-1' })

  const newRun = solomonDigAudioDelta(
    advanced.cursor,
    'run-2',
    [{ cue: 'shovel-2', id: 1, tick: 10 }],
  )
  assert.deepEqual(newRun.events, [])
  assert.deepEqual(newRun.cursor, { eventId: 1, runId: 'run-2' })
})

test('matches native Courtyard attenuation and Teacher release timing', () => {
  assert.equal(HUB_AUDIO_ATTENUATION_RADIUS, 800)
  assert.equal(hubAudioAttenuation(0), 1)
  assert.equal(hubAudioAttenuation(150), 1)
  assert.equal(hubAudioAttenuation(475), 0.5)
  assert.equal(hubAudioAttenuation(800), 0.25)
  assert.equal(hubAudioAttenuation(2_000), 0.25)
  assert.equal(hubTeacherSummonVolume({ x: 0, y: 0 }, { x: 0, y: 0 }), 0.25)
  assert.equal(hubTeacherSummonVolume({ x: 0, y: 0 }, { x: 800, y: 0 }), 0.0625)

  assert.deepEqual(hubTeacherReleasesBetween(0, HUB_TEACHER_CAST_SECONDS - 0.001), [])
  assert.deepEqual(hubTeacherReleasesBetween(0, HUB_TEACHER_CAST_SECONDS), [0])
  assert.deepEqual(
    hubTeacherReleasesBetween(
      HUB_TEACHER_CAST_SECONDS,
      HUB_TEACHER_CAST_SECONDS + HUB_TEACHER_CYCLE_SECONDS,
    ),
    [1],
  )
  assert.ok(hubTeacherSummonPitch(0) >= 1)
  assert.ok(hubTeacherSummonPitch(0) < 1.1)
})
