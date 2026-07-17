import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { art } from '../lib/assets'
import { onSpell } from './bus'
import { LAUGHS, playSound } from './sounds'

const WALK = { frames: 6, w: 66, h: 64 }
const STAND = { w: 27, h: 64 }
const FLASH = { frames: 8, w: 56, h: 56 }

const COOLDOWN_MS = 8 * 60 * 1000
const SPAWN_CHANCE = 0.18
const WALK_CYCLE_MS = 550

let lastScurryAt = 0

interface Scurry {
  kind: 'scurry'
  leftToRight: boolean
  startX: number
  pauseX: number
  endX: number
  firstDuration: number
  pauseDuration: number
  secondDuration: number
}

interface Flash {
  kind: 'flash'
  left: number
  top: number
}

type Cameo = Scurry | Flash | null
type Status = 'idle' | 'scheduled' | 'running' | 'flash'

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function reducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function SolomonScurry() {
  const pathname = useLocation().pathname
  const [cameo, setCameo] = useState<Cameo>(null)
  const [standing, setStanding] = useState(false)
  const status = useRef<Status>('idle')
  const scheduledTimer = useRef<number | null>(null)
  const actorRef = useRef<HTMLDivElement>(null)
  const spriteRef = useRef<HTMLDivElement>(null)
  const movementAnimation = useRef<Animation | null>(null)
  const stripAnimation = useRef<Animation | null>(null)

  const startScurry = useCallback(() => {
    if (status.current === 'running' || status.current === 'flash') return
    if (scheduledTimer.current !== null) {
      clearTimeout(scheduledTimer.current)
      scheduledTimer.current = null
    }

    const leftToRight = Math.random() < 0.5
    const startX = leftToRight ? -WALK.w : window.innerWidth
    const endX = leftToRight ? window.innerWidth : -WALK.w
    const pauseAt = randomBetween(0.4, 0.6)
    const pauseDuration = randomBetween(800, 1_400)
    const crossingDuration = randomBetween(9_000, 14_000)
    const travelDuration = crossingDuration - pauseDuration

    lastScurryAt = Date.now()
    status.current = 'running'
    // he announces himself — one of his laughs, if the ♪ toggle allows
    playSound(LAUGHS[Math.floor(Math.random() * LAUGHS.length)], 0.22)
    setStanding(false)
    setCameo({
      kind: 'scurry',
      leftToRight,
      startX,
      pauseX: startX + (endX - startX) * pauseAt,
      endX,
      firstDuration: travelDuration * pauseAt,
      pauseDuration,
      secondDuration: travelDuration * (1 - pauseAt),
    })
  }, [])

  useEffect(() => {
    return () => {
      if (scheduledTimer.current !== null) clearTimeout(scheduledTimer.current)
      movementAnimation.current?.cancel()
      stripAnimation.current?.cancel()
      status.current = 'idle'
    }
  }, [])

  useEffect(() => {
    if (status.current !== 'idle' || reducedMotion()) return
    if (lastScurryAt && Date.now() - lastScurryAt < COOLDOWN_MS) return
    if (Math.random() >= SPAWN_CHANCE) return

    status.current = 'scheduled'
    scheduledTimer.current = window.setTimeout(() => {
      scheduledTimer.current = null
      if (reducedMotion()) {
        status.current = 'idle'
        return
      }
      startScurry()
    }, randomBetween(15_000, 75_000))
  }, [pathname, startScurry])

  useEffect(() => {
    if (reducedMotion()) return
    return onSpell((event) => {
      if (event.spell === 'scurry') startScurry()
    })
  }, [startScurry])

  useEffect(() => {
    if (cameo?.kind !== 'scurry') return
    const scurry = cameo
    const actor = actorRef.current
    if (!actor) return

    let cancelled = false
    let pauseTimer: number | null = null

    const playSegment = async (from: number, to: number, duration: number) => {
      const animation = actor.animate(
        [
          { transform: `translateX(${from}px)` },
          { transform: `translateX(${to}px)` },
        ],
        { duration, easing: 'linear', fill: 'forwards' },
      )
      movementAnimation.current = animation

      try {
        await animation.finished
      } catch {
        return false
      }
      if (cancelled) return false

      actor.style.transform = `translateX(${to}px)`
      animation.cancel()
      if (movementAnimation.current === animation) movementAnimation.current = null
      return true
    }

    const waitForPause = () =>
      new Promise<boolean>((resolve) => {
        pauseTimer = window.setTimeout(() => {
          pauseTimer = null
          resolve(!cancelled)
        }, scurry.pauseDuration)
      })

    void (async () => {
      if (!(await playSegment(scurry.startX, scurry.pauseX, scurry.firstDuration))) return

      stripAnimation.current?.cancel()
      stripAnimation.current = null
      setStanding(true)
      if (!(await waitForPause())) return

      setStanding(false)
      if (!(await playSegment(scurry.pauseX, scurry.endX, scurry.secondDuration))) return
      if (status.current !== 'running') return

      status.current = 'idle'
      setCameo(null)
    })()

    return () => {
      cancelled = true
      if (pauseTimer !== null) clearTimeout(pauseTimer)
      movementAnimation.current?.cancel()
      movementAnimation.current = null
    }
  }, [cameo])

  useEffect(() => {
    if (cameo?.kind !== 'scurry' || standing) return
    const sprite = spriteRef.current
    if (!sprite) return

    const animation = sprite.animate(
      [
        { backgroundPositionX: '0px' },
        { backgroundPositionX: `${-WALK.frames * WALK.w}px` },
      ],
      {
        duration: WALK_CYCLE_MS,
        easing: `steps(${WALK.frames})`,
        iterations: Infinity,
      },
    )
    stripAnimation.current = animation

    return () => {
      animation.cancel()
      if (stripAnimation.current === animation) stripAnimation.current = null
    }
  }, [cameo, standing])

  useEffect(() => {
    if (cameo?.kind !== 'flash') return
    const flash = spriteRef.current
    if (!flash) return

    const animation = flash.animate(
      [
        { backgroundPositionX: '0px' },
        { backgroundPositionX: `${-FLASH.frames * FLASH.w}px` },
      ],
      {
        duration: 400,
        easing: `steps(${FLASH.frames})`,
        iterations: 1,
        fill: 'forwards',
      },
    )
    let cancelled = false
    void animation.finished.then(
      () => {
        if (cancelled || status.current !== 'flash') return
        status.current = 'idle'
        setCameo(null)
      },
      () => {},
    )

    return () => {
      cancelled = true
      animation.cancel()
    }
  }, [cameo])

  if (!cameo) return null

  if (cameo.kind === 'flash') {
    return (
      <div
        ref={spriteRef}
        aria-hidden
        style={{
          position: 'fixed',
          left: cameo.left,
          top: cameo.top,
          zIndex: 86,
          width: FLASH.w,
          height: FLASH.h,
          pointerEvents: 'none',
          backgroundImage: `url(${art.fxFlash})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${FLASH.frames * FLASH.w}px ${FLASH.h}px`,
        }}
      />
    )
  }

  const spriteWidth = standing ? STAND.w : WALK.w

  return (
    <div
      ref={actorRef}
      aria-hidden
      style={{
        position: 'fixed',
        left: 0,
        bottom: 8,
        zIndex: 86,
        display: 'flex',
        width: WALK.w,
        height: WALK.h,
        justifyContent: 'center',
        pointerEvents: 'none',
        transform: `translateX(${cameo.startX}px)`,
      }}
    >
      <div
        ref={spriteRef}
        style={{
          width: spriteWidth,
          height: WALK.h,
          flex: 'none',
          pointerEvents: 'auto',
          cursor: 'pointer',
          backgroundImage: `url(${standing ? art.solomonStand : art.animSolomonWalk})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: standing
            ? `${STAND.w}px ${STAND.h}px`
            : `${WALK.frames * WALK.w}px ${WALK.h}px`,
          transform: `scaleX(${cameo.leftToRight ? 1 : -1})`,
        }}
        onClick={() => {
          const bounds = actorRef.current?.getBoundingClientRect()
          if (!bounds) return

          movementAnimation.current?.cancel()
          stripAnimation.current?.cancel()
          playSound('poof', 0.25)
          status.current = 'flash'
          setStanding(false)
          setCameo({
            kind: 'flash',
            left: bounds.left + (bounds.width - FLASH.w) / 2,
            top: bounds.top + (bounds.height - FLASH.h) / 2,
          })
        }}
      />
    </div>
  )
}
