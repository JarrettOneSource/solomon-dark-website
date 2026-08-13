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
import type { GameAudioSources } from './game-audio-native.ts'

export const GAME_AUDIO_SOURCES = {
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
    'step-1': step1,
    'step-2': step2,
    summon,
    'throw-fire': throwFire,
  },
  streams: {
    'catch-it': catchIt,
    'choose-element': chooseElement,
    'start-cast': startCast,
  },
} as const satisfies GameAudioSources
