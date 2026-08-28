# Web Lua 1.0 generated reference

API: `1.0.0`

Every content definition requires a stable `key`. The root `sd.mod` table accepts `api`, `assets`, `content`, `rules`, and `systems`; advanced reducers must be listed in `systems`.

## Art

- `sd.art.sprite(path, options)` declares one PNG sprite.
- `sd.art.sheet(spec)` declares an explicit PNG frame grid, with optional `headings`.
- `sd.art.wearable(path)` declares a 170 px actor sheet for an existing hat, robe, or staff slot.
- `sd.art.sound(path, options)` and `sd.art.music(path, options)` declare audio.
- `sd.art.scene(spec)` and `sd.art.boneyard(spec)` declare document assets.
- `sd.art.ref(key)` references a named asset from content.

## Content

| Kind | Required fields | Allowed fields |
| --- | --- | --- |
| `affix` | `key`, `modifiers`, `name` | `key`, `applies_to`, `description`, `modifiers`, `name` |
| `affix-pool` | `key`, `entries` | `key`, `applies_to`, `description`, `entries`, `name`, `rng_domain`, `rolls` |
| `boneyard` | `key`, `name`, `source` | `key`, `anchors`, `art`, `description`, `environment`, `name`, `roster`, `source`, `triggers`, `waves` |
| `enemy` | `key`, `name` | `key`, `art`, `description`, `loot`, `name`, `stats` |
| `item` | `key`, `name` | `key`, `art`, `description`, `equipment`, `name`, `stack`, `use` |
| `potion` | `key`, `duration`, `name`, `on_use` | `key`, `art`, `description`, `duration`, `loot`, `name`, `on_use`, `presentation`, `status` |
| `powerup` | `key`, `effect`, `name` | `key`, `art`, `description`, `effect`, `name`, `pickup` |
| `room` | `key`, `geometry` | `key`, `art`, `description`, `geometry`, `name`, `props` |
| `scene` | `key`, `rooms` | `key`, `art`, `description`, `name`, `rooms` |
| `scene-extension` | `key`, `features`, `scene` | `key`, `description`, `features`, `name`, `scene` |
| `shop` | `key`, `name`, `stock` | `key`, `art`, `description`, `mount`, `name`, `npc`, `restock`, `services`, `stock`, `stock_scope` |
| `skill` | `key`, `name`, `ranks` | `key`, `art`, `description`, `grants`, `maximum_rank`, `name`, `offer`, `parent`, `prerequisites`, `ranks` |
| `spell` | `key`, `behavior`, `name`, `slot` | `key`, `art`, `behavior`, `cooldown`, `description`, `mana`, `name`, `slot` |
| `status` | `key` | `key`, `description`, `duration`, `modifiers`, `name`, `stacking` |
| `ui` | `key`, `mount`, `view` | `key`, `accessible_name`, `actions`, `bindings`, `description`, `mount`, `name`, `view`, `visible` |

## Rules

- `sd.rules.on(event, node)`
- `sd.rules.all(nodes)`
- `sd.rules.first(nodes)`
- `sd.rules.when(predicate, yes, no)`
- `sd.rules.after(duration, node)`
- `sd.rules.every(interval, node, {times = count})`

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

## Prefabs

- `sd.prefab.projectile(spec)`
- `sd.prefab.area(spec)`
- `sd.prefab.channel(spec)`
- `sd.prefab.minimap(spec)`
- `sd.prefab.portal(spec)`

## Advanced reducers

`sd.advanced.reducer(spec)` declares a scoped reducer. Versions above 1 require a pure migration for every prior version in `migrations`.

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
