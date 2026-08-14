import type {
  PrimarySpellProjectileState,
  PrimarySpellSimulationState,
  PrimarySpellTransientState,
} from '../core-kernels/primary-spells.ts'

export function copyPrimarySpellState(
  spells: PrimarySpellSimulationState,
): PrimarySpellSimulationState {
  return {
    nextId: spells.nextId,
    projectiles: spells.projectiles.map(copyProjectile),
    transients: spells.transients.map(copyTransient),
  }
}

export function interpolatePrimarySpellState(
  older: PrimarySpellSimulationState,
  newer: PrimarySpellSimulationState,
  blend: number,
): PrimarySpellSimulationState {
  const newerProjectiles = new Map(newer.projectiles.map((spell) => [spell.id, spell]))
  const projectiles = older.projectiles.map((spell) => {
    const next = newerProjectiles.get(spell.id)
    return next ? interpolateProjectile(spell, next, blend) : copyProjectile(spell)
  })
  const newerTransients = new Map(newer.transients.map((effect) => [effect.id, effect]))
  const transients = older.transients.map((effect) => {
    const next = newerTransients.get(effect.id)
    return next ? interpolateTransient(effect, next, blend) : copyTransient(effect)
  })
  if (blend >= 1) {
    const projectileIds = new Set(projectiles.map((spell) => spell.id))
    for (const spell of newer.projectiles) {
      if (!projectileIds.has(spell.id)) projectiles.push(copyProjectile(spell))
    }
    const transientIds = new Set(transients.map((effect) => effect.id))
    for (const effect of newer.transients) {
      if (!transientIds.has(effect.id)) transients.push(copyTransient(effect))
    }
  }
  return {
    nextId: blend < 1 ? older.nextId : newer.nextId,
    projectiles: blend < 1
      ? projectiles
      : projectiles.filter((spell) => newerProjectiles.has(spell.id)),
    transients: blend < 1
      ? transients
      : transients.filter((effect) => newerTransients.has(effect.id)),
  }
}

function interpolateProjectile(
  older: PrimarySpellProjectileState,
  newer: PrimarySpellProjectileState,
  blend: number,
): PrimarySpellProjectileState {
  const discrete = blend < 1 ? older : newer
  return {
    ...discrete,
    ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
    charge: lerp(older.charge, newer.charge, blend),
    direction: {
      x: lerp(older.direction.x, newer.direction.x, blend),
      y: lerp(older.direction.y, newer.direction.y, blend),
    },
    position: {
      x: lerp(older.position.x, newer.position.x, blend),
      y: lerp(older.position.y, newer.position.y, blend),
    },
    velocity: {
      x: lerp(older.velocity.x, newer.velocity.x, blend),
      y: lerp(older.velocity.y, newer.velocity.y, blend),
    },
  }
}

function interpolateTransient(
  older: PrimarySpellTransientState,
  newer: PrimarySpellTransientState,
  blend: number,
): PrimarySpellTransientState {
  const discrete = blend < 1 ? older : newer
  if (older.kind === 'earth-impact' && newer.kind === 'earth-impact') {
    const impact = blend < 1 ? older : newer
    return {
      ...impact,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      origin: {
        x: lerp(older.origin.x, newer.origin.x, blend),
        y: lerp(older.origin.y, newer.origin.y, blend),
      },
    }
  }
  if (older.kind === 'earth-impact' || newer.kind === 'earth-impact') {
    return copyTransient(discrete)
  }
  if (older.kind === 'earth-called-rock' && newer.kind === 'earth-called-rock') {
    const rock = blend < 1 ? older : newer
    return {
      ...rock,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      fallVelocity: lerp(older.fallVelocity, newer.fallVelocity, blend),
      height: lerp(older.height, newer.height, blend),
      position: {
        x: lerp(older.position.x, newer.position.x, blend),
        y: lerp(older.position.y, newer.position.y, blend),
      },
      rotation: lerp(older.rotation, newer.rotation, blend),
      speed: lerp(older.speed, newer.speed, blend),
    }
  }
  if (older.kind === 'earth-called-rock' || newer.kind === 'earth-called-rock') {
    return copyTransient(discrete)
  }
  if (older.kind === 'fire' && newer.kind === 'fire') {
    const fire = blend < 1 ? older : newer
    return {
      ...fire,
      ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
      direction: { ...fire.direction },
      origin: { ...fire.origin },
    }
  }
  if (older.kind === 'fire' || newer.kind === 'fire') return copyTransient(discrete)
  const channel = blend < 1 ? older : newer
  return {
    ...channel,
    ageTicks: lerp(older.ageTicks, newer.ageTicks, blend),
    direction: {
      x: lerp(older.direction.x, newer.direction.x, blend),
      y: lerp(older.direction.y, newer.direction.y, blend),
    },
    origin: {
      x: lerp(older.origin.x, newer.origin.x, blend),
      y: lerp(older.origin.y, newer.origin.y, blend),
    },
  }
}

function copyProjectile(spell: PrimarySpellProjectileState): PrimarySpellProjectileState {
  return {
    ...spell,
    direction: { ...spell.direction },
    position: { ...spell.position },
    velocity: { ...spell.velocity },
  }
}

function copyTransient(effect: PrimarySpellTransientState): PrimarySpellTransientState {
  if (effect.kind === 'earth-impact') {
    return { ...effect, origin: { ...effect.origin } }
  }
  if (effect.kind === 'earth-called-rock') {
    return { ...effect, position: { ...effect.position } }
  }
  return {
    ...effect,
    direction: { ...effect.direction },
    origin: { ...effect.origin },
  }
}

function lerp(first: number, second: number, blend: number): number {
  return first + (second - first) * blend
}
