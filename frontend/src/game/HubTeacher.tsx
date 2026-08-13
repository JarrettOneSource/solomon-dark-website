import { useEffect, useRef, type CSSProperties } from 'react'
import { hub } from '../lib/assets'
import { hubActorDepth } from './hub-depth.ts'
import {
  HUB_TEACHER_CAST_ORIGIN,
  HUB_TEACHER_CYCLE_SECONDS,
  HUB_TEACHER_RUNE_ALPHA,
  HUB_TEACHER_RUNE_CENTER,
  hubTeacherFrameAt,
} from './hub-teacher.ts'
import { hubTeacherReleasesBetween } from './game-audio-native.ts'

interface HubTeacherProps {
  onRelease: (releaseIndex: number) => void
  x: number
  y: number
}

export default function HubTeacher({ onRelease, x, y }: HubTeacherProps) {
  const frameRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const startedAt = performance.now()
    let previousElapsedSeconds = 0
    let animationFrame = 0
    const update = (now: number) => {
      const elapsedSeconds = (now - startedAt) / 1000
      const frame = frameRef.current
      if (frame) {
        frame.style.backgroundPosition = `${-hubTeacherFrameAt(elapsedSeconds) * 150}px 0`
      }
      for (const releaseIndex of hubTeacherReleasesBetween(
        previousElapsedSeconds,
        elapsedSeconds,
      )) onRelease(releaseIndex)
      previousElapsedSeconds = elapsedSeconds
      animationFrame = requestAnimationFrame(update)
    }
    animationFrame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationFrame)
  }, [onRelease])

  const actorStyle = {
    left: x,
    top: y,
    zIndex: hubActorDepth(y),
    '--hub-teacher-cycle': `${HUB_TEACHER_CYCLE_SECONDS}s`,
    '--hub-teacher-cast-x': `${HUB_TEACHER_CAST_ORIGIN.x}px`,
    '--hub-teacher-cast-y': `${HUB_TEACHER_CAST_ORIGIN.y}px`,
    '--hub-teacher-frames': `url("${hub.npcs.teacher.frames}")`,
    '--hub-teacher-burst-frames': `url("${hub.npcs.teacher.burst.frames}")`,
    '--hub-teacher-rune-alpha': HUB_TEACHER_RUNE_ALPHA,
    '--hub-teacher-rune-x': `${HUB_TEACHER_RUNE_CENTER.x}px`,
    '--hub-teacher-rune-y': `${HUB_TEACHER_RUNE_CENTER.y}px`,
  } as CSSProperties
  return (
    <div className="hub-actor hub-teacher" style={actorStyle} aria-label="Teacher casting">
      <img className="hub-teacher-rune" src={hub.npcs.teacher.rune} alt="" />
      <img className="hub-teacher-shadow" src={hub.npcs.teacher.shadow} alt="" />
      <span ref={frameRef} className="hub-teacher-frame" />
      <span className="hub-teacher-burst" aria-hidden>
        <img src={hub.npcs.teacher.burst.column} className="hub-teacher-burst-column" alt="" />
        <img src={hub.npcs.teacher.burst.flare} className="hub-teacher-burst-flare" alt="" />
        <img src={hub.npcs.teacher.burst.core} className="hub-teacher-burst-core" alt="" />
        <span className="hub-teacher-burst-frames" />
      </span>
    </div>
  )
}
