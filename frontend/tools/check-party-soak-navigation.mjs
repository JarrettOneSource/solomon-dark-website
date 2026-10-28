import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

import { boneyardActiveBounds } from '../src/game/core-kernels/boneyard-arena-transition.ts'
import { nativeWebbedMovementScale } from '../src/game/core-kernels/native-webbed.ts'
import {
  commitPlayerCharacterTick, createIdlePlayerCharacterInput,
  planPlayerCharacterTick, PLAYER_CHARACTER_RADIUS,
} from '../src/game/core-kernels/player-character.ts'
import {
  boneyardBodyCollisionSourceIds, resolveBoneyardMovement, withBoneyardGateCollision,
} from '../src/game/core-server/boneyard-collision.ts'
import { getPlayerCharacter } from '../src/game/core-server/game-simulation.ts'
import {
  playerEntityMovementScale, replacePlayerCharacter,
} from '../src/game/core-server/player-entity-store.ts'
import { prepareModHost } from '../src/game/host/prepared-mod-host.ts'
import {
  compileWebSessionContentDefinitions, materializeWebSessionContent,
} from '../src/game/host/web-mod-content.ts'
import { restoreGameSaveDocument } from '../src/game/save/game-save-document.ts'

const [checkpointPath, baselinePath, outputPath] = process.argv.slice(2)
assert.ok(checkpointPath && baselinePath && outputPath,
  'usage: node --experimental-strip-types tools/check-party-soak-navigation.mjs OWNER_CHECKPOINT BASELINE_PILOT OUTPUT')
const checkpointBytes = await readFile(resolve(checkpointPath))
const checkpoint = JSON.parse(checkpointBytes)
const baseline = await readFile(resolve(baselinePath), 'utf8')
const candidate = await readFile(new URL('./party-soak-pilot.lua', import.meta.url), 'utf8')
assert.notEqual(hash(baseline), hash(candidate), 'baseline must be the preserved original pilot')
const wasmPath = createRequire(import.meta.url).resolve('wasmoon/dist/glue.wasm')
const id = 'local.performance.party-soak'
const ticks = 3000

// Isolate the captured blocked approach: other actors, loot, and combat clocks
// remain at the saved observation. The real Lua controller supplies ordinary
// movement, then the production acceleration, sweep, slide, and commit run.
// Dynamic body interactions are excluded. This checks escape from that static
// geometry, not later boss damage or a full replay.
const rows = []
for (const [name, source] of [['baseline', baseline], ['candidate', candidate]]) {
  const restored = restoreGameSaveDocument(JSON.stringify(checkpoint.save))
  let state = restored.state
  assert.equal(state.world.kind, 'boneyard')
  const playerId = restored.playerId
  const initial = getPlayerCharacter(state, playerId).position
  const world = state.world
  const bounds = world.arenaTransition === null ? world.bounds : boneyardActiveBounds(world.arenaTransition)
  const collision = withBoneyardGateCollision(world.collision, world.gateLeaves)
  const contentSha256 = hash(id + '\0' + source)
  const content = await compileWebSessionContentDefinitions(materializeWebSessionContent({
    manifestSha256: hash(contentSha256),
    mods: [{ id, name: 'Private navigation proof', slug: 'party-soak', version: '1.0.0',
      priority: 0, entryScript: source, contentSha256, boneyards: [], files: [] }],
  }), wasmPath)
  const messages = []
  const host = await prepareModHost({ content, wasmPath,
    log: message => messages.push(message),
    state: { read: () => state, write: next => { state = next } },
  })
  try {
    const seeded = structuredClone(host.saveState())
    // Keep the compiled graph identity. Seed only the captured pilot decision
    // cell, with new schema defaults, instead of rewriting the saved document.
    const savedCell = checkpoint.save.modState[id].state_cells.find(cell => (
      cell.scope_id === playerId + ':' + state.run.runId && cell.key === 'pilot'
    ))
    assert.ok(savedCell, 'the diagnostic must retain the blocked pilot state')
    const value = structuredClone(savedCell.value)
    if (name === 'candidate') Object.assign(value, { escape_x: 0, escape_y: 0, escape_remaining: 0 })
    seeded[id].state_cells = [{ ...structuredClone(savedCell), value }]
    host.restoreSaveState(seeded)
    let maximumDistance = 0
    let escapeTick = null
    let primaryDecisions = 0
    let longestHeldEscape = 0
    let heldEscape = 0
    let previousMovement = null
    const trace = []
    for (let step = 0; step < ticks; step += 1) {
      const inputs = { [playerId]: createIdlePlayerCharacterInput() }
      host.applyPlayerControls(inputs, step * 10)
      const input = inputs[playerId]
      assert.ok(Math.hypot(input.movement.x, input.movement.y) <= 1)
      const player = getPlayerCharacter(state, playerId)
      const plan = planPlayerCharacterTick(player, input,
        playerEntityMovementScale(state.playerEntities, playerId)
          * nativeWebbedMovementScale(world.enemies.webbedPlayers[playerId]))
      const position = resolveBoneyardMovement(player.position, {
        x: player.position.x + plan.delta.x, y: player.position.y + plan.delta.y,
      }, bounds, collision, PLAYER_CHARACTER_RADIUS)
      const moved = commitPlayerCharacterTick(player, plan, position)
      state = { ...state, tick: state.tick + 1,
        playerEntities: replacePlayerCharacter(state.playerEntities, playerId, moved) }
      const distance = Math.hypot(position.x - initial.x, position.y - initial.y)
      maximumDistance = Math.max(maximumDistance, distance)
      if (distance >= 150 && escapeTick === null) escapeTick = step + 1
      if (step % 10 === 0) {
        primaryDecisions += Number(input.cast.primary)
        const cell = host.saveState()[id].state_cells.find(cell => cell.scope_id === savedCell.scope_id)
        const escaping = Number(cell?.value.escape_remaining ?? 0) > 0
        const same = previousMovement !== null
          && input.movement.x === previousMovement.x && input.movement.y === previousMovement.y
        heldEscape = escaping ? (same ? heldEscape + 1 : 1) : 0
        longestHeldEscape = Math.max(longestHeldEscape, heldEscape)
        previousMovement = input.movement
      }
      if (step % 100 === 0 || step === ticks - 1) trace.push({
        step: step + 1, position, distance, movement: input.movement,
      })
    }
    const saved = host.saveState()[id]
    rows.push({ name, sourceSha256: hash(source), checkpointTick: restored.state.tick,
      ticks, simulatedSeconds: ticks / 100, initial, final: getPlayerCharacter(state, playerId).position,
      maximumDistance, escapeTick, primaryDecisions, longestHeldEscape,
      initialContacts: boneyardBodyCollisionSourceIds(initial, collision, PLAYER_CHARACTER_RADIUS),
      reducerHealth: saved.runtime.reducer_health, messages, trace })
  } finally { host.close() }
}

const report = { purpose: 'Captured static-collision escape regression using real Lua and ordinary player movement',
  checkpoint: resolve(checkpointPath), checkpointSha256: hash(checkpointBytes),
  capturedAtUtc: checkpoint.receivedAtUtc, rows,
  limitation: 'Movement-only diagnostic: other actors, loot, mana, health, and combat clocks stay frozen at the captured observation. This is not an endurance or damage result.' }
await writeFile(resolve(outputPath), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
assert.ok(rows[0].maximumDistance < 20, 'the original pilot must reproduce the captured blockage')
assert.ok(rows[1].maximumDistance >= 150, 'the candidate must leave the captured obstacle')
assert.ok(rows[1].longestHeldEscape >= 20, 'escape must persist after movement resumes')
for (const row of rows) {
  assert.ok(row.primaryDecisions > 0, row.name + ' retains ordinary primary attack intent')
  assert.ok(row.reducerHealth.every(reducer => !reducer.disabled), row.name + ' native reducer remains enabled')
  assert.deepEqual(row.messages, [], row.name + ' has no Lua dispatch failures')
}
console.log(JSON.stringify({ event: 'navigation-probe.passed', output: resolve(outputPath),
  rows: rows.map(({ trace, ...row }) => row) }))

function hash(value) { return createHash('sha256').update(value).digest('hex') }
