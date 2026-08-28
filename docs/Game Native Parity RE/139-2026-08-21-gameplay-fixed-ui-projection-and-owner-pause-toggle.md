# 2026-08-21 — Gameplay fixed-UI projection and owner pause toggle

## Reported smell and parity question

- Reported web behavior: Inventory and the gameplay Pause Menu do not own the
  complete display rectangle on larger screens. The authoritative pause also
  remains active when its owner presses Escape a second time.
- Stock behavior to preserve: InventoryScreen and SimpleMenu remain authored in
  the exact 1600 by 900 screen coordinate system with unchanged art, controls,
  timing, and hit geometry. They are modal screen surfaces, not world-camera
  children. Retail resumes only through `RESUME GAME`; a second `OPEN MENU`
  edge is excluded while SimpleMenu owns input.
- Reproduction inputs/scenes: Hub Inventory and owner Pause Menu at 1920 by
  1200, plus Hub/Boneyard, all trader modal siblings, owner/waiting pause views,
  large 16:9, wide, tall, stock, and downscaled browser rectangles.
- Falsifiers: if either modal intentionally inherits the expanded gameplay
  camera, if its semantic hit plane uses a different transform than its native
  canvas, if any sibling surface has a separate stage owner, or if a non-owner
  can release another player's pause, the proposed shared projection/toggle
  model is wrong.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Clean stock and instruction ledger | retail `SolomonDark.exe` 0.72.5, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; InventoryScreen owners `0x00561300`/`0x00562520`; Pause `0x0058EA50 -> 0x005ABF10 -> 0x005C5A00` | Both systems draw screen-space 1600 by 900 modal compositions. Pause dims the complete drawable backbuffer. | high |
| Native pause input trace | binding `0x00B3BCCC`, sampler `0x00429950`, modal exclusion `0x008203F0`, Game branch `0x005CB3D4..0x005CB42A` | Retail admits one opening edge, then excludes another edge until Resume/Settings/Leave returns from the modal. A second-Escape toggle is therefore a requested Website product deviation, not a stock-parity claim. | high |
| Current web causal trace | `MainMenuScene.tsx`, `HubScene.tsx`, `BoneyardScene.tsx`, `HubInventoryUi.tsx`, `GameplayPauseMenu.tsx`, `renderer/game-viewport.ts` at `757213943267b6ff634a7cfa6bdff0eef9d1595b` | MainMenu owns the correct fixed-stage transform. Pause applies it to its entire root, including the dim; Inventory is instead mounted inside the responsive world frame whose large-screen scale is capped at one. Neither component separates a display-sized modal backdrop from its transformed native stage. | high |
| Browser reproduction | Linux Chrome `150.0.7871.124`, local authenticated host, 1920 by 1200, `/tmp/solomon-large-ui-before-inventory-1920x1200.png` SHA-256 `88207e9ad1f66fd3a00897db730e9dee6c96cb6ad3a54c50ccd3d0c00384d055`, `/tmp/solomon-large-ui-before-pause-1920x1200.png` SHA-256 `f969a38e5960d47f6bbd30199c1aa30e4c08224325a840b24f79c1a873591b5a` | Inventory occupies only `(0,0)..(1600,900)` and exposes the moving Hub at right/bottom. Pause uses scale 1.2 at Y 60, so its native stage is 1920 by 1080 but the top/bottom 60-pixel world bands are outside the dim. A second Escape leaves the owner surface and host pause present. | high |

## System boundary and membership inventory

Native system: the fixed gameplay-UI projection begins at the display shell's
available rectangle, projects one exact 1600 by 900 modal composition through
the limiting-axis scale, keeps art and semantic input on that same transform,
and owns the otherwise uncovered display area. The requested owner Escape
toggle extends the existing authoritative pause state machine without changing
its multiplayer authority or fixed-tick suspension.

| Member (surface/scene/branch) | Native source | Disposition | Proof required |
| --- | --- | --- | --- |
| standalone InventoryScreen in Hub | `0x00561300`, `0x00562520` and full inventory renderer membership | `exact-ported` | large/tall/stock geometry, black display ownership, canvas/action transform equality |
| standalone InventoryScreen in active Boneyard | same InventoryScreen owners | `exact-ported` | same geometry and interaction receipt in the run scene |
| Fomentius service plus companion InventoryScreen | `0x00514A20`, `0x0056F760` | `exact-ported` | shared projection and immediately interactive companion inventory |
| Hagatha service plus companion InventoryScreen | same service/companion owner; perk branch | `exact-ported` | shared projection without changing perk interaction |
| Luthacus service/storage plus companion InventoryScreen | same service/companion owner; storage branch | `exact-ported` | shared projection and scaled drag/drop coordinates |
| Shlorio dowsing service plus companion InventoryScreen and message box | same service owner; dowsing/message branches | `exact-ported` | shared projection, notice and action geometry |
| all four trader dialogue surfaces | InventoryScreen modal stage shared by `HubInventoryUi` | `exact-ported` | shared projection and unchanged dialogue lifecycle |
| inventory selection, double-activation, drag, equipment aliases, configured `I`/Escape close, and notices | native InventoryScreen semantic owners already catalogued in the 2026-08-15/16 entries | `exact-ported` | pointer coordinates invert the exact transformed native stage; focused tests retain every action branch and no false standalone `Done` control returns |
| owner Pause Menu in Hub | `0x0058EA50`, `0x005ABF10`, `0x005C5A00` | `exact-ported` for fixed projection; explicit product deviation for second-Escape Resume | full-display dim, transformed chrome/hit plane, frozen tick, toggle release |
| owner Pause Menu in active Boneyard | same pause owner | `exact-ported` for fixed projection; explicit product deviation for second-Escape Resume | same geometry, authority, freeze, and release in run scene |
| non-owner pause waiting surface in Hub/Boneyard | Website multiplayer extension | `exact-ported` | full-display dim/projection; Escape cannot release owner |
| first Escape / configurable open edge | `0x00B3BCCC`, `0x00429950` | `verified-already-at-parity` | non-repeat unmodified edge sends one pause intent |
| second unmodified Escape while local player owns Pause Menu | retail exclusion `0x008203F0`; user-required Website override | `out-of-system` (explicit product input policy: toggle authoritative pause off) | one native close animation, one owner resume intent, no catch-up |
| repeated or Alt/Ctrl/Meta-modified Escape while paused | browser input policy | `out-of-system` (reserved browser/OS chord protection) | no pause release |
| second Escape from a waiting/non-owner peer | Website authority extension | `exact-ported` | owner id and paused tick remain unchanged |
| Settings handoff and Escape/Done close | `0x0058EA50 -> 0x005A81A0` plus existing Website settings owner | `verified-already-at-parity` | still-held pause releases once when settings closes |
| Resume, Leave, owner disconnect, late join, party-scoped pause, and no-catch-up | existing authoritative pause system | `verified-already-at-parity` | existing host/client/smoke coverage remains green |
| SkillBook, level-up picker, Create, Title, Hall, loading, and Game Over fixed surfaces | separate fixed-screen owners | `out-of-system` (already consume the shell fixed-stage transform; no reported or reproduced defect) | absence/source contract prevents accidental coupling |
| responsive Hub/Boneyard camera and ordinary HUD | Region/camera/HUD owners | `out-of-system` (world remains expanded at native scale on large screens) | camera dimensions and HUD anchors remain unchanged beneath modal |

No member is blocked by the browser platform.

## Native ownership thread and recovered behavioral contract

- Owner and construction path: `MainMenuScene` is the web display shell and
  already owns one `FixedGameViewportLayout`. Hub/Boneyard own expanded world
  camera frames. InventoryScreen and SimpleMenu are modal screen-space
  consumers and must receive the shell projection as siblings above those
  frames, never infer it from camera size.
- State representation: native composition remains exactly 1600 by 900. For
  available display `(w,h)`, `s=min(w/1600,h/900)`; stage origin is
  `((w-1600s)/2,(h-900s)/2)`. The modal backdrop owns all `(0,0)..(w,h)`;
  Inventory uses black outside the native stage and Pause uses the recovered
  `reveal*0.85` dim across the full display.
- Render/input order: retained world, full-display modal backdrop, transformed
  native canvas, then semantic actions transformed with that same stage. Drag
  inversion uses the inner stage rectangle, so visual pixels and hit/drop
  coordinates remain one coordinate system at every scale and offset.
- Pause transitions: first valid edge requests host pause. While the local
  player remains authoritative owner, a second unmodified non-repeat Escape
  selects the existing Resume close path, including the recovered 20-tick
  close and owner-only host release. Waiting peers remain inert. Resume resets
  the next fixed-tick deadline and never catches up elapsed wall time.
- Entry/reset/teardown: modal close removes both backdrop and stage. Scene
  transitions, owner departure, settings close, session teardown, and party
  boundaries retain their existing pause/inventory owners.

## Nearby-system findings

- The large-screen world contract deliberately caps gameplay display scale at
  one so larger browsers expand camera field of view. Reusing that transform
  for modal UI is the causal defect; changing `gameViewportLayout` would enlarge
  the world/HUD and regress the responsive camera system.
- Pause appeared closer to correct because it consumed the shell fixed stage,
  but applying that transform to the dim itself made its uncovered aspect-axis
  bands visible. Inventory had the converse failure: its backdrop and native
  stage were both trapped inside the world-camera frame.
- No new reusable native fact was recovered beyond the already durable
  Inventory and pause reports, so the Mod Loader reports remain unchanged. The
  second-Escape behavior is intentionally documented only as Website product
  policy, leaving the native report truthful.

## Confidence and open questions

- Confirmed: stock screen-space ownership, exact 1600 by 900 coordinates,
  complete Inventory/trader and Pause membership, current web cause, 1920 by
  1200 failure geometry, native second-edge exclusion, and current host owner
  authority.
- Inferred: none used for native art, timing, or geometry.
- Unknown: none material. Browsers can express the required uniform transform,
  full-display backdrop, semantic coordinate inversion, and owner key edge.

## Web implementation consequence

- Keep `MainMenuScene` as the only display-policy owner and pass its existing
  fixed-stage style into Hub and Boneyard modal UI.
- Lift the shared `HubInventoryUi` overlay above each responsive native world
  frame. Give it a display-sized black owner and a transformed 1600 by 900
  inner stage containing both renderer and actions.
- Give `GameplayPauseMenu` a display-sized root/dim and a transformed 1600 by
  900 inner stage. Do not alter recovered pause art, reveal, pressed rows, or
  action rectangles.
- Route a qualifying owner Escape through the existing Resume close action.
  Do not add a second pause state, host protocol message, direct client toggle,
  timeout, or non-owner override.

## Validation contract

- Focused layout tests: lock shell-owned style propagation into both scenes,
  distinct display-overlay/native-stage ownership, complete sibling UI stage
  membership, and pointer inversion against the inner stage.
- Focused pause tests: owner Escape selects Resume once; repeat/modifier edges
  are ignored; waiting Escape is inert; existing art/timing/authority contracts
  remain unchanged.
- Browser journey: at 1920 by 1200 and 2560 by 1080, open Hub and Boneyard
  Inventory and Pause; assert full display coverage, exact limiting-axis stage
  scale/centering, identical canvas/action transforms, scaled drag/drop,
  configured-key standalone Inventory close, frozen tick, second-Escape
  release, no catch-up, and zero page/console errors. The journey must not
  reintroduce a semantic `Done` action for standalone Inventory; `Done` remains
  valid only in the native dialogue/service/settings owners that actually have
  one.
- Stock comparison: at 1600 by 900, screenshots and action rectangles remain
  pixel/geometry identical to the checked-in Inventory and Pause witnesses.
- Run the canonical Windows-native `./scripts/validate.sh` on the exact final
  tree.

## Implementation validation receipt

- `MainMenuScene` now supplies its single shell-owned fixed-stage transform to
  Hub and Boneyard. `HubInventoryUi` keeps its world-owned trader trigger in
  place but portals every Inventory/dialogue/service surface into a
  display-sized black overlay with one transformed native stage. Pointer/drag
  inversion remains bound to that inner stage rectangle. `GameplayPauseMenu`
  likewise separates its display-sized dim from its transformed native art and
  semantic actions. A clean owner Escape enters the existing Resume close
  path; repeat/modifier and waiting-peer edges remain inert.
- Focused red/green coverage passed all 18 Pause/Inventory contracts. The new
  rows lock both-scene shell-style propagation, display versus native-stage
  ownership, the complete shared Inventory/trader surface owner, inner-stage
  pointer inversion, full-display Pause dim, and qualifying owner Escape. The
  existing exact art, font, geometry, reveal/close, press, hover, action,
  inventory, equipment, trader, dowsing, and notice contracts remain green.
- The post-rebase Linux canonical gate passed backend integration `13/13`,
  Library `2/2`, loot `40/40`, prerequisites `158/158`, broad game
  `1050/1050`, parties `14/14`, level-up `5/5`, diagnostics `7/7`, Hall
  `15/15`, Hub UI `15/15`, desktop `5/5`, formatting/lint/boundaries,
  production builds, bundle budget (`276360` raw / `82873` gzip bytes), and
  media policy.
- The Windows-native canonical gate passed the same complete matrix on
  code-identical pre-receipt commit `9b6270c`, using Windows Node 22.17.0,
  pinned npm 10.9.2, Python 3.13.5, and portable .NET SDK 10.0.302. Its game
  entry was `276360` raw / `82874` gzip bytes. The first Windows attempt reached
  the frontend suites but exposed only a WSL-formatted disposable-worktree Git
  pointer; correcting that validation metadata made the exact unchanged asset
  test and full gate pass.
- The final Windows Chrome `151.0.7922.170` journey passed with empty page and
  console error arrays. At 1920 by 1200 it proved full-display Inventory and
  Pause roots, a centered 1920 by 1080 native stage at Y 60, identical
  canvas/action projection, and a real scaled Staff drag from equipment to the
  backpack and back. Repeat/Alt Escape left Pause held; a clean second Escape
  closed through Resume without catch-up. At 2560 by 1080 it proved the same
  1920 by 1080 stage centered at X 320 in Boneyard, owner and waiting views,
  constant paused world frames, owner-only release, late join, disconnect
  release, and existing Settings/Leave paths. Hub held at tick `2083`;
  Boneyard owner/peer holds were ticks `3380`/`3381`, and the journey ended at
  tick `3385`.
- Windows visual receipts are
  `solomon-large-ui-pause-inventory-1920x1200.png` SHA-256
  `695c3e3e6e2c560df9e91a657f6d1eb0e77c0324b1f7e8606415b97b9f594b4e`
  and `solomon-large-ui-pause-menu-1920x1200.png` SHA-256
  `f81481355a82717064831a8f3199b8df88f8e4d5ca900cfb9fed9a619fd3c4cd`
  under `C:/Users/User/AppData/Local/Temp`. The unchanged 1600 by 900 pause
  member/action journey and exact pressed-row captures also passed.
- The publication integration onto Website `origin/main` `762b6067` retained
  that complete UI implementation plus the independently published chat
  entry. The only cherry-pick conflict was the append-only parity ledger; both
  entries are preserved whole. The integration audit found that the new pause
  smoke had accidentally asked standalone Hub and Boneyard Inventory for the
  already-refuted semantic `Done` control. The product correctly exposed no
  such action. Both smoke branches now close through configured `I`, matching
  the settled 2026-08-21 unforge/Inventory contract, and wait for the frozen
  authority tick to advance before opening the next Pause owner. That explicit
  release boundary removes a fast-machine inter-owner race without a guessed
  delay; valid Settings `Done` remains unchanged. No product runtime code
  changed in this correction.
- The exact combined Linux tree passed the current canonical gate: `15/15`
  backend/contracts, `4/4` library, `43/43` loot, `226/226` prerequisite,
  `1274/1274` broad game, `29/29` party/chat, `11/11` level-up/HUD, `7/7`
  diagnostics, `17/17` Hall, `17/17` Hub UI, `5/5` desktop, production build,
  media policy, and bundle budget. `Game-DgqCErtD.js` was `393,218` raw /
  `109,998` gzip bytes.
- The corrected local Chrome acceptance then passed the complete Hub and
  Boneyard journey with empty page/console errors. It retained the exact
  1920-by-1200 and 2560-by-1080 projection assertions, scaled Staff
  round-trip, full-display pause dim, owner second-Escape resume, modifier and
  waiting-peer exclusion, Settings/Leave paths, disconnect release, and no
  catch-up. Hub held at tick `6798`; Boneyard owner/peer holds were `12257` /
  `12261`, and teardown reached tick `12304`. Inspected integration receipts
  are `/tmp/solomon-ui-projection-integrated-final-qEYdnF/large-hub-inventory.png`
  SHA-256 `04d9208201bc16f5b5aae69efccaec5316b763ab886cc06a7ed25687db44ba4c`
  and `large-hub-pause.png` SHA-256
  `08d3d765bbbade57803fada4610e01fce6793672d3c44440ca25782860ecccce`.
- No member is blocked by the browser platform and no unknown remains. No Mod
  Loader source/report changed because no new native fact was recovered. The
  integrated Website change is authorized for normal main publication;
  deployment remains unrequested and was not performed in this pass.
