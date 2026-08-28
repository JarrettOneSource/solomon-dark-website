import assert from 'node:assert/strict'
import test from 'node:test'

import {
  compileWebLuaDefinition,
  DEFAULT_WEB_LUA_DEFINITION_LIMITS,
  stableWebLuaContentId,
  WebLuaDefinitionError,
  WEB_LUA_DEFINITION_API_VERSION,
  type WebLuaContentDefinition,
  type WebLuaContentReference,
  type WebLuaModDefinition,
} from './index.ts'

const IDENTITY = Object.freeze({
  id: 'canary.lua.invincibility_potion',
  name: 'Invincibility Potion',
  version: '1.0.0',
})
const SOURCE = Object.freeze({ column: 1, file: 'scripts/main.lua', line: 1 })

test('content identity preserves the Invincibility Potion fixed vector', () => {
  assert.equal(
    stableWebLuaContentId(IDENTITY.id, 'invincibility_potion'),
    '8068156596081641415',
  )
})

test('compiler resolves local references and canonicalizes definition ordering', () => {
  const status = content('status', 'invincible', {
    duration: '3m',
    modifiers: { mana_spend: 0, incoming_damage: 0 },
  })
  const potion = content('potion', 'invincibility_potion', {
    description: 'Three minutes of invincibility.',
    duration: '3m',
    name: 'Invincibility Potion',
    on_use: {
      fields: { status: reference('status', 'invincible'), target: 'user' },
      kind: 'rule-definition',
      operation: 'effect.status',
      source: SOURCE,
    },
    status: reference('status', 'invincible'),
  })
  const first = compileWebLuaDefinition(IDENTITY, definition([potion, status]))
  const second = compileWebLuaDefinition(IDENTITY, definition([
    content('status', 'invincible', {
      modifiers: { incoming_damage: 0, mana_spend: 0 },
      duration: '3m',
    }),
    potion,
  ]))

  assert.equal(first.graphSha256, second.graphSha256)
  assert.equal(first.canonicalJson, second.canonicalJson)
  assert.deepEqual(first.content.map(({ key }) => key), [
    'invincibility_potion',
    'invincible',
  ])
  assert.deepEqual(first.content[0]?.fields.status, {
    contentId: stableWebLuaContentId(IDENTITY.id, 'invincible'),
    key: 'invincible',
    kind: 'resolved-content-reference',
    modId: IDENTITY.id,
    targetKind: 'status',
  })
  assert.deepEqual(first.capabilities, ['content.potion', 'content.status', 'effect.status'])
})

test('compiler reports unresolved and cross-kind duplicate content together', () => {
  assert.throws(
    () => compileWebLuaDefinition(IDENTITY, definition([
      content('item', 'same_key', {}),
      content('spell', 'same_key', {
        status: reference('status', 'missing'),
      }),
    ])),
    (error: unknown) => {
      assert.ok(error instanceof WebLuaDefinitionError)
      assert.ok(error.issues.some(({ code }) => code === 'E_DUPLICATE'))
      assert.ok(error.issues.some(({ code }) => code === 'E_REFERENCE'))
      return true
    },
  )
})

test('compiler rejects local content cycles', () => {
  assert.throws(
    () => compileWebLuaDefinition(IDENTITY, definition([
      content('status', 'first', { next: reference('status', 'second') }),
      content('status', 'second', { next: reference('status', 'first') }),
    ])),
    (error: unknown) => {
      assert.ok(error instanceof WebLuaDefinitionError)
      assert.ok(error.issues.some(({ code, message }) => (
        code === 'E_CYCLE' && message.includes('first -> second -> first')
      )))
      return true
    },
  )
})

test('compiler rejects two exclusive claims on the same stock mount', () => {
  assert.throws(
    () => compileWebLuaDefinition(IDENTITY, definition([
      content('shop', 'first_shop', {
        mount: { anchor: 'trader_extension_east', scene: 'hub.courtyard' },
      }),
      content('shop', 'second_shop', {
        mount: { anchor: 'trader_extension_east', scene: 'hub.courtyard' },
      }),
    ])),
    (error: unknown) => {
      assert.ok(error instanceof WebLuaDefinitionError)
      assert.ok(error.issues.some(({ code }) => code === 'E_MOUNT_CONFLICT'))
      return true
    },
  )
})

test('compiler enforces graph budgets', () => {
  assert.throws(
    () => compileWebLuaDefinition(IDENTITY, definition([
      content('status', 'first', {}),
      content('status', 'second', {}),
    ]), {
      limits: { ...DEFAULT_WEB_LUA_DEFINITION_LIMITS, maximumContent: 1 },
    }),
    (error: unknown) => {
      assert.ok(error instanceof WebLuaDefinitionError)
      assert.ok(error.issues.some(({ code, path }) => code === 'E_BUDGET' && path === 'content'))
      return true
    },
  )
})

test('compiler rejects inactive 1.0 fields, aliases, and malformed predicates', () => {
  const when = {
    fields: {
      predicate: { contest: 'participant_id' },
      yes: {
        fields: { key: 'ready', value: true },
        kind: 'rule-definition' as const,
        operation: 'effect.state',
        source: SOURCE,
      },
    },
    kind: 'rule-definition' as const,
    operation: 'rules.when',
    source: SOURCE,
  }
  const unknownEvent = {
    fields: {
      event: 'run.start',
      node: {
        fields: { key: 'ready', value: true },
        kind: 'rule-definition' as const,
        operation: 'effect.state',
        source: SOURCE,
      },
    },
    kind: 'rule-definition' as const,
    operation: 'rules.on',
    source: SOURCE,
  }
  assert.throws(
    () => compileWebLuaDefinition(IDENTITY, {
      ...definition([
        content('status', 'stale_status', { scope: 'participant-run', tags: ['old'] }),
        content('skill', 'stale_skill', { max_rank: 1, name: 'Stale', ranks: [{}] }),
      ]),
      rules: [when, unknownEvent],
    }),
    (error: unknown) => {
      assert.ok(error instanceof WebLuaDefinitionError)
      assert.ok(error.issues.some(({ path }) => path.endsWith('.scope')))
      assert.ok(error.issues.some(({ path }) => path.endsWith('.tags')))
      assert.ok(error.issues.some(({ path }) => path.endsWith('.max_rank')))
      assert.ok(error.issues.some(({ message }) => message.includes('exactly one of event or context')))
      assert.ok(error.issues.some(({ message }) => message.includes('unknown event')))
      assert.doesNotMatch(error.message, /scripts\/main\.lua:0/)
      return true
    },
  )
})

function definition(contentDefinitions: readonly WebLuaContentDefinition[]): WebLuaModDefinition {
  return {
    api: WEB_LUA_DEFINITION_API_VERSION,
    assets: [],
    content: contentDefinitions,
    reducers: [],
    rules: [],
  }
}

function content(
  contentKind: WebLuaContentDefinition['contentKind'],
  key: string,
  fields: WebLuaContentDefinition['fields'],
): WebLuaContentDefinition {
  return { contentKind, fields, key, kind: 'content-definition', source: SOURCE }
}

function reference(
  targetKind: WebLuaContentReference['targetKind'],
  key: string,
): WebLuaContentReference {
  return { key, kind: 'content-reference', modId: null, targetKind }
}
