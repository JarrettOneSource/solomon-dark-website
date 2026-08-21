import assert from 'node:assert/strict'
import test from 'node:test'

import {
  HALL_OF_FAME_CLASS_NAMES,
  formatHallOfFameTime,
  hallOfFameClassName,
  rankHallOfFameEntries,
  type HallOfFameEntry,
} from './hall-of-fame.ts'

test('keeps newest-first input order across equal Awesomeness and caps at 100', () => {
  const entries = Array.from({ length: 102 }, (_, index) => entry({
    awesomeness: index === 10 || index === 11 ? 500 : index,
    runId: `run-${index}`,
  }))
  const ranked = rankHallOfFameEntries(entries)
  assert.equal(ranked.length, 100)
  assert.deepEqual(ranked.slice(0, 2).map(({ runId }) => runId), ['run-10', 'run-11'])
  assert.equal(ranked.at(-1)?.runId, 'run-2')
})

test('supports Website-global boards with Awesomeness as the secondary rank', () => {
  const entries = [
    entry({ awesomeness: 20, elapsedTicks: 1_000, monstersKilled: 4, runId: 'a', wave: 2 }),
    entry({ awesomeness: 30, elapsedTicks: 900, monstersKilled: 3, runId: 'b', wave: 2 }),
    entry({ awesomeness: 10, elapsedTicks: 1_100, monstersKilled: 5, runId: 'c', wave: 1 }),
  ]
  assert.deepEqual(rankHallOfFameEntries(entries, 'wave').map(({ runId }) => runId), ['b', 'a', 'c'])
  assert.deepEqual(rankHallOfFameEntries(entries, 'kills').map(({ runId }) => runId), ['c', 'a', 'b'])
  assert.deepEqual(rankHallOfFameEntries(entries, 'time').map(({ runId }) => runId), ['c', 'a', 'b'])
})

test('formats the populated native sample time from the 100 Hz clock', () => {
  assert.equal(formatHallOfFameTime(33_950), '0:05:39')
  assert.equal(formatHallOfFameTime(366_100), '1:01:01')
})

test('drains the complete native five-element by three-discipline title table', () => {
  assert.deepEqual(HALL_OF_FAME_CLASS_NAMES, {
    ether: { body: 'Sage', mind: 'Seer', arcane: 'Occultist' },
    fire: { body: 'Warlock', mind: 'Pyromancer', arcane: 'Fire Mage' },
    air: { body: 'Stormcaller', mind: 'Astrologer', arcane: 'Storm Mage' },
    water: { body: 'Icebinder', mind: 'Thaumaturge', arcane: 'Frost Mage' },
    earth: { body: 'Ritualist', mind: 'Channeler', arcane: 'Earth Mage' },
  })
  assert.equal(hallOfFameClassName('ether', 'mind'), 'Seer')
})

function entry(patch: Partial<HallOfFameEntry>): HallOfFameEntry {
  return {
    accountUsername: null,
    awesomeness: 91,
    awesomestKill: 'Skeleton',
    completedAtUtc: '2026-08-20T00:00:00.000Z',
    discipline: 'arcane',
    elapsedTicks: 33_950,
    element: 'ether',
    headingIndex: 0,
    highestSkills: [{ rank: 1, skillId: 0 }],
    level: 1,
    monstersKilled: 17,
    perksUsed: [],
    portraitScale: 1,
    runId: 'sample-run',
    wave: 1,
    wizardName: 'Volusius',
    ...patch,
  }
}
