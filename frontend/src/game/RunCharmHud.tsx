import { useEffect, useId, useState } from 'react'

import { nativeUiRecord } from './native-ui/core.ts'
import { NativeUiSprite } from './native-ui/react-raw.ts'
import type { GameSnapshot } from './protocol/game-state.ts'
import { projectRunCharmStatus, sameRunCharmStatus } from './run-charm-status.ts'
import './run-charm-hud.css'

interface RunCharmHudProps {
  readonly initialSnapshot: GameSnapshot
  readonly playerId: string
  readonly subscribeSnapshot: (listener: (snapshot: GameSnapshot) => void) => () => void
}

export default function RunCharmHud({ initialSnapshot, playerId, subscribeSnapshot }: RunCharmHudProps) {
  const tooltipId = useId()
  const [charms, setCharms] = useState(() => projectRunCharmStatus(initialSnapshot, playerId))
  useEffect(() => subscribeSnapshot(snapshot => {
    const next = projectRunCharmStatus(snapshot, playerId)
    setCharms(current => sameRunCharmStatus(current, next) ? current : next)
  }), [playerId, subscribeSnapshot])
  if (charms.length === 0) return null
  return (
    <ul className="run-charm-hud" aria-label="Charms and curses" data-charm-owner={playerId}>
      {charms.map((charm, index) => {
        const [width, height] = nativeUiRecord('Skills', charm.record).logicalSize
        return (
          <li key={`${index}:${charm.selector}`} className="run-charm-status"
            data-charm-selector={charm.selector} data-active={charm.active}>
            <button type="button" className="run-charm-control"
              aria-label={`${charm.name}: ${charm.active ? 'Active' : 'Inactive'}`}
              aria-describedby={`${tooltipId}-${index}`}
              onClick={event => event.currentTarget.focus()}
              onMouseDown={event => event.stopPropagation()}
              onPointerDown={event => event.stopPropagation()}
              onKeyDown={event => {
                if (event.key === 'Tab') return
                event.stopPropagation()
                if (event.key === 'Escape') {
                  event.preventDefault()
                  event.currentTarget.blur()
                }
              }}>
              <span className="run-charm-icon" aria-hidden>
                <NativeUiSprite atlas="Skills" record={charm.record} style={{
                  left: '50%', position: 'absolute', top: '50%',
                  transform: `translate(-50%, -50%) scale(${26 / Math.max(width, height)})`,
                }} />
              </span>
              <span className="run-charm-state" aria-hidden>{charm.active ? 'ON' : 'OFF'}</span>
              <span className="run-charm-tooltip" id={`${tooltipId}-${index}`} role="tooltip">
                <strong>{charm.name}</strong>
                {charm.detail}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
