import type { NativeRngState } from '../core-kernels/native-rng.ts'
import {
  isNativePlayerStaffTransient,
  type NativePlayerStaffTransient,
} from '../core-kernels/native-player-staff-action.ts'
import type {
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'
import type { NativeWeldWorldActor } from '../core-kernels/native-weld-primary-runtime.ts'

type ElementTransient = Exclude<
  PrimarySpellTransientState,
  NativePlayerStaffTransient | NativeWeldWorldActor
>
type WeldOwnedTransient = Extract<NativeWeldWorldActor, {
  kind:
    | 'weld-channel'
    | 'weld-impact'
    | 'weld-meteor-marker'
    | 'weld-persistent'
    | 'weld-steam'
}>
type WeldAnimatedTransient = Exclude<NativeWeldWorldActor, WeldOwnedTransient>

export function copyPrimarySpellTransient<Transient extends PrimarySpellTransientState>(
  effect: Transient,
): Transient
export function copyPrimarySpellTransient(
  effect: PrimarySpellTransientState,
): PrimarySpellTransientState {
  if (isNativePlayerStaffTransient(effect)) return copyStaffTransient(effect)
  if (isWeldTransient(effect)) return copyWeldTransient(effect)
  return copyElementTransient(effect)
}

function copyStaffTransient(effect: NativePlayerStaffTransient): NativePlayerStaffTransient {
  switch (effect.kind) {
    case 'player-staff-melee':
    case 'player-staff-spin': return { ...effect, origin: { ...effect.origin } }
    case 'player-staff-contact': return {
      ...effect,
      impactSoundPitches: [...effect.impactSoundPitches],
      origin: { ...effect.origin },
      pikeBreakSoundIndexes: [...effect.pikeBreakSoundIndexes],
      procSoundPitches: [...effect.procSoundPitches],
      targetIds: [...effect.targetIds],
    }
    case 'player-staff-contact-knockback': return { ...effect, delta: { ...effect.delta } }
    case 'player-staff-pike-break': return {
      ...effect,
      position: { ...effect.position },
      presentationRng: copyNativeRng(effect.presentationRng),
    }
    case 'player-staff-knockback': return {
      ...effect,
      origin: { ...effect.origin },
      targetIds: [...effect.targetIds],
    }
    case 'player-staff-smoke':
    case 'player-staff-perspective-fade': return { ...effect, position: { ...effect.position } }
    case 'player-staff-move-fade': return {
      ...effect,
      position: { ...effect.position },
      velocity: { ...effect.velocity },
    }
  }
}

function copyElementTransient(effect: ElementTransient): ElementTransient {
  switch (effect.kind) {
    case 'ether-pierce-streak': return { ...effect, origin: { ...effect.origin } }
    case 'fire-explosion': return {
      ...effect,
      lightRegistration: { ...effect.lightRegistration },
      origin: { ...effect.origin },
    }
    case 'ether-blast': return {
      ...effect,
      origin: { ...effect.origin },
      presentationRng: copyNativeRng(effect.presentationRng),
    }
    case 'earth-impact': return {
      ...effect,
      lightRegistration: null,
      origin: { ...effect.origin },
    }
    case 'earth-boulder-bit': return {
      ...effect,
      debris: copyWeldMeteorDebris(effect.debris),
      lightRegistration: null,
      origin: { ...effect.origin },
      position: { ...effect.position },
    }
    case 'ether-impact':
    case 'fire-impact': return {
      ...effect,
      lightRegistration: { ...effect.lightRegistration },
      origin: { ...effect.origin },
    }
    case 'earth-called-rock': return {
      ...effect,
      lightRegistration: null,
      position: { ...effect.position },
    }
    case 'fire-ember': return {
      ...effect,
      horizontalVelocity: { ...effect.horizontalVelocity },
      lightRegistration: { ...effect.lightRegistration },
      position: { ...effect.position },
    }
    case 'fire-good-imp': return {
      ...effect,
      contactOrigin: effect.contactOrigin === null ? null : { ...effect.contactOrigin },
      lightRegistration: { ...effect.lightRegistration },
      position: { ...effect.position },
    }
    case 'fire-patch': return {
      ...effect,
      position: { ...effect.position },
      velocity: { ...effect.velocity },
      velocityMultiplier: { ...effect.velocityMultiplier },
    }
    case 'water': return {
      ...effect,
      direction: { ...effect.direction },
      lightRegistration: null,
      obstructionPoint: effect.obstructionPoint === null
        ? null
        : { ...effect.obstructionPoint },
      origin: { ...effect.origin },
    }
    case 'air': return {
      ...effect,
      direction: { ...effect.direction },
      endpoint: { ...effect.endpoint },
      lightRegistration: { ...effect.lightRegistration },
      midpoint: { ...effect.midpoint },
      origin: { ...effect.origin },
    }
    case 'air-hurricane': return {
      ...effect,
      lanes: effect.lanes.map((lane) => ({ ...lane })),
      position: { ...effect.position },
    }
    case 'water-hail': return {
      ...effect,
      horizontalVelocity: { ...effect.horizontalVelocity },
      position: { ...effect.position },
    }
    case 'water-aura': return { ...effect, origin: { ...effect.origin } }
    case 'fire': return {
      ...effect,
      direction: { ...effect.direction },
      lightRegistration: null,
      origin: { ...effect.origin },
    }
  }
}

function copyWeldTransient(effect: NativeWeldWorldActor): NativeWeldWorldActor {
  switch (effect.kind) {
    case 'weld-channel':
    case 'weld-impact':
    case 'weld-meteor-marker':
    case 'weld-persistent':
    case 'weld-steam': return copyWeldOwnedTransient(effect)
    default: return copyWeldAnimatedTransient(effect)
  }
}

function copyWeldAnimatedTransient(
  effect: WeldAnimatedTransient,
): WeldAnimatedTransient {
  switch (effect.kind) {
    case 'weld-meteor': return {
      ...effect,
      cameraDisplacement: effect.cameraDisplacement === null
        ? null
        : { ...effect.cameraDisplacement },
      debris: effect.debris.map(copyWeldMeteorDebris),
      direction: { ...effect.direction },
      lightRegistration: { ...effect.lightRegistration },
      origin: { ...effect.origin },
      position: { ...effect.position },
      vector: [...effect.vector],
    }
    case 'weld-boulder-debris': return {
      ...effect,
      debris: copyWeldMeteorDebris(effect.debris),
      direction: { ...effect.direction },
      lightRegistration: null,
      origin: { ...effect.origin },
      position: { ...effect.position },
      vector: [...effect.vector],
    }
    case 'weld-blizzard-chain-frost':
    case 'weld-blizzard-glow':
    case 'weld-frost-fade': return copyWeldOriginTransient(effect)
    case 'weld-flame-lash-fade':
    case 'weld-ground-spark-fade':
    case 'weld-hail-flash':
    case 'weld-hail-rock-fade':
    case 'weld-meteor-flash': return copyWeldPositionTransient(effect)
    case 'weld-hail-line': return {
      ...copyWeldOriginTransient(effect),
      end: { ...effect.end },
      start: { ...effect.start },
    }
    case 'weld-hail-knockback': return {
      ...copyWeldOriginTransient(effect),
      delta: { ...effect.delta },
    }
    case 'weld-hail-terrain-bouncer':
    case 'weld-hail-terrain-particle': return {
      ...copyWeldPositionTransient(effect),
      velocity: { ...effect.velocity },
    }
  }
}

function copyWeldOwnedTransient(
  effect: WeldOwnedTransient,
): WeldOwnedTransient {
  switch (effect.kind) {
    case 'weld-steam': return {
      ...copyWeldPositionTransient(effect),
      terminalPosition: { ...effect.terminalPosition },
      velocity: { ...effect.velocity },
    }
    case 'weld-impact': return {
      ...effect,
      direction: { ...effect.direction },
      lightRegistration: effect.lightRegistration === null
        ? null
        : { ...effect.lightRegistration },
      origin: { ...effect.origin },
      position: { ...effect.position },
      vector: [...effect.vector],
    }
    case 'weld-channel': return {
      ...copyWeldOriginTransient(effect),
      endpoint: effect.endpoint === null ? null : { ...effect.endpoint },
      midpoint: effect.midpoint === null ? null : { ...effect.midpoint },
    }
    case 'weld-persistent': return copyWeldPersistentTransient(effect)
    case 'weld-meteor-marker': return copyWeldOriginTransient(effect)
  }
}

function copyWeldPersistentTransient(
  effect: Extract<NativeWeldWorldActor, { kind: 'weld-persistent' }>,
): Extract<NativeWeldWorldActor, { kind: 'weld-persistent' }> {
  if (effect.buildId === 1006) {
    return {
      ...effect,
      direction: { ...effect.direction },
      hitTargetIds: [...effect.hitTargetIds],
      lightRegistration: { ...effect.lightRegistration },
      origin: { ...effect.origin },
      vector: [...effect.vector],
      velocity: { ...effect.velocity },
    }
  }
  if (effect.buildId === 1008) {
    return {
      ...effect,
      direction: { ...effect.direction },
      lightRegistration: { ...effect.lightRegistration },
      origin: { ...effect.origin },
      rocks: effect.rocks.map(copyWeldHailstone),
      vector: [...effect.vector],
    }
  }
  return copyWeldOriginTransient(effect)
}

function copyWeldOriginTransient<
  Transient extends Extract<NativeWeldWorldActor, {
    direction: Readonly<{ x: number; y: number }>
    lightRegistration: null
    origin: Readonly<{ x: number; y: number }>
    vector: readonly number[]
  }>,
>(effect: Transient): Transient {
  return {
    ...effect,
    direction: { ...effect.direction },
    lightRegistration: null,
    origin: { ...effect.origin },
    vector: [...effect.vector],
  }
}

function copyWeldPositionTransient<
  Transient extends Extract<NativeWeldWorldActor, {
    lightRegistration: null
    position: Readonly<{ x: number; y: number }>
  }>,
>(effect: Transient): Transient {
  return {
    ...copyWeldOriginTransient(effect),
    position: { ...effect.position },
  }
}

export function copyWeldMeteorDebris<
  Debris extends Readonly<{
    position: Readonly<{ x: number; y: number }>
    velocity: Readonly<{ x: number; y: number }>
  }>,
>(debris: Debris): Debris {
  return {
    ...debris,
    position: { ...debris.position },
    velocity: { ...debris.velocity },
  }
}

export function copyNativeRng(source: NativeRngState): NativeRngState {
  return { ...source, words: [...source.words] }
}

export function copyWeldHailstone<
  Rock extends Readonly<{
    localPosition: Readonly<{ x: number; y: number; z: number }>
    releaseOffset: Readonly<{ x: number; y: number }> | null
  }>,
>(rock: Rock): Rock {
  return {
    ...rock,
    localPosition: { ...rock.localPosition },
    releaseOffset: rock.releaseOffset === null ? null : { ...rock.releaseOffset },
  }
}

function isWeldTransient(effect: PrimarySpellTransientState): effect is NativeWeldWorldActor {
  return isStateDrivenWeldTransient(effect)
    || effect.kind === 'weld-blizzard-chain-frost'
    || effect.kind === 'weld-blizzard-glow'
    || effect.kind === 'weld-frost-fade'
}

export function isStateDrivenWeldTransient(
  effect: PrimarySpellTransientState,
): effect is Exclude<NativeWeldWorldActor, Extract<NativeWeldWorldActor, {
  kind: 'weld-blizzard-chain-frost' | 'weld-blizzard-glow' | 'weld-frost-fade'
}>> {
  return effect.kind === 'weld-boulder-debris'
    || effect.kind === 'weld-channel'
    || effect.kind === 'weld-flame-lash-fade'
    || effect.kind === 'weld-ground-spark-fade'
    || effect.kind === 'weld-hail-flash'
    || effect.kind === 'weld-hail-knockback'
    || effect.kind === 'weld-hail-line'
    || effect.kind === 'weld-hail-rock-fade'
    || effect.kind === 'weld-hail-terrain-bouncer'
    || effect.kind === 'weld-hail-terrain-particle'
    || effect.kind === 'weld-impact'
    || effect.kind === 'weld-meteor'
    || effect.kind === 'weld-meteor-flash'
    || effect.kind === 'weld-meteor-marker'
    || effect.kind === 'weld-persistent'
    || effect.kind === 'weld-steam'
}
