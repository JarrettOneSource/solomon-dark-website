import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CHEAT_MENU_BOT_DISCIPLINES,
  CHEAT_MENU_BOT_ELEMENTS,
  CHEAT_MENU_CATALOG_QUERY,
  CHEAT_MENU_CONSOLE_HISTORY_LIMIT,
  CHEAT_MENU_TABS,
  appendCheatConsoleHistory,
  compileCheatMenuAction,
  decodeCheatMenuCatalogs,
  formatCheatConsoleValues,
  gameCheatMenuAvailable,
} from './cheat-menu-contract.ts'

test('the cheat menu admits only an ordinary cheat host or sealed developer', () => {
  assert.equal(gameCheatMenuAvailable({ cheatsEnabled: false, developerAccess: false, isHost: true }), false)
  assert.equal(gameCheatMenuAvailable({ cheatsEnabled: true, developerAccess: false, isHost: false }), false)
  assert.equal(gameCheatMenuAvailable({ cheatsEnabled: true, developerAccess: false, isHost: true }), true)
  assert.equal(gameCheatMenuAvailable({ cheatsEnabled: false, developerAccess: true, isHost: false }), true)
  assert.deepEqual(CHEAT_MENU_TABS, ['cheats', 'console'])
})

test('fixed cheat controls compile bounded literal Lua without accepting raw code', () => {
  assert.equal(
    compileCheatMenuAction({ kind: 'restore-health', playerId: "player-'\\one" }),
    "return sd.player.restore_health(10000000, 'player-\\'\\\\one')",
  )
  assert.equal(
    compileCheatMenuAction({ kind: 'restore-mana', playerId: 'player-1' }),
    "return sd.player.set_mana(10000000, 'player-1')",
  )
  assert.equal(
    compileCheatMenuAction({ gold: 4321, kind: 'set-gold', playerId: 'player-1' }),
    "return sd.player.set_gold(4321, 'player-1')",
  )
  assert.equal(
    compileCheatMenuAction({ amount: 2500, kind: 'grant-experience', playerId: 'player-1' }),
    "return sd.player.grant_experience(2500, 'player-1')",
  )
  assert.equal(
    compileCheatMenuAction({ kind: 'set-run-seed', seed: 42 }),
    'return sd.rng.set_seed(42)',
  )
  assert.match(
    compileCheatMenuAction({ count: 8, enemyKey: 'skeleton', kind: 'spawn-enemy', playerId: 'player-1' }),
    /sd\.enemies\.spawn\('skeleton',\s*\{\s*x = player\.x \+ 80/,
  )
  assert.equal(
    compileCheatMenuAction({ itemKey: 'health-potion', kind: 'grant-item', playerId: 'player-2', quantity: 3 }),
    "return sd.dev.grant_item('health-potion', 3, 'player-2')",
  )
  assert.equal(
    compileCheatMenuAction({ kind: 'grant-skill', playerId: 'player-2', ranks: 2, skillId: 72 }),
    "return sd.dev.grant_skill(72, 2, 'player-2')",
  )
  assert.equal(
    compileCheatMenuAction({ buildId: 1000, kind: 'grant-weld', playerId: 'player-2' }),
    "return sd.dev.grant_weld(1000, 'player-2')",
  )
  assert.equal(
    compileCheatMenuAction({ discipline: 'mind', element: 'water', kind: 'summon-bot' }),
    "return sd.bots.summon({discipline = 'mind', element = 'water'})",
  )
  assert.equal(
    CHEAT_MENU_BOT_DISCIPLINES.flatMap((discipline) => (
      CHEAT_MENU_BOT_ELEMENTS.map((element) => compileCheatMenuAction({
        discipline,
        element,
        kind: 'summon-bot',
      }))
    )).length,
    15,
  )

  assert.throws(
    () => compileCheatMenuAction({ gold: 10_000_001, kind: 'set-gold', playerId: 'player-1' }),
    /Gold must be within/,
  )
  assert.throws(
    () => compileCheatMenuAction({ count: 21, enemyKey: 'skeleton', kind: 'spawn-enemy', playerId: 'player-1' }),
    /enemy count must be within/,
  )
})

test('the catalog query and decoder retain every returned semantic descriptor', () => {
  assert.match(CHEAT_MENU_CATALOG_QUERY, /sd\.enemies\.list\(\)/)
  assert.match(CHEAT_MENU_CATALOG_QUERY, /sd\.dev\.list_items\(\)/)
  assert.match(CHEAT_MENU_CATALOG_QUERY, /sd\.dev\.list_skills\(\)/)
  assert.match(CHEAT_MENU_CATALOG_QUERY, /sd\.dev\.list_welds\(\)/)
  const catalogs = decodeCheatMenuCatalogs([
    [{ base: 'skeleton_archer', key: 'skeleton_archer', native_type_id: 8 }],
    [{ key: 'health-potion', kind: 'health-potion', name: 'Health Potion', native_type_id: 7001 }],
    [{ family: 'water', id: 72, maximum_rank: 5, name: 'Acid Rain', weld_only: false }],
    [{ component_skill_ids: [32, 43], id: 1000, name: 'Ice Shards' }],
  ])
  assert.deepEqual(catalogs, {
    enemies: [{ base: 'skeleton_archer', key: 'skeleton_archer', nativeTypeId: 8 }],
    items: [{ key: 'health-potion', kind: 'health-potion', name: 'Health Potion', nativeTypeId: 7001 }],
    skills: [{ family: 'water', id: 72, maximumRank: 5, name: 'Acid Rain', weldOnly: false }],
    welds: [{ componentSkillIds: [32, 43], id: 1000, name: 'Ice Shards' }],
  })
  assert.deepEqual(decodeCheatMenuCatalogs([[{
    base: 'skeleton',
    key: 'skeleton',
    native_type_id: 7,
  }], {}, {}, {}]), {
    enemies: [{ base: 'skeleton', key: 'skeleton', nativeTypeId: 7 }],
    items: [],
    skills: [],
    welds: [],
  })
  assert.throws(() => decodeCheatMenuCatalogs([{}, [], [], []]), /enemy catalog must be an array/)
})

test('console history is bounded, ignores blanks, and removes only adjacent duplicates', () => {
  let history: readonly string[] = []
  history = appendCheatConsoleHistory(history, '  ')
  assert.deepEqual(history, [])
  history = appendCheatConsoleHistory(history, 'return 1')
  history = appendCheatConsoleHistory(history, 'return 1')
  assert.deepEqual(history, ['return 1'])
  for (let index = 0; index <= CHEAT_MENU_CONSOLE_HISTORY_LIMIT; index += 1) {
    history = appendCheatConsoleHistory(history, `return ${index}`)
  }
  assert.equal(history.length, CHEAT_MENU_CONSOLE_HISTORY_LIMIT)
  assert.equal(history[0], 'return 1')
  assert.equal(history.at(-1), `return ${CHEAT_MENU_CONSOLE_HISTORY_LIMIT}`)
})

test('console return values are rendered as readable stable JSON', () => {
  assert.equal(formatCheatConsoleValues([]), '')
  assert.equal(formatCheatConsoleValues([true, 42, 'hello', { id: 'player-1' }]), [
    'true',
    '42',
    '"hello"',
    '{\n  "id": "player-1"\n}',
  ].join('\n'))
})
