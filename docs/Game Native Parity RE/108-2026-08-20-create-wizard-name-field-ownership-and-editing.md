# 2026-08-20 — Create-wizard name field ownership and editing

## Reported smell and parity question

- Reported web behavior: the loadout screen paints a fixed `HELVIDIUS` sprite
  and exposes only a clipped `aria-label`; it cannot receive a wizard name or
  pass one to the player configuration.
- Stock behavior to recover: retain the Create field chrome and dynamic native
  bitmap-name lane while making its value an actual browser text control.
- Reproduction inputs/scenes: fresh Title -> Create element screen and the
  retained post-run `loadout` screen, at a `1600 x 900` logical stage.
- Falsifiable questions: a name-only presentation patch is wrong if the value
  does not become `PlayerCharacterConfig.displayName` on first connection, or
  if the retained-loadout branch permits an unreplicated rename.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock | `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Mod Loader `tests/fixtures/webgame/menu-layouts/create-element.json`; paired clean reference `create-element.png` | The Create field is visible at the top centre with `WIZARD NAME`, the saved name `SOLONSOLUS`, ornamental ends, a 384-pixel inner lane, and a fixed clear-X lane at its right. | high |
| Instructions | image base `0x00400000`; `CreateWizardMenu::Render` `0x0059AD40`, especially `0x0059BF90..0x0059C180`; Create update `0x0058A820`; finalizer `0x005CFA80` | The renderer assigns `"wizard name"` through Fonts `+0x04D530`; the extracted Create name value is rendered through Fonts group 4, then followed by the group-1 `x` clear control. Create owns presentation while selection finalization enters player startup separately. | high |
| Asset/data | `Fonts.bundle` SHA-256 `048aa22cc715ee633f5e31f0400b4a3a9c0a8c8b49d681419e19d5ff676c214a`; group 4 records `308..349`; header `[40,10,28]`; 132 kerning pairs; `Create.bundle` plus `UI.80` end caps | Fonts group 4 has the complete 42-glyph uppercase name source. Group 1 supplies the `WIZARD NAME` caption and clear X; the field chrome is not a source of letters. | high |
| Web causal trace | `CreateMenuScene.tsx`, `renderer/create-menu-renderer.ts`, `MainMenuScene.tsx`, and `protocol/game-protocol.ts` at `e94ec7c` | `create-text-name.png` bakes `HELVIDIUS`; a clipped non-control supplies semantics; `startHub` ignores name state and uses the page default although `displayName` already has a nonempty 64-character protocol contract. | high |

## System boundary and membership inventory

Native system: Create-wizard name lane — the composed name-field chrome,
group-1 bitmap glyph presentation, editable local draft, first-session player
configuration, and retained-loadout display ownership.

| Member (class/variant/scene/branch) | Native source (function/table row/record) | Disposition | Proof |
| --- | --- | --- | --- |
| Name-field chrome | `UI.80` ends, rail, dark inner lane; Create top-centre stage | verified-already-at-parity | Existing renderer geometry and clean reference capture |
| Caption, value, and clear-X glyphs | Fonts group 1 at `+0x04D530`, records `93..184`; Fonts group 4 records `308..349` | exact-ported | Extracted group-1/group-4 assets and renderer layout contract |
| Clear X | `TextBox` subcontrol and group-1 `x` art | exact-ported | Fixed right-lane art plus semantic clear-action test |
| Fresh Create element branch | Create vtable `0x00797B7C`, render `0x0059AD40` | exact-ported | DOM input drives draft and first `client-hello.character.displayName` |
| Fresh Create discipline branch | Same owner after a selected element | exact-ported | Draft remains stable through the element-to-discipline transition and finalizer |
| Retained post-run loadout | Web run phase `loadout`; existing player configuration snapshot | exact-ported | Shows the authoritative existing name and disables editing because no rename message exists |
| Element choices (five) and discipline choices (three) | Create records `9..13`, choice arrays `+0x0720`, `+0x0740`, `+0x0750` | verified-already-at-parity | Their state and interaction remain independent of the name lane |
| Other Fonts group-1 consumers | Shared Fonts wrapper, other menu/panel renderers | out-of-system (shared glyph source; no Create-name state or finalizer) | Native font inventory and `native-atlas-consumers.json` |

## Native ownership thread

- Owner and construction path: CreateWizardMenu vtable `0x00797B7C` is built
  through `0x00593C30`; `0x0059AD40` owns the field presentation in the same
  top-centre screen-space stream as the Create art.
- Upstream state producers/callers: the saved/profile name is already selected
  before Create presentation. The web equivalent starts from the account/default
  display name at `Game.tsx` and keeps the draft in `MainMenuScene` until the
  first `connectSession` call.
- State representation and transitions: name editing is available before the
  first connection; element and discipline selection do not replace its draft.
  Once connected, the authoritative player config is the source of truth and
  the post-run Create screen is confirmation-only.
- Downstream consumers/callees: first connection serializes the draft as
  `PlayerCharacterConfig.displayName`; the host snapshots it to HUD, ally,
  pause, and Lua consumers. No existing protocol message can rename a connected
  player.
- Sibling systems sharing ownership or data: the five elements, three
  disciplines, name chrome, native group-1 glyph table, startup finalizer, and
  retained-loadout return branch were swept above.
- Entry, interruption, reset, and teardown: leaving Create discards an
  uncommitted draft with the scene; selecting an element preserves it; a failed
  connection retains it for retry; a retained screen reads the snapshot and
  cannot locally diverge from the host.

## Recovered behavioral contract

- Timing/ticks/thresholds: name editing is input-driven and must not restart
  the recovered 100 Hz Create motion or choice audio clocks.
- Geometry/transforms/coordinate spaces: the field remains in the existing
  `558 x 17` top-centre Create-local container; the value uses the native
  group-4 `40`-pixel face centred in the 384-pixel inner lane, while the
  group-1 clear X remains in its fixed right lane.
- Render/hit/collision/traversal order: native chrome and the bitmap glyph
  view remain Pixi artwork; the transparent semantic input alone receives text
  and pointer focus, above the artwork and below no other Create controls.
- Assets/audio/randomness: every caption/clear group-1 glyph and every
  group-4 name glyph/kerning pair is extracted; the baked
  `create-text-name.png` is removed from the live painter. Name editing has no
  native Create audio cue.
- Input/network authority/replication: require a nonempty name whose uppercase
  presentation is accepted by the extracted native group-4 glyph set and the
  existing 64-character protocol limit; preserve the entered case in the
  player configuration and commit only by first connection. The browser
  cannot rename a live player
  because the protocol has no rename command.
- Boundary and failure behavior: browser text/IME focus is the only
  browser-specific control surface. Unsupported characters are rejected at the
  input boundary rather than rendered with a fallback font.

## Nearby-system findings

- Durable finding: `Fonts` group 4, not `Create.bundle`, contains the dynamic
  uppercase name field's complete 42-glyph source and 132-pair kerning table;
  group 1 supplies only its caption and clear X.
- Evidence: `Bundle_Fonts` builder `0x004EA3D0`, runtime destinations
  `0x008199A0 + 0x04D530` and `+0x1351CC`, the extraction rule in
  `tools/extract-main-menu-assets.py`, `0x0059BF90..0x0059C180`, and the clean
  Create reference capture.
- Why it matters or may matter later: a generic CSS font or a one-name PNG
  silently loses native glyph shape, spacing, and supported-character bounds.
- Native report/catalog also updated: `Mod Loader/docs/reverse-engineering/native-presentation-ui-fonts-and-loader.md` records the Create-specific group-1 name lane and its renderer range.

## Confidence and open questions

- Confirmed: owner, top-centre geometry, dynamic bitmap-font source, font
  membership, fresh-session configuration boundary, and retained-session
  authority boundary.
- Inferred: the native profile name is editable before Create rather than by a
  direct Create UI-tree action; this is consistent with the capture and render
  ownership but does not change the browser's visible contract.
- Unknown: none that changes web behavior; native text-entry implementation
  details are superseded by the browser's required semantic input bridge.

## Web implementation consequence

- Correct owner/module: `MainMenuScene` owns the draft until connection;
  `CreateMenuScene` owns semantic input; `create-menu-renderer` owns the
  native bitmap view and clear X.
- Shared model change: expose a pure group-4 name layout helper used by the
  renderer and regression test; pass `displayName` and `onDisplayNameChange`
  through the Create boundary.
- Stock behavior preserved: chrome, top-centre stage, group-4 glyph metrics,
  centred value lane, clear art, choice timing, and the connected-player identity
  contract.
- Browser-specific approximation: HTML provides keyboard, touch, IME, and
  accessibility input while Pixi keeps the pixels native; no visual fallback
  font is used.
- Symptom patch or obsolete path to remove: fixed `create-text-name.png` view
  and clipped `create-menu-name-semantic` label.

## Validation contract

- Focused automated test: full group-4 membership/kerning plus initial name,
  centred value lane, supported-character rejection, fresh-session hand-off,
  and retained-loadout locking.
- Playwright or runtime journey: Title -> Create -> type a valid name -> select
  element and discipline -> Hub; verify the input, dynamic Pixi glyph lane,
  outbound player configuration, and zero page/console errors. Re-enter the
  retained branch and verify its authoritative name is readonly.
- Stock-versus-web comparison: compare the native `SOLONSOLUS` reference at a
  matching `1600 x 900` stage and assert extracted group-4 positioning.
- Measurable acceptance criteria: no baked name texture is rendered; every
  group-4 glyph can be laid out; the connected snapshot carries the submitted
  name; no live rename path exists.

## Implementation validation receipt

- Files/modules changed: `create-wizard-name.ts` lays out the complete
  extracted Fonts group-4 membership from
  `create-name-font-group-4.json`; `create-menu-renderer.ts` builds/destroys
  the corresponding Pixi glyph textures in the existing field chrome;
  `CreateMenuScene.tsx` exposes the aligned semantic input; and
  `MainMenuScene.tsx` holds the draft until first connection. The extraction
  script now regenerates the group-4 manifest; the superseded
  `create-text-name.png` asset and mapping are removed.
- Tests and canonical gate: the focused Create presentation suite proves the
  full 42-glyph / 132-kerning membership, `HELVIDIUS`'s exact `240 x 31`
  centred result, input rejection, fresh hand-off, and retained-loadout
  readonly branch. The final `./scripts/validate.sh` run passed backend
  contracts, lint/boundary checks, 1,011 broad game tests, desktop tests,
  both production builds, the bundle budget, and production-media policy.
- Browser/native evidence: Chrome `150.0.7871.124` ran the local Vite plus
  authoritative-host smoke at `1600 x 900`: it filled `SolonSolus` into the
  visible Create field, observed the matching renderer data value, selected
  Fire/Arcane, and confirmed the exact mixed-case name in connected peer HUD
  data with no page or console errors. The native comparison source remains
  the clean `SOLONSOLUS` Create capture and its extracted group-4 layout.
- Remaining implementation explicitly out of scope: editing an already
  connected retained loadout remains locked because no authoritative rename
  message exists. There are no browser-platform-blocked members.
