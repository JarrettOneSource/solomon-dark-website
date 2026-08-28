# 2026-08-28 — Browser Title exit removal and bottom-right external controls

## Reported smell and parity question

- Reported web behavior: the Title-screen Quit control is useless and should be
  removed. The existing Discord icon should move from the bottom-left corner to
  sit beside Fullscreen on the menu.
- Current web reproduction at `36b14062`: the semantic Quit `MenuButton` has no
  `onClick` callback, so pointer or keyboard activation can animate it and play
  the click cue but cannot transition, navigate, or close anything. Pixi still
  paints a dedicated Quit stage and startup still loads its three exclusive
  rasters.
- Stock behavior to preserve: the four native root plaques, four Play submenu
  plaques, Title animation, revision, account identity, prompt precedence, and
  Fullscreen lifecycle remain unchanged. This is an explicit browser product
  adaptation of the separate native desktop Quit member.
- Falsifiers: any Quit semantic or painted member remains; a quit-only raster
  remains in startup readiness; Discord appears outside the unobstructed root,
  no longer opens the exact invite, overlaps Fullscreen, or loses its coarse
  pointer target; or Fullscreen changes behavior on any other scene.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Product direction | explicit user request, 2026-08-28 | Remove the useless web Quit control and place the Discord icon beside Fullscreen on the menu. | authoritative |
| Existing native evidence | retail `SolomonDark.exe` 0.72.5, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `MainMenu_Render` `0x00598780`; `ui-engine-system-map.md`; `ui-automation-inventory.md` | Native Title paints a separate `quit` member in addition to its root and Play rows. The Loader observes that exact control, while the safe semantic action catalog exposes the seven non-exit menu actions. | high |
| Current web causal trace | `MainMenuScene.tsx`, `renderer/title-menu-renderer.ts`, `main-menu.css`, `lib/assets.ts` at `36b14062` | Quit crosses the action union, semantic overlay, hover/press state, right-bottom stage, compact painter branch, CSS geometry, and three title startup assets, but owns no action callback. | high |
| Prior Website decision | 2026-08-27 Title Discord navigation entry and candidate `ee36a83e` | Discord is Website chrome, root-only, uses `icons.svg#discord-icon`, opens `https://discord.gg/HGHxZgyM2p`, and already has pointer/keyboard and 44-pixel touch proof. Only its edge placement changes here. | high |
| Existing Fullscreen owner | `GameFullscreenButton.tsx`, `game-fullscreen.ts`, root/play scene CSS branches | Fullscreen owns its capability, state, errors/help, and persistent cross-scene lifecycle independently of native Title actions. | high |

## System boundary and membership inventory

System: **Title exit and external edge-control ownership** — every web member
that paints, loads, hit-tests, animates, or positions Quit, plus the root-only
Discord and persistent Fullscreen controls that consume the freed bottom-right
edge lane.

| Member / branch | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Play, Explore, Settings, Hall plaques | native root rows; `0x00598780` | `verified-already-at-parity` | renderer and semantic root retain exactly four rows |
| Last Game, New Game, Join Party, Back plaques | native Play submenu plus Website Join Party adaptation | `verified-already-at-parity` | renderer and semantic submenu retain exactly four rows |
| native desktop Quit member | `0x00598780`; exact observed `quit` control | `out-of-system` (explicit browser product removal) | no web presentation or semantic action remains |
| `TitleMenuAction` Quit state | Website renderer/input union | `out-of-system` (dead browser state) | union, hover, and press membership removed |
| semantic Quit hit target | `MainMenuScene.tsx` right-bottom native stage | `out-of-system` (no web action) | no accessible/button hit target or click cue remains |
| Pixi Quit stage and compact painter | `title-menu-renderer.ts` | `out-of-system` (no presented member) | no stage, button view, compact chrome branch, dataset, or viewport anchor remains |
| quit-only runtime assets | `mainMenu.quitCorner`, `quitRail`, `text.quit` | `out-of-system` (not loaded by Website runtime) | imports and `TITLE_GAME_ASSET_SOURCES` membership removed; extractor outputs remain as dormant native evidence |
| Discord invite and glyph | existing Website chrome | `exact-ported` requested adaptation | exact URL/new-tab attributes, icon, click cue, focus, and root-only lifecycle retained |
| root bottom-right control group | Website edge chrome | `exact-ported` requested adaptation | Discord is immediately left of Fullscreen with an 8-pixel gap and shared bottom alignment |
| root prompt and Play/later scenes | Title scene state | `verified-already-at-parity` | Discord is absent; Fullscreen retains its existing scene-specific presence |
| fine-pointer targets | Website CSS | `exact-ported` requested adaptation | both controls are 34 by 34 CSS pixels and do not overlap |
| coarse-pointer targets and safe area | Website CSS/page inset | `verified-already-at-parity`, repositioned | both controls are 44 by 44 CSS pixels inside the safe-area-adjusted page |
| Fullscreen capability, active state, install help, errors, and cross-scene layout | `GameFullscreenButton`, `game-fullscreen.ts` | `verified-already-at-parity` | implementation logic unchanged; its message remains anchored to its own button |

No member is blocked by the browser platform because this is an explicit
product removal rather than an attempted emulation of desktop process exit.
This pass recovers no new retail fact, so Mod Loader reports and catalogs do
not require an update.

## Native ownership thread and recovered behavioral contract

- Native `MainMenu` owns the separately painted Quit record alongside the
  centered root/submenu rows. The Website currently mirrors its painter and
  hit target but never supplied an action producer.
- Website Discord and Fullscreen are external browser chrome. `MainMenuScene`
  owns whether the root-only Discord member exists; `GameFullscreenButton`
  continues to own capability and transition state.
- The bottom-right browser group owns only positioning, alignment, and gap.
  Fullscreen help/error remains positioned relative to the Fullscreen control,
  and Discord remains the first keyboard/painter member in the row.
- Title prompts, fades, Play submenu entry, later scenes, chat, Skill Book,
  Dark Cloud modals, College admission, orientation gating, and teardown retain
  their current visibility rules.
- There is no gameplay, network, replication, RNG, or persistent state.

## Confidence and open questions

- Confirmed: dead Quit callback path, complete web painter/input/asset
  membership, prior Discord lifecycle, Fullscreen owner, and all CSS scene
  branches that position or suppress the controls.
- Product adaptation: omit native desktop Quit rather than inventing browser
  navigation or a false close action.
- Unknown material to implementation: none.

## Web implementation consequence

- Remove Quit from the semantic scene, Pixi renderer, action union, compact
  button branch, viewport-stage dataset, CSS, and startup asset manifest.
- Introduce one browser edge-control position owner around the unchanged
  Fullscreen component. Render the root-only Discord anchor immediately before
  Fullscreen in that group.
- On root/play, use the bottom-right edge freed by Quit. Keep every other
  scene's Fullscreen placement and suppression behavior unchanged.

## Validation contract

- Focused source contract: no Quit action, semantic control, Pixi stage,
  compact painter, runtime asset member, or CSS lane remains; root and Play
  collections each retain four buttons.
- Layout contract: root renders a bottom-right flex group with Discord followed
  by Fullscreen, 8-pixel separation, aligned 34-pixel desktop targets, and
  aligned 44-pixel coarse targets. Discord remains absent from prompts, Play,
  and later scenes.
- Mac Chrome: at desktop and coarse-pointer landscape sizes, prove zero Quit
  pixels/hit targets; exact Discord/Fullscreen order, gap, and non-overlap;
  exact invite popup; Fullscreen enter/exit; prompt and Play lifecycle; and
  empty page, console, and failed-response arrays.
- Exact candidate must pass `/opt/homebrew/bin/bash ./scripts/validate.sh` on
  the Mac mini.

## Implementation validation receipt

- Implementation removes Quit from `MainMenuScene`, `TitleMenuAction`, the
  retained Pixi stage/button collection, compact chrome selection, viewport
  dataset, CSS hit lane, and `mainMenu` runtime asset graph. The three exact
  extracted Quit rasters remain only as dormant extractor-owned native
  evidence. `game-edge-controls` now owns the external-control position;
  Discord precedes the unchanged `GameFullscreenButton` in that flex row.
- Candidate `912fb8ec` was rebased onto then-current `origin/main`
  `6c8ac1940d6ff858b3183ec09073e7ed7c46eb72`. All nine tracked changed files
  were SHA-256-identical between the local branch and detached Mac worktree
  `/Users/jarrett/codex-acceptance/quit-discord-20260828-root/Website` before
  validation.
- Focused Mac proof used pinned Node `22.17.0`: TypeScript test compilation and
  the main-menu presentation, menu WebGL cutover, chat, and Tutorial suites
  passed `46/46`, including `browser title removes Quit and groups Discord
  beside Fullscreen`.
- The complete Mac gate passed on macOS `26.6.2` build `25G83`, arm64:
  `/opt/homebrew/bin/bash ./scripts/validate.sh` completed backend build with
  zero warnings/errors, all `28` Website/backend contracts, formatting and
  architecture checks, lint with the existing `18` warnings and zero errors,
  frontend suites including `314/314` pre-Boneyard and `1,729/1,729`
  Boneyard tests, Hub UI `86/86`, desktop `5/5`, production frontend/game-host
  builds, bundle budget, and media/CSP policy. `Game-DxpwHp2r.js` measured
  `257,551` raw / `77,889` gzip bytes. Gate-log SHA-256 is
  `457087eda36d9558c8671612259d5584b6042cceb3cff1bf58c7d3beab59bc08`;
  the production asset directory contains no Quit-named asset.
- Mac Chrome `151.0.7922.174` passed the built desktop `1600 x 900` and
  coarse-pointer `896 x 414` journeys. Desktop measured Discord
  `(1516,858,34,34)` and Fullscreen `(1558,858,34,34)`; coarse measured
  `(792,362,44,44)` and `(844,362,44,44)`. Both have exact 8-pixel separation,
  shared bottom alignment/inset, correct DOM and hit-test order, four root
  actions, no Quit action or canvas stage, and topmost targets. The tutorial
  prompt hid Discord, Play hid it, Back restored it, the exact invite opened,
  and Fullscreen entered/exited with no page, console, or failed-response
  errors. Browser-log SHA-256 is
  `6ec67913c301d9d03b2f55e9910027981d0f7d7ca33a9cab1044e09aba14e7ad`.
- Reviewed screenshots are retained at
  `/Users/jarrett/codex-acceptance/quit-discord-20260828-root/browser-evidence/title-edge-controls-desktop.png`
  (SHA-256 `ae3e9ef38deef24ea4d0543fe8dd7f54012d6953d2c937fa034af4f1c0ec1837`)
  and `title-edge-controls-coarse.png` (SHA-256
  `8ca62f0930137f4f35608e79b2584f202713057eff188ea3ccd8e3f05e8f8cdd`).
  Visual inspection confirms the compact blue Discord icon immediately left
  of the gold Fullscreen control and no bottom-right Quit art.
- Final current-main integration: `origin/main` advanced through starter-color
  restoration and chat/gold-ledger composition while acceptance ran. The task
  was rebased again onto `2fefff009c8580f84d7b09638701e7c3fbe15587`;
  `MainMenuScene` retains the new native-stage/gold inputs while removing only
  Quit, and `game-chat.test.ts` retains both the new gold-clearance contract and
  the renamed external-control suppression owner. Validated candidate
  `a7bc502c1fd4323f7fc7e1836b241e803513916b` had tree
  `6d5d9b3f8e4b26f2d12001417a323b65b3bc94aa`; all nine changed-file hashes
  matched detached Mac worktree `Website-final`.
- Final focused Mac proof passed TypeScript plus `47/47` menu/chat/Tutorial
  contracts. The repeated canonical gate passed all `28` backend contracts,
  lint with `18` existing warnings and zero errors, `314/314` pre-Boneyard,
  `1,730/1,730` Boneyard, Hub UI `86/86`, desktop `5/5`, builds, bundle budget,
  and media/CSP policy. `Game-BGoxqJJe.js` measured `257,825` raw / `78,012`
  gzip bytes. Final gate-log SHA-256 is
  `3692a08790a965f949aea1b4016e553dc96674d89b71c648fad4ba3a68b90615`.
- Final built Chrome repeated the same desktop/coarse geometry, popup,
  Fullscreen, prompt, Play/Back, absence, hit-test, and error-free contracts on
  the rebased tree. Log SHA-256 is
  `cba4770be6097f4814e814cdf24fcd20f8861e447ad2260343ad8d6502e00fe9`.
  Reviewed final screenshot SHA-256 values are
  `e8fdd6744714883573c8f81a80f90421f23c01c26515b190ce1391b8c4d3597c`
  (desktop) and
  `9cf51717c07b823d5a41342cf6ff8ec66c06a86906e7d3933a76c8d54433a51f`
  (coarse).
- Browser constraints, inferred implementation facts, and remaining in-system
  omissions: none. This final addendum is the sole post-final-gate tracked
  edit; source and test bytes are unchanged from the validated tree.
  Publication and deployment were not requested and were not performed.
