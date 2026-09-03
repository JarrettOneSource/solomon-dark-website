# Web Lua 1.0 authoring guide

Web Lua 1.0 is a declarative content language written in Lua for the Solomon
Dark Website. It is not an unrestricted script mod loader. Most authors define
content using ordinary Lua tables; the Website owns authority, timing,
networking, saves, replication, presentation, rollback, and teardown.

The Website is the only supported target. The native Mod Loader is deprecated.

## Package structure

A typical package contains:

```text
my-mod/
├── manifest.json
├── scripts/
│   └── main.lua
├── art/
├── audio/
├── levels/
└── tests/
```

The manifest selects Web Lua API 1.0.0:

```json
{
  "$schema": "/mod-manifest.schema.json",
  "id": "example.my-mod",
  "name": "My Mod",
  "version": "1.0.0",
  "runtime": {
    "apiVersion": "1.0.0",
    "entryScript": "scripts/main.lua"
  },
  "requiredMods": []
}
```

The package version and API version are separate. A package may advance its own
version while continuing to target API `1.0.0`.

`sdmod check` runs the complete local admission path: manifest and Lua graph,
owned paths and hashes, decoded PNG/audio/document assets, prepared content
catalog, and Boneyard parsing. A package that passes this command has crossed
the same format boundary used by the game host; play tests still verify the
behavior you authored.

## Entry script

The entry script creates things. Each `sd.*` call tells the game about one
thing, and the game collects everything the script created when it ends:

```lua
-- A status is a temporary effect on a character. Its key is its permanent id.
local invincible = sd.status({
  key = "invincible",
  duration = "3m",
  stacking = "refresh",
  modifiers = {incoming_damage = 0, mana_spend = 0},
})

-- A potion applies its status when used. The icon path declares the art.
sd.potion({
  key = "invincibility_potion",
  name = "Invincibility Potion",
  description = "Grants invincibility and unlimited mana for 3 minutes.",
  status = invincible,
  on_use = {
    sd.effect.resource({target = "user", mana = "full"}),
    sd.effect.status({target = "user", status = invincible}),
  },
  loot = {ordinary = 0.5, boss = 1.0},
  icon = "art/invincibility_potion.png",
})
```

What the script relies on:

- `sd.status` and `sd.potion` are short names for `sd.kit.status` and
  `sd.kit.potion`. Every content kind has one: `sd.item`, `sd.enemy`,
  `sd.spell`, `sd.shop`, `sd.boneyard`, and so on.
- `status = invincible` hands the created status to the potion. Writing
  `status = "invincible"` means the same thing.
- `icon = "art/invincibility_potion.png"` declares the sprite and references
  it. Under the hood this is `sd.art.sprite(...)` plus
  `art = {icon = sd.art.ref(...)}`.
- `on_use = {a, b}` is a list of effects, which the game reads as
  `sd.all(a, b)`.
- The potion's `duration` is taken from its status when it is left out.
- Nothing is returned. The game gathers the status, the potion, the sprite, and
  any `sd.on` rules in the order they were created.

The canonical working version is in
[`frontend/examples/web-lua/invincibility-potion`](../frontend/examples/web-lua/invincibility-potion/).

### Explicit form

Large packages, and packages with advanced reducers, may gather their parts
explicitly with `sd.mod`. It accepts `api`, `assets`, `content`, `rules`, and
`systems`, may be called once, and produces the same graph as the short form:

```lua
local icon = sd.art.sprite("art/invincibility_potion.png")

return sd.mod({
  api = "1.0.0",
  assets = {invincibility_potion = icon},
  content = {
    sd.kit.status({
      key = "invincible",
      duration = "3m",
      stacking = "refresh",
      modifiers = {incoming_damage = 0, mana_spend = 0},
    }),
    sd.kit.potion({
      key = "invincibility_potion",
      name = "Invincibility Potion",
      description = "Grants invincibility and unlimited mana for 3 minutes.",
      duration = "3m",
      status = sd.ref("status", "invincible"),
      on_use = sd.rules.all({
        sd.effect.resource({target = "user", mana = "full"}),
        sd.effect.status({target = "user", status = sd.ref("status", "invincible")}),
      }),
      loot = {ordinary = 0.5, boss = 1.0},
      art = {icon = sd.art.ref("invincibility_potion")},
    }),
  },
})
```

Content created outside the `sd.mod` lists is still collected. The two forms
compile to the identical graph digest, so a package can start short and grow
into the explicit form without changing its content identities.

Three larger copyable examples live beside it:

- [Apprentice Apothecary](../frontend/examples/web-lua/apprentice-apothecary/README.md)
  covers items, potions, status, pickups, affixes, shops, UI, and audio in the
  short form;
- [Gravity Lesson](../frontend/examples/web-lua/gravity-lesson/README.md) covers
  offered parent/child skills, all three spell prefabs, timers, migrations, and
  participant/session reducers;
- [Monument Crypt](../frontend/examples/web-lua/monument-crypt/README.md) covers
  custom Boneyards, enemies, monument portals, rooms, scene stacks, music, and
  entity/party/scene reducers.

The showcase headless and browser tests execute these packages through the
same admission, compilation, host, and presentation paths used in production.

## Lua syntax used by mods

The common authoring subset is small:

```lua
-- Comment

local name = "Grave Tyrant"
local enabled = true

-- Map-like table
local stats = {
  health = 250,
  speed = 2.5,
}

-- Array-like table; Lua arrays start at index 1
local elements = {
  "fire",
  "air",
  "earth",
}

-- Nested tables
local art = {
  frame = {
    width = 128,
    height = 128,
  },
}
```

Key syntax rules:

- Fields use `name = value`, not JSON's `"name": value`.
- Tables represent both keyed objects and ordered arrays.
- Lua arrays start at index 1.
- Trailing commas are allowed.
- Strings may use single or double quotes.
- Booleans are `true` and `false`; an absent value is `nil`.
- Durations accept values such as `"250ms"`, `"30s"`, `"3m"`, `"1h"`, or
  nonnegative integer milliseconds.
- Stacking modes are `refresh`, `stack`, `replace`, and `ignore`.
- Every content definition has a stable `key`. When `key` is left out, the game
  derives one from `name` (`"Ward Tonic"` becomes `ward_tonic`). Write the key
  yourself once players have saves, because it is the content's permanent id.
- An unknown `sd` name or a misspelled global is an error that names the file
  and line and suggests the closest name. `sd` names are read-only.

## Content and asset references

Content refers to other content by the created value or by its key. Both forms
mean the same thing, and both resolve after the complete definition graph has
been assembled, so declaration order does not create dependencies:

```lua
local warded = sd.status({
  key = "warded",
  duration = "20s",
  modifiers = {incoming_damage = {multiply = 0.75}},
})

sd.potion({name = "Ward Tonic", status = warded, icon = "art/star.png"})
sd.potion({name = "Ward Tonic", status = "warded", icon = "art/star.png"})
```

Keys as strings are accepted wherever the field's kind is known: a potion's
`status`, a shop's `stock[].item` (an item, or a potion from this package) and
`services[].pool`, an affix pool's `entries[].affix`, a skill's `parent`,
`prerequisites`, `grants`, and rank grants, a scene's `rooms`, local enemies in
a Boneyard roster, `sd.effect.status`, `sd.effect.grant`, `sd.effect.spawn`
(a powerup under `content`, an enemy under `enemy`), and a portal's
`destination`.

`sd.ref` remains the explicit form, and is required for content in another
package or in stock content:

```lua
sd.ref("status", "invincible")                    -- this package
sd.ref("item", "ember_key", "example.other-mod")  -- a declared dependency
sd.ref("affix", "maximum_health", "stock")        -- supported stock content
```

Content identity is derived from the package ID and content key. Renaming a key
is deletion plus addition unless an explicit migration maps the old identity.

Art fields accept a path. `icon = "art/star.png"` declares a sprite named
`star` and references it; `sound = "audio/coin.ogg"` declares a sound; `music`,
`ambience`, and `loop` declare music; `worn` and `worn_trim` declare wearable
sheets; a Boneyard's `source` declares its layout. The generated reference
lists the shorthand art fields of every kind. Two fields need more: an enemy
`atlas` needs `sd.sheet(path, {frame = ..., animations = ...})` so the game
knows the frame grid, and a shop portrait goes under `art = {npc = ...}`
because the shop's `npc` field is the character itself.

Typed asset constructors remain available, with short names, and every one
accepts `key = "name"` in its options. A created asset can be passed straight
into an art field or referenced with `sd.art.ref(key)`:

```lua
sd.sprite(path, options)     -- sd.art.sprite
sd.sheet(spec)               -- sd.art.sheet
sd.wearable(path, options)   -- sd.art.wearable
sd.sound(path, options)      -- sd.art.sound
sd.music(path, options)      -- sd.art.music
sd.art.scene(spec)
sd.art.boneyard(spec)
```

Admission validates asset ownership, paths, hashes, decoded bytes, dimensions,
animation frames, audio format and duration, scene structure, and Boneyard
structure before play. Browsers receive immutable content-addressed assets, not
package filesystem paths.

## Splitting a mod across files

`sd.include("scripts/items.lua")` runs another package script once and returns
whatever that script returns. Included scripts see the same `sd` and the same
strict globals, so a large package can keep items, enemies, scenes, and rules
in separate files:

```lua
-- scripts/items.lua
local items = {}
items.moondust = sd.item({name = "Moondust", icon = "art/moondust.png"})
return items
```

```lua
-- scripts/main.lua
local items = sd.include("scripts/items.lua")
sd.include("scripts/enemies.lua")

sd.on("run.started", sd.effect.grant({target = "user", item = items.moondust, quantity = 1}))
```

`sdmod pack` folds every `scripts/*.lua` file into the entry script, compiles
the folded script again, and refuses to pack unless it produces the identical
graph digest. The sources stay in the package. A package may include at most
64 extra scripts and 256 KB of Lua in total, and scripts may not include each
other in a cycle.

## Supported mod families

The constructors below are the 1.0 public contract. The
[completion matrix](web-lua-1-api-completion-matrix.md) maps each surface to its
admission, headless, and browser evidence.

Web Lua 1.0 exposes 15 content kinds:

| Area | Constructors | Examples |
| --- | --- | --- |
| Items and effects | `item`, `potion`, `powerup`, `status` | Materials, equipment, consumables, loot drops, timed buffs |
| Progression | `skill` | Ranked skills, prerequisites, parent/child offers, passive modifiers |
| Equipment | `affix`, `affix_pool` | Equipment modifiers and deterministic reforge pools |
| Combat | `spell`, `enemy` | Area, projectile, or channel spells and custom enemy archetypes |
| Economy | `shop` | NPC stores, prices, limited stock, restocking, and reforge services |
| Worlds | `boneyard`, `room`, `scene`, `scene_extension` | Custom maps, encounters, rooms, dungeons, and portals |
| Presentation | `ui` | Minimap, supported HUD panels, read-only bindings, and declared actions |

### Items, potions, powerups, and statuses

Mods can define stackable materials, equipment, consumables, quest items, shop
stock, loot, and world pickups. Potions combine an inventory item, an atomic use
transaction, effects or a timed status, loot rows, saving, replication, and
presentation. Powerups apply immediately rather than entering inventory.

Timed statuses may modify semantic values such as incoming damage or mana
spending. The framework owns duration, stacking, participant isolation,
disconnect cleanup, and late-join projection.

### Existing-slot wearable items

Wearable equipment is an ordinary `sd.kit.item`. It may target only the
existing `hat`, `robe`, or `staff` slot; mods cannot create slots or player
classes.

`sd.art.wearable(path)` is the convenient actor-sheet constructor. It fixes the
cell size at 170 by 170 pixels, so authors do not repeat frame geometry or
animation-index tables.

```lua
local icon = sd.art.sprite("art/starfall-robe-icon.png")
local icon_trim = sd.art.sprite("art/starfall-robe-icon-trim.png")
local worn = sd.art.wearable("art/starfall-robe.png")
local worn_trim = sd.art.wearable("art/starfall-robe-trim.png")

return sd.mod({
  api = "1.0.0",

  assets = {
    starfall_icon = icon,
    starfall_icon_trim = icon_trim,
    starfall_worn = worn,
    starfall_worn_trim = worn_trim,
  },

  content = {
    sd.kit.item({
      key = "starfall_robe",
      name = "Starfall Robe",
      description = "A robe patterned after the night sky.",

      equipment = {
        slot = "robe",
        dyeable = true,
        death_shape = 1,
        tints = {
          cloth = 0x6688cc,
          trim = 0xffdd88,
        },
      },

      art = {
        icon = sd.art.ref("starfall_icon"),
        icon_trim = sd.art.ref("starfall_icon_trim"),
        worn = sd.art.ref("starfall_worn"),
        worn_trim = sd.art.ref("starfall_worn_trim"),
      },
    }),
  },
})
```

Wearable sheets use a deliberately small progressive contract:

| Slot | Columns | Accepted pose rows | Meaning |
| --- | ---: | ---: | --- |
| `hat` | 24 | exactly 1 | one frame for each 15-degree heading |
| `robe` | 24 | 1 through 5 | one static row through all five walk poses |
| `staff` | 24 | 1 through 10 | one static row through all cast and melee poses |

Columns are headings in native order. Rows are poses. When a robe or staff has
fewer than the maximum rows, the renderer clamps to its last authored row. A
one-row sheet is therefore valid and immediately usable; additional rows improve
motion fidelity without changing the Lua definition.

The framework routes a single staff sheet through the existing back/front
render passes. Authors do not maintain duplicate staff sheets or depth lists.

Hat and robe art may contain two grayscale layers:

- `worn` and `icon` are the cloth/primary layer;
- `worn_trim` and `icon_trim` are the trim/secondary layer.

The trim sheets are optional for fixed-color, non-dyeable clothing. If either
trim sheet is present, both must be present and have geometry identical to its
primary partner. Setting `dyeable = true` requires both trim sheets. Initial
cloth and trim tints default to white.

Staffs use only `worn` and `icon`; staffs cannot declare dye or trim layers.

Death animation and long-lived memorial paintings deliberately use a declared
stock silhouette rather than requiring another large art bank. `death_shape`
defaults to zero and accepts `0..3` for hats, `0..2` for robes, and `0..5` for
staffs. Current item colors carry into the hat or robe death presentation.

Wearable items are non-stackable and cannot also be consumables. They otherwise
use the ordinary inventory, shop, grant, equip, storage, save, multiplayer,
late-join, dye, affix, and teardown paths.

When a player explicitly confirms loading with a changed mod set, saved items
and affixes owned by packages that no longer match are removed. Removing an
equipped mod hat or robe exposes the built-in base clothing; it does not leave a
missing texture in the saved wizard.

### Skills and child skills

Skills can declare ranks, maximum rank, prerequisites, offer eligibility,
grants, modifiers, picker art, and Skill Book placement. A subskill is an
ordinary skill with a parent and prerequisite, so it retains the same stable
identity and save behavior.

### Affixes and reforging

An affix is a persistent modifier attached to equipment. An affix pool controls
deterministic selection during equipment generation or a shop reforge service.
The framework owns applicability, duplicate policy, RNG domains, modifier
algebra, atomic currency/item mutation, equipment recomputation, saves, and
replication.

### Spells

Spells declare their slot, mana cost, cooldown, one Website-owned area,
projectile, or channel behavior, art, and audio. Ordinary parent/child skills
grant spells and modify named damage lanes. The framework owns cast
authentication, target selection, hit ledgers, damage attribution, snapshots,
VFX, saves, and teardown.

### Enemies

Enemy archetypes declare authored stats, loot, directional art, and audio. The
Website owns nearest-player movement, collision, attack cadence, damage, death,
and rendering. Enemy-authored spell AI is not part of 1.0.

### Boneyards, rooms, scenes, and portals

A Boneyard definition wraps a validated `.boneyard` asset and may add an entry
anchor, enemy rosters, wave changes, environment mode, triggers, and music.
Rooms provide trusted visual map geometry. Party scenes provide ordered rooms,
parent suspension, return behavior, saving, and teardown.

A scene extension can attach a semantic portal to a stock object. For example,
a Monument portal can transition the whole party into a mod dungeon, suspend
the parent Boneyard, and restore the parent checkpoint when the party returns.

### Shops and UI

A shop uses gold and declares stock, prices, limits, restock scope, services,
mount, and optional NPC presentation. Purchase and reforge operations are
revalidated and committed atomically by the host.

UI is declarative. A UI definition selects a trusted view, mount, visibility,
bindings, and allowed actions. It can produce supported surfaces such as a
Minimap or mod action panel, but cannot ship arbitrary browser code.

Bindings map a label to scoped semantic state:

```lua
bindings = {
  first_purchase = {state = "tutorial.first_purchase"},
}

visible = {
  scenes = {"boneyard", "room"},
  state = {state = "tutorial.first_purchase", equals = true},
}
```

The supported scene tokens are `hub`, `boneyard`, and `room`. `room` means a
trusted mod scene is active.

## Rules and effects

Common behavior uses finite, serializable rules rather than retained callbacks.
`sd.on` attaches a rule to an event, and the game collects it like content:

```lua
sd.on("wave.completed",
  sd.when({context = "wave", at_least = 5}, sd.effect.resource({target = "user", mana = 5})),
  sd.every("2s", sd.effect.resource({target = "user", mana = 1}), 3)
)
```

The rule constructors and their long names:

```lua
sd.on(event, ...)                -- sd.rules.on; several rules run in order
sd.all(...)                      -- sd.rules.all; run every rule
sd.first(...)                    -- sd.rules.first; the first rule that produces an effect
sd.when(predicate, yes, no)      -- sd.rules.when
sd.after(duration, ...)          -- sd.rules.after
sd.every(interval, rule, times)  -- sd.rules.every; times is a number or {times = n}

sd.effect.damage(spec)
sd.effect.resource(spec)
sd.effect.status(spec)
sd.effect.spawn(spec)
sd.effect.grant(spec)
sd.effect.state(spec)
sd.effect.present(spec)
```

A list of effects is accepted wherever one rule is expected, so
`on_use = {a, b}` means `on_use = sd.all(a, b)`. An effect that is created but
never placed inside a rule, a content field, or `sd.mod` is an error, so nothing
is dropped silently.

Reusable Website-owned behaviors include:

```lua
sd.prefab.projectile(spec)
sd.prefab.area(spec)
sd.prefab.channel(spec)
sd.prefab.minimap(spec)
sd.prefab.portal(spec)
```

### Predicates

`sd.when` takes `true`, `false`, or a table with exactly one subject:

```lua
{event = "wave.completed"}               -- the event being handled
{context = "participant_id"}             -- the context value is set
{context = "action", equals = "ping"}    -- equals, not_equals
{context = "wave", at_least = 5}         -- above, below, at_least, at_most
{all = {{context = "wave", above = 3}, {context = "boss", equals = true}}}
{any = {...}}
{none = {...}}
```

A predicate table uses at most one comparison, comparisons apply only to
`context`, and the numeric comparisons are false unless both sides are numbers.
The context fields available to a rule depend on the event; the Apprentice
Apothecary uses `participant_id` on shop purchases and `action` on UI actions.

### Event names

Event names are closed and typo-checked by `sdmod check`:

| Events | When they fire |
| --- | --- |
| `session.started` | The prepared package session opens |
| `run.started`, `run.ended` | A Boneyard run starts or returns to the Hub |
| `wave.started`, `wave.completed` | The stock wave director crosses its boundaries |
| `enemy.spawned`, `enemy.death` | A stock Boneyard enemy event occurs |
| `mod.enemy.damaged`, `mod.enemy.died` | A custom enemy loses health or dies |
| `gold.changed`, `level.up` | Authoritative player economy/progression changes |
| `action.content.use`, `action.content.cast`, `action.content.pickup` | A mod item, spell, or powerup action commits |
| `action.shop.purchase`, `action.ui.action` | A mod shop purchase or declared UI action commits |
| `action.portal.enter`, `action.scene.room` | A party portal or room change commits |

Rules can distinguish declared UI actions through context:

```lua
sd.on("action.ui.action", sd.when(
  {context = "action", equals = "ping"},
  sd.effect.present({sound = "audio/bookOpen.ogg"})
))
```

The `action_kind` context field contains the framework family such as
`"ui.action"`; `action` contains the mod's declared action such as `"ping"`.

## Advanced reducers

Procedural authority behavior uses bounded reducers. A reducer receives
immutable semantic state, an event, and a context, then returns a complete next
state plus typed intents:

```lua
local cast_streak = sd.advanced.reducer({
  key = "cast_streak",
  scope = "participant-run",
  schema_version = 1,

  state = sd.schema.object({
    casts = sd.schema.integer({default = 0, min = 0, max = 999}),
    rhythm = sd.schema.number({default = 0, min = 0, max = 1}),
  }),

  on = {"action.content.cast"},

  reduce = function(current, event, context)
    return {
      casts = current.casts + 1,
      rhythm = context.random("cast-rhythm"),
    }, {
      sd.intent.resource({target = "caster", mana = 1}),
    }
  end,
})

return sd.mod({
  api = "1.0.0",
  systems = { cast_streak },
})
```

Available scopes are:

- `entity`
- `participant-profile`
- `participant-run`
- `party-run`
- `scene`
- `session`

Reducers execute on the authoritative fixed-tick lane. They may use deterministic
named RNG through `context.random(name)`. State and intents commit together or
not at all. Invalid output, exceptions, timeouts, or budget overruns do not leave
partial state behind.

## Example projects

The supported families can be combined into projects such as:

- a spell pack with custom art, mana costs, cooldowns, VFX, and child skills;
- a Boneyard expansion with custom maps, waves, enemy variants, loot, and
  ambience;
- a ranked skill tree that grants spells and passive modifiers;
- an equipment overhaul with affixes, deterministic pools, and reforge shops;
- a custom NPC merchant selling modded items and potions;
- a custom enemy pack with authored stats, loot, animation, and phase state;
- a party dungeon entered through a Boneyard Monument portal;
- a Minimap or supported HUD panel driven by authoritative viewer-specific
  state; or
- a combined campaign package using all of these systems together.

## Sandbox and intentional limits

Web Lua does not permit:

- arbitrary browser JavaScript, React, DOM, or CSS;
- client-side gameplay authority;
- raw engine-state or protocol mutation;
- direct Pixi or renderer-object access;
- filesystem, sockets, Node modules, or native addresses;
- `io`, `os`, `require`, `package`, `debug`, `load`, coroutines, or dynamic code
  loading (`sd.include` is the supported way to split a package across files);
- definition scripts that run longer than 250 ms; definitions describe content
  and leave gameplay to rules;
- per-frame custom rendering callbacks;
- a second physics, collision, or pathfinding implementation; or
- dynamic content registration after session admission.

Mods also cannot add equipment slots or player classes. Wearables target the
existing Hat, Robe, and Staff slots.

Definitions are immutable after admission. Gameplay rules run only on the game
host, browser presentation is read-only, and all mutations cross a typed,
authenticated transaction boundary. Exact enabled package, content, and art
parity is required for every party member.

The framework supports substantial content packs and campaigns, but not an
arbitrary engine replacement or unrestricted total conversion.

## Authoring commands

Run the authoring tools from `frontend/`:

```sh
npm run sdmod -- new path/to/my-mod
npm run sdmod -- check path/to/my-mod
npm run sdmod -- test path/to/my-mod
npm run sdmod -- pack path/to/my-mod my-mod.zip
```

`check` executes the real definition compiler, schema validation, asset
validation, reference resolution, dependency and cycle checks, graph budgets,
save-schema checks, and capability inference without launching the game.

`new` creates a valid item package with a CC0 starter icon. `test` runs package
tests under the bounded Lua environment and exposes the actual compiled graph
as the global `mod` table. `pack` validates the package, folds included scripts
into the entry script and proves the folded script compiles to the same digest,
then emits a deterministic ZIP containing the canonical compiled graph and graph
digest.

Every diagnostic carries a stable code, the graph path, and the script file and
line that created the value:

```text
E_SCRIPT script scripts/main.lua:4: ')' expected (to close '(' at line 1) near <eof>; Lua tables use braces, so write sd.item({key = "my_item"}) or sd.item{key = "my_item"}
E_REFERENCE content[1].fields.status scripts/main.lua:12: unknown status reference example.my-mod:invincble; did you mean invincible?
```

The migration command is currently specialized for the retained 0.2
Invincibility Potion package:

```sh
npm run sdmod -- migrate path/to/0.2-mod path/to/1.0-mod
```

## References

- [Generated field reference](../frontend/public/web-lua/REFERENCE.md)
- [Generated LuaLS stub](../frontend/public/web-lua/sd.lua)
- [Starter Lua file](../frontend/public/web-lua/STARTER.lua)
- [Diagnostic code guide](../frontend/public/web-lua/DIAGNOSTICS.md)
- [Canonical Invincibility Potion](../frontend/examples/web-lua/invincibility-potion/)
- [Framework design history](design/web-lua-framework-1.0.md)
- [Content-family design inventory](design/web-lua-content-families.md)
- [Progressive definition graph ADR](adr/0001-web-lua-progressive-definition-graph.md)
- [Friendly authoring layer ADR](adr/0002-web-lua-friendly-authoring-layer.md)
