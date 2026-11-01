import assert from 'node:assert/strict'
import test from 'node:test'

import { nativeUiRect, planNativeUiButton } from './native-ui-plan.ts'
import { planNativeUiPartyMenu } from './native-ui-party-menu.ts'
import { layoutNativeUiText, nativeUiGlyphInkBounds } from './native-ui-text.ts'

test('stock button labels keep their full ink clear of both skulls in every state and scale', () => {
  for (const scale of [0.55, 1, 1.6]) {
    for (const state of ['idle', 'focused', 'pressed', 'selected', 'disabled'] as const) {
      for (const label of ['LEAVE COLLEGE', 'LEAVE PARTY']) {
        const bounds = nativeUiRect(100, 200, 260 * scale, 69 * scale)
        const plan = planNativeUiButton({ bounds, id: 'leave', label, scale, state })
        const text = plan.nodes.find(node => node.label === 'leave:label')
        assert.ok(text?.kind === 'text')
        assert.equal(text.text.text, label)
        assert.deepEqual(plan.actions[0]?.bounds, bounds)
        for (const glyph of layoutNativeUiText(text.text).glyphs) {
          const ink = nativeUiGlyphInkBounds(glyph)
          // UI.54's label band ends at source x=50; the cap begins six units
          // outside the body. This includes the lower band reached while pressed.
          assert.ok(ink.left >= bounds.left + 44 * scale - 1e-9, `${label} ${state} left`)
          assert.ok(ink.left + ink.width <= bounds.left + bounds.width - 44 * scale + 1e-9, `${label} ${state} right`)
        }
      }
    }
  }
})

test('stock button fitting preserves short labels, full text and a stable size during a press', () => {
  for (const [label, width, scale] of [['CLOSE', 260, 1], ['KICK', 353, 0.55], ['RESUME GAME', 353, 1]] as const) {
    const bounds = nativeUiRect(0, 0, width * scale, 69 * scale)
    const plan = planNativeUiButton({ bounds, id: 'short', label, scale })
    const text = plan.nodes.find(node => node.label === 'short:label')
    assert.ok(text?.kind === 'text')
    assert.equal(text.text.scale ?? 1, scale)
  }
  const bounds = nativeUiRect(0, 0, 260, 69)
  const labels = (['idle', 'pressed'] as const).map(state => {
    const plan = planNativeUiButton({ bounds, id: 'leave', label: 'LEAVE COLLEGE', state })
    const text = plan.nodes.find(node => node.label === 'leave:label')
    assert.ok(text?.kind === 'text')
    return text.text
  })
  assert.ok((labels[0]!.scale ?? 1) < 1)
  assert.equal(labels[0]!.scale, labels[1]!.scale)
  assert.equal(labels[1]!.x - labels[0]!.x, 6)
  assert.equal(labels[1]!.y - labels[0]!.y, 6)
})

test('every Party tab uses the fitted footer while its row controls retain their authored scale', () => {
  for (const selectedTab of ['members', 'mods', 'settings'] as const) {
    for (const leaveLabel of ['LEAVE COLLEGE', 'LEAVE PARTY']) {
      const plan = planNativeUiPartyMenu({
        code: 'ABCDEFGH',
        height: 900,
        leader: true,
        leaveLabel,
        members: [{ id: 'p1', name: 'Ann', removable: true, tags: [] }],
        requests: [{ id: 'r1', name: 'Bob' }],
        selectedTab,
        visibility: 'public',
        visibilityOptions: [],
        width: 1600,
      })
      const leave = plan.nodes.find(node => node.label === 'leave:label')
      const close = plan.nodes.find(node => node.label === 'close:label')
      assert.ok(leave?.kind === 'text' && close?.kind === 'text')
      assert.equal(leave.text.text, leaveLabel)
      assert.ok((leave.text.scale ?? 1) < 1)
      assert.equal(close.text.scale ?? 1, 1)
      const rowLabels: string[] = []
      for (const node of plan.nodes) {
        const children = node.kind === 'clip' ? node.nodes : [node]
        for (const child of children) {
          if (child.kind === 'text' && ['KICK', 'ACCEPT', 'DENY', 'COPY', 'GENERATE'].includes(child.text.text)) {
            rowLabels.push(child.text.text)
            assert.equal(child.text.scale, 0.55, child.text.text)
          }
        }
      }
      assert.deepEqual(rowLabels.sort(), selectedTab === 'members'
        ? ['ACCEPT', 'DENY', 'KICK']
        : selectedTab === 'settings' ? ['COPY', 'GENERATE'] : [])
    }
  }
})
