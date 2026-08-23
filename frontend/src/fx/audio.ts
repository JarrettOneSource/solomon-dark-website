// Music and sound effects mute independently (the header's effects rail),
// each persisted per device. Both start OFF: the site is the door to the
// game, and the game owns its own audio. Only an explicit '0' (the rail
// toggled on) lets the public site make a sound.
const MUSIC_KEY = 'sdr:muted'
const SFX_KEY = 'sdr:sfx-muted'

const activeEffects = new Set<HTMLAudioElement>()

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
      effect.muted = true
      effect.pause()
    }
    activeEffects.clear()
  }
  return muted
}

export function playEffect(src: string, volume: number) {
  if (isSfxMuted()) return

  const effect = new Audio(src)
  effect.volume = volume
  activeEffects.add(effect)

  const cleanup = () => {
    effect.removeEventListener('ended', cleanup)
    effect.removeEventListener('error', cleanup)
    activeEffects.delete(effect)
  }

  effect.addEventListener('ended', cleanup)
  effect.addEventListener('error', cleanup)
  void effect.play().catch(cleanup)
}
