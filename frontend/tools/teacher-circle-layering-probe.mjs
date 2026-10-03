import { Application, Container, RenderTexture } from 'pixi.js'
import { createHubWorldRenderer } from '../src/game/renderer/hub-world-renderer.ts'
import { DEFAULT_GAME_SETTINGS } from '../src/game/game-settings.ts'

// Render the public Hub renderer and isolate the real actor alpha mask before
// measuring the Teacher rune contribution over opaque actor pixels.
export async function inspectTeacherCircleLayering({ defaults, ambientSamples }) {
  const width = 800, height = 600
  let world, application
  const addChild = Container.prototype.addChild
  const init = Application.prototype.init
  Container.prototype.addChild = function (...children) {
    if (children[0]?.label === 'college-courtyard') world = children[0]
    return addChild.apply(this, children)
  }
  Application.prototype.init = async function (...args) {
    const result = await init.apply(this, args)
    application = this
    return result
  }
  const fixed = {
    ...defaults, tick: 500, levelUpBarrier: null, materializingPlayerIds: [],
    world: { ...defaults.world, students: [],
      ambient: { ...defaults.world.ambient, teacherTick: 500, fountainParticles: [] },
      participants: Object.fromEntries(Object.entries(defaults.world.participants).map(([id, value]) => [
        id, { ...value, region: 'courtyard', transition: null, collegeIntro: null },
      ])),
    },
  }
  let renderer
  try {
    renderer = await createHubWorldRenderer({
      initialSnapshot: fixed, playerId: 'local',
      viewport: { width, height, displayScale: 1 }, devicePixelRatio: 1,
      now: () => 1000, settings: DEFAULT_GAME_SETTINGS, modAssets: [],
    })
  } finally {
    Container.prototype.addChild = addChild
    Application.prototype.init = init
  }
  const target = RenderTexture.create({ width, height, resolution: 1 })
  const records = []
  let upperArcImage = null, controlImage = null, highestDifference = -1
  try {
    if (!world || !application) throw new Error('actual Hub renderer was not observed')
    const rune = descendants(world).find(node => node.texture
      && node.alpha === .25 && node.x === -40 && node.y === 30)
    if (!rune) throw new Error('actual native College13 rune is missing')
    const points = [
      ...[420, 450, 480, 536, 595, 625, 655].map(x => ({ name: 'upper-arc', x, y: 670 })),
      ...[420, 450, 480, 536, 595, 625, 655].map(x => ({ name: 'opposite-row', x, y: 790 })),
    ]
    for (const ambient of ambientSamples) {
      for (const actorKind of ['local', 'guest', 'student']) {
        const cameraFovs = ambient.teacherTick === 500 && actorKind === 'local' ? [100, 80, 130] : [100]
        for (const cameraFovPercent of cameraFovs) {
          renderer.setSettings({ ...DEFAULT_GAME_SETTINGS, cameraFovPercent })
          for (const member of points) {
            const position = { x: member.x, y: member.y }
            const player = (value, point) => ({ ...value, position: point,
              velocity: { x: 0, y: 0 }, lighting: { ...value.lighting, driveActive: false } })
            const student = actorKind === 'student'
              ? { ...defaults.world.students[0], position }
              : null
            if (student && student.id === undefined) throw new Error('real Student fixture is missing')
            const frame = { ...fixed, tick: ambient.teacherTick,
              enhancedEffects: cameraFovPercent === 130 ? false : fixed.enhancedEffects, players: {
              local: player(fixed.players.local, actorKind === 'local' ? position : { x: 590, y: 750 }),
              guest: player(fixed.players.guest, actorKind === 'guest' ? position : { x: 750, y: 850 }),
            }, world: { ...fixed.world, ambient, students: student ? [student] : [] } }
            renderer.render(frame)
            const actor = world.children.find(child => child.label === (student ? 'student' : 'local-player')
              && child.x === position.x && child.y === position.y)
            if (!actor) throw new Error('real player actor is missing')
            const mask = captureOpaqueActor(application, actor, target)
            rune.visible = false
            renderer.render(frame)
            const without = capture(renderer.canvas)
            rune.visible = true
            renderer.render(frame)
            const withRune = capture(renderer.canvas)
            const difference = compare(without.pixels, withRune.pixels, mask)
            if (difference.opaqueActorPixels === 0) throw new Error('opaque actor control is empty')
            if (difference.exposedGroundChangedPixels === 0) throw new Error('visible rune ground control is empty')
            const diagnostic = renderer.canvas.__sdrHubFrame
            const teacherRow = diagnostic.painterOrder.find(row => row.id === 'fixed:teacher')
            const rowId = student ? `student:${student.id}` : `player:${actorKind}`
            const playerRow = diagnostic.painterOrder.find(row => row.id === rowId)
            if (!teacherRow || !playerRow) throw new Error('real actor painter rows are missing')
            records.push({ ...member, ...difference, teacherRow: { ...teacherRow }, playerRow: { ...playerRow },
              phaseTick: ambient.teacherTick, actorKind, cameraFovPercent,
              enhancedEffects: frame.enhancedEffects, teacherFrame: diagnostic.teacherFrame,
              teacherBurst: { ...diagnostic.teacherBurst },
              runeParent: rune.parent.label, runeAlpha: rune.alpha,
              runeTextureOriginal: { width: rune.texture.orig.width, height: rune.texture.orig.height },
              playerScreenPosition: student ? null : { ...diagnostic.playerScreenPositions[actorKind] } })
            if (member.name === 'upper-arc' && difference.maximumOpaqueActorDifference > highestDifference) {
              highestDifference = difference.maximumOpaqueActorDifference
              upperArcImage = { name: member.name, position: { x: member.x, y: member.y },
                without: without.image, withRune: withRune.image }
            }
            if (member.name === 'opposite-row' && controlImage === null) {
              controlImage = { name: member.name, position: { x: member.x, y: member.y },
                without: without.image, withRune: withRune.image }
            }
          }
        }
      }
    }
    const teacherFrames = [...new Set(records.map(row => row.teacherFrame))].sort()
    if (JSON.stringify(teacherFrames) !== '[0,1,2,3]') throw new Error('Teacher pose coverage is incomplete')
    const upper = records.filter(row => row.name === 'upper-arc')
    const control = records.filter(row => row.name === 'opposite-row')
    if (control.some(row => row.maximumOpaqueActorDifference > 2)) {
      throw new Error('opposite-row ordering control changes opaque actor pixels')
    }
    if (upper.some(row => row.maximumOpaqueActorDifference > 2)) {
      throw new Error('Teacher rune still covers an opaque wizard')
    }
    return { mode: 'regression', rendererName: renderer.canvas.dataset.rendererName,
      resolution: renderer.canvas.dataset.resolution, teacherFrames, records, upperArcImage, controlImage }
  } finally {
    target.destroy(true)
    renderer.destroy()
    if (world && !world.destroyed) throw new Error('owned Hub scene survived renderer teardown')
  }
}

function descendants(root) {
  return root.children.flatMap(child => [child, ...descendants(child)])
}

function captureOpaqueActor(app, actor, target) {
  const hidden = []
  let child = actor
  for (let parent = child.parent; parent; parent = child.parent) {
    for (const sibling of parent.children) {
      if (sibling === child) continue
      hidden.push([sibling, sibling.visible])
      sibling.visible = false
    }
    child = parent
  }
  try {
    app.renderer.render({ container: app.stage, target, clear: true, clearColor: [0, 0, 0, 0] })
    return app.renderer.extract.pixels({ target }).pixels
  } finally {
    for (const [node, visible] of hidden) node.visible = visible
  }
}

function capture(canvas) {
  const copy = document.createElement('canvas')
  copy.width = canvas.width; copy.height = canvas.height
  const context = copy.getContext('2d')
  context.drawImage(canvas, 0, 0)
  return { pixels: context.getImageData(0, 0, copy.width, copy.height).data,
    image: copy.toDataURL('image/png') }
}

function compare(first, second, mask) {
  let opaqueActorPixels = 0, opaqueActorChangedPixels = 0
  let maximumOpaqueActorDifference = 0, exposedGroundChangedPixels = 0
  for (let index = 0; index < first.length; index += 4) {
    const difference = Math.max(...[0, 1, 2].map(channel => Math.abs(first[index + channel] - second[index + channel])))
    if (mask[index + 3] >= 254) {
      opaqueActorPixels += 1
      maximumOpaqueActorDifference = Math.max(maximumOpaqueActorDifference, difference)
      if (difference > 2) opaqueActorChangedPixels += 1
    } else if (mask[index + 3] === 0 && difference > 2) exposedGroundChangedPixels += 1
  }
  return { opaqueActorPixels, opaqueActorChangedPixels,
    maximumOpaqueActorDifference, exposedGroundChangedPixels }
}
