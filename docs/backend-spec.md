# SDR Backend Spec — implement exactly this

You are implementing the backend for **Solomon Dark Revived** (SDR), a community
site for a revived abandonware game: user accounts, a mod library, a multiplayer
server master list, and cloud saves.

## Ground rules

- Work ONLY inside `backend/`. Do not touch `frontend/`, `design.md`, or `docs/`.
- The project is already scaffolded: `backend/Server.csproj` targets `net10.0` and
  already references `Microsoft.EntityFrameworkCore.Sqlite` and
  `Microsoft.AspNetCore.Authentication.JwtBearer`. **Add no other NuGet packages.**
- ASP.NET Core **minimal APIs**. No MVC controllers, no MediatR, no AutoMapper,
  no repository-pattern ceremony. Plain, boring, readable code.
- EF Core with SQLite. `db.Database.EnsureCreated()` on startup. No migrations.
- Do not create a test project. Do not `git commit`. Do not leave any process
  running when you finish. Verify with `dotnet build` (must be warning-clean)
  and, if you want, a brief `dotnet run` + curl smoke that you then kill.

## File layout (create exactly these; keep each file focused)

```
backend/
  Program.cs                 // composition root: config, DI, middleware, endpoint mapping
  Data/AppDb.cs              // DbContext + OnModelCreating (indexes, unique constraints)
  Data/Entities.cs           // all entity classes
  Data/SeedData.cs           // dev seed (see §Seed)
  Services/TokenService.cs   // JWT creation + principal helpers
  Services/StorageService.cs // disk storage paths, save/read/delete files, sha256
  Api/AuthEndpoints.cs       // /api/auth/*
  Api/ModEndpoints.cs        // /api/mods*
  Api/ServerEndpoints.cs     // /api/servers*
  Api/SaveEndpoints.cs       // /api/saves*
  Api/StatsEndpoints.cs      // /api/stats
```

Each `Api/*.cs` exposes `public static class XyzEndpoints { public static void Map(IEndpointRouteBuilder app) { ... } }`.

## Config

- `Storage:Root` — default `"data"` (relative to content root). All runtime files
  live under it: `data/sdr.db`, `data/uploads/mods/…`, `data/uploads/screenshots/…`,
  `data/saves/{userId}/{slot}.bin`. Create directories on startup.
- `Jwt:Secret` — HMAC-SHA256 key string. Add a fixed dev value in
  `appsettings.Development.json`. In non-Development, if unset/empty: generate a
  random key at startup and log a warning (sessions won't survive restart — fine).
- `Jwt:ExpiryDays` — default 7.

## Entities (Data/Entities.cs)

- `User`: Id (int), Username (unique, case-insensitive), Email (unique,
  case-insensitive), PasswordHash, School (nullable string), CreatedAtUtc.
  (REVISION 7: `School` is the wizard's declared School of Magic — one of
  `fire`, `air`, `water`, `ether`, `earth` (lowercase canonical) or null for
  the undeclared. It is public: it drives the site's cursor/click effects and
  shows beside the username wherever authors appear.)
- `Mod`: Id, Slug (unique), Name, Summary, Description, Type, AuthorId→User,
  Downloads (int), CreatedAtUtc, UpdatedAtUtc. Navigation: Versions,
  Screenshots, Author.
  (REVISION 3: the loader-type taxonomy — native/DLL vs script — is gone for
  good; native DLL mods won't be supported for security reasons.)
  (REVISION 6: a `Type` field returns, but as a CONTENT taxonomy, not a loader
  one: `"lua"` (script mods) or `"boneyard"` (downloadable Boneyard runs for
  the game's Boneyard shelf). Lowercase canonical, exactly those two values.
  TagsCsv/tags are REMOVED everywhere — the schools-of-magic tagging is
  retired; the element art is reserved for a future feature.)
- `ModVersion`: Id, ModId, Version (string), Changelog, FileName (stored name on
  disk), FileSize (long), Downloads, CreatedAtUtc.
- `ModScreenshot`: Id, ModId, FileName, SortOrder.
- `ModComment`: Id, ModId→Mod, AuthorId→User, Body (1–1000 chars), CreatedAtUtc.
  Index on (ModId, CreatedAtUtc). (REVISION 8 — "Marginalia": notes in a tome's
  margin.)
- `GameServer`: Id, Name, Host, Port, Players, MaxPlayers, Version,
  Description, ModLoaderVersion, FirstSeenUtc, LastSeenUtc. Unique index (Host, Port).
- `CloudSave`: Id, UserId→User, Slot (0–7), Name (nullable), Size, Sha256,
  UpdatedAtUtc. Unique index (UserId, Slot).

## Auth

- Password hashing: `PasswordHasher<User>` from `Microsoft.AspNetCore.Identity`
  (in the shared framework — no package needed).
- JWT: symmetric HMAC, claims `sub` (user id) + `unique_name` (username),
  no issuer/audience validation. Bearer auth. `TokenService` builds tokens.
- Username rule: `^[A-Za-z0-9_-]{3,24}$`. Email: basic sanity check. Password: ≥ 8 chars.

Endpoints:

- `POST /api/auth/register` `{username, email, password}` → `201 {token, user}`;
  `409 {error}` if username/email taken; `400 {error}` on validation failure.
- `POST /api/auth/login` `{usernameOrEmail, password}` → `200 {token, user}` or
  `401 {error: "Wrong name or password. The Annals are unforgiving."}`.
- `GET /api/auth/me` (auth) → `200 {user, modCount, saveCount}`.
- `PUT /api/auth/school` (auth): JSON `{school: "fire"|"air"|"water"|"ether"|"earth"|null}`
  → `200 {user}`; anything else → `400 {error}` (REVISION 7).

`user` shape everywhere: `{id, username, email, school, createdAtUtc}` (email
only in `me` and register/login responses — never in public mod listings).
Mod `author` objects gain `school`: `{id, username, school}` (REVISION 7).

## Mods

- `GET /api/mods?search=&type=&sort=newest|downloads&page=1&pageSize=20`
  → `{items, total, page, pageSize}`. `search` matches name/summary (LIKE),
  `type` optionally filters to `lua` or `boneyard` (empty/absent = all; any
  other value → 400), sort default `newest`. pageSize clamp 1–50.
  Item shape: `{id, slug, name, summary, type, author: {id, username},
  latestVersion, downloads, thumbnailUrl, createdAtUtc, updatedAtUtc}`.
  `thumbnailUrl` = first screenshot URL or null.
- `GET /api/mods/{slug}` → item shape + `{description, screenshots: [{id, url, sortOrder}],
  versions: [{id, version, changelog, fileSize, downloads, createdAtUtc}]}` or 404.
- `POST /api/mods` (auth, `multipart/form-data`): fields `name` (3–60), `summary`
  (≤140), `description` (≤10000), `type` (required, `lua` or `boneyard`, 400
  otherwise), `version` (default `1.0.0`), file part `file` (**.zip only,
  ≤100MB — v1 does NOT inspect zip contents, by design**), optional
  `screenshots` (≤5, png/jpg, ≤2MB each). → `201` mod detail. Slug =
  kebab-case of name; if taken append `-2`, `-3`, …
- `POST /api/mods/{slug}/versions` (auth, owner only): `version`, `changelog`,
  `file` → `201`. Bumps mod `UpdatedAtUtc`.
- `PATCH /api/mods/{slug}` (owner): JSON `{name?, summary?, description?, type?}` → 200
  (`type` validated the same as create).
- `DELETE /api/mods/{slug}` (owner) → 204. Deletes files from disk too.
- `GET /api/mods/{slug}/download` → latest version file; and
  `GET /api/mods/{slug}/versions/{versionId}/download`. Both stream the zip with
  `Content-Disposition: attachment; filename="{slug}-{version}.zip"` and increment
  the version's and mod's `Downloads`. No auth required.
- Screenshots are served as static files: map `{Storage:Root}/uploads/screenshots`
  to URL path `/uploads/screenshots` (read-only static files). Mod zips are NOT
  in any static path — only via the download endpoints (so counts stay honest).
- Upload endpoints need a request body size limit override (100MB+ a little
  headroom) — Kestrel default is 30MB. Use per-endpoint metadata, not a global bump.
- Stored file names: `{slug}/{version}.zip` under `uploads/mods/`, screenshots
  `{modId}-{n}.{ext}` under `uploads/screenshots/`. Sanitize everything; never
  trust client file names.

## Marginalia — tome comments (REVISION 8)

- `GET /api/mods/{slug}/comments` → `{items: [{id, body, createdAtUtc,
  author: {id, username, school}}], total}` — newest first, cap 100 (no paging
  yet). 404 for unknown slug.
- `POST /api/mods/{slug}/comments` (auth): JSON `{body}` (trimmed, 1–1000
  chars; 400 with in-universe error otherwise) → `201` the created comment
  shape. Rate-limit: reuse the announce limiter policy pattern with its own
  partition (10/min per IP).
- `DELETE /api/mods/{slug}/comments/{id}` (auth): allowed for the comment's
  author OR the tome's owner → 204; others 403; unknown 404.
- Seeds: 6–10 comments spread across seed mods from Sirmin/Griselda, in-voice
  (dry gothic academia; e.g. "Installed this before the exam. The exam was
  transformed. So was the examiner.").

## Public wizard profiles (REVISION 8)

- `GET /api/users/{username}` (no auth) → `{user: {id, username, school,
  createdAtUtc}, modCount, downloadsTotal, mods: [item shape, newest first,
  cap 50]}` — 404 unknown username (match case-insensitively). No email ever.

## Reverse-proxy hardening (REVISION 8 — the site now runs behind nginx)

- `UseForwardedHeaders` (X-Forwarded-For + X-Forwarded-Proto) with
  KnownProxies/KnownNetworks cleared and loopback trusted, BEFORE rate
  limiting, so limiter partitions see real client IPs instead of the proxy.
- The SSE endpoint must also send response header `X-Accel-Buffering: no`
  (nginx honors it per-response; proxies otherwise buffer the stream dead).

## Matches (multiplayer session master list)

> REVISION 2 — replaces the old “Servers” section entirely. A *match* is a live
> multiplayer session hosted by a player through the SDR loader. Joining happens
> via the loader (the site fires an `sdr://` link), so there is **no host/port
> anywhere** — the join handle is an opaque `sessionKey` (Steam lobby id or a
> loader-generated GUID). “Boneyard” is the name of the run/map the match is
> being played on (a distinct in-game concept — do not confuse with servers).
> Rename everything; keep NO aliases or compatibility routes for the old
> `/api/servers` shape (nothing consumes it yet).

> REVISION 4: matches are homogeneous (one game version for everyone), so
> Version and ModLoaderVersion are REMOVED everywhere. A match that stops
> announcing is DELETED outright once it leaves the 120s window — there is no
> offline/stale/adjourned state and no `includeOffline`. New required field:
> `status`, either `"hub"` (pre-game lobby where players gather) or
> `"session"` (run underway).

Entity `MatchSession` (table `Matches`): Id, SessionKey (≤64, unique index),
HostPlayer (≤32), Boneyard (≤60), Players, MaxPlayers, Status (`hub|session`),
FirstSeenUtc, LastSeenUtc.

- `POST /api/matches/announce` JSON `{sessionKey (required), hostPlayer
  (required), boneyard (required), players (≥0), maxPlayers (1–64),
  status ("hub"|"session", required)}`. Upsert on SessionKey: update fields +
  `LastSeenUtc=UtcNow`; insert sets `FirstSeenUtc`. Clamp `players` to
  `maxPlayers`. → `200 {id, expiresInSeconds: 120}`. Rate limit per IP,
  30 req/min (policy `match-announcements`). On announce AND on every list/
  stream read below, first hard-delete rows with `LastSeenUtc < UtcNow-120s`
  (a tiny helper both endpoints call is fine).
- `DELETE /api/matches/announce` JSON `{sessionKey}` → 204 (deletes the row).
- `GET /api/matches` → `{items, playerCount}` — everything returned is live by
  definition. Sort players desc. Item shape:
  `{id, sessionKey, hostPlayer, boneyard, players, maxPlayers, status}`.
- `GET /api/matches/game` — bare JSON array for the in-game multiplayer tab:
  `[{sessionKey, hostPlayer, boneyard, players, maxPlayers, status}]`.
  No auth, no rate limit.
- SSE `GET /api/matches/events` — same payload as `GET /api/matches`. The
  change fingerprint MUST include statuses and player counts (e.g. hash the
  concatenation of `sessionKey:status:players` plus row count) so hub→session
  flips push an event.
- Stats endpoint: `matchesLive` = match count, `wizardsOnline` = players sum.
- Seed matches: 5 rows, all live, sessionKey `seed-1`…`seed-5`, hostPlayer
  from mage names (Vorpus, Griselda, Wazoo, Morth, Sirmin), boneyard names
  ("Dead Hawg Outskirts", "Mount Awful", "The Grimwood", "Dratmoor Fen",
  "The Old Cemetery"), statuses: two `hub`, three `session`.
- Dev seed heartbeat in Program.cs keeps filter
  `SessionKey LIKE 'seed-%' AND Players > 0` (it now keeps all five alive,
  which is the point — the hard-delete would otherwise eat them). It also
  re-inserts any missing canonical seed match with fresh `FirstSeenUtc` and
  `LastSeenUtc` values.

## Live updates (SSE)

- `GET /api/matches/events` — Server-Sent Events (`text/event-stream`), no
  auth, no rate limit. On connect, immediately emit an event named `matches`
  whose data is the same JSON as `GET /api/matches?includeOffline=true` (the
  client filters). Then re-check the DB every 3 seconds and emit a fresh
  `matches` event only when a fingerprint changes (row count + max LastSeenUtc
  + players sum is enough). Send a `: keepalive` comment every 15 seconds so
  proxies keep the stream open. Honor request cancellation cleanly (no
  unobserved exceptions on disconnect). .NET 10 has first-class SSE results
  (`TypedResults.ServerSentEvents`) — use that if it fits, otherwise write the
  stream by hand with `Response.ContentType = "text/event-stream"` + flushes.
  Do not buffer; it must stream through the Vite dev proxy.

## Cloud saves

Slots 0–7, each ≤ 1 MiB, raw bytes.

- `GET /api/saves` (auth) → `[{slot, name, size, sha256, updatedAtUtc}]`.
- `PUT /api/saves/{slot}` (auth) — raw `application/octet-stream` body, optional
  `?name=` query (≤40 chars) → `200 {slot, name, size, sha256, updatedAtUtc}`.
  413-style `400 {error}` if > 1 MiB or empty. Overwrites existing slot.
- `GET /api/saves/{slot}` (auth) → the bytes (`application/octet-stream`) or 404.
- `DELETE /api/saves/{slot}` (auth) → 204.

## Stats

- `GET /api/stats` → `{boneyardsOnline, wizardsOnline, tomes, savesSynced,
  enrolled, downloadsTotal}` — online server count, sum of online players, mod
  count, save-row count, user count, sum of all mod downloads.

## Cross-cutting

- All error responses are `{"error": "human-readable message"}` with correct
  status codes. Add a small helper.
- JSON: web defaults (camelCase).
- CORS: in Development only, allow origins `http://localhost:5173` and
  `http://localhost:5174` (any header/method) so the Vite dev server can call.
- SPA hosting: `UseDefaultFiles()` + `UseStaticFiles()` (wwwroot) +
  `MapFallbackToFile("index.html")`, but requests starting `/api` must never
  fall back — they 404 as JSON. (wwwroot may not exist yet in dev — that must
  not crash the app.)
- Kestrel URL: set `applicationUrl` to `http://localhost:5210` in
  `Properties/launchSettings.json` (http profile only).
- DateTimes: always UTC, suffix properties `…Utc`.

## Seed (Data/SeedData.cs)

Runs in Development only, after EnsureCreated, only when the Users table is
empty. Create:

- Users: `Sirmin` (sirmin@college.example) and `Griselda`
  (griselda@college.example), password `password123`.
- 8 mods with lore-flavored names/summaries (e.g. "Shock Nova Rework",
  "Gold Focus Charm", "Acid Rain Certified", "Iron Golem Plus", "Lua Bots",
  "Fast Start Waves", "Dark Cloud Sorter", "Custom Intro Stories"), tags from
  `body|ether|earth|fire|mind|water|air|arcane`, one version each ("1.0.0",
  with a tiny generated placeholder zip file on disk so download works),
  varied download counts (37–4200), CreatedAtUtc spread over the last 90 days.
- 5 game servers: "Dead Hawg Tavern", "Mount Awful Summit", "The Grimwood",
  "Dratmoor Disturbance", "Boneyard EU" — mixed players/maxPlayers, version
  "0.72.5", three with `LastSeenUtc=UtcNow` (online), two stale by hours.
- 3 cloud saves for Sirmin (slots 0–2, small random blobs, names like
  "Before the Tower", "Floor 12 — do not judge", "post-Heartmonger").

## Definition of done

- `dotnet build` succeeds with zero warnings.
- `dotnet run` then: register → login → `GET /api/auth/me` with bearer →
  `GET /api/mods` shows seeds → `GET /api/servers` shows online servers →
  `GET /api/stats` sums up. Kill the server afterwards.
- Code is plain and readable; no speculative abstractions, no TODO placeholders.
