import { nativeUiFont } from '../native-ui/native-ui-catalog.ts'
import { measureNativeUiText } from '../native-ui/native-ui-text.ts'

export const NATIVE_SKILL_SCREEN_SIZE = Object.freeze({ height: 900, width: 1_600 })

export const NATIVE_SKILL_SCREEN_ROOT = Object.freeze({
  ambientAlpha: 0.15,
  ambientCenterY: 490,
  ambientCount: 8,
  ambientHorizontalAmplitude: 40,
  ambientPhaseDivisor: 60,
  ambientRecord: 3,
  ambientRotationStepDegrees: 45,
  ambientScale: 1.9,
  bottomChainY: 807,
  bottomMasonry: Object.freeze([
    Object.freeze({ mirrorX: false, record: 30, x: 0, y: 860 }),
    Object.freeze({ mirrorX: false, record: 30, x: 1_600, y: 860 }),
  ]),
  bottomWarriorClip: Object.freeze({ height: 80, width: 1_600, x: 0, y: 820 }),
  bottomWarriors: Object.freeze([
    Object.freeze({ mirrorX: false, record: 32, x: 60, y: 880 }),
    Object.freeze({ mirrorX: true, record: 32, x: 1_540, y: 880 }),
  ]),
  helpAlpha: 0.75,
  helpBottomY: 701,
  helpLineGap: 18,
  helpTopY: 165,
  helpTint: 0x808080,
  leatherHeight: 760,
  leatherRecord: 49,
  leatherTop: 50,
  titleBacking: Object.freeze({ height: 34, width: 114, x: 743, y: 34 }),
  titleTint: 0x808080,
  titleY: 60,
  topChainY: 44,
  topFlourishes: Object.freeze([
    Object.freeze({ record: 33, rotationDegrees: -90, x: 80, y: 30 }),
    Object.freeze({ record: 33, rotationDegrees: 90, x: 1_520, y: 30 }),
  ]),
  topWizards: Object.freeze([
    Object.freeze({ mirrorX: true, record: 31, x: 200, y: 20 }),
    Object.freeze({ mirrorX: false, record: 31, x: 1_400, y: 20 }),
  ]),
})

export const NATIVE_SKILL_PAGE_ROOT_COLORS = Object.freeze([
  Object.freeze([1, 0.1, 1]),
  Object.freeze([1, 0.35, 0.1]),
  Object.freeze([0.1, 1, 1]),
  Object.freeze([0.1, 0.5, 1]),
  Object.freeze([0.1, 1, 0.1]),
  Object.freeze([1, 0.5, 0.1]),
  Object.freeze([0.1, 0.5, 0.5]),
  Object.freeze([0.75, 0.75, 0.75]),
] as const)

export const NATIVE_SKILL_PAGE_PANEL = Object.freeze({
  additiveAlpha: 0.5,
  height: 300,
  inset: 12,
  record: 0,
  selectedAlpha: 0.5,
  slice: 30,
  unselectedAlpha: 0.1,
})

export const NATIVE_SKILL_ROW_PRESENTATION = Object.freeze({
  actionableFrameRecord: 14,
  auraRecord: 13,
  auraScale: 1.15,
  dependentFirstCenterX: 280,
  dependentPitchX: 160,
  descriptionCenterY: 230,
  footerBaselineY: 280,
  iconShadowOffset: 4,
  nameBaselineY: 150,
  ordinaryFrameRecord: 5,
  rootCenterX: 100,
  rowCenterY: 80,
  rootGlowRecord: 164,
  selectedFrameAlpha: 1,
  selectedFrameTint: 0x97c797,
  textShadowOffset: 1,
  textWrapWidth: 140,
})

export const NATIVE_SKILL_HOVER_BOX = Object.freeze({
  contentMargin: 25,
  contentMaxWidth: 380,
  lineGap: 10,
  sourceGap: 50,
  viewportMargin: 25,
})

export interface NativeSkillExactTextRun {
  readonly italic: boolean
  readonly offsetX: number
  readonly offsetY: number
  readonly scale: number
  readonly text: string
}

export function nativeSkillPageDisplayName(source: string, effectiveRank: number): string {
  const name = source.toUpperCase()
  return effectiveRank > 1 ? `${name} ${effectiveRank}` : name
}

export function nativeSkillPageWrappedLines(source: string): readonly string[] {
  const characters = [...source]
  const font = nativeUiFont('medium')
  let currentWidth = 0
  let previousBreak = 0
  let restartingLine = false
  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index]!
    if (character === '\n' || character === '\r') currentWidth = 0
    let advance = 0
    if (character === ' ') {
      if (!restartingLine) advance = font.spaceAdvance
    } else {
      const glyph = font.glyphs[`${character.codePointAt(0)!}`]
      if (glyph) {
        restartingLine = false
        advance = glyph.metrics[0]
      }
    }
    if (currentWidth + advance > NATIVE_SKILL_ROW_PRESENTATION.textWrapWidth) {
      let breakAt = index
      for (let candidate = index - 1; candidate !== previousBreak; candidate -= 1) {
        if (characters[candidate] === ' ' || characters[candidate] === '-') {
          breakAt = candidate
          break
        }
      }
      if (characters[breakAt] !== ' ' && characters[breakAt] !== '-') {
        const insertAt = Math.max(previousBreak, breakAt > 1 ? breakAt - 1 : breakAt)
        characters.splice(insertAt, 0, '-', '\n')
        currentWidth = 0
        previousBreak = insertAt + 1
        restartingLine = true
        index = insertAt + 1
        continue
      }
      characters[breakAt] = '\n'
      currentWidth = advance
      previousBreak = breakAt
      restartingLine = true
      index = breakAt
    } else currentWidth += advance
  }
  return Object.freeze(characters.join('').split('\n'))
}

export function nativeSkillPageTextHeight(lines: readonly string[]): number {
  if (lines.length === 0) return 0
  const lineHeight = nativeUiFont('medium').metrics[0]
  return lineHeight + (lines.length - 1) * (lineHeight + 1)
}

export function nativeSkillExactTextRuns(source: string): readonly NativeSkillExactTextRun[] {
  const runs: NativeSkillExactTextRun[] = []
  let italic = false
  let offsetX = 0
  let offsetY = 0
  let scale = 1
  let text = ''
  const flush = (): void => {
    if (!text) return
    runs.push(Object.freeze({ italic, offsetX, offsetY, scale, text }))
    text = ''
  }
  for (let index = 0; index < source.length;) {
    const scaleMatch = source.slice(index).match(/^_s\((-?(?:\d+\.?\d*|\.\d+))\)/)
    if (scaleMatch) {
      flush()
      scale = Number(scaleMatch[1])
      index += scaleMatch[0].length
      continue
    }
    const offsetMatch = source.slice(index).match(
      /^_o\((-?(?:\d+\.?\d*|\.\d+)),(-?(?:\d+\.?\d*|\.\d+))\)/,
    )
    if (offsetMatch) {
      flush()
      offsetX = Number(offsetMatch[1])
      offsetY = Number(offsetMatch[2])
      index += offsetMatch[0].length
      continue
    }
    if (source.startsWith('_i', index)) {
      flush()
      italic = !italic
      index += 2
      continue
    }
    text += source[index]
    index += 1
  }
  flush()
  return Object.freeze(runs)
}

export function measureNativeSkillExactText(source: string): number {
  let lineWidth = 0
  let maximumWidth = 0
  for (const run of nativeSkillExactTextRuns(source)) {
    const parts = run.text.split('\n')
    parts.forEach((part, index) => {
      lineWidth += measureNativeUiText(part, 'body', run.scale)
      maximumWidth = Math.max(maximumWidth, lineWidth)
      if (index < parts.length - 1) lineWidth = 0
    })
  }
  return maximumWidth
}

export interface NativeSkillScreenSealTransform {
  readonly rotationDegrees: number
  readonly x: number
  readonly y: number
}

export function nativeSkillScreenTick(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    throw new RangeError('native SkillScreen elapsed time must be finite and nonnegative')
  }
  return Math.floor(elapsedMs / 10)
}

/**
 * `SkillScreen::Render 0x0065B550`, loop `0x0065B6DB..0x0065B7B0`.
 * `_CIsin 0x007470D0` supplies a deterministic member offset; no RNG or
 * time value participates in placement. Screen-local `+0x28` supplies the
 * 100 Hz rotation phase and resets to zero with every screen construction.
 */
export function nativeSkillScreenSealTransform(
  index: number,
  screenTick: number,
): NativeSkillScreenSealTransform {
  if (!Number.isInteger(index) || index < 0 || index >= NATIVE_SKILL_SCREEN_ROOT.ambientCount) {
    throw new RangeError('native SkillScreen seal index is outside the eight-member loop')
  }
  if (!Number.isInteger(screenTick) || screenTick < 0) {
    throw new RangeError('native SkillScreen tick must be a nonnegative integer')
  }
  const angleDegrees = index * NATIVE_SKILL_SCREEN_ROOT.ambientRotationStepDegrees
  const offsetRadians = angleDegrees * 2 * Math.PI / 180
  return Object.freeze({
    rotationDegrees: angleDegrees - screenTick / NATIVE_SKILL_SCREEN_ROOT.ambientPhaseDivisor,
    x: NATIVE_SKILL_SCREEN_SIZE.width / 2
      + Math.sin(offsetRadians) * NATIVE_SKILL_SCREEN_ROOT.ambientHorizontalAmplitude,
    y: NATIVE_SKILL_SCREEN_ROOT.ambientCenterY,
  })
}

export function nativeSkillPageTint(root: number | null): number {
  const source = root === null ? undefined : NATIVE_SKILL_PAGE_ROOT_COLORS[root]
  if (!source) throw new RangeError(`unknown native SkillPage root ${String(root)}`)
  const luminance = source[0] * 0.3086 + source[1] * 0.6094 + source[2] * 0.082
  const channel = (value: number) => Math.round((luminance * 0.85 + value * 0.15) * 255)
  return (channel(source[0]) << 16) | (channel(source[1]) << 8) | channel(source[2])
}

export function nativeSkillRootTint(root: number | null): number {
  const source = root === null ? undefined : NATIVE_SKILL_PAGE_ROOT_COLORS[root]
  if (!source) throw new RangeError(`unknown native skill root ${String(root)}`)
  return (Math.round(source[0] * 255) << 16)
    | (Math.round(source[1] * 255) << 8)
    | Math.round(source[2] * 255)
}
