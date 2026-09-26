import {
  NATIVE_SKILL_CATALOG, NATIVE_WELD_BUILDS, nativeSkillCategory, nativeSkillIconRecord,
} from '../src/game/core-kernels/player-progression.ts'
import { createGameWebGlApplication, loadGameTextureMap } from '../src/game/renderer/game-webgl.ts'
import { drawNativeSkillHoverBox } from '../src/game/renderer/native-skill-hover-box.ts'
import { nativeUiAtlasSource } from '../src/game/native-ui/native-ui-assets.ts'
import { destroyNativeUiPixiFor } from '../src/game/native-ui/pixi.ts'

export async function inspectSkillTooltipRendering() {
  const textures = await loadGameTextureMap({ stock: [nativeUiAtlasSource('Fonts')] })
  const { application: app } = await createGameWebGlApplication({
    className: 'skill-tooltip-probe', width: 1600, height: 900,
  })
  const failures = []
  const records = []
  let image
  let cases = 0
  let glyphs = 0
  const descriptionDirectives = []
  const draw = (row, sourceX, sourceY) => {
    const box = drawNativeSkillHoverBox(app.stage, textures, { row, sourceX, sourceY })
    if (!box) throw new Error(`No tooltip for native skill ${row.id}`)
    app.renderer.render(app.stage)
    const border = box.children[0].getBounds()
    const bounds = { left: border.minX, top: border.minY, right: border.maxX, bottom: border.maxY }
    for (const line of box.children.slice(1)) {
      glyphs += line.children.length
      if (!line.children.length) continue
      const ink = line.getBounds()
      if (ink.minX < bounds.left || ink.maxX > bounds.right
        || ink.minY < bounds.top || ink.maxY > bounds.bottom) {
        failures.push({ id: row.id, rank: row.effectiveRank, text: line.label, bounds,
          ink: { left: ink.minX, top: ink.minY, right: ink.maxX, bottom: ink.maxY } })
      }
    }
    cases += 1
    if (row.id === 58 && row.effectiveRank === 1 && row.permanentRank === 1) {
      records.push({ id: 58, bounds, text: box.children.slice(1).map(line => line.label) })
      image = app.renderer.extract.canvas({ target: app.stage }).toDataURL('image/png')
    }
    box.destroy({ children: true })
    if (app.stage.children.length) throw new Error('Tooltip retained children after destruction')
  }
  try {
    for (let id = 8; id <= 79; id += 1) {
      const skill = NATIVE_SKILL_CATALOG[id]
      if (/_[a-z]/i.test(skill.config?.mDescription ?? '')) descriptionDirectives.push(id)
      const maximum = Number(skill.config?.mMaxLevel ?? 1)
      for (const rank of new Set([1, maximum, maximum + 4])) {
        for (const permanentRank of [0, rank]) {
          const row = {
            id, name: skill.name, category: nativeSkillCategory(id), dependencyIds: [],
            description: skill.config?.mDescription ?? '', permanentRank, effectiveRank: rank,
            iconRecord: nativeSkillIconRecord(id, id === 52 ? 1000 : null),
            weldBuildId: id === 52 ? 1000 : null,
          }
          draw(row, cases % 2 ? 50 : 1550, cases % 3 ? 750 : 40)
        }
      }
    }
    for (const build of NATIVE_WELD_BUILDS) {
      draw({ id: 52, category: 1, dependencyIds: [], description: build.pairDescription,
        name: build.syntheticName, effectiveRank: 1, permanentRank: 1,
        iconRecord: build.skillsAtlasIconRecord, weldBuildId: build.id }, 800, 450)
    }
    const empty = drawNativeSkillHoverBox(app.stage, textures, {
      row: { id: 58 }, lines: [], sourceX: 800, sourceY: 450,
    })
    if (empty !== null || app.stage.children.length) throw new Error('Empty detail created a tooltip')
    return { cases, glyphs, failures, records, descriptionDirectives, retiredChildren: app.stage.children.length, image }
  } finally {
    app.destroy(true, { children: true })
    destroyNativeUiPixiFor(textures)
    textures.destroy()
  }
}
