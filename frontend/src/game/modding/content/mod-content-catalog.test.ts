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
  modItemInventoryItem,
  ModAffixEngine,
  ModEnemyEngine,
  ModPowerupEngine,
  ModPortalEngine,
  ModSceneEngine,
  ModSkillEngine,
  ModShopEngine,
  ModSpellEngine,
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
const area: WebLuaRuleDefinition = Object.freeze({
  fields: Object.freeze({ radius: 180 }),
  kind: 'rule-definition',
  operation: 'prefab.area',
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
    content('powerup', 'survey_orb', '5000000000000000004', {
      art: { world: { key: 'icon', kind: 'asset-reference' } },
      effect: onUse,
      name: 'Survey Orb',
      pickup: { radius: 40 },
    }),
    content('affix', 'gravebound', '5000000000000000005', {
      applies_to: ['robe'],
      modifiers: { reflected_damage: { multiply: 0.2 } },
      name: 'Gravebound',
    }),
    content('affix-pool', 'crypt_affixes', '5000000000000000006', {
      applies_to: ['robe'],
      entries: [{
        affix: {
          contentId: '5000000000000000005',
          key: 'gravebound',
          kind: 'resolved-content-reference',
          modId: identity.id,
          targetKind: 'affix',
        },
        weight: 1,
      }],
    }),
    content('skill', 'cartography', '5000000000000000007', {
      art: { icon: { key: 'icon', kind: 'asset-reference' } },
      maximum_rank: 2,
      name: 'Arcane Cartography',
      offer: { minimum_level: 2, weight: 1 },
      ranks: [{ grant: 'minimap' }, { modify: { minimap_range: 1.25 } }],
    }),
    content('spell', 'gravity_well', '5000000000000000008', {
      art: { icon: { key: 'icon', kind: 'asset-reference' } },
      behavior: area,
      cooldown: '1s',
      mana: 30,
      name: 'Gravity Well',
      slot: 'secondary',
      subskills: { event_horizon: { name: 'Event Horizon' } },
    }),
    content('enemy', 'grave_tyrant', '5000000000000000009', {
      art: { atlas: { key: 'icon', kind: 'asset-reference' } },
      base: 'stock.skeleton_mage',
      behavior: area,
      name: 'Grave Tyrant',
      stats: { health: 250, scale: 1.2, speed: 2.5 },
    }),
    content('boneyard', 'obsidian_depths', '5000000000000000010', {
      name: 'Obsidian Depths',
      source: 'levels/obsidian-depths.boneyard',
    }),
    content('shop', 'apothecary', '5000000000000000011', {
      mount: { anchor: 'east', scene: 'hub.courtyard' },
      name: 'Field Apothecary',
      services: [{
        pool: {
          contentId: '5000000000000000006',
          key: 'crypt_affixes',
          kind: 'resolved-content-reference',
          modId: identity.id,
          targetKind: 'affix-pool',
        },
        price: 50,
        type: 'reforge',
      }],
      stock: [{
        item: {
          contentId: '5000000000000000003',
          key: 'ash_shard',
          kind: 'resolved-content-reference',
          modId: identity.id,
          targetKind: 'item',
        },
        price: 10,
      }],
    }),
    content('ui', 'field_minimap', '5000000000000000012', {
      mount: 'hud.top_right',
      view: area,
    }),
    content('room', 'crypt_entry', '5000000000000000013', { geometry: { width: 20 } }),
    content('scene', 'monument_crypt', '5000000000000000014', {
      instance: 'party',
      rooms: [{
        contentId: '5000000000000000013',
        key: 'crypt_entry',
        kind: 'resolved-content-reference',
        modId: identity.id,
        targetKind: 'room',
      }],
    }),
    content('scene-extension', 'monument_portal', '5000000000000000015', {
      features: [area],
      scene: 'stock.boneyard',
    }),
  ])], assets())

  assert.equal(catalog.all().length, 15)
  assert.equal(catalog.consumables().length, 1)
  assert.equal(catalog.consumables()[0]?.nativeSubtype, 6)
  assert.equal(catalog.consumables()[0]?.content.icon.imagePath, 'art/icon.png')
  assert.equal(catalog.potion(potionId)?.status?.contentId, statusId)
  assert.equal(catalog.items()[0]?.content.stackMaximum, 99)
  assert.equal(catalog.powerup('5000000000000000004')?.pickupRadius, 40)
  assert.equal(catalog.affixPool('5000000000000000006')?.entries.length, 1)
  assert.equal(catalog.skill('5000000000000000007')?.maximumRank, 2)
  assert.equal(catalog.spell('5000000000000000008')?.mana, 30)
  assert.equal(catalog.enemy('5000000000000000009')?.health, 250)
  assert.equal(catalog.boneyard('5000000000000000010')?.source, 'levels/obsidian-depths.boneyard')
  assert.equal(catalog.shop('5000000000000000011')?.stock[0]?.price, 10)
  assert.equal(catalog.shop('5000000000000000011')?.services[0]?.price, 50)
  assert.equal(catalog.ui('5000000000000000012')?.mount, 'hud.top_right')
  assert.equal(catalog.scene('5000000000000000014')?.rooms[0]?.contentId, '5000000000000000013')
  assert.equal(catalog.createLootItems(7, false)[0]?.modContent?.contentId, potionId)
})

test('item equipment compiles modder-friendly robe sheets into one existing-slot wearable item', () => {
  const contentId = '5000000000000000090'
  const catalog = compileModContentCatalog([compiled([
    content('item', 'starfall_robe', contentId, {
      art: {
        icon: { key: 'icon', kind: 'asset-reference' },
        icon_trim: { key: 'icon_trim', kind: 'asset-reference' },
        worn: { key: 'worn', kind: 'asset-reference' },
        worn_trim: { key: 'worn_trim', kind: 'asset-reference' },
      },
      equipment: {
        death_shape: 2,
        dyeable: true,
        slot: 'robe',
        tints: { cloth: 0x6688cc, trim: 0xffdd88 },
      },
      name: 'Starfall Robe',
    }),
  ])], wearableAssets(5))
  const definition = catalog.item(contentId)!
  assert.deepEqual(definition.catalog.content.wearable, {
    deathShape: 2,
    dyeable: true,
    slot: 'robe',
    wornImagePath: 'art/worn.png',
    wornTrimImagePath: 'art/worn-trim.png',
  })
  const item = modItemInventoryItem(definition.catalog)
  assert.equal(item.kind, 'equipment')
  assert.equal(item.equipmentType, 'robe')
  assert.deepEqual(item.iconTints, [0x6688cc, 0xffdd88])
  assert.equal(item.modItemContent?.contentId, contentId)
  assert.throws(() => modItemInventoryItem(definition.catalog, 2), /quantity must be one/)
})

test('wearable admission rejects new slots, malformed pose banks, and staff dye layers', () => {
  const definition = (equipment: Record<string, unknown>, art: Record<string, unknown>) => compiled([
    content('item', 'bad_wearable', '5000000000000000091', {
      art,
      equipment,
      name: 'Bad Wearable',
    }),
  ])
  const fullArt = {
    icon: { key: 'icon', kind: 'asset-reference' },
    icon_trim: { key: 'icon_trim', kind: 'asset-reference' },
    worn: { key: 'worn', kind: 'asset-reference' },
    worn_trim: { key: 'worn_trim', kind: 'asset-reference' },
  }
  assert.throws(() => compileModContentCatalog([
    definition({ slot: 'boots' }, fullArt),
  ], wearableAssets(1)), /slot must be hat, robe, or staff/)
  assert.throws(() => compileModContentCatalog([
    definition({ slot: 'hat' }, fullArt),
  ], wearableAssets(2)), /1\.\.1 pose rows/)
  assert.throws(() => compileModContentCatalog([
    definition({ dyeable: true, slot: 'staff' }, fullArt),
  ], wearableAssets(1)), /staff equipment cannot declare dye layers/)
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

test('powerup engine owns spawn identity, strict pickup range, checkpoint, and collection', () => {
  const catalog = compileModContentCatalog([compiled([
    content('powerup', 'survey_orb', '5000000000000000004', {
      art: { world: { key: 'icon', kind: 'asset-reference' } },
      effect: onUse,
      name: 'Survey Orb',
      pickup: { radius: 40 },
    }),
  ])], assets())
  const engine = new ModPowerupEngine(catalog)
  const spawned = engine.spawn('5000000000000000004', 100, 100, 7)
  assert.equal(engine.candidates([{ id: 'far', x: 140, y: 100 }]).length, 0)
  assert.equal(engine.candidates([{ id: 'near', x: 139, y: 100 }])[0]?.playerId, 'near')
  const checkpoint = engine.checkpoint()
  assert.deepEqual(engine.collect(spawned.id, 'near'), {
    contentId: '5000000000000000004',
    playerId: 'near',
  })
  assert.equal(engine.project().length, 0)
  engine.restore(checkpoint)
  assert.equal(engine.project()[0]?.id, spawned.id)
})

test('affix engine rolls applicable weighted pools deterministically without duplicates', () => {
  const catalog = compileModContentCatalog([compiled([
    content('affix', 'gravebound', '5000000000000000005', {
      applies_to: ['robe'],
      modifiers: { reflected_damage: { multiply: 0.2 } },
      name: 'Gravebound',
    }),
    content('affix-pool', 'crypt_affixes', '5000000000000000006', {
      applies_to: ['robe'],
      entries: [{
        affix: {
          contentId: '5000000000000000005',
          key: 'gravebound',
          kind: 'resolved-content-reference',
          modId: identity.id,
          targetKind: 'affix',
        },
        weight: 1,
      }],
      rolls: 2,
    }),
  ])], new PreparedModAssetCatalog([]))
  const engine = new ModAffixEngine(catalog)
  assert.deepEqual(engine.roll('5000000000000000006', 'staff', 7), [])
  assert.deepEqual(engine.roll('5000000000000000006', 'robe', 7).map(row => row.name), [
    'Gravebound',
  ])
  assert.deepEqual(engine.roll('5000000000000000006', 'robe', 7), engine.roll(
    '5000000000000000006',
    'robe',
    7,
  ))
})

test('skill engine builds deterministic eligible offers and persists bounded ranks', () => {
  const catalog = compileModContentCatalog([compiled([
    content('skill', 'cartography', '5000000000000000007', {
      art: { icon: { key: 'icon', kind: 'asset-reference' } },
      maximum_rank: 2,
      name: 'Arcane Cartography',
      offer: { minimum_level: 2, weight: 1 },
      ranks: [{ grant: 'minimap' }, { modify: { minimap_range: 1.25 } }],
    }),
  ])], assets())
  const engine = new ModSkillEngine(catalog)
  assert.equal(engine.offer('player-1', 1, 7).length, 0)
  assert.equal(engine.offer('player-1', 2, 7)[0]?.contentId, '5000000000000000007')
  assert.equal(engine.choose('player-1', '5000000000000000007').rank, 1)
  engine.offer('player-1', 2, 8)
  const checkpoint = engine.checkpoint()
  assert.equal(engine.choose('player-1', '5000000000000000007').rank, 2)
  assert.throws(() => engine.choose('player-1', '5000000000000000007'), /not offered/)
  engine.restore(checkpoint)
  assert.equal(engine.rank('player-1', '5000000000000000007'), 1)
})

test('spell engine admits mana and cooldown atomically and restores cooldown state', () => {
  const catalog = compileModContentCatalog([compiled([
    content('spell', 'gravity_well', '5000000000000000008', {
      art: { icon: { key: 'icon', kind: 'asset-reference' } },
      behavior: area,
      cooldown: '1s',
      mana: 30,
      name: 'Gravity Well',
      slot: 'secondary',
    }),
  ])], assets())
  const engine = new ModSpellEngine(catalog, 100)
  assert.throws(() => engine.admit('player-1', '5000000000000000008', 10, 29), /insufficient/)
  assert.equal(engine.admit('player-1', '5000000000000000008', 10, 30).readyTick, 110)
  const checkpoint = engine.checkpoint()
  assert.throws(() => engine.admit('player-1', '5000000000000000008', 109, 30), /cooling/)
  assert.equal(engine.admit('player-1', '5000000000000000008', 110, 30).manaCost, 30)
  engine.restore(checkpoint)
  assert.equal(engine.project('player-1')[0]?.readyTick, 110)
})

test('enemy engine owns stable spawn, nearest-player movement, damage, and checkpoint', () => {
  const catalog = compileModContentCatalog([compiled([
    content('enemy', 'grave_tyrant', '5000000000000000009', {
      art: { atlas: { key: 'icon', kind: 'asset-reference' } },
      base: 'stock.skeleton_mage',
      behavior: area,
      name: 'Grave Tyrant',
      stats: { health: 250, speed: 2.5 },
    }),
  ])], assets())
  const engine = new ModEnemyEngine(catalog)
  const enemy = engine.spawn('5000000000000000009', 0, 0, 3)
  engine.tick([{ id: 'far', x: 100, y: 0 }, { id: 'near', x: 0, y: 10 }])
  assert.equal(engine.project()[0]?.targetPlayerId, 'near')
  assert.equal(engine.project()[0]?.y, 2.5)
  const checkpoint = engine.checkpoint()
  assert.equal(engine.damage(enemy.id, 250)?.currentHealth, 0)
  assert.equal(engine.project().length, 0)
  engine.restore(checkpoint)
  assert.equal(engine.project()[0]?.currentHealth, 250)
})

test('scene engine owns party epochs, parent stack, return, and checkpoint', () => {
  const catalog = sceneCatalog()
  const engine = new ModSceneEngine(catalog)
  assert.equal(engine.enter('party-1', '5000000000000000014').epoch, 1)
  assert.equal(engine.enter('party-1', '5000000000000000014').parentContentId, '5000000000000000014')
  const checkpoint = engine.checkpoint()
  assert.equal(engine.return('party-1')?.sceneContentId, '5000000000000000014')
  engine.restore(checkpoint)
  assert.equal(engine.project()[0]?.epoch, 2)
})

test('monument portal requires leader confirmation and enters the party scene epoch', () => {
  const portal: WebLuaRuleDefinition = {
    fields: {
      destination: {
        contentId: '5000000000000000014',
        key: 'monument_crypt',
        kind: 'resolved-content-reference',
        modId: identity.id,
        targetKind: 'scene',
      },
      policy: 'leader_confirms',
      prompt: 'Enter the crypt',
      selector: { object_kind: 'monument' },
    },
    kind: 'rule-definition',
    operation: 'prefab.portal',
    source,
  }
  const base = sceneCatalog([content('scene-extension', 'monument_portal', '5000000000000000015', {
    features: [portal],
    scene: 'stock.boneyard',
  })])
  const scenes = new ModSceneEngine(base)
  const portals = new ModPortalEngine(base, scenes)
  const portalId = portals.portals()[0]!.id
  assert.throws(() => portals.activate({
    actorKind: 'monument',
    confirmedByLeader: false,
    ownerId: 'party-1',
    portalId,
    scene: 'stock.boneyard',
  }), /leader confirmation/)
  assert.equal(portals.activate({
    actorKind: 'monument',
    confirmedByLeader: true,
    ownerId: 'party-1',
    portalId,
    scene: 'stock.boneyard',
  }).sceneContentId, '5000000000000000014')
})

test('shop engine validates currency and decrements player-scoped stock', () => {
  const catalog = compileModContentCatalog([compiled([
    content('item', 'ash_shard', '5000000000000000003', {
      art: { icon: { key: 'icon', kind: 'asset-reference' } },
      name: 'Ash Shard',
      stack: { maximum: 99 },
    }),
    content('shop', 'apothecary', '5000000000000000011', {
      name: 'Field Apothecary',
      stock: [{
        item: {
          contentId: '5000000000000000003',
          key: 'ash_shard',
          kind: 'resolved-content-reference',
          modId: identity.id,
          targetKind: 'item',
        },
        price: 10,
        quantity: 2,
      }],
    }),
  ])], assets())
  const engine = new ModShopEngine(catalog)
  assert.throws(() => engine.purchase('player-1', '5000000000000000011', 0, 9), /insufficient/)
  assert.equal(engine.purchase('player-1', '5000000000000000011', 0, 10).price, 10)
  assert.equal(engine.remaining('player-1', '5000000000000000011', 0), 1)
  engine.purchase('player-1', '5000000000000000011', 0, 10)
  assert.throws(() => engine.purchase('player-1', '5000000000000000011', 0, 10), /exhausted/)
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

function wearableAssets(rows: number): PreparedModAssetCatalog {
  const icon = assets().image(identity.id, 'icon')
  return new PreparedModAssetCatalog([
    icon,
    { ...icon, id: `${identity.id}:icon_trim`, key: 'icon_trim', path: 'art/icon-trim.png' },
    wearableAsset('worn', 'art/worn.png', rows),
    wearableAsset('worn_trim', 'art/worn-trim.png', rows),
  ])
}

function wearableAsset(key: string, path: string, rows: number) {
  return {
    animations: { wearable: [0] },
    assetKind: 'sheet' as const,
    frames: Object.freeze(Array.from({ length: rows * 24 }, (_, index) => ({
      centerOffsetX: 0,
      centerOffsetY: 0,
      contentHeight: 170,
      contentWidth: 170,
      height: 170,
      logicalHeight: 170,
      logicalWidth: 170,
      width: 170,
      x: index % 24 * 170,
      y: Math.floor(index / 24) * 170,
    }))),
    height: rows * 170,
    id: `${identity.id}:${key}`,
    key,
    kind: 'image' as const,
    modId: identity.id,
    path,
    sha256: '2'.repeat(64),
    width: 24 * 170,
  }
}

function sceneCatalog(extra: readonly CompiledWebLuaContent[] = []) {
  return compileModContentCatalog([compiled([
    content('room', 'crypt_entry', '5000000000000000013', { geometry: { width: 20 } }),
    content('scene', 'monument_crypt', '5000000000000000014', {
      instance: 'party',
      rooms: [{
        contentId: '5000000000000000013',
        key: 'crypt_entry',
        kind: 'resolved-content-reference',
        modId: identity.id,
        targetKind: 'room',
      }],
    }),
    ...extra,
  ])], new PreparedModAssetCatalog([]))
}
