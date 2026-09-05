import assert from 'node:assert/strict'
import test from 'node:test'

import { nativeUiRect, type NativeUiNode } from './native-ui-plan.ts'
import { NATIVE_DARK_CLOUD_TABS, planNativeDarkCloudToolButton } from './native-dark-cloud-contract.ts'
import { planNativeDarkCloudListFrame, planNativeDarkCloudPanel, planNativeDarkCloudSceneArt } from './native-dark-cloud-frame.ts'
import { planNativeUiControlPanel } from './native-ui-control-panel.ts'
import { layoutNativeUiText } from './native-ui-text.ts'
import { planNativeUiTabs } from './native-ui-tabs.ts'

test('the Dark Cloud tab bands expose every route and visible label in order', () => {
  assert.deepEqual(NATIVE_DARK_CLOUD_TABS.map(tab => [tab.id, tab.label, tab.bounds]), [
    ['mods', 'MODS', nativeUiRect(0, 0, 170, 69)],
    ['subscribed', 'SUBSCRIBED MODS', nativeUiRect(170, 0, 340, 69)],
    ['parties', 'PARTIES', nativeUiRect(510, 0, 170, 69)],
    ['layouts', 'LAYOUTS', nativeUiRect(680, 0, 202, 69)],
  ])
})

test('Dark Cloud paints repeated wall and filigree bands omitted by the Sprite-only census', () => {
  const plan = planNativeDarkCloudSceneArt(1600, 900)
  assert.deepEqual(plan.nodes.filter(node => node.kind === 'tile').map(node => [node.record, node.bounds]), [
    [30, nativeUiRect(0, 65, 1600, 108)],
    [30, nativeUiRect(0, 800, 1600, 108)],
    [33, nativeUiRect(-74, 0, 124, 900)],
    [33, nativeUiRect(1540, 0, 124, 900)],
  ])
  assert.deepEqual(plan.nodes.filter(node => node.kind === 'sprite').map(node => [node.record, node.x, node.y, Boolean(node.mirrorX), Boolean(node.mirrorY)]), [
    [29, 135, 83, true, true],
    [29, 1465, 83, false, true],
    [31, 1488, 18, false, false],
    [32, 104, 26.5, true, false],
    [32, 1644, 773.5, true, false],
    [31, -57, 765, false, false],
  ])
  const sides = plan.nodes.filter(node => node.kind === 'clip')
  assert.deepEqual(sides.map(node => node.bounds), [nativeUiRect(0, 0, 55, 900), nativeUiRect(1545, 0, 55, 900)])
  assert.deepEqual(sides.flatMap(node => node.nodes).map(node => {
    assert.equal(node.kind, 'sprite')
    return [node.record, node.x, node.y]
  }), [[20, -42.5, 162.5], [20, -82.5, 446], [20, 1447.5, 162.5], [20, 1487.5, 446]])

  const resized = planNativeDarkCloudSceneArt(1366, 768)
  const bottom = resized.nodes.find(node => node.label === 'cloud:wall-bottom')
  assert.ok(bottom?.kind === 'tile')
  assert.deepEqual(bottom.bounds, nativeUiRect(0, 668, 1366, 108))
  assert.deepEqual(resized.actions, [])
})

test('the list frame joins every chain and stone corner to a complete gold frame', () => {
  const plan = planNativeDarkCloudListFrame(1490, 627)
  assert.deepEqual(plan.nodes.filter(node => node.kind === 'tile').map(node => [node.record, node.bounds]), [
    [10, nativeUiRect(-5, -14, 1500, 19)],
    [10, nativeUiRect(-5, 624, 1500, 19)],
    [79, nativeUiRect(-15, -2, 21, 631)],
    [79, nativeUiRect(1488, -2, 21, 631)],
  ])
  assert.deepEqual(plan.nodes.filter(node => node.kind === 'sprite').map(node => [node.record, node.x, node.y]), [
    [107, 22, 25], [108, 1468, 25], [109, 22, 602], [110, 1468, 602],
  ])
  const interior = plan.nodes.find(node => node.kind === 'clip')
  assert.ok(interior?.kind === 'clip')
  assert.deepEqual(interior.bounds, nativeUiRect(20, 20, 1450, 587))
  assert.deepEqual(interior.nodes, [
    { atlas: 'UI', bounds: nativeUiRect(0, 0, 1490, 627), kind: 'tile', label: 'cloud:leather', record: 49 },
    { alpha: 0.5, bounds: nativeUiRect(0, 0, 1490, 85), color: 0, kind: 'solid', label: 'cloud:column-shade' },
  ])
  const frame = plan.nodes.at(-1)
  assert.ok(frame?.kind === 'nine-slice')
  assert.equal(frame.record, 17)
  assert.equal(frame.edgeUvOrigin, 0.95)
  assert.deepEqual(frame.bounds, nativeUiRect(0, 0, 1490, 627))
})

test('Search, Sort, and detail panels paint a black offset shadow behind one gold frame', () => {
  for (const [width, height] of [[520, 205], [320, 255], [1100, 820]] as const) {
    const plan = planNativeDarkCloudPanel(width, height)
    const shadow = plan.nodes[0]!
    assert.equal(shadow.kind, 'solid')
    assert.deepEqual(shadow.bounds, nativeUiRect(0, 0, width + 40, height + 40))
    assert.equal(shadow.color, 0)
    const frames = plan.nodes.filter(node => node.kind === 'nine-slice')
    assert.equal(frames.length, 2)
    assert.equal(frames[0]!.tint, 0)
    assert.equal(frames[1]!.tint, undefined)
    assert.deepEqual(frames[0]!.bounds, nativeUiRect(0, 0, width + 40, height + 40))
    assert.deepEqual(frames[1]!.bounds, nativeUiRect(-20, -20, width + 40, height + 40))
    const flourishes = plan.nodes.filter(node => node.kind === 'sprite')
    assert.deepEqual(flourishes.map(node => [node.record, node.anchor, node.x, node.y]), [
      [18, [0.5, 0.5], -65, height / 2],
      [18, [0.5, 0.5], width + 65, height / 2],
    ])
    assert.equal(flourishes[1]!.mirrorX, true)
  }
})

test('Search, Sort, and Options preserve clipped native faces, complete surrounds, and every interaction state', () => {
  for (const state of [undefined, 'idle', 'focused', 'pressed', 'selected', 'disabled'] as const) {
    for (const content of [{ iconRecord: 58 }, { iconRecord: 66 }, { label: 'options' }]) {
      const bounds = nativeUiRect(390, 818, 'label' in content ? 185 : 90, 52)
      const plan = planNativeDarkCloudToolButton({ ...content, bounds, id: 'tool', state })
      const face = plan.nodes[0]
      assert.ok(face?.kind === 'clip')
      assert.deepEqual(face.bounds, bounds)
      const body = face.nodes[0]
      assert.ok(body?.kind === 'sprite')
      const pressed = state === 'pressed' || state === 'selected'
      assert.equal(body.record, pressed ? 104 : 103)
      assert.equal(body.width, undefined, 'the full native face is cropped instead of squeezed')
      assert.equal(body.height, undefined)
      const foreground = face.nodes[1]!
      const offset = pressed ? 4 : 0
      if (foreground.kind === 'sprite') {
        assert.equal(foreground.x, 435 + offset)
        assert.equal(foreground.y, 844 + offset)
        assert.equal(foreground.alpha, state === 'disabled' ? 0.5 : 1)
      } else {
        assert.equal(foreground.kind, 'text')
        assert.equal(foreground.text.x, 482.5 + offset)
        assert.equal(foreground.text.y, 852 + offset)
        assert.deepEqual(layoutNativeUiText(foreground.text).unsupportedCodePoints, [])
        assert.equal(foreground.text.alpha, state === 'disabled' ? 0.5 : 1)
      }
      const overlay = face.nodes.find(node => node.kind === 'solid')
      assert.equal(Boolean(overlay), state === 'disabled')
      if (overlay) assert.deepEqual([overlay.alpha, overlay.color, overlay.bounds], [0.25, 0x808080, bounds])
      assert.deepEqual(plan.nodes.slice(1).map(node => {
        assert.ok(node.kind === 'slice' || node.kind === 'sprite')
        assert.equal(node.alpha, undefined, 'the surround stays bright when disabled')
        return node.record
      }), [53, 53, 53])
      assert.deepEqual(plan.actions, [{ bounds, disabled: state === 'disabled', id: 'tool', role: 'button' }])
    }
  }
})

test('CPanel groups and editable recesses keep their authored bevels when the content resizes', () => {
  const group = planNativeUiControlPanel(460, 176, 3)
  const field = planNativeUiControlPanel(300, 100, 5)
  assert.equal(group.nodes.length, 9)
  assert.equal(field.nodes.length, 9)
  const groupCorner = slice(group.nodes[8]!)
  assert.deepEqual(groupCorner.bounds, nativeUiRect(454, 170, 6, 6))
  assert.deepEqual(groupCorner.sourceUv, [309 / 315, 38 / 44, 1, 1])
  const fieldCorner = slice(field.nodes[0]!)
  assert.deepEqual(fieldCorner.bounds, nativeUiRect(0, 0, 3, 3))
  assert.deepEqual(fieldCorner.sourceUv, [0, 0, 3 / 159, 3 / 30])
  assert.deepEqual(slice(field.nodes[4]!).bounds, nativeUiRect(3, 3, 294, 94))
  assert.deepEqual(slice(group.nodes[4]!).bounds, nativeUiRect(6, 6, 448, 164))
})

function slice(node: NativeUiNode) {
  assert.equal(node.kind, 'slice')
  return node
}

test('responsive tab art scales uniformly inside full-size touch targets', () => {
  const plan = planNativeUiTabs({
    height: 44,
    scale: 0.5,
    selectedId: 'mods',
    tabs: [
      { bounds: nativeUiRect(0, 0, 100, 44), id: 'mods', label: 'MODS' },
      { bounds: nativeUiRect(100, 0, 100, 44), disabled: true, id: 'parties', label: 'PARTIES' },
    ],
    tint: 0xd9ba70,
    width: 200,
  })
  assert.deepEqual(plan.actions, [
    { bounds: nativeUiRect(0, 0, 100, 44), disabled: false, id: 'mods', role: 'tab' },
    { bounds: nativeUiRect(100, 0, 100, 44), disabled: true, id: 'parties', role: 'tab' },
  ])
  assert.deepEqual(slice(plan.nodes.find(node => node.label === 'mods:bracket-left')!).bounds, nativeUiRect(0, 9.5, 17, 32.5))
  assert.deepEqual(slice(plan.nodes.find(node => node.label === 'parties:bracket-left')!).bounds, nativeUiRect(100, 13.5, 17, 25.5))
  const right = slice(plan.nodes.find(node => node.label === 'parties:bracket-right')!)
  assert.deepEqual(right.bounds, nativeUiRect(183, 13.5, 17, 25.5))
  assert.equal(right.mirrorX, true)
  for (const node of plan.nodes.filter(node => node.kind === 'text')) {
    assert.equal(node.text.scale, 0.5)
    assert.equal(node.text.tint, 0xd9ba70)
    assert.equal(node.text.alpha, node.label === 'parties:label' ? 0.5 : 1)
    assert.deepEqual([node.text.x, node.text.y], node.label === 'parties:label' ? [150, 36] : [50, 32])
  }
  assert.throws(() => planNativeUiTabs({ height: 44, selectedId: 'missing', tabs: [], width: 200 }), /absent/)
  assert.throws(() => planNativeUiTabs({ height: 44, selectedId: 'missing', tabs: NATIVE_DARK_CLOUD_TABS, width: 882 }), /absent/)
})

test('a compact tool keeps its icon square and its pressed displacement proportional', () => {
  const plan = planNativeDarkCloudToolButton({ bounds: nativeUiRect(0, 0, 52, 26), iconRecord: 58, id: 'search', scale: 0.5, state: 'pressed' })
  const face = plan.nodes[0]!
  assert.equal(face.kind, 'clip')
  const icon = face.nodes[1]!
  assert.equal(icon.kind, 'sprite')
  assert.deepEqual([icon.scale, icon.x, icon.y], [0.5, 28, 15])
  assert.deepEqual(slice(plan.nodes[2]!).bounds, nativeUiRect(10.5, -3, 31, 31))
  const labeled = planNativeDarkCloudToolButton({ bounds: nativeUiRect(0, 0, 100, 26), id: 'options', label: 'OPTIONS', scale: 0.5, state: 'pressed' })
  const clipped = labeled.nodes[0]!
  assert.equal(clipped.kind, 'clip')
  const label = clipped.nodes[1]!
  assert.equal(label.kind, 'text')
  assert.deepEqual([label.text.x, label.text.y], [52, 19])
  assert.deepEqual(labeled.nodes.filter(node => node.kind === 'sprite').map(node => [node.x, node.y, node.scale, Boolean(node.mirrorX)]), [
    [-3, -3, 0.5, false], [103, -3, 0.5, true],
  ])
})
