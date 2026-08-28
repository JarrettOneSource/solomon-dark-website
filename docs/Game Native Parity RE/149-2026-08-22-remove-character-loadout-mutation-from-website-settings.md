# 2026-08-22 — Remove character loadout mutation from Website Settings

## Reported smell and parity question

- Reported web behavior: gameplay `GAME SETTINGS` contains a `SPELL LOADOUT`
  group with `SELECT PRIMARY ATTACK` and `SELECT CONCENTRATION` child pages.
- Product correction: character-build choices must not be exposed from the
  Website Settings menu. The 2026-08-23 native correction additionally proves
  the selected-skill HUD is the in-run compact-selector owner; SkillScreen keeps
  its category-1 card action, and Create remains the new-character owner.
- Reproduction scope: title, Dark Cloud, and gameplay Settings roots; gameplay
  pause ownership; primary and concentration actions; learned-skill state;
  Settings close/resume; and the separate Skill Book and Create surfaces.
- Falsifiers: either loadout label or child route remains reachable from
  Settings; Settings still receives player progression or mutation callbacks;
  removing the rows also removes Skill Book selection, protocol mutation, or
  Create/loadout behavior; or closing Settings changes pause lifecycle.
- Reopened-system correction as understood on 2026-08-22: removing the web
  `SPELL LOADOUT` group was correct. The 2026-08-23 selected-HUD trace supersedes
  the rationale: the two rows were never native Settings members; Game HUD
  controls had been assigned to the wrong owner.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing retail RE, corrected 2026-08-23 | Solomon Dark 0.72.5, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Game vslot `+0x10 -> 0x005D8120`; MyCPanel vslot `+0x10 -> 0x00434C60`; corrected `../Mod Loader/docs/reverse-engineering/native-settings-system.md` and `native-skill-screen-and-quickbar.md` | Stock exposes primary and concentration `Skills_Quickbar` actions from selected-skill HUD buttons, never from Settings. | high |
| Product direction | user correction, 2026-08-22 | The Website Settings menu must contain no loadout options. | authoritative |
| Website causal trace | Website `origin/main` `05c73e43`; `GameSettingsDialog.tsx`, `MainMenuScene.tsx`, `main-menu.css`, `pause-menu-contract.test.ts`, `smoke-game-pause.mjs` | Only the gameplay invocation supplies progression and selection callbacks. That enables one root group, two child-page variants, the selector renderer/icon dependency, selector-only CSS, a positive source contract, and a browser mutation journey. | high |
| Adjacent Website owner | `SkillBook.tsx`, `skill-book.test.ts`, `MainMenuScene.tsx`, `GameClientSession` | The Skill Book independently renders learned primary/concentration actions and submits the same authoritative session mutations; Create independently owns initial character loadout. | high |

At this historical cutoff no new native fact was recorded. The 2026-08-23
selected-HUD entry supersedes that conclusion and updates the Mod Loader reports.

## System boundary and membership inventory

System: the Website Settings-to-player-progression integration. It starts at
the gameplay Settings invocation and ends at the two selector callbacks. Local
audio, video, controls, performance, developer settings, Settings modal/pause
lifecycle, Skill Book loadout mutation, quickbar actions, protocol handlers,
and Create character construction are adjacent systems rather than removal
targets.

| Member (class/variant/scene/branch) | Native/product source | Disposition | Proof |
| --- | --- | --- | --- |
| gameplay Settings `SPELL LOADOUT` root group | web-only mistaken integration; no native MyCPanel row | out-of-system (not a stock Settings member) | no group or action label in component/browser |
| primary Settings child page and learned category-1 rows | web-only page; actual native owner is Game HUD `+0x3AC` | out-of-system (Website Settings) | no page state, catalog traversal, icon, callback, or CSS path |
| concentration Settings child page, one-slot/Split Mind/Mind Chug branches | web-only page; actual native owners are Game HUD `+0x46C/+0x52C` | out-of-system (Website Settings) | no page state, catalog traversal, icon, callback, or CSS path |
| gameplay Settings progression/callback props | Website integration seam | out-of-system (Settings is local-preference-only) | invocation and props absent |
| title Settings | existing no-progression invocation | verified-already-at-parity | remains loadout-free and otherwise unchanged |
| Dark Cloud Settings | existing no-progression invocation | verified-already-at-parity | remains loadout-free and otherwise unchanged |
| gameplay pause hold, Done, and no-catch-up resume | existing Settings pause owner | verified-already-at-parity | browser journey retains frozen ticks and resume contract |
| Skill Book primary selection | `SkillBook` category-1 action | verified-already-at-parity | existing component/session path and regression coverage remain |
| Skill Book category-3 selection | `0x00674110 -> 0x005D5600` | verified-already-at-parity | retained as the native first-A/general replacement path |
| Create/new-character and retained-loadout screens | `CreateMenuScene` | out-of-system (separate construction/post-run owner) | no touched source or changed journey |
| quickbar bindings, progression state, and protocol mutations | shared runtime model | out-of-system (still consumed by Skill Book/gameplay) | no runtime/schema/session removal |
| persisted `GameSettings` record | local preference owner | verified-already-at-parity | contains no character-progression/loadout fields |

There are no `blocked-by-platform` members and no predicted visible browser
difference beyond the requested absence of the two Settings actions.

## Native ownership thread and corrected Website contract

- Stock `MyCPanel` owns the Settings modal lifetime; `0x005D9A50` authors its
  context-dependent rows. Game callback `0x005D8120` independently routes the
  selected-skill HUD and is not part of MyCPanel.
- Website `MainMenuScene` owns local Settings state and pause lifetime. Before
  this correction, its gameplay invocation also injected authoritative player
  progression and two session mutation functions into `GameSettingsDialog`.
- The corrected Website boundary ends Settings at local preferences. It never
  reads learned skills and never writes selected primary/concentration state.
- `SkillBook` retains native category-1 primary and category-3 general
  selection. The selected-skill HUD owns compact primary and addressed A/B
  selectors; Create and retained-loadout transitions remain independent.
- Entering child Controls/Performance pages and leaving gameplay Settings keep
  the existing suspension, focus, Back, and no-catch-up teardown semantics.

## Nearby-system findings

- The 2026-08-23 native reports correct this entry: the stock Settings rows do
  not exist. Removing the web rows was still correct, but it is native parity,
  not a Website product deviation.
- Selected primary/concentration fields in the progression comparison remain
  necessary for the Skill Book and HUD to react to authoritative snapshots;
  they must not be reverted with the Settings-only integration.
- Session mutation methods and protocol messages remain live consumers for the
  Skill Book. Removing them would exceed the requested surface and break the
  retained loadout system.

## Confidence and open questions

- Confirmed: every Website reference unique to the Settings selectors, every
  adjacent retained owner, and the unchanged native ownership/address thread.
- Unknown: none material. Product direction is authoritative even though it is
  intentionally narrower than stock Settings membership.

## Web implementation consequence

- Remove the progression and selection props from `GameSettingsDialog` and
  its gameplay invocation.
- Collapse `SettingsPage` back to `root | controls | performance`; remove the
  `SPELL LOADOUT` group, selector component, progression/catalog/icon imports,
  selector CSS, and selector-only browser fixture setup/screenshots.
- Delete the stale positive Settings-selector assertions while retaining the
  existing Skill Book ownership coverage; do not add absence-only tests.
- Keep all local settings, pause ownership, Skill Book, Create, quickbar,
  progression comparison, session, protocol, and persistence behavior intact.

## Validation contract

- The canonical type/build gate must compile the simplified Settings props and
  retain the existing Settings and Skill Book suites without adding an
  absence-only regression.
- Browser journey: exercise ordinary gameplay Settings, hold simulation ticks
  while open, close and resume without catch-up, and collect a visual capture
  plus page/console errors.
- Run the repository's supported `./scripts/validate.sh` gate on the exact
  final tree and repeat the affected browser acceptance on the Mac mini before
  publication.

## Implementation validation receipt

- `GameSettingsDialog.tsx` now owns local Settings preferences only. Its
  progression/catalog/icon imports, gameplay mutation props, primary and
  concentration page variants, `SPELL LOADOUT` group, selector renderer, and
  selector-only CSS are deleted. `MainMenuScene` no longer injects player
  progression or selection callbacks into either Settings invocation.
- The selector-only browser fixture setup and stale positive Settings-selector
  assertions were deleted. No absence-only regression was added. Existing
  Skill Book tests and runtime/session/protocol paths remain unchanged and
  continue to own primary and concentration selection.
- The final rebased tree passed the complete canonical `./scripts/validate.sh`
  gate uncontended on Apple M2: every backend, frontend, gameplay, weather,
  party, HUD, diagnostics, Hall, Hub UI, and desktop suite passed, followed by
  production builds, media policy, and bundle budget. A simultaneous Linux/Mac
  diagnostic had starved existing shared-Hub socket deadlines; the same broad
  suite and then the complete Mac gate passed alone, so no timeout or product
  behavior was changed.
- Mac mini acceptance used `Jarretts-Mac-mini.local`, arm64 macOS `26.6.2`,
  Node `22.17.0`, npm `10.9.2`, .NET `10.0.302`, and Chrome
  `151.0.7922.170`. The gameplay pause journey completed the live-Hub Settings
  handoff and Boneyard hold/resume paths; after the independently merged
  deployment-revision monitor, its dev server logged two expected missing
  `deployment.json` responses. Final browser acceptance therefore used the
  built production output, where the manifest exists: it returned `status: ok`,
  `errors: []`, and the exact root groups `SOUND AND MUSIC`, `VIDEO SETTINGS`,
  `CONTROLS`, `PERFORMANCE`, and `DEVELOPER`, with only `CUSTOMIZE KEYBOARD`
  and `TWEAK GAME` child actions.
- The inspected final Mac production capture shows those local preference
  groups followed by `DONE`; character loadout controls are no longer present.
  The task-owned receipt is
  `/tmp/solomon-dark-settings-final-production-mac.png`.
- There are no `blocked-by-platform` members or material unknowns. Deployment
  and production restart remain separate and were not requested.
