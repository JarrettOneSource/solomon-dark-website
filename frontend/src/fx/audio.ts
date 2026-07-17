const MUTED_KEY = 'sdr:muted'

const activeEffects = new Set<HTMLAudioElement>()

export function isMuted(): boolean {
  return localStorage.getItem(MUTED_KEY) === '1'
}

export function setMuted(muted: boolean) {
  localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
  if (!muted) return

  for (const effect of activeEffects) {
    effect.muted = true
    effect.pause()
  }
  activeEffects.clear()
}

export function playEffect(src: string, volume: number) {
  if (isMuted()) return

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
