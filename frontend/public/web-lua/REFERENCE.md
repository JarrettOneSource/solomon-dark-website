# Web Lua 1.0 generated reference

API: `1.0.0`

## Art

- `sd.art.sprite(path, options)` declares one PNG sprite.
- `sd.art.sheet(spec)` declares an explicit PNG frame grid.
- `sd.art.wearable(path)` declares a 170 px actor sheet for an existing hat, robe, or staff slot.
- `sd.art.sound(path, options)` and `sd.art.music(path, options)` declare audio.
- `sd.art.scene(spec)` and `sd.art.boneyard(spec)` declare document assets.
- `sd.art.ref(key)` references a named asset from content.

## Content

| Kind | Required fields | Allowed fields |
| --- | --- | --- |
| `affix` | `modifiers`, `name` | `applies_to`, `art`, `description`, `equipment`, `modifiers`, `name`, `outcome`, `persistence`, `presentation`, `tags` |
| `affix-pool` | `entries` | `applies_to`, `art`, `description`, `entries`, `exclude_equipment_types`, `include`, `name`, `presentation`, `rng_domain`, `rolls`, `tags` |
| `boneyard` | `name`, `source` | `ambience`, `anchors`, `art`, `description`, `environment`, `name`, `presentation`, `roster`, `source`, `tags`, `triggers`, `waves` |
| `enemy` | `base`, `name` | `art`, `attacks`, `base`, `behavior`, `brain`, `description`, `loot`, `name`, `presentation`, `stats`, `tags` |
| `item` | `name` | `art`, `description`, `equipment`, `name`, `presentation`, `stack`, `tags`, `use` |
| `potion` | `duration`, `name`, `on_use` | `art`, `description`, `duration`, `loot`, `name`, `on_use`, `presentation`, `stacking`, `status`, `tags` |
| `powerup` | `effect`, `name` | `art`, `description`, `duration`, `effect`, `name`, `pickup`, `presentation`, `scope`, `stacking`, `tags` |
| `room` | `geometry` | `ambience`, `anchors`, `art`, `description`, `encounter`, `geometry`, `name`, `presentation`, `props`, `tags` |
| `scene` | `instance`, `rooms` | `art`, `description`, `entry`, `form`, `instance`, `name`, `presentation`, `return_policy`, `return_to`, `rooms`, `tags`, `world` |
| `scene-extension` | `features`, `scene` | `art`, `description`, `extend`, `features`, `name`, `presentation`, `scene`, `tags` |
| `shop` | `name`, `stock` | `art`, `currency`, `description`, `mount`, `name`, `npc`, `presentation`, `restock`, `services`, `stock`, `stock_scope`, `tags` |
| `skill` | `name`, `ranks` | `art`, `description`, `grants`, `max_rank`, `maximum_rank`, `name`, `offer`, `parent`, `prerequisites`, `presentation`, `ranks`, `tags` |
| `spell` | `behavior`, `name`, `slot` | `art`, `behavior`, `cast`, `casters`, `cooldown`, `description`, `mana`, `name`, `presentation`, `program`, `school`, `slot`, `subskills`, `tags`, `targeting` |
| `status` | none | `art`, `description`, `duration`, `modifiers`, `name`, `presentation`, `scope`, `stacking`, `tags` |
| `ui` | `mount`, `view` | `accessible_name`, `actions`, `art`, `bindings`, `description`, `mount`, `name`, `presentation`, `tags`, `view`, `visible` |
