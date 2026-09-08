import { Container, Sprite } from 'pixi.js'
import { createBoneyardEnemyStore, stepBoneyardEnemyStore } from '../src/game/core-server/boneyard-enemy-store.ts'
import { BONEYARD_WAVE_ENEMY_TYPES } from '../src/game/core-kernels/boneyard-wave-director.ts'
import { nativePortalProgram, nativePortalRecipe } from '../src/game/core-kernels/native-survival-portal.ts'
import { projectBoneyardEnemies } from '../src/game/host/project-boneyard-enemies.ts'
import { loadBoneyardWorldTextures, destroyBoneyardWorldTextures } from '../src/game/renderer/boneyard-textures.ts'
import { createGameWebGlApplication } from '../src/game/renderer/game-webgl.ts'
import { installNativeArenaRenderPipeline } from '../src/game/renderer/native-arena-render-pipeline.ts'
import { NativeEnemyViews } from '../src/game/renderer/native-enemy-view.ts'

export async function renderEnemyBodyMatrix({ scale = 1, offset = 0, pageSize = 28 } = {}) {
  const variants = []
  const add = (name, token, flags = [], appearance = {}, spawn = {}) => {
    variants.push({ name, token, flags, appearance, spawn })
  }
  for (const armored of [false, true]) {
    for (const weapon of ['claw', 'sword', 'mace', 'flail', 'axe', 'pike']) {
      add(`${armored ? 'Armored ' : ''}Skeleton ${weapon}`, 'SKELETON',
        [...(armored ? ['FLAG_ARMOR'] : []), ...(weapon === 'claw' ? [] : [`FLAG_${weapon.toUpperCase()}`])])
    }
  }
  for (const arrow of ['normal', 'fire', 'poison']) {
    add(`Archer ${arrow}`, 'SKELETONARCHER', arrow === 'normal' ? [] : [`FLAG_${arrow.toUpperCase()}ARROW`])
  }
  for (const element of ['fire', 'frost', 'lightning', 'poison']) {
    for (const cloak of [false, true]) {
      add(`Mage ${element}${cloak ? ' cloak' : ''}`, 'SKELETONMAGE', [],
        { mageElement: element, mageCloak: cloak })
    }
  }
  for (const zombieBodyType of [0, 1, 2, 3]) {
    for (const zombieHeadType of [0, 1, 2, 3]) {
      add(`Zombie body ${zombieBodyType} head ${zombieHeadType}`, 'ZOMBIE', [], { zombieBodyType, zombieHeadType })
    }
  }
  add('Rotten Zombie', 'ZOMBIE', ['FLAG_ROTTEN'])
  for (let bodyPose = 0; bodyPose < 4; bodyPose += 1) {
    add(`Imp body ${bodyPose}`, 'IMP', [], { bodyPose })
    add(`Green Imp body ${bodyPose}`, 'IMP', [], { nativeTypeId: 2044, bodyPose })
  }
  add('Good Imp body', 'IMP', [], { nativeTypeId: 1005 })
  add('Wraith', 'WRAITH')
  add('Burning Wraith', 'WRAITH', ['FLAG_BURNING'])
  add('Demon', 'DEMON')
  add('Coffin', 'COFFIN')
  add('Spider', 'SPIDER')
  add('Faculty male', 'DIREFACULTY')
  add('Faculty female', 'DIREFACULTY', [], { female: true })
  add('Heartmonger', 'HEARTMONGER')
  add('Demon Skull', 'DEMONSKULL')
  add('Portal', 'PORTAL')
  add('Cocoon (no body)', 'COCOON')

  for (const token of ['SKELETON', 'SKELETONARCHER', 'SKELETONMAGE']) {
    for (let headgear = 0; headgear < 6; headgear += 1) add(`${token} headgear ${headgear}`, token, [], { headgear })
  }
  for (const element of ['fire', 'lightning', 'frost', 'poison']) {
    add(`Mage ${element} charging`, 'SKELETONMAGE', [], { mageElement: element, mageCloak: true, charge: .75 })
  }
  add('Pike holding target with recoil', 'SKELETON', ['FLAG_PIKE'], { bodyPose: 12,
    animation: { state: 'action', action: 'skeleton-pike', actionProgress: 2, verticalOffset: -2,
      pikeTargetOffset: { x: 65, y: 25 } } })
  add('Burning flail attacking', 'SKELETON', ['FLAG_FLAIL', 'FLAG_BURNING'], { bodyPose: 6,
    animation: { state: 'action', action: 'skeleton-weapon', actionProgress: 25, bodyGaitPhase: 2.5, verticalOffset: -2 } })
  const totalVariants = variants.length
  const pageVariants = variants.slice(offset, offset + pageSize)
  const cell = { width: 320, height: 300 }
  const headings = [0, 60, 120, 180, 240, 300]
  const gpu = await createGameWebGlApplication({ className: 'enemy-body-matrix',
    width: cell.width * headings.length, height: cell.height * pageVariants.length })
  gpu.application.renderer.background.color = 0x24252b
  const pipeline = installNativeArenaRenderPipeline(gpu.application.renderer)
  const textures = await loadBoneyardWorldTextures()
  const root = new Container()
  const underlay = new Container()
  gpu.application.stage.addChild(root)
  const views = new NativeEnemyViews(root, textures, underlay, underlay)
  const portalRecipe = nativePortalRecipe(nativePortalProgram(
    'bd3c38468481b7337b1e7382e5503cc214356906571763a68188b23e821e73fb',
  ).phases[0])
  const enemies = []
  for (const [row, variant] of pageVariants.entries()) {
    const nativeTypeId = BONEYARD_WAVE_ENEMY_TYPES[variant.token]
    const store = stepBoneyardEnemyStore(createBoneyardEnemyStore(`body-matrix:${row}`), {
      tick: 20, players: {}, projectileWorldBlocked: () => false,
      resolveMovement: request => request.requestedPosition,
      resolveSpawnIntents: () => [{ enemyToken: variant.token, flags: variant.flags,
        id: row + 1, locationPolicy: 'anywhere', nativeTypeId, position: { x: 0, y: 0 },
        spawnTick: 20, waveOrdinal: 1, ...variant.spawn,
        ...(variant.token === 'PORTAL' ? { authoredRecipe: portalRecipe } : {}) }],
    }).store
    const projected = projectBoneyardEnemies({ ...store, actors: store.actors.map(actor => ({
      ...actor, config: { ...actor.config, scale },
    })) }, 20)[0]
    if (!projected) throw new Error(`${variant.name} was not constructed`)
    for (const [column, headingDeg] of headings.entries()) {
      const id = row * headings.length + column + 1
      enemies.push({ ...projected, ...variant.appearance, id, headingDeg,
        position: { x: column * cell.width + cell.width / 2, y: row * cell.height + 225 },
        lighting: { charge: variant.appearance.charge ?? (variant.token === 'SKELETONMAGE' ? 0 : 1), glow: 1, providerCopies: 1 },
        lightRegistration: { managerLane: 'actor', registrationOrdinal: id },
        animation: { ...projected.animation, alpha: 1, bodyPose: variant.appearance.bodyPose ?? 0, gaitPose: 0,
          stridePhaseDeg: variant.token === 'PORTAL' ? store.actors[0].brain.fixedScale : 0, verticalOffset: 0, impEffectAlpha: 1,
          zombieBodyType: variant.appearance.zombieBodyType ?? projected.animation.zombieBodyType,
          zombieHeadType: variant.appearance.zombieHeadType ?? projected.animation.zombieHeadType,
          coffinState: 'closed', coffinPose: 0, ...variant.appearance.animation,
          ...(variant.appearance.animation?.pikeTargetOffset ? { pikeTargetOffset: {
            x: Math.sin(headingDeg * Math.PI / 180) * 103 * scale,
            y: -Math.cos(headingDeg * Math.PI / 180) * 103 * scale,
          } } : {}),
          spider: variant.token === 'SPIDER' ? { bodyHeadingDeg: headingDeg, outlineAlpha: 0, outlineTint: 0 } : null },
        ...(projected.faculty ? { faculty: { ...projected.faculty, bodyHeadingDeg: headingDeg,
          female: variant.appearance.female ?? projected.faculty.female } } : {}),
        ...(projected.demonSkull ? { demonSkull: { ...projected.demonSkull, bodyHeadingDeg: headingDeg } } : {}),
      })
    }
  }
  views.update(enemies, 130, true, 130)
  gpu.application.renderer.render(gpu.application.stage)
  const sprites = root.children.map(container => ({
    name: pageVariants[Math.floor((Number(container.label.split(':').at(-1)) - 1) / headings.length)].name,
    label: container.label,
    parts: container.children.filter(child => child instanceof Sprite).map(child => ({
      label: child.label, x: child.position.x, y: child.position.y,
      width: child.width, height: child.height, alpha: child.alpha,
    })),
  }))
  const image = document.createElement('img')
  image.id = 'enemy-bodies'
  image.src = gpu.canvas.toDataURL('image/png')
  const panel = document.createElement('div')
  panel.style.cssText = `position:relative;width:${gpu.canvas.width}px;background:#24252b`
  panel.append(image)
  pageVariants.forEach((variant, row) => {
    const label = document.createElement('div')
    label.style.cssText = `position:absolute;top:${row * cell.height}px;left:8px;color:white;font:13px monospace`
    label.textContent = `${variant.name} (scale ${scale})`
    panel.append(label)
  })
  panel.id = 'enemy-body-panel'
  document.body.replaceChildren(panel)
  document.body.style.margin = '0'
  views.update([], 131, true, 131)
  const remainingBodies = root.children.length
  views.destroy()
  pipeline.destroy()
  gpu.destroy()
  destroyBoneyardWorldTextures(textures)
  return { variants: pageVariants.map(({ name }) => name), totalVariants, offset, scale, remainingBodies,
    sprites, count: enemies.length,
    width: cell.width * headings.length, height: cell.height * pageVariants.length }
}
