import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  buildPlayerSkillOffer,
  createPlayerProgression,
  nativeSkillCategory,
  nativeSkillDependencies,
  nativeSkillMinimumLevel,
  nativeSkillPassesOfferEligibility,
  nativeSkillRoot,
  playerStatBook,
} from '../src/game/core-kernels/player-progression.ts'
import { createNativeRng } from '../src/game/core-kernels/native-rng.ts'


const [captureArgument, outputArgument] = process.argv.slice(2)
if (!captureArgument) {
  throw new Error('usage: compare-native-skill-offer-rolls.mjs <native-capture.json> [output.json]')
}
const capturePath = resolve(captureArgument)
const outputPath = outputArgument ? resolve(outputArgument) : null
const capture = JSON.parse(await readFile(capturePath, 'utf8'))

assert.equal(capture.schema, 'solomon-dark-skill-offer-differential-v2')
assert.equal(capture.experiment.roll_count, 100)
assert.equal(capture.rolls.length, 100)
assert.deepEqual(capture.mutations, [])

const frozen = capture.frozen_level_two
const permanentRanks = Object.freeze([...frozen.permanent_ranks])
const effectiveRanks = Object.freeze([...frozen.effective_ranks])
const learnedSkillOrder = Object.freeze(permanentRanks.flatMap((rank, skillId) => (
  skillId >= 8 && skillId <= 79 && rank > 0 ? [skillId] : []
)))
const skillBook = {
  advancedUnlocks: Object.freeze([...frozen.advanced_unlocks]),
  disciplineRoot: frozen.discipline_root,
  effectiveRanks,
  elementRoot: frozen.element_root,
  learnedSkillOrder,
  permanentRanks,
  primarySkillId: frozen.primary_skill,
  weldBuildId: null,
  weldComponentRanks: null,
}

const nativeFrequency = new Map()
const webFrequency = new Map()
const mismatches = []
const rngMismatches = []
const webRolls = []
let unorderedMismatchCount = 0
let webDuplicateRollCount = 0
for (const [index, nativeRoll] of capture.rolls.entries()) {
  const progression = {
    ...createPlayerProgression(nativeRoll.seed),
    disciplineOfferBias: frozen.discipline_offer_bias !== 0,
    experience: frozen.experience,
    excludeActiveWeldBuildFromOffers: false,
    forcedOfferSkillIds: Object.freeze([...frozen.forced_offer_skill_ids]),
    level: frozen.level,
    maximumMana: frozen.maximum_mana,
    offerCycle: frozen.offer_cycle,
    offerSeed: nativeRoll.seed,
    weldOfferMarker: frozen.weld_offer_marker,
    weldingOfferBias: (frozen.feature_flags & 0x1000) !== 0,
  }
  const built = buildPlayerSkillOffer(
    progression,
    skillBook,
    index + 1,
    createNativeRng(nativeRoll.gameplay_seed),
  )
  const webOffer = built.offer
  const nativeIds = nativeRoll.options.map(({ id }) => id)
  const webIds = webOffer.options.map(({ skillId }) => skillId)
  for (const skillId of nativeIds) nativeFrequency.set(skillId, (nativeFrequency.get(skillId) ?? 0) + 1)
  for (const skillId of webIds) webFrequency.set(skillId, (webFrequency.get(skillId) ?? 0) + 1)
  if (JSON.stringify(nativeIds) !== JSON.stringify(webIds)) {
    mismatches.push({
      native: nativeIds,
      roll: index + 1,
      seed: nativeRoll.seed,
      web: webIds,
    })
  }
  if (
    JSON.stringify([...nativeIds].sort((left, right) => left - right))
    !== JSON.stringify([...webIds].sort((left, right) => left - right))
  ) unorderedMismatchCount += 1
  if (new Set(webIds).size !== webIds.length) webDuplicateRollCount += 1
  const expectedRng = {
    indexA: nativeRoll.gameplay_rng_after.index_a,
    indexB: nativeRoll.gameplay_rng_after.index_b,
    words: nativeRoll.gameplay_rng_after.words,
  }
  if (JSON.stringify(built.rng) !== JSON.stringify(expectedRng)) {
    rngMismatches.push({
      actual: built.rng,
      expected: expectedRng,
      gameplaySeed: nativeRoll.gameplay_seed,
      roll: index + 1,
    })
  }
  webRolls.push({
    gameplaySeed: nativeRoll.gameplay_seed,
    options: webIds,
    roll: index + 1,
    seed: nativeRoll.seed,
  })
}

const statBook = playerStatBook()
const metadataMismatches = []
for (let skillId = 8; skillId <= 79; skillId += 1) {
  const nativeRow = frozen.rows[skillId]
  const nativeRule = capture.row_rules[skillId]
  const webRow = statBook.entries[skillId]
  const comparisons = {
    cap_level: [nativeRow.cap_level, webRow.capLevel],
    category: [nativeRule.category, nativeSkillCategory(skillId)],
    maximum_level: [nativeRow.maximum_level, webRow.maximumLevel],
    minimum_level: [nativeRule.minimum_player_level, nativeSkillMinimumLevel(skillId)],
    root: [nativeRule.root_id, nativeSkillRoot(skillId)],
  }
  for (const [field, [nativeValue, webValue]] of Object.entries(comparisons)) {
    if (nativeValue !== webValue) {
      metadataMismatches.push({ field, native: nativeValue, skillId, web: webValue })
    }
  }
  const nativeDependencyIds = [...new Set([
    ...nativeRule.requires_all.map(({ skill_id }) => skill_id),
    ...nativeRule.requires_any,
  ])].sort((left, right) => left - right)
  const webDependencyIds = [...nativeSkillDependencies(skillId)].sort((left, right) => left - right)
  if (JSON.stringify(nativeDependencyIds) !== JSON.stringify(webDependencyIds)) {
    metadataMismatches.push({
      field: 'dependency_ids',
      native: nativeDependencyIds,
      skillId,
      web: webDependencyIds,
    })
  }
}

const predicateFailures = []
const makeBook = (ranks, advancedUnlocks = new Array(8).fill(true)) => ({
  ...skillBook,
  advancedUnlocks: Object.freeze([...advancedUnlocks]),
  effectiveRanks: Object.freeze([...ranks]),
  permanentRanks: Object.freeze([...ranks]),
})
for (let skillId = 8; skillId <= 79; skillId += 1) {
  const rule = capture.row_rules[skillId]
  const cap = frozen.rows[skillId].cap_level
  const baseRanks = new Array(permanentRanks.length).fill(0)
  for (const { skill_id: requiredId, minimum_rank: minimumRank } of rule.requires_all) {
    baseRanks[requiredId] = minimumRank
  }
  if (rule.requires_any.length > 0) baseRanks[rule.requires_any[0]] = 1
  const level = rule.minimum_player_level
  const ready = makeBook(baseRanks)
  if (!nativeSkillPassesOfferEligibility(skillId, level, ready)) {
    predicateFailures.push({ edge: 'ready', skillId })
  }
  if (level > 0 && nativeSkillPassesOfferEligibility(skillId, level - 1, ready)) {
    predicateFailures.push({ edge: 'minimum_level', skillId })
  }
  if (rule.requires_any.length > 0) {
    const noneRanks = [...baseRanks]
    for (const requiredId of rule.requires_any) noneRanks[requiredId] = 0
    if (nativeSkillPassesOfferEligibility(skillId, level, makeBook(noneRanks))) {
      predicateFailures.push({ edge: 'requires_any_missing', skillId })
    }
    for (const requiredId of rule.requires_any) {
      const oneRanks = [...noneRanks]
      oneRanks[requiredId] = 1
      if (!nativeSkillPassesOfferEligibility(skillId, level, makeBook(oneRanks))) {
        predicateFailures.push({ edge: 'requires_any_member', requiredId, skillId })
      }
    }
  }
  for (const { skill_id: forbiddenId, minimum_rank: minimumRank } of rule.forbidden_if_at_least) {
    const forbiddenRanks = [...baseRanks]
    forbiddenRanks[forbiddenId] = minimumRank
    if (nativeSkillPassesOfferEligibility(skillId, level, makeBook(forbiddenRanks))) {
      predicateFailures.push({ edge: 'forbidden', forbiddenId, skillId })
    }
  }
  const cappedRanks = [...baseRanks]
  cappedRanks[skillId] = cap
  if (nativeSkillPassesOfferEligibility(skillId, Math.max(level, 75), makeBook(cappedRanks))) {
    predicateFailures.push({ edge: 'offer_cap', skillId })
  }
  if (skillId >= 72) {
    const locked = new Array(8).fill(true)
    locked[skillId - 72] = false
    if (nativeSkillPassesOfferEligibility(skillId, level, makeBook(baseRanks, locked))) {
      predicateFailures.push({ edge: 'advanced_unlock', skillId })
    }
  }
}

const frequencies = (source) => [...source.entries()]
  .sort(([left], [right]) => left - right)
  .map(([skillId, count]) => ({ count, skillId }))
const report = {
  schema: 'solomon-dark-skill-offer-web-comparison-v2',
  capturePath,
  exactOrderedMatches: capture.rolls.length - mismatches.length,
  mismatchCount: mismatches.length,
  mismatches,
  nativeDuplicateRollCount: capture.summary.duplicate_id_rolls,
  metadataMismatchCount: metadataMismatches.length,
  metadataMismatches,
  predicateFailureCount: predicateFailures.length,
  predicateFailures,
  rngMismatchCount: rngMismatches.length,
  rngMismatches,
  unorderedMismatchCount,
  nativeFrequency: frequencies(nativeFrequency),
  webFrequency: frequencies(webFrequency),
  webDuplicateRollCount,
  webRolls,
}
if (outputPath) await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
process.stdout.write(`${JSON.stringify({
  exactOrderedMatches: report.exactOrderedMatches,
  metadataMismatchCount: report.metadataMismatchCount,
  mismatchCount: report.mismatchCount,
  outputPath,
  predicateFailureCount: report.predicateFailureCount,
  rngMismatchCount: report.rngMismatchCount,
  unorderedMismatchCount: report.unorderedMismatchCount,
  webDuplicateRollCount: report.webDuplicateRollCount,
}, null, 2)}\n`)
assert.equal(report.mismatchCount, 0, JSON.stringify(mismatches.slice(0, 10), null, 2))
assert.equal(report.metadataMismatchCount, 0, JSON.stringify(metadataMismatches.slice(0, 20), null, 2))
assert.equal(report.predicateFailureCount, 0, JSON.stringify(predicateFailures.slice(0, 20), null, 2))
assert.equal(report.rngMismatchCount, 0, JSON.stringify(rngMismatches.slice(0, 3), null, 2))
assert.equal(report.webDuplicateRollCount, 0)
