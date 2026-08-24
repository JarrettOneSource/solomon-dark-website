# Stock UI building blocks

The native UI kit is the one reusable interface for Solomon Dark's stock UI
art and bitmap text. It contains all 12 presentation/UI atlases, all 1,259
records, all ten bitmap-font wrappers, and composable plans for sprites, text,
tiled/clipped fills, mirrored frames, buttons, tabs, messages, and SimpleMenu.

Use the workbench while authoring:

```bash
npm --prefix frontend run dev
```

Open `/native-ui.html`. The building-block view exercises message, button, and
tab composition. The atlas view can display every record, including records
that retail constructs but does not select from an existing screen.

## Interface

Callers create a pure plan, render that plan through the scene-owned Pixi
adapter, and build semantic controls from the returned action rectangles. The
plan does not own input, authority, screen state, or transitions.

```ts
import { loadGameTextureMap } from './renderer/game-webgl.ts'
import { NATIVE_UI_ATLAS_SOURCES } from './native-ui/native-ui-assets.ts'
import { nativeUiRect, planNativeUiMessage, planNativeUiTabs } from './native-ui/native-ui-plan.ts'
import { createNativeUiPixiAdapter } from './native-ui/native-ui-pixi.ts'

const textures = await loadGameTextureMap(Object.values(NATIVE_UI_ATLAS_SOURCES))
const ui = createNativeUiPixiAdapter(textures)
const plan = planNativeUiMessage({
  actions: [
    { id: 'accept', label: 'ACCEPT', state: 'focused' },
    { id: 'cancel', label: 'CANCEL' },
  ],
  body: 'Message text uses the exact native medium bitmap font.',
  bounds: nativeUiRect(535.5, 158, 529, 384),
  height: 900,
  title: 'A STOCK MESSAGE',
  width: 1600,
})

scene.addChild(ui.render(plan))
// React/HTML buttons use plan.actions[n].bounds and the same action id.

// On scene teardown, before the source page set is destroyed:
ui.destroy()
textures.destroy()
```

The small raw interface is available when a recovered screen needs an exact
record without a high-level composition:

```ts
import { nativeUiRecord } from './native-ui/native-ui-catalog.ts'

const record = nativeUiRecord('UI', 13)
const sprite = ui.sprite({ atlas: 'UI', kind: 'sprite', record: 13, x: 460, y: 128 })
```

`nativeUiRecord` fails on a missing index. It never substitutes another image.

## Tabs

Supply the semantic band for each tab. Selection preserves native Dark Cloud
geometry: the label rises 8 pixels, each `UI.13` bracket grows from 51 to 65
pixels, and bracket X does not move.

```ts
const tabs = planNativeUiTabs({
  height: 900,
  selectedId: 'online',
  tabs: [
    { bounds: nativeUiRect(460, 128, 170, 69), id: 'recent', label: 'RECENT' },
    { bounds: nativeUiRect(630, 128, 340, 69), id: 'online', label: 'ONLINE LEVELS' },
    { bounds: nativeUiRect(970, 128, 170, 69), id: 'mine', label: 'MY LEVELS' },
  ],
  width: 1600,
})
```

The selected id must name one supplied tab. Disabled tabs keep their semantic
rectangle but return `disabled: true` and render at native disabled alpha.

## Buttons and SimpleMenu

`planNativeUiButton` owns the stock `UI.101` idle body, `UI.102` pressed/
selected body, `UI.54` end treatment, Fonts group 3 label, native gold tint,
and disabled alpha. Its states are `idle`, `focused`, `pressed`, `selected`,
and `disabled`.

`planNativeUiSimpleMenu` composes those buttons with the native frame, header,
arrows, curtain, and action rectangles. The screen owner continues to supply
opening/closing progress and to decide what an action means.

## Bitmap text

`native-ui-text.ts` is the shared measurement and glyph-layout seam for both
Pixi and `NativeBitmapText.tsx`. It preserves each wrapper's metrics, glyph
set, advance, and kerning table. Unsupported glyphs are reported in
`unsupportedCodePoints` and draw nothing. There is intentionally no OS-font
fallback.

Available font names are:

- `body`, `medium`, `special-uppercase`, `menu`, `heading`;
- `skill-uppercase`, `world-and-roster`, `timeline`, `belt`;
- `control-panel`.

## Regeneration

Regenerate from the verified retail `images` directory:

```bash
python3 tools/extract-native-ui-kit.py \
  '/path/to/SolomonDarkAbandonware/images'
```

The extractor fails closed unless the parent executable is retail 0.72.5 and
every PNG/bundle hash, dimension, record count, rotation flag, font count, and
glyph count matches the recovered contract.
