# Solomon Dark Website

## Boneyard viewer

`/boneyards` is a dedicated fullscreen, browser-local viewer for retail
`.boneyard` files. It decodes the native SyncBuffer and renders the actual
spawn, terrain polygons, road quads, fence segments, world-object positions,
and static sprite placements. Files opened from disk never leave the browser.

The parser, scene model, canvas renderer, and UI are separate so the workspace
can grow into a web editor without replacing the native document model. Run
its real-fixture contract with:

```bash
cd frontend
npm run test:boneyard
```

`/boneyard` is the authoring surface. Its large-map renderer keeps the same
art lift without applying a Canvas filter to every placed piece on every
frame: each decoded sprite is brightened once on a sprite-sized cache canvas.
Painter order is cached per immutable editor document, off-screen pieces are
culled, and ordinary pieces avoid unnecessary Canvas state stacks. Those are
performance invariants; putting per-piece `filter` calls back in the stage
turns a dense retail-generated map into multi-second frames.

The browser benchmark measures file load, hover, pan, and zoom against either
the bundled sample or a supplied dense `.boneyard`. Build and serve the site in
one terminal, then run the benchmark in another:

```bash
cd frontend
npm run build
npm run preview -- --host 127.0.0.1 --port 4175

BONEYARD_BENCH_URL=http://127.0.0.1:4175 \
BONEYARD_BENCH_FIXTURE="/path/to/large-map.boneyard" \
BONEYARD_BENCH_ROUTE=editor \
BONEYARD_BENCH_ASSERT=1 \
npm run benchmark:boneyard
```

`CHROME_PATH` can select a Chrome executable; otherwise the benchmark uses
the installed stable Chrome channel. The assertion budget intentionally
allows machine variance while still rejecting the former multi-second
interaction frames.

## Mod packages

Community mod ZIPs require `manifest.json` at the archive root. Website
packages may contain data overlays/Boneyards, root `images/` art overlays,
sandboxed Lua, or any combination of those three. See the [authoring
guide](frontend/public/mod-package-format.md),
[JSON Schema](frontend/public/mod-manifest.schema.json), and the
[copyable examples](frontend/public/examples/).

Website Join Game links give the launcher the lobby directory origin. The
launcher fetches the host's exact active mod identities, reuses exact manual or
cached copies, downloads missing website versions, verifies both package and
content hashes, and stages only the host set. Direct Steam invites and direct
lobby-ID joins use the configured website the same way when its lobby metadata
is available. If it is unavailable, the launcher falls back to the locally
enabled set and the native exact-compatibility handshake, so manual P2P play
does not depend on this service.

Run the backend integration contract with a .NET 10 SDK:

```bash
python3 -m unittest tests.test_mod_sync_contract -v
```

## Steam ticket authentication

The backend requires a standard Steam Web API user key to verify the tickets created by the mod loader. Register a key at [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) using a real domain you control.

Configure the key only on the backend:

```env
Steam__WebApiKey=YOUR_STEAM_WEB_API_KEY
```

ASP.NET maps `Steam__WebApiKey` to `Steam:WebApiKey`. Never commit the key or expose it to the frontend or mod loader.

The backend validates launcher tickets through `ISteamUserAuth/AuthenticateUserTicket` for Steam AppID `3362180` with the ticket identity `solomon-dark-directory-v1`. If the key is missing, `POST /api/auth/steam/session` returns `503 Service Unavailable` and authenticated lobby discovery is unavailable.

The domain entered during key registration is the key's administrative association, not a request-origin restriction. Changing the website domain does not require an application change; the key may be regenerated later to keep that registration current.
