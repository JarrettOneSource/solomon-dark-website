# 2026-08-22 — Mobile startup memory and native visual-asset lifetime reopening

## 2026-08-29 — Hub native UI family lifetime correction

The cross-surface black-frame reopening in entry 280 falsifies only this
entry's claim that every Inventory/trader logical screen may destroy its WebGL
application independently. Startup ownership remains unchanged: none of that
family's private art loads before first use. After first use, the browser keeps
one `HubInventoryUi` renderer across standalone Inventory, dialogue, and all
four companion services, then destroys it on Hub/Boneyard scene teardown. This
bounded scene-local adaptation prevents a proven destroy/recreate resource race
without restoring route-global residency or retaining assets across world exit.

## Reported smell and parity question

- Production report: opening `/game` on a phone advances partway through the
  native Loader, refreshes, repeats the same partial load, and eventually shows
  the browser's page-crash state.
- This reopens the 2026-08-11/13 Loader and Create-hand readiness entries. The
  skipped rule was lifecycle membership: those passes correctly made readiness
  task-driven, but interpreted "resident `/game` assets" as every visual used
  by every later screen. They did not reconcile that approximation with the
  later complete native asset-system report proving per-screen/per-actor atlas
  acquisition, reference counting, and final release.
- Falsifiers: an application reload/redirect, failed production asset, service
  restart, JavaScript exception, or low decoded footprint would reject memory
  pressure. Conversely, startup constructing inactive-scene art at an
  unbounded rate and exceeding a mobile process budget predicts the exact
  refresh/crash loop.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production runtime | `https://solomondarker.com/game`, deployed Website `cfecdb2af64d5ce6312c2b4ddcff3f35f9b8b4a6`; instrumented `390x844`, DPR 3 touch Chrome with an iPhone Safari user agent | One clean navigation had no redirect, service worker, reload call, page/console error, failed HTTP response, or renderer crash. It completed all `856` startup tasks in about 25 seconds. | high |
| Production services | NFO `DEPLOYED_GIT_SHA`, `systemctl`, supervisor health and warning/error journals after the `00:28` EDT cutover | Website and game services were active at `cfecdb2a`, protocol 52, `NRestarts=0`, zero occupancy, and no warning/error entries. Server restart and transport failure are falsified. | high |
| Browser memory probe | same production build, constructor-level `Image` and `decodeAudioData` probes plus request accounting | Startup loaded `704` images, peaked at `700` active image objects, `579` concurrent requests (`426` image), decoded `1,065,122,832` image bytes (`1015.78 MiB`) plus `50,576,476` PCM bytes (`48.23 MiB`): `1064.01 MiB` before Title. | high |
| Largest members | production hashed assets and decoded natural dimensions | Twenty player equipment/body sheets are `1700x4080`, `27,744,000` RGBA bytes each. They are inactive at Title but were retained by the route promise map. | high |
| Native visual ownership | retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `native-asset-system.md`; `Native_SpriteBundle_LoadImagePageSet` `0x00413030`, release `0x00413760`, page release `0x00420760` | Screen/actor owners acquire atlas singletons; bundle `+0x1C` counts owners; the last release frees page handles, resets residency, and releases GPU slots. Create is observed acquiring then releasing on Hub transition. | high |
| Native audio ownership | `native-audio-system.md`; `MyApp` registry builder `0x004EE010`, app object `+0x319EC8`, progress callback through MyApp vslot `+0x10` | The 233-slot Sound/SoundStream/SoundLoop registry is app-global and constructed during startup, unlike visual screen atlases. | high |
| Current web causal trace | `Game.tsx`, `game-assets.ts`, `game-asset-readiness.ts`, renderer texture modules at `cfecdb2a` | Route startup flattened Loader, all world/menu/player/spell visuals, and global audio into one manifest; `loadAssetBatch` used one `Promise.all` over every source. Later renderers already have independent readiness and teardown, making the global visual gate both redundant and contrary to native lifetime. | high |

No new native address or authored-table row was recovered. The Mod Loader's
existing asset/audio reports already contain the reusable native truth and
remain unchanged.

## System boundary and membership inventory

Native system: visual bundle acquisition/residency/release by the active
screen or actor, plus the separate app-global audio registry and Loader task
counter. Browser adaptation: bounded asynchronous decode/upload with the same
owner boundaries.

| Member (owner/state/branch) | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Loader art and task counter | `MyLoader` `0x005BAB60`, render `0x005BCA40`, completed/total globals `0x0081F6A8/AC` | `exact-ported` | Extracted Loader renderer remains mounted until every declared startup task succeeds. |
| App-global audio registry | builder `0x004EE010`, 233 fixed slots | `exact-ported` with browser codec adaptation | Audio remains in startup membership, bounded during decode, and ready before `GameAudioDirector` construction. |
| Immediately-next Title atlas and revision font | native MainMenu owner and Title/UI/Fonts bundles | `exact-ported` | Title sources join startup readiness; Title renderer consumes the identical cached images and owns their Pixi lifetime. |
| Create screen and five element VFX choices | Create owner/vtable `0x00797B7C`, build `0x00593C30`, teardown witness | `exact-ported` | Deferred until Create mounts; its renderer owns every hand/choice/font/VFX member and destroys them on exit. |
| Dark Cloud DOM/CSS imagery | separate Website catalog screen | `out-of-system` (Website extension) | Vite scene chunk/CSS owns its images; no route resident-image entry is added. |
| Hub world, rooms, NPCs, players, spells and HUD | native College/room/actor owners; Website Hub renderer barrier | `exact-ported` ownership | Deferred to Hub renderer, bounded load, input sealed through first frame, textures destroyed on world exit. |
| Boneyard field, scenery, enemy, loot, Solomon, player and spell art | native Arena/actor bundle owners; Website Boneyard renderer barrier | `exact-ported` ownership | Deferred to Boneyard renderer, bounded load, prior Hub teardown precedes residency, and run exit destroys textures. |
| SkillPicker, SkillBook, inventory/traders and pause renderers | their native screen owners | `verified-already-at-parity` with bounded browser lifetime adaptation | All remain lazy and absent from startup. SkillPicker, SkillBook, and Pause retain independent teardown; the Inventory/trader family retains one renderer after first use until its containing Hub/Boneyard scene exits. |
| Mod presentation textures | Website mod runtime | `out-of-system` (browser mod extension) | Run/screen scoped loader releases its image promises and destroys textures on teardown. |
| Browser image-promise cache | no native object; mirrors in-progress page acquisition | `out-of-system` (browser adapter) | Deduplicates only active loads; every texture-map success/error path deletes the corresponding promise entries. |
| Maximum four concurrent browser tasks | native builders are mostly synchronous with a finite five-builder async family, but expose no browser-equivalent numeric cap | `blocked-by-platform` adaptation (mobile WebKit process budget) | Deterministic unit test pins `<=4`; visible behavior differs only in load throughput, not art/readiness/order. |
| Decode failure after successful `load` | browser-specific decode eviction | `out-of-system` (browser adapter) | Existing successful-load authority remains; a redundant `decode()` rejection cannot strand a scene. |
| Device reset / WebGL loss | native persistent-slot restoration is platform-specific | `out-of-system` (Pixi/WebGL owner retained) | This cutover changes no context-loss or renderer-error policy. |

The concurrency cap is the sole `blocked-by-platform` row. A user may notice
steady serialized progress rather than hundreds of completions arriving in a
burst; final pixels, scene timing after readiness, and gameplay are unchanged.

## Ownership and recovered behavioral contract

- Startup readiness is the union of Loader art, immediately-next Title art,
  and the native app-global audio registry. It is not a synonym for every file
  the process may consume later.
- Each later visual owner acquires only when its scene/renderer constructs,
  blocks that scene's input until its first ready frame, retains GPU textures
  while active, and destroys them at its recorded teardown boundary. The
  Inventory/trader native UI family uses containing-scene teardown after first
  use; other screen families keep their independent teardown. Transition
  loading is therefore real work, not a timed splash.
- Browser image promises deduplicate overlapping requests but do not confer
  residency. Pixi textures become the active owner; the promise entry is
  deleted immediately after successful texture construction or any failure.
- Browser task concurrency is capped at four across route and large scene
  loaders. Results preserve source order and progress counts; a failure stops
  scheduling new work while already-started tasks settle.
- No reload, retry loop, user-agent special case, low-resolution substitute,
  guessed timeout, or asset omission is permitted. Every native member remains
  available from its correct owner.

## Web implementation consequence

- Remove `GAME_RESIDENT_IMAGE_SOURCES` and the route-wide mixed resident
  manifest. Introduce explicit Loader, Title, Create, startup-image, and startup
  total memberships.
- Make the shared batch executor bounded and reuse the same ordered image-load
  helper in WebGL, Hub, and Boneyard texture construction.
- Make Loader/Title/Create renderers consume the authoritative groups exported
  by `game-assets.ts`; remove their duplicate local membership builders.
- Release image-promise entries on every WebGL texture-map success/error path.
  Renderer destruction remains the GPU-lifetime boundary.
- Keep the exact global audio membership and all existing scene transition
  barriers. Protocol, simulation, saves, authority and native pixels do not
  change.

## Validation contract

- Red regression: current `loadAssetBatch` reaches `20` simultaneous tasks
  against a required maximum of four; current startup-source contract still
  exposes `GAME_RESIDENT_IMAGE_SOURCES` and duplicates visual ownership.
- Unit/static coverage: bounded work, stable ordered results/progress, Loader /
  Title / audio startup membership, scene-owned source groups, cache release,
  Hub/Boneyard bounded loaders, and absence of the superseded resident-image
  symbols.
- Measured browser loop: at `390x844`, DPR 3 touch, cold production bundle,
  assert one navigation, zero page/console/HTTP errors, title readiness, no
  Boneyard/player sheet constructed before Title, peak active `Image` work
  `<=4`, and decoded startup imagery below `128 MiB`.
- Full journeys: Title -> Create -> Hub -> Boneyard -> Hub/Title teardown in
  mobile and desktop modes with exact existing presentation, audio, party,
  pause, save and input barriers.
- Run the only supported canonical `./scripts/validate.sh` gate and repeat the
  measured startup and gameplay journeys on the exact Mac mini tree before the
  separately authorized push.

## Implementation validation receipt

- Red state was reproduced through the supported gate: the batch regression
  measured `20` simultaneous loads against the required maximum of four, and
  the ownership regression found the route-wide
  `GAME_RESIDENT_IMAGE_SOURCES` manifest. The broad game group correctly
  failed `2/1272` before implementation.
- `game-assets.ts` now owns explicit Loader, Title, Create, and startup groups.
  Startup is only Loader + Title + the unchanged global audio registry; the
  superseded resident-image symbols and unused pre-Hub loader API are removed.
  Loader/Title/Create renderers consume those authoritative groups.
- `game-asset-readiness.ts` runs four ordered workers, stops scheduling after
  the first failure, waits for already-started workers, and preserves progress
  counts. `game-webgl.ts` streams each completed image directly into its Pixi
  texture, deletes the promise entry in `finally`, and destroys every partial
  texture after failure. Hub and Boneyard reuse that same path; Boneyard keeps
  its lifted-sprite transform inside the texture factory.
- A committed production-bundle regression,
  `smoke-game-startup-memory.mjs`, instruments the real `Image.src` and
  `decodeAudioData` call sites at `390x844`, DPR 3, touch and an iPhone Safari
  user agent. It rejects reloads, crashes, errors, inactive-scene assets,
  concurrency above four, or startup imagery above `128 MiB`.
- Exact-tree identity before this receipt: local and Mac mini both started at
  Website `origin/main` `cfecdb2af64d5ce6312c2b4ddcff3f35f9b8b4a6` and
  matched binary diff SHA-256
  `b9adacd3de8d677eefa77c8ea854a3bc7268ab8aed6206b9b1a66ff0be0adae2`.
- Local canonical `./scripts/validate.sh` passed `15/15` backend/contracts,
  `4/4` library, `43/43` loot, `226/226` prerequisite, `1272/1272` broad game,
  `29/29` party/chat/playtime, `11/11` level-up/HUD, `7/7` diagnostics,
  `17/17` Hall, `16/16` Hub UI, `5/5` desktop, production build, media policy,
  and bundle budget. `Game-BUizasze.js` was `392986` raw / `109955` gzip
  bytes; only the eight existing Fast Refresh advisories remained.
- Local cold mobile startup passed in `9467 ms`: one page load, `50` images,
  image peak `4`, `13,735,328` decoded image bytes (`13.10 MiB`), `146` audio
  buffers, audio peak `4`, and `50,576,476` decoded PCM bytes (`48.23 MiB`),
  with zero crash/page/console/HTTP errors. The production baseline was `704`
  images, peak `700`, and `1,065,122,832` decoded image bytes; this is a
  `98.71%` image-footprint reduction and removes the inactive Boneyard/player
  sheets from startup.
- Local real mobile and desktop shared-Hub journeys then completed Title ->
  Create -> three-member Hub party -> Boneyard while an outsider remained in
  Hub. Player Card/Whisper, party/global isolation, scene readiness, WebGL,
  movement and teardown remained intact; both returned empty page/console
  errors and final zero sessions/players/parties/runs.
- Apple arm64/macOS canonical validation passed the same counts and budget.
  Mac Chrome cold startup completed in `929 ms` with the identical `50` images,
  image peak `4`, and `13,735,328` decoded image bytes; its `146` buffers used
  `55,048,880` PCM bytes (`52.50 MiB`) at audio peak `4`, with zero errors.
  Mac mobile and desktop party journeys repeated the complete Hub/Boneyard
  lifecycle and ended at zero occupancy with empty error arrays.
- Safari `26.4`/WebKit on macOS `26.4.1`, driven through `safaridriver`, made
  one `navigate`, moved from the real Loader to the Title canvas, reported no
  error/unhandled rejection, and remained stable for ten seconds. This is
  direct WebKit evidence; the Mac has no display, so it does not claim an
  iPhone hardware memory ceiling.
- Publication remains pending below. No production process was restarted or
  modified during diagnosis or validation.
