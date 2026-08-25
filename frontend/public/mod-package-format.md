# Solomon Dark web-port mod package format

Library mods are ZIP archives with `manifest.json` at the root. A package may
contain sandboxed Lua, typed Boneyards, or both. DLLs, native `images/`
replacement trees, and arbitrary native `data/` overlays are not web-port
content and are rejected.

The Website validates every upload, calculates package and extracted-content
SHA-256 values itself, and requires the submitted version to exactly match
`manifest.version`.

## Package layouts

### Boneyard only

```text
manifest.json
files/
  Survival Arena.boneyard
```

Use the [Boneyard example](/examples/boneyard-only-manifest.json).

### Lua only

```text
manifest.json
scripts/
  main.lua
art/
  icon.png
audio/
  cast.ogg
```

Use the [Lua example](/examples/lua-only-manifest.json).
The repository also ships the complete canonical
`frontend/examples/web-lua/invincibility-potion` package.

### Combined

```text
manifest.json
files/
  survival.boneyard
scripts/
  main.lua
```

Use the [combined example](/examples/combined-manifest.json).

## Manifest fields

- `id` is the permanent, case-insensitively unique package identity. It must
  remain the same across versions.
- `name` is the player-facing name shown in the Library and Dark Cloud.
- `version` is the exact session and save identity.
- `priority` orders independent mods and Boneyard target overrides. Higher
  values materialize later.
- `overlays` may target only `data/levels/*.boneyard` or
  `sandbox/DarkCloud/mylevels/*.boneyard`. Every source must be an existing
  `.boneyard` under `files/`.
- `runtime.entryScript` names an existing `.lua` file under `scripts/`.
- `runtime.apiVersion` must be `1.0.0`. The Website is the only runtime target.
  Native Loader metadata and manually declared capability lists are rejected.
- `requiredMods` lists package IDs which must also be subscribed and enabled.

Paths use `/`, are relative, and must match archive case. Do not wrap the
package in another top-level directory.

Typed files may live under `art/`, `audio/`, `levels/`, `scenes/`, or the
retained `sprites/` import directory. The 1.0 definition graph must claim every
asset it uses; admission verifies bytes, type, dimensions, frames, ownership,
references, graph budgets, and the canonical graph digest before play.

Every Boneyard is parsed during upload with the native SyncBuffer grammar and
again when a session is provisioned. Empty, malformed, trailing, oversized, or
path-conflicting content fails closed.

The complete machine-readable contract is
[mod-manifest.schema.json](/mod-manifest.schema.json).

## Subscription, launch, and multiplayer

Subscribe on the Library page. Explore the Dark Cloud in `/game` to enable or
disable each subscribed mod. Starting a game freezes the account's enabled set,
reopens and hash-verifies every exact latest package, validates the complete
dependency graph, and provisions only that immutable set.

Each Lua entry script runs once in an isolated bounded definition VM. Advanced
reducers remain server-only inside the prepared session; browsers receive only
trusted catalogs and presentation models. Boneyards enter only that party run's
catalog. Each shared-Hub admission carries that account's immutable
ordered `id`/`version`/content-hash manifest. A party may launch only when every
member has the same exact manifest; there is no browser lobby directory or
join-by-lobby URL.

Browser save schema 9 stores the exact manifest plus graph-bound reducer cells,
statuses, powerups, spell cooldowns, skills, shops, enemies, and scene epochs.
A changed save manifest requires explicit Continue or Cancel. State restores
only for an exact active package and graph match; mismatched state is retired.
