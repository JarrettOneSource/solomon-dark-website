import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import { nativeUiRecord } from './native-ui-catalog.ts'
import { nativeUiTintMatrix } from './native-ui-tint.ts'

interface Rect { left: number; top: number; width: number; height: number }

const renderer = build({
  stdin: {
    contents: `import { createElement } from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import Frame from './NativeUiNineSlice.tsx';
      export const render = props => renderToStaticMarkup(createElement(Frame, props));`,
    loader: 'tsx', resolveDir: import.meta.dirname,
  },
  bundle: true, format: 'esm', platform: 'node', jsx: 'automatic', write: false,
  loader: { '.png': 'empty' },
  banner: { js: `import { createRequire } from 'node:module'; const require = createRequire(${JSON.stringify(import.meta.url)});` },
}).then(async built => import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0]!.text).toString('base64')}`))

for (const [record, consumer] of [
  [4, 'tutorial callout'], [11, 'Boast outer panel'], [17, 'MessageBox, SimpleMenu and Dark Cloud'],
  [50, 'Boast rows'], [64, 'instruction and failure Notebox'],
] as const) {
  test(`${consumer} frame partitions its bounds without gaps or double-painted seams`, async () => {
    const { render } = await renderer
    const [, , cw, ch] = nativeUiRecord('UI', record).frame
    for (const [width, height] of [[cw * 2, ch * 2], [cw * 2 + 101, ch * 2 + 47], [cw * 2 + 100.5, ch * 2 + 31.25]]) {
      for (const fill of [false, true]) for (const multiplyTint of [undefined, 0xff4040, 0x9feb9f, 0]) {
        for (const edgeUvOrigin of [0.95, 0.8]) {
          const html: string = render({ atlas: 'UI', record, width, height, fill, multiplyTint, edgeUvOrigin })
          const pieces = [...html.matchAll(/<i style="([^"]*)"/g)].map(match => {
            const styles = Object.fromEntries(match[1]!.split(';').map(part => part.split(':')))
            return Object.fromEntries(['left', 'top', 'width', 'height'].map(key => [key, parseFloat(styles[key]!)])) as unknown as Rect
          })
          assertPartition(pieces, width!, height!, cw, ch, fill)
        }
      }
    }
  })
}

test('frame tint multiplies stock RGB once while retaining authored alpha', async () => {
  const { render } = await renderer
  for (const multiplyTint of [0xff4040, 0x9feb9f, 0]) {
    const html: string = render({ atlas: 'UI', record: 64, width: 500, height: 110, multiplyTint })
    assert.ok(html.includes(`values="${nativeUiTintMatrix(multiplyTint).join(' ')}"`))
    assert.equal((html.match(/<feColorMatrix /g) ?? []).length, 1)
    assert.doesNotMatch(html, /linear-gradient|mask-image|background-blend-mode/)
  }
})

function assertPartition(pieces: readonly Rect[], width: number, height: number, cw: number, ch: number, fill: boolean): void {
  const xs = [...new Set([0, cw, width - cw, width, ...pieces.flatMap(p => [p.left, p.left + p.width])])].sort((a, b) => a - b)
  const ys = [...new Set([0, ch, height - ch, height, ...pieces.flatMap(p => [p.top, p.top + p.height])])].sort((a, b) => a - b)
  for (let xi = 1; xi < xs.length; xi += 1) for (let yi = 1; yi < ys.length; yi += 1) {
    const x = (xs[xi - 1]! + xs[xi]!) / 2
    const y = (ys[yi - 1]! + ys[yi]!) / 2
    if (x < 0 || x >= width || y < 0 || y >= height) continue
    const center = x >= cw && x < width - cw && y >= ch && y < height - ch
    const expected = fill || !center ? 1 : 0
    const coverage = pieces.filter(p => x >= p.left && x < p.left + p.width && y >= p.top && y < p.top + p.height).length
    assert.equal(coverage, expected, `UI frame ${width}x${height}, fill=${fill}, (${x},${y}) must have ${expected} painter`)
  }
}
