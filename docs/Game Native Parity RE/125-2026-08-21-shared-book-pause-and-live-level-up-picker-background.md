# 2026-08-21 — Shared book pause and live level-up-picker background

## Reported smell and parity question

- InventoryScreen and SkillScreen currently block only their local player's
  browser input. In multiplayer, the authoritative world and every other
  participant continue advancing underneath either actor-owned book.
- The mandatory level-up SkillPicker already owns an authoritative no-tick
  barrier, but the web renderer additionally hides remote players, enemies,
  NPCs, spells, loot, weather, and auxiliary effects. The requested result is
  the complete frozen world still visible behind the picker.
- Reproduction membership is Inventory and SkillScreen entry, replacement,
  close, interruption, owner disconnect, late join, dedicated Hub/Boneyard,
  shared Hub, party Boneyard, and SkillPicker in Hub courtyard, every private
  room, and Boneyard.
- Falsifiers are a client-local pause boolean, an owner book disabled by its
  own pause acknowledgement, an ESC menu covering the owner book, a close
  releasing another surface's hold, one world continuing for a peer, a shared
  Hub pause freezing unrelated Boneyard instances, or any dynamic renderer
  family remaining hidden behind SkillPicker.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing native RE | retail Beta `0.72.5` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Inventory `0x005C6F10`; Skills `0x005CA640`; SkillPicker `0x0066F920`/`0x0067CAC0`; nesting owner `0x005CBD40` | InventoryScreen and SkillScreen are optional actor-owned modal roots; the level-up picker is a mandatory gameplay barrier. Retail supplies no multi-client authority policy. | high |
| Existing Website pause closure | protocol 45; `game-host.ts`; `game-client-session.ts`; `GameplayPauseMenu.tsx`; `shared-game-worlds.ts` | one authenticated first-request owner already freezes a dedicated world or party Boneyard, clears all inputs, survives late join, releases on owner close/disconnect, and resets the tick deadline without catch-up | high |
| Current modal causal trace | `MainMenuScene.tsx`, Hub/Boneyard scenes, `HubInventoryUi`, `SkillBook` | book ownership is split between scene-local Inventory state and root SkillBook state; both block local input but neither acquires the host pause lane | high |
| Current renderer membership sweep | `hub-world-scene.ts`, `hub-private-room-scene.ts`, `boneyard-world-renderer.ts`, `level-up-presentation.ts` | `modalActive` deliberately suppresses every dynamic family except the local player and level-up effect; static scenery alone remains visible | high |

This pass reuses settled native evidence and changes Website multiplayer and
presentation policy. It recovers no new retail address, table, or reusable
asset fact, so no Mod Loader report receives a duplicate web-only policy.

## System boundary and membership inventory

Native/web system: actor modal nesting joined to the existing authoritative
world-instance pause barrier, plus the complete SkillPicker background
render-membership policy. Simulation, item/skill mutation, picker choice, and
the ordinary authored ESC pause-menu renderer remain owned by their existing
systems.

| Member | Owner/source | Disposition | Proof contract |
| --- | --- | --- | --- |
| ESC Gameplay Pause Menu | native SimpleMenu pause owner; existing Website pause lane | verified-already-at-parity | unchanged menu owner/waiting journeys |
| InventoryScreen open, interaction, replace, close | actor Inventory owner `0x005C6F10` | exact-ported with explicit web multiplayer adaptation | source-qualified pause lifecycle and item-action journey |
| SkillScreen open, interaction, replace, close | actor SkillScreen owner `0x005CA640` | exact-ported with explicit web multiplayer adaptation | source-qualified pause lifecycle and quickbar action journey |
| dedicated Hub world | existing singleton host simulation | exact-ported | two-client tick/world freeze and resume |
| dedicated Boneyard world | existing singleton host simulation | exact-ported | two-client enemy/player/world freeze and resume |
| shared Hub residents | shared Hub singleton simulation | exact-ported with explicit web multiplayer adaptation | one book freezes all Hub residents while party Boneyard instances continue |
| shared party Boneyard | party-scoped run simulation | exact-ported | one book freezes every party member while shared Hub and other runs continue |
| first-request ownership and foreign release | existing GameplayPauseState owner | verified-already-at-parity | second request/release cannot steal owner |
| owner disconnect, world exit, loading, level-up interruption | host/root lifecycle | exact-ported | balanced release and no orphan hold |
| late join/reconnect projection | welcome `gameplayPause` state | exact-ported | source and owner survive welcome round trip |
| owner book interactivity while paused | MainMenuScene/scene modal coordination | exact-ported | owner can mutate and close; world input remains stopped |
| peer presentation for book pause | GameplayPauseMenu waiting branch | exact-ported | peer sees owner waiting text; no peer book or ESC actions |
| Hub courtyard players, students, NPCs, fountain, primary/secondary effects, nameplates | `HubWorldScene`/`HubWorldRenderer` | exact-ported to requested live background | every family remains renderable during picker |
| Hub private-room players, NPCs, flames, memorial glows, primary/secondary effects, nameplates | `HubPrivateRoomScene`/`HubWorldRenderer` | exact-ported to requested live background | every family remains renderable during picker |
| Boneyard local/remote players, enemies, death/projectile/lightning effects, maggots, loot, Goodies, spells, Solomon, death weapons/bursts, weather, nameplates | `BoneyardWorldScene`/renderer | exact-ported to requested live background | complete renderability contract and Chrome capture |
| level-up owner sparkle/light and SkillPicker curtain/panels | native level-up presentation and picker renderer | verified-already-at-parity | existing timing/geometry/audio tests remain green |
| title, Create, loading, Game Over, loadout | outside book admission phases | out-of-system (no Inventory/SkillScreen producer) | strict client/host phase gates |
| trader companion inventory | separately owned NPC service modal | out-of-system (not the player backpack/SkillScreen request) | existing trader surface boundary |

No member is blocked by the browser platform. Pausing every web multiplayer
world participant for an optional actor book is an explicit requested web
adaptation: retail has no remote-player authority model to mirror.

## Ownership thread and recovered contract

- `MainMenuScene` owns the cross-scene modal intent and requests one of three
  source identities: `pause-menu`, `inventory`, or `skill-book`. Protocol 47
  carries that identity in both request and authoritative pause state.
- The host remains first-request authoritative. A dedicated host has one pause;
  a shared host has one shared-Hub pause plus one per party-run pause. A shared
  Hub pause stops only the Hub tick; independent Boneyard runs continue. A
  party-run pause stops only that run; the Hub and sibling runs continue.
- Inventory-to-Skills and Skills-to-Inventory replacement changes the source
  while retaining the same owner's barrier. Closing the final book releases
  it. Foreign clients cannot change or release the hold. Owner disconnect and
  teardown release the correct world instance.
- The owner keeps its matching Inventory/SkillScreen mounted and enabled after
  the pause acknowledgement. Other clients render only the existing waiting
  pause presentation. The authored ESC pause menu appears only for a
  `pause-menu` source.
- SkillPicker continues to stop authoritative simulation through
  `levelUpBarrier`. Presentation loops keep sampling the frozen snapshot and
  render every resident/effect family behind the existing curtain, panels,
  and level-up owner effect. No renderer infers simulation progress.
- Source changes and releases are edges, never frame polling. Input is cleared
  on acquisition/release, elapsed wall time never becomes catch-up ticks, and
  save/Lua/ping/transport policy follows the existing pause boundary.

## Web implementation consequence and validation contract

- Extend the existing pause protocol rather than create a second book-pause
  boolean or host barrier. The concurrent leaderboard contract already owns
  protocol 46, so the combined incompatible schema advances to protocol 47.
- Lift Inventory surface ownership to the root through a scene callback, so
  root modal state can acquire, replace, and release the host hold without
  disabling the owner's current book.
- Remove every `modalActive` renderability suppression in courtyard, private
  rooms, and Boneyard while retaining the level-up presentation state needed
  for the sparkle/light and picker lifecycle.
- Focused tests must cover strict source decoding, all three sources, source
  replacement, foreign denial, dedicated and shared-world freeze partitioning,
  disconnect/late-join state, owner/peer presentation, every scene book path,
  and every enumerated renderer family.
- The exact final tree must pass `./scripts/validate.sh`. Mac mini and Windows
  production Chrome journeys must prove two-player book pause/resume, constant
  authoritative tick/world state, enabled owner actions, peer waiting UI,
  fully rendered enemies/world behind SkillPicker, and empty page/console
  errors.

## Implementation and verification receipt

- Protocol 47 adds the strict `pause-menu`, `inventory`, and `skill-book`
  source identity beside the concurrent leaderboard-authority members. The
  client permits only its own source replacement/release; the host preserves
  first-request ownership and clears all world inputs on acquire and release.
- `MainMenuScene` now joins the scene-local Inventory root and root SkillScreen
  to that one pause lane. Inventory-to-Skills replacement publishes
  `inventory -> skill-book` without an intervening resume. The matching owner
  modal remains enabled while its world is frozen; peers receive a source-aware
  waiting view; ordinary ESC pause/settings behavior is unchanged.
- Dedicated Hub/Boneyard retain one complete-world barrier. The shared host
  now owns one shared-Hub barrier and one barrier per party run: all residents
  of the addressed world pause together, while the Hub and unrelated runs
  continue independently. Owner disconnect and late join use the same scoped
  state. Inventory mutations are admitted only for the matching owner and
  `consume`/`equip`/`unequip`; SkillScreen mutations use the addressed shared
  world rather than the process Hub state.
- Courtyard, private-room, and Boneyard renderers no longer change any actor,
  NPC, enemy, projectile, spell, loot, Goodie, death-effect, weather, light, or
  nameplate renderability for SkillPicker. The existing authoritative
  `levelUpBarrier` still freezes simulation; painter traversal consumes the
  frozen snapshot behind the picker and level-up effect.
- This requested web multiplayer/presentation policy explicitly supersedes
  the 2026-08-20 web dispositions that kept optional books local-only and hid
  dynamic picker members. The retail evidence recorded there remains valid;
  retail has no remote-client policy, so this is a named web adaptation rather
  than a newly claimed native fact.
- The exact code tree rebased on Website `origin/main` `1cf60d2` passed the
  complete supported `./scripts/validate.sh` gate on Apple M2/macOS `26.4.1`
  with Node `22.17.0`, npm `10.9.2`, and .NET `10.0.302`: `13/13` backend
  contracts, `41/41` loot, `216/216` prerequisites/save/skill, `1237/1237`
  broad game/frontend, `17/17` parties, `5/5` level-up, `7/7` diagnostics,
  `17/17` Hall, `15/15` Hub UI, `5/5` desktop, production build, bundle budget,
  and media policy. Only the eight existing Fast Refresh warnings remained.
  The production game entry is `346562` raw / `97994` gzip bytes.
- Mac Chrome `151.0.7922.170` completed the two-player pause journey with the
  exact modal edge sequence `inventory -> skill-book -> null`, no intermediate
  resume, constant authoritative state across both owner screens, ordinary
  owner/peer Hub and Boneyard pause/resume, no catch-up, and empty page/console
  errors. Captures are `/tmp/solomon-book-pause-mac-inventory.png` SHA-256
  `18fb358b2a2c626b9ce29ed7d83ef9dc2a7e30d36098e2b6ef10a750dc0fa70f`
  and `/tmp/solomon-book-pause-mac-skills.png` SHA-256
  `8ee9549a4984bca12f2a8091e65d50aff1b806ae3e40d7f1d16a633fb83eb605`.
- Mac SkillPicker browser proof retained the Hub world/NPC membership with
  `dynamicSuppressed=false`, a live 49-particle level-up effect, and WebGL2.
  Its Boneyard continuation materialized one live Skeleton and proved
  `enemyCount=1`, `dynamicSuppressed=false`, Pixi WebGL, and empty browser
  errors while the settled picker remained topmost. The inspected capture is
  `/tmp/solomon-skill-picker-mac-boneyard-enemy-background.png` SHA-256
  `e20b14f602fb8c2e21fd09856235e904682dd19efe848f9be46409d7ac99085f`.
- Windows 10 Pro `10.0.19045` with Node `22.17.0`, npm `10.9.2`, and Chrome
  `151.0.7922.170` passed the production build at `346562` raw / `97993` gzip,
  the same Inventory-to-Skills shared-pause journey, and Hub plus Boneyard
  SkillPicker journeys. The Boneyard receipt again returned `enemyCount=1`,
  `dynamicSuppressed=false`, WebGL2, and empty browser errors. Inspected
  captures are under `C:/sdw/receipts/solomon-book-pause-windows-{inventory,skills}.png`
  and `solomon-skill-picker-windows-boneyard-enemy-background.png`.
- Focused host coverage proves dedicated and shared-Hub freezes, first owner,
  source replacement, owner Inventory mutation, late join, foreign denial,
  disconnect release, no catch-up, and independent party-run ticking. The
  complete render-membership test rejects every remaining `modalActive`
  suppression branch. No member is `blocked-by-platform` and no production
  deployment was performed.
