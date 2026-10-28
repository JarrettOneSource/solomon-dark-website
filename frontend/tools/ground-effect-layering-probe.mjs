import { Container } from 'pixi.js'
import { createBoneyardWorldRenderer } from '../src/game/renderer/boneyard-world-renderer.ts'
import { DEFAULT_GAME_SETTINGS } from '../src/game/game-settings.ts'

export async function inspectGroundEffectLayering({ loaded, defaults }) {
  const position = { x: 600, y: 400 }
  const scene = { bounds: { x: 0, y: 0, w: 1200, h: 800 }, environmentMode: 0,
    fences: [], name: 'Ground effects', objects: [], roads: [], solomonDig: null,
    spawn: { ...position, facingDeg: 0 }, sprites: [], terrain: [] }
  const snapshot = { ...defaults, tick: 200, materializingPlayerIds: [],
    players: { local: { ...defaults.players.local, position, velocity: { x: 0, y: 0 },
      lighting: { ...defaults.players.local.lighting, driveActive: false } } },
    world: { ...defaults.world, arenaTransition: null, encounter: null, enemies: [],
      deathEffects: [], enemyProjectiles: [], enemyProjectileEffects: [], maggots: [],
      spiderSilks: [], spiderRemains: [], silkFragments: [], webbedPlayers: {},
      goodies: [], loot: [], gateLeaves: [], bossSpells: [],
      lanternPosition: null, lanternLightRegistration: null, tutorial: null },
  }
  const pool = { id: 1, position, ageTicks: 100, spawnTick: 100, nativeTypeId: 0x806, kind: 'poison-pool',
    payload: 'poison', headingDeg: 0, height: 0, speed: 0, visualScale: 1.6, visualPhaseDeg: 0,
    painterRegistration: { managerLane: 'actor', registrationOrdinal: 10 }, lightRegistration: null }
  const stain = { id: 2, position, ageTicks: 100, spawnTick: 100,
    kind: 'fade-perspective-clipped', atlas: 'DeadHawg', entry: 30, alpha: .6, blendMode: 'normal',
    scale: 1.75, scaleY: 1.75, rotationRadians: 0, height: 0, shadow: false, tint: 0xffffff,
    painterRegistration: null, presentationOwner: 'background' }
  const remains = entry => ({ id: 3, spawnTick: 0, state: { position: { x: 650, y: 450 }, headingDeg: 0,
    slideSpeed: { x: 0, y: 0 }, frame: 1, life: 9, decalGrowth: 1,
    decal: { entry, position, rotationDeg: 0, scale: .9, alpha: 1 } } })
  const cases = [
    ...[25, 26, 27, 28, 29].map(atlasEntry => ({ name: `compact-${atlasEntry}`, sprites: [
      { eid: `compact:${atlasEntry}`, atlasEntry, pos: position, s0: 0, s1: 1, s2: 1, flags: 0 },
    ] })),
    ...[140, 141, 142].map(entry => ({ name: `spider-${entry}`, world: { spiderRemains: [remains(entry)] } })),
    ...[10, 100, 3100].map(ageTicks => ({ name: `poison-${ageTicks}`, world: { enemyProjectiles: [
      { ...pool, ageTicks, visualScale: ageTicks === 10 ? 1.25 : 1.6 },
    ] } })),
    ...[-12, 12].map(y => ({ name: `zombie-${y}`, world: { deathEffects: [
      { ...stain, position: { x: position.x, y: position.y + y } },
    ] } })),
    { name: 'zombie-late-splat', world: { deathEffects: [{ ...stain, kind: 'late-splat', entry: 31,
      presentationOwner: 'pre-world-queue' }] } },
  ]
  const records = []
  for (const complexLighting of [false, true]) {
    for (const environmentMode of [0, 1, 2]) {
      for (const member of cases) {
        let world
        const addChild = Container.prototype.addChild
        Container.prototype.addChild = function (...children) {
          if (children[0]?.label === 'boneyard-world') world = children[0]
          return addChild.apply(this, children)
        }
        const initial = { ...snapshot, world: { ...snapshot.world, ...member.world } }
        let renderer
        try {
          renderer = await createBoneyardWorldRenderer({
            boneyard: { ...loaded, scene: { ...scene, environmentMode, sprites: member.sprites ?? [] } },
            initialSnapshot: initial, playerId: 'local', viewport: { width: 800, height: 600, displayScale: 1 },
            devicePixelRatio: 1, now: () => 1000,
            settings: { ...DEFAULT_GAME_SETTINGS, complexLighting }, modAssets: [], modCatalog: [],
          })
        } finally { Container.prototype.addChild = addChild }
        try {
          const ground = world.children.find(child => child.label === 'boneyard-direct-pre-world')
          const lights = ground.children.find(child => child.label === 'boneyard-ground-lights')
          const player = world.children.find(child => child.label === 'local-player')
          if (!lights || !(ground.zIndex < player.zIndex)) throw new Error('ground light escaped the pre-world owner')
          ground.visible = false
          renderer.render(initial)
          const baseline = capture(renderer.canvas)
          ground.visible = true
          renderer.render(initial)
          const corrected = capture(renderer.canvas)
          const maximumBodyDifference = bodyDifference(baseline, corrected)
          if (maximumBodyDifference > 2) throw new Error(`${member.name}/${environmentMode}/${complexLighting} covers wizard: ${maximumBodyDifference}`)
          const changedPixels = differenceCount(baseline, corrected)
          if (changedPixels === 0) throw new Error(`${member.name} produced no ground pixels`)
          const apertures = lights.children.filter(child => child.label.startsWith('boneyard-environment-light:'))
          if (apertures.length !== (environmentMode === 0 ? 0 : 1)) throw new Error('environment aperture mode gate failed')
          for (const aperture of apertures) {
            if (aperture.alpha < .2375 * .14 || aperture.alpha > .25 * .14) throw new Error('ground aperture brightness changed')
            if (aperture.x !== position.x || aperture.y !== position.y) throw new Error('ground aperture lost its player')
          }
          const guest = { ...initial.players.local, position: { x: 610, y: 400 },
            lighting: { ...initial.players.local.lighting, lightRegistration: { managerLane: 'actor', registrationOrdinal: 20 } } }
          renderer.render({ ...initial, players: { ...initial.players, guest } })
          const joinedApertures = lights.children.filter(child => child.label.startsWith('boneyard-environment-light:')).length
          if (joinedApertures !== (environmentMode === 0 ? 0 : 2)) throw new Error('joined player ground light missing')
          renderer.render({ ...initial, players: { ...initial.players, guest }, materializingPlayerIds: ['guest'] })
          if (lights.children.some(child => child.label === 'boneyard-environment-light:guest')) throw new Error('materializing player kept ground light')
          renderer.render(initial)
          records.push({ name: member.name, environmentMode, complexLighting, maximumBodyDifference, changedPixels })
        } finally {
          renderer.destroy()
          if (!world.destroyed) throw new Error('world ground owner survived renderer teardown')
        }
      }
    }
  }
  return records
}

function capture(canvas) {
  const copy = document.createElement('canvas')
  copy.width = canvas.width; copy.height = canvas.height
  const context = copy.getContext('2d')
  context.drawImage(canvas, 0, 0)
  return context.getImageData(0, 0, copy.width, copy.height).data
}

function bodyDifference(first, second) {
  let maximum = 0
  for (let y = 292; y < 298; y += 1) {
    for (let x = 397; x < 403; x += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        const index = (y * 800 + x) * 4 + channel
        maximum = Math.max(maximum, Math.abs(first[index] - second[index]))
      }
    }
  }
  return maximum
}

function differenceCount(first, second) {
  let changed = 0
  for (let index = 0; index < first.length; index += 4) {
    if (Math.max(...[0, 1, 2].map(channel => Math.abs(first[index + channel] - second[index + channel]))) > 2) changed += 1
  }
  return changed
}
