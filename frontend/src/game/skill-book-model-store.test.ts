import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createGameSimulation } from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import {
  freezeNativeBelt,
  nativeBeltPotionProjection,
  NATIVE_BELT_ITEM_TYPE_IDS,
  type NativeBeltEntry,
} from './core-kernels/native-belt.ts'
import { isNativeBeltSkill, NATIVE_SKILL_CATALOG } from './core-kernels/player-progression.ts'
import type { GameSnapshot } from './protocol/game-state.ts'
import { createSkillBookModelStore } from './skill-book-model-store.ts'

const playerId = 'local-player'
const baseline = createGameSnapshot(createGameSimulation(), null)
const player = baseline.players[playerId]!

function fixture() {
  let snapshot = baseline
  const listeners = new Set<() => void>()
  const source = {
    getSnapshot: () => snapshot,
    onSnapshot(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
  return {
    source,
    listeners,
    publish(next: GameSnapshot, notify = true) {
      snapshot = next
      if (notify) for (const listener of listeners) listener()
    },
  }
}

function withPlayer(next: typeof player): GameSnapshot {
  return { ...baseline, players: { [playerId]: next } }
}

test('new optional-book stores read the current player without waiting for another event', () => {
  const { source, publish } = fixture()
  const changed = { ...player, belt: freezeNativeBelt(new Array(8).fill(null)) }
  publish(withPlayer(changed), false)
  const store = createSkillBookModelStore(source, playerId)
  assert.equal(store.getSnapshot()!.belt, changed.belt)
  assert.equal(store.getSnapshot()!.economy, changed.economy)
  assert.equal(store.getSnapshot()!.progression, changed.progression)
})

test('a render-to-subscribe change is visible to the external-store consistency read', () => {
  const { source, publish, listeners } = fixture()
  const store = createSkillBookModelStore(source, playerId)
  const before = store.getSnapshot()
  publish(withPlayer({ ...player, belt: freezeNativeBelt(new Array(8).fill(null)) }), false)
  let notifications = 0
  const unsubscribe = store.subscribe(() => { notifications += 1 })
  assert.equal(notifications, 0, 'source deliberately does not replay')
  assert.notEqual(store.getSnapshot(), before, 'must catch up without another event')
  publish(baseline)
  assert.equal(notifications, 1)
  unsubscribe()
  assert.equal(listeners.size, 0)
  publish(baseline)
  assert.equal(notifications, 1)
})

const entries: NativeBeltEntry[] = [
  { kind: 'health-potion' }, { kind: 'mana-potion' },
  ...NATIVE_BELT_ITEM_TYPE_IDS.map(nativeTypeId => ({ kind: 'item' as const, nativeTypeId, itemId: 20 })),
]
for (let id = 0; id < NATIVE_SKILL_CATALOG.length; id += 1) {
  if (isNativeBeltSkill(id)) entries.push({ kind: 'skill', skillId: id })
}
for (let slot = 0; slot < 8; slot += 1) {
  test(`every entry discriminator, native skill category, duplicate and clear updates slot ${slot}`, () => {
    const { source, publish } = fixture()
    const store = createSkillBookModelStore(source, playerId)
    for (const entry of entries) {
      const nextEntries = new Array<NativeBeltEntry | null>(8).fill(null)
      nextEntries[slot] = entry
      const next = { ...player, belt: freezeNativeBelt(nextEntries) }
      const before = store.getSnapshot()
      publish(withPlayer(next))
      assert.notEqual(store.getSnapshot(), before)
      assert.equal(store.getSnapshot()!.belt, next.belt)
      assert.deepEqual(store.getSnapshot()!.belt[slot], entry)
      if (entry.kind === 'item') {
        nextEntries[slot] = { ...entry, itemId: entry.itemId + 1 }
        publish(withPlayer({ ...next, belt: freezeNativeBelt(nextEntries) }))
        assert.deepEqual(store.getSnapshot()!.belt[slot], nextEntries[slot], 'UID is part of identity')
      }
      nextEntries[(slot + 1) % 8] = entry
      publish(withPlayer({ ...next, belt: freezeNativeBelt(nextEntries) }))
      assert.deepEqual(store.getSnapshot()!.belt[(slot + 1) % 8], entry, 'duplicate legal')
      publish(withPlayer({ ...player, belt: freezeNativeBelt(new Array(8).fill(null)) }))
      assert.equal(store.getSnapshot()!.belt[slot], null)
    }
  })
}

test('unchanged decoded snapshots and movement ticks retain presentation identity', () => {
  const { source, publish } = fixture()
  const store = createSkillBookModelStore(source, playerId)
  const first = store.getSnapshot()
  for (let tick = 1; tick <= 100; tick += 1) {
    const clone = structuredClone(baseline)
    clone.players[playerId]!.position.x += tick
    publish(clone)
    assert.equal(store.getSnapshot(), first)
  }
})

test('economy, element, and every displayed nonrevision progression field invalidate atomically', () => {
  const { source, publish } = fixture()
  const store = createSkillBookModelStore(source, playerId)
  const changes = [
    { revision: player.progression.revision + 1 },
    { selectedPrimarySkillId: 16 }, { weldBuildId: 1000 },
    { concentrationSkillIds: [57, 65] as const },
    { mindChugTicksRemaining: 1 }, { splitMind: !player.progression.splitMind },
    { experience: player.progression.experience + 1 },
    { previousThreshold: player.progression.previousThreshold + 1 },
    { nextThreshold: player.progression.nextThreshold + 1 },
  ]
  for (const change of changes) {
    publish(baseline)
    const before = store.getSnapshot()
    const progression = { ...player.progression, ...change }
    publish(withPlayer({ ...player, progression }))
    assert.notEqual(store.getSnapshot(), before, JSON.stringify(change))
    assert.equal(store.getSnapshot()!.progression, progression)
  }
  const economy = { ...player.economy, revision: player.economy.revision + 1 }
  publish(withPlayer({ ...player, economy, config: { ...player.config, element: 'fire' } }))
  assert.equal(store.getSnapshot()!.economy, economy)
  assert.equal(store.getSnapshot()!.element, 'fire')
  assert.equal(store.getSnapshot()!.progression, player.progression)
})

test('missing and replacement actors never fall back to an earlier actor model', () => {
  const { source, publish } = fixture()
  const first = createSkillBookModelStore(source, playerId)
  const other = createSkillBookModelStore(source, 'other-player')
  assert.ok(first.getSnapshot())
  assert.equal(other.getSnapshot(), null)
  publish({ ...baseline, players: { 'other-player': player } })
  assert.equal(first.getSnapshot(), null)
  assert.ok(other.getSnapshot())
  publish(baseline)
  assert.equal(first.getSnapshot()!.belt, player.belt)
  assert.equal(other.getSnapshot(), null)
})

test('SkillBook reads its external store and publishes one complete memoized renderer model', () => {
  const source = readFileSync(new URL('./SkillBook.tsx', import.meta.url), 'utf8')
  assert.match(source, /useSyncExternalStore\(store\.subscribe, store\.getSnapshot/)
  assert.match(source, /\[presentation, rendererState\]/)
  assert.doesNotMatch(source, /sameSkillBookModel|beltEntriesEqual|initialBelt|initialEconomy/)
  const parent = readFileSync(new URL('./MainMenuScene.tsx', import.meta.url), 'utf8')
  const mount = parent.slice(parent.indexOf('<SkillBook\n'), parent.indexOf('<HudSkillSelector\n'))
  assert.doesNotMatch(mount, /belt=|economy=|progression=|subscribeSnapshot=/)
})


test('recursive potion counts and persistent zero aliases use the same current economy as the belt', () => {
  const { source, publish } = fixture()
  const store = createSkillBookModelStore(source, playerId)
  const mana = player.economy.backpack.find(item => item.kind === 'mana-potion')!
  assert.ok(mana)
  const sack = {
    ...mana, id: 9001, kind: 'sack' as const, name: 'Sack', nativeTypeId: 7008,
    nativeSubtype: 0, iconRecords: [70], quantity: 1,
    contents: [{ ...mana, id: 9002, quantity: 5 }],
  }
  const economy = {
    ...player.economy, revision: player.economy.revision + 1,
    backpack: [{ ...mana, quantity: 7 }, sack],
  }
  publish(withPlayer({ ...player, economy }))
  assert.equal(nativeBeltPotionProjection(store.getSnapshot()!.economy.backpack, 1).count, 12)
  assert.equal(store.getSnapshot()!.belt[4]!.kind, 'mana-potion')
  publish(withPlayer({ ...player, economy: { ...economy, revision: economy.revision + 1, backpack: [] } }))
  assert.equal(nativeBeltPotionProjection(store.getSnapshot()!.economy.backpack, 1).count, 0)
  assert.equal(store.getSnapshot()!.belt[4]!.kind, 'mana-potion')
})
