import { useEffect, useState } from 'react'

/**
 * Touch layout flag shared by the HUD members that change *behaviour* (not only
 * geometry) on a phone: the pause skull becomes a button and the party card
 * collapses into a chip. It mirrors the `(hover: none) and (pointer: coarse)`
 * blocks in hub.css so markup and style switch on the same media query.
 */
export const COARSE_POINTER_QUERY = '(hover: none) and (pointer: coarse)'

function coarsePointerActive(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(COARSE_POINTER_QUERY).matches
}

export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(coarsePointerActive)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined
    const list = window.matchMedia(COARSE_POINTER_QUERY)
    const update = () => setCoarse(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [])
  return coarse
}
