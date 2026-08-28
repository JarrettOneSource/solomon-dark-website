# 2026-08-20 — Web Lua mod runtime and browser developer console

## Reported smell and parity question

- Reported web behavior: the Website accepts and distributes Lua-bearing mod
  ZIPs for the injected native loader, but `/game` has no Lua VM, no `sd.*`
  bindings, no fixed-tick script lifecycle, and no browser developer-console
  path.
- Requested behavior: rebuild the Lua authoring engine around the clean web
  authority, expose every semantic member backed by a system `/game` owns now,
  and add an `Enable Cheats` setting that lets the authoritative player execute
  Lua from browser DevTools.
- Scope boundary: package/library resolution is explicitly deferred. This pass
  owns the runtime, semantic API subset, protocol, setting, console, bounds,
  authority, fixed-tick scheduling, errors, performance, and teardown.
- Falsifiers: Lua runs on a browser render thread; a guest can craft an
  authoritative execution packet; cheats-off retains a callable console;
  scripts can reach Node/DOM/files/network; unused Lua adds per-tick work; a
  runaway chunk blocks the host; event/timer commands mutate between fixed
  ticks; or a native-only namespace is replaced with a misleading stub.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Loader source contract | Mod Loader `190a1573631e75109ab2b22b2d2c1a05e7636dbb`; `docs/lua-seam-roadmap.md`; root binding registry; Lua API `0.2.0` | Thirty public namespace families split into simulation-owner, presentation-local, and runtime/meta classes; exact parity, bounded state/events, and teardown are framework invariants. | high |
| Current web runtime | Website `dd4f87ea9fca99065f4e0bde89b479497f12be90`; `core-server`, `game-host`, protocol, browser client | One portable Node authority already owns fixed ticks, players, Hub/Boneyard worlds, waves, enemies, RNG seeds, protocol identity, and teardown. Clients own presentation. | high |
| Package boundary | `ModPackageInspector`, public manifest/schema/examples | The control plane can identify/hash Lua packages, but no game-host caller resolves them and every welcome uses an empty mod manifest. | high |
| Portable VM prototype | Node `22.17.0`, `wasmoon 1.16.0`, official Lua 5.4 WASM | Separate 266 KiB WASM + 193 KiB bundled bridge; lazy init about 36 ms; 5.31 MiB boot allocation; 1,000 trivial chunks about 0.103 ms each; timeout, allocator ceiling, callbacks, tables, and prints passed. | high for mechanism; WSL timing is provisional |

The stock executable contains no Lua engine. This is parity with the project's
native Mod Loader authoring contract, not a claim about a retail subsystem.
The reusable native-side report is
`Mod Loader/docs/reverse-engineering/web-lua-runtime-parity-contract.md`.

## System boundary and membership inventory

Native/custom system: the Mod Loader's sandboxed per-mod Lua lifecycle and
semantic `sd.*` contract. The first web release owns one persistent
`web.dev-console` authority VM; library-loaded multiple VMs follow later.

| Member | Disposition | Web proof/constraint |
| --- | --- | --- |
| Lua 5.4 parsing/execution and persistent globals | `exact-ported` | Portable WASM VM, bounded fresh chunks, persistent state, structured return conversion. |
| runtime construction, lazy start, reset, close | `exact-ported` | No VM before first accepted request; one authority VM; deterministic teardown. |
| unsafe standard-library removal | `exact-ported` | No IO, OS, package/module loading, dynamic loading, debug, GC controls, coroutine, Node, DOM, filesystem, or network. |
| instruction and memory limits | `exact-ported` | Instruction-hook wall budget plus allocator ceiling; request/output/state/callback/timer bounds. |
| `sd.runtime` | `exact-ported` | Mod identity, frame, multiplayer authority, capabilities, and API inventory. |
| `sd.state` | `web-adapted` | Native-shaped get/default, mutation revision, authority, clear/delete, and snapshot semantics over bounded console-VM session state; participant replication waits for participant Lua VMs. |
| `sd.events` built-ins and subscription lifecycle | `web-adapted` | `on` covers runtime, run, wave, enemy, gold, and level families backed by current web owners; callback errors retire only their owner. Native custom broadcast/filter and the spell/drop/item siblings remain deferred below. |
| `sd.timer` | `exact-ported` | 100 Hz quantized after/every/sequence/cancel/clear, relative sequence delays, no same-tick creation, and teardown. |
| `sd.rng` selected/active Boneyard seed | `exact-ported` | Select and immediately read one authority-owned `1..0x3fffffff` next-run seed; retain it through that run, while `sd.scene` exposes the active web seed hex. |
| `sd.scene`, `sd.gameplay`, `sd.hub` reads | `exact-ported` | Address-free projections of existing session/world state. |
| `sd.player` reads and existing resource mutations | `web-adapted` | Native common `hp/mp/xp/gold/x/y/position` state plus web identity fields; exact no-argument mana restore and explicit host-cheat health/mana/gold/XP commands use player components. |
| `sd.world` reads | `exact-ported` | World/scene and current player/enemy actor census. |
| `sd.waves.get_state` | `exact-ported` | Current web wave director projection. |
| stock `sd.enemies.get/list/spawn` subset | `web-adapted` | Deterministic descriptors cover the eight enemy families the web wave schema owns. Native-shaped options queue host spawn intents into the existing materializer, collision, light, replication, and event lanes. Dynamic registration/content IDs remain deferred. |
| console request/result transport | `exact-ported` | Protocol-bounded, ordered, host-only, request-correlated results with print/error capture. |
| `Enable Cheats` browser setting | `exact-ported` as web product extension | Persistent local setting controls installation of the DevTools surface; server host authority remains the security boundary. |
| `sd.storage`, manifest `sd.settings`, `sd.bus`, custom `sd.events.broadcast/filter` | `out-of-system` | No package/mod graph, participant Lua graph, or durable per-mod profile store in this slice. |
| `sd.net` | `out-of-system` | No participant-local web Lua VMs. |
| `sd.time` | `out-of-system` | No web time-scale/pause/frame-step owner. |
| `sd.nav` | `out-of-system` | Collision exists but no stable semantic cross-world navigation API. |
| dynamic `sd.spells`, `sd.items`, `sd.enemies.register`, `sd.ai` | `out-of-system` | Stock systems exist; dynamic content/brain registries do not. |
| `spell.cast`, `drop.spawned`, `item.consumed` Lua notifications | `out-of-system` | The web owns adjacent gameplay pieces, but it does not yet publish one complete stable semantic event payload for these three native siblings. |
| `sd.draw`/`sd.hud`, `sd.audio`, `sd.camera`, `sd.sprites`, world render, `sd.ui` | `out-of-system` | These are participant-local browser presentation systems and require a future client Lua/declarative lane. |
| `sd.bots` | `out-of-system` | No web synthetic participant brain runtime. |
| `sd.input` | `out-of-system` | Input is client-owned intent; host Lua cannot synthesize local device input. |
| native manual-spawner/test controls and unowned inventory/loot internals | `out-of-system` | Diagnostics are not promoted as product APIs; only existing semantic owners are exposed. |
| native `sd.debug` memory/call/trace/watch/backbuffer family | `blocked-by-platform` | The clean rebuild has no retail address space, native ABI, or D3D9 backbuffer. |

## Ownership and lifecycle thread

```text
browser Settings -> persistent local Enable Cheats
  -> host session + enabled setting installs window.solomonDark.lua
  -> execute(code) emits bounded client-lua-execute(requestId, code)
  -> game host rejects non-host before VM creation
  -> first accepted request lazily initializes one sandboxed Lua 5.4 VM
  -> request enters bounded FIFO
  -> next 100 Hz boundary executes one chunk and captures print/returns/errors
  -> semantic commands apply through existing authoritative components
  -> simulation step consumes optional Lua enemy spawn intents
  -> post-step state differences dispatch subscribed Lua events
  -> server-lua-result resolves the originating browser promise
  -> disable removes browser surface immediately
  -> disconnect rejects pending promises; host close destroys VM/timers/state
```

The browser setting is deliberately not trusted authorization. Host identity is
already an authenticated, replicated session fact, and the server checks it for
every execution request. Host migration transfers execution authority to the
new host without preserving a stale socket privilege.

## Recovered behavioral contract

- Lua is not a second simulation. It observes immutable semantic copies and
  queues commands into current TypeScript owners.
- The VM stays absent/cold unless an accepted host request arrives. Before
  initialization the host performs one nullable check; an initialized but idle
  VM performs constant-time empty scheduling without constructing a semantic
  frame or scanning actors.
- Console chunks run at most one per fixed tick. Fresh chunks have a 4 ms
  instruction timeout, stored callbacks have 2 ms each, and measured Lua work
  has a 4 ms aggregate tick budget independent of TypeScript simulation time.
- Callback-authored commands are not applied reentrantly. Post-step events queue
  commands for the following tick.
- Values crossing JS/Lua/protocol are finite, acyclic, bounded JSON-shaped
  nil/boolean/number/string/array/object values. Functions, userdata, threads,
  oversized/deep graphs, and non-finite numbers fail closed.
- Script errors are data returned to DevTools. Callback errors are logged and
  remove the callback; neither may fail the authoritative host.
- The server bundle remains platform-independent: bundled JavaScript bridge
  plus one adjacent immutable WASM, no native Node addon.

## Web implementation consequence

- Correct owner: `game/host/lua/` for separate VM scheduler, API, value-contract,
  and command-adapter modules;
  protocol owns only bounded wire shapes; client session owns request
  correlation; settings/console modules own local UX.
- `stepGameSimulationTick` gains an optional typed external spawn-intent input,
  not a Lua dependency. Core kernels remain browser-safe.
- The browser DevTools API is `window.solomonDark.lua.execute(code)` with
  `help()`, typed result data, and console rendering. It is installed only while
  cheats are enabled and the connected participant is host.
- No package loader, compatibility shim, JavaScript eval, DOM bridge, or native
  API placeholder is added.

Custom Boneyard geometry remains on the existing stage-report/catalog path and
therefore works with this runtime once it is already present in a session. Lua
stock-enemy spawning uses that loaded scene's ordinary collision/materializer.
Resolving Website library ZIPs into sessions, composing mod-authored wave files,
and loading Lua entry scripts from those packages are deliberately the next
package-runtime slice, not hidden fallback behavior in this one.

The wire and runtime limits are: eight pending executions, 48 KiB of
JSON-encoded code, 64 print lines / 4 KiB per line / 16 KiB aggregate output,
16 return values / 24 KiB aggregate returns, 16 levels and 2,048 nodes per
wire value, 64 KiB state, 128 event handlers, 256 timer callbacks, 256 semantic
commands per tick, and a 16 MiB Lua allocator ceiling. JSON escaping is counted
before a message is accepted, so a syntactically small string cannot expand
past the 64 KiB WebSocket envelope.

## Validation contract

- VM: version, sandbox, persistent globals, print/returns, syntax/runtime
  errors, timeout, memory, values, state, callbacks, timers, close.
- Membership: a positive test for every exact-ported API and an absence test for
  every out-of-system/blocked namespace.
- Protocol: malformed/oversized request and result rejection, version bump,
  retired/unknown message rejection.
- Host: guest rejection without VM allocation, lazy host creation, same-tick
  command ordering, enemy spawn integration, migration, disconnect and close.
- Client/settings: persistence, corruption reset, request correlation,
  timeout/disconnect, enable/disable install/remove, dynamic host authority.
- Browser: real title Settings flow, DevTools query/mutation/tick callback,
  infinite-loop rejection, disable removal, no page/console errors.
- Performance: no-Lua host benchmark equality; lazy init receipt; active trivial
  callback p95/p99/max below the fixed-tick budget on Mac hardware.

## Implementation validation receipt

The exact WSL candidate passed `./scripts/validate.sh`: 24 backend contracts,
136 prerequisite tests, 900-plus game/frontend tests including the new VM,
protocol, host, client, settings, and semantic-adapter suites, the desktop and
Hub gates, TypeScript, both production host bundles, browser build, route
budget, and media policy. Protocol 31 and the built adjacent `lua54.wasm` were
exercised rather than inferred from source.

The focused built-browser receipt used Chrome `150.0.7871.124`, the production
SPA, bundled `game-host.mjs`, and its sibling 271,581-byte WASM. Cheats were
off and the VM absent before the Settings toggle. The real DevTools surface
then proved Lua 5.4, API `0.1.0`, sandbox absences, print/structured returns,
gold/state/seed mutations, a persistent `runtime.tick` handler, timeout of an
infinite loop, seeded Boneyard entry, stock Skeleton materialization, the
`enemy.spawned` notification, immediate console removal on a storage-setting
change, and VM retirement at zero players. Lazy initialization was `39.71 ms`
and reported Lua allocation was 28,532 bytes. Across 120 active callback
samples, Lua-work p50/p95/p99/max was
`0.335/0.498/1.312/2.263 ms`; page errors and unexpected console/network errors
were empty. Three MP3 requests were deliberately aborted by scene audio
replacement and are retained separately from failures.

The candidate was then rebased onto Website `6c11fb0`, preserving the new loot,
Solomon Dig audio, Golem, and authoritative gameplay-pause systems. Because
pause and Lua had independently claimed protocol 31, the combined contract is
protocol 32. The resolved WSL tree passed the complete gate with 40 loot tests,
140 prerequisites, and 1,002 broad game/frontend tests. Its built-browser run
again covered the complete journey; callback p50/p95/p99/max was
`0.371/0.666/3.316/4.261 ms` across 120 samples, with two measured 4 ms budget
crossings under concurrent WSL browser load and no retained process or VM.

## Exact Apple-M2 acceptance

Implementation commit `30be55ca77c6aff97ec44b07cffe5fc135e2ee15`, tree
`7d3c48e00ad9fd4fb186def3bba7cd3ea7bea073`, was transferred in the incremental
Git bundle whose SHA-256 was
`7ee47850ae55ad15e1a43e0083f9653f2eff1b05597b6a17bde55a18add20cf9`.
It was checked out cleanly at
`/Users/jarrett/codex-acceptance/web-lua-runtime-20260820-v1/website` on the
arm64 Apple-M2 Mac mini running macOS `26.4.1`, Node `22.17.0`, npm `10.9.2`,
.NET `10.0.302`, and Chrome `151.0.7922.138`.

`/opt/homebrew/bin/bash ./scripts/validate.sh` exited zero on that exact tree:
24 backend contracts, 40 loot tests, 140 prerequisites, 1,002 broad
game/frontend tests, 5 level-up tests, 6 diagnostics tests, 14 Hub UI tests,
5 desktop tests, strict formatting/lint/import boundaries, both production
host bundles, the browser build, route budget (`214047` raw / `62862` gzip),
and media policy all passed. The log SHA-256 is
`c3cbf9e0c9f01e0bb550644994fb61280fa32414a42e1a77e6ded4b1296496da`.

Three fresh-host/fresh-Chrome invocations of
`npm --prefix frontend run smoke:game:lua-console` then passed. Lazy init was
`18.579`, `17.842`, and `17.607 ms`; each VM reported 28,532 bytes of Lua
allocation, the cold host reported `lua: null`, and protocol 32 used the
4,414,891-byte bundled host plus the 271,581-byte adjacent WASM. Across 120
active callback samples per pass, p50/p95/p99/max was respectively:

- `0.207/0.749/1.429/1.589 ms`;
- `0.208/0.806/1.760/2.123 ms`;
- `0.197/0.527/0.860/1.184 ms`.

Every pass had zero budget crossings, page errors, unexpected console errors,
or request failures. The one console error in each receipt was the deliberately
executed infinite loop being interrupted after `10.9`, `13.7`, and `15.8 ms`
of end-to-end browser round-trip time. All three entered the seed-42 Boneyard,
materialized actor 1 through the ordinary enemy owner, removed the DevTools API
when cheats were disabled, and returned health to zero players / `lua: null`.
The three log SHA-256 values are
`34d73469e946f876054bd50d6f471fd1e1c12f4be8dafe9fbb3b72e7ab2ec73b`,
`6b9ce90eee8ae42b0c7d8fab0881020fc5a7496141b3d48f697ac8f937ebbcea`,
and `4a2edaaf6c64e5a1c3b841a8d2bb14d52e2b9354223fdfe65593a0432b13afbe`.
The Mac worktree stayed clean and no command referencing the acceptance root
remained. This receipt paragraph changes documentation only; the implementation
tree tested above is unchanged.

## Final concurrent-main cutoff

The task then incorporated the independently published deployed-revision,
Skeleton head-facing, and late-light corrections through Website `63f9587`.
The three independent schema additions—pause, Skeleton head-facing, and
Lua—therefore converge as protocol 33. Cutoff commit
`b249af3ac293b85efbc405fd47f2a33197fa60ea`, tree
`05245cf420c521e36f72d26cd3245a457a1c19b5`, was transferred in bundle
`c668a4ed5931a2fbc558829c76f7ebd3735b760750b092ee1d07b87cbc7481d7`
and checked out cleanly at
`/Users/jarrett/codex-acceptance/web-lua-runtime-20260820-v3-cutoff/website`.

The exact cutoff Mac gate passed 24 backend contracts, 40 loot tests, 143
prerequisites, 1,009 broad game/frontend tests, and every auxiliary/build gate;
the Game entry was 216,067 raw / 63,696 gzip bytes. Its log SHA-256 is
`bd42f0857ec24aaef9cf2fbb2616737ec3833344331c69b4c481c1d503dc403b`.
The exact cutoff browser journey again passed with Chrome `151.0.7922.138`,
protocol 33, `19.063 ms` lazy initialization, zero budget crossings or
unexpected errors, and Lua callback p50/p95/p99/max
`0.211/0.531/0.668/1.115 ms`. Its log SHA-256 is
`da4d4cb9eaf131f8b770ebe1b88898cafa1af56b86b1dd6d3092b6ea505f09d6`.
It retained the corrected late-light Boneyard, completed the seed/spawn/event
path, and retired to zero players / no VM. The worktree remained clean with no
task process. This final paragraph is receipt-only documentation; the tested
cutoff implementation is unchanged.
