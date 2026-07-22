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
