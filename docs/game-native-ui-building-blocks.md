# Stock UI building blocks

The native UI kit is the one reusable interface for Solomon Dark's stock UI
art and bitmap text. It contains all 12 presentation/UI atlases, all 1,259
records, all ten bitmap-font wrappers, and composable plans for sprites, text,
tiled/clipped fills, mirrored frames, buttons, tabs, messages, SimpleMenu, and
the stock BoastBox.

## Supported entrypoints

Game code imports the kit through one of five supported seams. Do not deep-
import implementation files from outside `native-ui/`.

- `native-ui/core.ts`: Node-safe catalog, text, plan, Settings contract, and
  Notebox contract. It never evaluates PNG imports.
- `native-ui/assets.ts`: browser atlas URLs.
- `native-ui/pixi.ts`: the Pixi adapter.
- `native-ui/react-raw.ts`: exact low-level React sprite, strip, nine-slice,
  bitmap-text, and plan adapters.
- `native-ui/react.ts`: semantic Button, MsgBox, Tabs, SimpleMenu, BoastMenu,
  PartyMenu, Settings, and Notebox modules.

An architecture test rejects every external import that bypasses these seams.
Use the semantic interface whenever the stock composition already exists; the
raw React interface is the explicit escape hatch for a recovered composition
that has not yet earned a semantic module.

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
import { NATIVE_UI_ATLAS_SOURCES } from './native-ui/assets.ts'
import { nativeUiRect, planNativeUiMessage, planNativeUiTabs } from './native-ui/core.ts'
import { createNativeUiPixiAdapter } from './native-ui/pixi.ts'

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

React callers use the DOM adapter through the semantic stock modules rather
than rebuilding transparent hit rectangles beside a Pixi render:

```tsx
import { NativeUiButton, NativeUiMessageBox } from './native-ui/react.ts'

<NativeUiMessageBox title="Kill character?" body={warning}>
  <NativeUiButton onClick={confirm}>YES</NativeUiButton>
  <NativeUiButton data-game-back="true" onClick={cancel}>NO</NativeUiButton>
</NativeUiMessageBox>
```

Messages require one or two `NativeUiButton` children. The message owns stock
layout, wrapping, curtain, frame, ornaments, and default action bounds; each
button owns its pointer/key press, disabled art, bitmap label, focus-visible
accessibility outline, and semantic element. Hover and focus leave the stock
body idle; only press selects `UI.102` and moves the label by `(6,6)`. Callers
own only content and action meaning. `NativeUiPlanView` is the
DOM adapter for lower-level recovered compositions and consumes the same pure
plan as the supported `native-ui/pixi.ts` adapter.

The small raw interface is available when a recovered screen needs an exact
record without a high-level composition:

```ts
import { nativeUiRecord } from './native-ui/core.ts'

const record = nativeUiRecord('UI', 13)
const sprite = ui.sprite({ atlas: 'UI', kind: 'sprite', record: 13, x: 460, y: 128 })
```

`nativeUiRecord` fails on a missing index. It never substitutes another image.

## Frames and bottom ornaments

`UI.17` is the stock 80 by 83 frame source. Use it through the shared
`NativeUiSprite` or nine-slice interfaces; never recover it with a broad atlas
crop. A crop that extends one pixel past `UI.17`'s right edge enters the
adjacent `UI.8` record.

`UI.8` is a separate 49 by 112 downward ornament. It is not a corner tail. It
belongs only to the authored three-ornament group below stock message and
SimpleMenu frames: one full-scale centre ornament and two 0.75-scale side
ornaments. Web-authored panels may reuse the clean `UI.17` corner art, but must
not attach `UI.8` to their top corners or combine the two records into one
bitmap.

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

Between the two brackets the plan stretches the last column of `UI.13` as a
`slice` node labelled `<id>:plate`, the same trick the stock button plays with
`UI.54`, so a wide tab keeps its stone band behind the label instead of showing
the scene through the gap. A tab exactly two brackets wide gets no plate.

## Buttons and SimpleMenu

`planNativeUiButton` owns the stock `UI.101` idle body, `UI.102` pressed/
explicit-selected body, Fonts group 3 label, native gold tint, and disabled
alpha. Its states are `idle`, `focused`, `pressed`, `selected`, and `disabled`.
Pass `scale` to draw the same chrome smaller: the surround, the pressed label
drop, and the label glyphs scale together, the minimum width applies to the
unscaled body, and a scale of 1 emits exactly the nodes it always did.
`focused` preserves the idle body because retail hover/focus state does not
enter the render branch; the DOM adapter supplies a separate browser-required
focus-visible outline. `pressed` and explicit `selected` use `UI.102` and move
the bitmap label six pixels right and down.

`planNativeUiButtonChrome` exposes the same body and surround without assuming
a label baseline. Use it for recovered native callers such as Dowsing whose
body is the standard Button but whose owner adds more than one text row. The
body rectangle is also the semantic control rectangle. The chrome begins six
pixels left and above it, extends six pixels past its right edge, and retains
`UI.54`'s authored 85-pixel height (ten pixels below the 69-pixel body). It
draws one full 70 by 85 `UI.54` left end, stretches
only the record's final five-percent strip through the middle, and mirrors one
full right end. Never draw two centred `UI.54` sprites or widen `UI.101` to the
surround bounds.

`NativeUiButton` is the semantic React form of that same plan. Do not create a
second CSS button skin for a stock action.

`NativeUiStoneButton` is the separate green CPanel/Dark Cloud action family.
It scales the exact `UI.105` idle and `UI.106` pressed faces to the owning
HotRect and keeps its ControlPanel bitmap label in the same plan. It is not a
green variant of `NativeUiButton`; the two families use different authored
records and press substitutions.

`planNativeUiSimpleMenu` composes those buttons with the native frame, header,
arrows, curtain, and action rectangles. The screen owner continues to supply
opening/closing progress and to decide what an action means.

`NativeUiSimpleMenu` is the semantic React owner for that plan. It accepts the
authored rows, reveal progress, back-row id, and one action callback; it owns
focus, pointer/keyboard press state, exact action rectangles, and the visible
pressed substitution. Gameplay and Dark Cloud retain pause authority, close
timing, audio, and navigation meaning.

```tsx
import { NativeUiSimpleMenu } from './native-ui/react.ts'

<NativeUiSimpleMenu
  ariaLabel="Game paused"
  backId="resume"
  onAction={beginClose}
  reveal={reveal}
  rows={[
    { id: 'resume', label: 'RESUME GAME' },
    { id: 'settings', label: 'GAME SETTINGS' },
    { id: 'leave', label: 'LEAVE GAME' },
  ]}
/>
```

`planNativeUiMessage` uses the recovered MsgBox text inset, baselines, 17-pixel
body-line advance, and 400-pixel wrap limit. A concrete native consumer may
supply `bounds` on every message action when its recovered controls do not use
the generic centered row; omitting action bounds retains the reusable one/two-
button layout. Mixed supplied/derived action geometry fails closed.

## BoastMenu

`planNativeUiBoastMenu` owns the distinct stock `Boast` surface rather than the
generic Chat selector: UI 11 outer frame, UI 50 row frames, menu title/Done,
special-uppercase labels, medium quoted statements, gold idle text, selected
green transform, and paired icon records with the right copy mirrored. The
stock content is five `490x85` rows at a 90-pixel pitch inside the inherited
`520x400` SwipeBox. Its 495-pixel content extent produces a 95-pixel vertical
range: four rows and the first 15 pixels of row five appear initially.

The plan returns the viewport, content height, clamped offset, maximum offset,
full row bounds, clipped visible row bounds, and stationary Done action used by
both renderers and semantic controls. It emits one nested clip node so frames,
text, and icons share the same scissor contract. Rows without
`stockIconRecord` return `customIcons`
placements so an owning renderer can inject one admitted mod sprite through
the shared mod-texture catalog without teaching the UI Kit about package URLs.

```tsx
import { NativeUiBoastMenu } from './native-ui/react.ts'

<NativeUiBoastMenu
  items={rows}
  onDone={close}
  onScrollChange={setScrollY}
  onSelect={selectBoast}
  scrollY={scrollY}
/>
```

Pointer drag mirrors the stock SwipeBox. Wheel input moves by the recovered
25-pixel step, with no post-release inertia. There is no scrollbar, page label,
or Previous/More control. Admitted mod rows extend the same clipped content
stream and increase its continuous scroll range.

## Party menu

`planNativeUiPartyMenu` composes the hub party menu from stock parts: the
message-box frame and curtain, a `menu` title, a `planNativeUiTabs` band with
Members, Mods, and Settings, `UI.50` corner brackets around every row, and
stock buttons drawn through `planNativeUiButton` at scale 0.55 inside rows and
at full size in the footer. The Members tab is a swipe box: pass `scrollY` and
read back `scrollY`, `maximumScrollY`, `contentHeight`, and `viewportBounds`.
Row nodes are clipped to the viewport and only buttons that intersect it become
`actions`, while `rowActions` lists every row button so a semantic adapter can
reach off-screen rows from the keyboard. Join requests render first with
`accept:<id>` and `deny:<id>` buttons, members carry LEADER, YOU, and OFFLINE
tags, and `kick:<id>` appears only on removable members. The Settings tab draws
the three-way visibility control from `UI.67` and `UI.105` plates, the Party ID
row with `copy`, and the New party ID row with `generate`; a non-leader sees the
plates disabled and a note instead of the code rows. Action ids parse back with
`parseNativeUiPartyMenuAction`.

`NativeUiPartyMenu` renders the plan through `NativeUiPlanView` and layers the
semantic controls over it: a `tablist`, a `radiogroup` for visibility, the row
buttons inside a clipped viewport that scrolls the plan when one gains focus,
and the loose footer buttons. CLOSE carries `data-game-back` and
`data-game-default-focus`, and the module handles wheel, drag, Escape, and
outside-frame pointer dismissal. `HubScene` portals it over the scene inside
`.hub-party-menu-overlay` with `curtainAlpha={0}` so the overlay dims the
letterboxed edges evenly. The workbench PARTY tab shows the leader view.

## Party chip and invitation

`planNativeUiPartyChip(spec)` in `native-ui-party-chip.ts` draws the hub's party chip
from the menu's own chrome at card size: a UI.49 marble tile under four scaled UI.17
corners with the record's edge strips stretched between them (0.4 with rows, 0.3 as a
bare 50 px header), the UI.38 skull, PARTY in the menu face, the boneyard editor's
Bonedit.54 gear tinted gold where the member count used to sit, and the ControlPanel.0
arrow. Members and pending requests hang under the header as the same UI.50 bracket rows
the menu's Members tab uses (`nativeUiPartyMenuBracketRowNodes`), with the roster face
at 0.65 and body-face YOU, LEADER, OFFLINE, or WANTS TO JOIN tags right-aligned. An
action error is one medium-face line under the header. The plan is 236 px wide and its
height follows the body; the host places and scales the card (1:1 at 11, 174 on a
pointer, 0.55 in screen pixels under the pause skull on touch).

Actions are `header`, `settings` (only when the spec asks for the gear), and one
`member:<id>` or `request:<id>` per row; `parseNativeUiPartyChipAction` splits them.
`NativeUiPartyChip` (`react.ts`) renders the plan with a transparent button per action:
on a pointer the header opens the menu on Members and the gear opens it on Settings; on
touch (`collapsible`) the header collapses and expands the rows and the arrow points down
while they show. The party menu takes `initialTab` for this.

`NativeUiPartyInvitation` is the stock message box titled PARTY INVITATION with the
inviter's name in the body and ACCEPT and DENY on the party menu's footer line
(`nativeUiPartyInvitationActionBounds`, 125 px above the frame bottom, 36 px apart); DENY
is the back action. The workbench PARTY CHIP tab shows the desktop chip with a request,
a chip with an error line and no gear, the touch chip collapsed and expanded at 0.55,
and the invitation box.

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

## Settings presentation

`native-settings-contract.ts` owns the recovered 1600 by 900 Settings design,
600 by 700 shell, 70-pixel header/footer bands, 44-pixel rows, ControlPanel
font, and exact record membership. `NativeSettingsPresentation.tsx` exposes
the React presentation pieces for the shell, row plate, range track, binding
plate, Off/On switch, and action arrow. Screen-specific settings state and
browser-added rows remain in their owning dialog; they consume this vocabulary
without redefining atlas coordinates.

React callers use `NativeUiSettingsPanel`, `NativeUiSettingsGroup`,
`NativeUiSettingsRange`, `NativeUiSettingsToggle`,
`NativeUiSettingsAction`, `NativeUiSettingsBinding`, and
`NativeUiSettingsStaticRow` from `native-ui/react.ts`. These modules own the
semantic controls and stock row structure as well as their art. Callers own
values, persistence, pages, and browser behavior.

The Settings root preserves the stock group rhythm: Sound and Music, Video
Settings, Dark Cloud Settings, Controls, and Performance. Dense Website-only
online/account/save/developer and mobile-layout controls live behind the Dark
Cloud Settings child so they use the stock row vocabulary without replacing
the native root composition.

## Dark Cloud presentation

`native-dark-cloud-contract.ts` owns the retail 1600 by 900 screen: the shell
geometry, the record inventory, `NATIVE_DARK_CLOUD_TEXT` (heading, beta,
account, column and row baselines and scales), `NATIVE_DARK_CLOUD_COLUMNS`
(the per-tab column anchors) and `NATIVE_DARK_CLOUD_SCENE` (wall, scroll,
figure, chain, stone, frame, leather and shade constants). Two planners,
`planNativeDarkCloudBackdrop()` and `planNativeDarkCloudFrame()`, turn those
constants into plain plan fragments in the retail painter order (see RE report
300). `NativeDarkCloudPresentation.tsx` exposes the semantic React composition:

- `NativeDarkCloudSceneArt` renders the backdrop plan, the CSS shade band and
  panel glow, and the frame plan;
- `NativeDarkCloudHeading`, `NativeDarkCloudText` and `NativeDarkCloudTabs`
  use the exact heading/menu bitmap wrappers; the tabs pass `labelScale`,
  `labelTint` and `selectedLabel` through `planNativeUiTabs` so resting labels
  read lowercase in the small caps face and the selected label reads uppercase;
- `NativeDarkCloudColumns`, `NativeDarkCloudRowCells` and
  `NativeDarkCloudStatusRow` place bitmap text on the stock column anchors
  (rows from y 260, 25 px pitch, baseline 28 px below the row top);
- `NativeDarkCloudToolButton` owns `UI.103/.104`, paired `UI.53` surrounds,
  and the exact Search/Sort icons or Options label;
- `NativeDarkCloudPrimaryButton` owns the `UI.101/.102` and `UI.54` family; and
- `NativeDarkCloudPanelArt` paints the two recovered corner sets plus the two
  side flourishes for Search, Sort, account-style, and Website extension
  dialogs.

The Dark Cloud stage is a fixed 1600 by 900 native stage scaled by
`nativeStageStyle` like the Hub and Boneyard; there is no fluid layout and no
phone-specific skin. The workbench DARK CLOUD tab shows the full composition.

`NativeUiTabs` similarly turns `planNativeUiTabs` into one semantic tablist
whose visible art and hit rectangles come from the same plan. `NativeUiNotebox`
owns the recovered Notebox geometry, fixed-tick reveal/fade, pointer dismissal,
and self-contained styles; its caller supplies only the notice and expiry
effect.

## Regeneration

Regenerate from the verified retail `images` directory:

```bash
python3 tools/extract-native-ui-kit.py \
  '/path/to/SolomonDarkAbandonware/images'
```

The extractor fails closed unless the parent executable is retail 0.72.5 and
every PNG/bundle hash, dimension, record count, rotation flag, font count, and
glyph count matches the recovered contract.
