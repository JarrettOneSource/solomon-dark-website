import assert from 'node:assert/strict'
import test from 'node:test'

import type { WebLuaSchemaDefinition } from '../definition/index.ts'
import { ModStateStore } from './mod-state-store.ts'

const SOURCE = Object.freeze({ column: 0, file: 'scripts/main.lua', line: 0 })
const INTEGER = schema('integer', { default: 0, min: 0, max: 99 })
const PHASE = schema('enum', { values: ['normal', 'enraged'] })
const STATE = schema('object', { fields: { count: INTEGER, phase: PHASE } })

test('state cells isolate scopes, transact revisions, checkpoint, and close', () => {
  const store = new ModStateStore()
  const definition = {
    key: 'progress',
    modId: 'example.mod',
    schema: STATE,
    schemaVersion: 1,
    scope: 'participant-run',
  } as const
  const firstScope = { id: 'run-1:player-1', kind: 'participant-run' } as const
  const secondScope = { id: 'run-1:player-2', kind: 'participant-run' } as const
  const first = store.cell(definition, firstScope)
  const second = store.cell(definition, secondScope)

  assert.deepEqual(first.get(), { count: 0, phase: 'normal' })
  assert.deepEqual(first.update(value => ({
    ...(value as Record<string, unknown>),
    count: 1,
  })), { revision: 1, value: { count: 1, phase: 'normal' } })
  assert.deepEqual(second.get(), { count: 0, phase: 'normal' })
  assert.equal(store.snapshot().cells.length, 2)
  assert.equal(store.closeScope(firstScope), 1)
  assert.throws(() => first.get(), /stale/)
  assert.deepEqual(second.get(), { count: 0, phase: 'normal' })
  store.close()
  assert.throws(() => second.get(), /closed/)
})

test('invalid state update rolls back without advancing revision', () => {
  const store = new ModStateStore()
  const cell = store.cell({
    key: 'progress',
    modId: 'example.mod',
    schema: STATE,
    schemaVersion: 1,
    scope: 'party-run',
  }, { id: 'run-1', kind: 'party-run' })
  assert.throws(() => cell.set({ count: 100, phase: 'normal' }), /outside 0\.\.99/)
  assert.equal(store.revision, 0)
  assert.deepEqual(cell.get(), { count: 0, phase: 'normal' })
})

test('checkpoint restoration runs every pure migration transactionally', () => {
  const previous = new ModStateStore()
  const oldDefinition = {
    key: 'progress',
    modId: 'example.mod',
    schema: schema('object', { fields: { count: INTEGER } }),
    schemaVersion: 1,
    scope: 'party-run',
  } as const
  previous.cell(oldDefinition, { id: 'run-1', kind: 'party-run' }).set({ count: 7 })
  const checkpoint = previous.snapshot()

  const next = new ModStateStore()
  const currentDefinition = {
    key: 'progress',
    migrations: {
      1: value => ({
        count: (value as { count: number }).count,
        phase: 'normal',
      }),
    },
    modId: 'example.mod',
    schema: STATE,
    schemaVersion: 2,
    scope: 'party-run',
  } as const
  next.restore(checkpoint, [currentDefinition])
  assert.deepEqual(
    next.cell(currentDefinition, { id: 'run-1', kind: 'party-run' }).get(),
    { count: 7, phase: 'normal' },
  )

  const invalid = new ModStateStore()
  assert.throws(() => invalid.restore(checkpoint, [{
    ...currentDefinition,
    migrations: { 1: () => ({ count: 200, phase: 'normal' }) },
  }]), /outside 0\.\.99/)
  assert.equal(invalid.snapshot().cells.length, 0)
})

test('rollback removes new cells and restores prior values and revision', () => {
  const store = new ModStateStore()
  const definition = {
    key: 'progress',
    modId: 'example.mod',
    schema: STATE,
    schemaVersion: 1,
    scope: 'party-run',
  } as const
  const first = store.cell(definition, { id: 'run-1', kind: 'party-run' })
  first.set({ count: 3, phase: 'normal' })
  const checkpoint = store.snapshot()
  first.set({ count: 4, phase: 'enraged' })
  store.cell(definition, { id: 'run-2', kind: 'party-run' }).set({ count: 8, phase: 'normal' })

  store.rollback(checkpoint)
  assert.equal(store.revision, checkpoint.revision)
  assert.deepEqual(first.get(), { count: 3, phase: 'normal' })
  assert.equal(store.snapshot().cells.length, 1)
})

function schema(
  schemaKind: string,
  fields: WebLuaSchemaDefinition['fields'],
): WebLuaSchemaDefinition {
  return { fields, kind: 'schema-definition', schemaKind, source: SOURCE }
}
