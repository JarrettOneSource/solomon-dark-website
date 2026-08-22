import fontAssetsJson from '../assets/game/skill-picker-native-assets.json' with { type: 'json' }

import { skillPicker } from '../lib/assets.ts'

interface GlyphRecord {
  readonly frame: readonly [number, number, number, number]
  readonly metrics?: readonly [number, number, number]
}

interface BitmapFont {
  readonly glyphs: Readonly<Record<string, GlyphRecord>>
  readonly kerning: readonly (readonly [number, number, number])[]
  readonly metrics: readonly [number, number, number]
  readonly spaceAdvance: number
}

const FONT = (fontAssetsJson as unknown as {
  fonts: Readonly<Record<'menu', BitmapFont>>
}).fonts.menu

export default function NativeGameOverPrompt() {
  const glyphs: Array<Readonly<{
    code: number
    frame: readonly [number, number, number, number]
    left: number
    top: number
  }>> = []
  let cursor = 0
  let previous = -1
  for (const character of 'CLICK TO CONTINUE...') {
    const code = character.codePointAt(0)!
    if (character === ' ') {
      cursor += FONT.spaceAdvance
      previous = code
      continue
    }
    const glyph = FONT.glyphs[`${code}`]
    if (!glyph?.metrics) continue
    cursor += kerning(previous, code)
    const [, , width, height] = glyph.frame
    glyphs.push({
      code,
      frame: glyph.frame,
      left: cursor + glyph.metrics[1] - width / 2,
      top: FONT.metrics[0] / 2 + glyph.metrics[2] - height / 2,
    })
    cursor += glyph.metrics[0]
    previous = code
  }

  return (
    <span
      className="game-over-prompt-text"
      style={{ height: FONT.metrics[0], width: cursor }}
      aria-hidden
    >
      {glyphs.map(({ code, frame: [x, y, width, height], left, top }, index) => (
        <i
          key={`${index}:${code}`}
          style={{
            height,
            left,
            maskImage: `url("${skillPicker.fontsAtlas}")`,
            maskPosition: `${-x}px ${-y}px`,
            maskRepeat: 'no-repeat',
            maskSize: '512px 256px',
            top,
            WebkitMaskImage: `url("${skillPicker.fontsAtlas}")`,
            WebkitMaskPosition: `${-x}px ${-y}px`,
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskSize: '512px 256px',
            width,
          }}
        />
      ))}
    </span>
  )
}

function kerning(first: number, second: number): number {
  if (first < 0) return 0
  return FONT.kerning.find(([left, right]) => left === first && right === second)?.[2] ?? 0
}
