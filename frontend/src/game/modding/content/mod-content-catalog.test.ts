import assert from 'node:assert/strict'
import test from 'node:test'

import { PreparedModAssetCatalog } from '../assets/index.ts'
import type {
  CompiledWebLuaContent,
  CompiledWebLuaMod,
  WebLuaRuleDefinition,
} from '../definition/index.ts'
import {
  compileModContentCatalog,
  ModStatusEngine,
} from './index.ts'

const identity = Object.freeze({ id: 'example.content', name: 'Content', version: '1.0.0' })
const source = Object.freeze({ column: 1, file: 'scripts/main.lua', line: 1 })
const statusId = '5000000000000000001'
const potionId = '5000000000000000002'
const onUse: WebLuaRuleDefinition = Object.freeze({
  fields: Object.freeze({ nodes: Object.freeze([]) }),
  kind: 'rule-definition',
  operation: 'rules.all',
  source,
})

test('content catalog projects every family and builds deterministic consumables and loot', () => {
  const catalog = compileModContentCatalog([compiled([
    content('status', 'invincible', statusId, {
      duration: '100ms',
      modifiers: { incoming_damage: 0, mana_spend: 0 },
      stacking: 'refresh',
    }),
    content('potion', 'invincibility_potion', potionId, {
      art: { icon: { key: 'icon', kind: 'asset-reference' } },
      description: 'Invincible for a moment.',
      duration: '100ms',
      loot: { boss: 1, ordinary: 1 },
      name: 'Invincibility Potion',
      on_use: onUse,
      status: {
        contentId: statusId,
        key: 'invincible',
        kind: 'resolved-content-reference',
        modId: identity.id,
        targetKind: 'status',
      },
    }),
    content('item', 'ash_shard', '5000000000000000003', {
      art: { icon: { key: 'icon', kind: 'asset-reference' } },
      name: 'Ash Shard',
      stack: { maximum: 99 },
    }),
    ...(['skill', 'powerup', 'affix', 'affix-pool', 'spell', 'enemy', 'boneyard', 'shop', 'ui', 'room', 'scene', 'scene-extension'] as const)
      .map((kind, index) => content(kind, `${kind}-${index}`, `${5_100_000_000_000_000_000n + BigInt(index)}`, {})),
  ])], assets())

  assert.equal(catalog.all().length, 15)
  assert.equal(catalog.consumables().length, 1)
  assert.equal(catalog.consumables()[0]?.nativeSubtype, 6)
  assert.equal(catalog.consumables()[0]?.content.icon.imagePath, 'art/icon.png')
  assert.equal(catalog.potion(potionId)?.status?.contentId, statusId)
  assert.equal(catalog.items()[0]?.content.stackMaximum, 99)
  assert.equal(catalog.createLootItems(7, false)[0]?.modContent?.contentId, potionId)
})

test('status engine refreshes participant state, filters damage and spend, checkpoints, and expires', () => {
  const catalog = compileModContentCatalog([compiled([
    content('status', 'invincible', statusId, {
      duration: '100ms',
      modifiers: { incoming_damage: 0, mana_spend: { multiply: 0 } },
      stacking: 'refresh',
    }),
  ])], new PreparedModAssetCatalog([]))
  const statuses = new ModStatusEngine(catalog, 100)

  assert.equal(statuses.apply(statusId, 'player-1', 10), true)
  assert.equal(statuses.filterDamage('player-1', 25, 11), 0)
  assert.equal(statuses.filterMana('player-1', -30, 11), -0)
  assert.equal(statuses.filterDamage('player-2', 25, 11), 25)
  assert.equal(statuses.apply(statusId, 'player-1', 15), true)
  assert.equal(statuses.project('player-1').length, 1)
  assert.equal(statuses.project('player-1')[0]?.expiresTick, 25)

  const checkpoint = statuses.checkpoint()
  assert.equal(statuses.tick(25), 1)
  assert.equal(statuses.project().length, 0)
  statuses.restore(checkpoint)
  assert.equal(statuses.project().length, 1)
})

function content(
  contentKind: CompiledWebLuaContent['contentKind'],
  key: string,
  contentId: string,
  fields: CompiledWebLuaContent['fields'],
): CompiledWebLuaContent {
  return { contentId, contentKind, fields, key }
}

function compiled(content: readonly CompiledWebLuaContent[]): CompiledWebLuaMod {
  return {
    apiVersion: '1.0.0',
    assets: [],
    canonicalJson: '{}',
    capabilities: [],
    content,
    graphSha256: '0'.repeat(64),
    identity,
    reducers: [],
    rules: [],
  }
}

function assets(): PreparedModAssetCatalog {
  return new PreparedModAssetCatalog([{
    animations: {},
    assetKind: 'sprite',
    frames: [{
      centerOffsetX: 0,
      centerOffsetY: 0,
      contentHeight: 50,
      contentWidth: 53,
      height: 50,
      logicalHeight: 50,
      logicalWidth: 53,
      width: 53,
      x: 0,
      y: 0,
    }],
    height: 50,
    id: `${identity.id}:icon`,
    key: 'icon',
    kind: 'image',
    modId: identity.id,
    path: 'art/icon.png',
    sha256: '1'.repeat(64),
    width: 53,
  }])
}
