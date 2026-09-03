# Web Lua 1.0 generated reference

API: `1.0.0`

## Quick start

A mod is a script that creates things. Each `sd.*` call tells the game about
one thing, and the game collects everything the script created when it ends.

From `frontend/`, scaffold and check a mod with:

```sh
npm run sdmod -- new path/to/my-mod
npm run sdmod -- check path/to/my-mod
```

```lua
local tough = sd.status({key = "tough", duration = "5s", modifiers = {incoming_damage = {multiply = 0.8}}})

sd.potion({
  name = "Tough Tonic",
  status = tough,
  icon = "art/tonic.png",
})

sd.on("wave.completed", sd.when({context = "wave", at_least = 5}, sd.effect.resource({target = "user", mana = 5})))
```

- `sd.item`, `sd.potion`, `sd.status`, `sd.enemy`, and every other content
  kind is a short name for `sd.kit.<kind>`. `sd.on`, `sd.all`, `sd.first`,
  `sd.when`, `sd.after`, and `sd.every` are short names for `sd.rules.*`.
  `sd.sprite`, `sd.sheet`, `sd.wearable`, `sd.sound`, and `sd.music` are
  short names for `sd.art.*`.
- A content `key` is optional when the `name` can become one: "Tough Tonic"
  becomes `tough_tonic`. Write the key yourself once players have saves, because
  the key is the permanent id of that content.
- Any field that expects content accepts the created value, or its key as a
  string: `status = tough` and `status = "tough"` mean the same thing.
- Art fields accept a path. `icon = "art/tonic.png"` declares the sprite and
  references it. Sounds, music, wearables, and boneyard layouts work the same way.
  Enemy atlases need `sd.sheet` so the game knows the frame grid.
- A potion with a `status` and no `on_use` applies that status to the user, and
  takes its `duration` from the status.
- `sd.on(event, ...)` attaches rules on its own. Effects created outside a rule
  or content field are an error, so nothing is silently dropped.
- `sd.mod({...})` is still available for explicit ordering and for `systems`
  (advanced reducers). It may be called once, and everything created outside its
  lists is still collected.
- Errors name the file and line that created the value, and suggest close names.

## Splitting a mod across files

`sd.include("scripts/items.lua")` runs another script from the package once
and returns whatever it returns, so a large mod can keep items, enemies, and
scenes in separate files. Included scripts see the same `sd` and the same
strict globals. Packing folds every `scripts/*.lua` file into the entry script,
verifies the folded script compiles to the identical graph, and keeps the
sources in the package. At most 64 extra scripts
and 262144 bytes of Lua in total are allowed.

## Art

- `sd.art.sprite(path, options)` declares one PNG sprite.
- `sd.art.sheet(spec)` declares an explicit PNG frame grid, with optional `headings`.
- `sd.art.wearable(path, options)` declares a 170 px actor sheet for an existing hat, robe, or staff slot.
- `sd.art.sound(path, options)` and `sd.art.music(path, options)` declare audio.
- `sd.art.scene(spec)` and `sd.art.boneyard(spec)` declare document assets.
- `sd.art.ref(key)` references a named asset from content.
- Every art constructor accepts `key = "name"` in its options. Without a key
  the file name becomes the key, so `art/tonic.png` is `tonic`.

## Content

| Kind | Required fields | Allowed fields | Art shorthand fields |
| --- | --- | --- | --- |
| `affix` | `modifiers`, `name` | `key`, `applies_to`, `description`, `modifiers`, `name` | none |
| `affix-pool` | `entries` | `key`, `applies_to`, `description`, `entries`, `name`, `rng_domain`, `rolls` | none |
| `boneyard` | `name`, `source` | `key`, `anchors`, `art`, `description`, `environment`, `name`, `roster`, `source`, `triggers`, `waves` | `ambience`, `layout`, `loop`, `music` |
| `boast` | `instruction`, `name`, `response`, `statement` | `key`, `art`, `description`, `fail_on`, `instruction`, `name`, `random_skill_choices`, `response`, `score_multiplier`, `statement`, `stock_icon`, `success_wave` | `icon` |
| `enemy` | `name` | `key`, `art`, `description`, `loot`, `name`, `stats` | `atlas`, `attack_sound`, `death_sound`, `sound` |
| `item` | `name` | `key`, `art`, `description`, `equipment`, `name`, `stack`, `use` | `icon`, `icon_trim`, `worn`, `worn_trim` |
| `potion` | `name` | `key`, `art`, `description`, `duration`, `loot`, `name`, `on_use`, `presentation`, `status` | `icon` |
| `powerup` | `effect`, `name` | `key`, `art`, `description`, `effect`, `name`, `pickup` | `sound`, `world` |
| `room` | `geometry` | `key`, `art`, `description`, `geometry`, `name`, `props` | `ambience`, `loop`, `music` |
| `scene` | `rooms` | `key`, `art`, `description`, `name`, `rooms` | `ambience`, `layout`, `loop`, `music` |
| `scene-extension` | `features`, `scene` | `key`, `description`, `features`, `name`, `scene` | none |
| `shop` | `name`, `stock` | `key`, `art`, `description`, `mount`, `name`, `npc`, `restock`, `services`, `stock`, `stock_scope` | none |
| `skill` | `name`, `ranks` | `key`, `art`, `description`, `grants`, `maximum_rank`, `name`, `offer`, `parent`, `prerequisites`, `ranks` | `icon` |
| `spell` | `behavior`, `name`, `slot` | `key`, `art`, `behavior`, `cooldown`, `description`, `mana`, `name`, `slot` | `effect`, `icon`, `sound` |
| `status` | none | `key`, `description`, `duration`, `modifiers`, `name`, `stacking` | none |
| `ui` | `mount`, `view` | `key`, `accessible_name`, `actions`, `bindings`, `description`, `mount`, `name`, `view`, `visible` | none |

A required `name` may stand in for the `key`. Art shorthand fields take a
path or an `sd.art` value and move into `art`.

## Rules

- `sd.on(event, ...)`: run the rules when the event fires. Several rules run in order.
- `sd.all(...)`: run every rule.
- `sd.first(...)`: run the first rule that produces an effect.
- `sd.when(predicate, yes, no)`: choose a branch.
- `sd.after(duration, ...)`: run later.
- `sd.every(interval, rule, times)`: repeat a bounded number of times.

Lists of effects are accepted wherever one rule is expected, so
`on_use = {a, b}` means `on_use = sd.all(a, b)`.

## Predicates

`sd.when` takes `true`, `false`, or a table with exactly one subject:

- `{event = "wave.completed"}` is true while that event is being handled.
- `{context = "wave"}` is true when the context value is set and truthy.
- `{context = "wave", equals = 5}` compares with one of `above`, `at_least`, `at_most`, `below`, `equals`, `not_equals`.
  The numeric comparisons are false unless both sides are numbers.
- `{all = {...}}`, `{any = {...}}`, and `{none = {...}}` combine predicates.

## Events

- `action.content.cast`
- `action.content.pickup`
- `action.content.use`
- `action.portal.enter`
- `action.scene.room`
- `action.shop.purchase`
- `action.ui.action`
- `enemy.death`
- `enemy.spawned`
- `gold.changed`
- `level.up`
- `mod.enemy.damaged`
- `mod.enemy.died`
- `run.ended`
- `run.started`
- `session.started`
- `wave.completed`
- `wave.started`

Unknown event names fail admission. UI rules receive the declared UI action in
the `action` context field and the framework action family in `action_kind`.

## Effects

- `sd.effect.damage(spec)`
- `sd.effect.resource(spec)`
- `sd.effect.status(spec)`
- `sd.effect.spawn(spec)`
- `sd.effect.grant(spec)`
- `sd.effect.state(spec)`
- `sd.effect.present(spec)`

`sd.effect.grant` and `sd.effect.status` accept content keys as strings.
`sd.effect.present` accepts a sound path.
`sd.effect.spawn` accepts a local enemy key or a stock name such as
`stock.skeleton`; both forms are validated during `check`.

## Prefabs

- `sd.prefab.projectile(spec)`
- `sd.prefab.area(spec)`
- `sd.prefab.channel(spec)`
- `sd.prefab.minimap(spec)`
- `sd.prefab.portal(spec)`

## Advanced reducers

`sd.advanced.reducer(spec)` declares a scoped reducer. Versions above 1 require a pure migration for every prior version in `migrations`. Reducers are collected automatically; list them under `systems` only when using `sd.mod` to make their order explicit.

## UI state shapes

- `bindings = {label = {state = "state.key"}}`
- `visible = {scenes = {"hub", "boneyard", "room"}}`
- `visible = {state = {state = "state.key", equals = value}}`

## Schemas and intents

- `sd.schema.boolean(spec)`
- `sd.schema.integer(spec)`
- `sd.schema.number(spec)`
- `sd.schema.string(spec)`
- `sd.schema.enum(spec)`
- `sd.schema.array(spec)`
- `sd.schema.object(spec)`

- `sd.intent.damage(spec)`
- `sd.intent.resource(spec)`
- `sd.intent.status(spec)`
- `sd.intent.spawn(spec)`
- `sd.intent.grant(spec)`
- `sd.intent.state(spec)`
- `sd.intent.present(spec)`

## Scopes

- `entity`
- `participant-profile`
- `participant-run`
- `party-run`
- `scene`
- `session`

## Sandbox

Definition scripts run once, in a small Lua VM with a 250 ms budget. `require`,
`dofile`, `load`, `io`, `os`, `debug`, and `coroutine` are not available;
use `sd.include` to split files. Reading an unknown `sd` name or an undefined
global is an error with a suggestion, and `sd` names are read-only.
