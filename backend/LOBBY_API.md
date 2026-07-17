# Lobby directory backend contract

The website is an optional discovery and password-authorization service. Steam
owns lobby creation, membership, invites, and peer-to-peer transport. A website
outage must never end an existing Steam lobby or prevent a host from inviting a
Steam friend.

The current contract version uses multiplayer protocol `60`.

## Privacy behavior

| UI choice | API token | Steam lobby type | Anonymous website listing | Join path |
| --- | --- | --- | --- | --- |
| Public | `public` | Public | Visible | Direct `sdr://` link |
| Private | `passwordProtected` | Invisible | Visible | Submit password hash, then use ticketed `sdr://` link |
| Friends Only | `friendsOnly` | Friends Only | Hidden | Visible only to the linked host or an immediate Steam friend |

All three modes heartbeat to the website. Only Public and Private are returned
to anonymous callers. An authenticated caller whose website account has a
linked SteamID also receives Friends Only lobbies when that SteamID is in the
host's immediate-friends snapshot. Friends Only rows have `access: "friend"`.

For a password-protected lobby, an immediate Steam friend whom the host invites
can authenticate directly with the host without a website ticket. This is the
offline escape hatch. Other players must present the short-lived website ticket
in the native multiplayer hello packet.

## Account-to-Steam linking

All authenticated routes use the existing JWT:

```http
Authorization: Bearer <website-jwt>
```

Start a Steam OpenID link:

```http
POST /api/auth/steam/link
Content-Type: application/json
Authorization: Bearer <website-jwt>

{"returnPath":"/account"}
```

Response:

```json
{
  "authorizationUrl": "https://steamcommunity.com/openid/login?...",
  "expiresAtUtc": "2026-07-17T18:10:00Z"
}
```

Navigate the browser to `authorizationUrl`. Steam returns to
`GET /api/auth/steam/callback`; the backend validates the OpenID assertion and
redirects to the supplied local return path with one of:

- `?steamLink=linked`
- `?steamLink=conflict`
- `?steamLink=failed`

A SteamID may be linked to only one website account. `GET /api/auth/me` includes
`user.steamId`. Unlink with:

```http
DELETE /api/auth/steam
Authorization: Bearer <website-jwt>
```

## Host announcement

The launcher creates one random 32-byte secret per hosted lobby. It sends the
secret on every heartbeat and keeps the same secret in the host process so the
host can validate password join tickets.

```http
POST /api/lobbies/announce
Content-Type: application/json
X-SDR-Lobby-Secret: <64-lowercase-hex-characters>
```

```json
{
  "lobbyId": "109775241055404321",
  "hostSteamId": "76561198000000001",
  "hostPlayer": "Luthacus",
  "privacy": "passwordProtected",
  "password": {
    "algorithm": "pbkdf2-sha256",
    "iterations": 210000,
    "salt": "00112233445566778899aabbccddeeff",
    "hash": "64-lowercase-hex-characters"
  },
  "friendSteamIds": [
    "76561198000000002",
    "76561198000000003"
  ],
  "players": 1,
  "maxPlayers": 4,
  "build": {
    "appId": 480,
    "protocolVersion": 60,
    "manifestSha256": "64-lowercase-hex-characters",
    "loaderVersion": "1.0.0"
  },
  "game": {
    "phase": "hub",
    "boneyardId": "mount-awful",
    "boneyardName": "Mount Awful",
    "boneyardSha256": "64-lowercase-hex-characters-or-null",
    "wave": null,
    "difficulty": null,
    "elapsedSeconds": null,
    "statusText": "Choosing a boneyard"
  }
}
```

`password` must be `null` for Public and Friends Only. A Private lobby must
provide the exact algorithm, iteration count, 16-byte salt, and 32-byte hash.
Steam identifiers are JSON strings because 64-bit values are not safe JavaScript
numbers.

The game metadata is deliberately nullable apart from `phase`. Expected phase
values are `hub`, `loading`, `session`, and `results`. The launcher accepts these
fields now; the game-side source for changing boneyard/wave/run values can be
wired later without changing this API.

Success:

```json
{"id":42,"expiresInSeconds":120}
```

The launcher heartbeats every 20 seconds. A lobby expires 120 seconds after its
last accepted heartbeat. The same `lobbyId` may be updated only with its original
secret.

Explicitly delist on shutdown:

```http
DELETE /api/lobbies/109775241055404321
X-SDR-Lobby-Secret: <same-secret>
```

The detached publisher treats network failures, timeouts, and non-success HTTP
responses as directory failures only. It never closes the Steam lobby.

## Lobby list

```http
GET /api/lobbies
Authorization: Bearer <optional-website-jwt>
```

The response is personalized when a valid bearer token identifies a linked
Steam account, so it is returned with `Cache-Control: private, no-store` and
`Vary: Authorization`.

```json
{
  "items": [
    {
      "id": 42,
      "hostPlayer": "Luthacus",
      "hostSteamId": "76561198000000001",
      "privacy": "passwordProtected",
      "access": "password",
      "players": 1,
      "maxPlayers": 4,
      "lastSeenUtc": "2026-07-17T18:00:00Z",
      "expiresAtUtc": "2026-07-17T18:02:00Z",
      "build": {
        "appId": 480,
        "protocolVersion": 60,
        "manifestSha256": "64-lowercase-hex-characters",
        "loaderVersion": "1.0.0"
      },
      "game": {
        "phase": "hub",
        "boneyardId": "mount-awful",
        "boneyardName": "Mount Awful",
        "boneyardSha256": null,
        "wave": null,
        "difficulty": null,
        "elapsedSeconds": null,
        "statusText": "Choosing a boneyard"
      },
      "password": {
        "algorithm": "pbkdf2-sha256",
        "iterations": 210000,
        "salt": "00112233445566778899aabbccddeeff"
      },
      "join": null
    }
  ],
  "playerCount": 1
}
```

`access` is one of `public`, `password`, or `friend`. Public and friend rows
include:

```json
{
  "join": {
    "lobbyId": "109775241055404321",
    "launchUri": "sdr://join/109775241055404321"
  }
}
```

Private rows intentionally withhold both the Steam lobby ID and launch URI until
password authorization succeeds.

For live updates, connect to `GET /api/lobbies/events` with the same optional
bearer token. It is a Server-Sent Events stream. Each changed payload is emitted
as:

```text
event: lobbies
data: <same JSON object returned by GET /api/lobbies>
```

Use a fetch-based SSE client when sending the bearer token; the browser's native
`EventSource` API cannot attach an `Authorization` header.

## Password authorization

The frontend derives the submitted credential locally:

```text
passwordHash = lowercase_hex(
  PBKDF2-HMAC-SHA256(
    UTF8(password),
    hex_decode(password.salt),
    password.iterations,
    32 bytes
  )
)
```

Send only that 64-character hash:

```http
POST /api/lobbies/42/authorize
Content-Type: application/json
Authorization: Bearer <website-jwt-with-linked-steam-id>

{"passwordHash":"64-lowercase-hex-characters"}
```

Success:

```json
{
  "lobbyId": "109775241055404321",
  "steamId": "76561198000000002",
  "ticket": "v1.<opaque-short-lived-ticket>",
  "expiresAtUtc": "2026-07-17T18:01:00Z",
  "launchUri": "sdr://join/109775241055404321?ticket=v1..."
}
```

The ticket expires after 60 seconds and is bound to both the Steam lobby and the
linked SteamID. The frontend must treat it as opaque and immediately navigate to
`launchUri`. The native host performs the final ticket check during the Steam
hello handshake.

Expected failures:

- `401`: website bearer token missing or invalid
- `403`: no linked SteamID or wrong password hash
- `404`: lobby expired or no longer exists
- `409`: lobby is full
- `429`: password-attempt rate limit reached

The hash is a reusable password-equivalent for the life of the lobby. All
website traffic must use HTTPS, and frontend code must not persist or log the
password or derived hash.

## `sdr://` launcher integration

The launcher exposes backend commands that a settings button or installer can
invoke without administrator rights:

```text
SolomonDarkModLauncher.exe protocol register --json
SolomonDarkModLauncher.exe protocol status --json
SolomonDarkModLauncher.exe protocol unregister --json
```

The registered Windows handler accepts:

```text
sdr://join/<steam-lobby-id>
sdr://join/<steam-lobby-id>?ticket=<opaque-ticket>
sdr://wait-for-invite
```

The handler translates those URIs into the launcher's existing Steam join path.
Registration is per user under `HKCU\Software\Classes\sdr`; no elevation is
required.

## Trust boundary

The lobby publisher reports the host SteamID, immediate-friends snapshot, build,
and game status. The website uses that data for discovery. Steam remains the
authority for actual lobby ownership and membership, and the native compatibility
handshake remains the authority for protocol and manifest acceptance. Website
discovery data alone never grants peer access.
