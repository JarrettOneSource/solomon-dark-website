import assert from 'node:assert/strict'
import test from 'node:test'
import { nativeBossHudPlan } from './native-boss-hud.ts'

for (const name of ['Ironmaw', 'Foulshaft', 'Heartmonger', 'Dire Sirmin', 'Dire Aliss',
  'Dire Lucritius', 'The Discorporeal', 'SLUMPGUT', 'Deep Portal']) {
  test(`the ${name} HUD uses the stock strips, left clipping and seven native text passes`, () => {
    const full = nativeBossHudPlan(name, 100, 100, 1600, 900)
    const quarter = nativeBossHudPlan(name, 25, 100, 1600, 900)
    const fullClip = full.nodes.find(node => node.kind === 'clip')!
    const quarterClip = quarter.nodes.find(node => node.kind === 'clip')!
    assert.equal(fullClip.kind, 'clip')
    assert.equal(quarterClip.kind, 'clip')
    if (fullClip.kind !== 'clip' || quarterClip.kind !== 'clip') throw new Error('health clip required')
    assert.equal(fullClip.bounds.left + fullClip.bounds.width / 2, 800)
    assert.equal(fullClip.bounds.top, 791)
    assert.equal(fullClip.bounds.height, 11)
    assert.equal(quarterClip.bounds.left, fullClip.bounds.left)
    assert.equal(quarterClip.bounds.width, fullClip.bounds.width / 4)
    assert.deepEqual(quarterClip.nodes, fullClip.nodes, 'HP crops the native full-width strip without rescaling it')
    assert.ok(fullClip.nodes.every(node => node.kind === 'slice' && node.atlas === 'UI' && node.record === 6))
    const background = full.nodes.filter(node => node.kind === 'slice')
    assert.ok(background.every(node => node.atlas === 'UI' && node.record === 7 && node.bounds.top === 787))
    assert.equal(background[0]!.bounds.left, fullClip.bounds.left - 4.5)
    const finalPiece = background.at(-1)!
    assert.equal(finalPiece.bounds.left + finalPiece.bounds.width - background[0]!.bounds.left, fullClip.bounds.width + 11)
    const text = full.nodes.filter(node => node.kind === 'text')
    assert.deepEqual(text.map(node => [node.text.x - 800, node.text.y - 782]),
      [[0, 1], [2, 1], [-2, 1], [0, 2], [2, 2], [-2, 2], [0, 0]])
    assert.ok(text.every(node => node.text.text === name && node.text.font === 'world-and-roster' && node.text.placement === 'baseline'))
    assert.deepEqual(text.map(node => node.text.tint), [0, 0, 0, 0, 0, 0, 0xbfbfbf])
  })
}

test('name advances size the boss bar and viewport changes preserve its native bottom offset', () => {
  const short = nativeBossHudPlan('Ironmaw', 100, 100, 1600, 900)
  const long = nativeBossHudPlan('The Discorporeal', 100, 100, 1600, 900)
  const moved = nativeBossHudPlan('The Discorporeal', 0, 100, 800, 600)
  const shortClip = short.nodes.find(node => node.kind === 'clip')!
  const longClip = long.nodes.find(node => node.kind === 'clip')!
  const movedClip = moved.nodes.find(node => node.kind === 'clip')!
  if (shortClip.kind !== 'clip' || longClip.kind !== 'clip' || movedClip.kind !== 'clip') throw new Error('health clip required')
  assert.ok(longClip.bounds.width > shortClip.bounds.width)
  assert.equal(movedClip.bounds.top, 491)
  assert.equal(movedClip.bounds.left, longClip.bounds.left - 400)
  assert.equal(movedClip.bounds.width, 0)
})
