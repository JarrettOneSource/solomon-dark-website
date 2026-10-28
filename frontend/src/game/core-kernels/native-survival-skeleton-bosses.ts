import {
  BONEYARD_SKELETON_WEAPONS,
  type AuthoredBoneyardEnemyFamilyRecipe,
  type AuthoredBoneyardEnemyRecipe,
} from './boneyard-enemy-config-model.ts'
import {
  NATIVE_SURVIVAL_BOSS_RECIPE_SOURCES,
  NATIVE_SURVIVAL_BOSS_SOURCES,
} from './native-survival-boss-catalog.ts'

export type NativeSkeletonBossName = 'Ironmaw' | 'Foulshaft'

export interface NativeSkeletonBossProgramState {
  readonly foulshaftArchersRemaining: number
  readonly foulshaftPhase: 'eligible' | 'reinforcements' | 'boss-wait' | 'retired'
  readonly foulshaftTicksRemaining: number
  readonly ironmawSpawned: boolean
  readonly sourceSha256: string
}

export interface NativeSkeletonBossBirth {
  readonly archerStrafing?: boolean
  readonly authoredRecipe?: AuthoredBoneyardEnemyRecipe
  readonly enemyToken: 'SKELETON' | 'SKELETONARCHER'
  readonly flags: readonly string[]
}

export interface NativeSkeletonBossProgramStep {
  readonly births: readonly NativeSkeletonBossBirth[]
  readonly releaseWave: boolean
  readonly state: NativeSkeletonBossProgramState
}

export function createNativeSkeletonBossProgram(sourceSha256: string): NativeSkeletonBossProgramState {
  nativeBossSource(sourceSha256)
  return {
    foulshaftArchersRemaining: 0,
    foulshaftPhase: 'eligible',
    foulshaftTicksRemaining: 0,
    ironmawSpawned: false,
    sourceSha256,
  }
}

export function nativeSkeletonBossTimelinePaused(state: NativeSkeletonBossProgramState | null): boolean {
  return state?.foulshaftPhase === 'reinforcements' || state?.foulshaftPhase === 'boss-wait'
}

export function stepNativeSkeletonBossProgram(
  source: NativeSkeletonBossProgramState,
  waveOrdinal: number,
  liveBossCount: number,
): NativeSkeletonBossProgramStep {
  const program = nativeBossSource(source.sourceSha256)
  const births: NativeSkeletonBossBirth[] = []
  let state = source
  if (!state.ironmawSpawned && waveOrdinal === program.ironmaw.waveOrdinal) {
    births.push({
      authoredRecipe: nativeSkeletonBossRecipe(source.sourceSha256, 'Ironmaw'),
      enemyToken: 'SKELETON',
      flags: [],
    })
    state = { ...state, ironmawSpawned: true }
  }
  if (state.foulshaftPhase === 'eligible') {
    if (waveOrdinal === program.foulshaft.waveOrdinal) {
      births.push({
        authoredRecipe: nativeSkeletonBossRecipe(source.sourceSha256, 'Foulshaft'),
        enemyToken: 'SKELETONARCHER',
        flags: [],
      }, foulshaftOpeningArcher())
      state = {
        ...state,
        foulshaftArchersRemaining: 9,
        foulshaftPhase: 'reinforcements',
        foulshaftTicksRemaining: 100,
      }
    }
    return { births, releaseWave: false, state }
  }
  if (state.foulshaftPhase === 'retired') return { births, releaseWave: false, state }
  if (state.foulshaftTicksRemaining > 1) {
    return {
      births,
      releaseWave: false,
      state: { ...state, foulshaftTicksRemaining: state.foulshaftTicksRemaining - 1 },
    }
  }
  if (state.foulshaftPhase === 'reinforcements' && state.foulshaftArchersRemaining > 0) {
    births.push(foulshaftOpeningArcher())
    return {
      births,
      releaseWave: false,
      state: {
        ...state,
        foulshaftArchersRemaining: state.foulshaftArchersRemaining - 1,
        foulshaftTicksRemaining: 100,
      },
    }
  }
  if (liveBossCount > 0 || births.some((birth) => birth.authoredRecipe !== undefined)) {
    births.push(
      { enemyToken: 'SKELETONARCHER', flags: ['FLAG_HPUP'] },
      { enemyToken: 'SKELETON', flags: ['FLAG_HPUP'] },
    )
    return {
      births,
      releaseWave: false,
      state: { ...state, foulshaftPhase: 'boss-wait', foulshaftTicksRemaining: 200 },
    }
  }
  return {
    births,
    releaseWave: true,
    state: { ...state, foulshaftPhase: 'retired', foulshaftTicksRemaining: 0 },
  }
}

function foulshaftOpeningArcher(): NativeSkeletonBossBirth {
  return { archerStrafing: true, enemyToken: 'SKELETONARCHER', flags: ['FLAG_HOODED', 'FLAG_HPUP'] }
}

function nativeBossSource(sourceSha256: string) {
  const source = NATIVE_SURVIVAL_BOSS_SOURCES.find((row) => row.sourceSha256 === sourceSha256)
  if (!source) throw new Error(`default Boneyard ${sourceSha256} has no extracted boss recipes`)
  return source
}

export function nativeSkeletonBossRecipe(
  sourceSha256: string,
  name: NativeSkeletonBossName,
): AuthoredBoneyardEnemyRecipe {
  const source = nativeBossSource(sourceSha256)
  const native = NATIVE_SURVIVAL_BOSS_RECIPE_SOURCES[name]
  const family: AuthoredBoneyardEnemyFamilyRecipe = name === 'Ironmaw'
    ? {
        armor: true,
        headgear: 4,
        kind: 'skeleton',
        weapon: BONEYARD_SKELETON_WEAPONS[source.ironmawWeapon],
      }
    : {
        arrowType: 'fire',
        extraArrows: 2,
        headgear: 5,
        kind: 'archer',
        multiArrowMode: 1,
        rangeMode: 3,
        strafing: true,
      }
  return Object.freeze({
    archerAccuracyMode: name === 'Foulshaft' ? 3 : 0,
    attackSpeed: native.attackSpeed,
    chaseSpeed: native.chaseSpeed,
    classification: 'boss',
    experienceBonus: native.xpBonus,
    extraDamage: native.extraDamage,
    family: Object.freeze(family),
    lootPolicies: native.lootPolicies,
    maximumHealth: native.maxHp,
    movementScale: native.moveSpeedScale,
    name,
    onDeathProgram: 'miniboss-die',
    primaryDamage: native.primaryDamage,
    secondaryDamage: native.secondaryDamage,
    tertiaryDamage: native.tertiaryDamage,
    uid: source.recipeUids[name],
  })
}
