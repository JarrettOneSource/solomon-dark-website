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

- `/api/auth/*` manages website accounts, JWTs, schools, and Steam links.
- `/api/mods*`, `/api/tags`, and `/api/users/{username}` provide the Library,
  package validation, downloads, comments, screenshots, and public profiles.
- `/api/lobbies*` provides the optional Steam lobby directory and join tickets.
- `/api/saves*` provides user-scoped cloud save slots.
- `/api/boneyards*` provides user-scoped Boneyard editor drafts and publication.
- `/api/stats` provides public aggregate counts.

## Launcher cloud saves

`POST /api/auth/steam/session` verifies the launcher ticket and looks up the
verified Steam ID in `Users.SteamId`. Its short-lived JWT includes a linked
user claim only when that mapping exists, and the response exposes the linked
account's id and username. The launcher therefore discovers a website link
without receiving website credentials.

The `cloud-save` policy accepts website JWTs and Steam sessions with that
linked-user claim. Every endpoint additionally requires the website account to
have a current Steam link. Steam-session operations recheck the exact
user/Steam-ID mapping, so unlinking takes effect even while a previously issued
15-minute session is still valid.

Cloud saves are local-first backup snapshots. There are eight slots, numbered
0 through 7:

- `GET /api/saves` lists snapshot metadata.
- `PUT /api/saves/{slot}` replaces a snapshot with an
  `application/zip` launcher archive.
- `GET /api/saves/{slot}` downloads the ZIP.
- `DELETE /api/saves/{slot}` removes the remote backup only.

Archives are limited to 16 MiB compressed, 64 MiB expanded, and 256 files.
They contain `manifest.json` plus regular files below
`savegames/solomondark/`. The manifest has schema version 1, the route slot,
an optional 40-character name, and the exact size and SHA-256 of every file.
The server rejects traversal, duplicate paths, links, unlisted files, and
digest mismatches before replacing the prior snapshot. Stored metadata records
compressed and expanded sizes, file count, format version, archive SHA-256,
and the UTC update time.

## Revision log

- REVISION 9: Adds owner-scoped Boneyard editor drafts, disk-backed autosave,
  native container validation, launcher-valid Library publication, development
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
