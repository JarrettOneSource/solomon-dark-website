import assert from 'node:assert/strict'
import test from 'node:test'

import type { GameClientSnapshot } from '../protocol/game-state.ts'
import type { LuaConsoleObject } from '../protocol/codecs/lua.ts'
import {
  createModSkillQuickbarKeyboardController,
  type ModSkillQuickbarSession,
  type ModSkillQuickbarSlot,
} from './mod-skill-quickbar-keyboard.ts'

class CountingKeyboardTarget {
  readonly added: EventListener[] = []
  readonly listeners = new Set<EventListener>()
  adds = 0
  removes = 0

  addEventListener(type: string, listener: EventListener): void {
    assert.equal(type, 'keydown')
    this.adds += 1
    this.added.push(listener)
    this.listeners.add(listener)
  }

  removeEventListener(type: string, listener: EventListener): void {
    assert.equal(type, 'keydown')
    this.removes += 1
    this.listeners.delete(listener)
  }

  dispatch(event: FakeKeyboardEvent): void {
    for (const listener of this.listeners) listener(event as unknown as Event)
  }
}

class FakeKeyboardEvent {
  defaultPrevented = false
  readonly altKey: boolean
  readonly ctrlKey: boolean
  readonly key: string
  readonly metaKey: boolean
  readonly repeat: boolean
  readonly shiftKey: boolean

  constructor(
    key: string,
    shiftKey: boolean,
    ctrlKey = false,
    altKey = false,
    metaKey = false,
    repeat = false,
  ) {
    this.altKey = altKey
    this.ctrlKey = ctrlKey
    this.key = key
    this.metaKey = metaKey
    this.repeat = repeat
    this.shiftKey = shiftKey
  }

  preventDefault(): void {
    this.defaultPrevented = true
  }
}

interface RecordedCast {
  readonly contentId: string
  readonly target: { x: number; y: number }
}

function session(playerId: string, x: number, y: number, casts: RecordedCast[]): ModSkillQuickbarSession {
  return {
    castModSpell(contentId, target) {
      casts.push({ contentId, target: { ...target } })
    },
    getSnapshot() {
      return {
        players: {
          [playerId]: {
            headingIndex: 0,
            position: { x, y },
          },
        },
      } as unknown as GameClientSnapshot
    },
    playerId,
  }
}

function slot(index: number, contentId: string): ModSkillQuickbarSlot {
  const spell: LuaConsoleObject = { content_id: contentId }
  return { slot: index, spell }
}

test('quickbar keyboard listener follows real runtime, session, and unmount lifetimes', () => {
  const target = new CountingKeyboardTarget()
  const firstCasts: RecordedCast[] = []
  const secondCasts: RecordedCast[] = []
  const first = session('first', 10, 20, firstCasts)
  const second = session('second', 50, 60, secondCasts)
  const keyboard = createModSkillQuickbarKeyboardController(target)

  keyboard.update(first, [])
  keyboard.update(first, [])
  assert.deepEqual({ adds: target.adds, removes: target.removes }, { adds: 0, removes: 0 })

  keyboard.update(first, [slot(0, 'fire')])
  assert.deepEqual({ adds: target.adds, removes: target.removes }, { adds: 1, removes: 0 })
  keyboard.update(first, [slot(1, 'water')])
  assert.deepEqual(
    { adds: target.adds, removes: target.removes },
    { adds: 1, removes: 0 },
    'a non-empty runtime update only replaces current listener data',
  )

  const oldBinding = new FakeKeyboardEvent('1', true)
  target.dispatch(oldBinding)
  assert.equal(oldBinding.defaultPrevented, false)
  const updatedBinding = new FakeKeyboardEvent('2', true)
  target.dispatch(updatedBinding)
  assert.equal(updatedBinding.defaultPrevented, true)
  assert.deepEqual(firstCasts, [{ contentId: 'water', target: { x: 10, y: -280 } }])

  for (const event of [
    new FakeKeyboardEvent('2', false),
    new FakeKeyboardEvent('2', true, true),
    new FakeKeyboardEvent('2', true, false, true),
    new FakeKeyboardEvent('2', true, false, false, true),
    new FakeKeyboardEvent('2', true, false, false, false, true),
  ]) target.dispatch(event)
  assert.equal(firstCasts.length, 1, 'repeat and modifier admission remains unchanged')

  keyboard.update(second, [slot(0, 'earth')])
  assert.deepEqual({ adds: target.adds, removes: target.removes }, { adds: 2, removes: 1 })
  assert.strictEqual(target.added[0], target.added[1], 'session switches reuse the stable handler')
  const switched = new FakeKeyboardEvent('1', true)
  target.dispatch(switched)
  assert.deepEqual(secondCasts, [{ contentId: 'earth', target: { x: 50, y: -240 } }])
  assert.equal(firstCasts.length, 1)

  keyboard.update(second, [])
  keyboard.update(second, [])
  assert.deepEqual({ adds: target.adds, removes: target.removes }, { adds: 2, removes: 2 })
  target.dispatch(new FakeKeyboardEvent('1', true))
  assert.equal(secondCasts.length, 1)

  keyboard.update(second, [slot(2, 'air')])
  assert.deepEqual({ adds: target.adds, removes: target.removes }, { adds: 3, removes: 2 })
  keyboard.destroy()
  keyboard.destroy()
  assert.deepEqual({ adds: target.adds, removes: target.removes }, { adds: 3, removes: 3 })
  assert.equal(target.listeners.size, 0)
})
