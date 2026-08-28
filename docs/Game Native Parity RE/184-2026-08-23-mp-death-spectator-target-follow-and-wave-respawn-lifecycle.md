# 2026-08-23 — MP death-spectator, target-follow, and wave-respawn lifecycle

## Reported smell and parity question

- Reported web behavior: the user asked to make sure the web port has
  spectating like the multiplayer mod.
- Reference behavior to recover: the shipped loader's complete connected-run
  death-spectator lifecycle, including its grace clock, client-local target
  selection and camera, product HUD, input arbitration, completed-wave
  same-player respawn, and all reset branches.
- Reproduction surface: a multiplayer Boneyard in which one eligible player
  dies while at least one peer remains alive, the selected peer later dies,
  and a wave completes before or after the local five-second presentation.
- Falsifiers: a HUD or camera before five seconds; a handoff at corpse frame
  159; a click that casts; lexically unstable selection; an immediate jump
  away from a selected dying target; a corpse surviving a completed wave; a
  living peer being healed or teleported by that boundary; stale HUD/camera or
  death equipment after respawn, all-dead Game Over, run replacement, or
  teardown.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail instructions and live traces | Mod Loader `docs/reverse-engineering/native-player-death-spectator.md`; retail `SolomonDark.exe` Beta 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Native death fields, terminal corpse tick 159, same-actor respawn inversion, Arena slot-0 spawn ownership, and presentation hazards are already recovered and live-corroborated. | high |
| MP runtime constants | `include/multiplayer_runtime_protocol.h:380-419` and `death_spectator_sync.inl:1-19,697-841` | One owner-authored grace is 5,000 ms; it scales to logical native ticks `0..298`, enters `Spectating` only at expiry, then selects/follows locally. | high |
| MP target/input lifecycle | `death_spectator_sync.inl:580-806` and `death_spectator_public.inl:81-106` | Candidates are living, connected, materialized same-run peers sorted by semantic ID. Either mouse edge advances/wraps. A selected target is held through its death presentation unless manually advanced. Empty selection clears focus and reports a waiting state. | high |
| MP product HUD | `lua_ui_renderer.cpp:75-123,271-328,501-621`; `[lua_ui_authoring]` in `config/binary-layout.ini` | Only `Spectating` registers the surface. Bounds are `(0.20,0.055,0.60,0.075)`; `UiPanel_Render` uses UI `10,79,107..110`; medium ExactText `Fonts.93..184` is gold `(1,0.9,0.55,1)` at panel offset `(18,20)`. | high |
| MP completed-wave respawn | `death_spectator_sync.inl:151-425` and `public_api_local_player_respawn.inl:1-414` | One host boundary restores only non-positive-HP run members at the live Arena slot-0 spawn, on the same actor/progression, with full HP/MP and cleared cast/death fields. Positive-HP peers and persistent progression/equipment remain untouched. | high |
| Current web audit | `player-combat.ts`, `game-simulation.ts`, `boneyard-render-contract.ts`, `boneyard-world-renderer.ts`, `BoneyardScene.tsx` on Website `a058a90a28ee1e7fa67b31f895d92ebebba7eff0` | Camera, sorted cycling, dying-target hold, click claim, waiting/status text, input rejection, run gates, and teardown exist. The authority changes `dying -> spectating` on the tick-159 burst (159 web ticks, about 1.59 s), and no completed-wave respawn consumer exists. The HTML HUD substitutes an OS font and synthetic panel despite already-extracted native UI/font records. | high |

## System boundary and membership inventory

Native/mod system: connected Boneyard participant death from the owner-authored
death epoch through grace presentation, local spectator ownership, a completed
wave or all-dead interruption, same-player restoration, and surface teardown.
The dispositions below are the required publication state and must be backed by
the implementation receipt before this entry is closed.

| Member (class/variant/scene/branch) | Native/mod source | Disposition | Proof contract |
| --- | --- | --- | --- |
| connected peer death entry and solo/all-dead bypass | `BeginLocalDeathSpectatorPresentation`; `RefreshHostRunGameOverCommand` | `exact-ported` | active run with a survivor stays in death presentation; all-dead goes directly to Game Over with no spectator surface |
| one five-second grace and logical clock `0..298` | `kParticipantDeathPresentationDurationMs`; `ResolveParticipantDeathPresentationTick` | `exact-ported` | 100 Hz age maps to the 60 Hz native clock, frame 3 crosses at 2.65 s, and handoff occurs only at 5.00 s |
| dead gameplay/cast authority | local/outgoing/incoming death guards | `verified-already-at-parity` | dead movement and primary/secondary casts remain inert; claimed spectator clicks never reach cast authority |
| first target, either-click next, stable sort, and wrap | `CollectAliveSpectatorTargetIds`; `SelectNextAliveSpectatorTarget` | `verified-already-at-parity` | zero/one/many living target tests plus real left/right browser clicks |
| selected target death-presentation hold and manual escape | `ShouldHoldCurrentSpectatorDeathPresentation` | `verified-already-at-parity` | lethal-pending and dying remain selected; manual click can leave; automatic retarget occurs only after the target presentation ends |
| exact-coordinate camera and empty-target fallback | `SetLocalCameraFocus`; `ClearLocalCameraFocus` | `verified-already-at-parity` | camera subject and focus equal the selected authoritative player sample; empty list returns to the local corpse/spawn fallback |
| player-facing status surface | `TryBuildDeathSpectatorStatusText`; `DrawSpectatorProductHud` | `exact-ported` | exact visibility phase, normalized rectangle, UI `10,79,107..110`, medium bitmap font, gold color, offset, target and waiting strings, and one accessible DOM surface |
| pending level-up input priority | `HasPendingLocalLevelUpChoice` branch | `verified-already-at-parity` | the existing mandatory modal blocks scene input and spectator cycling until it closes |
| completed-wave boundary and same-player respawn | `RefreshHostWaveRespawnCommand`; `TryRespawnWizardActorAt` | `exact-ported` | one Website `wave-threshold -> wave-lull-delay` completion restores only eligible non-positive-HP players at `BoneyardWorldState.spawn`, preserves identity/books/economy/equipment/heading, clears cast/corpse/status, and leaves living peers untouched |
| stale correction barrier | shared MP packet sequence after `wave_respawn_epoch` | `out-of-system` | the web has one host simulation and ordered snapshots, not independent vitals-correction and respawn packet lanes; no stale client write can cross the authoritative mutation |
| bots/synthetic participants | `TryRespawnHostOwnedSyntheticParticipantsAt` | `exact-ported` | bot and human run members share the same player-entity respawn path |
| wave respawn before grace expiry | organic 0.694-second loader trace | `exact-ported` | early boundary cancels dying state before HUD handoff and removes corpse/weapon views on the next snapshot |
| new run, respawn, disconnect, run end, renderer destroy | reset functions and camera owner teardown | `exact-ported` | camera/status target state clears at every lifecycle barrier with no late replay |
| optional Lua minimap recentering | `mods/lua_minimap/scripts/main.lua` | `out-of-system` | this is a consumer supplied by an optional loader Lua mod, not the core spectator product surface or a Website minimap |

## Native/mod ownership thread and recovered contract

- The authoritative player death epoch owns gameplay inertness and the scaled
  five-second presentation. The browser host advances it at 100 Hz but exposes
  the loader's 60 Hz logical death clock; renderer cadence cannot change the
  handoff.
- Spectator target ID is deliberately client-local presentation state. It is
  derived from the authoritative snapshot but is not sent back to or selected
  by the host.
- The target set excludes the local player and accepts only present, eligible,
  same-run `alive` peers. The stable Website player ID is the semantic sort key.
- Both primary and secondary mouse starts are claimed before cast state when
  local life is `spectating`. The existing modal input gate gives a pending
  level-up choice priority over that claim.
- A selected `lethal-pending` or `dying` participant remains the camera subject
  through its terminal corpse program. A manual click deliberately selects the
  next currently alive peer. Once the held target becomes `spectating`, normal
  automatic selection resumes.
- The Boneyard wave director owns its already-published completed-wave edge on
  `wave-threshold -> wave-lull-delay`. The centralized host applies the respawn
  in that same authoritative tick before all-dead arbitration. It mutates the
  existing player entity rather than creating a replacement.
- Respawn uses `world.spawn.x/y`, preserves heading and durable participant
  components, zeros locomotion/cast state, restores current HP/MP, clears the
  death clock and life state, and preserves the monotonic death epoch so a
  later death remains a distinct one-shot owner.
- All-dead Game Over outranks spectating. Its frozen Boneyard continues the
  terminal corpse clock but registers no spectator target or HUD.

## Nearby-system findings

- The existing Website conflated the one-shot tick-159 corpse burst with the
  spectator phase transition. They are separate clocks in the MP mod: tick 159
  is a presentation member, while five-second expiry owns camera/HUD handoff.
- `BoneyardWorldState.spawn` is already the exact loaded Boneyard spawn tuple;
  sampling a living player's current coordinate would repeat the loader's
  documented pre-fix respawn bug.
- The subsequently landed reusable native UI kit's `native-ui-assets.json`
  contains every spectator panel member and the exact `Fonts.93..184` medium
  font used by the loader's `+0x4D530` text object. No OS-font, legacy
  skill-picker manifest, or synthetic frame is necessary.
- No new reusable native fact was recovered in this pass, so the existing Mod
  Loader native report remains the authoritative native document and is cited
  rather than duplicated or edited.

## Confidence and open questions

- Confirmed: every ownership, timing, target, input, camera, HUD, wave boundary,
  same-player mutation, and teardown rule above.
- Inferred: the web's stable string player ID is the corresponding semantic
  ordering key because it has no numeric Steam participant ID lane.
- Unknown: none material. The ordered web snapshot transport eliminates the
  loader's cross-packet stale-correction race instead of approximating it.

## Web implementation consequence

- Add an internal 100 Hz death-age lane and derive the replicated/rendered
  logical death tick with the loader's `300 / 500` integer scale and 298 hold.
  Separate the tick-159 burst edge from the five-second spectator-ready edge.
- Keep camera target ownership in `boneyard-world-renderer.ts`; do not add a
  spectator message or host-selected camera target.
- Add a focused same-entity respawn operation in the player store and invoke it
  once on the authoritative scheduled-wave completion edge before Game Over
  evaluation.
- Replace the CSS/OS-font status approximation through the shared native UI
  catalog/asset/bitmap-text kit, using the extracted panel records and medium
  bitmap font while keeping one semantic `role=status` wrapper for
  accessibility and browser inspection.
- Remove no stock or Website Game Over behavior; all-dead remains the terminal
  run owner.

## Validation contract

- Kernel tests: exact age-to-native-tick samples, frame boundaries at 2.55,
  2.60, and 2.65 seconds, once-only burst, 5.00-second completion, held 298,
  reset, and later distinct death epoch.
- Store/simulation tests: burst and spectator edges are distinct; first death
  stays `dying` for 499 ticks; a living peer keeps the run active; wave
  completion respawns dead human/bot members once at the authored spawn while
  preserving durable component identity and leaving living peers untouched;
  all-dead never exposes the spectator surface.
- Presentation tests: zero/one/many candidates, stable initial order, both-click
  wrap, target-death hold/manual escape, waiting branch, lifecycle reset, exact
  panel/font membership, geometry, color, text, and accessible atomic surface.
- Mac Chrome: two real clients show no HUD during grace, then one native product
  HUD and exact target camera; both clicks are consumed; a forced authoritative
  wave-completion edge restores the dead owner on the same run and removes
  camera/HUD/corpse/weapon state; a later all-dead transition still reaches
  Game Over. Page, console, response, and request error arrays remain empty.
- The exact rebased tree must pass `/opt/homebrew/bin/bash ./scripts/validate.sh`
  and the focused multiplayer death/Game Over smoke on the Mac mini.

## Implementation validation receipt

- `PlayerCombatComponent` now retains a server-private 100 Hz death age and
  projects the MP mod's `floor(age * 300 / 500)` logical clock capped at 298.
  The tick-159 burst/collision edge and five-second spectator-ready edge are
  independent. Read-only combat helpers accept only the fields they consume,
  so the private age does not leak into protocol progression.
- `GameSimulationState` enters `spectating` only on the five-second completion
  edge. Its existing client-local sorted target/cycle/hold camera remains the
  sole target owner. `PlayerEntityStore` adds one same-entity respawn mutation;
  `wave-threshold -> wave-lull-delay` applies it before all-dead arbitration to
  eligible non-positive-HP members only. It restores HP/MP and exact authored
  X/Y, clears cast/velocity/death state, preserves heading/death epoch and all
  durable columns, and leaves living members untouched. An initial Mac gate
  caught and rejected a spread that also copied `facingDeg` into the position
  vector; the final constructor copies only `x` and `y`.
- The product HUD now consumes the shared native UI kit landed on current
  `main`: UI records `10,79,107..110`, the UI atlas source/catalog, and the
  `Fonts.93..184` medium `NativeBitmapText`. It retains normalized bounds
  `(0.20,0.055,0.60,0.075)`, text offset `(18,20)`, gold `0xffe68c`, exact
  double-space status copy, and one atomic accessible status owner. No member
  is browser-blocked.
- Functional commit `c30890766969b21d076fce53bedc4b73b0f7d527` was
  byte-identical across all 17 changed blobs in the clean detached Mac tree
  `/Users/jarrett/codex-acceptance/spectating-mp-parity-20260824-r4/website`,
  based on native-UI-kit `main` `28626260e1829c172832e2b83a1e7a2b45679f3f`.
  The Mac was Apple arm64 macOS `26.6.2`, Node `22.17.0`, npm `10.9.2`, .NET
  `10.0.302`, and Chrome `151.0.7922.170`.
- `/opt/homebrew/bin/bash ./scripts/validate.sh` passed on that exact tree:
  backend build zero warnings/errors and `21/21` contracts; formatting, lint
  with only the eight established warnings, architecture boundaries, all
  `2016/2016` frontend/desktop tests (including `1467/1467` Boneyard tests),
  production builds, media policy, and the Game bundle budget (`448703` raw /
  `125805` gzip). Gate-log SHA-256 is
  `0bdcf15b12bcaea8ed6f5090a8fc908794d6acb2ab72f2046847c5b6ce481234`.
- The strict two-context Mac Chrome journey exited zero with empty host/guest
  page and console arrays. The first death rendered frames `0,1,2,3`, reached
  `spectating` only at logical tick 298, focused exact `player-2` coordinates,
  rendered the six required panel records at the normalized rectangle, and
  consumed both mouse buttons without movement or mana change. Its forced
  authoritative wave completion restored death epoch 1 at exact spawn
  `(392.74249267578125,150)` with `50/100` HP/MP and removed HUD/camera/weapon
  state. A second distinct death reached all-dead Game Over with frames
  `0,1,2,3`, then both authenticated players returned to the same Hub.
  Smoke-log SHA-256 is
  `5ffece2f83244dab89ad5eceb612cd1044b4449e7fbce3c1c702fdeb19f74427`.
- Reviewed death, spectator, Game Over, loadout, and returned-Hub captures have
  SHA-256 values
  `7938c43feac44a3ef56590db2c28f6e2e3ef2bad77f5222b9fc09b5c60fcaec6`,
  `892bc6196ef295ff00f0ba888d877e8580cf337c4b9e40a9873e337931fb8681`,
  `200249dd018cfa21d67d213b4a8e64c5e50c5ca9f730b7abe68fbe8825976750`,
  `2c4c190fc38f4ad833ffbaca8893ff8ec9160f992eb914cc23c5580e17b1673d`,
  and `b4db1db0e7871218a1d6c7c96a98342fa5fdb6bc444392248b2b9fa26f69b47c`.
  Publication is authorized below; deployment/restart remains separate and
  was not requested.
