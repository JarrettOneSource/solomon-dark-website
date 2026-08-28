# 2026-08-20 — Multiplayer world nameplates and health bars

## Reported smell and parity question

- Reported web behavior: multiplayer Website actors render and the fixed ally
  roster already shows names and compact health rows, but actors in the world
  have no floating nameplate or health bar.
- Stock behavior to recover: every connected remote `PlayerWizard` contributes
  a camera-following half-scale name and a native 7-pixel health bar after the
  completed world render; the fixed top-center ally rows remain a separate
  consumer.
- Reproduction scenes: shared Hub courtyard, every private Hub room, and the
  active Boneyard/Arena with at least two participants. Move the remote actor,
  change its authoritative HP, cross a camera edge, enter/leave a room, and
  let the remote actor reach zero HP.
- Falsifiable questions: whether the web should derive identity from the
  interpolated frame or authoritative roster; whether the world bar scales with
  the camera; whether local players or Golems use the world lane; whether the
  zero-health death presentation removes the nameplate; and whether a missing
  bitmap glyph may fall back to an OS font.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native instructions | Clean retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; preferred image base `0x00400000`; `Arena::Render` `0x0046EC80`, `PlayerWizard` render `0x0054BA80`, ExactText `0x0043BCD0`, renderer color setter `0x0041FE50`, untextured quad `0x0041DD70` | The world lane is post-scene, uses projected actor coordinates, and draws the name before the bar without entering the D3D9 EndScene overlay. | high |
| Native durable report | Mod Loader `docs/ally-healthbar-investigation.md` and `docs/design/world-render-seam.md` | Remote participant identity and HP ratio come from the multiplayer runtime snapshot; actor progression memory is not authoritative for the bar. | high |
| Injected-loader runtime | `/mnt/d/codex-evidence/zorder-20260802/gates-a6ad8bc/real-flow-run-final/screenshots/first-wave-20260802T225008Z-267028072-client-b.png` and matching `native_world_indicator` log; loader-enabled three-peer run | The rendered world name is white, the bar is centered beneath it, the bar remains at width 64 for short names, and a zero-health record still draws the empty bar. This is supporting loader evidence, not clean-stock proof. | high |
| Native fixed-row sibling | Mod Loader `docs/reverse-engineering/native-ally-roster-hud-2026-08-14.md`; append `0x005CF480`, consumer `0x005D2520`, player producer `0x0052D2A4`, Golem producer `0x00617804`, row glyph return `0x005D3521` | Fixed ally rows use the 50 x 5 bar, 2-pixel identity gap, group-6 quarter-scale name, 10-pixel pitch, and alive-only eligibility. | high |
| Existing Website | `AllyHud.tsx`, `ally-hud.ts`, `GameHud.tsx`, `HubWorldScene`, `HubPrivateRoomScene`, `BoneyardDynamicScene`, and `hub-hud-font-group-6.json` at Website `e94ec7c` | The roster, authoritative player health, exact font atlas/kerning, and all three world actor owners already exist. Only the world indicator lane is absent. | high |

## System boundary and membership inventory

Native system: the remote-participant world indicator lane plus its separate
fixed ally-row sibling, from participant eligibility through scene projection,
bitmap rendering, HP fill, and teardown.

| Member (class/variant/scene/branch) | Native source (function/table row/record) | Disposition | Proof |
| --- | --- | --- | --- |
| Remote `PlayerWizard` world indicator in Hub courtyard | `Arena::Render 0x0046EC80` post-scene lane; `PlayerWizard` render `0x0054BA80` supplies the actor | exact-ported | shared screen-space Website layer and Hub browser journey |
| Remote `PlayerWizard` world indicator in private Hub rooms | same native Arena/PlayerWizard ownership across the active Region | exact-ported | `HubPrivateRoomScene` uses the same player presentation and projection contract |
| Remote `PlayerWizard` world indicator in Boneyard/Arena | `Arena::Render 0x0046EC80`; `TryGetGameplayHudParticipantDisplayNameForActor` | exact-ported | Boneyard renderer contract and world-position/HP regression |
| World name text | ExactText `0x0043BCD0`, half-scale command `_s(0.5)`, Fonts group 6 atlas rows `376..442` | exact-ported | extracted atlas, registration, kerning, and bitmap-sprite renderer |
| World health bar geometry and colors | `DrawNativeWorldIndicatorHealthBar`; `0x0041FE50`, `0x0041DD70`; height 7, offset 17, minimum width 64 | exact-ported | pure geometry tests and rendered pixels |
| World health ratio | `TryGetRemoteParticipantDisplayState` runtime snapshot; native clamps current/max | exact-ported | snapshot-derived ratio test; no presentation smoothing |
| World zero-health/death-presentation branch | native world path accepts finite max HP and clamps current HP to zero | exact-ported | empty-bar branch test; fixed rows remain separately alive-only |
| Local player world indicator | native lookup requires a remote participant display state | out-of-system (local player has no remote nameplate) | local-player exclusion test |
| Golem/Leviathan/Good Imp world indicator | native world predicate accepts only wizard participant bindings; no summon xref | out-of-system (not a world participant indicator member) | native predicate and adjacent xref census |
| Fixed remote ally rows in Hub and Boneyard | `0x005CF480` -> `0x005D2520`, player producer `0x0052D2A4` | verified-already-at-parity | existing `AllyHud` exact font/ratio/order tests |
| Fixed Golem ally row | Golem producer `0x00615CD0` -> `0x00617804`, `UI.23` | verified-already-at-parity | existing `deriveGolemAllyHudRows` and shared roster renderer |
| Fixed Leviathan/Good Imp rows | no direct `0x005CF480` producer in the stock executable | out-of-system (no native shared-list membership) | native two-xref census |
| Group-6 authored glyph records and 1,043 kerning pairs | `Fonts` group 6 records `376..442`, header `[24,5,28]` | exact-ported | committed JSON asset and layout tests |
| `ALLY`/`GOLEM` fixed identity art | `UI.bundle` records 0 and 23 | verified-already-at-parity | existing asset and Golem-row tests |
| Missing name/max-HP failure path | native draw returns false; no text or ASCII fallback | exact-ported | layer hides invalid items and has no fallback renderer |
| Solo/multiplayer gate | no nonlocal snapshot player means no world items | exact-ported | self-only derivation test |
| Participant disconnect/scene epoch teardown | binding/actor disappears from the active snapshot and native frame-local list | exact-ported | per-frame keyed layer removal and transition journey |

No member is browser-blocked. WebGL can represent the native bitmap sprites and
screen-space quads; the renderer deliberately keeps them out of the fixed DOM
HUD so camera zoom and browser viewport adaptation cannot change their native
logical dimensions.

## Native ownership thread

- Owner and construction path: multiplayer participant materialization owns the
  actor binding; `PlayerWizard` remains an ordinary world actor. The native
  Arena render detour calls the world indicator lane after stock scene drawing.
- Upstream state producers/callers: the participant runtime owns display name
  and authoritative runtime HP/max HP; the actor binding resolves which world
  actor is associated with that participant.
- State representation and transitions: name is durable participant state;
  position is the presented actor transform; HP ratio is recomputed from the
  authoritative current/max pair each render. The native path does not use a
  stale materialized progression object.
- Downstream consumers/callees: ExactText draws the half-scale name; the
  untextured native quad path draws border, empty track, red fill, and highlight.
  WebGL equivalents live in one screen-space world-indicator layer.
- Sibling systems sharing ownership or data: the fixed ally roster consumes
  the same remote name/HP concepts through `0x005D2520`; Golem uses that fixed
  list but not the world lane. Local HUD vitals and actor body sprites remain
  separate consumers.
- Entry, interruption, reset, and teardown: item creation follows the active
  world player map; a scene switch reprojects the current remote actor set; a
  missing participant, invalid vitals, or out-of-view projected anchor hides
  the item; layer destruction removes all derived glyph textures.

## Recovered behavioral contract

- Timing/ticks/thresholds: positions may use the existing display-time player
  interpolation; name and HP are discrete authoritative snapshot values. No
  browser timer or HP smoothing is introduced.
- Geometry/transforms/coordinate spaces: project `(actor_x, actor_y - 45)`;
  center the name and bar at the projected point; draw the bar at `name_y + 17`,
  height 7, width `max(64, 8 * nonspace_count + 4 * space_count)`; fill is
  `clamp(current / max, 0, 1)`. The layer is screen-space, so camera zoom does
  not scale the bar or glyphs.
- Render/hit/collision/traversal order: world indicators render after the
  completed world and before the semantic fixed HUD; they are noninteractive,
  do not enter actor painter sorting, and do not affect collision or lighting.
- Assets/audio/randomness: world names use the existing `Fonts` group-6 atlas;
  identity tint is white, and the four bar colors are native constants
  `(12,6,6,235)`, `(54,13,13,220)`, `(190,31,24,240)`, and `(255,105,78,210)`.
  No audio or randomness participates.
- Input/network authority/replication: the host/session snapshot is the HP and
  identity authority; the client only presents its current remote snapshot.
- Boundary and failure behavior: local actors, nonwizard summons, missing
  names, invalid max HP, and offscreen anchors produce no world item. Zero HP
  with a valid actor/name/max HP produces a name and empty bar, matching the
  native death-presentation branch.

## Nearby-system findings

- The earlier fixed ally-row pass already closed the native shared-list census;
  this entry reopens it only to connect the separate world lane and to pin the
  alive-only versus zero-health lifecycle difference.
- `HubWorldScene`, `HubPrivateRoomScene`, and `BoneyardDynamicScene` already
  share `PlayerWorldView`/`HubPlayerView` for body presentation. The new label
  must not add a Hub-only actor subclass or duplicate participant state.
- The Hub and Boneyard presentation timelines interpolate actor transforms but
  keep progression as a discrete snapshot value. That is the correct browser
  equivalent of native camera-following actor movement plus render-time
  authoritative vitals.
- Native post-scene indicators are not DOM HUD rows and must not be scaled by
  the mobile fixed-HUD readability rule.
- Native report updated: `Mod Loader/docs/ally-healthbar-investigation.md`
  records this Website handoff and the world/fixed-lane ownership boundary.

## Confidence and open questions

- Confirmed: native executable identity, addresses, post-scene owner, exact bar
  dimensions/colors/offset, remote-only eligibility, authoritative HP source,
  group-6 bitmap asset, fixed-row sibling, and scene membership.
- Inferred: the WebGL screen-space layer is the clean equivalent of native
  post-scene quads; the browser has no platform constraint requiring a visual
  approximation.
- Unknown: the exact native glyph width for every possible Unicode name is not
  represented by the Website's bounded group-6 atlas. This is not a browser
  limitation: unsupported glyphs are intentionally omitted, with no system-font
  fallback, matching native ExactText's no-fallback behavior.
- Next falsifying probe if material: compare a long mixed-case name's native
  captured glyph bounds with the fixed 8/4-pixel bar-width estimate; the current
  MP implementation and acceptance verifier define the estimate used here.

## Web implementation consequence

- Correct owner: a shared renderer-owned `NativeWorldNameplateLayer`, attached
  to the WebGL stage after the world and before the fixed semantic HUD.
- Shared model change: derive nonlocal remote player items from the presented
  player map, use presented positions, and use discrete authoritative
  progression health/name values. Keep fixed ally-row derivation unchanged
  except for its native alive-only eligibility.
- Stock behavior preserved: white half-scale bitmap names, camera-following
  actor anchor, minimum 64-pixel bar, native four-color bar construction,
  zero-health world branch, and no local/Golem/fallback labels.
- Browser-specific approximation: none. Device-pixel resolution follows the
  existing WebGL renderer; logical dimensions remain screen-space constants.
- Symptom patch or obsolete path to remove: none; no prior world-label shim
  exists. Do not route these items through `AllyHud` or CSS mobile scaling.

## Validation contract

- Focused automated test: all native geometry constants, ratio clamping,
  minimum/variable width, screen projection, self/invalid/offscreen filtering,
  zero-health visibility, deterministic item order, and fixed-row death removal.
- Playwright/runtime journey: a real two-client Website session must show the
  reciprocal world nameplate and bar in Hub and Boneyard, follow a moving
  remote actor through camera motion, change the bar from full to half HP, and
  report no page/console errors; fixed ally rows must remain present separately.
- Stock-versus-web comparison: compare the existing native injected-loader
  capture geometry at 1600 x 900 (`7` px bar, `17` px name-to-bar offset, `64`
  px minimum) with matching Website screenshots. Loader evidence remains
  labeled supporting evidence, not clean-stock provenance.
- Measurable acceptance criteria: world name/bar center follows the actor;
  width is at least 64; height is 7; bar top is name origin + 17; full/half/zero
  ratios produce corresponding fill widths; no world label appears for self;
  fixed row bar remains 50 x 5 at 10-pixel pitch; no page or console errors.
- Canonical Website gate: `./scripts/validate.sh` from the final isolated tree.

## Implementation validation receipt

- Files/modules changed: `frontend/src/game/renderer/native-world-nameplate.ts`
  owns the shared screen-space layer, `hub-world-renderer.ts` and
  `boneyard-world-renderer.ts` attach it to every world scene, and
  `world-player-textures.ts` loads the existing exact Fonts atlas for both
  renderers. `ally-hud.ts` now applies the native alive-only fixed-row gate and
  exposes the same group-6 metrics at half scale.
- Focused tests: `npm run test:world-nameplates` passed TypeScript plus 12
  focused tests covering remote/self/invalid/off-scene filtering, zero-health
  retention, ratio clamping, minimum/variable bar width, projection, native
  kerning at half scale, and fixed-row death removal.
- Canonical gate: `./scripts/validate.sh` exited 0 on Website branch
  `codex/nameplates-healthbars-native-parity-20260820`; backend build, 24
  Website contracts, lint/import boundaries, 143 prerequisite tests, 1,011
  broad frontend tests, 5 desktop tests, production frontend/game-host build,
  route budget, and media policy passed. Existing Fast Refresh and Vite large
  chunk warnings remain only as warnings.
- Browser/native evidence: the isolated two-client Chromium journey against
  `npm run dev:game -- --host 127.0.0.1 --port 4181` reached ready Hub and ready
  Boneyard scenes on both peers with empty page-error and console-error lists.
  The headless run used a startup-only `HTMLAudioElement.loadeddata` shim for
  two music channels that do not fire that event in this environment; gameplay,
  WebSocket, renderer, and screenshot paths were real. Hub capture:
  `/tmp/solomon-dark-nameplates-hub.png`; Boneyard capture:
  `/tmp/solomon-dark-nameplates-boneyard-debug-host.png`. Both visibly show the
  remote white bitmap name and centered red bordered bar; the Hub frame also
  retains the fixed ally row under the skull.
- Native comparison: the browser frames preserve the recovered 7-pixel bar,
  17-pixel name-to-bar offset, 64-pixel short-name minimum, white world text,
  and separate fixed 50 x 5 ally row. Loader-supported native comparison
  remains `/mnt/d/codex-evidence/zorder-20260802/gates-a6ad8bc/real-flow-run-final/screenshots/first-wave-20260802T225008Z-267028072-client-b.png`.
- Remaining implementation explicitly out of scope: native Mod Loader changes,
  Golem world indicators, nonwizard summon rows, OS-font fallback, and
  unrelated HUD/camera changes.

## Follow-up — Create-name clear, randomization, and anonymous initialization

The first Create-name pass closed bitmap editing and first-session ownership but
left three browser members unowned: the rendered clear X had no semantic action,
the requested name-only reroll did not exist, and an anonymous Website session
still entered Create with the hard-coded `Helvidius` default. This follow-up
reopens that missed input/lifecycle boundary. The second follow-up below corrects
this pass's then-untraced assumption that the stock top-right dice was a name
action.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native authored data | `SolomonDarkAbandonware/data/magenames.txt`, stock content SHA-256 `826b66c89344fc7662958420a7f1155001ba8ade9976c4167edbea0659bf0e89` | The complete stock wizard-name table has 273 ordered entries. | high |
| Existing Website data | `frontend/src/assets/magenames.json` at Website `c30cf8b` | The copied Website list has the same ordered stock entries plus one non-stock `Reaper` entry; it is not an exact randomizer source. | high |
| Native and Website Create assets | `create-dice.png`, legacy-named `create-text-name-caret.png`, Create renderer `0x0059AD40` ownership recorded above | The Website paints the group-1 X without its TextBox clear action. The stock edge dice is separate whole-Create art; a name-only reroll is a Website convenience. | high |
| Website causal trace | `pages/Game.tsx`, `MainMenuScene.tsx`, `CreateMenuScene.tsx`, `create-wizard-name.ts` | Anonymous sessions pass `Helvidius` as the display-name seed; Create input changes are the only name actions. | high |

### System boundary and membership inventory

Native system: Create wizard-name value, its local input actions, the complete
stock default-name table, and the pre-login/retained-loadout initialization
branches.

| Member | Native/Web source | Disposition | Proof |
| --- | --- | --- | --- |
| All 273 ordered stock wizard names | `data/magenames.txt` | exact-ported | Website asset membership/count test |
| Website-only `Reaper` entry | prior `magenames.json` copy | out-of-system (not present in stock table) | removed from the shared name asset |
| Clear X action on fresh Create | legacy-named `create-text-name-caret.png` / semantic Create control | exact-ported | clear-action test and browser click receipt |
| Browser name-only reroll | requested Website convenience / stock name table | out-of-system (stock has no name-only reroll) | injected RNG test and browser click receipt |
| Stock top-right dice | Create record 6 / whole-Create control | out-of-system (not a name action) | corrected instruction trace in the second follow-up |
| Logged-in initial name | `Game.tsx` account username -> `initialCreateWizardName` | verified-already-at-parity | existing normalized-name tests |
| Anonymous initial name | prior `Game.tsx` fallback `Helvidius` | exact-ported | random-initialization test; selected value is a stock entry |
| Retained loadout | authoritative snapshot name, read-only controls | verified-already-at-parity | existing retained-loadout branch; clear/random controls disabled |
| Element and discipline transitions | Create motion/selection state | verified-already-at-parity | existing Create motion and selection tests |

No member is browser-blocked. The browser owns only the local random draw and
input interaction; the selected name remains the value submitted to the
authoritative first-session `PlayerCharacterConfig`.

### Recovered behavioral contract

- Fresh Create with a logged-in account seeds the normalized account name.
- Fresh Create without an authenticated account selects one name uniformly
  from the exact 273-entry stock table. The lobby reservation may use the
  neutral host label `Guest`; it must not become the player character name.
- Clicking X clears the draft, shows the existing validation state, and leaves
  the value empty until the user types or randomizes.
- Clicking the new control below X selects a stock table entry, updates the
  native bitmap value, clears the validation error, and keeps focus on the name
  input. The action is local and does not mutate a connected session.
- Retained loadout name controls remain disabled because the protocol has no
  live rename operation.

### Web implementation consequence

- Correct owner: `CreateMenuScene` owns the semantic clear/random actions;
  `create-wizard-name.ts` owns the exact stock table and random selection;
  `pages/Game.tsx` passes an empty initial character name for anonymous users
  while retaining a valid lobby host label.
- Stock behavior preserved: exact ordered name data, native clear X, native
  name validation, and read-only retained-loadout behavior. The name-only
  reroll remains an explicit browser convenience separate from the stock edge
  dice.
- Browser-specific behavior: `Math.random` chooses only the local pre-session
  draft; no random value crosses the wire until the player submits Create.

### Validation contract

- Focused tests must prove all 273 names are present in order, `Reaper` is not
  selectable, RNG boundaries select the first/last entries, clear empties the
  draft, randomization restores a valid name, and anonymous initialization never
  returns the hard-coded `Helvidius` fallback.
- Browser journey: fresh anonymous `/game` -> Create must show a stock name;
  click X and verify empty validation; click the button below X and verify a
  different valid stock name; then complete element/discipline selection with
  no page or console errors.

### Implementation validation receipt

- Implementation: `create-wizard-name.ts` now owns the exact 273-entry stock
  table and bounded random selection; `Game.tsx` leaves anonymous character
  initialization empty while reserving the neutral `Guest` lobby label;
  `MainMenuScene.tsx` supplies the anonymous stock draw; and `CreateMenuScene`
  owns semantic clear/random buttons. The random button uses the native
  `create-dice.png` through CSS so the existing WebGL-cutover boundary remains
  intact.
- Focused proof: name/Create tests 5/5, WebGL-cutover tests 6/6, TypeScript
  check, lint, and game architecture boundary check all passed.
- Canonical gate: `./scripts/validate.sh` exited 0 on branch
  `codex/name-randomize-native-parity-20260820`; backend build and 24
  contracts, all 1,015 broad frontend tests, 5 desktop tests, production
  frontend/game-host build, bundle budget, and media policy passed. Existing
  Fast Refresh and Vite large-chunk messages remain warnings only.
- Browser proof: anonymous Chromium Create journey showed stock initial
  `Arrenius`, clear produced an empty input with `Enter a wizard name.`, and
  the below-X control selected stock `Lollius`. Measured control positions
  were clear Y=38 and randomize Y=96; the randomizer had the native dice CSS
  background, no child image, and page/console error lists were empty.
- Browser screenshot: `/tmp/solomon-wizard-name-randomize-20260820-final.png`.

## Second follow-up — Create-name control ownership and review correction

The earlier follow-up inferred name-reroll semantics from the stock dice art
without tracing the native widget constructor or its registered-control
callback. It also validated the new control in isolation, so the full-screen
name stage's pointer ownership, fresh-entry lifecycle, and native text-width
limit were missed. The result is a boxed duplicate dice below the field, a
name layer that intercepts the Back skull, an anonymous draft drawn more than
once during React mount, and a touched draft that survives leaving and
re-entering Create. This reopens the complete name-input boundary.

### Reported smell and parity question

- Reported web behavior: the recently added name editor needs review, and its
  name-randomize control is visually detached from the app and the X control.
- Stock behavior to recover: a Create-owned `TextBox` with one construction
  draw from the stock name table, a native-font measured-width boundary, its
  built-in clear X, child-owned hit targets, and a fresh draft on each fresh
  Create construction.
- Reproduction inputs/scenes: anonymous Title -> New Game -> Create, text edit,
  invalid/over-width input, X clear, browser name reroll, Back, re-entry,
  failed first connection, and connected retained loadout.
- Falsifiable questions: the prior model is wrong if the stock top-right dice
  does not assign a new name, if stock constrains measured width rather than
  protocol length, if the stage wrapper blocks sibling controls, or if a fresh
  Create reuses the discarded browser draft.

### Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean/native capture | `tests/fixtures/webgame/menu-layouts/create-element.json`, retail executable SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Create record 6 is the single stock edge dice at `(1518,3)..(1598,57)`; the field and UI.80 ends retain their stock top-centre geometry. | high |
| Native instructions | `CreateWizardMenu` vtable `0x00797B7C`; constructor `0x0058A500`; builder `0x00593C30`; control callback `0x0058EA50`; `TextBox` constructor `0x00431F00`, input `0x004337E0`, clear callback `0x004322B0`; constant `0x00799030` | Create owns a `TextBox` at `+0x027C`, dice Button at `+0x049C`, and pause/back Button at `+0x0550`. The TextBox selects one mage name on construction, accepts only group-4 glyphs whose measured result is at most `372.0` pixels, and owns the clearing X. The stock dice clears Create phase state to enter whole-wizard finalization; it never assigns another name. | high |
| Native authored data | `SolomonDarkAbandonware/data/magenames.txt`, 273 ordered entries, SHA-256 `826b66c89344fc7662958420a7f1155001ba8ade9976c4167edbea0659bf0e89` | The native constructor draws once from the complete table for its initial TextBox value. | high |
| Current browser implementation | Website `28c1927`: `MainMenuScene.tsx`, `CreateMenuScene.tsx`, `create-wizard-name.ts`, `main-menu.css`, `create-menu-renderer.ts` | Mount state and its effect can both draw an anonymous name; the touched flag is never reset on a later New Game; validation uses 64 characters rather than the native measured width; the full name stage has `pointer-events:auto`; and the duplicate name dice is painted by CSS in a bespoke box. | high |
| Browser reproduction | current-main local `npm run dev:game`, Chrome `150.0.7871.124`, `1600 x 900`, `/tmp/solomon-wizard-name-review-before.png` | Create showed stock name `Mercatius`; input/clear/reroll bounds were `(608,29,384,49)`, `(958,38,30,30)`, and `(950,96,46,32)`. A real click on Back timed out because `.create-menu-native-name-stage` intercepted the pointer. | high |

### System boundary and membership inventory

Native system: the Create wizard-name draft from scene construction through
font validation, semantic editing, local convenience actions, first-session
commit, interruption, and retained-loadout display.

| Member | Native/Web source | Disposition | Proof |
| --- | --- | --- | --- |
| Group-4 value layout and kerning | Fonts group 4 records `308..349` | verified-already-at-parity | complete 42-glyph / 132-kerning manifest and layout tests |
| Supported-character input | `TextBox::input 0x004337E0` | exact-ported | validation/member tests |
| `372.0`-pixel measured-width limit | `0x00593C30`, `0x00799030`, `TextBox +0x158` | exact-ported | width-boundary tests for accepted/rejected names |
| Built-in clear X | `TextBox` subcontrol, callback `0x004322B0` | exact-ported | clear behavior and aligned hit-target browser receipt |
| One native initial random name per fresh Create | `0x00593C30`, `data\\magenames.txt` | exact-ported | injected-draw-count and fresh re-entry browser receipt |
| Logged-in account-name seed | Website account identity adaptation | out-of-system (stock constructs from `magenames.txt`; the browser intentionally begins with the signed-in identity) | normalized/width-bounded seed tests |
| Browser name-only reroll | user-requested Website convenience | out-of-system (stock has no name-only reroll control) | stock-table selection test and browser receipt, explicitly labeled as web behavior |
| Stock top-right dice Button | Create `+0x049C`, record 6, callback `0x0058EA50` | out-of-system (whole-Create finalization shortcut, not a name action) | instruction trace; existing native art remains untouched |
| Fresh element and discipline phases | same Create draft before first connection | verified-already-at-parity | draft persists across the phase transition |
| Back/leave then a later fresh Create | Create destruction/reconstruction | exact-ported | browser re-entry must not retain the touched draft |
| Failed first connection retry | browser pre-session draft owner | exact-ported | draft remains available for retry |
| Connected retained loadout | authoritative player config, no rename message | verified-already-at-parity | readonly input and disabled local controls |
| Pointer ownership for input, X, reroll, Back, and choices | native child controls over one screen owner | exact-ported | stage wrapper declines hits; each semantic child owns only its bounds |

No member is browser-blocked. HTML supplies the semantic text bridge, but the
native bitmap renderer, width contract, and logical hit geometry remain exact.

### Native ownership thread and recovered contract

- Owner/construction: `CreateWizardMenu` constructs one `TextBox` and two
  independent edge Buttons. The TextBox owns its value, cursor/measurement,
  supported-glyph test, and clear subcontrol.
- Randomness: `0x00593C30` reads `data\\magenames.txt` and assigns one random
  entry during construction. It does not reroll on render/update. The Website
  may expose a clearly distinct local reroll convenience, but it uses the same
  complete table and cannot mutate a connected player.
- Width/input: native acceptance uses measured group-4 advance plus kerning and
  rejects a candidate beyond `372.0` pixels. The 64-character network maximum
  is a later transport boundary, not the Create field's input contract.
- Hit order: the full fixed stage is layout only. The input, X, browser reroll,
  Back, elements, and disciplines alone accept pointers. A semantic wrapper may
  not cover or intercept sibling native controls.
- Lifecycle: a fresh New Game creates a new draft exactly once; element and
  discipline transitions preserve it; a failed connection preserves it for
  retry; leaving Create discards it; retained loadout reads the authoritative
  connected config and remains readonly.
- Render/resource lifetime: changing a draft replaces the current name sprites
  without leaking removed Pixi children or recreating duplicate glyph textures;
  scene teardown destroys the finite glyph-texture cache once.

### Nearby-system findings

- Durable finding: the previous `PauseMenu_Render` name for `0x0058EA50` is a
  cross-class symbol collision. On `CreateWizardMenu` vtable slot `+0x10`, the
  function is the registered-control callback for the dice and pause/back
  Buttons.
- Native report also updated:
  `Mod Loader/docs/reverse-engineering/native-presentation-ui-fonts-and-loader.md`
  now records the TextBox, its width/filter/clear behavior, and the distinct
  dice action.

### Confidence and open questions

- Confirmed: native TextBox/Button membership, construction-only name draw,
  clear ownership, 372-pixel width, supported-glyph gate, dice non-name action,
  browser pointer interception, and browser draft lifecycle defects.
- Inferred: none used by the implementation.
- Unknown: the whole-wizard selection result after the stock dice clears both
  phase bytes belongs to the broader Create selection/finalization system; it
  does not affect or authorize the browser name-only reroll.

### Web implementation consequence and validation contract

- Keep the existing `MainMenuScene` draft owner, but remove its mount-time
  second anonymous draw and explicitly create a fresh draft only on a successful
  fresh New Game entry or a real account-identity change before touch.
- Validate native font support and measured width before changing the draft;
  bound account-derived seeds to the same 372-pixel lane.
- Let the full name stage keep `pointer-events:none`; opt the input, X, and
  browser reroll children into pointer ownership individually.
- Keep the name-only reroll beside and visually subordinate to the X: no panel,
  border, radius, or box shadow, only the native art's subtle sprite shadow.
  Do not reassign the stock top-right dice artwork or semantics.
- Focused tests must cover glyph membership, measured widths at/beyond 372,
  a single anonymous initialization, fresh-entry reset, failed-retry retention,
  child-only pointer ownership, clear, and stock-table reroll bounds.
- Browser acceptance must click Back without force, re-enter with a new draft,
  exercise edit/X/reroll, complete element/discipline startup with the submitted
  name, inspect control bounds/style, and record zero page/console errors at
  `1600 x 900` plus a non-native viewport.

### Implementation validation receipt

- Implementation: `MainMenuScene.tsx` now creates the draft only when Create
  is entered, resets it after each successful fresh New Game preparation, and
  retains it only across element/discipline selection or a failed connection.
  `create-wizard-name.ts` ports the native `372.0`-pixel advance/kerning limit
  and bounds account-derived seeds to it. `CreateMenuScene.tsx` exposes actual
  validity without marking a retained valid value invalid after a rejected
  keystroke. `main-menu.css` restores child-only pointer ownership and replaces
  the boxed reroll with a transparent, borderless 42-by-30 native-art control
  centred under the X. `create-menu-renderer.ts` destroys replaced sprites and
  reuses a finite per-glyph texture cache rather than allocating textures on
  every edit. `smoke-game-runtime.mjs` now covers Back/re-entry, clear, and
  stock-table reroll before its existing first-session handoff.
- Focused proof: the Create/menu suites passed 13/13, including complete font
  and name-table membership, the exact `243`-pixel `HELVIDIUS` advance, accepted
  `363`-pixel and rejected `396`-pixel boundaries, fresh-draft source ownership,
  and child-only hit ownership. TypeScript, lint, and the game architecture
  boundary check passed; the only lint output was the repository's existing
  Fast Refresh warnings.
- Canonical gate: `./scripts/validate.sh` exited 0 on the final combined tree
  based directly on Website `origin/main` `f950d90`. It passed 25 backend
  contracts, 40 loot tests, every prerequisite and broad game/frontend suite
  (including the concurrently landed weather coverage), the 5 level-up, 6
  diagnostics, 14 Hub UI, and 5 desktop tests, both production builds, the
  game bundle budget (`234342` raw / `68752` gzip bytes), and production media
  policy. The final receipt paragraph is documentation-only and was appended
  after that exact code gate.
- Browser proof: Chrome `150.0.7871.124` at `1600 x 900` produced initial stock
  `Picens`, rerolled to stock `Frontinus`, accepted the X clear, rejected an
  unsupported character and an over-width twelfth `A`, clicked Back without
  force, and re-entered with fresh stock `Anicius`. Clear and reroll centres
  both measured `x=973`; the reroll computed transparent background, zero
  border/radius, and no box shadow. At `844 x 390` the two centres remained
  aligned and the reroll remained clickable. Fire/Arcane startup emitted
  `client-hello.character.displayName = "SolonSolus"`; page and console error
  lists were empty. Captures:
  `/tmp/solomon-wizard-name-review-after-1600.png` and
  `/tmp/solomon-wizard-name-review-after-mobile.png`.
- Remaining scope: the stock top-right dice's whole-wizard finalization result
  remains owned by the broader Create selection system and was not reassigned
  to name reroll. There are no browser-platform-blocked name-system members and
  no live connected-player rename path.
