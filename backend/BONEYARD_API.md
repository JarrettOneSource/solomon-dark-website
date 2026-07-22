# Boneyard editor draft API

The Boneyard editor stores private semantic documents separately from public
Library tomes. Every route in this document requires the existing website JWT:

```http
Authorization: Bearer <website-jwt>
```

A caller can only address its own drafts. An unknown draft and another user's
draft both return `404`.

## Draft shape

List items omit bodies:

```json
{
  "id": 12,
  "name": "Survival Recipe Notes",
  "updatedAt": "2026-07-21T20:10:00Z",
  "documentSize": 184,
  "compiledSize": 3059
}
```

Full responses add the JSON document, optional base64 compiled body, creation
time, and the same byte counts:

```json
{
  "id": 12,
  "name": "Survival Recipe Notes",
  "document": {
    "schemaVersion": 1,
    "objects": []
  },
  "compiledBoneyard": "AAECAwQ...",
  "documentSize": 36,
  "compiledSize": 3059,
  "createdAt": "2026-07-21T20:00:00Z",
  "updatedAt": "2026-07-21T20:10:00Z"
}
```

`documentSize` is the UTF-8 byte length stored for `document`.
`compiledSize` is the decoded native byte length. It is null when no compiled
body is stored.

## List drafts

```http
GET /api/boneyards
```

Returns a JSON array ordered by `updatedAt` descending. Bodies are not read or
returned.

## Create a draft

```http
POST /api/boneyards
Content-Type: application/json

{"name":"New Boneyard"}
```

Names are trimmed, required, and limited to 80 characters. A new draft starts
with `{}` as its document and no compiled body. Success returns the full draft
with status `201`.

Each user may keep at most 32 drafts. The next create returns `409` in the
standard error shape.

## Read a draft

```http
GET /api/boneyards/12
```

Returns the full draft.

## Autosave a draft

```http
PUT /api/boneyards/12
Content-Type: application/json

{
  "name": "Survival Recipe Notes",
  "document": {
    "schemaVersion": 1,
    "objects": []
  },
  "compiledBoneyard": "AAECAwQ..."
}
```

Any combination of `name`, `document`, and `compiledBoneyard` may be sent. At
least one must be present. Omitted fields remain unchanged. A null
`compiledBoneyard` removes the compiled file. The write is last-write-wins and
success returns the full saved draft.

The server treats `document` as opaque JSON. It does not validate or rewrite
the editor's semantic model.

Limits:

- `document`: 2 MiB as stored UTF-8 JSON
- `compiledBoneyard`: 4 MiB after base64 decoding

An invalid base64 value or an over-limit body returns `400` in the standard
error shape. Native container validation is deferred until publication so an
editor may retain a failed compile while it is being corrected.

## Delete a draft

```http
DELETE /api/boneyards/12
```

Returns `204` and removes both the EF row and the draft directory.

## Publish a draft

```http
POST /api/boneyards/12/publish
Content-Type: application/json

{
  "name": "The Survival Grounds, As Shipped",
  "slug": "the-survival-grounds-as-shipped",
  "summary": "The stock survival boneyard, byte for byte from the 0.72.5 beta. The yard re-rolls itself every time you visit; the file is the recipe, not the furniture.",
  "description": "Extracted from the preserved 0.72.5 beta data."
}
```

`slug` is optional. When omitted, the existing Library slugger derives one
from `name` and appends a numeric suffix when required. A supplied slug must be
canonical lowercase kebab case and unused.

Publication returns the normal Library mod detail with status `201`. It keeps
the draft. Screenshots begin empty and may be added through the existing mod
screenshot API.

Publication refuses a missing compiled body and validates a present body with
the existing `BoneyardFileInspector`. The generated launcher package has this
layout:

```text
manifest.json
files/
  <portable name>.boneyard
```

The manifest uses version `1.0.0`, the final Library slug as its launcher id,
format `boneyard`, and the custom-level target:

```text
sandbox/DarkCloud/mylevels/<portable name>.boneyard
```

The generated ZIP is then passed through the same `ModPackageInspector` and
Library publication service as an ordinary upload. Package SHA-256,
content SHA-256, storage, download counting, and launcher resolution metadata
therefore use the existing Library path.

Published editor tomes carry the `boneyard` tag. The current Library taxonomy
uses tags rather than a separate `Mod.Type` column.

## Development seed

Development startup ensures the `Luthacus` and `Hagatha` seed users, one example
draft for each, and the stock survival tome under Luthacus. Seed credentials
remain development-only. The stock source is validated against SHA-256
`fe2e01b0ab62f644c3e5bf53f71df3a41968b95c8e22fa44c1d1250ba08cdb5b`
before any seed row is created.
