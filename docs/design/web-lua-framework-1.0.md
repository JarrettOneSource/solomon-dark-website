# Web Lua framework 1.0

Status: **proposed; not implemented**

This document recommends the settled shape of Lua modding for the Solomon Dark
web port. The Website is the only target. Native Mod Loader documents are useful
evidence about semantic game seams, but the Loader is being retired and does not
constrain the public contract.

Related documents:

- [Domain language](../../CONTEXT.md)
- [Content-family contracts](web-lua-content-families.md)
- [Mod wargames](web-lua-framework-wargames.md)
- [Delivery plan](web-lua-framework-delivery-plan.md)
- [ADR 0001](../adr/0001-web-lua-progressive-definition-graph.md)

## Outcome

Web Lua 1.0 should be a declarative content compiler with progressive disclosure:

1. A mod returns one atomic definition graph.
2. Beginner kits and prefabs expand into ordinary graph nodes with safe defaults.
3. Rules cover common event/condition/effect behavior without Lua callbacks.
4. Advanced reducers cover genuinely procedural authority behavior by returning
   complete next state plus validated intents transactionally.
5. The browser receives trusted catalogs and presentation models. It never runs
   mod Lua, accepts arbitrary DOM/CSS/JavaScript, or consumes per-frame draw packets.

The framework—not the author—owns content identity, package assets, authority,
fixed-tick timing, replication, late join, saves, action deduplication, rollback,
resource budgets, and teardown.

## Current Website baseline

The existing `0.2.0` runtime already supplies several good invariants:

- Lua 5.4 runs only in isolated, bounded game-host VMs.
- One immutable mod set is materialized in dependency/priority/id order.
- Registration is entrypoint-only, atomic, and rolled back on failure.
- Content identity uses deterministic `sd.content.v1` IDs.
- Package paths and PNG/bundle assets are bounded and owned by one mod.
- The Invincibility Potion proves custom potion, loot, inventory, save,
  consumption, damage/mana filters, replication, and browser presentation.
- Boneyard packages are parsed and admitted independently of Lua.

The current public surface is not yet a general content framework. It registers
only custom potions, sprite atlases, and additive loot. It exposes stock enemy
reads/spawns, semantic events, two filters, timers, session state, and selected
resource mutations. It cannot define general items, skills, powerups, affixes,
spells, enemies, shops, UI, rooms, portals, or scenes. Package files are limited
to sprite PNG/bundle pairs, and presentation behavior is hard-coded around the
custom consumable catalog.

The current Invincibility Potion is the clearest ergonomics failure: a basic
timed status requires a participant-indexed Lua table, five callbacks, timer
replacement and cancellation, two filters, and explicit run cleanup. A junior
author should never have to reconstruct that lifecycle correctly.

## Requirements

### Beginner contract

A junior author must be able to build a complex mod by copying and modifying
literal tables. The common path must require no knowledge of networking,
authority, protocol messages, fixed ticks, cleanup, save encoding, actor IDs,
renderer ownership, or native data structures.

Defaults must be safe and visible:

- timed statuses refresh instead of multiplying unexpectedly;
- player effects target the initiating player unless declared otherwise;
- simulation is host-authoritative;
- content is saved by stable identity when its scope is saveable;
- presentation retires with the same instance as its mechanics;
- unknown fields and unresolved references fail with a source path and fix;
- exclusive mount conflicts fail rather than silently choosing by priority.

### Senior contract

Senior authors need composition and procedural behavior without an unsafe escape
hatch. They may declare schemas and write authority reducers over immutable
semantic input. A reducer returns a complete next state and a list of intents.
If it throws, times out, or returns invalid data, nothing commits.

Senior access does not include raw core-state mutation, sockets, Node, DOM,
Pixi, filesystem paths, protocol packets, renderer objects, or dynamic content
registration after admission.

### Platform contract

- The Website is the sole runtime and distribution target.
- The game host is the sole shared simulation authority.
- Browsers use trusted TypeScript presentation primitives driven by ordinary
  snapshots and bounded mod presentation models.
- Core kernels remain free of Lua imports. Mod behavior crosses one semantic
  simulation seam.
- Exact enabled package/content/art parity remains mandatory for a party.
- The base game remains playable when a non-critical runtime rule fails.

## Alternatives considered

### Design A: pure definition graph

```lua
return sd.define({
  api = "1.0.0",
  assets = { ... },
  facts = { ... },
  content = { ... },
})
```

This design has one method, no runtime callbacks, and closes the build VM after
compilation. It maximizes depth, determinism, and safety. It is excellent for
junior authors and portable browser presentation because every behavior is a
versioned data node.

Its weakness is expressiveness. A finite predicate/action grammar eventually
becomes programming in data, while every novel algorithm requires a new schema
primitive and Website release.

### Design B: scoped handles and builders

```lua
local app = sd.open()
local items = app:use("items", 1)

app:catalog(function(catalog)
  potion = items:potion(catalog, "invincibility")
    :duration_ms(180000)
    :stacking("refresh")
    :publish()
end)

return app:ready()
```

This design makes every lifetime an explicit `Scope`, provides fluent family
builders, and exposes `DefinitionRef`, `Cell`, and asynchronous `Request`
handles. It gives senior authors strong composability and makes stale-handle
errors precise.

Its weakness is interface weight. Catalog phases, module negotiation, builder
commit rules, parent scopes, cells, request completion, and stale handles are
framework concepts a beginner must learn before creating content. A variant
that runs browser presentation VMs was rejected: it duplicates runtime and
sandbox cost and violates the Website's clean server-authority model.

### Design C: progressive graph with kits and reducers

```lua
return sd.mod({
  api = "1.0.0",
  content = {
    sd.kit.potion({ ... }),
    sd.kit.ui({ ... }),
  },
  systems = {
    sd.advanced.reducer({ ... }),
  },
})
```

Kits, prefabs, raw definitions, finite rules, and advanced reducers all compile
into one graph and one ownership model. The beginner path is literal data; the
advanced path exists without bypassing authority or transactionality.

Its risk is accidental duplication: kits and raw definitions must not become two
runtime implementations. A kit is only a standard constructor that expands to
ordinary graph nodes and receives the same validation and lifecycle semantics.

### Decision

Adopt Design C. Use Design A's immutable compiler as the external seam and use
Design B's ownership-tree scopes inside the implementation. Do not expose
runtime scopes or handles on the beginner path.

## Proposed author interface

### Package shape

```text
manifest.json
scripts/
  main.lua
art/
  ...
audio/
  ...
levels/
  ...
tests/
  ...
```

The authored manifest keeps identity, version, dependency, and entrypoint data:

```json
{
  "$schema": "/mod-manifest.schema.json",
  "id": "example.monument-crypt",
  "name": "The Monument Crypt",
  "version": "1.0.0",
  "runtime": {
    "apiVersion": "1.0.0",
    "entryScript": "scripts/main.lua"
  },
  "requiredMods": []
}
```

`minimumLoaderVersion` is removed because the native Loader is not a target.
Ordinary capabilities are derived from the compiled graph and reported by
`sdmod check`; juniors do not copy a manually synchronized capability array.

### Root

```lua
---@param spec SdModDefinition
---@return SdCompiledMod
sd.mod(spec)

---@param kind string
---@param key string
---@param mod_id string|nil
---@return SdContentReference
sd.ref(kind, key, mod_id)
```

An entry script returns exactly one `sd.mod` result. It may construct ordinary
Lua tables and call definition constructors, but it cannot observe players,
time, random values, network state, or the current scene during the definition
phase.

```lua
return sd.mod({
  api = "1.0.0",
  assets = {
    potion_icon = sd.art.sprite("art/invincibility-potion.png"),
  },
  content = {
    sd.kit.potion({ key = "invincibility_potion", ... }),
  },
  rules = {},
  systems = {},
})
```

### Definition constructors

The public namespaces are definition-time only:

```lua
sd.art.sprite(path, options)
sd.art.sheet(spec)
sd.art.sound(path, options)
sd.art.music(path, options)

sd.kit.item(spec)
sd.kit.skill(spec)
sd.kit.powerup(spec)
sd.kit.potion(spec)
sd.kit.affix(spec)
sd.kit.affix_pool(spec)
sd.kit.spell(spec)
sd.kit.enemy(spec)
sd.kit.boneyard(spec)
sd.kit.shop(spec)
sd.kit.ui(spec)
sd.kit.room(spec)
sd.kit.scene(spec)
sd.kit.scene_extension(spec)

sd.prefab.projectile(spec)
sd.prefab.area(spec)
sd.prefab.channel(spec)
sd.prefab.enemy(base, overrides)
sd.prefab.minimap(spec)
sd.prefab.portal(spec)
```

Constructors return definition fragments, not live instances. Declaration order
does not create registration dependencies; typed references are resolved after
the complete graph is assembled.

### Rules

Finite rules produce a serializable AST:

```lua
sd.rules.on(event, node, options)
sd.rules.all(nodes)
sd.rules.first(nodes)
sd.rules.when(predicate, yes, no)
sd.rules.after(duration, node)
sd.rules.every(interval, node, options)

sd.effect.status(spec)
sd.effect.resource(spec)
sd.effect.damage(spec)
sd.effect.spawn(spec)
sd.effect.grant(spec)
sd.effect.transition(spec)
sd.effect.state(spec)
sd.effect.emit(spec)
sd.effect.present(spec)
```

Rules cover common mechanics without retaining Lua callbacks. They can reference
only declared semantic fields and Website-owned operations.

### Advanced reducers

```lua
local phase_state = sd.schema.object({
  phase = sd.schema.enum({ "normal", "enraged" }),
  kills = sd.schema.integer({ default = 0, min = 0, max = 999 }),
})

sd.advanced.reducer({
  key = "tyrant_phases",
  scope = "entity",
  schema_version = 1,
  state = phase_state,
  on = { "enemy.death", "entity.health_changed" },
  reduce = function(state, event, context)
    local next = { phase = state.phase, kills = state.kills }
    local intents = {}
    if event.kind == "enemy.death" then next.kills = next.kills + 1 end
    if next.phase == "normal" and context.entity.health_ratio < 0.35 then
      next.phase = "enraged"
      intents[1] = sd.intent.status({
        target = context.entity,
        status = sd.ref("status", "enraged"),
      })
    end
    return next, intents
  end,
})
```

Reducer rules:

- execute only on the authoritative fixed-tick lane;
- receive immutable, bounded semantic values;
- use deterministic named RNG domains through `context.random(name)`;
- cannot retain live actor or renderer handles;
- commit state and intents together or not at all;
- are bounded per callback and aggregate per mod;
- use declared scope to derive replication, saving, late join, and teardown.

## Definition compilation

One deep `ModCompiler` owns the admission sequence:

1. Validate manifest identity, package bounds, and file containment.
2. Evaluate the entry script in a stripped, bounded definition VM.
3. Expand kits and prefabs into primitive definitions.
4. Normalize values, derive stable IDs, and resolve typed references.
5. Validate family schemas, assets, mount ownership, dependencies, cycles,
   budgets, and Website primitive availability.
6. Infer required host and presentation capabilities from the compiled graph.
7. Canonicalize and hash the graph and every asset.
8. Prepare immutable simulation and presentation catalogs as one transaction.

No content graph is partially admitted. The canonical graph digest joins the
session manifest. In development, hot reload is a full graph replacement and is
disabled once a multiplayer party is admitted.

## Runtime modules behind the seam

The public interface stays small because the implementation is split into deep
modules with internal seams:

- **ModCompiler** — definition evaluation, graph validation, normalization,
  capability inference, diagnostics, and catalog production.
- **ContentIdentityRegistry** — `sd.content.v1` identity, references, aliases,
  dependency exports, collisions, and stable save keys.
- **AssetCompiler** — typed art/audio validation, content addressing, browser
  readiness, caching, leases, and cleanup.
- **RuleEngine** — rule AST and advanced reducer evaluation with transactional
  state and intent output.
- **IntentExecutor** — adapts accepted semantic intents to existing game owners;
  core kernels never import Lua.
- **LifecycleSupervisor** — the internal ownership tree for status, entity,
  cast, scene, UI, audio, subscription, and timer lifetimes.
- **ModStateStore** — typed player/run/scene/profile state, revisions,
  checkpoints, late join, and pure migrations.
- **ReplicationProjector** — bounded semantic catalogs, state deltas, instance
  lifecycles, events, and presentation parameters.
- **ClientPresentationRuntime** — trusted TypeScript components that bind a
  presentation model to ordinary snapshots. It contains no Lua VM.
- **Family adapters** — inventory/equipment, progression, combat, enemies,
  Boneyards, shops, UI, and scenes, each tested through the common runtime seam.

A target TypeScript seam should remain compact:

```ts
interface PreparedModSession {
  catalog(): ModSessionCatalog
  step(input: ModStepInput): ModStepResult
  act(input: ModActionInput): ModActionResult
  project(viewer: ModViewer): ModPresentationModel
  checkpoint(): ModCheckpoint
  close(): void
}
```

The exact method names may change during implementation; the important design
constraint is that `game-host` coordinates one prepared session instead of
learning every content-family registry.

## Authority and lifecycle

1. Definitions and catalogs are immutable after admission.
2. Simulation rules and reducers execute only on the game host.
3. Browser actions are typed intents carrying mod, content, participant,
   session, request, and scene identities. The host authenticates, deduplicates,
   revalidates visibility and current state, then commits atomically.
4. Presentation is local and read-only. Shared facts arrive through snapshots
   and mod state; no client presentation decision changes gameplay.
5. Content ordering is dependency order, mod ID, then declaration order.
6. Timed mechanics use pause-aware simulation ticks by default.
7. Modifier algebra is fixed: base, additive, multiplicative, then clamps.
   Cancellation is monotonic.
8. A content instance owns all child mechanics and presentation. Closing the
   parent is forced, recursive, idempotent, and cannot be prevented by Lua.
9. Player/profile state is participant-owned; run, scene, and party state is
   authority-owned. Definitions declare the scope rather than calling save APIs.
10. Late joiners receive current catalogs and scoped state, not replayed events.
11. Host loss ends the current modded run until authority migration is designed
    explicitly; 1.0 does not elect or guess a replacement.

## Failure model

- Definition, asset, graph, capability, dependency, and migration errors fail
  admission before play.
- A rule or reducer failure contributes no state change or intent. The base game
  behavior and last valid mod state remain.
- A failed purchase, cast, pickup, or transition rejects that action only.
- Repeated runtime failures or budget overruns disable the offending reducer and
  close its owned dynamic instances; they do not leave timers or actors behind.
- Missing presentation assets are admission errors, not fallback icons.
- Two mods claiming the same exclusive stock anchor fail with both owners named.
  Additive mounts are accepted only where the anchor contract says they compose.

Errors must be actionable:

```text
E_REFERENCE canary.example content.shop.stock[2].item
scripts/main.lua:48: no item named "invincibility_poiton" exists.
Did you mean "invincibility_potion"?
```

```text
E_AUTHORITY example.minimap action.spawn_enemy
The minimap presentation may submit only its declared "ping" intent.
Move shared simulation behavior into a rule or advanced reducer.
```

## Author experience

The framework is not settled until its tools make the safe path the easy path:

- `sdmod new <kind>` creates a minimal mod and one working kit example.
- `sdmod check` runs the real definition compiler, asset validators, reference
  resolver, budget estimator, and save-schema checks without launching a game.
- `sdmod test` runs Lua-authored scenarios against in-memory game adapters.
- `sdmod pack` emits the canonical graph digest and generated capability report.
- `sdmod migrate 0.2 1.0` converts mechanical definitions and produces explicit
  TODOs for callback behavior.
- Generated LuaLS stubs, schemas, examples, and documentation come from one
  binding/definition registry and are drift-checked in CI.
- Diagnostics name the mod, source location, graph path, phase, error code,
  budget, and suggested correction.

## Versioning and cutover

Use `runtime.apiVersion = "1.0.0"` as a real cutover.

- Preserve `sd.content.v1` identity so unchanged package IDs and content keys
  retain their save identity.
- Remove `minimumLoaderVersion` and other native-Loader compatibility metadata
  from the Website package contract.
- Generate ordinary capability requirements from the compiled graph; authors
  should not maintain a manual `requiredCapabilities` array.
- Freeze new `0.2.0` uploads, migrate first-party packages and retained saves,
  then remove the old runtime. Do not expose `0.2.0` aliases inside 1.0.
- Existing `.boneyard` bytes remain valid assets and are wrapped by a Boneyard
  definition rather than rewritten.
- Kits receive framework-owned compatible schema migrations. Advanced reducers
  must provide pure explicit migrations for incompatible state changes.
- Renaming a content key is deletion plus addition unless an explicit migration
  maps the previous stable identity.

The first migrated package is Invincibility Potion. Its package ID and
`invincibility_potion` key remain unchanged; its manual callbacks, timers, and
filters become one framework-owned timed status. That migration is the proof
that 1.0 removes author complexity instead of merely renaming it.
