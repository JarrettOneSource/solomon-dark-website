import assert from 'node:assert/strict'
import test from 'node:test'

import './mobile-ui-editor-contract.test.ts'

import {
  DEFAULT_MOBILE_UI_LAYOUT,
  MOBILE_UI_CANONICAL_HEIGHT,
  MOBILE_UI_CANONICAL_WIDTH,
  MOBILE_UI_ELEMENT_IDS,
  MOBILE_UI_LAYOUT_STORAGE_KEY,
  MOBILE_UI_LAYOUT_VERSION,
  MOBILE_UI_PAGE_ZOOM_MAX,
  MOBILE_UI_PAGE_ZOOM_MIN,
  MOBILE_UI_SCALE_MAX,
  MOBILE_UI_SCALE_MIN,
  constrainMobileUiTransform,
  defaultMobileUiGeometry,
  mobileUiEditorPageSize,
  mobileUiElementPinchScale,
  mobileUiElementRotation,
  mobileUiElementStyle,
  mobileUiLayoutWith,
  mobileUiLayoutDocument,
  mobileUiLayoutFromDocument,
  mobileUiPagePinchZoom,
  readMobileUiLayoutState,
  resetMobileUiLayout,
  resetMobileUiLayoutListenersForTests,
  setMobileUiLayout,
  snapMobileUiPoint,
  subscribeMobileUiLayout,
  type MobileUiLayoutStorage,
} from './mobile-ui-layout.ts'

class MemoryStorage implements MobileUiLayoutStorage {
  readonly values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

test('the mobile layout catalog drains every requested HUD member exactly once', () => {
  assert.deepEqual(MOBILE_UI_ELEMENT_IDS, [
    'pause',
    'diagnostics',
    'meters',
    'leftJoystick',
    'rightJoystick',
    'slot1',
    'slot2',
    'slot3',
    'slot4',
    'slot5',
    'slot6',
    'slot7',
    'slot8',
    'inventory',
    'skillbook',
    'xp',
    'healthPotion',
    'manaPotion',
  ])
  assert.deepEqual(Object.keys(DEFAULT_MOBILE_UI_LAYOUT), MOBILE_UI_ELEMENT_IDS)
  assert.ok(Object.values(DEFAULT_MOBILE_UI_LAYOUT).every((transform) => (
    transform.scale === 1 && transform.rotation === 0
  )))
})

test('the editor seed projects the accepted 896 x 414 touch HUD from its owning constants', () => {
  assert.equal(MOBILE_UI_CANONICAL_WIDTH, 896)
  assert.equal(MOBILE_UI_CANONICAL_HEIGHT, 414)
  const geometry = defaultMobileUiGeometry(896, 414, 1)
  const near = (actual: number, expected: number) => assert.ok(
    Math.abs(actual - expected) < 0.02,
    `${actual} is not within 0.02 of ${expected}`,
  )
  near(geometry.layout.pause.x, 2.9018)
  near(geometry.layout.pause.y, 6.2802)
  near(geometry.layout.diagnostics.x, 14.159)
  near(geometry.layout.diagnostics.y, 4.8551)
  near(geometry.layout.meters.x, 50)
  near(geometry.layout.meters.y, 2.7222)
  near(geometry.layout.leftJoystick.x, 8.5608)
  near(geometry.layout.leftJoystick.y, 80.5833)
  near(geometry.layout.rightJoystick.x, 91.4392)
  near(geometry.layout.slot1.x, 18.4821)
  near(geometry.layout.slot1.y, 75.5556)
  near(geometry.layout.slot8.x, 81.5167)
  near(geometry.layout.slot8.y, 87.5556)
  near(geometry.layout.inventory.x, 46.6629)
  near(geometry.layout.skillbook.x, 53.3371)
  near(geometry.layout.xp.y, 95.1111)
  assert.deepEqual(geometry.sizes.pause, { height: 44, width: 44 })
  assert.deepEqual(geometry.sizes.diagnostics, { height: 10.2, width: 69.73 })
  near(geometry.sizes.meters.height, 9.2)
  near(geometry.sizes.meters.width, 147.2)
  assert.deepEqual(geometry.sizes.leftJoystick, { height: 109.25, width: 109.25 })
  assert.deepEqual(geometry.sizes.slot1, { height: 46, width: 46 })
  near(geometry.sizes.inventory.height, 59.8)
  near(geometry.sizes.inventory.width, 59.8)
  assert.deepEqual(geometry.sizes.healthPotion, { height: 46, width: 46 })
})

test('default projection follows the current device aspect and UI scale without storing device pixels', () => {
  assert.deepEqual(mobileUiEditorPageSize(390, 844, true), { height: 844, width: 390 })
  assert.deepEqual(mobileUiEditorPageSize(844, 390, true), { height: 390, width: 844 })
  assert.deepEqual(mobileUiEditorPageSize(1280, 800, true), { height: 800, width: 1280 })
  assert.deepEqual(mobileUiEditorPageSize(1920, 1080, false), { height: 414, width: 896 })
  const enlarged = defaultMobileUiGeometry(896, 414, 1.5)
  assert.equal(enlarged.sizes.leftJoystick.width, 163.875)
  assert.equal(enlarged.sizes.inventory.width, 89.7)
  assert.ok(enlarged.layout.leftJoystick.x > DEFAULT_MOBILE_UI_LAYOUT.leftJoystick.x)
})

test('layout persistence is complete, bounded, versioned, observable, and resettable', () => {
  resetMobileUiLayoutListenersForTests()
  const storage = new MemoryStorage()
  assert.deepEqual(readMobileUiLayoutState(storage), {
    customized: false,
    layout: DEFAULT_MOBILE_UI_LAYOUT,
  })
  const changed = mobileUiLayoutWith(DEFAULT_MOBILE_UI_LAYOUT, 'inventory', {
    rotation: 37.5,
    scale: 1.4,
    x: 31.25,
    y: 72.5,
  })
  const events: boolean[] = []
  const unsubscribe = subscribeMobileUiLayout((state) => events.push(state.customized))
  assert.deepEqual(setMobileUiLayout(changed, storage), { customized: true, layout: changed })
  assert.deepEqual(readMobileUiLayoutState(storage), { customized: true, layout: changed })
  assert.equal(MOBILE_UI_LAYOUT_VERSION, 2)
  assert.match(storage.values.get(MOBILE_UI_LAYOUT_STORAGE_KEY) ?? '', /"version":2/)
  assert.deepEqual(mobileUiLayoutFromDocument(mobileUiLayoutDocument(changed)), changed)
  resetMobileUiLayout(storage)
  assert.deepEqual(readMobileUiLayoutState(storage), {
    customized: false,
    layout: DEFAULT_MOBILE_UI_LAYOUT,
  })
  unsubscribe()
  assert.deepEqual(events, [true, false])

  for (const malformed of [
    '{',
    '{"version":3,"elements":{}}',
    JSON.stringify({ version: 2, elements: { ...changed, slot8: undefined } }),
    JSON.stringify({
      version: 2,
      elements: { ...changed, inventory: { ...changed.inventory, scale: 99 } },
    }),
    JSON.stringify({ version: 2, elements: { ...changed, extra: changed.inventory } }),
  ]) {
    storage.values.set(MOBILE_UI_LAYOUT_STORAGE_KEY, malformed)
    assert.equal(readMobileUiLayoutState(storage).customized, false, malformed)
  }

  const { meters: _meters, ...legacyElements } = changed
  storage.values.set(MOBILE_UI_LAYOUT_STORAGE_KEY, JSON.stringify({
    elements: legacyElements,
    version: 1,
  }))
  const migrated = readMobileUiLayoutState(storage)
  assert.equal(migrated.customized, true)
  assert.deepEqual(migrated.layout.meters, DEFAULT_MOBILE_UI_LAYOUT.meters)
  assert.deepEqual(migrated.layout.inventory, changed.inventory)

  assert.equal(mobileUiLayoutFromDocument({
    ...mobileUiLayoutDocument(changed),
    extra: true,
  }), null)
})

test('grid, bounds, element gestures, page zoom, and CSS projection stay independent', () => {
  assert.deepEqual(
    snapMobileUiPoint({ x: 51, y: 49 }, { height: 414, width: 896 }),
    { x: 51.78571428571429, y: 50.24154589371981 },
  )
  assert.equal(mobileUiElementPinchScale(1, 100, 180), 1.8)
  assert.equal(mobileUiElementPinchScale(2.8, 100, 180), MOBILE_UI_SCALE_MAX)
  assert.equal(mobileUiElementPinchScale(0.5, 100, 20), MOBILE_UI_SCALE_MIN)
  assert.equal(mobileUiElementRotation(170, 0, Math.PI / 6, false), -160)
  assert.equal(mobileUiElementRotation(0, 0, Math.PI / 13, true), 15)
  assert.equal(mobileUiPagePinchZoom(1, 100, 250), 2.5)
  assert.equal(mobileUiPagePinchZoom(3, 100, 250), MOBILE_UI_PAGE_ZOOM_MAX)
  assert.equal(mobileUiPagePinchZoom(0.5, 100, 20), MOBILE_UI_PAGE_ZOOM_MIN)

  const constrained = constrainMobileUiTransform(
    { rotation: 45, scale: 3, x: -20, y: 140 },
    { height: 100, width: 100 },
    { height: 414, width: 896 },
  )
  assert.ok(constrained.x >= 0 && constrained.x <= 100)
  assert.ok(constrained.y >= 0 && constrained.y <= 100)
  const style = mobileUiElementStyle({
    customized: true,
    layout: mobileUiLayoutWith(DEFAULT_MOBILE_UI_LAYOUT, 'pause', {
      rotation: 25,
      scale: 1.25,
      x: 40,
      y: 30,
    }),
  }, 'pause') as Record<string, string | number>
  assert.deepEqual(style, {
    '--mobile-ui-rotation': '25deg',
    '--mobile-ui-scale': 1.25,
    '--mobile-ui-x': '40%',
    '--mobile-ui-y': '30%',
  })
  assert.equal(mobileUiElementStyle({ customized: false, layout: DEFAULT_MOBILE_UI_LAYOUT }, 'pause'), undefined)
})
