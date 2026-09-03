import { nativeUiRect } from './native-ui-plan.ts'

export const NATIVE_SETTINGS_PRESENTATION = Object.freeze({
  design: Object.freeze({ height: 900, width: 1_600 }),
  font: 'control-panel' as const,
  panel: Object.freeze({
    bounds: nativeUiRect(500, 100, 600, 700),
    contentWidth: 560,
    footerBounds: nativeUiRect(650, 739.5, 300, 41),
    footerHeight: 70,
    headerHeight: 70,
    rowHeight: 44,
  }),
  records: Object.freeze({
    actionArrow: Object.freeze({ atlas: 'ControlPanel' as const, record: 0 }),
    bindingPlate: Object.freeze({ atlas: 'ControlPanel' as const, record: 5 }),
    frameCorner: Object.freeze({ atlas: 'UI' as const, record: 17 }),
    frameFlourish: Object.freeze({ atlas: 'UI' as const, record: 18 }),
    rowPlate: Object.freeze({ atlas: 'ControlPanel' as const, record: 3 }),
    sliderThumb: Object.freeze({ atlas: 'ControlPanel' as const, record: 18 }),
    sliderTrack: Object.freeze({ atlas: 'ControlPanel' as const, record: 4 }),
    stoneButtonIdle: Object.freeze({ atlas: 'UI' as const, record: 105 }),
    stoneButtonPressed: Object.freeze({ atlas: 'UI' as const, record: 106 }),
    toggleOff: Object.freeze({ atlas: 'ControlPanel' as const, record: 8 }),
    toggleOn: Object.freeze({ atlas: 'ControlPanel' as const, record: 9 }),
  }),
})
