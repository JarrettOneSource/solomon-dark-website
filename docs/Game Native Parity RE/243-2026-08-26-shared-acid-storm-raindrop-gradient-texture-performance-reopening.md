# 2026-08-26 — Shared Acid/Storm raindrop-gradient texture performance reopening

## Reported smell and parity question

- A physical iPhone XR running iOS 18.7.6 at `896x364`, DPR 2, and WebGL held
  `60.00` FPS in the Hub and `58.31` FPS in an empty mode-2 Boneyard, then fell
  to `25.50` FPS while a clean Acid Rain cast was active. The Acid row had p95
  `54` ms, p99 `70` ms, maximum `178` ms, 175 secondary actors, 222 secondary
  primitives, zero gameplay-blocked frames, no browser error, and a still-
  exact authoritative rate of `99.95` ticks/second.
- A separate player report says the installed iPhone web app heats rapidly,
  crashes around repeated level-ups, and can softlock at the Tutorial Inventory
  step. Those failures remain separate acceptance rows, but the combination of
  thermal pressure and Acid's high transient membership makes per-child GPU
  ownership part of this reopened renderer system.
- The parity question is representation-only: the native field owns one
  procedural width-three Acid streak per falling child, but it does not require
  each identical streak program to own a distinct browser texture. Can the web
  renderer share the two immutable authored gradient programs while preserving
  every actor's geometry, queue position, head sprite, state, and lifetime?

## Evidence and minimized owner

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Physical A/B | exact candidate `aace154d`, Mobile Safari, fresh private game | Hub `60.00`, empty Boneyard `58.31`, clean Acid `25.50` FPS; host rate remains about 100 Hz and SkillPicker-blocked frames remain zero | high |
| Physical profiler timing | same iPhone/candidate with WebKit ScriptProfiler enabled | the profiled Acid interval retained 170 actors / 217 primitives and fell to `18.23` FPS; full trace serialization hung, so it is evidence of profile overhead only and not a call-stack attribution | medium |
| Source-level render A/B | isolated diagnostic build over exact `aace154d`, Mac Safari, alternating one live Acid field | normal Pixi submission averages `3.12..3.28` ms/frame; hiding all secondary pixels averages `0.82` ms and hiding only gradients `0.99` ms, while secondary state/view update remains `1.03..1.17` ms | high |
| Current web owner | `native-secondary-world-view.ts`, `NativeSecondaryActorView.addGradient` | every Acid/Storm falling child constructs its own `FillGradient`, `Graphics`, and lazily built texture; the fill is destroyed when that short-lived child retires | high |
| Pixi 8 implementation | installed `pixi.js` `FillGradient.mjs`, `buildLinearGradient` | each `FillGradient` builds a private 256-by-1 canvas, `ImageSource`, and `Texture`; identical color stops therefore still produce distinct texture identities and break a shared sprite/graphics batch | high |
| Existing native closure | Acid field section above; `Anim_AcidRaindrop 0x004541A0/0x00459130`; Storm sibling presentation contract | position, length, width, endpoint colors/alphas, queue family, head glyph, child clocks, and birth density are already recovered; no native instruction assigns texture ownership per child | high |

The Mac remains display-paced because it has headroom; its internal timings are
used only to minimize the owner. The physical iPhone row is the decisive
performance failure.

## System boundary and sibling membership

Native/web system: the procedural falling-streak render resource used by every
secondary actor whose plan contains a `NativeSecondaryGradientDraw`.

| Member | Immutable gradient program | Per-actor state that must remain independent |
| --- | --- | --- |
| `acid-drop` falling branch | start `#b3f2bf` alpha 1, end `#66f2ff` alpha 0, width 3 | root position, `phase` start Y, `quantity` length, queue depth, BadGuys-0 quarter-alpha head, ground transition, and retirement |
| `storm-drop` falling branch | start `#ccf2ff` alpha 0.5, end `#66f2ff` alpha 0, width 2 | root position, start/length, moving/stationary Storm owner, queue depth, head sprite, ground transition, and retirement |
| Acid parent cloud/residue and splash | no gradient draw | unchanged sprite owners; outside the resource replacement |
| weather rain | separately batched `NativeBoneyardWeatherView` alpha-ramp texture | already owns its own weather-only batch and remains unchanged |

There are exactly two gradient resource variants. They are immutable after
construction. Sharing either fill cannot couple actor transforms because the
line geometry remains in each actor's `Graphics`; it changes only the identity
and lifetime of the sampled texture.

## Web implementation consequence and validation contract

- Move the Acid and Storm `FillGradient` resources from short-lived
  `NativeSecondaryActorView` instances to their owning
  `NativeSecondaryWorldView`. Construct exactly one of each per world view,
  pass the selected immutable fill into each child line, and destroy both only
  after all actor views during world teardown.
- Preserve per-frame line clear/stroke geometry, local start/end coordinates,
  width, insertion order, root position, z/depth, blend, actor counts,
  primitive diagnostics, and every parent/child gameplay state. Do not reduce
  native density, cap children, hide streaks, lower resolution, change
  Enhanced Effects, or add a mobile-only branch.
- Red/green source and focused contracts must prove that the pre-fix owner
  allocates one fill per actor, the fixed owner has exactly two immutable fills,
  actors do not destroy shared resources, endpoint programs remain exact, and
  world teardown destroys each resource once. Existing complete Acid/Storm
  plan, lifecycle, painter, light, audio, and protocol tests must stay green.
- Re-run the physical control/Acid/restoration A/B on the exact candidate.
  Require zero blocked frames/errors, about-100-Hz host cadence, unchanged
  `acid-rain`/`acid-drop`/`acid-splash` membership and primitive counts, and a
  material frame-time restoration. Then run the mixed-secondary and repeated-
  level-up/Tutorial regressions before claiming thermal/crash closure.

## Implementation validation receipt

- The red structural contract ran against the per-actor resource owner and
  failed `1/36`: the source contained one `FillGradient` constructor inside
  `NativeSecondaryActorView.addGradient`, an actor-local fill array, and
  actor-retirement destruction. Red log SHA-256 is
  `aa95f6f7f2df5ee1aab86f3fc9b73bbdcd053300af448fa0182fed16bc559ce2`.
- The implementation exposes the two exact immutable endpoint programs from
  `native-secondary-presentation.ts`. Each `NativeSecondaryWorldView` now
  creates one Acid and one Storm `FillGradient`, supplies the selected shared
  fill to every actor-owned `Graphics` line, destroys actor geometry without
  destroying either shared fill, and destroys both fills once after all actor
  views during world teardown. No child count, plan primitive, line geometry,
  sprite, state, or protocol member changed.
- TypeScript and the combined Boneyard render/complete secondary-presentation
  group pass `73/73`. This retains exact Acid and Storm endpoint colors,
  alphas, widths, child branches, painter lanes, and all sibling secondary
  presentation members. Green log SHA-256 is
  `eb203ffad5678dcbca4cb2b76a38d63a6f387fe4d0e407a88bd8672002c763aa`.
- The controlled pre-fix Mac render A/B at 174..177 live Acid actors measured
  normal Pixi submission at `3.12..3.28` ms/frame. Hiding only gradients reduced
  it to `0.99` ms/frame and hiding every secondary pixel to `0.82` ms/frame;
  secondary state/view update remained `1.03..1.17` ms/frame. Result SHA-256 is
  `6aaee78a92d296e26bd22363a63cf1e5210d9d33bb1d3e9a306b221d83cbeaf4`.
- With shared fills, exact visible Acid at 174..177 actors costs
  `1.09..1.25` ms/frame in Pixi submission, while hiding all secondary pixels
  costs `0.90` ms/frame. The visible program is therefore within about
  `0.2..0.35` ms/frame of drawing none, and the former texture-identity batch
  break is gone. Result SHA-256 is
  `ef518901a3facfcdb52fd826a6d4445c463e52b401b1c843fc0dad8dd5d543bb`.
- A clean Mac Safari A/B with all diagnostic hooks removed measured Hub
  `60.02` FPS, empty Boneyard `59.99`, Acid Rain with 175 actors / 222
  primitives `59.83` (p95 `19` ms), and post-Acid restoration `60.01`.
  Gameplay-blocked frames and browser errors are zero in every row. Result
  SHA-256 is
  `402dfa4db77b55d6db66d6e2cacc1a9afbac8e016156ab9d8180021fefd39bf4`;
  log SHA-256 is
  `b15b9738298bc107866b0576023115e2e42ca7cd04d6072cb6a256c297e3ad5c`.
- The clean production build passes TypeScript and the strict unchanged game
  budget at `474712` raw / `133114` gzip against `524288` / `133120`. Physical
  iPhone rerun and the newly reported repeated-level-up, Tutorial Inventory,
  installed-web-app, and thermal-pressure rows remain required before this
  physical performance closure is final.
- A post-run read-only device crash-ledger audit corrected the earlier
  assumption that the `12:16` Inspector loss was merely Auto-Lock. iOS created
  `JetsamEvent-2026-08-26-121652.ips` at `12:16:52 -0400`, while the long
  candidate matrix and follow-up were using Mobile Safari. It names frontmost
  `com.apple.WebKit.WebContent` as both the largest process and the killed
  process, with reason `highwater`, `rpages/lifetimeMax=98395`, zero purgeable
  pages, and WebKit GPU still live. Report SHA-256 is
  `3d66dc3edecd8af1f7ec49c7e9c332e61511d2c42a3968e9667df8d1ce593705`.
- An earlier physical run likewise produced a frontmost WebContent high-water
  kill at `09:48:29`, with `rpages/lifetimeMax=98332`; report SHA-256 is
  `8064297d48b7db717163c4aa49b906051eaffeca451c4801b0640380354625f1`.
  The `08:18` Jetsam report does not kill a WebKit process and is retained only
  as a falsifying control (SHA-256
  `c6653040c8b79fa8623d5e66b3111ebf16d5f7830c647b70c252b14938b178b8`).
  These receipts prove real iOS process termination, not just low FPS or a
  transport disconnect. Final physical acceptance must show bounded WebContent
  footprint across Acid, repeated pickers, Tutorial Inventory, and restoration,
  plus no newly named Jetsam/WebKit resource report.
- Exact clean commit `114404e9d025832da7168d63561b23a34f03c993` passes the
  complete Apple-arm64 `./scripts/validate.sh` gate: backend build/integration,
  formatting, lint/boundaries, every frontend group including Boneyard,
  secondary, level-up, Tutorial and Inventory, desktop tests, production build,
  bundle budget, and media policy. The worktree is detached and clean; canonical
  log SHA-256 is
  `f37c253ad1f4046e9c36c048205e5cd7c61af66a4bb95103a7af84688db151a0`.
- The exact clean Mac candidate matrix covers 21 independently self-validating
  rows: Hub, Boneyard, picker/Inventory and both restorations, Acid, all-five
  secondary overlap, 91-enemy idle, 89-enemy moving/shooting, Fire/Water/Ether/
  Air/Earth max-rank primary VFX, and fresh restoration. Minimum FPS is `58.27`,
  maximum p95 is `19` ms, all error arrays are empty, and Ether observes the
  Wraith record-20 terminal actor. Composed-result SHA-256 is
  `ee95f91edc526862d0762bf52a15ac6b09844b2d5cbeee0e2bef7c702ba8ebe0`.
- The same candidate passes eight separate threshold/SkillPicker open-select-
  close lifecycles. Every picker holds about 60 FPS; after every close only the
  two ordinary Boneyard canvases remain, the world frame counter advances, and
  page errors remain empty. Result/log SHA-256 values are
  `d041406309386fc2709326f23bff0b0fe8e97167307470f1b0ec882293a10360`
  and `62f742681cbaad52dd456b8be2427bb6edfa37b9194d0f74478d936050b79a35`.
- A real resumable Tutorial stage-9 save fixture opens Inventory, advances
  authoritatively to stage 10, closes into stage 11, resumes the world tick,
  and then completes three more Inventory open/close cycles. Final state is
  `inputBlocked=false`, no Inventory, stage 11, advancing tick 688, and no
  error. Result/log SHA-256 values are
  `be6cdd3ed42f808e3386206e2e9328a4ed62dcb440949d35d6d9267d8cd3561e`
  and `8b548f544e87c8eef8ed0f22d9266ce5d17998527085b11f0d669fb5db3fe96d`.
- A combined exact Mac lifecycle keeps one live 169..175-child Acid field
  visible through Inventory and four independent level-up pickers, then waits
  for complete secondary teardown and restores at `59.78` FPS. All seven rows
  hold `59.78..60.02` FPS with empty errors. Result/log SHA-256 values are
  `dce4f8855f32c110bf6c13976c3267d82531ab1153a7619befc05fa6875bfaa8`
  and `8451d079a784be59d3babba589701c895d65354b9ccb85af2121c1dd97f03433`.
