import { Link } from 'react-router-dom'
import type { WebGameLobby, WebGameLobbyPhase } from '../lib/api'
import { PlayerBar } from './ui'

const PHASE: Record<WebGameLobbyPhase, { orb: string; text: string; label: string }> = {
  'picking-loadout': { orb: 'orb-hub', text: 'text-arcane/90', label: 'Choosing loadout' },
  hub: { orb: 'orb-hub', text: 'text-arcane/90', label: 'In the College' },
  session: { orb: 'orb-on', text: 'text-moss', label: 'In a Boneyard' },
}

export default function WebGameLobbyTable({ lobbies }: { lobbies: WebGameLobby[] }) {
  return (
    <div className="space-y-2" aria-label="Web Rebuild Playtest lobbies">
      {lobbies.map((lobby) => {
        const phase = PHASE[lobby.phase]
        const full = lobby.players >= lobby.maxPlayers
        return (
          <article
            key={lobby.id}
            className="slab rounded px-4 py-3"
            data-web-game-lobby={lobby.id}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className={`orb flex-none ${phase.orb}`} />
              <span className={`text-xs ${phase.text}`}>{phase.label}</span>
              <strong className="font-display text-[13px] tracking-wide text-bone">
                {lobby.hostPlayer}
              </strong>
              <span className="badge badge-arcane" title={lobby.protocol}>WEB TEST</span>
              <span className="ml-auto">
                <PlayerBar players={lobby.players} max={lobby.maxPlayers} />
              </span>
              {full ? (
                <span className="btn btn-ghost pointer-events-none opacity-45">Full</span>
              ) : (
                <Link
                  to={`/game?party=${encodeURIComponent(lobby.id)}`}
                  className="btn btn-gold"
                >
                  Join Game
                </Link>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
