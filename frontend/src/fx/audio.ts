import {
  createMediaElementGain,
  type MediaElementGain,
} from '../lib/media-element-gain.ts'

// Music and sound effects mute independently (the header's effects rail),
// each persisted per device. Both start OFF: the site is the door to the
// game, and the game owns its own audio. Only an explicit '0' (the rail
// toggled on) lets the public site make a sound.
const MUSIC_KEY = 'sdr:muted'
const SFX_KEY = 'sdr:sfx-muted'

export interface SiteMediaChannel {
  readonly element: HTMLAudioElement
  readonly output: MediaElementGain
}

const activeEffects = new Set<SiteMediaChannel>()
let audioContext: AudioContext | null = null

/** Music muted? (The jukebox handles its own fade/pause on toggle.) */
export function isMuted(): boolean {
  return localStorage.getItem(MUSIC_KEY) !== '0'
}

export function setMuted(muted: boolean) {
  localStorage.setItem(MUSIC_KEY, muted ? '1' : '0')
}

export function isSfxMuted(): boolean {
  return localStorage.getItem(SFX_KEY) !== '0'
}

/** The effects-rail sfx toggle. Returns the new muted state. */
export function toggleSfxMuted(): boolean {
  const muted = !isSfxMuted()
  localStorage.setItem(SFX_KEY, muted ? '1' : '0')
  if (muted) {
    for (const effect of activeEffects) {
      effect.element.muted = true
      effect.element.pause()
      effect.output.disconnect()
    }
    activeEffects.clear()
  }
  return muted
}

export function playEffect(src: string, volume: number) {
  if (isSfxMuted()) return

  const effect = createSiteMediaChannel(src)
  effect.output.volume = volume
  activeEffects.add(effect)
  unlockSiteAudio()

  const cleanup = () => {
    effect.element.removeEventListener('ended', cleanup)
    effect.element.removeEventListener('error', cleanup)
    activeEffects.delete(effect)
    effect.output.disconnect()
  }

  effect.element.addEventListener('ended', cleanup)
  effect.element.addEventListener('error', cleanup)
  void effect.element.play().catch(cleanup)
}

export function createSiteMediaChannel(src: string): SiteMediaChannel {
  const element = new Audio(src)
  return {
    element,
    output: createMediaElementGain(siteAudioContext(), element),
  }
}

export function unlockSiteAudio(): void {
  const context = siteAudioContext()
  if (context.state !== 'running' && context.state !== 'closed') {
    void context.resume().catch(() => {})
  }
}

function siteAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext({ latencyHint: 'interactive' })
  }
  return audioContext
}
