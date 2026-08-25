# Web Lua 1.0 content-family contracts

Status: **implemented in the Website; API 1.0.0**

This inventory closes the requested framework membership as one design problem.
Every family compiles into the same definition graph, uses `sd.content.v1`
identity, and receives the same authority, persistence, replication, asset, and
teardown guarantees described in [Web Lua framework 1.0](web-lua-framework-1.0.md).

## Family matrix

| # | Family | Website `0.2.0` baseline | 1.0 beginner surface | Primary Website owner |
| ---: | --- | --- | --- | --- |
| 1 | Items + art | Custom potion only | `sd.kit.item` | Inventory/economy and content catalog |
| 2 | Skills + art | Stock skills are read indirectly; no registration | `sd.kit.skill` | Progression, offers, Skill Book, save |
| 3 | Powerups + art | Stock pickups only | `sd.kit.powerup` | Boneyard loot/pickup and status engine |
| 4 | Potions + art | One custom-potion path | `sd.kit.potion` | Item, consume transaction, status engine |
| 5 | Reforge effects/pools | Stock equipment effects and Unforge outcomes only | `sd.kit.affix_pool` | Equipment generation/service transaction |
| 6 | Spells + subskills + art | Stock spell reads/casts; no custom definition | `sd.kit.spell` | Progression, input/cast admission, combat |
| 7 | Enemies | Stock reads/spawns only | `sd.kit.enemy` | Boneyard enemy store, combat, renderer |
| 8 | Boneyards | Validated package overlays/catalog | `sd.kit.boneyard` | Package parser, run/world loader |
| 9 | NPC shops | Stock hard-coded services | `sd.kit.shop` | NPC interaction, economy, native-style UI |
| 10 | UI elements | No mod UI | `sd.kit.ui` | Trusted browser presentation runtime |
| 11 | Rooms/scenes | Stock Hub regions and one Boneyard world | `sd.kit.scene` | Scene graph, transitions, renderer |

Art is not a side channel. Every definition references typed `sd.art` assets;
package admission validates dimensions, frames, animation names, decoded bytes,
audio duration/format, and ownership before play. The browser receives immutable
content-addressed assets, never package filesystem paths.

## 1. Items and art

An item definition may be inventory-only, stackable material, equippable gear,
consumable, quest item, shop stock, loot, or world carrier. `Potion` remains a
specialized item kit; it is not the generic item model.

```lua
sd.kit.item({
  key = "ash_shard",
  name = "Ash Shard",
  description = "Warm stone from the Obsidian Depths.",
  tags = { "material", "vault_currency" },
  stack = { maximum = 99 },
  art = {
    icon = sd.art.sprite("art/ash-shard.png"),
    world = sd.art.sprite("art/ash-shard-ground.png"),
  },
})
```

Existing-slot wearable art stays inside the Item family. It does not introduce a
second content identity or a general avatar framework:

```lua
sd.kit.item({
  key = "starfall_robe",
  name = "Starfall Robe",
  equipment = {
    slot = "robe",
    dyeable = true,
    death_shape = 1,
    tints = { cloth = 0x6688cc, trim = 0xffdd88 },
  },
  art = {
    icon = sd.art.ref("starfall_icon"),
    icon_trim = sd.art.ref("starfall_icon_trim"),
    worn = sd.art.ref("starfall_worn"),
    worn_trim = sd.art.ref("starfall_worn_trim"),
  },
})
```

`sd.art.wearable(path)` fixes 170-pixel frames and the renderer-owned 24-heading
order. Hats require one pose row, robes accept one through five, and staffs
accept one through ten. Missing higher poses clamp to the last authored row.
The framework owns staff back/front routing and uses `death_shape` for the
native death and memorial fallback. Only the existing Hat, Robe, and Staff slots
are public.

Framework ownership:

- deterministic inventory/save identity and stack key;
- world carrier, pickup admission/deduplication, and late-join projection;
- belt/backpack/storage/info/drag/equipment presentation;
- capacity and transaction rejection;
- item removal when its defining package is absent from a continued save;
- no native subtype, recipe UID, or numeric effect row in the public contract.

First vertical slice: migrate the existing custom potion carrier into a generic
custom-item catalog without changing the current Potion behavior.

## 2. Skills and art

A skill is a ranked progression definition. It declares offer eligibility,
maximum rank, prerequisites, granted capabilities, rank modifiers, picker art,
and Skill Book placement. A subskill is an ordinary skill with a presentation
parent and prerequisite; it does not get a second identity system.

```lua
sd.kit.skill({
  key = "arcane_cartography",
  name = "Arcane Cartography",
  maximum_rank = 3,
  offer = { minimum_level = 2, weight = 1 },
  art = { icon = sd.art.sprite("art/cartography.png") },
  ranks = {
    { grant = sd.ref("ui", "field_minimap") },
    { modify = { minimap_range = { multiply = 1.25 } } },
    { modify = { reveal_portals = true } },
  },
})
```

Framework ownership:

- a parallel mod skill book keyed by stable content reference rather than the
  stock fixed 83-row numeric array;
- deterministic offer construction, prerequisite validation, rank application,
  player-only save state, and late-join projection;
- integration into the existing level-up barrier, picker, Skill Book, and
  quickbar without allowing a mod to bypass mandatory selection;
- automatic removal/recalculation of rank modifiers on reset or package removal.

First vertical slice: one passive skill that appears in a real level-up offer,
saves, reloads, and changes a Minimap presentation binding.

## 3. Powerups and art

A powerup is an immediate world pickup. It may apply a one-shot effect, timed
status, skill rank, resource change, or declared combination. It does not enter
inventory.

```lua
sd.kit.powerup({
  key = "survey_orb",
  name = "Survey Orb",
  duration = "20s",
  stacking = "refresh",
  effect = sd.effect.status({ target = "collector", reveal_current_map = true }),
  art = { world = sd.art.sprite("art/survey-orb.png") },
})
```

Framework ownership includes authority pickup, request deduplication, recipient
selection, fixed-tick duration, stacking, save policy, world actor lifecycle,
audio/VFX, and teardown. The default scope is collector plus current run.

First vertical slice: one timed powerup spawned from a Boneyard definition and
observed correctly by host, guest, and late joiner.

## 4. Potions and art

`sd.kit.potion` expands to an item, consume transaction, status/effects, and
optional loot rows. The safe timed-status default is `stacking = "refresh"`.

```lua
sd.kit.potion({
  key = "invincibility_potion",
  name = "Invincibility Potion",
  duration = "3m",
  stacking = "refresh",
  on_use = sd.rules.all({
    sd.effect.resource({ target = "user", mana = "full" }),
    sd.effect.status({
      target = "user",
      key = "invincible",
      incoming_damage = { multiply = 0 },
      mana_spend = { multiply = 0 },
    }),
  }),
  loot = { ordinary = 0.5, boss = 1.0 },
  art = { icon = sd.art.sprite("art/invincibility-potion.png") },
})
```

The framework owns participant isolation, deduplicated use IDs, resource order,
duration, refresh/stack rules, complete damage/mana producer coverage, save
policy, replicated VFX, run cleanup, and disconnect/host-close teardown.

First vertical slice: migrate Invincibility Potion with the same package ID,
content key, content ID, drop odds, guest behavior, VFX, and expiry while deleting
its manual callbacks/timers/filters.

## 5. Affixes and affix pools

The canonical term is **Affix**, not “reforge effect.” The stock Website already
has equipment modifier rows and Unforge outcomes; an Affix is the new persistent
modifier attached to an equipment item, while an Affix Pool controls deterministic
selection during generation or a shop reforge service.

```lua
local gravebound = sd.kit.affix({
  key = "gravebound",
  name = "Gravebound",
  equipment = { "robe", "ring" },
  modifiers = {
    reflected_damage = { percent_of_incoming = { 10, 20, 35 } },
  },
})

sd.kit.affix_pool({
  key = "crypt_affixes",
  applies_to = { "robe", "ring", "staff" },
  rolls = 1,
  entries = {
    { affix = gravebound, weight = 3 },
    { affix = sd.ref("affix", "maximum_health", "stock"), weight = 1 },
  },
})
```

Framework ownership includes a dedicated RNG domain, applicability and level
gates, duplicate policy, modifier algebra, item naming/description, atomic gold
and item mutation, equipment recomputation, save encoding, and replication.

First vertical slice: add one affix to a mod shop service and prove the resulting
equipment survives equip, save, reload, transfer, and Unforge without raw effect
numbers entering Lua or the protocol.

## 6. Spells, subskills, and art

A spell declares cast admission, cost, cooldown, targeting, a Website-owned
behavior prefab, presentation, and optional subskills. Subskills are stable Skill
definitions that modify declared spell parameters or grant additional prefabs.

```lua
sd.kit.spell({
  key = "gravity_well",
  name = "Gravity Well",
  slot = "secondary",
  mana = 30,
  cooldown = "1.2s",
  behavior = sd.prefab.area({
    placement = "aim",
    radius = 180,
    duration = "2.4s",
    every = "50ms",
    effects = {
      sd.effect.damage({ target = "hostiles_in_area", amount = 2 }),
      sd.effect.status({ target = "hostiles_in_area", key = "pulled", strength = 14 }),
    },
  }),
  subskills = {
    event_horizon = {
      name = "Event Horizon",
      modify = { radius = { multiply = 1.25 }, duration = { add = "600ms" } },
      art = { icon = sd.art.sprite("art/event-horizon.png") },
    },
  },
  art = { icon = sd.art.sprite("art/gravity-well.png") },
})
```

Framework ownership includes input selection, owner/action authentication,
mana/cooldown transaction, duplicate rejection, collision and target policy,
effect instances, hit ledgers, damage attribution, snapshots, save/restore,
renderer ordering, audio, VFX, and teardown.

First vertical slice: one secondary area spell with one offered subskill, host and
guest casting, late-join presentation, and save during an active field.

## 7. Enemies

An Enemy Archetype composes a verified Website behavior base with authored stats,
attacks, loot, tags, and presentation. Lua does not implement another physics,
pathfinding, collision, or per-frame renderer.

```lua
sd.kit.enemy({
  key = "grave_tyrant",
  name = "Grave Tyrant",
  base = "stock.skeleton_mage",
  stats = { health = 250, speed = 2.5, scale = 1.2 },
  behavior = sd.prefab.enemy("ranged", { pursuit = "nearest_player", leash = 480 }),
  attacks = { sd.ref("spell", "grave_pulse") },
  loot = { gold = { minimum = 20, maximum = 35 } },
  art = {
    atlas = sd.art.sheet({
      image = "art/grave-tyrant.png",
      frame = { width = 128, height = 128 },
      animations = { idle = { 1 }, move = { 2, 3 }, attack = { 4 }, death = { 5, 6 } },
    }),
  },
})
```

Framework ownership includes legal placement, host AI cadence, collision-valid
movement, targets, attacks, status/damage, stable tombstones, loot, child
projectiles/effects, animation, render order, lights, audio, replication, and
recursive retirement.

First vertical slice: one stock-derived custom enemy with replacement art,
authority spawn, one prefab attack, content-aware death, and deterministic loot.

## 8. Boneyards

A Boneyard definition wraps an already validated `.boneyard` asset and adds typed
named anchors, roster references, wave overrides/extensions, environment assets,
triggers, and scene policy. Existing bytes remain a supported authoring asset.

```lua
sd.kit.boneyard({
  key = "obsidian_depths_map",
  name = "Obsidian Depths",
  source = "levels/obsidian-depths.boneyard",
  roster = { sd.ref("enemy", "ash_warden"), "stock.demon" },
  anchors = { entry = "spawn", keeper = "npc_keeper", exit = "return_monument" },
})
```

Framework ownership includes dual upload/session parsing, geometry and anchor
validation, deterministic run seed, collision/nav, wave bookkeeping, environment,
spawn references, catalog admission, content conflicts, and teardown.

First vertical slice: wrap an existing custom Boneyard in a definition with one
named entry anchor and launch it through the ordinary picker without byte changes.

## 9. NPC shops

A Shop is separate from its NPC and UI. It declares currency, stock, prices,
limits, restock scope, and optional services, then mounts onto a stock extension
anchor or an authored NPC.

```lua
sd.kit.shop({
  key = "field_apothecary",
  name = "FIELD APOTHECARY",
  mount = { scene = "hub.courtyard", anchor = "trader_extension_east" },
  npc = {
    name = "Mara",
    prefab = "stock.fomentius",
    art = sd.art.sheet({
      image = "art/mara.png",
      frame = { width = 64, height = 96 },
      animations = { idle = { 1, 2, 3, 2 } },
    }),
  },
  currency = "gold",
  stock_scope = "player",
  restock = "run_return",
  stock = {
    { item = sd.ref("potion", "invincibility_potion"), price = 600, quantity = 1 },
  },
})
```

Framework ownership includes interaction range/prompt, dialogue, stock scope,
deterministic restock, atomic revalidation/debit/grant/decrement, inventory
capacity, participant-specific feedback, save state, and trusted native-style UI.

First vertical slice: attach one additive stock row to an explicit Hagatha or
Fomentius extension anchor, then add one fully authored NPC/shop after the generic
interaction/presentation catalog exists.

## 10. UI elements

A UI Surface is a declarative tree interpreted by trusted browser components.
Bindings are read-only semantic projections; buttons submit only declared typed
intents. There is no client Lua, arbitrary React, DOM, CSS, or JavaScript.

```lua
sd.kit.ui({
  key = "field_minimap",
  mount = "hud.top_right",
  visible = { scene = { "hub", "boneyard", "room" } },
  view = sd.prefab.minimap({
    size = 220,
    center = "camera_subject",
    layers = { "terrain", "party", "visible_hostiles", "objectives", "portals" },
    fog = "explored",
  }),
})
```

Framework ownership includes responsive layout, UI scale, focus, input, modal
stacking, accessibility, state binding, visibility filtering, action routing,
GPU/assets, per-viewer state, scene lifecycle, and error containment.

First vertical slice: Minimap. It forces the framework to solve read models,
viewport ownership, actor visibility, local player/spectator focus, late join,
performance, accessibility, and scene cleanup without arbitrary browser code.

## 11. Rooms and scenes

A Room is authored geometry and anchors. A Scene owns a room graph, instancing,
entry/exit policy, party or player scope, suspended-parent policy, and teardown.
A Portal is a Trigger that submits a transition intent.

```lua
local crypt = sd.kit.scene({
  key = "monument_crypt",
  form = "dungeon",
  instance = "party",
  rooms = { sd.ref("room", "crypt_entry") },
  entry = { room = sd.ref("room", "crypt_entry"), anchor = "entry" },
  return_policy = "resume_parent",
})

sd.kit.scene_extension({
  key = "boneyard_monument_portal",
  scene = "stock.boneyard",
  features = {
    sd.prefab.portal({
      selector = { object_kind = "monument" },
      destination = crypt,
      prompt = "Enter the crypt",
      scope = "party",
      policy = "leader_confirms",
    }),
  },
})
```

Framework ownership includes semantic object selectors, trigger deduplication,
party compatibility, transition locks, readiness barriers, scene epochs, input
suppression, parent suspension/checkpoint, return placement, reconnect/late join,
renderer/assets/audio, save policy, rollback, and recursive teardown.

The initial Boneyard-to-dungeon portal must transition the whole party; the web
authority currently owns one world per party. Player-local Hub rooms remain a
separate explicit `instance = "player"` policy.

First vertical slice: an authored monument trigger enters one single-room
Boneyard-backed dungeon and returns to a checkpointed parent run. This is the
hardest requested seam and must not be represented as a raw region switch.

## Cross-family invariants

- One Content Key cannot mean two families. Cross-kind collisions fail.
- A typed reference can target this mod, stock content, or a declared dependency.
- Exclusive stock extension anchors never resolve by priority.
- Content definitions are immutable; runtime variation creates scoped instances.
- Mechanics and presentation share one instance identity and lifetime.
- All gameplay mutations are host decisions at a fixed-tick transaction boundary.
- Assets, save data, catalogs, and protocol models contain no native addresses,
  local file paths, Lua functions, VM handles, or browser objects.
- Every family ships with solo, two-player, late-join, save/resume, teardown,
  malformed-package, budget, and runtime-fault coverage proportional to risk.
