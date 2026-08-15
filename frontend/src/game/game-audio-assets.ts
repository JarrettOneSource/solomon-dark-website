import academy from '../assets/game/audio/music/academy.mp3'
import selection from '../assets/game/audio/music/selection.mp3'
import solomonDarkTheme from '../assets/game/audio/music/solomondarktheme.mp3'
import prelude from '../assets/music/prelude.mp3'
import combat from '../assets/music/combat.mp3'
import death from '../assets/music/death.mp3'
import catchIt from '../assets/game/audio/sfx/catchit.wav'
import chooseElement from '../assets/game/audio/sfx/choose-element.wav'
import bansheeDie from '../assets/game/audio/sfx/banshee-die.wav'
import click from '../assets/game/audio/sfx/click.wav'
import coffinBreak from '../assets/game/audio/sfx/coffin-break.wav'
import demonDie from '../assets/game/audio/sfx/demon-die.wav'
import enemyFlash from '../assets/game/audio/sfx/enemy-flash.wav'
import fireballHit from '../assets/game/audio/sfx/fireball-hit.wav'
import fireyDeath from '../assets/game/audio/sfx/firey-death.wav'
import iceStart from '../assets/game/audio/sfx/ice-start.wav'
import impSplit from '../assets/game/audio/sfx/imp-split.wav'
import levelUp from '../assets/game/audio/sfx/level-up.wav'
import lightningStart from '../assets/game/audio/sfx/lightning-start.wav'
import magicMissile from '../assets/game/audio/sfx/magic-missile.wav'
import magicMissileHit from '../assets/game/audio/sfx/magic-missile-hit.wav'
import maggotSqueak1 from '../assets/game/audio/sfx/maggot-squeak-1.wav'
import maggotSqueak2 from '../assets/game/audio/sfx/maggot-squeak-2.wav'
import maggotSquish1 from '../assets/game/audio/sfx/maggot-squish-1.wav'
import maggotSquish2 from '../assets/game/audio/sfx/maggot-squish-2.wav'
import maggotSquish3 from '../assets/game/audio/sfx/maggot-squish-3.wav'
import pickSkill from '../assets/game/audio/sfx/pickskill.wav'
import rockHit from '../assets/game/audio/sfx/rock-hit.wav'
import skeletonDie from '../assets/game/audio/sfx/skeleton-die.wav'
import startCast from '../assets/game/audio/sfx/start-cast.wav'
import step1 from '../assets/game/audio/sfx/step/step1.wav'
import step2 from '../assets/game/audio/sfx/step/step2.wav'
import summon from '../assets/game/audio/sfx/summon.wav'
import throwFire from '../assets/game/audio/sfx/throw-fire.wav'
import zombieDie from '../assets/game/audio/sfx/zombie-die.wav'
import zombieDieGroan from '../assets/game/audio/sfx/zombie-die-groan.wav'
import zombiePoisonSplat from '../assets/game/audio/sfx/zombie-poison-splat.wav'
import gatherRocksLoop from '../assets/game/audio/sfx/gather-rocks-loop.wav'
import iceLoop from '../assets/game/audio/sfx/ice-loop.wav'
import lightningLoop from '../assets/game/audio/sfx/lightning-loop.wav'
import rollingStoneLoop from '../assets/game/audio/sfx/rolling-stone-loop.wav'
import startBoulder from '../assets/game/audio/sfx/start-boulder.wav'
import deathGuitar from '../assets/game/audio/sfx/death-guitar.wav'
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
    combat,
    death,
    prelude,
    selection,
    solomondarktheme: solomonDarkTheme,
  },
  sounds: {
    'banshee-die': bansheeDie,
    click,
    'coffin-break': coffinBreak,
    'demon-die': demonDie,
    'fireball-hit': fireballHit,
    'firey-death': fireyDeath,
    flash: enemyFlash,
    'ice-start': iceStart,
    'imp-split': impSplit,
    'level-up': levelUp,
    'lightning-start': lightningStart,
    'magic-missile': magicMissile,
    'magic-missile-hit': magicMissileHit,
    'maggot-squeak-1': maggotSqueak1,
    'maggot-squeak-2': maggotSqueak2,
    'maggot-squish-1': maggotSquish1,
    'maggot-squish-2': maggotSquish2,
    'maggot-squish-3': maggotSquish3,
    'pick-skill': pickSkill,
    'rock-hit': rockHit,
    'skeleton-die': skeletonDie,
    'start-boulder': startBoulder,
    'step-1': step1,
    'step-2': step2,
    summon,
    'throw-fire': throwFire,
    'zombie-die': zombieDie,
    'zombie-die-groan': zombieDieGroan,
    'zombie-poison-splat': zombiePoisonSplat,
  },
  streams: {
    'catch-it': catchIt,
    'choose-element': chooseElement,
    'death-guitar': deathGuitar,
    'start-cast': startCast,
    'solomon-get-him-boys': solomonGetHimBoys,
    'solomon-hello-1': solomonHello1,
    'solomon-hello-2': solomonHello2,
    'solomon-hello-3': solomonHello3,
    'solomon-hello-4': solomonHello4,
    'solomon-laugh-1': solomonLaugh1,
  },
} as const satisfies GameAudioSources
