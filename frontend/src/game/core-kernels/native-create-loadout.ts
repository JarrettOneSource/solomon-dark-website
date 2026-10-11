import { drawNativeInteger, type NativeRngState } from './native-rng.ts'
import type {
  PlayerCharacterConfig,
  WizardDiscipline,
  WizardDisciplineChoice,
  WizardElement,
} from './player-character.ts'

/** Retail Create +78 fades by float32 0.05 per 100 Hz update. */
export const NATIVE_CREATE_ENTRY_FADE_MS = 200
/** 0x0058A820 finalizes only after +78 is strictly greater than float32 1.1. */
export const NATIVE_CREATE_RANDOMIZE_FINALIZE_MS = 230

const PRIMARY_POOL: readonly WizardElement[] = ['ether', 'fire', 'air', 'water', 'earth']
const ORDINARY_SECONDARY_POOL: readonly WizardDisciplineChoice[] = ['arcane', 'body', 'mind']

/**
 * Retail 0x005D0290, ordinary Create branch. Only missing choices consume RNG.
 * The native Integer(3) gate is modulo-biased; replacing it with a uniform
 * one-in-three test changes both outcomes and subsequent draws.
 */
export function finalizeNativeCreateLoadout(
  source: NativeRngState,
  selection: Readonly<{
    displayName: string
    element: WizardElement | null
    discipline: WizardDiscipline | null
  }>,
  disabledPrimarySkillIds: ReadonlySet<number> = new Set(),
): { config: PlayerCharacterConfig; state: NativeRngState } {
  let state = source
  const draw = (bound: number): number => {
    const result = drawNativeInteger(state, bound)
    state = result.state
    return result.value
  }
  let element = selection.element
  if (element === null) {
    const pool = PRIMARY_POOL.filter((_, root) => !disabledPrimarySkillIds.has(8 + root * 8))
    // The native empty list grows a zero-initialized slot after Integer(0).
    element = pool[draw(pool.length)] ?? 'ether'
  }
  let discipline = selection.discipline
  if (discipline === null) {
    if (draw(3) === 1) {
      do { discipline = PRIMARY_POOL[draw(5)]! } while (discipline === element)
    } else {
      discipline = ORDINARY_SECONDARY_POOL[draw(3)]!
    }
  }
  return { config: { displayName: selection.displayName, element, discipline }, state }
}
