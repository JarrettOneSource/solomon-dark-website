import { createNativeRng, drawNativeInteger, type NativeRngState } from './native-rng.ts'
import type {
  NativeLootCategory,
  NativeLootModifiers,
  NativeLootPolicy,
  NativeLootSelectionInput,
} from './native-loot.ts'

// Five-level bands; the first two share the native 75 base. Multiples of five
// are rejected before lookup, and the last band applies to every higher level.
const POWERUP_LEVEL_BASES = [75, 75, 77, 82, 92, 102, 117, 137] as const

/** Retail 0x0047C070: private eligibility rolls followed by biased candidate choice. */
export function selectNativeLootCandidate(
  input: NativeLootSelectionInput,
): { readonly category: NativeLootCategory | null; readonly privateRng: NativeRngState } {
  let privateRng = createNativeRng(input.actorSeed)
  const candidates: NativeLootCategory[] = []
  if ((input.arena.disableMask & (1 << 4)) === 0) {
    const keyBound = (Math.max(0, Math.trunc((input.arena.level - 20) / 5)) + 10) * 100
    if (input.key.current <= input.key.level && input.key.remaining > 0) {
      const draw = drawNativeInteger(privateRng, keyBound)
      privateRng = draw.state
      if (draw.value === 2) candidates.push('key')
    }
  }

  privateRng = appendPolicyCandidate(
    candidates,
    'orb',
    input.policies.orb,
    input.arena.disableMask & (1 << 3),
    policyBound(input.policies.orb, 8, 16, 4, input.participant.modifiers.orbChance),
    privateRng,
  )
  privateRng = appendPolicyCandidate(
    candidates,
    'gold',
    input.policies.gold,
    input.arena.disableMask & 1,
    policyBound(input.policies.gold, 22, 44, 11, input.participant.modifiers.goldChance),
    privateRng,
    input.arena.specialSuppression || input.policies.gold === 5,
  )
  privateRng = appendPolicyCandidate(
    candidates,
    'item',
    input.policies.item,
    input.arena.disableMask & (1 << 5),
    itemCandidateBound(input),
    privateRng,
    input.arena.specialSuppression,
  )
  if (input.policies.potion === 3 && input.sceneForcesHealthPotion
    && (input.arena.disableMask & (1 << 1)) === 0) candidates.length = 0
  privateRng = appendPolicyCandidate(
    candidates,
    'potion',
    input.policies.potion,
    input.arena.disableMask & (1 << 1),
    policyBound(input.policies.potion, 400, 800, 200, 1),
    privateRng,
  )
  const powerupBase = nativePowerupLevelBase(input.participant.level)
  privateRng = appendPolicyCandidate(
    candidates,
    'powerup',
    input.policies.powerup,
    input.arena.disableMask & (1 << 2),
    powerupBase === null
      ? null
      : powerupCandidateBound(powerupBase, input.policies.powerup, input.participant.modifiers),
    privateRng,
  )

  if (candidates.length === 0) return { category: null, privateRng }
  const choice = drawNativeInteger(privateRng, candidates.length)
  return { category: candidates[choice.value]!, privateRng: choice.state }
}

function appendPolicyCandidate(
  candidates: NativeLootCategory[],
  category: NativeLootCategory,
  policy: NativeLootPolicy,
  masked: number,
  bound: number | null,
  sourceRng: NativeRngState,
  suppressed = false,
): NativeRngState {
  if (masked !== 0 || policy === 4 || suppressed) return sourceRng
  if (policy === 3 || (bound !== null && Math.trunc(bound) <= 0)) {
    candidates.push(category)
    return sourceRng
  }
  if (bound === null) return sourceRng
  const draw = drawNativeInteger(sourceRng, Math.trunc(bound))
  if (draw.value === 1) candidates.push(category)
  return draw.state
}

function policyBound(
  policy: NativeLootPolicy,
  ordinary: number,
  reduced: number,
  increased: number,
  modifier: number,
): number {
  const base = policy === 1 ? reduced : policy === 2 ? increased : ordinary
  return Math.fround(Math.fround(base) * Math.fround(modifier))
}

function itemCandidateBound(input: NativeLootSelectionInput): number {
  const base = policyBound(input.policies.item, 360, 720, 180, 1)
  let result = base
  if (input.arena.level < 5) result = Math.fround(result * 200)
  result = Math.fround(result * 2)
  if (input.arena.level !== input.arena.lastSuccessfulItemLevel) {
    result = Math.fround(result * 2)
  }
  return Math.fround(result * input.participant.modifiers.itemChance)
}

function powerupCandidateBound(
  base: number,
  policy: NativeLootPolicy,
  modifiers: NativeLootModifiers,
): number {
  const policyScale = policy === 1 ? 2 : policy === 2 ? 0.5 : 1
  return Math.fround(Math.fround(Math.fround(base * policyScale) * 9) * modifiers.powerupChance)
}

function nativePowerupLevelBase(level: number): number | null {
  if (!Number.isInteger(level) || level < 0) {
    throw new RangeError('native loot participant level must be non-negative')
  }
  if (level <= 1 || level % 5 === 0) return null
  return POWERUP_LEVEL_BASES[Math.min(POWERUP_LEVEL_BASES.length - 1, Math.floor(level / 5))]!
}
