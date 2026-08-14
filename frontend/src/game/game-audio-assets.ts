import academy from '../assets/game/audio/music/academy.mp3'
import selection from '../assets/game/audio/music/selection.mp3'
import solomonDarkTheme from '../assets/game/audio/music/solomondarktheme.mp3'
import prelude from '../assets/music/prelude.mp3'
import catchIt from '../assets/game/audio/sfx/catchit.wav'
import chooseElement from '../assets/game/audio/sfx/choose-element.wav'
import click from '../assets/game/audio/sfx/click.wav'
import iceStart from '../assets/game/audio/sfx/ice-start.wav'
import lightningStart from '../assets/game/audio/sfx/lightning-start.wav'
import magicMissile from '../assets/game/audio/sfx/magic-missile.wav'
import pickSkill from '../assets/game/audio/sfx/pickskill.wav'
import rockHit from '../assets/game/audio/sfx/rock-hit.wav'
import startCast from '../assets/game/audio/sfx/start-cast.wav'
import step1 from '../assets/game/audio/sfx/step/step1.wav'
import step2 from '../assets/game/audio/sfx/step/step2.wav'
import summon from '../assets/game/audio/sfx/summon.wav'
import throwFire from '../assets/game/audio/sfx/throw-fire.wav'
import gatherRocksLoop from '../assets/game/audio/sfx/gather-rocks-loop.wav'
import iceLoop from '../assets/game/audio/sfx/ice-loop.wav'
import lightningLoop from '../assets/game/audio/sfx/lightning-loop.wav'
import rollingStoneLoop from '../assets/game/audio/sfx/rolling-stone-loop.wav'
import startBoulder from '../assets/game/audio/sfx/start-boulder.wav'
import solomonGetHimBoys from '../assets/game/audio/voice/solomon-get-him-boys.wav'
import solomonHello1 from '../assets/game/audio/voice/solomon-hello-1.wav'
import solomonHello2 from '../assets/game/audio/voice/solomon-hello-2.wav'
import solomonHello3 from '../assets/game/audio/voice/solomon-hello-3.wav'
import solomonHello4 from '../assets/game/audio/voice/solomon-hello-4.wav'
import solomonLaugh1 from '../assets/game/audio/voice/solomon-laugh-1.wav'
import type { GameAudioSources } from './game-audio-native.ts'

export const GAME_AUDIO_SOURCES = {
  loops: {
    'gather-rocks-loop': gatherRocksLoop,
    'ice-loop': iceLoop,
    'lightning-loop': lightningLoop,
    'rolling-stone-loop': rollingStoneLoop,
  },
  music: {
    academy,
    prelude,
    selection,
    solomondarktheme: solomonDarkTheme,
  },
  sounds: {
    click,
    'ice-start': iceStart,
    'lightning-start': lightningStart,
    'magic-missile': magicMissile,
    'pick-skill': pickSkill,
    'rock-hit': rockHit,
    'start-boulder': startBoulder,
    'step-1': step1,
    'step-2': step2,
    summon,
    'throw-fire': throwFire,
  },
  streams: {
    'catch-it': catchIt,
    'choose-element': chooseElement,
    'start-cast': startCast,
    'solomon-get-him-boys': solomonGetHimBoys,
    'solomon-hello-1': solomonHello1,
    'solomon-hello-2': solomonHello2,
    'solomon-hello-3': solomonHello3,
    'solomon-hello-4': solomonHello4,
    'solomon-laugh-1': solomonLaugh1,
  },
} as const satisfies GameAudioSources
