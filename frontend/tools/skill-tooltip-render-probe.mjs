import {
  NATIVE_SKILL_CATALOG, NATIVE_WELD_BUILDS, nativeSkillCategory, nativeSkillIconRecord,
} from '../src/game/core-kernels/player-progression.ts'
import { createGameWebGlApplication, loadGameTextureMap } from '../src/game/renderer/game-webgl.ts'
import { drawNativeSkillHoverBox } from '../src/game/renderer/native-skill-hover-box.ts'
import { nativeSkillExactTextRuns } from '../src/game/renderer/skill-book-render-contract.ts'
import { nativeSkillHoverBoxLayout } from '../src/game/renderer/native-skill-hover-box-layout.ts'
import { nativeSkillBookTooltipLines } from '../src/game/skill-book-model.ts'
import { nativeUiAtlasSource } from '../src/game/native-ui/native-ui-assets.ts'
import { layoutNativeUiTextRuns, nativeUiFont, nativeUiGlyphInkBounds } from '../src/game/native-ui/core.ts'
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
  const inlineOverlaps = []
  let checkedInline = 0
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
    const { rendered } = nativeSkillHoverBoxLayout(nativeSkillBookTooltipLines(row), sourceX, sourceY)
    for (const source of rendered.flatMap(line => line.sources)) {
      if (!source.includes('_s(') || !source.includes('_i')) continue
      checkedInline += 1
      const runs = nativeSkillExactTextRuns(source)
      const visibleText = runs.map(run => run.text).join('')
      const line = box.children.find(child => child.label === visibleText)
      if (!line || runs.length !== 2) {
        inlineOverlaps.push({ id: row.id, rank: row.effectiveRank, source, reason: 'inline text lost its continuous native pen' })
        continue
      }
      const font = nativeUiFont('body')
      const prefixGlyphs = [...runs[0].text].filter(character => (
        character !== ' ' && font.glyphs[`${character.codePointAt(0)}`]
      )).length
      const valueGlyph = line.children[prefixGlyphs - 1]
      const unitGlyph = line.children[prefixGlyphs]
      if (!valueGlyph || !unitGlyph) throw new Error(`Missing inline glyph in ${source}`)
      const nativeGlyphs = layoutNativeUiTextRuns({ font: 'body', runs, x: 0, y: 0 }).glyphs
      const valueInk = nativeUiGlyphInkBounds(nativeGlyphs[prefixGlyphs - 1])
      const unitInk = nativeUiGlyphInkBounds(nativeGlyphs[prefixGlyphs])
      const inkGap = unitInk.left - valueInk.left - valueInk.width
      if (inkGap <= 0 || line.skew.x !== 0 || unitGlyph.skew.x === 0
        || unitGlyph.position.x <= valueGlyph.position.x) {
        inlineOverlaps.push({ id: row.id, rank: row.effectiveRank, source, inkGap })
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
    return { cases, glyphs, failures, records, descriptionDirectives,
      checkedInline, inlineOverlaps, retiredChildren: app.stage.children.length, image }
  } finally {
    app.destroy(true, { children: true })
    destroyNativeUiPixiFor(textures)
    textures.destroy()
  }
}
