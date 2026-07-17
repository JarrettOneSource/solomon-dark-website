// The site jukebox. The game keeps all of its music in one Impulse Tracker
// module (the "Raptisoft Magic Jukebox"); tools/extract-music.sh renders the
// ambient songs out of it, and each visit here picks one at random. The ♪ in
// the header's effects rail governs the music (UI ticks ride the separate
// sfx toggle); nothing plays before the first user gesture (autoplay
// policy — and manners).

import prelude from '../assets/music/prelude.mp3'
import solomondarktheme from '../assets/music/solomondarktheme.mp3'
import academy from '../assets/music/academy.mp3'
import academyold from '../assets/music/academyold.mp3'
import uiTick from '../assets/sounds/click.mp3'
import uiThump from '../assets/sounds/backpack-close.mp3'
import uiParchment from '../assets/sounds/parchment.mp3'
import { isMuted, playEffect, setMuted } from './audio'

export { isMuted } from './audio'

export const TRACKS = [
  { key: 'prelude', name: 'Prelude', src: prelude },
  { key: 'theme', name: 'The Solomon Dark Theme', src: solomondarktheme },
  { key: 'academy', name: 'The Academy', src: academy },
  { key: 'academyold', name: 'The Academy (old curriculum)', src: academyold },
]

// Music sits low under everything; the UI ticks ride a bit above it.
const MUSIC_VOLUME = 0.09

let audio: HTMLAudioElement | null = null
let trackName: string | null = null
let unlocked = false
let fadeRaf = 0
let pageFocused = !document.hidden && document.hasFocus()
let resumeOnFocus = false

export function currentTrack(): string | null {
  return trackName
}

/** True while a track is audibly playing (for the grimoire's report). */
export function isHumming(): boolean {
  return !!audio && !audio.paused
}

function fadeTo(target: number, ms: number, then?: () => void) {
  if (!audio) return
  cancelAnimationFrame(fadeRaf)
  const el = audio
  const from = el.volume
  const t0 = performance.now()
  const step = (t: number) => {
    const k = Math.max(0, Math.min((t - t0) / ms, 1))
    el.volume = from + (target - from) * k
    if (k < 1) fadeRaf = requestAnimationFrame(step)
    else then?.()
  }
  fadeRaf = requestAnimationFrame(step)
}

function startMusic(track = TRACKS[Math.floor(Math.random() * TRACKS.length)]) {
  audio?.pause()
  audio = new Audio(track.src)
  audio.volume = 0
  trackName = track.name
  const el = audio
  // shuffle-loop: when a song ends, a different one takes the stand
  el.addEventListener('ended', () => {
    if (audio !== el || isMuted()) return
    const others = TRACKS.filter((t) => t.name !== track.name)
    startMusic(others[Math.floor(Math.random() * others.length)])
  })
  void el.play().then(() => {
    if (audio !== el) return
    if (pageFocused) fadeTo(MUSIC_VOLUME, 2500)
    else pauseForFocusLoss()
  }).catch(() => {
    // Audible autoplay refused (no user activation yet). Play MUTED — that's
    // always allowed — so the song is already rolling, then unmute and fade
    // in on the first real gesture. Browsers with enough engagement history
    // skip straight past this branch and play audibly from the first note.
    el.muted = true
    void el.play().then(() => {
      if (audio === el && !pageFocused) pauseForFocusLoss()
    }).catch(() => {})
    const unmute = () => {
      window.removeEventListener('pointerdown', unmute, true)
      window.removeEventListener('keydown', unmute, true)
      if (audio !== el || isMuted()) return
      el.muted = false
      if (el.paused) void el.play().catch(() => {})
      fadeTo(MUSIC_VOLUME, 2000)
    }
    window.addEventListener('pointerdown', unmute, { once: true, capture: true })
    window.addEventListener('keydown', unmute, { once: true, capture: true })
  })
}

function pauseForFocusLoss() {
  if (!audio || audio.paused) return
  resumeOnFocus = true
  audio.pause()
}

function resumeAfterFocusReturn() {
  if (!resumeOnFocus || !pageFocused) return
  resumeOnFocus = false
  if (!audio || isMuted()) return
  void audio.play().then(() => fadeTo(MUSIC_VOLUME, 900)).catch(() => {})
}

function setPageFocused(focused: boolean) {
  pageFocused = focused
  if (focused) resumeAfterFocusReturn()
  else pauseForFocusLoss()
}

// Strike up as soon as the page opens — audibly if the browser lets us,
// silently rolling until the first gesture otherwise.
if (!isMuted()) startMusic()

// Class dismissed while the page is out of focus; it resumes on return.
document.addEventListener('visibilitychange', () => {
  setPageFocused(!document.hidden && document.hasFocus())
})
window.addEventListener('blur', () => setPageFocused(false))
window.addEventListener('focus', () => setPageFocused(!document.hidden))

/** Call on the first user gesture: unlocks sfx and starts the music. */
export function ensureStarted() {
  unlocked = true
  if (!audio && !isMuted()) startMusic()
}

/** The ♪ toggle. Returns the new muted state. */
export function toggleMuted(): boolean {
  const muted = !isMuted()
  setMuted(muted)
  if (muted) {
    fadeTo(0, 500, () => audio?.pause())
  } else if (audio) {
    audio.muted = false
    void audio.play().catch(() => {})
    fadeTo(MUSIC_VOLUME, 1000)
  } else {
    startMusic()
  }
  return muted
}

/** Switch to a named track (the grimoire's sd.jukebox). */
export function requestTrack(key: string): string | null {
  const track = TRACKS.find((t) => t.key === key)
  if (!track) return null
  if (!isMuted() && unlocked) startMusic(track)
  else trackName = track.name
  return track.name
}

// ---- UI ticks ---------------------------------------------------------------

function playUi(src: string, volume: number) {
  if (!unlocked) return
  playEffect(src, volume)
}

let lastHoverAt = 0
export function uiHover() {
  const now = performance.now()
  if (now - lastHoverAt < 70) return
  lastHoverAt = now
  playUi(uiTick, 0.09)
}

export function uiClick() {
  playUi(uiThump, 0.16)
}

export function uiPage() {
  playUi(uiParchment, 0.1)
}
