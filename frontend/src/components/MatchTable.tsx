import type { MatchSession } from '../lib/api'
import { api } from '../lib/api'
import { PlayerBar } from './ui'

export default function MatchTable({ matches }: { matches: MatchSession[] }) {
  return (
    <>
      {/* narrow screens: stacked cards so Connect never hides off-canvas */}
      <div className="space-y-2 md:hidden">
        {matches.map((m) => (
          <div key={m.id} className="slab rounded px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`orb flex-none ${m.status === 'session' ? 'orb-on' : 'orb-hub'}`} />
              <span className={`flex-none text-[10px] uppercase tracking-wider ${m.status === 'session' ? 'text-moss' : 'text-arcane/90'}`}>
                {m.status === 'session' ? 'In session' : 'In hub'}
              </span>
              <span className="truncate font-display text-[13px] font-bold tracking-wide text-bone">
                {m.hostPlayer}
              </span>
              <a
                href={api.matches.joinUrl(m.sessionKey)}
                className="btn btn-gold ml-auto flex-none !px-3 !py-1.5 !text-[10px]"
                title="Opens the SDR loader and joins this match"
              >
                Connect
              </a>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-fell truncate text-[13px] text-gold/85">{m.boneyard}</span>
              <PlayerBar players={m.players} max={m.maxPlayers} />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
      <table className="w-full border-separate border-spacing-y-1.5 text-sm">
        <thead>
          <tr className="text-left font-display text-[10px] uppercase tracking-[0.22em] text-gold/60">
            <th className="px-3 py-1 font-bold">Status</th>
            <th className="px-3 py-1 font-bold">Host</th>
            <th className="px-3 py-1 font-bold">Boneyard</th>
            <th className="px-3 py-1 font-bold">Wizards</th>
            <th className="px-3 py-1" />
          </tr>
        </thead>
        <tbody>
          {matches.map((m) => (
            <tr key={m.id} className="group">
              <td className="slab rounded-l border-r-0 px-3 py-2.5">
                <span className="flex items-center gap-2">
                  <span className={`orb ${m.status === 'session' ? 'orb-on' : 'orb-hub'}`} />
                  <span className={`text-xs ${m.status === 'session' ? 'text-moss' : 'text-arcane/90'}`}>
                    {m.status === 'session' ? 'In session' : 'In hub'}
                  </span>
                </span>
              </td>
              <td className="slab border-x-0 px-3 py-2.5">
                <span className="font-display text-[13px] font-bold tracking-wide text-bone group-hover:text-gold-bright">
                  {m.hostPlayer}
                </span>
              </td>
              <td className="slab border-x-0 px-3 py-2.5">
                <span className="text-fell text-[13px] text-gold/85">{m.boneyard}</span>
              </td>
              <td className="slab border-x-0 px-3 py-2.5">
                <PlayerBar players={m.players} max={m.maxPlayers} />
              </td>
              <td className="slab rounded-r border-l-0 px-3 py-2">
                <a
                  href={api.matches.joinUrl(m.sessionKey)}
                  className="btn btn-gold !px-3.5 !py-2 !text-[10px]"
                  title="Opens the SDR loader and joins this match"
                >
                  Connect
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  )
}
