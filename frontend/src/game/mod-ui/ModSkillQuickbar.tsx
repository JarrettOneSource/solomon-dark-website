import {
  useCallback,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react'

import type { GameClientSession } from '../client/game-client-session.ts'
import { gameContentUrl } from '../game-content-cache.ts'
import type {
  LuaConsoleObject,
} from '../protocol/codecs/lua.ts'
import {
  castModSkillQuickbarSpell,
  createModSkillQuickbarKeyboardController,
} from './mod-skill-quickbar-keyboard.ts'
import './mod-skill-quickbar.css'

export default function ModSkillQuickbar({ session }: Readonly<{ session: GameClientSession }>) {
  const subscribeRuntime = useCallback((notify: () => void) => (
    session.onModRuntime(() => notify())
  ), [session])
  const getRuntime = useCallback(() => session.getModRuntime(), [session])
  const runtime = useSyncExternalStore(subscribeRuntime, getRuntime, getRuntime)
  const bindings = rows(runtime?.mod_quickbar).sort((left, right) => integer(left.slot) - integer(right.slot))
  const spells = new Map(rows(runtime?.spells).map(spell => [text(spell.content_id), spell]))
  const slots = bindings.flatMap(binding => {
    const spell = spells.get(text(binding.content_id))
    return spell ? [{ slot: integer(binding.slot), spell }] : []
  })
  const keyboardRef = useRef<ReturnType<
    typeof createModSkillQuickbarKeyboardController
  > | null>(null)
  if (!keyboardRef.current) {
    keyboardRef.current = createModSkillQuickbarKeyboardController(window)
  }
  const keyboard = keyboardRef.current
  useLayoutEffect(() => {
    keyboard.update(session, slots)
  })
  useLayoutEffect(() => () => keyboard.destroy(), [keyboard])
  if (slots.length === 0) return null
  return (
    <nav className="mod-skill-quickbar" aria-label="Mod spell quickbar">
      {slots.map(({ slot, spell }) => {
        const asset = session.modAssets.find(candidate => (
          candidate.modId === spell.mod_id && candidate.path === spell.icon_path && candidate.kind === 'image'
        ))
        return (
          <button
            key={slot}
            onClick={() => castModSkillQuickbarSpell(session, spell)}
            title={`${text(spell.name)} (Shift+${slot + 1})`}
          >
            {asset ? <img alt="" src={gameContentUrl(asset)} /> : null}
            <span>{slot + 1}</span>
          </button>
        )
      })}
    </nav>
  )
}

function rows(value: unknown): LuaConsoleObject[] {
  return Array.isArray(value) ? value.filter((entry): entry is LuaConsoleObject => (
    Boolean(entry && typeof entry === 'object' && !Array.isArray(entry))
  )) : []
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function integer(value: unknown): number {
  return Number.isSafeInteger(value) ? Number(value) : 0
}
