# Solomon Darker mod packages

Library mods are ZIP archives with `manifest.json` at the root. A package may
contain Lua scripts, Boneyard maps, or both. Native DLLs, `images/`
replacement trees, and arbitrary native `data/` overlays are not supported.

The version entered on the upload form must match `manifest.version`.
The website validates the package and calculates its SHA-256 hashes.

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
For a complete example, see
`frontend/examples/web-lua/invincibility-potion` in the repository.

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
- `name` is the name shown in the Library and Dark Cloud.
- `version` is the exact session and save identity.
- `priority` orders independent mods and Boneyard target overrides. Higher
  values load later.
- `overlays` may target only `data/levels/*.boneyard` or
  `sandbox/DarkCloud/mylevels/*.boneyard`. Every source must be an existing
  `.boneyard` under `files/`.
- `runtime.entryScript` names an existing `.lua` file under `scripts/`.
- `runtime.apiVersion` must be `1.0.0`. The Website is the only runtime target.
  Native Loader metadata and manually declared capability lists are rejected.
- `requiredMods` lists package IDs which must also be subscribed and enabled.

Paths use `/`, are relative, and must match archive case. Do not wrap the
package in another top-level directory.

Assets may live under `art/`, `audio/`, `levels/`, `scenes/`, or `sprites/`.
Declare every asset your mod uses in its definition. Before play, the host
checks file contents, types, dimensions, frames, ownership, references,
definition limits, and the definition digest.

Boneyards are checked at upload and before play. The website rejects empty
or malformed files, trailing data, files over the size limit, and conflicting paths.

The complete machine-readable contract is
[mod-manifest.schema.json](/mod-manifest.schema.json).

## Subscription, launch, and multiplayer

Subscribe in the Library, then enable your mods in **Explore the Dark Cloud**
in the game. A new game uses the latest version of each enabled mod and checks
its files and dependencies. Those versions stay fixed for that session.

Lua runs on the game server. Each entry script defines the mod once; advanced
reducers also run on the server. Custom Boneyards are available only within
that party's run. Everyone in a party must have matching mod IDs, versions,
file hashes, and load order before starting.

Saves record the mod list and modded game state. If the mod list has changed,
you must choose whether to continue loading or cancel. Mod state is restored
only when the active package and definition match the save; incompatible state
is discarded.
