import { nativeWorldPuppetHits } from './native-state.ts'
import type { BoneyardGateLeafSnapshot } from '../../core-kernels/boneyard.ts'
import type { GameRunLifecycleState } from '../../core-kernels/game-run.ts'
import { NATIVE_HALL_OF_FAME_SCORE } from '../../core-kernels/hall-of-fame-score.ts'
import type { NativeEnemyWorldFeedbackKernelState } from '../../core-kernels/native-enemy-world-feedback.ts'
import { NATIVE_ENEMY_WORLD_FEEDBACK } from '../../core-kernels/native-enemy-world-feedback.ts'
import { REPLICATED_ENTITY_TYPE_REGISTRY } from '../entity-replication.ts'
import { MAX_BONEYARD_ENEMIES, MAX_BONEYARD_ENEMY_DEATH_EFFECTS, MAX_BONEYARD_ENEMY_PROJECTILES, MAX_BONEYARD_ENEMY_PROJECTILE_EFFECTS, MAX_BONEYARD_GOODIES, MAX_BONEYARD_LOOT, MAX_BONEYARD_MAGGOTS, MAX_BONEYARD_STRUCTURES, MAX_PLAYERS, MAX_REPLICATED_COMPONENTS, MAX_REPLICATED_ENTITIES } from '../game-protocol-limits.ts'
import type { GameSnapshot, GameSnapshotFrame, NativeHallOfFameRunSnapshot, ProtocolHubParticipantState } from '../game-state.ts'
import type { ReplicatedEntityDescriptor, ReplicatedEntityFrame, ReplicatedEntityKey, ReplicatedEntitySample } from '../replicated-entity-types.ts'
import { nativeBossNarration } from './boss-narration.ts'
import { nativeBossSpells } from './boss-spells.ts'
import { boneyardEnemySnapshot } from './enemies.ts'
import { boneyardEnemyDeathEffectSnapshot, boneyardEnemyEvents, boneyardMageLightningPulseFrames, boneyardMageLightningPulses } from './enemy-effects.ts'
import { boneyardEnemyProjectileEffectSnapshot, boneyardEnemyProjectileSnapshot, boneyardMaggotSnapshot } from './enemy-projectiles.ts'
import { ambientState, decodeHubMemorialState, hubParticipantState, hubSkorchaState, hubWorldSnapshot } from './hub.ts'
import { boneyardGoodieSnapshot, boneyardLootEvents, boneyardLootSnapshot } from './loot.ts'
import { boneyardPoint, nullableNativeWorldManagerRegistration, vector } from './native-state.ts'
import { boneyardArenaTransition } from './scene.ts'
import { spiderWorldFields } from './spiders.ts'
import { boneyardSolomonSnapshot, boneyardWaveSnapshot, nativeTutorialState } from './survival.ts'
import { GameProtocolError, boolean, boundedInteger, finite, limitedArray, limitedString, nonnegativeFinite, nonnegativeInteger, onlyKeys, positiveFinite, positiveInteger, record, validatedPlayerId } from './values.ts'
function nativeHallOfFameRunSnapshots(
  value: unknown,
  field: string,
  snapshotTick: number,
): Readonly<Record<string, NativeHallOfFameRunSnapshot>> {
  const source = record(value, field)
  if (Object.keys(source).length > MAX_PLAYERS) {
    throw new GameProtocolError(`${field} may contain at most ${MAX_PLAYERS} entries`)
  }
  const runs: Record<string, NativeHallOfFameRunSnapshot> = {}
  for (const [rawPlayerId, value] of Object.entries(source)) {
    const playerId = validatedPlayerId(rawPlayerId, `${field} player id`)
    const runField = `${field}.${playerId}`
    const run = record(value, runField)
    onlyKeys(run, runField, [
      'awesomeness',
      'awesomestKill',
      'elapsedTicks',
      'monstersKilled',
      'portraitHeadingIndex',
      'portraitScale',
    ])
    const elapsedTicks = run.elapsedTicks === null
      ? null
      : boundedInteger(run.elapsedTicks, `${runField}.elapsedTicks`, 0, 60_480_000)
    if (elapsedTicks !== null && elapsedTicks > snapshotTick) {
      throw new GameProtocolError(`${runField}.elapsedTicks exceeds its snapshot tick`)
    }
    const awesomestKill = run.awesomestKill === null
      ? null
      : limitedString(run.awesomestKill, `${runField}.awesomestKill`, 64)
    if (awesomestKill === '') {
      throw new GameProtocolError(`${runField}.awesomestKill must not be empty`)
    }
    const portraitHeadingIndex = run.portraitHeadingIndex === null
      ? null
      : boundedInteger(
          run.portraitHeadingIndex,
          `${runField}.portraitHeadingIndex`,
          0,
          23,
        )
    const portraitScale = run.portraitScale === null
      ? null
      : positiveFinite(run.portraitScale, `${runField}.portraitScale`)
    if (portraitScale !== null && (
      portraitScale < NATIVE_HALL_OF_FAME_SCORE.portraitScaleBase
      || portraitScale > 1
    )) throw new GameProtocolError(`${runField}.portraitScale is outside its native range`)
    runs[playerId] = {
      awesomeness: boundedInteger(
        run.awesomeness,
        `${runField}.awesomeness`,
        0,
        2_000_000_000,
      ),
      awesomestKill,
      elapsedTicks,
      monstersKilled: boundedInteger(
        run.monstersKilled,
        `${runField}.monstersKilled`,
        0,
        2_000_000_000,
      ),
      portraitHeadingIndex,
      portraitScale,
    }
  }
  return runs
}

function nativeEnemyWorldFeedbackState(
  value: unknown,
  field: string,
): NativeEnemyWorldFeedbackKernelState {
  const source = record(value, field)
  onlyKeys(source, field, ['accumulator', 'magnitude'])
  const accumulator = nonnegativeFinite(source.accumulator, `${field}.accumulator`)
  const magnitude = nonnegativeFinite(source.magnitude, `${field}.magnitude`)
  if (
    accumulator > NATIVE_ENEMY_WORLD_FEEDBACK.accumulatorCap
    || magnitude > NATIVE_ENEMY_WORLD_FEEDBACK.magnitudeCap
  ) {
    throw new GameProtocolError(`${field} exceeds the native enemy-feedback bounds`)
  }
  return { accumulator, magnitude }
}

export function validateHallOfFameRunOwners(
  runs: Readonly<Record<string, NativeHallOfFameRunSnapshot>>,
  players: Readonly<Record<string, unknown>>,
  field: string,
): void {
  const runPlayerIds = Object.keys(runs).sort()
  const playerIds = Object.keys(players).sort()
  if (
    runPlayerIds.length !== playerIds.length
    || runPlayerIds.some((playerId, index) => playerId !== playerIds[index])
  ) {
    throw new GameProtocolError(
      `${field}.world.hallOfFameRuns must match ${field}.players exactly`,
    )
  }
}

export function validateHallOfFameArchivePhase(
  run: GameRunLifecycleState,
  world: GameSnapshot['world'] | GameSnapshotFrame['world'],
  field: string,
): void {
  if (world.kind !== 'boneyard') return
  const archived = run.phase === 'game-over'
    && run.gameOverTicks >= NATIVE_HALL_OF_FAME_SCORE.archiveDeathTick
  if (Object.values(world.hallOfFameRuns).some(
    ({ elapsedTicks, portraitHeadingIndex, portraitScale }) => (
      (elapsedTicks !== null) !== archived
      || (portraitHeadingIndex !== null) !== archived
      || (portraitScale !== null) !== archived
    ),
  )) {
    throw new GameProtocolError(
      `${field}.world Hall archive timing does not match ${field}.run`,
    )
  }
}

export function gameWorldSnapshot(
  value: unknown,
  field: string,
  snapshotTick: number,
): GameSnapshot['world'] {
  const source = record(value, field)
  if (source.kind === 'hub') return hubWorldSnapshot(source, field)
  if (source.kind === 'boneyard') {
    onlyKeys(source, field, [
      'spiderSilks',
      'silkFragments',
      'spiderRemains',
      'webbedPlayers',
      'featuredBossId',
      'bossNarration',
      'bossSpells',
      'puppetHits',
      'arenaTransition',
      'deathEffects',
      'encounter',
      'enemies',
      'enemyEvents',
      'enemyWorldFeedback',
      'enemyProjectileEffects',
      'enemyProjectiles',
      'gateLeaves',
      'goodies',
      'hallOfFameRuns',
      'kind',
      'lanternLightRegistration',
      'lanternPosition',
      'loot',
      'lootEvents',
      'mageLightningPulses',
      'maggots',
      'runId',
      'solomonPainterRegistration',
      'tutorial',
      'waves',
    ])
    const encounter = boneyardSolomonSnapshot(
      source.encounter,
      `${field}.encounter`,
      snapshotTick,
    )
    const waves = boneyardWaveSnapshot(source.waves, `${field}.waves`)
    const tutorial = nativeTutorialState(source.tutorial, `${field}.tutorial`)
    const arenaTransition = boneyardArenaTransition(
      source.arenaTransition,
      `${field}.arenaTransition`,
    )
    if (tutorial === null && (
      (encounter === null) !== (waves === null)
      || (encounter === null) !== (arenaTransition === null)
    )) {
      throw new GameProtocolError(
        `${field}.arenaTransition, ${field}.encounter, and ${field}.waves must share ownership`,
      )
    }
    if (
      tutorial !== null
      && (encounter === null || waves !== null || arenaTransition !== null)
    ) throw new GameProtocolError(`${field}.tutorial owns Solomon without retail waves/entrance`)
    const runId = limitedString(source.runId, `${field}.runId`, 128)
    const hallOfFameRuns = nativeHallOfFameRunSnapshots(
      source.hallOfFameRuns,
      `${field}.hallOfFameRuns`,
      snapshotTick,
    )
    const enemyWorldFeedback = nativeEnemyWorldFeedbackState(
      source.enemyWorldFeedback,
      `${field}.enemyWorldFeedback`,
    )
    const enemyEvents = boneyardEnemyEvents(
      source.enemyEvents,
      `${field}.enemyEvents`,
      runId,
      snapshotTick,
    )
    const lootEvents = boneyardLootEvents(
      source.lootEvents,
      `${field}.lootEvents`,
      runId,
      snapshotTick,
    )
    const mageLightningPulses = boneyardMageLightningPulses(
      source.mageLightningPulses,
      `${field}.mageLightningPulses`,
      snapshotTick,
    )
    const enemyIds = new Set<number>()
    const enemies = limitedArray(
      source.enemies,
      `${field}.enemies`,
      MAX_BONEYARD_ENEMIES,
    ).map((enemy, index) => {
      const decoded = boneyardEnemySnapshot(enemy, `${field}.enemies[${index}]`)
      if (enemyIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.enemies duplicates id ${decoded.id}`)
      }
      enemyIds.add(decoded.id)
      return decoded
    })
    const featuredBossId = source.featuredBossId === null
      ? null : positiveInteger(source.featuredBossId, `${field}.featuredBossId`)
    if (featuredBossId !== null && !enemies.some(enemy => enemy.id === featuredBossId
      && enemy.classification !== 'normal' && enemy.currentHealth > 0)) {
      throw new GameProtocolError(`${field}.featuredBossId must refer to a living boss or miniboss`)
    }
    const deathEffectIds = new Set<number>()
    const deathEffects = limitedArray(
      source.deathEffects,
      `${field}.deathEffects`,
      MAX_BONEYARD_ENEMY_DEATH_EFFECTS,
    ).map((effect, index) => {
      const decoded = boneyardEnemyDeathEffectSnapshot(
        effect,
        `${field}.deathEffects[${index}]`,
      )
      if (deathEffectIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.deathEffects duplicates id ${decoded.id}`)
      }
      deathEffectIds.add(decoded.id)
      return decoded
    })
    const projectileIds = new Set<number>()
    const enemyProjectiles = limitedArray(
      source.enemyProjectiles,
      `${field}.enemyProjectiles`,
      MAX_BONEYARD_ENEMY_PROJECTILES,
    ).map((projectile, index) => {
      const decoded = boneyardEnemyProjectileSnapshot(
        projectile,
        `${field}.enemyProjectiles[${index}]`,
      )
      if (projectileIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.enemyProjectiles duplicates id ${decoded.id}`)
      }
      projectileIds.add(decoded.id)
      return decoded
    })
    const projectileEffectIds = new Set<number>()
    const enemyProjectileEffects = limitedArray(
      source.enemyProjectileEffects,
      `${field}.enemyProjectileEffects`,
      MAX_BONEYARD_ENEMY_PROJECTILE_EFFECTS,
    ).map((effect, index) => {
      const decoded = boneyardEnemyProjectileEffectSnapshot(
        effect,
        `${field}.enemyProjectileEffects[${index}]`,
      )
      if (projectileEffectIds.has(decoded.id)) {
        throw new GameProtocolError(
          `${field}.enemyProjectileEffects duplicates id ${decoded.id}`,
        )
      }
      projectileEffectIds.add(decoded.id)
      return decoded
    })
    const maggotIds = new Set<number>()
    const maggots = limitedArray(
      source.maggots,
      `${field}.maggots`,
      MAX_BONEYARD_MAGGOTS,
    ).map((maggot, index) => {
      const decoded = boneyardMaggotSnapshot(maggot, `${field}.maggots[${index}]`)
      if (maggotIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.maggots duplicates id ${decoded.id}`)
      }
      maggotIds.add(decoded.id)
      return decoded
    })
    const lootIds = new Set<number>()
    const loot = limitedArray(source.loot, `${field}.loot`, MAX_BONEYARD_LOOT)
      .map((entry, index) => {
        const decoded = boneyardLootSnapshot(entry, `${field}.loot[${index}]`)
        if (lootIds.has(decoded.id)) {
          throw new GameProtocolError(`${field}.loot duplicates id ${decoded.id}`)
        }
        lootIds.add(decoded.id)
        return decoded
      })
    const goodieIds = new Set<number>()
    const goodies = limitedArray(
      source.goodies,
      `${field}.goodies`,
      MAX_BONEYARD_GOODIES,
    ).map((entry, index) => {
      const decoded = boneyardGoodieSnapshot(entry, `${field}.goodies[${index}]`)
      if (goodieIds.has(decoded.id)) {
        throw new GameProtocolError(`${field}.goodies duplicates id ${decoded.id}`)
      }
      goodieIds.add(decoded.id)
      return decoded
    })
    return {
      ...spiderWorldFields(source, field, snapshotTick),
      arenaTransition,
      featuredBossId,
      bossNarration: nativeBossNarration(source.bossNarration, `${field}.bossNarration`, snapshotTick),
      bossSpells: nativeBossSpells(source.bossSpells, `${field}.bossSpells`, snapshotTick),
      puppetHits: nativeWorldPuppetHits(source.puppetHits, `${field}.puppetHits`, snapshotTick),
      deathEffects,
      encounter,
      enemies,
      enemyEvents,
      enemyWorldFeedback,
      enemyProjectileEffects,
      enemyProjectiles,
      gateLeaves: limitedArray(
        source.gateLeaves,
        `${field}.gateLeaves`,
        MAX_BONEYARD_STRUCTURES * 2,
      ).map((leaf, index) => boneyardGateLeafSnapshot(
        leaf,
        `${field}.gateLeaves[${index}]`,
      )),
      goodies,
      hallOfFameRuns,
      kind: 'boneyard',
      lanternPosition: source.lanternPosition === null
        ? null : vector(source.lanternPosition, `${field}.lanternPosition`),
      lanternLightRegistration: nullableNativeWorldManagerRegistration(
        source.lanternLightRegistration,
        `${field}.lanternLightRegistration`,
        'actor',
      ),
      mageLightningPulses,
      maggots,
      loot,
      lootEvents,
      runId,
      solomonPainterRegistration: nullableNativeWorldManagerRegistration(
        source.solomonPainterRegistration,
        `${field}.solomonPainterRegistration`,
        'actor',
      ),
      tutorial,
      waves,
    }
  }
  throw new GameProtocolError(`${field}.kind is not supported`)
}

export function gameWorldSnapshotFrame(
  value: unknown,
  field: string,
  snapshotTick: number,
): GameSnapshotFrame['world'] {
  const source = record(value, field)
  if (source.kind === 'boneyard') {
    onlyKeys(source, field, [
      'spiderSilks',
      'silkFragments',
      'spiderRemains',
      'webbedPlayers',
      'featuredBossId',
      'bossNarration',
      'bossSpells',
      'puppetHits',
      'arenaTransition',
      'encounter',
      'entities',
      'enemyEvents',
      'enemyWorldFeedback',
      'gateLeaves',
      'hallOfFameRuns',
      'kind',
      'lanternLightRegistration',
      'lanternPosition',
      'lootEvents',
      'mageLightningPulses',
      'runId',
      'solomonPainterRegistration',
      'tutorial',
      'waves',
    ])
    const encounter = boneyardSolomonSnapshot(
      source.encounter,
      `${field}.encounter`,
      snapshotTick,
    )
    const waves = boneyardWaveSnapshot(source.waves, `${field}.waves`)
    const tutorial = nativeTutorialState(source.tutorial, `${field}.tutorial`)
    const arenaTransition = boneyardArenaTransition(
      source.arenaTransition,
      `${field}.arenaTransition`,
    )
    if (tutorial === null && (
      (encounter === null) !== (waves === null)
      || (encounter === null) !== (arenaTransition === null)
    )) {
      throw new GameProtocolError(
        `${field}.arenaTransition, ${field}.encounter, and ${field}.waves must share ownership`,
      )
    }
    if (
      tutorial !== null
      && (encounter === null || waves !== null || arenaTransition !== null)
    ) throw new GameProtocolError(`${field}.tutorial owns Solomon without retail waves/entrance`)
    const runId = limitedString(source.runId, `${field}.runId`, 128)
    return {
      ...spiderWorldFields(source, field, snapshotTick),
      arenaTransition,
      featuredBossId: source.featuredBossId === null ? null : positiveInteger(source.featuredBossId, `${field}.featuredBossId`),
      bossNarration: nativeBossNarration(source.bossNarration, `${field}.bossNarration`, snapshotTick),
      bossSpells: nativeBossSpells(source.bossSpells, `${field}.bossSpells`, snapshotTick),
      puppetHits: nativeWorldPuppetHits(source.puppetHits, `${field}.puppetHits`, snapshotTick),
      encounter,
      entities: replicatedEntityFrame(source.entities, `${field}.entities`),
      enemyEvents: boneyardEnemyEvents(
        source.enemyEvents,
        `${field}.enemyEvents`,
        runId,
        snapshotTick,
      ),
      enemyWorldFeedback: nativeEnemyWorldFeedbackState(
        source.enemyWorldFeedback,
        `${field}.enemyWorldFeedback`,
      ),
      gateLeaves: limitedArray(
        source.gateLeaves,
        `${field}.gateLeaves`,
        MAX_BONEYARD_STRUCTURES * 2,
      ).map((leaf, index) => boneyardGateLeafSnapshot(
        leaf,
        `${field}.gateLeaves[${index}]`,
      )),
      hallOfFameRuns: nativeHallOfFameRunSnapshots(
        source.hallOfFameRuns,
        `${field}.hallOfFameRuns`,
        snapshotTick,
      ),
      kind: 'boneyard',
      lanternPosition: source.lanternPosition === null
        ? null : vector(source.lanternPosition, `${field}.lanternPosition`),
      lanternLightRegistration: nullableNativeWorldManagerRegistration(
        source.lanternLightRegistration,
        `${field}.lanternLightRegistration`,
        'actor',
      ),
      lootEvents: boneyardLootEvents(
        source.lootEvents,
        `${field}.lootEvents`,
        runId,
        snapshotTick,
      ),
      mageLightningPulses: boneyardMageLightningPulseFrames(
        source.mageLightningPulses,
        `${field}.mageLightningPulses`,
        snapshotTick,
      ),
      runId,
      solomonPainterRegistration: nullableNativeWorldManagerRegistration(
        source.solomonPainterRegistration,
        `${field}.solomonPainterRegistration`,
        'actor',
      ),
      tutorial,
      waves,
    }
  }
  if (source.kind !== 'hub') throw new GameProtocolError(`${field}.kind is not supported`)
  onlyKeys(source, field, [
    'ambient',
    'collisionRngState',
    'entities',
    'kind',
    'memorial',
    'participants',
    'skorcha',
    'traderAnimationSeed',
  ])
  const rawParticipants = record(source.participants, `${field}.participants`)
  if (Object.keys(rawParticipants).length > MAX_PLAYERS) {
    throw new GameProtocolError(
      `${field}.participants may contain at most ${MAX_PLAYERS} entries`,
    )
  }
  const participants: Record<string, ProtocolHubParticipantState> = {}
  for (const [rawPlayerId, state] of Object.entries(rawParticipants)) {
    const playerId = validatedPlayerId(rawPlayerId, `${field} participant id`)
    participants[playerId] = hubParticipantState(
      state,
      `${field}.participants.${playerId}`,
    )
  }
  return {
    ambient: ambientState(source.ambient, `${field}.ambient`),
    collisionRngState: nonnegativeInteger(
      source.collisionRngState,
      `${field}.collisionRngState`,
    ),
    entities: replicatedEntityFrame(source.entities, `${field}.entities`),
    kind: 'hub',
    memorial: decodeHubMemorialState(source.memorial, `${field}.memorial`),
    participants,
    skorcha: hubSkorchaState(source.skorcha, `${field}.skorcha`),
    traderAnimationSeed: nonnegativeInteger(
      source.traderAnimationSeed,
      `${field}.traderAnimationSeed`,
    ),
  }
}

function replicatedEntityFrame(value: unknown, field: string): ReplicatedEntityFrame {
  const source = record(value, field)
  onlyKeys(source, field, [
    'baselineSequence',
    'keyframe',
    'retired',
    'samples',
    'spawned',
  ])
  const keyframe = boolean(source.keyframe, `${field}.keyframe`)
  const baselineSequence = nonnegativeInteger(
    source.baselineSequence,
    `${field}.baselineSequence`,
  )
  if (keyframe && baselineSequence !== 0) {
    throw new GameProtocolError(`${field}.baselineSequence must be zero for a keyframe`)
  }
  return {
    baselineSequence,
    keyframe,
    retired: uniqueEntityEntries(
      source.retired,
      `${field}.retired`,
      'key',
    ) as unknown as readonly ReplicatedEntityKey[],
    samples: uniqueEntityEntries(
      source.samples,
      `${field}.samples`,
      'sample',
    ) as unknown as readonly ReplicatedEntitySample[],
    spawned: uniqueEntityEntries(
      source.spawned,
      `${field}.spawned`,
      'descriptor',
    ) as unknown as readonly ReplicatedEntityDescriptor[],
  }
}

function uniqueEntityEntries(
  value: unknown,
  field: string,
  kind: 'descriptor' | 'key' | 'sample',
): readonly number[][] {
  const entries = limitedArray(value, field, MAX_REPLICATED_ENTITIES)
  const result: number[][] = []
  const keys = new Set<string>()
  for (let index = 0; index < entries.length; index += 1) {
    const entryField = `${field}[${index}]`
    const raw = limitedArray(entries[index], entryField, MAX_REPLICATED_COMPONENTS)
    if (raw.length < 2 || (kind === 'key' && raw.length !== 2)) {
      throw new GameProtocolError(`${entryField} has an invalid component count`)
    }
    const typeId = nonnegativeInteger(raw[0], `${entryField}[0]`)
    const entityId = nonnegativeInteger(raw[1], `${entryField}[1]`)
    const registration = REPLICATED_ENTITY_TYPE_REGISTRY.get(typeId)
    if (!registration) {
      throw new GameProtocolError(`${entryField} uses an unknown entity type`)
    }
    const key = `${typeId}:${entityId}`
    if (keys.has(key)) throw new GameProtocolError(`${entryField} duplicates ${key}`)
    keys.add(key)
    const decoded: [number, number, ...number[]] = [
      typeId,
      entityId,
      ...raw.slice(2).map((component, componentIndex) => finite(
        component,
        `${entryField}[${componentIndex + 2}]`,
      )),
    ]
    if (
      (kind === 'descriptor' && !registration.descriptorIsValid(decoded))
      || (kind === 'sample' && !registration.sampleIsValid(decoded))
    ) throw new GameProtocolError(`${entryField} has an invalid registered ${kind} shape`)
    result.push(decoded)
  }
  return result
}

function boneyardGateLeafSnapshot(
  value: unknown,
  field: string,
): BoneyardGateLeafSnapshot {
  const source = record(value, field)
  onlyKeys(source, field, ['fenceEid', 'hinge', 'id', 'side', 'tip'])
  const side = nonnegativeInteger(source.side, `${field}.side`)
  if (side !== 0 && side !== 1) {
    throw new GameProtocolError(`${field}.side must be 0 or 1`)
  }
  return {
    fenceEid: limitedString(source.fenceEid, `${field}.fenceEid`, 128),
    hinge: boneyardPoint(source.hinge, `${field}.hinge`),
    id: limitedString(source.id, `${field}.id`, 256),
    side,
    tip: boneyardPoint(source.tip, `${field}.tip`),
  }
}
