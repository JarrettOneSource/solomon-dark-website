import { useEffect, useState } from 'react'

import type { GameClientSession } from '../client/game-client-session.ts'
import { gameContentUrl } from '../game-content-cache.ts'
import type { LuaConsoleObject } from '../protocol/game-protocol.ts'
import './mod-skill-picker.css'

export default function ModSkillPicker({
  nativeOfferSequence,
  session,
}: Readonly<{ nativeOfferSequence: number; session: GameClientSession }>) {
  const [runtime, setRuntime] = useState<LuaConsoleObject | null>(() => session.getModRuntime())
  useEffect(() => session.onModRuntime(setRuntime), [session])
  const offer = rows(runtime?.skill_offers).find(row => row.player_id === session.playerId)
  if (!offer) return null
  const offeredIds = strings(offer.content_ids)
  const skills = rows(runtime?.skills).filter(skill => offeredIds.includes(text(skill.content_id)))
  const modOfferSequence = integer(offer.sequence)
  if (skills.length === 0 || modOfferSequence < 1) return null
  return (
    <aside className="mod-skill-picker" aria-label="Mod skill choices">
      <h2>Mod skills</h2>
      <div className="mod-skill-picker__choices">
        {skills.map(skill => {
          const icon = assetUrl(session, text(skill.mod_id), text(skill.icon_path))
          return (
            <button key={text(skill.content_id)} onClick={() => session.sendModAction(
              'skill-choose',
              text(skill.content_id),
              {
                mod_offer_sequence: modOfferSequence,
                native_offer_sequence: nativeOfferSequence,
              },
            )}>
              {icon ? <img alt="" src={icon} /> : null}
              <span>{text(skill.name)}</span>
              <small>{text(skill.description) || `Rank ${rank(runtime, skill) + 1}`}</small>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function rank(runtime: LuaConsoleObject | null, skill: LuaConsoleObject): number {
  return integer(rows(runtime?.skill_ranks).find(row => (
    row.content_id === skill.content_id
  ))?.rank)
}

function assetUrl(session: GameClientSession, modId: string, path: string): string | null {
  const asset = session.modAssets.find(candidate => (
    candidate.modId === modId && candidate.path === path && candidate.kind === 'image'
  ))
  return asset ? gameContentUrl(asset) : null
}

function rows(value: unknown): LuaConsoleObject[] {
  return Array.isArray(value) ? value.filter((entry): entry is LuaConsoleObject => (
    Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))
  )) : []
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function integer(value: unknown): number {
  return Number.isSafeInteger(value) ? Number(value) : 0
}
