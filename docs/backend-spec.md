# Solomon Dark website backend specification

The backend is an ASP.NET Core `net10.0` application. It uses minimal APIs,
EF Core, SQLite, JWT bearer authentication, and filesystem storage rooted at
`Storage:Root`.

## Conventions

- API groups are implemented in focused `backend/Api/*.cs` files with one
  `Map(IEndpointRouteBuilder)` entry point per group.
- Authenticated endpoints use `RequireAuthorization()` and derive the current
  user id from `TokenService`.
- API errors use `{"error":"human-readable message"}` with the relevant HTTP
  status.
- Response JSON uses camel case. Stored timestamps are UTC.
- EF schema changes are registered in `AppDb.OnModelCreating` and applied by
  `DatabaseSchema.EnsureCurrentAsync`. The project does not use migrations.
- Binary and document bodies live below `Storage:Root`. The database stores
  ownership, names, byte counts, timestamps, and publication metadata.
- Development seed data runs only in the Development environment.

## API groups

- `/api/auth/*` manages website accounts, JWTs, and schools.
- `/api/mods*`, `/api/tags`, and `/api/users/{username}` provide the Library,
  package validation, account subscriptions, comments, screenshots, and public
  profiles.
- `/api/game/hub` issues one single-use admission to the resident shared browser
  Hub. `/api/game/sessions` remains the non-discoverable private operations seam.
- `/api/game/saves*` provides the authoritative browser cloud slot.
- `/api/game/diagnostics` accepts an explicit, bounded browser connection
  report without a session credential.
- `/api/boneyards*` provides user-scoped Boneyard editor drafts and publication.
- `/api/stats` provides public aggregate counts.

The rebuilt browser game has no lobby namespace, directory, or join URL.
`POST /api/game/hub` resolves the authenticated account's active mod content
and returns a `Cache-Control: no-store` credentialed WSS endpoint. The
supervisor consumes that admission once, and the authoritative host creates
party membership only after the completed character authenticates.

Browser diagnostics correlate the report with exactly one of three endpoint
classes: `null` when no provisioned session is known, `shared-hub` for the
resident Hub, or the existing 32-character URL-safe private-session id. Other
short labels remain invalid. The report remains consent-driven, rate-limited,
credential-free, and stored as a private diagnostic archive.

## Web mod subscriptions and sessions

`ModSubscription` binds one account to one Library mod and stores the enabled
state for the next admission. `GET /api/mods/subscriptions` lists membership;
`PUT`, `PATCH`, and `DELETE /api/mods/{slug}/subscription` subscribe, change
activation, and unsubscribe. `GET /api/mods/active` reopens the exact latest
packages, validates hashes and dependency order, and returns the manifest the
game-session endpoints will provision.

Only sandboxed Lua and typed Boneyard overlays are accepted. The backend sends
the resolved payload with the single-use shared-Hub ticket or private session
request. Content remains immutable for that player; a party can launch only
when all members carry the same exact manifest. Each party run owns isolated
Lua VMs and a content-local Boneyard catalog. Browser save schema 2 carries the
exact manifest and bounded per-mod `sd.state`.

## Revision log

- REVISION 9: Adds owner-scoped Boneyard editor drafts, disk-backed autosave,
  native container validation, web-port Library publication, development
  examples, and the stock survival tome seed. Library summaries now allow 160
  characters so the supplied stock-tome copy remains verbatim.

## Boneyard drafts, REVISION 9

Drafts are private editor documents. They do not appear in the Library until
the owner publishes a compiled native container.

`BoneyardDraft` stores `Id`, `UserId`, `Name`, `DocumentSize`, optional
`CompiledSize`, `CreatedAtUtc`, and `UpdatedAtUtc`. The document and compiled
bytes are stored at:

```text
{Storage:Root}/drafts/boneyards/{userId}/{draftId}/document.json
{Storage:Root}/drafts/boneyards/{userId}/{draftId}/compiled.boneyard
```

Limits:

- 32 drafts per user
- 2 MiB per JSON document, measured as stored UTF-8 bytes
- 4 MiB per compiled Boneyard, measured after base64 decoding
- 80 characters per draft name

All routes require a website JWT. A draft owned by another user is reported as
not found.

- `GET /api/boneyards` lists the caller's drafts without bodies.
- `POST /api/boneyards` creates `{name}` with an empty JSON object document.
- `GET /api/boneyards/{id}` returns the document and optional base64
  `compiledBoneyard` body.
- `PUT /api/boneyards/{id}` updates any combination of `name`, `document`, and
  `compiledBoneyard`. A null `compiledBoneyard` removes the compiled file.
  Writes are last-write-wins.
- `DELETE /api/boneyards/{id}` removes the row and draft directory.
- `POST /api/boneyards/{id}/publish` accepts `{name, slug?, summary,
  description}` and returns the created Library mod detail.

Publication requires a compiled body. The backend validates it with the same
native SyncBuffer inspector used by ordinary Library package uploads. It then
creates a ZIP with root `manifest.json` and a Boneyard under `files/`, targeting
`sandbox/DarkCloud/mylevels/`. The common Library publication service owns slug
selection, manifest identity checks, package hashes, file storage, EF creation,
optional screenshots, and version metadata. Published editor tomes receive the
canonical `boneyard` Library tag and version `1.0.0`.

The complete request and response contract is in
[`backend/BONEYARD_API.md`](../backend/BONEYARD_API.md).
