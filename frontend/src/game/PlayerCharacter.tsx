import type { CSSProperties } from 'react'
import { playerCharacter } from '../lib/assets.ts'
import ElementVfx from './ElementVfx.tsx'
import type { PlayerCharacterState } from './core-kernels/player-character.ts'
import { createPlayerCharacterDrawPlan } from './player-character-presentation.ts'
import './player-character.css'

interface PlayerCharacterProps {
  className?: string
  depth: number
  isLocal?: boolean
  playerId?: string
  state: PlayerCharacterState
}

export default function PlayerCharacter({
  className = '',
  depth,
  isLocal,
  playerId,
  state,
}: PlayerCharacterProps) {
  const plan = createPlayerCharacterDrawPlan(state)
  const headingPosition = `0 ${plan.headingSheetOffsetY}px`
  const fixedRobeTransform = translate(plan.fixedRobeOffset)
  const frontAttachmentTransform = translate(plan.frontAttachmentOffset)
  const orbAttachment = plan.staffFront
    ? plan.frontAttachmentOffset
    : { x: 0, y: 0 }
  const element = state.config.element
  const style = {
    left: state.position.x,
    top: state.position.y,
    zIndex: depth,
    '--player-character-staff-back-sheet': `url("${playerCharacter.staffBack}")`,
    '--player-character-robe-dynamic-sheet': `url("${playerCharacter.robeDynamic[element]}")`,
    '--player-character-robe-fixed-sheet': `url("${playerCharacter.robeFixed[element]}")`,
    '--player-character-staff-front-sheet': `url("${playerCharacter.staffFront}")`,
    '--player-character-head-sheet': `url("${playerCharacter.head[element]}")`,
  } as CSSProperties

  return (
    <div
      className={`player-character ${className}`.trim()}
      data-discipline={state.config.discipline}
      data-element={element}
      data-local={isLocal === undefined ? undefined : `${isLocal}`}
      data-moving={plan.moving}
      data-player-id={playerId}
      data-walk-pose={plan.robePose}
      aria-label={`${state.config.displayName}, ${element} wizard`}
      style={style}
    >
      <span className="player-character-shadow" />
      <span className="player-character-visual">
        <span
          className="player-character-layer player-character-staff-back"
          style={{ backgroundPosition: headingPosition }}
        />
        <span
          className="player-character-layer player-character-robe-dynamic"
          style={{
            backgroundPosition:
              `${-plan.robePose * 170}px ${plan.headingSheetOffsetY}px`,
          }}
        />
        <span
          className="player-character-layer player-character-robe-fixed"
          style={{
            backgroundPosition: headingPosition,
            transform: fixedRobeTransform,
          }}
        />
        <span
          className="player-character-layer player-character-staff-front"
          style={{
            backgroundPosition: headingPosition,
            transform: frontAttachmentTransform,
          }}
        />
        <span
          className="player-character-layer player-character-head"
          style={{
            backgroundPosition: headingPosition,
            transform: translate(plan.headOffset),
          }}
        />
        <span
          className="player-character-orb-vfx"
          style={{
            left: plan.orbOffset.x,
            top: plan.orbOffset.y,
            transform: translate(orbAttachment),
            zIndex: plan.orbZIndex,
          }}
        >
          <ElementVfx element={element} variant="staff" />
        </span>
      </span>
    </div>
  )
}

function translate(point: { x: number; y: number }): string {
  return `translate3d(${point.x}px, ${point.y}px, 0)`
}
