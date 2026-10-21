import assert from 'node:assert/strict'
import { test } from 'node:test'

import fixture from './fixture.json' with { type: 'json' }
import { NATIVE_UI_FONT_NAMES } from './native-ui-catalog.ts'
import { planNativeUiButton, type NativeUiButtonState } from './native-ui-plan.ts'
import { layoutNativeUiText } from './native-ui-text.ts'

test('the authoring shelf retains current Source button chrome in every input state', () => {
  const states: readonly NativeUiButtonState[] = ['idle', 'focused', 'pressed', 'selected', 'disabled']
  for (const row of fixture.buttons) {
    const state = states.find(candidate => candidate === ('state' in row.input ? row.input.state : 'idle'))
    assert.ok(state)
    assert.deepEqual(planNativeUiButton({ ...row.input, state }), row.output)
  }
})

test('the shelf retains Source bitmap layout and unsupported-name detection', () => {
  for (const row of fixture.texts) {
    const font = NATIVE_UI_FONT_NAMES.find(candidate => candidate === row.input.font)
    assert.ok(font)
    assert.deepEqual(layoutNativeUiText({ ...row.input, align: 'left', placement: 'box', font }), row.output)
  }
})
