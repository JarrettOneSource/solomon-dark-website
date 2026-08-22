import assert from 'node:assert/strict'
import test from 'node:test'

import { createIdlePlayerPrimaryCast } from './core-kernels/player-character.ts'
import { createGameSimulation } from './core-server/game-simulation.ts'
import { createGameSnapshot } from './host/game-snapshot.ts'
import type { GameSnapshot } from './protocol/game-protocol.ts'
import type { ProtocolPlayerState } from './protocol/game-state.ts'
import type { LocalPartyState, PartyPlayerProfile } from './protocol/party-state.ts'
import {
  buildPartyRoster,
  compactPartyRosterRowLimit,
  compactPartyRosterRows,
  compactPartyRosterRowsThatFit,
  partyRosterModelsEqual,
  snapshotAllyWorldKey,
  type PartyRosterRow,
} from './party-roster.ts'

const BASE_SNAPSHOT = createGameSnapshot(createGameSimulation(), null)
const DEFAULT_PLAYER = BASE_SNAPSHOT.players['local-player']!

function player(
  displayName: string,
  overrides: Partial<ProtocolPlayerState> = {},
): ProtocolPlayerState {
  return {
    config: {
      discipline: 'arcane',
      displayName,
      element: 'fire',
    },
    economy: DEFAULT_PLAYER.economy,
    footstepTick: 0,
    gaitDegrees: 0,
    headingIndex: 0,
    lighting: DEFAULT_PLAYER.lighting,
    movementScale: DEFAULT_PLAYER.movementScale,
    position: { x: 0, y: 0 },
    primaryCast: createIdlePlayerPrimaryCast(),
    progression: DEFAULT_PLAYER.progression,
    velocity: { x: 0, y: 0 },
    walkCyclePrimary: 0,
    ...overrides,
  }
}

function hubSnapshot(
  players: Record<string, ProtocolPlayerState>,
  regions: Record<string, 'courtyard' | 'library'> = {},
): GameSnapshot {
  const hubWorld = BASE_SNAPSHOT.world
  if (hubWorld.kind !== 'hub') throw new Error('expected a Hub base snapshot')
  return {
    ...BASE_SNAPSHOT,
    players,
    world: {
      ...hubWorld,
      participants: Object.fromEntries(Object.keys(players).map((playerId) => [
        playerId,
        {
          ...hubWorld.participants['local-player']!,
          region: regions[playerId] ?? 'courtyard',
        },
      ])),
    },
  } as GameSnapshot
}

function profile(playerId: string, displayName: string): PartyPlayerProfile {
  return {
    accountUsername: null,
    displayName,
    highestWave: null,
    playerId,
    totalPlaytimeMs: null,
  }
}

function party(
  memberPlayerIds: readonly string[],
  hubPlayers: readonly PartyPlayerProfile[],
  leaderPlayerId = memberPlayerIds[0]!,
): LocalPartyState {
  return {
    hubPlayers,
    invitations: [],
    joinRequests: [],
    party: {
      id: 'party-1',
      joinCode: 'ABCD-EFGH',
      leaderPlayerId,
      listingId: 'listing-1',
      memberPlayerIds,
      visibility: 'public',
    },
    revision: 1,
  }
}

function hurt(state: ProtocolPlayerState, currentHealth: number): ProtocolPlayerState {
  return {
    ...state,
    progression: { ...state.progression, currentHealth, maximumHealth: 100 },
  }
}

test('without a party every other present player is an ally and there are no members', () => {
  const snapshot = hubSnapshot({
    local: player('Local'),
    zed: hurt(player('Zed'), 25),
    abel: player('Abel'),
  })
  const roster = buildPartyRoster({ partyState: null, playerId: 'local', snapshot })

  assert.equal(roster.partyId, null)
  assert.equal(roster.size, 0)
  assert.deepEqual(roster.members, [])
  assert.deepEqual(roster.allies.map((row) => row.id), ['abel', 'zed'])
  assert.equal(roster.allies[1]?.healthRatio, 0.25)
  assert.equal(roster.allies[1]?.element, 'fire')
  assert.equal(roster.allies.every((row) => row.presence === 'present' && !row.isSelf), true)
})

test('party members keep party order, mark self and leader, and drop self from allies', () => {
  const snapshot = hubSnapshot({
    local: player('Local'),
    basil: hurt(player('Basil'), 50),
    cassia: player('Cassia'),
  })
  const roster = buildPartyRoster({
    partyState: party(
      ['basil', 'local', 'cassia'],
      [profile('basil', 'Basil'), profile('local', 'Local'), profile('cassia', 'Cassia')],
    ),
    playerId: 'local',
    snapshot,
  })

  assert.equal(roster.partyId, 'party-1')
  assert.equal(roster.size, 3)
  assert.deepEqual(roster.members.map((row) => row.id), ['basil', 'local', 'cassia'])
  assert.deepEqual(roster.members.map((row) => row.isLeader), [true, false, false])
  assert.deepEqual(roster.members.map((row) => row.isSelf), [false, true, false])
  assert.deepEqual(roster.allies.map((row) => row.id), ['basil', 'cassia'])
  assert.equal(roster.allies[0]?.healthRatio, 0.5)
})

test('hub members in another region or outside the snapshot are away and leave the ally strip', () => {
  const snapshot = hubSnapshot(
    {
      local: player('Local'),
      basil: player('Basil'),
      cassia: player('Cassia'),
    },
    { cassia: 'library' },
  )
  const roster = buildPartyRoster({
    partyState: party(
      ['local', 'basil', 'cassia', 'daria'],
      [profile('daria', 'Daria')],
    ),
    playerId: 'local',
    snapshot,
  })

  assert.deepEqual(roster.members.map((row) => [row.id, row.presence, row.healthRatio]), [
    ['local', 'present', 1],
    ['basil', 'present', 1],
    ['cassia', 'away', null],
    ['daria', 'away', null],
  ])
  assert.equal(roster.members[3]?.displayName, 'Daria')
  assert.deepEqual(roster.allies.map((row) => row.id), ['basil'])
})

test('boneyard members that died stay listed as fallen with an empty bar', () => {
  const fallen = player('Basil')
  const snapshot = {
    ...hubSnapshot({
      local: player('Local'),
      basil: {
        ...fallen,
        progression: { ...fallen.progression, currentHealth: 0, lifeState: 'dying' },
      },
    }),
    world: { kind: 'boneyard', runId: 'run-1' },
  } as unknown as GameSnapshot
  const roster = buildPartyRoster({
    partyState: party(['local', 'basil'], []),
    playerId: 'local',
    snapshot,
  })

  assert.equal(roster.members[1]?.presence, 'fallen')
  assert.equal(roster.members[1]?.healthRatio, 0)
  assert.deepEqual(roster.allies.map((row) => row.id), ['basil'])
  assert.equal(snapshotAllyWorldKey(snapshot, 'local'), 'boneyard:run-1')
})

test('extra ally rows join the strip after players and never become party members', () => {
  const snapshot = hubSnapshot({ local: player('Local') })
  const roster = buildPartyRoster({
    additionalRows: [{
      healthRatio: 0.4,
      id: 'golem:1',
      identity: { kind: 'golem' },
    }],
    partyState: party(['local'], []),
    playerId: 'local',
    snapshot,
  })

  assert.equal(roster.size, 1)
  assert.deepEqual(roster.allies.map((row) => [row.id, row.kind, row.displayName, row.healthRatio]), [
    ['golem:1', 'golem', 'Golem', 0.4],
  ])
})

test('compact rows keep a slot for the overflow count when allies exceed the limit', () => {
  const rows: PartyRosterRow[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({
    displayName: id,
    element: 'air',
    healthRatio: 1,
    id,
    isLeader: false,
    isSelf: false,
    kind: 'player',
    playerId: id,
    presence: 'present',
  }))

  assert.deepEqual(compactPartyRosterRows(rows, 6), { hiddenCount: 0, rows })
  assert.deepEqual(compactPartyRosterRows(rows, 5), { hiddenCount: 0, rows })
  assert.deepEqual(compactPartyRosterRows(rows, 3), {
    hiddenCount: 3,
    rows: rows.slice(0, 2),
  })
  assert.deepEqual(compactPartyRosterRows(rows, 1), { hiddenCount: 5, rows: [] })
  assert.deepEqual(compactPartyRosterRows(rows, 0), { hiddenCount: 5, rows: [] })
})

test('roster models compare by content so unchanged snapshots do not rerender', () => {
  const snapshot = hubSnapshot({ local: player('Local'), basil: player('Basil') })
  const partyState = party(['local', 'basil'], [])
  const left = buildPartyRoster({ partyState, playerId: 'local', snapshot })
  const right = buildPartyRoster({ partyState, playerId: 'local', snapshot })
  const changed = buildPartyRoster({
    partyState,
    playerId: 'local',
    snapshot: hubSnapshot({ local: player('Local'), basil: hurt(player('Basil'), 10) }),
  })

  assert.equal(partyRosterModelsEqual(left, right), true)
  assert.equal(partyRosterModelsEqual(left, changed), false)
})

test('the compact strip keeps six rows on desktop and folds sooner on touch', () => {
  assert.equal(compactPartyRosterRowLimit(false, 1), 6)
  assert.equal(compactPartyRosterRowLimit(false, 1.5), 6)
  assert.equal(compactPartyRosterRowLimit(true, 1), 3)
  assert.equal(compactPartyRosterRowLimit(true, 1.2), 3)
  assert.equal(compactPartyRosterRowLimit(true, 1.5), 1)
})

test('the compact strip stacks only the rows that fit above the HUD zone it yields to', () => {
  // the 844x390 phone: 138px from the strip's top to 8px above the movement
  // joystick, a 36px pills row with its 5px gap, 36px rows
  const phone = { fixedHeight: 41, rowGap: 5, rowHeight: 36 }
  assert.equal(compactPartyRosterRowsThatFit({ ...phone, availableHeight: 138 }), 2)
  // two rows and the gap between them fit exactly; a pixel less folds one
  assert.equal(compactPartyRosterRowsThatFit({ ...phone, availableHeight: 41 + 36 + 5 + 36 }), 2)
  assert.equal(compactPartyRosterRowsThatFit({ ...phone, availableHeight: 41 + 36 + 5 + 35 }), 1)
  // a pending invitation takes its own height from the rows
  assert.equal(compactPartyRosterRowsThatFit({ ...phone, availableHeight: 138, fixedHeight: 41 + 60 }), 1)
  // too short for a row, and a strip without layout
  assert.equal(compactPartyRosterRowsThatFit({ ...phone, availableHeight: 50 }), 0)
  assert.equal(compactPartyRosterRowsThatFit({ availableHeight: 0, fixedHeight: 0, rowGap: 0, rowHeight: 0 }), 0)
})
