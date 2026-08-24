# Web Lua 1.0 delivery plan

Status: **proposed execution plan; no framework code is implemented by these documents**

The work should proceed as vertical slices, each ending in a usable mod. Building
eleven registries horizontally would create a large unproven interface and leave
authority, presentation, save, and teardown integration until the end.

## Target and non-goals

Target: one Website-only Web Lua 1.0 framework implementing the design in
[web-lua-framework-1.0.md](web-lua-framework-1.0.md).

Non-goals:

- preserving native Mod Loader execution or public compatibility;
- running Lua in browsers;
- exposing Node, DOM, Pixi, protocol, filesystem, or network primitives;
- keeping a permanent `0.2.0` shim inside the 1.0 interface;
- claiming a content family complete before its solo, multiplayer, late-join,
  save, presentation, and teardown paths exist.

## Phase 0: freeze the contract and retire Loader ownership

Deliverables:

- accept the glossary and [ADR 0001](../adr/0001-web-lua-progressive-definition-graph.md);
- declare the Website the sole mod package/runtime target;
- inventory first-party packages and retained saves that use `0.2.0`;
- move canonical first-party mod source/assets out of the retired Loader repo;
- mark `minimumLoaderVersion` and Loader-only package documentation deprecated;
- freeze new public `0.2.0` features and uploads;
- choose exact 1.0 graph/value/error/versioning conventions.

Exit evidence:

- one checked-in machine-readable graph schema draft;
- generated LuaLS declarations for that draft;
- fixed `sd.content.v1` identity vectors, including Invincibility Potion;
- a migration inventory with package/content/save hashes;
- no document presents native Loader support as a Website requirement.

## Phase 1: definition compiler and author tooling

Build one deep `ModCompiler` before adding families.

Deliverables:

- `sd.mod`, `sd.ref`, `sd.schema`, and definition-only VM mode;
- graph normalization, typed references, dependency exports, cycle detection,
  canonical ordering/hash, capability inference, and aggregate budgets;
- typed asset catalog and content-addressed browser delivery for current PNG/
  bundle assets, with an extensible audio/animation metadata model;
- structured errors with mod, source, graph path, phase, stable code, and hint;
- `sdmod new`, `check`, `test`, `pack`, and generated LuaLS/schema docs;
- in-memory adapters for package files, clock, state, simulation, protocol, and
  presentation tests.

The production host continues running `0.2.0`; no 1.0 gameplay is advertised yet.

Exit evidence:

- two equivalent source graphs canonicalize to identical bytes/hash;
- bad references/assets/mounts/cycles/budgets produce deterministic diagnostics;
- package upload and session provisioning independently produce the same graph hash;
- a compiled empty mod adds no per-tick work and no browser payload;
- graph compilation is atomic across a multi-mod dependency set.

## Phase 2: Potion/status vertical slice

Use Invincibility Potion to establish the runtime model.

Deliverables:

- status/effect definitions and modifier algebra;
- internal ownership-tree `LifecycleSupervisor`;
- transactional Rule Engine and Intent Executor;
- generic custom item catalog replacing potion-specific catalog assumptions;
- timed participant/run scope, stacking policies, checkpoint/late-join state;
- presentation model for activation and actor-attached status VFX;
- migration of Invincibility Potion package ID/key/assets to 1.0;
- `sdmod migrate 0.2 1.0` support for mechanical sprite/item/loot fields.

Exit evidence:

- exact current Potion drop, pickup, Inventory, guest consume, mana, damage,
  VFX, expiry, run cleanup, save, and late-join behavior;
- the 1.0 author definition contains no event callback, timer, filter, participant
  map, authority branch, or cleanup function;
- repeated consume refreshes one lease;
- faults roll back one action and leave base-game mechanics intact;
- current `0.2.0` package and 1.0 package are never mixed in one session.

## Phase 3: trusted presentation and Minimap vertical slice

Minimap is the forcing function for generic mod UI.

Deliverables:

- `ClientPresentationRuntime` in trusted TypeScript;
- versioned UI/presentation model and protocol projection;
- bounded mounts, responsive layout, visibility predicates, semantic bindings,
  typed authority actions, focus/modal/accessibility ownership, and cleanup;
- scene geometry/read model, viewer visibility, objectives, portals, and
  local player/spectator `camera_subject` projection;
- `sd.kit.ui` and `sd.prefab.minimap`;
- desktop/mobile presentation budget telemetry.

Exit evidence:

- Minimap works in Hub, Boneyard, spectating, and a test room;
- no browser Lua VM, per-frame host draw stream, arbitrary DOM, or information
  outside the viewer's declared projection;
- host and guest may have independent layout while seeing shared world facts;
- late join and scene epoch changes replace state atomically;
- 500-actor stress stays within declared marker/update budgets.

## Phase 4: scenes, rooms, triggers, and monument dungeon

Build the hardest requested world seam before broad content expansion.

Deliverables:

- typed Room/Scene/Boneyard/Anchor/Trigger/Portal definitions;
- semantic stable IDs for stock Boneyard monument objects;
- party and player instancing policies;
- party transition transaction with readiness barrier and rollback;
- scene stack with explicit replace/push/return and parent suspension policy;
- scene epochs, input freeze, placement, reconnect, late join, checkpoint/save,
  renderer/assets/audio, and recursive teardown;
- one single-room Boneyard-backed monument dungeon.

Exit evidence:

- simultaneous host/guest activation creates one transition;
- missing content or load failure leaves every party member in the parent world;
- parent world suspension is defined for waves, enemies, timers, projectiles,
  loot, statuses, and reducers;
- dungeon save/resume restores scene stack, encounter, party, and return anchor;
- return resumes the exact parent checkpoint without duplicate events or actors;
- player-local Hub rooms remain independent from party dungeon transitions.

## Phase 5: economy families

Add generic items, powerups, affixes/pools, and shops as complete transactions.

Deliverables:

- generic item/equipment/material definitions and art programs;
- immediate powerup carriers and status/resource/skill effects;
- Affix and Affix Pool definitions, deterministic RNG domains, item save model,
  and equipment recomputation;
- Shop catalog, stock scopes, restock policies, NPC/interaction mounts, and
  trusted native-style browser UI;
- item/powerup/affix/shop intents through one atomic economy adapter.

Exit evidence:

- generic material and powerup drop/pickup/save/late-join paths;
- one authored affix survives generation, reforge, equip, transfer, save/reload,
  and Unforge;
- simultaneous last-item purchases produce exactly one debit/grant/decrement;
- capacity, insufficient gold, stale UI, duplicate request, bad applicability,
  and disconnect all reject atomically;
- stock shops and economies remain unchanged without a relevant mod.

## Phase 6: progression and spells

Deliverables:

- stable-ID mod skill book beside the fixed stock skill book;
- Skill/Subskill offer, prerequisites, ranks, picker, Skill Book, quickbar, save,
  and modifier derivation;
- Spell definitions, input selection, cast intents, mana/cooldown transaction,
  targeting, prefab projectile/area/channel programs, effect snapshots, hit
  attribution, audio/VFX, and teardown;
- player and enemy caster contexts using the same Spell definition without
  conflating progression ownership.

Exit evidence:

- one mod skill appears in real deterministic offers and persists per player;
- one subskill modifies one custom spell across save/reload;
- host and guest cast with correct owner, mana, cooldown, dedupe, collision,
  damage, and presentation;
- an enemy casts the same definition through its declared attack policy;
- save during a live field follows an explicit restore/retire policy;
- removing the mod cannot leave quickbar, rank, modifier, or effect ghosts.

## Phase 7: enemies and Boneyard composition

Deliverables:

- Enemy Archetype definitions with verified bases, stats, attacks, AI prefabs,
  art/animation/audio, loot, and stable tombstones;
- generic hostile presentation adapter and asset readiness;
- custom-enemy references in Boneyard rosters/waves and scene encounters;
- Boneyard definition wrapper for existing bytes plus anchors, environment,
  roster, triggers, and additive wave composition;
- advanced reducer examples for a multi-phase boss.

Exit evidence:

- one custom enemy completes spawn, movement, attack, status/damage, death,
  loot, replication, late join, save policy, and recursive child cleanup;
- host alone executes AI; browsers receive semantic outcomes/presentation;
- Boneyard parser and graph validator reject bad references before launch;
- enabling a custom enemy does not perturb stock RNG domains or family behavior;
- a 100-enemy stress run stays inside host, protocol, and renderer budgets.

## Phase 8: advanced reducers and 1.0 cutoff

The reducer escape hatch lands only after the standard families prove the intent
and lifecycle model.

Deliverables:

- versioned state schemas, immutable context, pure migrations, named RNG streams,
  transactional next-state/intent commit, budgets, and circuit breaker;
- source debugger/trace for event, state, intent, commit, rollback, and scope;
- first-party examples rewritten to kits/rules and one advanced boss reducer;
- removal of `minimumLoaderVersion`, Loader language, manual ordinary capability
  arrays, and frozen `0.2.0` runtime after package/save migration;
- Web Lua 1.0 author documentation and stable support policy.

Exit evidence:

- reducer exception/timeout/invalid state/intent commits nothing;
- repeated faults disable only the reducer and close its owned instances;
- deterministic replay produces identical state/intents from the same inputs;
- every requested family has at least one shipped, browser-proven example;
- all known `0.2.0` packages/saves are migrated or explicitly retired;
- no production code path loads native Mod Loader compatibility metadata.

## Repository module shape

The exact filenames are implementation decisions, but the target ownership should
look like this rather than extending the current content-registry monolith:

```text
backend/
  package admission + graph/assets validation mirror

frontend/src/game/modding/
  definition/       graph schema, compiler, identity, diagnostics
  runtime/          rule engine, intents, scopes, state, checkpoints
  families/         item, progression, spell, enemy, boneyard, shop, scene adapters
  presentation/     trusted catalog/view-model schemas and browser runtime

frontend/src/game/host/lua/
  stripped definition VM + advanced reducer execution adapter

frontend/tools/sdmod/
  new, check, test, pack, migrate
```

The external host seam remains one prepared mod session. Family modules are
internal adapters, not methods added directly to `game-host`.

## Validation strategy

### Compiler and package

- golden canonical graphs and hashes;
- backend/host differential compilation;
- schema, path, asset, reference, dependency, collision, mount, budget, and
  migration rejection;
- generated schema/LuaLS/docs drift checks;
- malicious/cyclic/oversized Lua values and assets.

### Simulation

- headless in-memory scenarios through the same prepared-session interface;
- deterministic RNG and replay;
- action dedupe, authentication, atomic commit/rollback, and fault injection;
- fixed-tick budget and no-mod zero-work baseline.

### Multiplayer and saves

- host/guest/late join for every family;
- exact graph/art mismatch rejection;
- add/remove/upgrade/rename package save matrices;
- scene, run, player, party, and profile scope checkpoint matrices;
- disconnect, party mutation, deployment restart, and host close.

### Presentation

- semantic view-model tests plus real WebGL browser acceptance;
- host/guest and desktop/mobile layouts;
- exact art/audio readiness, scene epochs, late join, and teardown;
- page, console, network, host-error, GPU, and bundle-budget receipts;
- final acceptance on the Mac mini for shipped presentation slices.

### Canonical gates

Every implementation slice runs focused tests during development and the Website
canonical `./scripts/validate.sh` on the exact rebased tree before publication.
Publication and deployment remain separate, each with independent receipts.

## Commit strategy

Keep commits vertical and independently understandable:

1. contract/schema/tests;
2. deep module and in-memory adapter;
3. real host/core adapter;
4. protocol/presentation adapter;
5. save/late-join/teardown;
6. author tools/docs/example;
7. browser acceptance fixes.

Do not land a new public constructor whose family adapter, failure semantics, and
end-to-end example are deferred to a later unrelated branch.
