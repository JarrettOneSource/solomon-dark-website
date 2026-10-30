// Read-only observations of accepted network frames. A first-observed position
// may be later than birth; these records never claim a complete authority replay.
export class RunObservation {
  runs = []
  #seen = new Map()

  accept(frame) {
    if (!frame.runId) return
    let seen = this.#seen.get(frame.runId)
    if (!seen) {
      const run = {
        runId: frame.runId, seed: frame.seed, sourceSha256: frame.sourceSha256,
        geometrySha256: frame.geometrySha256, firstTick: frame.tick, lastTick: frame.tick,
        snapshots: 0, protectedSnapshots: 0, unprotectedSnapshotsAfterProtection: 0,
        minimumHealth: frame.health, minimumMana: frame.mana,
        maximumPrimarySequence: 0, maximumSecondarySequence: 0,
        unobservedSecondaryCasts: 0, waves: [], secondaryCasts: [],
        enemies: [], loot: [], eventGaps: [],
      }
      this.runs.push(run)
      seen = { run, enemies: new Set(), loot: new Set(), enemyEvent: 0, lootEvent: 0 }
      this.#seen.set(frame.runId, seen)
    }
    const { run } = seen
    run.seed ??= frame.seed
    run.sourceSha256 ??= frame.sourceSha256
    run.geometrySha256 ??= frame.geometrySha256
    run.lastTick = frame.tick
    run.snapshots += 1
    if (frame.protected) run.protectedSnapshots += 1
    else if (run.protectedSnapshots > 0) run.unprotectedSnapshotsAfterProtection += 1
    run.minimumHealth = Math.min(run.minimumHealth, frame.health)
    run.minimumMana = Math.min(run.minimumMana, frame.mana)
    run.maximumPrimarySequence = Math.max(run.maximumPrimarySequence, frame.castSequence)
    if (frame.secondaryCastSequence > run.maximumSecondarySequence) {
      const delta = frame.secondaryCastSequence - run.maximumSecondarySequence
      run.secondaryCasts.push({ sequence: frame.secondaryCastSequence, skill: frame.secondarySkill,
        tick: frame.tick, wave: frame.wave })
      run.unobservedSecondaryCasts += delta - 1
      run.maximumSecondarySequence = frame.secondaryCastSequence
    }
    if (run.waves.at(-1)?.wave !== frame.wave) {
      run.waves.push({ wave: frame.wave, phase: frame.wavePhase, tick: frame.tick,
        observedAt: new Date().toISOString() })
    }
    for (const lane of ['enemies', 'loot']) {
      for (const actor of frame[lane]) {
        // Ground pickups reuse IDs 1..2047 during long runs.
        const identity = `${actor.id}:${actor.spawnTick}`
        if (seen[lane].has(identity)) continue
        seen[lane].add(identity)
        run[lane].push({ ...actor, observedTick: frame.tick, observedWave: frame.wave })
      }
    }
    for (const lane of ['enemy', 'loot']) {
      for (const event of frame[`${lane}Events`]) {
        if (event.id <= seen[`${lane}Event`]) continue
        if (event.id > seen[`${lane}Event`] + 1) run.eventGaps.push({
          lane, after: seen[`${lane}Event`], before: event.id, observedTick: frame.tick,
        })
        seen[`${lane}Event`] = event.id
      }
    }
  }
}
