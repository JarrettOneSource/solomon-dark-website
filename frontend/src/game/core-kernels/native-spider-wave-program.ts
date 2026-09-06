import type { BoneyardEnemyFlag } from './boneyard-enemy-config-model.ts'
import type { BoneyardSpawnPositionPolicy } from './boneyard-wave-timeline.ts'

export type NativeSpiderWaveCommand =
  | Readonly<{ kind: 'pause' | 'unpause' | 'advance' | 'spawn-offscreen' | 'end-repeat' | 'end-if' | 'label' }>
  | Readonly<{ kind: 'repeat'; count: number }>
  | Readonly<{ kind: 'spawn'; flags: readonly BoneyardEnemyFlag[] }>
  | Readonly<{ kind: 'sleep'; ticks: number }>
  | Readonly<{ kind: 'if-monsters' | 'jump'; next: number }>

export interface NativeSpiderWaveDefinition {
  readonly name: string
  readonly triggerUid: number
  readonly scriptUid: number
  readonly startWave: number
  readonly commands: readonly NativeSpiderWaveCommand[]
}

export interface NativeSpiderWaveState {
  readonly active: boolean
  readonly phaseIndex: number
  readonly cursor: number
  readonly repeatStart: number
  readonly repeatRemaining: number
  readonly sleepTicksRemaining: number
  readonly timelinePaused: boolean
  readonly positionPolicy: BoneyardSpawnPositionPolicy
}

export interface NativeSpiderWaveBirth {
  readonly flags: readonly BoneyardEnemyFlag[]
  readonly positionPolicy: BoneyardSpawnPositionPolicy
}

export interface NativeSpiderWaveStep {
  readonly advanceWave: boolean
  readonly births: readonly NativeSpiderWaveBirth[]
  readonly state: NativeSpiderWaveState
}

interface WorkingScript {
  advanceWave: boolean
  births: NativeSpiderWaveBirth[]
  state: { -readonly [Key in keyof NativeSpiderWaveState]: NativeSpiderWaveState[Key] }
}

export function createNativeSpiderWaveState(): NativeSpiderWaveState {
  return {
    active: false,
    phaseIndex: 0,
    cursor: 0,
    repeatStart: 0,
    repeatRemaining: 0,
    sleepTicksRemaining: 0,
    timelinePaused: false,
    positionPolicy: 'dark',
  }
}

/** ScriptCall 0x0068B060: ten executed commands, or the next sleep, per tick. */
export function stepNativeSpiderWaves(
  source: NativeSpiderWaveState,
  definitions: readonly NativeSpiderWaveDefinition[],
  waveOrdinal: number,
  monsterCount: number,
): NativeSpiderWaveStep {
  const state = { ...source }
  const result: WorkingScript = { advanceWave: false, births: [], state }
  const definition = definitions[state.phaseIndex]
  if (!definition || (!state.active && waveOrdinal < definition.startWave)) return result
  state.active = true
  if (state.sleepTicksRemaining > 0) {
    state.sleepTicksRemaining -= 1
    if (state.sleepTicksRemaining > 0) return result
  }
  for (let executed = 0; executed < 10; executed += 1) {
    const command = definition.commands[state.cursor]
    if (!command) {
      state.active = false
      state.phaseIndex += 1
      state.cursor = 0
      return result
    }
    state.cursor += 1
    executeCommand(command, result, monsterCount)
    if (state.sleepTicksRemaining > 0) return result
  }
  return result
}

function executeCommand(
  command: NativeSpiderWaveCommand,
  result: WorkingScript,
  monsterCount: number,
): void {
  const state = result.state
  switch (command.kind) {
    case 'pause': state.timelinePaused = true; break
    case 'unpause': state.timelinePaused = false; break
    case 'advance': result.advanceWave = true; break
    case 'spawn-offscreen': state.positionPolicy = 'offscreen'; break
    case 'repeat':
      state.repeatStart = state.cursor
      state.repeatRemaining = command.count
      break
    case 'end-repeat':
      state.repeatRemaining -= 1
      if (state.repeatRemaining > 0) state.cursor = state.repeatStart
      break
    case 'spawn': result.births.push({ flags: command.flags, positionPolicy: state.positionPolicy }); break
    case 'sleep': state.sleepTicksRemaining = command.ticks; break
    case 'if-monsters':
      if (monsterCount + result.births.length === 0) state.cursor = command.next
      break
    case 'jump': state.cursor = command.next; break
    case 'end-if':
    case 'label': break
  }
}
