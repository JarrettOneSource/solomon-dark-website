# Web Lua 1.0 framework wargames

Status: **design stress tests; not implementations**

These examples test whether the proposed framework stays simple while carrying
real authority, multiplayer, presentation, save, and teardown requirements. A
design fails if the author has to rebuild those systems manually.

## Wargame 1: migrate Invincibility Potion

### Author goal

- bright-green custom bottle art on the ground and in Inventory;
- 50% ordinary and 100% boss drop chance;
- restore the consumer's mana;
- block all incoming damage and mana spending for three minutes;
- refresh on another drink;
- show the same actor-attached effect to every player;
- clean up on expiry, run end, disconnect, or host shutdown.

### Proposed definition

```lua
return sd.mod({
  api = "1.0.0",
  content = {
    sd.kit.potion({
      key = "invincibility_potion",
      name = "Invincibility Potion",
      description = "Three minutes of invincibility and unlimited mana.",
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
      art = {
        icon = sd.art.sprite("art/invincibility-potion.png"),
        on_use = { prefab = "spell_glow", color = "#26ff40" },
        active = { prefab = "status_ring", color = "#26ff40" },
      },
    }),
  },
})
```

### Framework work hidden

The kit compiles an item, loot rows, consume transaction, participant-scoped
status, complete damage/mana modifier coverage, fixed-tick expiry, replicated
presentation, and teardown lease. No event callbacks, timer IDs, participant
map, filters, or run cleanup remain in mod code.

### Failure injection

| Scenario | Required result |
| --- | --- |
| Guest consumes while host has 10 mana | Guest alone fills mana and gains status |
| Same guest consumes twice | One status instance refreshes; no doubled filter/VFX |
| Host and guest consume | Independent participant instances and deadlines |
| Poison, primary, secondary, overload | Damage/debit modifier covers every authoritative producer |
| Positive mana recovery | Recovery is not accidentally zeroed |
| Run ends during effect | Mechanics and VFX retire together |
| Save/resume during effect | Declared run-save policy restores one remaining duration |
| Reducer/presentation fault | Base game continues; status transaction remains valid or rolls back atomically |

Verdict: this is the mandatory first 1.0 migration. If it is not substantially
shorter than the `0.2.0` script, the new interface has failed.

## Wargame 2: Minimap

### Author goal

Draw a top-right Minimap in Hub, Boneyards, and mod rooms. It follows the living
player, then the spectator target after death. It shows explored terrain, party,
currently visible enemies, objectives, and portals without revealing hidden
actors or adding network traffic.

### Proposed definition

```lua
sd.kit.ui({
  key = "field_minimap",
  mount = "hud.top_right",
  accessible_name = "Field minimap",
  visible = { scenes = { "hub", "boneyard", "room" } },
  view = sd.prefab.minimap({
    size = { width = 220, height = 180 },
    center = "camera_subject",
    rotation = "north_up",
    fog = "explored",
    layers = {
      { source = "terrain", style = "terrain" },
      { source = "party", style = "ally" },
      { source = "visible_hostiles", style = "enemy" },
      { source = "objectives", style = "objective" },
      { source = "portals", style = "portal" },
    },
  }),
})
```

### Framework work hidden

Trusted browser code joins the immutable scene geometry catalog with ordinary
interpolated snapshots and viewer visibility. The host sends semantic scene and
objective state, not draw commands. UI scale, mobile layout, focus, accessibility,
scene epochs, asset caching, and teardown are presentation-runtime concerns.

### Failure injection

| Scenario | Required result |
| --- | --- |
| Player dies | Center changes to authoritative spectator target, not stale corpse |
| Enemy outside visibility | No marker; mod cannot bind raw enemy census |
| Late join | Current explored policy and scene epoch initialize without event replay |
| Resize/mobile orientation | Widget reflows inside its declared mount |
| Enter private player room | Only that player's map changes |
| Enter party dungeon | All members use the same geometry; viewer markers remain local |
| 500 actors | Projection enforces row/marker budgets and stable prioritization |

Verdict: this proves why browser Lua and host-streamed immediate draw lists are
the wrong foundation. The required seam is a trusted presentation model.

## Wargame 3: monument portal and dungeon

### Author goal

Walking into or interacting with a Boneyard monument opens a party transition,
pushes a new authored dungeon scene, runs a custom encounter, then returns to
the suspended parent Boneyard at a stable return point.

### Proposed definition

```lua
local dungeon = sd.kit.scene({
  key = "monument_crypt",
  name = "The Monument Crypt",
  form = "dungeon",
  instance = "party",
  rooms = {
    sd.kit.room({
      key = "crypt_entry",
      geometry = sd.kit.boneyard({
        key = "crypt_map",
        source = "levels/monument-crypt.boneyard",
        anchors = { entry = "spawn", exit = "return_gate", boss = "boss_spawn" },
      }),
      encounter = { boss = sd.ref("enemy", "grave_tyrant") },
    }),
  },
  entry = { room = "crypt_entry", anchor = "entry" },
  return_policy = "resume_parent",
})

sd.kit.scene_extension({
  key = "monument_gate",
  scene = "stock.boneyard",
  features = {
    sd.prefab.portal({
      selector = { object_kind = "monument" },
      destination = dungeon,
      activation = "interact_or_enter",
      prompt = "Enter the crypt",
      scope = "party",
      policy = "leader_confirms",
    }),
  },
})
```

### Framework work hidden

The Website assigns stable semantic IDs to monument instances, deduplicates
activation, freezes party input, checks exact content readiness, checkpoints the
parent scene, allocates a new scene epoch, loads assets, places the party, owns
the dungeon world and encounter, and either commits the transition for everyone
or rolls it back. Return pops the scene stack and restores the parent snapshot.

### Failure injection

| Scenario | Required result |
| --- | --- |
| Two players activate same monument | One transition request and one scene instance |
| Guest activates before leader | Declared leader-confirm policy, not client authority |
| A party member lacks exact content | Party admission/transition fails before any scene changes |
| Player disconnects during loading | Barrier recomputes or aborts by explicit policy |
| Save during dungeon | Scene stack, room, encounter, party, and return checkpoint restore together |
| Dungeon load/asset failure | Entire party remains in parent world; input unfreezes |
| Parent has live projectiles/timers | Suspension policy explicitly freezes or rejects transition |
| Host shuts down | Parent/dungeon instances and all children retire idempotently |

Verdict: this is the hardest requested feature. It requires a real scene stack,
semantic anchors, and party transition transaction; a raw `switch_region` call
would leave ownership and rollback undefined.

## Wargame 4: NPC shop under contention

### Author goal

Add an authored NPC selling one Invincibility Potion and a reforge service. Shop
stock is per player and restocks after a run. Two near-simultaneous purchase
requests must never duplicate the item or debit the wrong player.

```lua
sd.kit.shop({
  key = "field_apothecary",
  name = "FIELD APOTHECARY",
  mount = { scene = "hub.courtyard", anchor = "trader_extension_east" },
  npc = {
    name = "Mara",
    prefab = "stock.fomentius",
    dialogue = { "Everything is fresh enough." },
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
  services = {
    { kind = "reforge", pool = sd.ref("affix_pool", "crypt_affixes"), price = 500 },
  },
})
```

### Failure injection

| Scenario | Required result |
| --- | --- |
| Double-click/replayed request | Request identity deduplicates before debit |
| Gold changes after UI opens | Authority revalidates current gold at commit |
| Backpack becomes full | No debit or stock decrement |
| Two players buy | Independent player-scoped stock and saves |
| Reforge result invalid for item | Whole transaction rejects; original item/gold remain |
| NPC art fails | Mod admission fails; no invisible interaction remains |

Verdict: the public Shop definition stays small only if purchase, inventory,
currency, stock, feedback, and save ownership remain one deep transaction module.

## Wargame 5: enemy, spell, and subskill composition

### Author goal

Create a Grave Tyrant enemy with authored art, a Gravity Well spell, and an Event
Horizon subskill that modifies the same spell for players. The enemy can cast the
spell without sharing player progression or paying player mana.

```lua
local gravity_well = sd.kit.spell({
  key = "gravity_well",
  name = "Gravity Well",
  slot = "secondary",
  mana = 30,
  cooldown = "1.2s",
  casters = { "player", "enemy" },
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
      maximum_rank = 3,
      modify = { radius = { multiply = { 1.10, 1.18, 1.25 } } },
      art = { icon = sd.art.sprite("art/event-horizon.png") },
    },
  },
  art = { icon = sd.art.sprite("art/gravity-well-icon.png") },
})

sd.kit.enemy({
  key = "grave_tyrant",
  name = "Grave Tyrant",
  base = "stock.skeleton_mage",
  stats = { health = 250, speed = 2.5, scale = 1.2 },
  behavior = sd.prefab.enemy("ranged", { pursuit = "nearest_player" }),
  attacks = { { spell = gravity_well, cooldown = "4s" } },
  art = {
    atlas = sd.art.sheet({
      image = "art/grave-tyrant.png",
      frame = { width = 128, height = 128 },
      animations = { idle = { 1 }, move = { 2, 3 }, attack = { 4 }, death = { 5, 6 } },
    }),
  },
})
```

### Failure injection

| Scenario | Required result |
| --- | --- |
| Duplicate cast packet | Dedupe precedes mana/cooldown/effect creation |
| Insufficient player mana | No mana, cooldown, field, audio, or VFX mutation |
| Enemy casts same definition | Enemy admission uses its own declared attack policy, not player skill state |
| Subskill rank changes | Derived spell parameters recompute deterministically |
| Save with active field | Effect identity/state/lifetime restore or reject by explicit policy |
| Caster dies/unloads | Cast children, hit ledger, VFX, and audio retire recursively |
| Unknown renderer prefab | Admission fails instead of substituting generic art |

Verdict: reusable definitions and typed caster contexts are essential. Copying
separate player/enemy spell code would make the module shallow.

## Wargame 6: messy junior code

The framework must fail helpfully when an author writes this:

```lua
return sd.mod({
  api = "1.0.0",
  content = {
    sd.kit.potion({
      key = "god potoin",
      duration = "3 minutes maybe",
      stacking = "both",
      loot = { ordinary = 500 },
      on_use = sd.ref("status", "invincble"),
      mystery = true,
    }),
  },
})
```

Expected diagnostics are collected in one pass where safe:

```text
E_CONTENT_KEY content[1].key: use lowercase letters, digits, '.', '_' or '-'.
E_DURATION content[1].duration: expected a duration such as "180s" or "3m".
E_ENUM content[1].stacking: expected "refresh", "stack", "replace", or "ignore".
E_RANGE content[1].loot.ordinary: expected a probability from 0 through 1.
E_REFERENCE content[1].on_use: no status "invincble"; did you mean "invincible"?
E_UNKNOWN_FIELD content[1].mystery: field is not supported by potion schema 1.0.
```

The package is never partially admitted. The author receives source locations,
graph paths, limits, and suggested fixes from `sdmod check` without launching the
game. Sloppy structure becomes a finite correction list instead of a multiplayer
bug.

## Framework-wide adversarial matrix

Before 1.0, every flagship must pass:

- solo, host, guest, and late-join behavior;
- two mods composing at an additive seam;
- two mods conflicting at an exclusive anchor;
- malformed package, bad asset, missing dependency, graph cycle, and budget limit;
- duplicate/reordered/replayed browser intents;
- save/resume with added, removed, renamed, and version-changed content;
- run end, scene replacement, player disconnect, party mutation, and host close;
- reducer exception, timeout, invalid state, invalid intent, and repeated failure;
- desktop and mobile presentation at supported viewport/UI scales;
- exact package/graph/art fingerprint mismatch rejection;
- clean base-game behavior after the failing mod action is rolled back.
