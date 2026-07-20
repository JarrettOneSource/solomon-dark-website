import type { Lobby, LobbyGame, LobbyPhase, PrivateClass } from '../lib/api'
import { formatDuration } from '../lib/format'
import { PlayerBar } from './ui'

const PHASE: Record<LobbyPhase, { orb: string; text: string; label: string }> = {
  hub: { orb: 'orb-hub', text: 'text-arcane/90', label: 'In hub' },
  loading: { orb: 'orb-hub', text: 'text-arcane/90', label: 'Loading in' },
  session: { orb: 'orb-on', text: 'text-moss', label: 'In session' },
  results: { orb: '', text: 'text-bone-dim', label: 'Wrapping up' },
}

const VEIL_TITLE = 'Friends Only — warded to the host’s Steam circle'

type Row =
  | { kind: 'listed'; lobby: Lobby }
  | { kind: 'veiled'; players: number; maxPlayers: number; key: string }

// Both lists arrive sorted by attendance; veiled classes take their honest
// place in that order, with listed (joinable) classes winning ties.
function mergeRows(lobbies: Lobby[], veiled: PrivateClass[]): Row[] {
  const rows: Row[] = []
  let i = 0
  let j = 0
  while (i < lobbies.length || j < veiled.length) {
    if (i < lobbies.length && (j >= veiled.length || veiled[j].players <= lobbies[i].players)) {
      rows.push({ kind: 'listed', lobby: lobbies[i] })
      i += 1
    } else {
      rows.push({ kind: 'veiled', ...veiled[j], key: `veiled-${j}` })
      j += 1
    }
  }
  return rows
}

function gameDetail(game: LobbyGame): string | null {
  const bits: string[] = []
  if (game.wave != null) bits.push(`Wave ${game.wave}`)
  if (game.difficulty) bits.push(game.difficulty)
  if (game.elapsedSeconds != null) bits.push(formatDuration(game.elapsedSeconds))
  return bits.length > 0 ? bits.join(' · ') : game.statusText
}

function AccessBadge({ lobby }: { lobby: Lobby }) {
  if (lobby.access === 'password') {
    return (
      <span className="badge badge-gold" title="Warded — a password opens the door">
        Password
      </span>
    )
  }
  if (lobby.access === 'friend') {
    return (
      <span className="badge badge-arcane" title="Friends Only — visible because the host counts you among theirs">
        Friends
      </span>
    )
  }
  return null
}

function VeiledBadge() {
  return (
    <span className="badge badge-necro" title={VEIL_TITLE}>
      Private
    </span>
  )
}

function JoinAction({ lobby, onKnock, compact }: { lobby: Lobby; onKnock: (lobby: Lobby) => void; compact?: boolean }) {
  const cls = compact ? 'btn btn-gold !px-3 !py-1.5 !text-[10px]' : 'btn btn-gold !px-3.5 !py-2 !text-[10px]'
  if (lobby.join) {
    return (
      <a href={lobby.join.launchUri} className={cls} title="Opens Solomon Dark and joins this lobby">
        Connect
      </a>
    )
  }
  return (
    <button
      type="button"
      onClick={() => onKnock(lobby)}
      className={cls}
      title="This class is warded — knock and whisper the password"
    >
      Knock
    </button>
  )
}

export default function LobbyTable({
  lobbies,
  veiled = [],
  onKnock,
}: {
  lobbies: Lobby[]
  veiled?: PrivateClass[]
  onKnock: (lobby: Lobby) => void
}) {
  const rows = mergeRows(lobbies, veiled)
  return (
    <>
      {/* narrow screens: stacked cards so the join action never hides off-canvas */}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => {
          if (row.kind === 'veiled') {
            return (
              <div key={row.key} className="slab rounded px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="orb orb-veiled flex-none" />
                  <span className="flex-none text-[10px] uppercase tracking-wider text-[#d9a1f2]/90">
                    Veiled
                  </span>
                  <span className="text-fell truncate text-[13px] italic text-bone-dim">
                    A discreet tutor
                  </span>
                  <span className="ml-auto flex-none text-[10px] uppercase tracking-wider text-bone-dim/50">
                    Invitation only
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-fell min-w-0 truncate text-[13px] text-bone-dim/70">
                    Undisclosed grounds
                  </span>
                  <span className="flex flex-none items-center gap-2">
                    <VeiledBadge />
                    <PlayerBar players={row.players} max={row.maxPlayers} />
                  </span>
                </div>
              </div>
            )
          }
          const { lobby } = row
          const phase = PHASE[lobby.game.phase]
          const detail = gameDetail(lobby.game)
          return (
            <div key={lobby.id} className="slab rounded px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={`orb flex-none ${phase.orb}`} />
                <span className={`flex-none text-[10px] uppercase tracking-wider ${phase.text}`}>
                  {phase.label}
                </span>
                <span className="truncate font-display text-[13px] font-bold tracking-wide text-bone">
                  {lobby.hostPlayer}
                </span>
                <span className="ml-auto flex-none">
                  <JoinAction lobby={lobby} onKnock={onKnock} compact />
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="text-fell block truncate text-[13px] text-gold/85">
                    {lobby.game.boneyardName ?? '—'}
                  </span>
                  {detail && (
                    <span className="block truncate text-[11px] text-bone-dim/80">{detail}</span>
                  )}
                </span>
                <span className="flex flex-none items-center gap-2">
                  <AccessBadge lobby={lobby} />
                  <PlayerBar players={lobby.players} max={lobby.maxPlayers} />
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-y-1.5 text-sm">
          <thead>
            <tr className="text-left font-display text-[10px] uppercase tracking-[0.22em] text-gold/60">
              <th className="px-3 py-1 font-bold">Status</th>
              <th className="px-3 py-1 font-bold">Host</th>
              <th className="px-3 py-1 font-bold">Boneyard</th>
              <th className="px-3 py-1 font-bold">Wizards</th>
              <th className="px-3 py-1 font-bold">Door</th>
              <th className="px-3 py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.kind === 'veiled') {
                return (
                  <tr key={row.key}>
                    <td className="slab rounded-l border-r-0 px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        <span className="orb orb-veiled" />
                        <span className="text-xs text-[#d9a1f2]/90">Veiled</span>
                      </span>
                    </td>
                    <td className="slab border-x-0 px-3 py-2.5">
                      <span className="text-fell text-[13px] italic text-bone-dim">
                        A discreet tutor
                      </span>
                    </td>
                    <td className="slab border-x-0 px-3 py-2.5">
                      <span className="text-fell block text-[13px] text-bone-dim/70">
                        Undisclosed grounds
                      </span>
                    </td>
                    <td className="slab border-x-0 px-3 py-2.5">
                      <PlayerBar players={row.players} max={row.maxPlayers} />
                    </td>
                    <td className="slab border-x-0 px-3 py-2.5">
                      <VeiledBadge />
                    </td>
                    <td className="slab rounded-r border-l-0 px-3 py-2">
                      <span className="text-[10px] uppercase tracking-wider text-bone-dim/50">
                        Invitation only
                      </span>
                    </td>
                  </tr>
                )
              }
              const { lobby } = row
              const phase = PHASE[lobby.game.phase]
              const detail = gameDetail(lobby.game)
              return (
                <tr key={lobby.id} className="group">
                  <td className="slab rounded-l border-r-0 px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className={`orb ${phase.orb}`} />
                      <span className={`text-xs ${phase.text}`}>{phase.label}</span>
                    </span>
                  </td>
                  <td className="slab border-x-0 px-3 py-2.5">
                    <span className="font-display text-[13px] font-bold tracking-wide text-bone group-hover:text-gold-bright">
                      {lobby.hostPlayer}
                    </span>
                  </td>
                  <td className="slab border-x-0 px-3 py-2.5">
                    <span className="text-fell block text-[13px] text-gold/85">
                      {lobby.game.boneyardName ?? '—'}
                    </span>
                    {detail && <span className="block text-[11px] text-bone-dim/80">{detail}</span>}
                  </td>
                  <td className="slab border-x-0 px-3 py-2.5">
                    <PlayerBar players={lobby.players} max={lobby.maxPlayers} />
                  </td>
                  <td className="slab border-x-0 px-3 py-2.5">
                    {lobby.access === 'public' ? (
                      <span className="text-xs text-bone-dim/60">Open</span>
                    ) : (
                      <AccessBadge lobby={lobby} />
                    )}
                  </td>
                  <td className="slab rounded-r border-l-0 px-3 py-2">
                    <JoinAction lobby={lobby} onKnock={onKnock} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
