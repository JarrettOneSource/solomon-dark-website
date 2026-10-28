import { actorHeadingVector } from '../core-kernels/actor-heading.ts'
import type { GameClientSession } from '../client/game-client-session.ts'
import type { LuaConsoleObject } from '../protocol/codecs/lua.ts'

export interface ModSkillQuickbarSlot {
  readonly slot: number
  readonly spell: LuaConsoleObject
}

export type ModSkillQuickbarSession = Pick<
  GameClientSession,
  'castModSpell' | 'getSnapshot' | 'playerId'
>

interface KeyboardTarget {
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

export interface ModSkillQuickbarKeyboardController {
  destroy(): void
  update(
    session: ModSkillQuickbarSession,
    slots: readonly ModSkillQuickbarSlot[],
  ): void
}

interface CurrentQuickbar {
  readonly session: ModSkillQuickbarSession | null
  readonly slots: readonly ModSkillQuickbarSlot[]
}

const EMPTY_QUICKBAR: CurrentQuickbar = { session: null, slots: [] }

export function castModSkillQuickbarSpell(
  session: ModSkillQuickbarSession,
  spell: LuaConsoleObject,
): void {
  const player = session.getSnapshot().players[session.playerId]
  if (!player) return
  const heading = actorHeadingVector(player.headingIndex)
  session.castModSpell(text(spell.content_id), {
    x: player.position.x + heading.x * 300,
    y: player.position.y + heading.y * 300,
  })
}

export function createModSkillQuickbarKeyboardController(
  target: KeyboardTarget,
): ModSkillQuickbarKeyboardController {
  let current = EMPTY_QUICKBAR
  let listening = false
  const keyDown: EventListener = (source) => {
    const event = source as KeyboardEvent
    if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey || event.repeat) return
    const slot = Number(event.key) - 1
    const selected = current.slots.find(row => row.slot === slot)
    if (!selected || !current.session) return
    event.preventDefault()
    castModSkillQuickbarSpell(current.session, selected.spell)
  }
  const setListening = (nextListening: boolean) => {
    if (listening === nextListening) return
    listening = nextListening
    if (listening) target.addEventListener('keydown', keyDown)
    else target.removeEventListener('keydown', keyDown)
  }

  return {
    destroy() {
      current = EMPTY_QUICKBAR
      setListening(false)
    },
    update(session, slots) {
      const sessionChanged = current.session !== null && current.session !== session
      current = { session, slots }
      if (sessionChanged) setListening(false)
      setListening(slots.length > 0)
    },
  }
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
