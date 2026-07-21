# Solomon Dark Revived mod package format

Website mods are ZIP archives whose root contains `manifest.json`. The ZIP may
be an overlay/Boneyard mod, a sandboxed Lua mod, or both.

The website validates every upload against this contract. It calculates the
package and extracted-content SHA-256 values itself. The version entered on the
upload form must exactly match `manifest.version`.

## Package layouts

### Boneyard or data-overlay only

```text
manifest.json
files/
  survival.boneyard
```

Use the [Boneyard-only manifest example](/examples/boneyard-only-manifest.json).

### Lua only

```text
manifest.json
scripts/
  main.lua
```

Use the [Lua-only manifest example](/examples/lua-only-manifest.json).

### Combined Boneyard and Lua

```text
manifest.json
files/
  survival.boneyard
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
  Website packages may target files under `data/`; custom Boneyards may also
  target `DarkCloud/mylevels/*.boneyard`.
- `runtime.entryScript` names a `.lua` file under `scripts/`.
- `runtime.apiVersion` declares the Lua API contract used by the script.
- `requiredCapabilities` and `optionalCapabilities` declare requested sandbox
  capabilities.
- `requiredMods` lists launcher IDs that must be active with this mod.

Paths use `/`, are relative, and must match the case of files inside the ZIP.
Do not wrap the package in an extra top-level directory.

The complete machine-readable contract is
[mod-manifest.schema.json](/mod-manifest.schema.json).

## Distribution and multiplayer

Native DLL entry points are supported for manual local mods but are not
accepted for website auto-downloads. Website Join Game links, direct Steam
invites, and manual lobby-ID joins all fetch the host's exact `id` + `version` +
content-hash set when the configured website can provide it. The launcher
reuses exact manual installations or its local download cache, downloads only
missing website packages, and stages only that set for the join.

The website remains optional. If its lobby metadata is unavailable, the
launcher keeps the locally enabled set. When all players manually install and
enable the same mods, direct P2P joining therefore works without a website. The
multiplayer compatibility handshake still rejects any version, content,
loader, or game-build mismatch.
