# 2026-08-21 — Invincibility Potion web-mod content lifecycle

## Reported smell and parity question

- Production diagnostic `4e527d0e-e7a8-4498-a7dd-8a2d2c4c9e86` recorded
  `mods.load_failed` before the Hub connection. The matching server trace proves
  `GET /api/mods/active` re-inspected the enabled Invincibility Potion and
  rejected native API-`0.2.0` manifest members as unknown. The package had
  already been published and its stored SHA-256 still matched the database.
- The visible 500 is only the first missing member. Accepting the manifest alone
  would next fail because the web runtime has no package file sandbox, sprite
  atlas registry, authored consumable/loot registry, `item.consumed` owner
  callback, synchronous damage/mana filters, or replicated duration VFX.
- Parity question: can the retained `canary.lua.invincibility_potion` package
  execute without a special-case code path, drop its authored potion, preserve
  its icon through ground/inventory/save replication, consume for any party
  member, restore that member's mana, cancel damage and mana spending for three
  minutes, present the effect on every client, and retire all state on expiry,
  run boundaries, party teardown, and host shutdown?
- Falsifiers: one incompatible subscription still fails all active mods; a
  package can request a capability the host does not own; a guest consume
  restores the leader; a custom drop renders a stock subtype; the effect exists
  only on the consumer; poison or a secondary/primary mana debit bypasses the
  filters; a run transition retains protection; or one mod can access another
  mod's package files, globals, callbacks, timers, items, or sprites.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production trace | diagnostic reference above; `solomon-dark-revived.service` journal at `2026-08-21T13:40:43Z`; stored package `invincibility-potion-canary/0.2.0.zip`, package SHA-256 `ac16df4ac239f1e6c9e02bc0b2bebaed08ce49bba164a5d081920de59673c889` | The active-mod request reaches `ModPackageInspector.ValidateManifest`; `minimumLoaderVersion` and `runtime.requiredCapabilities` are rejected before any game host or transport work. | high |
| Loader source contract | Mod Loader `f682ab1b14a54a861068816e3e56643984bfaa91`; `lua_engine_bindings_{sprites,items,consumables,loot}.cpp`, `lua_engine_{filters,resource_filters,events}.cpp`, `lua_item_runtime.cpp` | The mod uses stable `sd.content.v1` identity, entrypoint-only registration, independent additive loot rolls, owner consumption, queued all-peer events, ordered fail-open filters, and per-mod teardown. | high |
| Loader authored package | `mods/lua_invincibility_potion_canary/{manifest.json,scripts/main.lua,sprites/*}` | API `0.2.0` requires eight named capabilities. The script registers one atlas, one potion, one loot row, three lifecycle/event callbacks, two filters, and one expiry timer. | high |
| Native presentation | `Anim_SpellGlow` constructor `0x00454AD0`, painter `0x00536380`, record `BadGuys[110]`; `lua_world_renderer.cpp` and `native_{carrier_queue,texture_bridge}.inl` | Consumption owns a one-frame four-quad activation flash plus a persistent actor-attached 128-pixel procedural ring: radius `42 + 3*sin(elapsed/1200ms*2pi)`, opacity `0.8`, registered RGBA tint, world-Y sort, and the authored duration. | high |
| Current web owners | Website `1361f097cf9ff2676e5c01c7b822f44b52a1220a`; `web-mod-content.ts`, `host/lua`, `boneyard-loot-store.ts`, `hub-economy.ts`, snapshots/entity replication, Pixi renderers | Per-mod VMs, entrypoint ordering, stock loot/inventory, fixed-tick player damage/mana owners, shared-party authority, saves, and world rendering already exist. The missing seam is one bounded content registry joining those owners. | high |

The retail executable has no Lua engine. Lua semantics come from the project's
native Mod Loader source contract; stock addresses above establish only the
reused `Anim_SpellGlow` presentation.

## System boundary and membership inventory

Custom system: **Invincibility Potion package-to-gameplay lifecycle** — exact
package admission and isolation through content registration, loot, inventory,
consumption, filtering, replication, presentation, persistence, and teardown.

| Member | Native/source owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| API-`0.2.0` manifest, `minimumLoaderVersion`, required-capability list | Loader manifest validator and package schema | `exact-ported` by this cutover | Unknown fields fail at upload; every requested web capability must be present before session materialization. Native minimum-loader metadata remains descriptive on the web. |
| Exact package identity and per-mod file sandbox | package SHA/content SHA; canonical mod root | `exact-ported` by this cutover | Only bounded validated files from the owning immutable package reach that VM; paths cannot escape or cross mod ownership. |
| `sd.content.v1` item identity | FNV-1a-64 domain/length/string algorithm | `web-adapted` by this cutover | The exact positive 63-bit value is retained as a decimal string across JavaScript/JSON while Lua compares the same lossless representation. |
| `sd.sprites.register/get/list/unregister` | sprite registry; 45-byte bundle records; PNG IHDR | `web-adapted` by this cutover | Registration validates path ownership, PNG bounds, every unrotated frame, and atomic identity; the browser receives only bounded immutable PNG assets and frame geometry. |
| custom-potion `sd.items.register/get/list` | item/content registries | `exact-ported` by this cutover | Entry-script-only registration, owned key, text/duration/icon/VFX validation, per-mod/global bounds, duplicate rejection, and deterministic native subtype reservation. |
| recipe-backed items and `sd.items.grant` | native recipe catalog and peer-local UIDs | `out-of-system` | The retained mod does not register or grant a recipe-backed item; this cutover does not invent a browser recipe-UID contract. |
| `sd.loot.register/list` | additive Lua loot pool | `exact-ported` by this cutover | Each registered row rolls independently after every supported hostile death; ordinary chance is `0.5`, supported boss chance is `1.0`, and stock loot RNG/outcomes are unchanged. |
| Demon boss branch | native boss census | `exact-ported` by this cutover | The web-owned Demon family uses `boss_chance`; Coffin, Imp, Skeleton, Archer, Mage, Wraith, and Zombie use ordinary chance. |
| Demon Skull, Dire Faculty, Heartmonger boss branches | native custom-loot boss census | `out-of-system` | These hostile families do not exist in the rebuilt web Boneyard; no silent stand-in is assigned. |
| ground custom-potion carrier and pickup | stock item-drop actor, positioned glyph, authoritative pickup | `web-adapted` by this cutover | The existing sack lifetime/collision/Y-order is retained while the registered frame replaces only the potion glyph; stable content identity survives pickup. |
| inventory stack, icon, description, consume action, and save | stock inventory/economy plus schema-two save | `web-adapted` by this cutover | Stacking keys on content identity, the same registered frame renders in belt/backpack/drag/info, and exact mod identity protects resume. |
| owner `on_consume` and all-runtime `item.consumed` | queued consumable-use event | `web-adapted` by this cutover | One authoritative use ID is deduplicated; all mod VMs observe the event, while the owning callback executes once with the consuming participant as active player. |
| `sd.player.restore_mana()` | owner resource writer beneath the native filter | `exact-ported` by this cutover | No-argument restore targets the consuming participant, including a party guest, and does not recursively enter `mana.changing`. |
| `damage.taken` filter | ordered nine-lane filter chain | `web-adapted` by this cutover | The scalar web health lane is projected as lane one; false/cancel is monotonic, patches are bounded/transactional, errors fail open, and direct plus poison damage converge before health mutation. |
| sibling `damage.dealing` | same native damage filter registry | `out-of-system` | The retained mod does not register it; closing every player-to-enemy producer is a separate authored-mod surface and is not advertised by this package migration. |
| `mana.changing` filter | ordered resource filter chain | `web-adapted` by this cutover | Primary, secondary, overload, passive recovery, orb, and stock-potion gameplay writes carry current/max/delta/source; cancellation and bounded delta rewrites precede mutation. Owner restore/lifecycle reset remain beneath the filter to prevent re-entry. |
| sibling `xp.gaining` and `gold.changing` | same resource filter registry | `out-of-system` | The retained mod registers neither sibling; existing post-change events remain unchanged. |
| timer after/cancel and run start/end cleanup | per-VM 100 Hz scheduler/event lifecycle | `verified-already-at-parity` | Existing quantized timers and lifecycle dispatch own the three-minute expiry and `clear_effects`; close retires timers/callbacks/globals. |
| activation `Anim_SpellGlow` | `0x00454AD0`, `0x00536380`, `BadGuys[110]` | `exact-ported` by this cutover | One tick of four independently scaled/alpha additive quads is attached to the consumer and tinted by the registered color. |
| persistent actor-attached carrier | native world carrier described above | `exact-ported` by this cutover | Every client draws the generated ring at the current participant position, ordinary world-Y order and lighting/tint, through the exact duration; it is not a HUD badge or overlay orbit. |
| shared-party authority and replication | shared Hub party run, one VM per active mod | `web-adapted` by this cutover | Identical content is required before launch; one host executes filters/loot/events, ordinary snapshots carry outcomes/catalog identity, and every client renders them. |
| run entry, expiry, run end, party mutation, disconnect, host close | run/VM/content-registry lifecycle | `exact-ported` by this cutover | Registration locks after entrypoints; effects clear at run boundary/expiry; party scopes and all content ownership retire together. |

No member is `blocked-by-platform`. Native pointer/address fields are omitted
from web filter payloads because the clean rebuild has no retail address space;
stable player/enemy IDs are the exact semantic replacement.

## Ownership thread and recovered contract

```text
validated immutable ZIP + required capabilities
  -> admission materializes ordered mod sources and owned package files
  -> party launch creates one VM per mod and one shared content registry
  -> entrypoint registers atlas -> potion -> additive loot -> events/filters
  -> host locks registration and publishes the bounded presentation catalog
  -> enemy terminal reward independently rolls custom loot
  -> stock loot actor/pickup inserts a content-identified inventory stack
  -> authoritative consume allocates use_id and queues item.consumed
  -> owner on_consume restores that participant; all callbacks arm protection
  -> damage/mana writers synchronously traverse mod/filter registration order
  -> snapshots carry ground identity and actor-attached duration presentation
  -> timer/run boundary removes protection; scope close removes everything
```

- Registration is allowed only during `runEntrypoint`; a failed entrypoint
  aborts the whole party launch and closes every partially initialized VM and
  registry member.
- Filter errors and invalid result shapes fail open for only that handler.
  Cancellation is monotonic. Callback/timer work retains the existing per-VM
  timeout, tick aggregate, invocation, memory, command, and output bounds.
- Custom loot is additive. Its deterministic web roll domain is separate from
  the stock loot RNG so enabling a mod cannot perturb any stock category roll.
- Content assets are immutable admission data. Clients never receive a package
  filesystem path; only bounded PNG bytes and validated frame geometry cross
  the protocol.
- The custom item carries enough immutable presentation identity for Hub/save
  rendering; the launched catalog maps ground content IDs to the same frame.

## Web implementation consequence

- Add one deep `host/lua` content-registry module. Its interface owns package
  files, registration phase, item/sprite/loot definitions, stable IDs, ordered
  filters, consumption dispatch, catalog projection, and teardown. `game-host`
  coordinates scopes but does not learn registration internals.
- Add a small simulation-extension interface for player damage, mana changes,
  enemy reward loot, and custom-item consumption. `core-server` remains free of
  Lua imports; tests and the host cross the same seam.
- Extend session materialization and the game protocol with bounded capability,
  package-asset, content-catalog, content-ID, and active-effect data. Increment
  the protocol; no legacy decoder remains.
- Extend existing inventory and loot renderer owners to resolve registered
  frames. Add one world effect view for the recovered activation/carrier
  program; do not add a screen HUD timer or generic fallback icon.

## Validation contract

- Backend/package: replay the production `0.2.0` shape; prove API `0.2.0`,
  required capabilities, loader metadata, package files, unsupported
  capabilities, archive bounds, and active/session endpoints.
- Registry/runtime: fixed content-ID vectors; sprite path/PNG/bundle bounds;
  item/loot registration order and rejection; lock/rollback/teardown; guest
  active-player semantics; event/filter result ordering and fail-open behavior.
- Gameplay: deterministic ordinary failure/success and Demon success; ground
  actor/pickup/stack/save; host and guest consume; mana restore; direct and
  poison damage cancellation; primary/secondary/overload mana preservation;
  exact expiry and run/reset cleanup.
- Presentation: the authored green frame renders on ground, belt, backpack,
  drag, and info paths; activation flash has four record-110 quads; the
  persistent 42+/-3 ring follows the correct actor on both clients and retires
  at the deadline without a HUD badge.
- Gates: supported `./scripts/validate.sh`; real Windows built-browser solo and
  two-player journeys; requested Mac mini canonical matrix and built-browser
  host/guest drop, pickup, consume, protection, mana, VFX, expiry, and cleanup.

## Implementation validation receipt

- Website final validated cutoff `7c2d766b843114eadc25af66dd2f23a52db795be`
  implements API `0.2.0` admission, capability rejection, the isolated package
  file/content registry, stable decimal content identities, registered sprite,
  item, and additive-loot owners, guest-correct consumption, synchronous
  damage/mana filters, protocol-48 replication, custom ground/inventory art,
  and the recovered flash/ring renderer. The browser journey caught and closed
  one missing presentation member before publication: `BadGuys[110]` had not
  been included in the preload census. The 78-record asset contract now owns it.
- The merged functional tree passed `./scripts/validate.sh` on native Windows
  and the Apple-silicon Mac mini: 15 backend tests; frontend groups of 4, 43,
  225, 1,244, 19, 10, 7, 17, and 16 tests; five desktop tests; formatting,
  lint, architecture boundaries, Release backend build, production client and
  portable-host builds, media policy, and a 367,042-byte raw / 103,300-byte
  gzip Game entry. The final commit makes the concurrent public-party assertion
  scheduler-independent; the Mac repeated its 19 party, eight supervisor, and
  lint gates, while Windows repeated the whole matrix at the final cutoff.
- Deterministic package `invincibility-potion-0.3.0.zip` is 6,642 bytes with
  package SHA-256
  `5d294cc374403745c12ee1b441f1822bbadce126a4d78c2ea7f1125638eb1c54`
  and content SHA-256
  `df9eae2b56b32bbb3a15c765ecf0f8e2427d10d75f87ba8fc3793b379021c0ee`.
  Its fixed native content ID is `8068156596081641415`.
- Native Windows Chrome and Mac Chrome each ran the built production client
  with two WebGL2 contexts against that exact extracted ZIP. Both proved the
  registered green ground pickup and Inventory icon, guest-only consumption,
  mana restoration, a real held Air cast with no debit, advancing poison with
  no health loss, one authoritative guest effect rendered on both clients, and
  empty page, console, network, and host-error arrays. Both independently
  derived session manifest SHA-256
  `28151cb4867ab55416a73f5fd65b6c7d3210286076d554e0c29fb19ec4bdcf00`.
  Windows Inventory/effect screenshots hash to
  `6319ce2de4c9026d3e69b5ebf1cc458479403d0936d1715c5190c410e442f08b`
  and `560fcb2583b820bb7017487ed77e45fe33702531bb1fa9909168646a780c4c15`;
  Mac equivalents hash to
  `36b9f0f3832d70b488b599b069d911499a72bbe30cfcc39feb3962712c6b7285`
  and `137d64818eb6ba0e17b74546d0a19be9f4f14a829e9f85d5bece7e15d04cbcac`.
- Mod Loader cutoff `470758e2776eb06a3108bb10cecece021f3cf31e`
  passes 88/88 portable modules (801 tests) and 491/491 static RE contracts in
  WSL and on the Mac mini. The two pre-existing failures introduced by the
  concurrent Unforge documentation merge were closed by adding its three
  document-only initialized fields and two promoted captures to their complete
  censuses.
- The first live account proof reopened the admission edge: both temporary
  accounts returned the identical active manifest, while the ordinary browser
  welcome carried zero mods and an explicitly authenticated raw admission
  carried `0.3.0`. `admitSharedHubPlayer` was using bare `fetch`, so optional
  authentication treated signed-in New Game as a guest and the party correctly
  rejected the mismatch. The browser now passes `getToken()` explicitly into
  admission; focused tests prove both the bearer header and the unchanged
  anonymous guest branch. Functional fix
  `6e2bd27b9173f7ffc8fb8b4791f86652da1150a6` passes the full Mac gate and
  native-Windows typecheck, lint, and all ten changed bootstrap/Create tests.

Admission-fix publication, guarded redeployment, and final live account
acceptance remain pending at this receipt.
