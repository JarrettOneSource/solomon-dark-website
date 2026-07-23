// The wave schedule model: the semantic form of the game's data/wave.txt.
//
// Ground truth is the retail parser WaveData_Parse (0x00632730) plus the
// loader's validating reader in wave_intelligence.cpp: WAVE/ENDWAVE blocks,
// NEXT/SPAWN/SPAWNDELAY/WAVEDELAY/MAXENEMIES/ZOMBIEWAVE directives, and
// GROUP/FORMATION monster lines of `TOKEN[:FLAG|FLAG]`. Bare tokens without
// flags appear throughout the stock schedule and are valid.

export interface WaveGroupEntry {
  enemy: string
  flags: string[]
}

export interface WaveGroup {
  entries: WaveGroupEntry[]
}

export interface WaveDef {
  /** Exact spawn budget for the wave (SPAWN). Must be positive. */
  spawn: number
  /** Per-spawn delay range in ticks (SPAWNDELAY min-max). */
  spawnDelay: [number, number]
  /** Burst window range in ticks (WAVEDELAY min-max). */
  waveDelay: [number, number]
  /** Population gate for wave advancement (MAXENEMIES). */
  maxEnemies: number
  /** ZOMBIEWAVE marker line. */
  zombieWave?: boolean
  /** Candidate follow-up waves as 0-based schedule indexes (NEXT). */
  next: number[]
  /** GROUP blocks; the spawner picks among them. */
  groups: WaveGroup[]
}

/** The eight enemy tokens the retail schedule uses, with native type ids
 * matching the loader's TryResolveWaveEnemyType table. */
export const WAVE_ENEMIES: { token: string; typeId: number; label: string }[] = [
  { token: 'SKELETON', typeId: 1001, label: 'Skeleton' },
  { token: 'SKELETONARCHER', typeId: 1002, label: 'Skeleton Archer' },
  { token: 'SKELETONMAGE', typeId: 1003, label: 'Skeleton Mage' },
  { token: 'IMP', typeId: 1004, label: 'Imp' },
  { token: 'ZOMBIE', typeId: 1006, label: 'Zombie' },
  { token: 'WRAITH', typeId: 1007, label: 'Wraith' },
  { token: 'DEMON', typeId: 1009, label: 'Demon' },
  { token: 'COFFIN', typeId: 1013, label: 'Coffin' },
]

const ENEMY_TOKENS = new Set(WAVE_ENEMIES.map((e) => e.token))

/** Every modifier WaveFlag_ParseModifiers (0x0062E070) recognizes. Unknown
 * flags are logged and skipped by the retail parser, so this list is closed. */
export const WAVE_FLAGS: string[] = [
  'FLAG_HPUP',
  'FLAG_HPDOWN',
  'FLAG_STRONG',
  'FLAG_WEAK',
  'FLAG_FAST',
  'FLAG_SLOW',
  'FLAG_XPBONUS',
  'FLAG_BURNING',
  'FLAG_HELM',
  'FLAG_HORNED',
  'FLAG_HOODED',
  'FLAG_LEADING',
  'FLAG_SCATTERSHOT',
  'FLAG_RANDOMSHOT',
  'FLAG_POISONARROW',
  'FLAG_FIREARROW',
  'FLAG_SPLIT',
  'FLAG_SPLITMANY',
  'FLAG_ROTTEN',
  'FLAG_CASTFIRE',
  'FLAG_CASTLIGHTNING',
  'FLAG_CASTFROST',
  'FLAG_CASTPOISON',
  'FLAG_ARMOR',
  'FLAG_ARMORMAYBE',
  'FLAG_SWORD',
  'FLAG_MACE',
  'FLAG_FLAIL',
  'FLAG_AXE',
  'FLAG_PIKE',
  'FLAG_SHIELD',
  'FLAG_SHIELDOTHERS',
  'FLAG_SHIELDSTRONG',
  'FLAG_SHIELDFAST',
  'FLAG_RANGEUP',
  'FLAG_RANGEDOWN',
  'FLAG_RANGEEASY',
  'FLAG_MANYMAGGOTS',
  'FLAG_STRONGMAGGOTS',
  'FLAG_DEATHIMPS',
  'FLAG_DEATHIMPSMANY',
  'FLAG_NOSKELETONS',
  'FLAG_MORESKELETONS',
]

const FLAG_TOKENS = new Set(WAVE_FLAGS)

/** The loader rejects schedules whose distinct-enemy-type count per wave
 * exceeds its composition row limit. */
export const WAVE_COMPOSITION_MAX_ROWS = 20

export function enemyLabel(token: string): string {
  return WAVE_ENEMIES.find((e) => e.token === token)?.label ?? token
}

export function defaultWave(index: number, count: number): WaveDef {
  return {
    spawn: 14,
    spawnDelay: [50, 300],
    waveDelay: [100, 300],
    maxEnemies: 40,
    next: [count > 0 ? Math.min(index + 1, count) : 0],
    groups: [{ entries: [{ enemy: 'SKELETON', flags: ['FLAG_WEAK'] }] }],
  }
}

/** Serialize to the exact retail dialect: tab indentation, GROUP blocks,
 * bare tokens when no flags are chosen, ENDWAVE terminators. */
export function serializeWaveText(waves: WaveDef[]): string {
  const lines: string[] = []
  for (const wave of waves) {
    lines.push('WAVE')
    if (wave.next.length > 0) lines.push(`\tNEXT:${wave.next.join(',')}`)
    lines.push(`\tSPAWN:${wave.spawn}`)
    lines.push(`\tSPAWNDELAY:${wave.spawnDelay[0]}-${wave.spawnDelay[1]}`)
    lines.push(`\tWAVEDELAY:${wave.waveDelay[0]}-${wave.waveDelay[1]}`)
    lines.push(`\tMAXENEMIES:${wave.maxEnemies}`)
    if (wave.zombieWave) lines.push('\tZOMBIEWAVE')
    for (const group of wave.groups) {
      lines.push('\tGROUP')
      for (const entry of group.entries) {
        lines.push(
          entry.flags.length > 0
            ? `\t\t${entry.enemy}:${entry.flags.join('|')}`
            : `\t\t${entry.enemy}`,
        )
      }
    }
    lines.push('\tENDWAVE')
  }
  return lines.join('\n') + '\n'
}

/** Read an existing wave.txt (stock dialect or the editor's own output).
 * Mirrors the loader's grammar: BOM and comments tolerated, case folded,
 * FORMATION accepted as GROUP, ENDWAVE optional, unknown enemies rejected. */
export function parseWaveText(text: string): WaveDef[] {
  const waves: WaveDef[] = []
  let current: WaveDef | null = null
  let group: WaveGroup | null = null

  const finish = (lineNumber: number) => {
    if (!current) return
    if (current.groups.every((g) => g.entries.length === 0)) {
      throw new Error(`Wave ending near line ${lineNumber} has no enemy entries.`)
    }
    current.groups = current.groups.filter((g) => g.entries.length > 0)
    waves.push(current)
    current = null
    group = null
  }

  const rawLines = text.replace(/^﻿/, '').split(/\r?\n/)
  rawLines.forEach((rawLine, i) => {
    const lineNumber = i + 1
    const line = rawLine.trim().toUpperCase()
    if (line.length === 0 || line.startsWith('#') || line.startsWith(';')) return
    const directive = (name: string) => line === name || line.startsWith(`${name}:`)

    if (directive('WAVE')) {
      finish(lineNumber)
      current = {
        spawn: 0,
        spawnDelay: [0, 0],
        waveDelay: [0, 0],
        maxEnemies: 0,
        next: [],
        groups: [],
      }
      return
    }
    if (line === 'ENDWAVE') {
      finish(lineNumber)
      return
    }
    if (!current) throw new Error(`Content before the first WAVE at line ${lineNumber}.`)
    if (line === 'GROUP' || line === 'FORMATION') {
      group = { entries: [] }
      current.groups.push(group)
      return
    }
    if (line === 'ZOMBIEWAVE') {
      current.zombieWave = true
      return
    }
    const value = () => line.slice(line.indexOf(':') + 1).trim()
    const range = (name: string): [number, number] => {
      const m = value().match(/^(\d+)\s*-\s*(\d+)$/)
      if (!m) throw new Error(`Invalid ${name} range at line ${lineNumber}.`)
      return [Number(m[1]), Number(m[2])]
    }
    if (directive('NEXT')) {
      group = null
      current.next = value()
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
        .map((part) => {
          const n = Number(part)
          if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid NEXT value at line ${lineNumber}.`)
          return n
        })
      return
    }
    if (directive('SPAWN')) {
      group = null
      current.spawn = Number(value())
      if (!Number.isInteger(current.spawn)) throw new Error(`Invalid SPAWN value at line ${lineNumber}.`)
      return
    }
    if (directive('SPAWNDELAY')) {
      group = null
      current.spawnDelay = range('SPAWNDELAY')
      return
    }
    if (directive('WAVEDELAY')) {
      group = null
      current.waveDelay = range('WAVEDELAY')
      return
    }
    if (directive('MAXENEMIES')) {
      group = null
      current.maxEnemies = Number(value())
      if (!Number.isInteger(current.maxEnemies)) throw new Error(`Invalid MAXENEMIES value at line ${lineNumber}.`)
      return
    }
    if (!group) throw new Error(`Unknown wave directive at line ${lineNumber}: ${line}`)

    const separator = line.indexOf(':')
    const token = (separator < 0 ? line : line.slice(0, separator)).trim()
    if (!ENEMY_TOKENS.has(token)) {
      throw new Error(`Unknown enemy token at line ${lineNumber}: ${token}`)
    }
    const flags =
      separator < 0
        ? []
        : line
            .slice(separator + 1)
            .split('|')
            .map((flag) => flag.trim())
            .filter((flag) => flag.length > 0)
    group.entries.push({ enemy: token, flags })
  })
  finish(rawLines.length)
  return waves
}

/** The loader's acceptance rules, checked in the editor so a published
 * schedule cannot fail Lua-engine initialization on players' machines. */
export function validateWaves(waves: WaveDef[]): string[] {
  const problems: string[] = []
  if (waves.length === 0) return problems
  waves.forEach((wave, index) => {
    const at = `Wave ${index + 1}`
    if (!Number.isInteger(wave.spawn) || wave.spawn <= 0) {
      problems.push(`${at}: SPAWN must be a positive whole number.`)
    }
    if (!Number.isInteger(wave.maxEnemies) || wave.maxEnemies <= 0) {
      problems.push(`${at}: MAXENEMIES must be a positive whole number.`)
    }
    for (const [name, pair] of [
      ['SPAWNDELAY', wave.spawnDelay],
      ['WAVEDELAY', wave.waveDelay],
    ] as const) {
      if (
        !Number.isInteger(pair[0]) ||
        !Number.isInteger(pair[1]) ||
        pair[0] < 0 ||
        pair[1] < pair[0]
      ) {
        problems.push(`${at}: ${name} needs a min-max range with min ≤ max.`)
      }
    }
    const entries = wave.groups.flatMap((g) => g.entries)
    if (entries.length === 0) {
      problems.push(`${at}: add at least one enemy line.`)
    }
    const distinctTypes = new Set(entries.map((e) => e.enemy))
    if (distinctTypes.size > WAVE_COMPOSITION_MAX_ROWS) {
      problems.push(`${at}: uses more than ${WAVE_COMPOSITION_MAX_ROWS} distinct enemy types.`)
    }
    for (const entry of entries) {
      if (!ENEMY_TOKENS.has(entry.enemy)) {
        problems.push(`${at}: unknown enemy token ${entry.enemy}.`)
      }
      for (const flag of entry.flags) {
        if (!FLAG_TOKENS.has(flag)) {
          problems.push(`${at}: unknown flag ${flag}.`)
        }
      }
    }
    for (const next of wave.next) {
      if (!Number.isInteger(next) || next < 0 || next >= waves.length) {
        problems.push(`${at}: NEXT points at wave ${next}, which is not on the schedule (0-${waves.length - 1}).`)
      }
    }
  })
  return problems
}
