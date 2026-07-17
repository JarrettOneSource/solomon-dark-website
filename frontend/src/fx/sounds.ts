// Real game audio, quietly. Everything here is played from a user gesture
// (click or keypress) — nothing autoplays. If the browser refuses (no gesture
// yet, e.g. the real-midnight clock), we fail silently.

import castFire from '../assets/sounds/cast-fire.mp3'
import summon from '../assets/sounds/summon.mp3'
import attune from '../assets/sounds/attune.mp3'
import bonecrack from '../assets/sounds/bonecrack.mp3'
import skeletonDie from '../assets/sounds/skeleton-die.mp3'
import tomeGet from '../assets/sounds/tome-get.mp3'
import youGetNothing from '../assets/sounds/you-get-nothing.mp3'
import levelup from '../assets/sounds/levelup.mp3'
import skellyScream from '../assets/sounds/skelly-scream.mp3'
import thunder from '../assets/sounds/thunder.mp3'
import poof from '../assets/sounds/poof.mp3'
import laugh1 from '../assets/sounds/laugh-1.mp3'
import laughSmall1 from '../assets/sounds/laugh-small-1.mp3'
import laughSmall2 from '../assets/sounds/laugh-small-2.mp3'
import laughSmall3 from '../assets/sounds/laugh-small-3.mp3'
import laughSmall4 from '../assets/sounds/laugh-small-4.mp3'
import laughSmall5 from '../assets/sounds/laugh-small-5.mp3'
import { playEffect } from './audio'

const SOUNDS = {
  castFire,
  summon,
  attune,
  bonecrack,
  skeletonDie,
  tomeGet,
  youGetNothing,
  levelup,
  skellyScream,
  thunder,
  poof,
  laugh1,
  laughSmall1,
  laughSmall2,
  laughSmall3,
  laughSmall4,
  laughSmall5,
} as const

/** Solomon's laughing lines — the scurry picks one at random. */
export const LAUGHS: SoundName[] = [
  'laugh1',
  'laughSmall1',
  'laughSmall2',
  'laughSmall3',
  'laughSmall4',
  'laughSmall5',
]

export type SoundName = keyof typeof SOUNDS

export function playSound(name: SoundName, volume = 0.25) {
  playEffect(SOUNDS[name], volume)
}
