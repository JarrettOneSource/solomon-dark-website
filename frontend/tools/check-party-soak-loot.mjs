import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

import { getPlayerCharacter } from '../src/game/core-server/game-simulation.ts'
import { modPlayerControlObservation } from '../src/game/host/mod-player-control.ts'
import { prepareModHost } from '../src/game/host/prepared-mod-host.ts'
import { createIdlePlayerCharacterInput } from '../src/game/core-kernels/player-character.ts'
import {
  compileWebSessionContentDefinitions, materializeWebSessionContent,
} from '../src/game/host/web-mod-content.ts'
import { restoreGameSaveDocument } from '../src/game/save/game-save-document.ts'

const [outputPath, ...checkpointPaths] = process.argv.slice(2)
assert.ok(outputPath && checkpointPaths.length > 0,
  'usage: node --experimental-strip-types tools/check-party-soak-loot.mjs OUTPUT OWNER_CHECKPOINT...')
const candidate = await readFile(new URL('./party-soak-pilot.lua', import.meta.url), 'utf8')
const bounded = '        -- Observations are sorted by distance; later rows cannot be in range.\n'
  + '        if dx * dx + dy * dy >= 250 * 250 then break end\n'
  + '        if loot.kind == "orb" or loot.kind == "bonus" then'
const original = '        if (loot.kind == "orb" or loot.kind == "bonus") and dx * dx + dy * dy < 250 * 250 then'
assert.equal(candidate.split(bounded).length, 2, 'identify the one optimized loot loop')
const reference = candidate.replace(bounded, original)
const id = 'local.performance.party-soak'
const cases = []
for (const path of checkpointPaths) {
  const bytes = await readFile(resolve(path))
  const envelope = JSON.parse(bytes)
  const restored = restoreGameSaveDocument(JSON.stringify(envelope.save))
  assert.equal(restored.state.world.kind, 'boneyard')
  cases.push({ name: resolve(path), checkpointSha256: hash(bytes), state: restored.state,
    playerId: restored.playerId, receivedAtUtc: envelope.receivedAtUtc,
    pilotCell: envelope.save.modState[id].state_cells.find(cell => (
      cell.scope_id === restored.playerId + ':' + restored.state.run.runId && cell.key === 'pilot'
    )), expectedLootId: undefined })
}
const first = cases[0]
const template = first.state.world.loot.actors[0]
assert.ok(template, 'boundary cases require an existing ordinary loot actor shape')
const boundaryCases = [
  ['inside boundary', [[1, 'gold', 1], [2, 'orb', 249.999999]], 2],
  ['exact boundary excluded', [[1, 'gold', 249], [2, 'orb', 250]], null],
  ['outside boundary excluded', [[1, 'bonus', 250.000001], [2, 'orb', 251]], null],
  ['equal-distance ID order', [[2, 'orb', 100], [1, 'bonus', 100]], 1],
  ['nearby noneligible loot', [[1, 'gold', 10], [2, 'bonus', 20]], 2],
  ['coincident orb', [[1, 'orb', 0]], 1],
  ['empty observation', [], null],
  ['64 distant rows', Array.from({ length: 64 }, (_, index) => [index + 1, 'gold', 300 + index]), null],
]
for (const [name, loot, expectedLootId] of boundaryCases) {
  const state = structuredClone(first.state)
  const center = getPlayerCharacter(state, first.playerId).position
  state.world = { ...state.world, loot: { ...state.world.loot,
    actors: loot.map(([id, kind, distance]) => ({ ...structuredClone(template), id, kind,
      position: { x: center.x + distance, y: center.y } })) } }
  cases.push({ name, state, playerId: first.playerId, pilotCell: first.pilotCell, expectedLootId })
}
const wasmPath = createRequire(import.meta.url).resolve('wasmoon/dist/glue.wasm')
const outputs = []
for (const [name, source] of [['reference', reference], ['candidate', candidate]]) {
  let state = structuredClone(first.state)
  const contentSha256 = hash(source)
  const content = await compileWebSessionContentDefinitions(materializeWebSessionContent({
    manifestSha256: hash(contentSha256),
    mods: [{ id, name: 'Private loot proof', slug: 'party-soak', version: '1.0.0',
      priority: 0, entryScript: source, contentSha256, boneyards: [], files: [] }],
  }), wasmPath)
  const messages = []
  const host = await prepareModHost({ content, wasmPath, log: message => messages.push(message),
    state: { read: () => state, write: next => { state = next } } })
  try {
    const blank = host.saveState()
    const rows = []
    for (const entry of cases) {
      state = structuredClone(entry.state)
      const seeded = structuredClone(blank)
      assert.ok(entry.pilotCell, entry.name + ' retains its pilot decision cell')
      seeded[id].state_cells = [{ ...structuredClone(entry.pilotCell), value: {
        ...structuredClone(entry.pilotCell.value), escape_x: 0, escape_y: 0, escape_remaining: 0,
      } }]
      host.restoreSaveState(seeded)
      const observation = modPlayerControlObservation(state, entry.playerId)
      const selected = scan(observation, name === 'candidate')
      const inputs = { [entry.playerId]: createIdlePlayerCharacterInput() }
      host.applyPlayerControls(inputs, 0)
      rows.push({ name: entry.name, checkpointSha256: entry.checkpointSha256,
        receivedAtUtc: entry.receivedAtUtc, tick: entry.state.tick,
        observedLootCount: observation.loot.length, ...selected,
        input: structuredClone(inputs[entry.playerId]),
        pilotCells: host.saveState()[id].state_cells,
        offerPresent: observation.player.offer !== null,
      })
      if (entry.expectedLootId !== undefined) assert.equal(selected.lootId, entry.expectedLootId, entry.name)
    }
    outputs.push({ name, sourceSha256: hash(source), rows, messages })
  } finally { host.close() }
}
const report = { purpose: 'Real Lua decision equivalence with and without sorted-loot early exit',
  sourceSha256: hash(candidate), checkpointCount: checkpointPaths.length,
  boundaryCount: boundaryCases.length, outputs,
  note: 'Rows examined are counted from the exact bounded observation. Actual Lua input and reducer-state outputs are compared independently below; this is not a wall-time benchmark.' }
await writeFile(resolve(outputPath), JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
for (const output of outputs) assert.deepEqual(output.messages, [], output.name + ' has no Lua failures')
for (let index = 0; index < cases.length; index += 1) {
  const before = outputs[0].rows[index]
  const after = outputs[1].rows[index]
  assert.equal(after.lootId, before.lootId, after.name + ' selects the same loot')
  assert.deepEqual(after.input, before.input, after.name + ' produces identical ordinary input')
  assert.deepEqual(after.pilotCells, before.pilotCells, after.name + ' produces identical pilot state')
  assert.ok(after.examined <= before.examined, after.name + ' never examines more rows')
}
console.log(JSON.stringify({ event: 'loot-equivalence.passed', output: resolve(outputPath),
  checkpoints: checkpointPaths.length, boundaries: boundaryCases.length,
  rows: outputs[1].rows.map((row, index) => ({ name: row.name, lootId: row.lootId,
    before: outputs[0].rows[index].examined, after: row.examined })) }))

function scan(observation, earlyExit) {
  let examined = 0
  for (const loot of observation.loot) {
    examined += 1
    const dx = loot.position.x - observation.player.position.x
    const dy = loot.position.y - observation.player.position.y
    const distanceSquared = dx * dx + dy * dy
    if (earlyExit && distanceSquared >= 250 * 250) break
    if ((loot.kind === 'orb' || loot.kind === 'bonus') && distanceSquared < 250 * 250) {
      return { examined, lootId: loot.id }
    }
  }
  return { examined, lootId: null }
}

function hash(value) { return createHash('sha256').update(value).digest('hex') }
