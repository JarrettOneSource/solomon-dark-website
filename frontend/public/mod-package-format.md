# Solomon Dark Revived mod package format

Website mods are ZIP archives whose root contains `manifest.json`. The ZIP may
contain Boneyard overlays, root `images/` art replacements, sandboxed Lua,
or any combination of those three.

The website validates every upload against this contract. It calculates the
package and extracted-content SHA-256 values itself. The version entered on the
upload form must exactly match `manifest.version`.

## Package layouts

### Boneyard only

```text
manifest.json
files/
  Survival Arena.boneyard
```

Use the [Boneyard-only manifest example](/examples/boneyard-only-manifest.json).

### Art only

```text
manifest.json
files/
  Skills.png
  Skills.bundle
```

Use the [art-only manifest example](/examples/art-only-manifest.json).

### Lua only

```text
manifest.json
scripts/
  main.lua
```

Use the [Lua-only manifest example](/examples/lua-only-manifest.json).

### Combined Boneyard, art, and Lua

```text
manifest.json
files/
  survival.boneyard
  Skills.png
  Skills.bundle
scripts/
  main.lua
```

Use the [combined manifest example](/examples/combined-manifest.json).

## Manifest fields

- `id` is the permanent launcher identity. It is case-insensitively unique on
  the website and must not change between versions.
- `name` is the in-launcher display name.
- `version` is the exact version identity used by multiplayer joins.
- `priority` controls overlay order. Higher-priority mods are applied later.
- `overlays` copies each `source` under `files/` to its staged-game `target`.
  Boneyards target `data/levels/*.boneyard` or
  `sandbox/DarkCloud/mylevels/*.boneyard`; art targets the root `images/` tree.
  The `sandbox/` prefix is part of the staged game path; the native path
  resolver supplies the matching player-profile sandbox root at runtime.
- `runtime.entryScript` names a `.lua` file under `scripts/`.
- `runtime.apiVersion` declares the Lua API contract used by the script.
- `requiredCapabilities` and `optionalCapabilities` declare requested sandbox
  capabilities.
- `requiredMods` lists launcher IDs that must be active with this mod.

Paths use `/`, are relative, and must match the case of files inside the ZIP.
Do not wrap the package in an extra top-level directory.

Every `.boneyard` overlay is parsed during upload using the native SyncBuffer
container grammar and the 13-section Arena / 14-section RegionLayout envelopes.
Empty, truncated, trailing, or otherwise malformed files are rejected before
publication.

Native atlas art is a decoded image page plus `.bundle` metadata contract, not
a dynamically named asset registry. PNG is the stock convention but not the
only native decoder input, and `_alpha` companion images are supported. A
compatible replacement preserves bundle record count/order, descriptor
geometry, page selection, and compiled selector destinations. For the common
image-only replacement, retain the stock page dimensions and layout so the
unchanged bundle rectangles still select the intended pixels. Adding a new
file or extra bundle record does not make it addressable by stock game code.

The complete machine-readable contract is
[mod-manifest.schema.json](/mod-manifest.schema.json).

## Distribution and multiplayer

Website Join Game links, direct Steam invites, and manual lobby-ID joins all
fetch the host's exact `id` + `version` + content-hash set when the configured
website can provide it. The launcher reuses exact manual installations or its
local download cache, downloads only missing website packages, verifies package
and extracted-content hashes, and stages only that set for the join. This
session-scoped host set may contain Boneyards, art, Lua, or any combination; it
does not rewrite the player's persistent enabled-mod choices.

The website remains optional. If its lobby metadata is unavailable, the
launcher keeps the locally enabled set. When all players manually install and
enable the same mods, direct P2P joining therefore works without a website. The
multiplayer compatibility handshake still rejects any version, content,
loader, or game-build mismatch.
