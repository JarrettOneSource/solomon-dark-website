import { applyChannelProjectileForce } from './projectile-forces.ts'
import {
  drawNativeDisintegratePercentile,
  drawNativeSpellDamage,
} from '../../core-kernels/air-water-spell-actors.ts'
import { drawNativeFloat, drawNativeInteger } from '../../core-kernels/native-rng.ts'
import {
  createNativeWeldBlizzardContactGlow,
  nativeWeldBlizzardContactPolygon,
} from '../../core-kernels/native-weld-blizzard.ts'
import { createNativeWeldFlameLashFade } from '../../core-kernels/native-weld-flame-lash.ts'
import {
  createNativeWeldBlizzardChainEffects,
} from '../../core-kernels/native-weld-primary-runtime.ts'
import {
  type PrimarySpellTarget,
  airPrimaryBoltGeometry,
  nativePrimaryConeTargets,
  nativePrimaryPolygonTargets,
  nativePrimaryTargetEligible,
  primarySpellTargetPoint,
} from '../../core-kernels/primary-spell-targeting.ts'
import { createPrimarySpellWeldFireDetonation } from '../../core-kernels/primary-spells.ts'
import {
  damageBoneyardEnemy,
} from '../enemies/damage.ts'
import {
  airStunModifier,
  applyDamageWithDisintegrate,
  channelSpellHit,
  validatedDamageMultiplier,
} from './damage.ts'
import { NATIVE_WELD_FROST_SLOW_FACTOR } from './model.ts'
import {
  applyBlizzardPushback,
  applyWaterPushback,
  frostJetPushBlocked,
  nativeWaterPushTargetFactor,
} from './pushback.ts'
import {
  boneyardSpellTargetById,
  bySpellId,
  nativePrimaryRootTargetRows,
  nearestUnusedAirChainTarget,
  normalizedDifference,
  primaryBlizzardTargetRows,
  primaryTargetRows,
  primaryWaterTargetRows,
  selectedAirTargets,
  selectedWeldTarget,
} from './targets.ts'
import { BoneyardSpellCombatWork } from './work.ts'

export const WATER_PRIMARY_ACTOR_MASK = 0x1082

export const WATER_PRIMARY_UNDERPOWERED_ACTOR_MASK = 0x2

export const NATIVE_CHILL_PROJECTILE_FORCE_FACTOR = Math.fround(0.3199999928474426)

const NATIVE_WELD_CHANNEL_MODIFIER_TICKS = 25

const NATIVE_BLIZZARD_CHAIN_RADIUS = 100

const NATIVE_LIGHTNING_CHAIN_DAMAGE_FACTOR = Math.fround(0.600000024)

const NATIVE_BLIZZARD_WEAK_COLD_SLOW_FACTOR = 0.75

export function resolveChannelContacts(work: BoneyardSpellCombatWork): void {
  for (const emission of [...work.channelEmissions].sort(bySpellId)) {
    if (emission.worldKey !== work.worldKey) continue
    if (emission.kind === 'air') {
      if (emission.primarySkill.kind !== 'air') {
        throw new Error('Air channel emission does not own an Air skill payload')
      }
      const rows = primaryTargetRows(work.enemies)
      const first = selectedAirTargets(rows, work.sourceSpells, emission)[0]
      if (!first) continue
      const contactedIds = new Set<string>()
      let target: PrimarySpellTarget | null = first
      let damage = emission.damage
      let previousPoint = emission.origin
      for (let hop = 0; target && hop <= emission.primarySkill.arcCount; hop += 1) {
        const row = primaryTargetRows(work.enemies).find(({ target: candidate }) => (
          candidate.id === target!.id
        ))
        if (!row || !nativePrimaryTargetEligible(row.target, 0x2)) break
        contactedIds.add(row.target.id)

        const stun = airStunModifier(emission)
        if (stun) work.queueTargetEffect(row.actor.id, stun)
        let disintegrate = false
        if (
          !emission.underpowered
          && emission.primarySkill.disintegrateChance > 0
          && (row.target.actorFlags & 0x2) !== 0
          && work.tick % 40 === row.disintegratePhase % 40
        ) {
          const draw = drawNativeDisintegratePercentile(
            work.rng,
            emission.primarySkill.disintegrateChance,
          )
          work.rng = draw.rng
          disintegrate = draw.success
        }
        // Lightning consumes this visual scalar after the optional execute
        // roll even though the web renderer receives semantic bolt geometry.
        const contactScalar = drawNativeFloat(work.rng, Math.fround(0.5))
        work.rng = contactScalar.state
        const electricDamage = damage * validatedDamageMultiplier(
          work.damageMultiplier(row.actor.id, 'air', emission.ownerId),
        )
        const contact = applyDamageWithDisintegrate(
          work.enemies,
          row.actor.id,
          electricDamage,
          emission.ownerId,
          work.tick,
          disintegrate,
          work.registerWorldPainter,
          work.lethalObserver,
        )
        work.enemies = contact.enemies
        work.events.push(...contact.events)
        if (contact.accepted) {
          work.hits.push({
            actorId: row.actor.id,
            amount: contact.amount,
            killed: contact.killed,
            ownerId: emission.ownerId,
            spellId: emission.id,
            spellKind: 'air',
            tick: work.tick,
          })
        }

        const currentPoint = primarySpellTargetPoint(row.target)
        if (hop > 0) {
          const direction = normalizedDifference(previousPoint, currentPoint)
          const geometry = airPrimaryBoltGeometry(previousPoint, direction, currentPoint)
          work.ownedTransients.push(work.enrollCombatActor({
            ageTicks: 0,
            birthTick: work.tick,
            direction,
            endpoint: geometry.endpoint,
            hurricaneCharge: 0,
            id: work.nextSpellId,
            kind: 'air',
            lightRegistration: work.registerCombatPainter('transient'),
            midpoint: geometry.midpoint,
            origin: geometry.source,
            ownerId: emission.ownerId,
            targetId: row.target.id,
            underpowered: emission.underpowered,
            variant: work.nextSpellId % 4,
            worldKey: work.worldKey,
          }))
          work.nextSpellId += 1
        }
        previousPoint = currentPoint
        damage = Math.fround(damage * NATIVE_LIGHTNING_CHAIN_DAMAGE_FACTOR)
        target = emission.underpowered || hop >= emission.primarySkill.arcCount
          ? null
          : nearestUnusedAirChainTarget(
          primaryTargetRows(work.enemies).map(({ target: candidate }) => candidate),
          row.target.position,
          contactedIds,
          )
      }
      continue
    }

    if (emission.kind === 'weld') {
      if (emission.primarySkill.kind !== 'weld') {
        throw new Error('Weld channel emission does not own a Weld skill payload')
      }
      const profile = emission.primarySkill
      switch (profile.buildId) {
        case 1003: {
          const first = selectedWeldTarget(primaryTargetRows(work.enemies), work.sourceSpells, emission)
          if (!first) break
          const contactedIds = new Set<string>()
          let target: PrimarySpellTarget | null = first
          let damage = emission.damage
          let previousPoint = emission.origin
          for (let hop = 0; target && hop <= profile.vector.values[2]!; hop += 1) {
            const row = primaryTargetRows(work.enemies).find(({ target: candidate }) => (
              candidate.id === target!.id
            ))
            if (!row || !nativePrimaryTargetEligible(row.target, 0x2)) break
            contactedIds.add(row.target.id)
            const stunFactor = profile.vector.values[3]!
            if (stunFactor < 1) {
              work.queueTargetEffect(row.actor.id, {
                stunFactor,
                stunTicks: NATIVE_WELD_CHANNEL_MODIFIER_TICKS,
              })
            }
            const amount = damage * validatedDamageMultiplier(
              work.damageMultiplier(row.actor.id, 'air', emission.ownerId),
            )
            const damaged = damageBoneyardEnemy(work.enemies, {
              magic: true,
              lethalObserver: work.lethalObserver,
              actorId: row.actor.id,
              amount,
              sourcePlayerId: emission.ownerId,
              registerWorldPainter: work.registerWorldPainter,
              tick: work.tick,
            })
            if (damaged.accepted) {
              work.enemies = damaged.store
              work.events.push(...damaged.events)
              work.hits.push(channelSpellHit(emission, row.actor.id, amount, damaged.killed, work.tick))
              const point = primarySpellTargetPoint(row.target)
              const fadeDirection = normalizedDifference(previousPoint, point)
              const fade = createNativeWeldFlameLashFade({
                direction: fadeDirection,
                id: work.nextSpellId,
                origin: point,
                ownerId: emission.ownerId,
                rng: work.rng,
                tick: work.tick,
                variant: 'chain',
                vector: profile.vector.values,
                worldKey: work.worldKey,
              })
              work.rng = fade.rng
              work.ownedTransients.push(work.enrollCombatActor(fade.actor))
              work.nextSpellId += 1
              const privateSeed = drawNativeInteger(work.rng, 1_000_000)
              work.rng = privateSeed.state
              const detonation = createPrimarySpellWeldFireDetonation(
                work.nextSpellId,
                {
                  buildId: 1003,
                  direction: normalizedDifference(previousPoint, point),
                  ownerId: emission.ownerId,
                  position: point,
                  vector: profile.vector.values,
                  worldKey: work.worldKey,
                },
                point,
                work.tick,
                work.rng,
                privateSeed.value,
                false,
                work.registerWorldPainter,
              )
              work.rng = detonation.rng
              work.pendingFireActorContacts.push(...detonation.contacts)
              work.ownedTransients.push(...work.enrollCombatActors(detonation.transients))
              work.nextSpellId = detonation.nextId
            }
            const currentPoint = primarySpellTargetPoint(row.target)
            if (hop > 0) {
              const direction = normalizedDifference(previousPoint, currentPoint)
              const geometry = airPrimaryBoltGeometry(
                previousPoint,
                direction,
                currentPoint,
              )
              work.ownedTransients.push(work.enrollCombatActor({
                ageTicks: 0,
                birthTick: work.tick,
                buildId: 1003,
                direction,
                endpoint: geometry.endpoint,
                id: work.nextSpellId,
                kind: 'weld-channel',
                lightRegistration: null,
                midpoint: geometry.midpoint,
                origin: { ...previousPoint },
                ownerId: emission.ownerId,
                targetId: row.target.id,
                underpowered: emission.underpowered,
                variant: work.nextSpellId % 4,
                vector: Object.freeze([...profile.vector.values]),
                worldKey: work.worldKey,
              }))
              work.nextSpellId += 1
            }
            previousPoint = currentPoint
            damage = Math.fround(damage * NATIVE_LIGHTNING_CHAIN_DAMAGE_FACTOR)
            target = nearestUnusedAirChainTarget(
              primaryTargetRows(work.enemies).map(({ target: candidate }) => candidate),
              row.target.position,
              contactedIds,
            )
          }
          break
        }
        case 1004: {
          if (emission.endpoint === null) break
          const rows = primaryBlizzardTargetRows(work.enemies, work.primarySceneryTargets)
          const polygon = nativeWeldBlizzardContactPolygon({
            endpoint: emission.endpoint,
            source: emission.origin,
            underpowered: emission.underpowered,
            widen: profile.vector.values[6]!,
          })
          const roots = nativePrimaryPolygonTargets({
            actorMask: 0x1086,
            polygon: polygon.points,
            targets: rows.map(({ target }) => target),
          })
          const contactedIds = new Set<string>()
          const chainSeedIds: string[] = []
          if (emission.terrainContact) {
            const glow = createNativeWeldBlizzardContactGlow({
              direction: emission.direction,
              id: work.nextSpellId,
              ownerId: emission.ownerId,
              position: emission.endpoint,
              registerWorldPainter: work.registerCombatPainter,
              rng: work.rng,
              tick: work.tick,
              vector: profile.vector.values,
              worldKey: work.worldKey,
            })
            work.rng = glow.rng
            work.ownedTransients.push(work.enrollCombatActor(glow.actor))
            work.nextSpellId += 1
          }
          for (const root of roots) {
            const row = rows.find(({ target }) => target.id === root.id)
            if (!row) continue
            if (row.kind === 'silk' || row.kind === 'arrow') {
              applyChannelProjectileForce(work, row, 100, emission.direction)
              continue
            }
            contactedIds.add(root.id)
            const glow = createNativeWeldBlizzardContactGlow({
              direction: emission.direction,
              id: work.nextSpellId,
              ownerId: emission.ownerId,
              position: root.position,
              registerWorldPainter: work.registerCombatPainter,
              rng: work.rng,
              tick: work.tick,
              vector: profile.vector.values,
              worldKey: work.worldKey,
            })
            work.rng = glow.rng
            work.ownedTransients.push(work.enrollCombatActor(glow.actor))
            work.nextSpellId += 1
            if (row.kind !== 'enemy' || !nativePrimaryTargetEligible(root, 0x2)) continue
            work.queueTargetEffect(row.actor.id, {
              coldSlowFactor: emission.underpowered
                ? NATIVE_BLIZZARD_WEAK_COLD_SLOW_FACTOR
                : NATIVE_WELD_FROST_SLOW_FACTOR,
              coldSlowMaterial: true,
              coldSlowTicks: NATIVE_WELD_CHANNEL_MODIFIER_TICKS,
            })
            const stunFactor = profile.vector.values[3]!
            if (!emission.underpowered && stunFactor < 1) {
              work.queueTargetEffect(row.actor.id, {
                stunFactor,
                stunTicks: NATIVE_WELD_CHANNEL_MODIFIER_TICKS,
              })
            }
            const amount = emission.damage * validatedDamageMultiplier(
              work.damageMultiplier(row.actor.id, 'air', emission.ownerId),
            )
            const damaged = damageBoneyardEnemy(work.enemies, {
              magic: true,
              lethalObserver: work.lethalObserver,
              actorId: row.actor.id,
              amount,
              sourcePlayerId: emission.ownerId,
              registerWorldPainter: work.registerWorldPainter,
              tick: work.tick,
            })
            if (damaged.accepted) {
              work.enemies = damaged.store
              work.events.push(...damaged.events)
              work.hits.push(channelSpellHit(emission, row.actor.id, amount, damaged.killed, work.tick))
            }
            if (!emission.underpowered && profile.vector.values[5]! > 0) {
              work.enemies = applyBlizzardPushback(
                work.enemies,
                row.actor.id,
                root.actorFlags,
                emission.queryOrigin,
                profile.vector.values[5]!,
                work.tick,
                work.resolveEnemyMovement,
              )
            }
            if (!emission.underpowered && profile.vector.values[2]! > 0) {
              chainSeedIds.push(root.id)
            }
          }
          for (const seedId of chainSeedIds) {
            let source = primaryTargetRows(work.enemies).find(({ target }) => (
              target.id === seedId
            ))?.target
            if (!source) continue
            let damage = Math.fround(emission.damage * NATIVE_LIGHTNING_CHAIN_DAMAGE_FACTOR)
            for (let hop = 0; hop < profile.vector.values[2]!; hop += 1) {
              const target = nearestUnusedAirChainTarget(
                primaryTargetRows(work.enemies).map(({ target: candidate }) => candidate),
                source.position,
                contactedIds,
                NATIVE_BLIZZARD_CHAIN_RADIUS,
              )
              if (target === null) break
              const row = primaryTargetRows(work.enemies).find(({ target: candidate }) => (
                candidate.id === target.id
              ))
              if (!row || !nativePrimaryTargetEligible(row.target, 0x2)) break
              contactedIds.add(row.target.id)
              const direction = normalizedDifference(source.position, row.target.position)
              const effects = createNativeWeldBlizzardChainEffects({
                castDirection: emission.direction,
                direction,
                firstId: work.nextSpellId,
                ownerId: emission.ownerId,
                registerWorldPainter: work.registerCombatPainter,
                rng: work.rng,
                source: source.position,
                tick: work.tick,
                vector: profile.vector.values,
                worldKey: work.worldKey,
              })
              work.rng = effects.rng
              work.ownedTransients.push(...work.enrollCombatActors(effects.actors))
              work.nextSpellId = effects.nextId
              work.queueTargetEffect(row.actor.id, {
                coldSlowFactor: NATIVE_WELD_FROST_SLOW_FACTOR,
                coldSlowMaterial: true,
                coldSlowTicks: NATIVE_WELD_CHANNEL_MODIFIER_TICKS,
              })
              const stunFactor = profile.vector.values[3]!
              if (stunFactor < 1) {
                work.queueTargetEffect(row.actor.id, {
                  stunFactor,
                  stunTicks: NATIVE_WELD_CHANNEL_MODIFIER_TICKS,
                })
              }
              const amount = damage * validatedDamageMultiplier(
                work.damageMultiplier(row.actor.id, 'air', emission.ownerId),
              )
              const damaged = damageBoneyardEnemy(work.enemies, {
                magic: true,
                lethalObserver: work.lethalObserver,
                actorId: row.actor.id,
                amount,
                sourcePlayerId: emission.ownerId,
                registerWorldPainter: work.registerWorldPainter,
                tick: work.tick,
              })
              if (damaged.accepted) {
                work.enemies = damaged.store
                work.events.push(...damaged.events)
                work.hits.push(channelSpellHit(emission, row.actor.id, amount, damaged.killed, work.tick))
              }
              source = row.target
              damage = Math.fround(damage * NATIVE_LIGHTNING_CHAIN_DAMAGE_FACTOR)
            }
          }
          break
        }
        case 1005: {
          const widen = emission.underpowered ? 0 : profile.vector.values[2]!
          const pushback = emission.underpowered ? 0 : profile.vector.values[3]!
          if (pushback <= 0) break
          const rows = primaryWaterTargetRows(work.enemies)
          const contacts = nativePrimaryConeTargets({
            actorMask: 0x1082,
            aimDirection: emission.direction,
            halfAngleDegrees: 15 + widen * 0.5,
            hasLineOfSight: (target) => (
              work.firstWorldContact?.(emission.queryOrigin, target.position, 0) ?? null
            ) === null,
            origin: emission.queryOrigin,
            reach: 205 + 4 * widen,
            targets: rows.map(({ target }) => target),
          })
          for (const target of contacts) {
            const row = rows.find(({ target: candidate }) => (
              candidate.id === target.id
            ))
            if (!row) continue
            if (row.kind === 'silk' || row.kind === 'arrow') {
              applyChannelProjectileForce(work, row,
                Math.fround(pushback * NATIVE_CHILL_PROJECTILE_FORCE_FACTOR), emission.direction)
              continue
            }
            work.enemies = applyWaterPushback(
              work.enemies,
              row.actor,
              emission.queryOrigin,
              pushback,
              205 + 4 * widen,
              1,
              work.resolveEnemyMovement,
            )
          }
          break
        }
        default:
          throw new Error(`weld channel build ${profile.buildId} is not supported`)
      }
      continue
    }

    if (emission.primarySkill.kind !== 'water') {
      throw new Error('Water channel emission does not own a Water skill payload')
    }
    const profile = emission.primarySkill
    const pushbackFactor = emission.underpowered
      ? 0
      : profile.pushbackFactor
    const rows = primaryWaterTargetRows(work.enemies)
    const contacts = nativePrimaryConeTargets({
      actorMask: emission.underpowered
        ? WATER_PRIMARY_UNDERPOWERED_ACTOR_MASK
        : WATER_PRIMARY_ACTOR_MASK,
      aimDirection: emission.direction,
      halfAngleDegrees: emission.underpowered ? 15 : profile.halfAngleDegrees,
      hasLineOfSight: (target) => (
        work.firstWorldContact?.(emission.queryOrigin, target.position, 0) ?? null
      ) === null,
      origin: emission.queryOrigin,
      reach: emission.underpowered ? 205 : profile.reach,
      targets: rows.map(({ target }) => target),
    })
    for (const target of contacts) {
      const row = rows.find(({ target: candidate }) => (
        candidate.id === target.id
      ))
      if (!row) continue
      if (row.kind === 'silk' || row.kind === 'arrow') {
        applyChannelProjectileForce(work, row,
          Math.fround(pushbackFactor * NATIVE_CHILL_PROJECTILE_FORCE_FACTOR), emission.direction)
        continue
      }
      work.queueTargetEffect(row.actor.id, {
        coldSlowFactor: emission.underpowered ? 0.75 : profile.coldMovementFactor,
        coldSlowMaterial: true,
        coldSlowTicks: emission.underpowered ? 25 : profile.coldDurationTicks,
      })
      const amount = emission.damage * validatedDamageMultiplier(
        work.damageMultiplier(row.actor.id, 'water', emission.ownerId),
      )
      const damaged = damageBoneyardEnemy(work.enemies, {
        magic: true,
        actorId: row.actor.id,
        amount,
        lethalObserver: work.lethalObserver,
        sourcePlayerId: emission.ownerId,
        registerWorldPainter: work.registerWorldPainter,
        tick: work.tick,
      })
      if (damaged.accepted) {
        work.enemies = damaged.store
        work.events.push(...damaged.events)
        work.hits.push({
          actorId: row.actor.id,
          amount,
          killed: damaged.killed,
          ownerId: emission.ownerId,
          spellId: emission.id,
          spellKind: 'water',
          tick: work.tick,
        })

        if (!emission.underpowered && profile.hailThreshold > 0) {
          const hail = drawNativeInteger(work.rng, 3_000)
          work.rng = hail.state
          if (hail.value < profile.hailThreshold) {
            const hailDamage = drawNativeSpellDamage(
              work.rng,
              profile.hailDamageMinimum,
              profile.hailDamageMaximum,
            )
            work.rng = hailDamage.rng
            const hailAmount = hailDamage.value * validatedDamageMultiplier(
              work.damageMultiplier(row.actor.id, 'water-hail', emission.ownerId),
            )
            const hailContact = damageBoneyardEnemy(work.enemies, {
              magic: true,
              lethalObserver: work.lethalObserver,
              actorId: row.actor.id,
              amount: hailAmount,
              sourcePlayerId: emission.ownerId,
              registerWorldPainter: work.registerWorldPainter,
              tick: work.tick,
            })
            if (hailContact.accepted) {
              work.enemies = hailContact.store
              work.events.push(...hailContact.events)
              work.hits.push({
                actorId: row.actor.id,
                amount: hailAmount,
                killed: hailContact.killed,
                ownerId: emission.ownerId,
                spellId: emission.id,
                spellKind: 'water-hail',
                tick: work.tick,
              })
            }
          }
        }
      }

      const liveActor = boneyardSpellTargetById(work.enemies, row.actor.id)
      if (
        pushbackFactor > 0
        && liveActor !== null
        && !frostJetPushBlocked(work.enemies, liveActor, emission.origin)
      ) {
        work.enemies = applyWaterPushback(
          work.enemies,
          liveActor,
          emission.origin,
          pushbackFactor,
          profile.reach,
          nativeWaterPushTargetFactor(target.actorFlags),
          work.resolveEnemyMovement,
        )
      }
    }

    if (!emission.underpowered && profile.auraRadius > 0) {
      for (const row of nativePrimaryRootTargetRows(
        work.enemies,
        emission.queryOrigin,
        profile.auraRadius,
        0x2,
      )) {
        work.queueTargetEffect(row.actor.id, {
          coldSlowFactor: profile.auraMovementFactor,
          coldSlowMaterial: true,
          coldSlowTicks: profile.coldDurationTicks,
        })
      }
    }
  }
}
