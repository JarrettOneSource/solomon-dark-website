# Web Lua 1.0 completion matrix

This documents the Website-only Web Lua `1.0.0` interface.
Native Mod Loader compatibility is not part of this contract.

The interface is intentionally smaller than the original design inventory. A
field is public only when package admission, host authority, save/restore,
multiplayer projection, presentation, rollback, and teardown have a defined
owner. Removed aliases and future-facing fields fail `sdmod check` instead of
being accepted and ignored.

## Evidence levels

- **Admission**: the real definition, asset, content, Boneyard, and package
  compilers accept or reject the package atomically.
- **Headless**: the packaged example executes through `PreparedModHost` or the
  prepared rule session, including state, transactions, saves, faults, and
  teardown.
- **Browser**: two real browser clients exercise the authoritative host and
  trusted presentation runtime.
- **Wearable browser**: the existing Hat, Robe, and Staff smoke covers the
  separate existing-slot wearable path.

The rows below point directly to the executable package, headless, and browser
coverage for each surface.

## Root and tools

| Surface | Status | Decisive evidence |
| --- | --- | --- |
| `sd.mod`, mandatory content `key`, root `systems` | Complete | Definition VM, graph compiler, generated LuaLS declarations, all three packages |
| Short names (`sd.item`, `sd.on`, `sd.sprite`), optional `sd.mod`, name-derived keys, string references, art path shorthand, potion defaults, effect lists | Complete | Definition runtime lowering, friendly runtime tests, Invincibility Potion and Apprentice Apothecary in the short form with unchanged content identities |
| `sd.include` with pack-time bundling and digest equivalence | Complete | Script bundle module, package authoring scripts map, `sdmod pack`, CLI bundling test |
| Predicate grammar (`equals`, `not_equals`, `above`, `below`, `at_least`, `at_most`, `all`, `any`, `none`) | Complete | Schema validator, rule engine, compiler and engine tests |
| Line-numbered script diagnostics with hints and close-name suggestions | Complete | `E_SCRIPT`, strict globals, read-only `sd`, suggestions module, generated DIAGNOSTICS.md |
| `sd.ref`, `sd.art.ref` | Complete | Typed local/dependency/stock references, asset ownership, cycle and missing-reference rejection |
| `sdmod new` | Complete | Creates a package that immediately passes production-shaped admission |
| `sdmod check` | Complete | Runs definition, decoded asset, content-catalog, and Boneyard admission |
| `sdmod test` | Complete | Exposes the actual compiled graph as `mod`; package tests assert their own definitions |
| `sdmod pack` | Complete | Deterministic ZIP, canonical graph, and digest |
| generated schema, LuaLS, reference, diagnostics, starter | Complete | Drift-checked generation from the current constructor and field inventory |

## Assets

| Surface | Status | Supported role |
| --- | --- | --- |
| `sd.art.sprite` | Complete | One PNG sprite or explicit frame rectangles |
| `sd.art.sheet` | Complete | Validated grid, named animation rows, optional directional headings |
| `sd.art.wearable` | Complete | Existing Hat, Robe, or Staff slot only; progressive native-sized pose rows |
| `sd.art.sound` | Complete | Effects-bus sound used by presentation, pickups, enemies, and spells |
| `sd.art.music` | Complete | Scene/Boneyard-owned music loop with teardown |
| `sd.art.boneyard` | Complete | Typed `.boneyard` document bound to the Boneyard definition's source |
| `sd.art.scene` | Complete | Typed JSON scene-layout document bound to a scene definition |

Unknown asset aliases and metadata fail admission. Canonical file fields are
`path` for ordinary assets and `image` for sheets.

## Content families

| Constructor | Status | Supported 1.0 behavior |
| --- | --- | --- |
| `sd.kit.item` | Complete | Stackable inventory item, grant/shop/use, existing-slot wearable, save and removal |
| `sd.kit.potion` | Complete | Inventory, loot, atomic consume, resource/status rules, save and consume VFX |
| `sd.kit.status` | Complete | Fixed-tick duration, four stacking policies, incoming-damage and mana-spend modifiers |
| `sd.kit.powerup` | Complete | Host-owned world actor, collection rule, sprite, sound, save and Minimap marker |
| `sd.kit.affix`, `sd.kit.affix_pool` | Complete | Existing equipment types, deterministic weighted rolls, damage/mana modifiers, atomic reforge and save |
| `sd.kit.shop` | Complete | Hub/Boneyard mount, authored NPC marker, player/party/session stock, restock, purchase and reforge |
| `sd.kit.skill` | Complete | Real level-up offer/barrier, ranks, prerequisites, parent skills, spell/UI grants, Skill Book and quickbar |
| `sd.kit.spell` | Complete | Authenticated cast, mana, cooldown, area/projectile/channel effect actor, hit attribution, VFX/audio and save policy |
| `sd.kit.enemy` | Complete | Collision-valid spawn/movement, nearest-player attack, health/death, XP/gold, directional sheet, audio and tombstone |
| `sd.kit.boneyard` | Complete | Ordinary picker launch, environment mode, entry anchor, initial/wave rosters, triggers and music |
| `sd.kit.boast` | Complete | Namespaced Provokatus row, stock or owned icon, bounded failure producers, random-choice policy, success wave, score multiplier, save/reconciliation and stock-style pagination |
| `sd.kit.room`, `sd.kit.scene` | Complete | Party-owned trusted room-map overlay, ordered rooms, scene stack, checkpoint and parent-world suspension |
| `sd.kit.scene_extension` | Complete | Monument selector, leader/any-member policy, party entry and return |
| `sd.kit.ui` | Complete | Trusted Minimap, five mounts, typed scene/state visibility, read-only bindings and distinguishable declared actions |

Enemy spell-composition, arbitrary room physics, arbitrary UI trees, new
equipment slots, and new player classes are not accepted 1.0 fields.

## Rules, effects, and prefabs

| Surface | Status | Contract |
| --- | --- | --- |
| `sd.rules.on` | Complete | Closed, typo-checked event vocabulary plus one rule node |
| `sd.rules.all` | Complete | Ordered child intents |
| `sd.rules.first` | Complete | First child that produces intents |
| `sd.rules.when` | Complete | Boolean, event, or context predicate; malformed predicates fail admission |
| `sd.rules.after` | Complete | One fixed-tick delayed node with save/restore and scope teardown |
| `sd.rules.every` | Complete | Fixed interval plus mandatory finite `times` count |
| `sd.effect.damage` | Complete | Player, native-enemy, or mod-enemy damage with attribution and modifiers |
| `sd.effect.resource` | Complete | Health, mana, gold, or experience |
| `sd.effect.status` | Complete | Player-target status application |
| `sd.effect.spawn` | Complete | Powerup, mod enemy, or supported stock enemy token |
| `sd.effect.grant` | Complete | Atomic item/potion grant with capacity rollback |
| `sd.effect.state` | Complete | Scoped semantic state set or clear |
| `sd.effect.present` | Complete | Declared sound presentation only |
| `sd.prefab.area` | Complete | Bounded duration, interval, radius, repeated target selection and browser area VFX |
| `sd.prefab.projectile` | Complete | Bounded flight, first-hit resolution and browser projectile VFX |
| `sd.prefab.channel` | Complete | Caster-owned line, interval hits and teardown |
| `sd.prefab.minimap` | Complete | Party, visible-hostile and powerup layers |
| `sd.prefab.portal` | Complete | Boneyard Monument to declared party scene |

`sd.intent.*` mirrors the seven effect operations for advanced reducers:
`damage`, `resource`, `status`, `spawn`, `grant`, `state`, and `present`.
There is no accepted-but-unobserved generic `emit` operation and no low-level
transition intent; scene transitions use the scene/portal module.

## Advanced reducers and scopes

| Surface | Status | Evidence |
| --- | --- | --- |
| `sd.advanced.reducer` | Complete | Immutable input, typed next state/intents, named RNG, atomic commit, budgets and three-failure circuit breaker |
| schema constructors | Complete | Boolean, integer, number, string, enum, array and object validation/defaults |
| migrations | Complete | Real Gravity Lesson schema-1 state migrates through its package callback |
| `entity` | Complete | Grave Keeper phase reducer |
| `participant-profile` | Complete | Apothecary purchase marker survives run scope |
| `participant-run` | Complete | Gravity cast streak |
| `party-run` | Complete | Monument portal progress |
| `scene` | Complete | Crypt room state |
| `session` | Complete | Gravity demonstration counter |
| fault lifecycle | Complete | A malformed real Monument event trips only its reducer circuit; package content stays available |

## Decisive acceptance

- `showcase-mods.test.mjs` compiles the three real packages, executes their
  transactions, timers, migration, cross-host save restore, reducer circuit,
  scene stack, audio projection, and deterministic package output.
- `smoke-web-lua-showcases.mjs` runs host and guest through Apothecary purchase
  and reforge, custom Boneyard readiness, Minimap/powerup/enemy replication,
  Keeper combat and XP, shared mod-skill selection, Skill Book/quickbar, portal,
  both rooms, return, audio requests, and six screenshots with no console, page,
  or HTTP errors.
- `smoke-web-lua-wearables.mjs` retains the two-client Hat, Robe, and Staff
  acceptance for the existing equipment slots.

Release still requires exact-main rebase validation, Mac browser acceptance,
production deployment, package upload, subscription, and live gameplay proof.
Those are publication gates, not missing Lua semantics.
