import { Container } from 'pixi.js'

import {
  createGameWebGlApplication,
  loadGameTextureMap,
} from '../renderer/game-webgl.ts'
import { NATIVE_UI_ATLAS_SOURCES } from './native-ui-assets.ts'
import {
  NATIVE_UI_ATLAS_NAMES,
  NATIVE_UI_MANIFEST,
  nativeUiAtlas,
  nativeUiRecord,
  type NativeUiAtlasName,
} from './native-ui-catalog.ts'
import {
  nativeUiPlan,
  nativeUiRect,
  planNativeUiButton,
  planNativeUiMessage,
  planNativeUiTabs,
  type NativeUiPlan,
} from './native-ui-plan.ts'
import { createNativeUiPixiAdapter } from './native-ui-pixi.ts'

const WIDTH = 1_600
const HEIGHT = 900

const host = requiredElement<HTMLDivElement>('native-ui-stage')
const status = requiredElement<HTMLOutputElement>('native-ui-status')
const atlasSelect = requiredElement<HTMLSelectElement>('atlas')
const recordInput = requiredElement<HTMLInputElement>('record')
const componentsButton = requiredElement<HTMLButtonElement>('show-components')
const atlasButton = requiredElement<HTMLButtonElement>('show-atlas')
const previousButton = requiredElement<HTMLButtonElement>('previous')
const nextButton = requiredElement<HTMLButtonElement>('next')

for (const name of NATIVE_UI_ATLAS_NAMES) {
  const option = document.createElement('option')
  option.value = name
  option.textContent = `${name} (${Object.keys(nativeUiAtlas(name).records).length})`
  atlasSelect.append(option)
}
atlasSelect.value = 'UI'
recordInput.value = '101'

let mode: 'atlas' | 'components' = 'components'
let revision = 0

void start().catch((error: unknown) => {
  status.value = error instanceof Error ? error.message : 'Native UI workbench failed.'
  document.documentElement.dataset.nativeUiWorkbench = 'error'
})

async function start(): Promise<void> {
  const [gpu, textures] = await Promise.all([
    createGameWebGlApplication({
      backgroundAlpha: 0,
      className: 'native-ui-workbench-canvas',
      height: HEIGHT,
      resolution: 1,
      width: WIDTH,
    }),
    loadGameTextureMap(Object.values(NATIVE_UI_ATLAS_SOURCES)),
  ])
  const nativeUi = createNativeUiPixiAdapter(textures)
  const root = new Container({ label: 'native-ui-workbench' })
  gpu.application.stage.addChild(root)
  host.replaceChildren(gpu.canvas)
  gpu.canvas.dataset.atlasCount = `${NATIVE_UI_MANIFEST.summary.atlasCount}`
  gpu.canvas.dataset.fontCount = `${NATIVE_UI_MANIFEST.summary.fontCount}`
  gpu.canvas.dataset.recordCount = `${NATIVE_UI_MANIFEST.summary.recordCount}`

  const render = (): void => {
    root.removeChildren().forEach((child) => child.destroy({ children: true }))
    const plan = mode === 'components' ? componentPlan() : atlasPlan(selectedAtlas(), selectedRecord())
    root.addChild(nativeUi.render(plan, `native-ui-${mode}`))
    gpu.application.renderer.render(gpu.application.stage)
    revision += 1
    gpu.canvas.dataset.mode = mode
    gpu.canvas.dataset.atlas = selectedAtlas()
    gpu.canvas.dataset.record = `${selectedRecord()}`
    gpu.canvas.dataset.nodeCount = `${plan.nodes.length}`
    gpu.canvas.dataset.actionCount = `${plan.actions.length}`
    gpu.canvas.dataset.renderRevision = `${revision}`
    status.value = mode === 'components'
      ? `12 atlases · 1,259 records · 10 fonts · ${plan.nodes.length} visible plan nodes · ${plan.actions.length} semantic actions`
      : `${selectedAtlas()}.${selectedRecord()} · ${formatRecord(selectedAtlas(), selectedRecord())}`
    document.documentElement.dataset.nativeUiWorkbench = 'ready'
  }

  const setMode = (next: typeof mode): void => {
    mode = next
    componentsButton.ariaPressed = `${mode === 'components'}`
    atlasButton.ariaPressed = `${mode === 'atlas'}`
    render()
  }
  const clampRecord = (): void => {
    const maximum = Object.keys(nativeUiAtlas(selectedAtlas()).records).length - 1
    const value = Number.parseInt(recordInput.value, 10)
    recordInput.max = `${maximum}`
    recordInput.value = `${Math.max(0, Math.min(maximum, Number.isFinite(value) ? value : 0))}`
  }
  componentsButton.addEventListener('click', () => setMode('components'))
  atlasButton.addEventListener('click', () => setMode('atlas'))
  atlasSelect.addEventListener('change', () => {
    recordInput.value = '0'
    clampRecord()
    setMode('atlas')
  })
  recordInput.addEventListener('change', () => {
    clampRecord()
    setMode('atlas')
  })
  previousButton.addEventListener('click', () => {
    recordInput.value = `${selectedRecord() - 1}`
    clampRecord()
    setMode('atlas')
  })
  nextButton.addEventListener('click', () => {
    recordInput.value = `${selectedRecord() + 1}`
    clampRecord()
    setMode('atlas')
  })
  window.addEventListener('pagehide', () => {
    gpu.application.destroy({ removeView: true })
    nativeUi.destroy()
    textures.destroy()
  }, { once: true })
  clampRecord()
  render()
}

function componentPlan(): NativeUiPlan {
  const message = planNativeUiMessage({
    actions: [
      { id: 'accept', label: 'ACCEPT', state: 'focused' },
      { id: 'cancel', label: 'CANCEL' },
    ],
    body: 'Every panel, glyph, button, and tab in this preview is composed from the stock atlas record and bitmap-font ABI.',
    bounds: nativeUiRect(500, 105, 600, 430),
    dimAlpha: 0.55,
    height: HEIGHT,
    title: 'STOCK UI BUILDING BLOCKS',
    width: WIDTH,
  })
  const tabs = planNativeUiTabs({
    height: HEIGHT,
    selectedId: 'messages',
    tabs: [
      { bounds: nativeUiRect(430, 680, 230, 69), id: 'messages', label: 'MESSAGES' },
      { bounds: nativeUiRect(685, 680, 230, 69), id: 'tabs', label: 'TABS' },
      { bounds: nativeUiRect(940, 680, 230, 69), id: 'assets', label: 'ASSETS' },
    ],
    width: WIDTH,
  })
  const disabled = planNativeUiButton({
    bounds: nativeUiRect(623.5, 790, 353, 69),
    id: 'disabled-example',
    label: 'DISABLED STOCK ACTION',
    state: 'disabled',
  })
  return nativeUiPlan(WIDTH, HEIGHT, message, tabs, disabled)
}

function atlasPlan(atlas: NativeUiAtlasName, record: number): NativeUiPlan {
  const definition = nativeUiRecord(atlas, record)
  const [logicalWidth, logicalHeight] = definition.logicalSize
  const scale = Math.min(1, 650 / logicalWidth, 550 / logicalHeight)
  return nativeUiPlan(WIDTH, HEIGHT, {
    actions: [],
    nodes: [
      { bounds: nativeUiRect(0, 0, WIDTH, HEIGHT), color: 0x06070a, kind: 'solid' },
      {
        anchor: [0.5, 0.5],
        atlas,
        kind: 'sprite',
        label: `${atlas}.${record}`,
        record,
        scale,
        x: WIDTH / 2,
        y: HEIGHT / 2,
      },
      {
        kind: 'text',
        text: {
          font: 'heading',
          text: `${atlas} ${record}`.toUpperCase(),
          tint: 0xe0c574,
          x: WIDTH / 2,
          y: 70,
        },
      },
      {
        kind: 'text',
        text: {
          font: 'medium',
          text: formatRecord(atlas, record).toUpperCase(),
          tint: 0xb7ad94,
          x: WIDTH / 2,
          y: 820,
        },
      },
    ],
  })
}

function selectedAtlas(): NativeUiAtlasName {
  const value = atlasSelect.value
  if (!NATIVE_UI_ATLAS_NAMES.includes(value as NativeUiAtlasName)) throw new Error(`Unknown atlas ${value}`)
  return value as NativeUiAtlasName
}

function selectedRecord(): number {
  return Number.parseInt(recordInput.value, 10)
}

function formatRecord(atlas: NativeUiAtlasName, record: number): string {
  const definition = nativeUiRecord(atlas, record)
  return `frame ${definition.frame.join(' × ')} · logical ${definition.logicalSize.join(' × ')} · trim ${definition.trimOrigin.join(', ')}`
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Native UI workbench is missing #${id}`)
  return element as T
}
