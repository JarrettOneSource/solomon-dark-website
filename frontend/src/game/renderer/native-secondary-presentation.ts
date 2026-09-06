export { NativeSecondaryScreenFeedbackPresentation,nativeSecondaryWorldShake,presentNativeSecondaryScreenOverlay } from './native-screen-feedback.ts'
export { clampEntry,degreesToRadians,hashUnit,packGray,packNormalizedRgb,positiveModulo,repeatedFloatDecay,repeatedFloatMultiply,secondarySprite,WHITE } from './native-secondary-draws.ts'
export { magicCircleRingDraws,NATIVE_PLAYER_MAGIC_SHIELD,nativeLeviathanCompositePlan,nativePlayerMagicShieldPlan,nativeSecondaryCompositeOwnerEntries,planeOrbMesh,prismaticWaveDraws } from './native-secondary-field-presentation.ts'
export { nativeGolemDeathPresentationPlan,nativeGolemFacing,nativeGolemPresentationPlan } from './native-secondary-golem-presentation.ts'
export { ACID_SPLASH_INITIAL_LIFE,NativeSecondaryPresentationScratch } from './native-secondary-presentation-scratch.ts'
export type * from './native-secondary-presentation-types.ts'
import type {
  NativeSecondaryActorState,
} from '../core-kernels/native-secondary-abilities.ts'
import {
  nativeLeviathanAppendageLocalRoot,
  nativeLeviathanAppendageRecord,
} from '../core-kernels/native-secondary-leviathan.ts'
import type {
  Vector2,
} from '../core-kernels/vector.ts'
import type {
  NativeSecondaryAtlas,
} from './native-secondary-assets.ts'
import {
  dampenDraws,
  dampenedProjectileDraws,
  FIRE_DRAW_SCALE,
  MAGIC_TRAP_FULL_DRAW_THRESHOLD,
  magicTrapBurstDraws,
  magicTrapTint,
  mindblastBurstDraws,
  nativeEtherFadeScalar,
  secondaryFireDraw,
  shieldExplosionDraws,
} from './native-secondary-burst-presentation.ts'
import {
  clampEntry,
  hashUnit,
  packGray,
  packNormalizedRgb,
  WHITE,
} from './native-secondary-draws.ts'
import {
  magicCircleRingDraws,
  planeOrbMesh,
  prismaticWaveDraws,
} from './native-secondary-field-presentation.ts'
import {
  nativeGolemDeathPresentationPlan,
  nativeGolemPresentationPlan,
} from './native-secondary-golem-presentation.ts'
import {
  ACID_SPLASH_INITIAL_LIFE,
  type MutableSecondarySpriteDraw,
  type NativeAcidActorState,
  NativeSecondaryPresentationScratch,
  type NativeStormDropActorState,
} from './native-secondary-presentation-scratch.ts'
import type {
  NativeSecondaryGradientDraw,
  NativeSecondaryMeshDraw,
  NativeSecondaryPresentationPlan,
  NativeSecondaryQuadDraw,
  NativeSecondarySpriteDraw,
  NativeStormWeatherComposite,
} from './native-secondary-presentation-types.ts'
import {
  freezeWaveVisualDraws,
  raindropGradient,
  stormAuxiliaryDraws,
  stormCloudDraws,
  stormWeatherComposite,
} from './native-secondary-weather-presentation.ts'
import {
  ETHER_PRIMARY_FLIGHT_RECORDS,
  etherPrimaryCompositorPlan,
} from './primary-spell-ether-native.ts'
import {
  nativeFireEmberPlan,
  nativeFireExplosionPlan,
} from './primary-spell-fire-native.ts'

export function nativeSecondaryPresentationPlan(
  actor: NativeSecondaryActorState,
  presentationFrame = actor.ageTicks,
  pointGain = 1,
): NativeSecondaryPresentationPlan {
  return buildNativeSecondaryPresentationPlan(actor, presentationFrame, pointGain, null)
}

export function updateNativeSecondaryPresentationPlan(
  scratch: NativeSecondaryPresentationScratch,
  actor: NativeSecondaryActorState,
  presentationFrame = actor.ageTicks,
  pointGain = 1,
): NativeSecondaryPresentationPlan {
  scratch.reset()
  if (actor.kind === 'acid-drop' || actor.kind === 'acid-splash') {
    return scratch.writeAcidPlan(actor as NativeAcidActorState)
  }
  if (actor.kind === 'storm-drop') {
    return scratch.writeStormDropPlan(actor as NativeStormDropActorState)
  }
  return buildNativeSecondaryPresentationPlan(actor, presentationFrame, pointGain, scratch)
}

export const EMPTY_SECONDARY_DRAWS: readonly NativeSecondarySpriteDraw[] = []

export const EMPTY_SECONDARY_MESHES: readonly NativeSecondaryMeshDraw[] = []

export const EMPTY_SECONDARY_QUADS: readonly NativeSecondaryQuadDraw[] = []

const EMPTY_SECONDARY_DRAW_OPTIONS: Partial<
  Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>
> = {}

const PHASE_BURST_SORT_BIAS = 15

export const ZERO_SECONDARY_DRAW_OFFSET: Readonly<Vector2> = { x: 0, y: 0 }

function buildNativeSecondaryPresentationPlan(
  actor: NativeSecondaryActorState,
  presentationFrame: number,
  pointGain: number,
  scratch: NativeSecondaryPresentationScratch | null,
): NativeSecondaryPresentationPlan {
  const root = actor.position
  const draw = (
    atlas: NativeSecondaryAtlas,
    entry: number,
    options: Partial<Omit<NativeSecondarySpriteDraw, 'atlas' | 'entry'>> = (
      EMPTY_SECONDARY_DRAW_OPTIONS
    ),
  ): NativeSecondarySpriteDraw => {
    const target = scratch?.nextDraw() ?? ({} as MutableSecondarySpriteDraw)
    target.alpha = options.alpha ?? actor.alpha
    target.atlas = atlas
    target.blend = options.blend ?? 'normal'
    if (options.colorMode === undefined) {
      if (target.colorMode !== undefined) delete target.colorMode
    } else target.colorMode = options.colorMode
    target.entry = entry
    target.offset = options.offset ?? (
      scratch === null ? { x: 0, y: 0 } : ZERO_SECONDARY_DRAW_OFFSET
    )
    target.role = options.role ?? `${actor.kind}-${atlas}-${entry}`
    target.rotationRadians = options.rotationRadians ?? 0
    target.scaleX = options.scaleX ?? actor.scale
    target.scaleY = options.scaleY ?? actor.scale
    target.tint = options.tint ?? WHITE
    return target
  }
  const plan = (
    draws: readonly NativeSecondarySpriteDraw[],
    queueFamily: NativeSecondaryPresentationPlan['queueFamily'] = 'zanim',
    sortBias = 0,
    quads: readonly NativeSecondaryQuadDraw[] = [],
    gradients: readonly NativeSecondaryGradientDraw[] = [],
    stormComposite: NativeStormWeatherComposite | null = null,
    meshes: readonly NativeSecondaryMeshDraw[] = [],
    underlayDraws: readonly NativeSecondarySpriteDraw[] = EMPTY_SECONDARY_DRAWS,
    worldY = root.y,
  ): NativeSecondaryPresentationPlan => scratch?.writePlan(
    draws,
    gradients,
    meshes,
    quads,
    queueFamily,
    root,
    sortBias,
    stormComposite,
    underlayDraws,
    worldY,
  ) ?? {
    draws,
    gradients,
    meshes,
    quads,
    queueFamily,
    root,
    sortBias,
    stormComposite,
    underlayDraws,
    worldY,
  }

  switch (actor.kind) {
    case 'leviathan':
      return plan([
        draw('BadGuys', 75, {
          alpha: 1,
          blend: 'add',
          role: 'leviathan-plane-galaxy',
          rotationRadians: (presentationFrame % 120) * 3 * Math.PI / 180,
          scaleX: -0.8 * actor.scale,
          scaleY: 0.64 * actor.scale,
          tint: 0xff80ff,
        }),
        draw('BadGuys', 38, {
          alpha: 1,
          role: 'leviathan-plane-shimmer',
          scaleX: actor.scale,
          scaleY: actor.scale,
        }),
      ], 'ordinary-dynamic', -0.11)
    case 'leviathan-appendage': {
      const headingDegrees = actor.rotationRadians * 180 / Math.PI
      const wobble = Math.sin(actor.rotationRadians) * 5 * Math.PI / 180
      const localRoot = nativeLeviathanAppendageLocalRoot(
        actor.endpoint,
        actor.midpoint,
        actor.velocity.x,
        actor.slowFactor,
      )
      const parentY = actor.position.y - actor.scale * localRoot.y
      return plan([draw('BadGuys', nativeLeviathanAppendageRecord(
          actor.phase,
          headingDegrees,
        ), {
          rotationRadians: wobble,
          scaleX: actor.radius * actor.scale,
          scaleY: actor.radius * actor.scale,
        })], 'ordinary-dynamic', parentY + (actor.frame - 100) * 0.001 - actor.position.y)
    }
    case 'leviathan-mote':
      return plan([draw('BadGuys', 11, {
        alpha: actor.alpha,
        blend: 'add',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale * 0.8,
        tint: packNormalizedRgb(1, actor.quantity, 1),
      })])
    case 'ether-bolt':
      return plan([draw('BadGuys', 22, {
        alpha: 0.5 + 0.5 * hashUnit(actor.id, Math.floor(presentationFrame)),
        blend: 'add',
        offset: { x: 0, y: -25 },
        rotationRadians: actor.rotationRadians,
        scaleX: 1,
        scaleY: 1,
      })])
    case 'ether-fade': {
      const fade = nativeEtherFadeScalar(
        actor.alpha,
        actor.slowFactor,
        presentationFrame,
      )
      const ether = etherPrimaryCompositorPlan(
        actor.id,
        Math.floor(actor.quantity + presentationFrame),
        actor.quantity + presentationFrame,
        actor.scale,
        fade,
      )
      return plan(ether.draws.map((operation) => ({
        alpha: operation.alpha,
        atlas: 'BadGuys' as const,
        blend: operation.blend,
        entry: ETHER_PRIMARY_FLIGHT_RECORDS[operation.sprite],
        offset: { x: operation.x, y: operation.y },
        role: `ether-fade-${operation.pass}-${operation.role}`,
        rotationRadians: operation.rotationDegrees * Math.PI / 180,
        scaleX: operation.scale,
        scaleY: operation.scale,
        tint: operation.tint,
      })), 'zanim', actor.variant === 1 ? 100 : 0)
    }
    case 'plane-orb-shot':
      return plan([
        draw('BadGuys', 75, {
          blend: 'add',
          rotationRadians: (presentationFrame % 360) * 1.5 * Math.PI / 180,
          scaleX: -0.75 * actor.scale,
          scaleY: 0.6 * actor.scale,
        }),
      ], 'zanim', 0, [], [], null, [planeOrbMesh(actor, presentationFrame)])
    case 'plane-orb-particle':
      return plan([draw('BadGuys', actor.variant, {
        alpha: actor.alpha,
        blend: 'add',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale * 0.8,
        tint: packNormalizedRgb(1, actor.quantity, 1),
      })])
    case 'phase-burst':
      return plan([draw('BadGuys', 53, {
        alpha: Math.min(actor.alpha, 1),
        blend: 'add',
        rotationRadians: actor.rotationRadians + Math.PI / 2,
      })], 'zanim', PHASE_BURST_SORT_BIAS)
    case 'moving-fire':
    case 'fire-patch':
      {
        const scale = FIRE_DRAW_SCALE * actor.scale * actor.radius
        return plan([draw('DeadHawg', clampEntry(actor.frame, 46, 77), {
          alpha: Math.min(actor.alpha * actor.slowFactor, 1),
          blend: 'add',
          offset: { x: 0, y: -20 },
          scaleX: scale * actor.quantity,
          scaleY: scale,
        })], 'ordinary-dynamic')
      }
    case 'fire-burn':
      return plan([])
    case 'fire-burn-flame':
      return plan([draw('BadGuys', clampEntry(actor.frame, 333, 342), {
        alpha: actor.alpha,
        blend: 'add',
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'ether-burn':
      return plan([])
    case 'ether-burn-flare':
      return plan([draw('BadGuys', clampEntry(actor.frame, 246, 250), {
        alpha: actor.alpha,
        blend: 'add',
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'shockwave':
    case 'mindblast-shockwave':
      return plan([])
    case 'mindblast-burst':
      return plan(mindblastBurstDraws(actor, draw))
    case 'storm-cloud':
      return {
        ...plan(
        [
          ...stormCloudDraws(actor, presentationFrame, draw),
          ...stormAuxiliaryDraws(actor, draw),
        ],
        'zanim',
        0,
        [],
        [],
          stormWeatherComposite(actor, draw),
        ),
        worldY: actor.position.y + 350,
      }
    case 'storm-drop':
      return actor.phase < 0
        ? plan([], 'zanim', 0, [], [raindropGradient(actor, false)])
        : plan([draw('BadGuys', 63, {
            alpha: Math.max(0, 1 - actor.scale * actor.scale),
            role: 'storm-raindrop-ground',
            scaleX: actor.scale,
            scaleY: actor.scale,
            tint: 0xccffff,
          })])
    case 'storm-strike':
      return plan([], 'ordinary-dynamic')
    case 'prismatic-wave':
      return plan(prismaticWaveDraws(actor, presentationFrame, draw))
    case 'freeze-wave':
      return plan([])
    case 'freeze-wave-visual':
      return plan(freezeWaveVisualDraws(actor, draw))
    case 'frost-burn-flare':
      return plan([draw('BadGuys', clampEntry(actor.frame, 10, 11), {
        alpha: actor.alpha,
        blend: 'add',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
        tint: Math.trunc(actor.quantity),
      })])
    case 'flash-response-grow':
      return plan([draw('BadGuys', 16, {
        alpha: Math.min(actor.alpha, 1),
        blend: 'add',
        role: 'flash-response-grow-perspective',
        scaleX: actor.scale,
        scaleY: Math.fround(actor.scale * Math.fround(0.8)),
      })])
    case 'flash-response-fade':
      return plan([draw('BadGuys', 15, {
        alpha: Math.min(actor.alpha, 1),
        blend: 'add',
        role: 'flash-response-fade',
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'ice-blast':
      return plan([])
    case 'earthquake':
      {
        const draws: NativeSecondarySpriteDraw[] = [draw('DeadHawg', 200, {
          alpha: actor.alpha * 0.75,
          rotationRadians: actor.rotationRadians,
          scaleX: 1.5,
          scaleY: 1.2,
        })]
        if (actor.phase > 0.6) draws.push(draw('DeadHawg', 201, {
          alpha: actor.alpha * 0.75,
          rotationRadians: actor.rotationRadians + 170 * Math.PI / 180,
          scaleX: 1.5,
          scaleY: 1.2,
        }))
        if (actor.phase > 3) draws.push(draw('DeadHawg', 202, {
          alpha: actor.alpha * 0.75,
          rotationRadians: actor.rotationRadians + 305 * Math.PI / 180,
          scaleX: 1.5,
          scaleY: 1.2,
        }))
        if (actor.quantity > 0) {
          draws.push(...draws.map((source) => ({
            ...source,
            alpha: source.alpha * Math.min(actor.quantity, 1),
            tint: 0x00ff00,
          })))
        }
        return plan(draws, 'ordinary-dynamic')
      }
    case 'earthquake-scenery-wobble':
      return plan([])
    case 'earthquake-quake':
      return plan([draw('BadGuys', 62, {
        alpha: Math.min(1, actor.alpha * Math.abs(
          Math.sin(actor.phase * Math.PI / 180),
        )),
        role: 'earthquake-quake-child',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.slowFactor,
      })])
    case 'earthquake-dust':
      return plan([draw('BadGuys', 10, {
        alpha: Math.min(1, actor.alpha),
        role: 'earthquake-scenery-dust',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
        tint: 0x1e1100,
      })], 'zanim')
    case 'earthquake-debris': {
      const draws: NativeSecondarySpriteDraw[] = []
      if (actor.enhanced) {
        draws.push(draw('BadGuys', 2008 + actor.variant, {
          alpha: Math.min(1, actor.alpha),
          offset: { x: 1, y: actor.phase + 2 },
          role: 'earthquake-boulder-dark-underlay',
          rotationRadians: actor.rotationRadians,
          scaleX: actor.scale * 0.75,
          scaleY: actor.scale * 0.75,
          tint: 0x000000,
        }))
      }
      draws.push(draw('BadGuys', 2008 + actor.variant, {
        alpha: Math.min(1, actor.alpha),
        offset: { x: 0, y: actor.phase },
        role: 'earthquake-boulder-bit',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
      }))
      return plan(draws, 'zanim', -15)
    }
    case 'golem': {
      const golem = nativeGolemPresentationPlan(actor, presentationFrame)
      return scratch?.copyPlan(golem) ?? golem
    }
    case 'golem-death': {
      const death = nativeGolemDeathPresentationPlan(actor)
      return scratch?.copyPlan(death) ?? death
    }
    case 'teleport-burst':
      return plan([draw('BadGuys', 90, {
        alpha: Math.min(actor.alpha, 1),
        blend: 'add',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'magic-circle':
      return plan(magicCircleRingDraws(actor, draw))
    case 'magic-circle-player-flash':
      return plan([draw('BadGuys', 7, {
        alpha: Math.min(actor.alpha, 1),
        blend: 'add',
        role: 'magic-circle-player-recovery-pulse',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
        tint: 0x80ffff,
      })])
    case 'magic-trap': {
      const ageRadians = actor.ageTicks * Math.PI / 180
      const sine = Math.sin(ageRadians)
      const bob = Math.fround(5 * sine - 12)
      const chargeMultiplier = actor.scale < MAGIC_TRAP_FULL_DRAW_THRESHOLD
        ? Math.fround(0.75)
        : 1
      const chargeScale = Math.fround(
        Math.fround(0.5 + Math.fround(0.5 * actor.scale)) * chargeMultiplier,
      )
      const haloAlpha = Math.fround(
        Math.fround(0.5 - Math.fround(0.125 * sine)) * chargeMultiplier,
      )
      const selectorAlpha = Math.fround(
        Math.fround(0.375 - Math.fround(0.125 * sine)) * chargeMultiplier,
      )
      return plan([
        draw('BadGuys', 15, {
          alpha: 0.5,
          role: 'magic-trap-shadow',
          scaleX: 0.75,
          scaleY: 0.75,
          tint: 0x000000,
        }),
        draw('BadGuys', 111, {
          alpha: haloAlpha,
          blend: 'add',
          offset: { x: 0, y: bob },
          role: 'magic-trap-clockwise-halo',
          rotationRadians: actor.ageTicks * 2 * Math.PI / 180,
          scaleX: chargeScale,
          scaleY: Math.fround(chargeScale * Math.fround(0.8)),
        }),
        draw('BadGuys', 112, {
          alpha: haloAlpha,
          blend: 'add',
          offset: { x: 0, y: bob },
          role: 'magic-trap-counterclockwise-halo',
          rotationRadians: actor.ageTicks * -3 * Math.PI / 180,
          scaleX: chargeScale,
          scaleY: Math.fround(chargeScale * Math.fround(0.8)),
        }),
        draw('BadGuys', 15, {
          alpha: selectorAlpha,
          blend: 'add',
          role: 'magic-trap-selector-glow',
          scaleX: 2,
          scaleY: 2,
          tint: magicTrapTint(actor.variant),
        }),
        draw('BadGuys', 85, {
          alpha: 1,
          offset: { x: 0, y: bob },
          role: 'magic-trap-body',
          scaleX: Math.fround(1 - Math.fround(0.1 * Math.sin(ageRadians * 2))),
          scaleY: Math.fround(1 + Math.fround(0.1 * Math.cos(ageRadians))),
        }),
      ])
    }
    case 'magic-trap-shimmer':
      return plan([draw('BadGuys', 16, {
        alpha: actor.alpha,
        role: 'magic-trap-shimmer',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: Math.fround(actor.scale * Math.fround(0.8)),
        tint: magicTrapTint(actor.variant),
      })])
    case 'magic-trap-burst':
      return plan(magicTrapBurstDraws(actor, draw))
    case 'electric-burn':
      return plan([])
    case 'dampen-wave':
      return plan(dampenDraws(actor, draw), 'zanim')
    case 'dampened-smoke':
      return plan([draw('BadGuys', actor.frame, {
        alpha: actor.alpha * actor.phase, blend: actor.variant === 3 ? 'normal' : 'add',
        role: 'dampened-smoke', rotationRadians: actor.rotationRadians,
        scaleX: actor.scale, scaleY: actor.scale, tint: actor.quantity,
      })], 'zanim')
    case 'dampened-projectile':
      return plan(dampenedProjectileDraws(actor, draw))
    case 'shield-break':
      return plan([draw('BadGuys', 68, {
        alpha: actor.alpha,
        blend: 'add',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'shield-explosion':
      return plan(shieldExplosionDraws(actor, draw))
    case 'ring-fire-explosion': {
      return plan(nativeFireExplosionPlan({
        ageTicks: actor.ageTicks,
        id: actor.id,
        origin: actor.position,
        presentation: 'fire',
        visualScale: actor.scale,
      }, pointGain).draws.map(secondaryFireDraw))
    }
    case 'ring-fire-fragment': {
      const ember = nativeFireEmberPlan({
        ageTicks: actor.ageTicks,
        height: actor.phase,
        id: actor.id,
        life: actor.alpha,
        phase: actor.frame,
        position: actor.position,
      }, presentationFrame)
      const groundGlow = ember.groundGlow
      return plan(
        ember.draws.map(secondaryFireDraw),
        'ordinary-dynamic',
        0,
        groundGlow === null
          ? []
          : [{
              alpha: groundGlow.alpha,
              atlas: null,
              blend: groundGlow.blend,
              entry: null,
              role: 'ring-fire-fragment-enhanced-ground-glow',
              tint: groundGlow.tint,
              vertices: [
                -groundGlow.width / 2, -groundGlow.height / 2,
                groundGlow.width / 2, -groundGlow.height / 2,
                -groundGlow.width / 2, groundGlow.height / 2,
                groundGlow.width / 2, groundGlow.height / 2,
              ],
            }],
      )
    }
    case 'acid-rain': {
      const fieldScale = Math.fround(actor.scale)
      const cloudAlpha = Math.max(0, Math.min(1, Math.fround(actor.phase)))
      const constructorPhase = Math.fround(actor.rotationRadians)
      const age = Math.fround(actor.ageTicks)
      const firstScaleX = Math.fround(fieldScale * 5)
      const secondBaseScale = Math.fround(Math.fround(fieldScale * Math.fround(3.75)) * 2)
      const cloudDraws: NativeSecondarySpriteDraw[] = cloudAlpha > 0 ? [
        draw('BadGuys', 78, {
          alpha: Math.fround(cloudAlpha * Math.fround(0.75)),
          offset: { x: 0, y: -175 },
          role: 'acid-rain-cloud-mottled-source-over',
          rotationRadians: Math.fround(Math.fround(age * Math.fround(0.03125)) * constructorPhase) * Math.PI / 180,
          scaleX: firstScaleX,
          scaleY: Math.fround(firstScaleX * Math.fround(0.8)),
          tint: 0x698c52,
        }),
        draw('BadGuys', 78, {
          alpha: Math.fround(cloudAlpha * Math.fround(0.75)),
          blend: 'add',
          offset: { x: 0, y: -175 },
          role: 'acid-rain-cloud-mottled-additive',
          rotationRadians: Math.fround(Math.fround(age * Math.fround(0.03125)) * constructorPhase) * Math.PI / 180,
          scaleX: firstScaleX,
          scaleY: Math.fround(firstScaleX * Math.fround(0.8)),
          tint: 0x698c52,
        }),
        draw('BadGuys', 10, {
          alpha: cloudAlpha,
          blend: 'add',
          offset: { x: 0, y: Math.fround(-175 + fieldScale * -50) },
          role: 'acid-rain-cloud-circle-additive',
          rotationRadians: Math.fround(age * Math.fround(-0.5)) * Math.PI / 180,
          scaleX: Math.fround(secondBaseScale * constructorPhase),
          scaleY: Math.fround(secondBaseScale * Math.fround(0.8)),
          tint: 0x407326,
        }),
      ] : []
      const underlayDraws: NativeSecondarySpriteDraw[] = []
      if (actor.alpha > 0) {
        underlayDraws.push(draw('DeadHawg', 4, {
          alpha: Math.max(0, Math.min(1, actor.alpha)),
          role: 'acid-rain-ground-residue',
          scaleX: 4.5,
          scaleY: 4.5,
          tint: 0x0d1a0d,
        }))
      }
      return plan(
        cloudDraws,
        'zanim',
        0,
        [],
        [],
        null,
        [],
        underlayDraws,
        actor.position.y + 350,
      )
    }
    case 'acid-drop':
      return actor.phase < 0
        ? plan([draw('BadGuys', 0, {
            alpha: 0.25,
            offset: { x: 0, y: 0 },
            role: 'acid-raindrop-falling',
            scaleX: 1,
            scaleY: 1,
            tint: 0xb3f2bf,
          })], 'zanim', 0, [], [raindropGradient(actor, true)])
        : plan([draw('BadGuys', 63, {
            alpha: Math.max(0, 1 - actor.scale * actor.scale),
            role: 'acid-raindrop-ground',
            scaleX: actor.scale,
            scaleY: actor.scale,
            tint: 0xccffcc,
          })])
    case 'acid-splash':
      return plan([draw('BadGuys', 10, {
        alpha: Math.min(1, actor.alpha / ACID_SPLASH_INITIAL_LIFE),
        blend: 'add',
        role: 'acid-rain-splash',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
        tint: 0x80ff80,
      })])
    case 'ether-drain': {
      const shimmerScale = actor.scale * 0.25 * (
        0.9800000190734863 + hashUnit(actor.id, Math.trunc(presentationFrame)) * 0.06999993324279785
      )
      return plan([
        draw('BadGuys', 75, {
          alpha: 1,
          blend: 'add',
          role: 'ether-drain-galaxy-near',
          rotationRadians: actor.rotationRadians * 1.5,
          scaleX: actor.scale * -0.8,
          scaleY: actor.scale * 0.64,
          tint: 0xff80ff,
        }),
        draw('BadGuys', 75, {
          alpha: actor.alpha * 0.5,
          blend: 'add',
          offset: { x: 0, y: -5 },
          role: 'ether-drain-galaxy-middle-near',
          rotationRadians: actor.rotationRadians * 0.5,
          scaleX: -1.5,
          scaleY: 1.2,
        }),
        draw('BadGuys', 75, {
          alpha: actor.alpha * 0.25,
          blend: 'add',
          offset: { x: 0, y: -10 },
          role: 'ether-drain-galaxy-middle-far',
          rotationRadians: actor.rotationRadians * 0.25,
          scaleX: -2.5,
          scaleY: 2,
        }),
        draw('BadGuys', 75, {
          alpha: actor.alpha * 0.1,
          blend: 'add',
          offset: { x: 0, y: -20 },
          role: 'ether-drain-galaxy-far',
          rotationRadians: actor.rotationRadians * 0.125,
          scaleX: -4.5,
          scaleY: 3.6,
        }),
        draw('BadGuys', 38, {
          alpha: 1,
          role: 'ether-drain-shimmer',
          scaleX: shimmerScale,
          scaleY: shimmerScale,
          tint: 0xff4080,
        }),
        ...(actor.slowFactor > 0 ? [draw('BadGuys', 38, {
          alpha: actor.slowFactor,
          role: 'ether-drain-capture-pulse',
          scaleX: actor.slowFactor * actor.scale,
          scaleY: actor.slowFactor * actor.scale,
        })] : []),
      ])
    }
    case 'ether-drain-cloud':
      return plan([draw('BadGuys', 10 + actor.variant, {
        alpha: Math.max(0, Math.sin(actor.phase * Math.PI / 180) * actor.alpha),
        blend: 'add',
        role: 'ether-drain-suck-cloud',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'ether-drain-debris':
      return plan([draw('DeadHawg', 177 + actor.variant, {
        role: 'ether-drain-suck-debris',
        rotationRadians: actor.rotationRadians,
        scaleX: 1,
        scaleY: 1,
      })])
    case 'ether-drain-capture-flare':
      return plan([draw('BadGuys', 36, {
        alpha: actor.alpha,
        blend: 'add',
        role: 'ether-drain-capture-flare',
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'comet': {
      const distance = (400 - actor.ageTicks) * 20 + 70
      return plan([draw('DeadHawg', 5, {
        offset: {
          x: Math.cos(actor.rotationRadians) * distance,
          y: -Math.sin(actor.rotationRadians) * distance,
        },
        role: 'comet-body',
        rotationRadians: actor.rotationRadians + 150 * Math.PI / 180,
        scaleX: 2,
        scaleY: 2,
      })], 'ordinary-dynamic')
    }
    case 'comet-trail':
      return plan([draw('BadGuys', 51, {
        alpha: Math.min(1, actor.phase / 0.5),
        blend: 'add',
        role: 'comet-trail',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
        tint: packGray(actor.alpha),
      })])
    case 'comet-impact':
      {
        const additiveLife = Math.max(0, 5 - actor.ageTicks * 0.01)
        const ringLife = Math.max(0, 10 - actor.ageTicks * 0.01)
        return plan([
          ...(additiveLife > 0 ? [draw('BadGuys', 15, {
            alpha: Math.min(additiveLife, 1),
            blend: 'add',
            role: 'comet-impact-additive',
            scaleX: 10,
            scaleY: 10,
            tint: 0xbfbfbf,
          })] : []),
          ...(ringLife > 0 ? [draw('DeadHawg', 6, {
            alpha: Math.min(ringLife, 1),
            role: 'comet-impact-ring',
            scaleX: 2,
            scaleY: 2,
          })] : []),
        ])
      }
    case 'comet-debris':
      return plan([draw('DeadHawg', 203 + actor.variant, {
        alpha: Math.min(actor.alpha, 1),
        offset: { x: 0, y: actor.phase },
        role: 'comet-impact-debris',
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale,
      })])
    case 'turn-undead':
      return plan([draw('BadGuys', 48, {
        alpha: actor.alpha,
        rotationRadians: actor.rotationRadians,
        scaleX: actor.scale,
        scaleY: actor.scale * 0.8,
        tint: 0x808080,
      })])
  }
}
