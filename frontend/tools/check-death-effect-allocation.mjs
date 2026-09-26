import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Container, Matrix, Mesh, Sprite, Texture } from 'pixi.js'
import { createServer } from 'vite'

const [output, baseline = 'bfa35bd3'] = process.argv.slice(2)
assert.ok(output, 'usage: node tools/check-death-effect-allocation.mjs OUTPUT [BASELINE_COMMIT]')
assert.match(baseline, /^[a-f0-9]{7,40}$/)
const root = fileURLToPath(new URL('../', import.meta.url))
const path = 'src/game/renderer/native-enemy-death-effect-view.ts'
const oldSource = execFileSync('git', ['show', `${baseline}:frontend/${path}`], { cwd: root, encoding: 'utf8' })
const candidateSource = await readFile(new URL('../' + path, import.meta.url), 'utf8')
const hash = value => createHash('sha256').update(value).digest('hex')
const server = await createServer({ root, appType: 'custom', logLevel: 'silent',
  server: { middlewareMode: true }, plugins: [{ name: 'matched-death-allocation-baseline', enforce: 'pre',
    load(id) { return id.endsWith('?allocation-baseline') ? oldSource : undefined },
  }] })
try {
  const reference = await server.ssrLoadModule('/' + path + '?allocation-baseline')
  const candidate = await server.ssrLoadModule('/' + path)
  const { nativeEnemySpriteRecord } = await server.ssrLoadModule('/src/game/renderer/native-enemy-assets.ts')
  const textures = { base: { [nativeEnemySpriteRecord('BadGuys', 1).source]: Texture.EMPTY } }
  const outside = { x: 10000, y: 10000, w: 1600, h: 900 }
  const inside = { x: -1000, y: -1000, w: 2000, h: 2000 }
  const effects = Array.from({ length: 2000 }, (_, index) => ({
    ageTicks: 25, alpha: 0.4, atlas: 'BadGuys', blendMode: 'add', entry: 1,
    height: 5, id: index + 1, kind: 'fade', ownerActorId: 1,
    painterRegistration: { managerLane: 'transient', registrationOrdinal: index + 1 },
    presentationOwner: 'world-sorted', position: { x: index % 20, y: index % 17 },
    rotationRadians: 0.5, scale: 1, scaleY: 1, shadow: index % 2 === 0,
    spawnTick: 100, tint: 0xffffff,
  }))
  function workload(module, compareVisible = false) {
    const world = new Container(), preWorld = new Container()
    const views = new module.NativeEnemyDeathEffectViews(world, textures, preWorld)
    views.update(effects, outside, 900)
    const counts = { logicalEffects: views.size, visibleEffects: views.visibleSize,
      containers: world.children.length, sprites: world.children.reduce((sum, row) => sum + row.children.length, 0) }
    let visible
    if (compareVisible) {
      effects.forEach(effect => views.setDepth(effect.id, effect.id + 0.25))
      views.update(effects, inside, 900)
      views.applyWorldPainterDepths?.(effects.map(effect => ({
        id: `enemy-death-effect:${effect.id}`, row: 0, zIndex: effect.id + 0.25,
      })))
      world.sortChildren()
      visible = world.children.flatMap(row => row instanceof Mesh
        ? meshDraws(row)
        : (row instanceof Sprite ? [row] : row.children).map(spriteDraw))
    }
    views.update([], outside, 900)
    views.applyWorldPainterDepths?.([])
    views.destroy()
    assert.equal(world.children.length + preWorld.children.length, 0)
    world.destroy(); preWorld.destroy()
    return { counts, visible }
  }
  const referenceProof = workload(reference, true), candidateProof = workload(candidate, true)
  assert.deepEqual(candidateProof.visible, referenceProof.visible, 'visible output after entry must match')
  assert.equal(candidateProof.counts.logicalEffects, referenceProof.counts.logicalEffects)
  assert.ok(candidateProof.counts.containers <= referenceProof.counts.containers)
  assert.equal(candidateProof.counts.sprites, 0)
  const samples = []
  for (let warm = 0; warm < 3; warm++) { workload(reference); workload(candidate) }
  for (let round = 0; round < 12; round++) {
    for (const name of round % 2 === 0 ? ['reference', 'candidate'] : ['candidate', 'reference']) {
      const cpu = process.cpuUsage(), begin = performance.now()
      workload(name === 'reference' ? reference : candidate)
      const elapsedMs = performance.now() - begin, used = process.cpuUsage(cpu)
      samples.push({ round, name, elapsedMs, cpuMs: (used.user + used.system) / 1000 })
    }
  }
  const median = values => { values.sort((a, b) => a - b); return (values[5] + values[6]) / 2 }
  const medians = Object.fromEntries(['reference', 'candidate'].map(name => [name,
    median(samples.filter(row => row.name === name).map(row => row.elapsedMs))]))
  const receipt = { atUtc: new Date().toISOString(), node: process.version, baseline,
    scope: 'Identical 2000-effect offscreen admission and retirement; no GPU render, no forced GC. Alternating paired Mac timings, not Windows FPS.',
    sourceHashes: { reference: hash(oldSource), candidate: hash(candidateSource) },
    resources: { reference: referenceProof.counts, candidate: candidateProof.counts },
    visibleOutputEqual: true, visibleOutputHash: hash(JSON.stringify(candidateProof.visible)),
    medianMs: medians, reductionPercent: 100 * (1 - medians.candidate / medians.reference), samples }
  await writeFile(output, JSON.stringify(receipt, null, 2) + '\n')
  console.log(JSON.stringify({ ...receipt, samples: undefined }))
} finally { await server.close() }

function spriteDraw(sprite) {
  const transform = sprite.getGlobalTransform(new Matrix())
  const { minX, minY, maxX, maxY } = sprite.bounds
  const positions = [minX, minY, maxX, minY, maxX, maxY, minX, maxY]
  for (let index = 0; index < positions.length; index += 2) {
    const x = positions[index], y = positions[index + 1]
    positions[index] = Math.fround(transform.a * x + transform.c * y + transform.tx)
    positions[index + 1] = Math.fround(transform.d * y + transform.b * x + transform.ty)
  }
  const tint = sprite.tint
  const color = ((tint >> 16 | tint & 0xff00 | (tint & 255) << 16)
    + (Math.trunc(sprite.alpha * 255) << 24)) >>> 0
  return { positions, color, blendMode: sprite.blendMode, texture: sprite.texture.uid }
}

function meshDraws(mesh) {
  const draws = []
  const { geometry } = mesh
  const indices = geometry.indexBuffer.data
  const positions = geometry.getBuffer('aPosition').data
  const colors = geometry.getBuffer('aColor').data
  for (let index = 0; index < indices.length; index += 6) {
    if (indices[index] === indices[index + 1]) continue
    const vertex = indices[index]
    draws.push({ positions: [...positions.slice(vertex * 2, vertex * 2 + 8)],
      color: colors[vertex], blendMode: mesh.blendMode, texture: mesh.texture.uid })
  }
  return draws
}
