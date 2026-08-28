# 2026-08-14 — Authenticated Website account identity on Title and gameplay HUD

## Reported smell and parity question

- Requested web behavior: when `/game` is opened by a signed-in Website user,
  show that account in the Title screen's top-left corner and again below the
  gameplay skull/diagnostics row, before the ally-health roster begins.
- Current behavior: `Game.tsx` already reads `AuthProvider.user` and reuses the
  Website username as the player's default display name, but neither the Title
  presentation nor the shared Hub/Boneyard HUD exposes the authenticated
  account. A guest and a signed-in user therefore have the same surrounding
  chrome.
- This is an explicit Website account surface, not a stock Solomon Dark HUD
  feature. The parity question is how to add it without changing the recovered
  Title painter, treating a Website login as authoritative gameplay state, or
  corrupting the compact ally-row geometry beneath the skull.
- Falsifiers: sourcing the label from a gameplay snapshot, sending Website
  account data through the game protocol, showing a label after authentication
  fails, attaching Title text to the centered menu lane, covering FPS/ping or
  the first ally row, or changing stock ally-row internals disproves the model.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Website authentication | `frontend/src/lib/api.ts`, `frontend/src/lib/auth.tsx`, `backend/Api/AuthEndpoints.cs`, and `frontend/src/main.tsx` at `693cdbd` | `sdr.token` gates an authenticated `GET /api/auth/me`; the provider publishes the returned `User` and clears both token and user when refresh fails. The provider already wraps the `/game` route. | high |
| Current `/game` causal trace | `frontend/src/pages/Game.tsx` and `frontend/src/game/MainMenuScene.tsx` at `693cdbd` | `user?.username ?? 'Helvidius'` feeds lobby creation and `PlayerCharacterConfig.displayName`. No optional Website-account identity crosses the page/scene boundary, and no account element exists in Title, Hub, or Boneyard. | high |
| Browser baseline | Chrome `150.0.7871.124`, local Vite plus the standalone authoritative host, `1600 x 900`, controlled successful `/api/auth/me` response for exact username `Account-Smoke_7`; `/tmp/solomon-account-baseline-title.png` and `/tmp/solomon-account-baseline-hub.png` | React Strict Mode issued two successful identity reads. Title and Hub each contained zero `.game-account-name` nodes, with no page or console errors. Hub retained skull `(11,7,31 x 33)`, diagnostics at the right, and ally-roster top `46`. | high |
| Existing native Title/HUD evidence | clean retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `MainMenu_Render` `0x00598780`; shared HUD `0x005D2520`; Mod Loader `docs/reverse-engineering/native-ally-roster-hud-2026-08-14.md` | Stock has no Website-account concept. Title is screen-space presentation; the gameplay HUD is a later fixed-screen consumer. Native ally rows retain a 50 x 5 bar, two-pixel identity gap, seven-pixel name lane, and 10-pixel pitch. | high |
| Existing browser geometry | `renderer/game-viewport.ts`, Title edge-ownership ledger, `GameHud.tsx`, `AllyHud.tsx`, and `hub.css` at `693cdbd` | Fixed Title chrome has independent left/top anchoring. One React `GameHud` is shared by Hub and Boneyard inside the scaled gameplay frame. Skull, diagnostics, and roster are sibling fixed-screen surfaces. | high |

This pass recovers no new native address, asset record, or stock state. The Mod
Loader reports therefore do not receive a duplicate Website-account entry.

## Ownership thread and adjacency sweep

```text
local Website bearer
  -> AuthProvider refresh -> /api/auth/me -> optional User.username
       |                                      |
       |                                      +-> Title top-left account label
       |                                      +-> shared Hub/Boneyard HUD label
       |
       +-> existing gameplay display-name default (separate responsibility)
```

- Owner and construction path: `AuthProvider` remains the sole owner of
  Website login state. `Game.tsx` projects only the optional username into the
  game presentation shell. `MainMenuScene` routes it to the active local
  surface; neither renderer nor world constructs account state.
- Upstream state producers: a valid bearer plus `/api/auth/me` response produces
  the identity. No token, user id, email, School, Steam id, or full `User` object
  enters the game scene tree.
- State representation and transitions: the presentation value is exactly
  `string | null`. `null` means no account label. Auth completion or logout
  updates that value through ordinary React props; there is no copied store,
  timer, or snapshot reconstruction.
- Downstream consumers: Title consumes the value only while the root/play
  screen is mounted. The shared `GameHud` consumes it in both Hub and Boneyard.
  Create/loadout and transition covers do not gain an account surface.
- Sibling systems: the gameplay `displayName` may currently equal the account
  username, but it belongs to `PlayerCharacterConfig` and multiplayer identity.
  FPS/ping remain browser/session diagnostics. Remote players and future Golems
  remain authoritative ally-row producers. None is a substitute for Website
  authentication.
- Entry, interruption, reset, and teardown: a signed-out or rejected session
  renders nothing. Route teardown removes the local React surfaces with the
  game. Hub/Boneyard changes retain the same value because `MainMenuScene`, not
  either world epoch, owns it.

## Recovered browser contract

- Render only the exact authenticated username. Preserve case, underscores,
  and hyphens; those are valid Website account characters. The complete text
  remains available to accessibility as `Signed in as <username>`.
- The label is noninteractive and presentation-only. It must not capture
  gameplay input, provision a session, mutate the character configuration, or
  add a protocol field.
- Title uses the shared fixed-stage top-left anchor so extra width/height keeps
  the account attached to the browser edge while the logo/action stack remains
  centered. At native `1600 x 900`, the text begins at `(11,12)`.
- Gameplay uses the existing top-left HUD coordinate system. Skull remains
  `(11,7,31 x 33)` and diagnostics remain `(50,12)`. The account line begins at
  `(11,44)` with a 12-pixel line box; the ally roster moves intact from `y=46`
  to `y=62`. This leaves four pixels below the skull and six pixels before the
  first row.
- Use the existing browser diagnostic type family with the HUD's recovered gold
  identity color and dark text shadow. This is honest Website chrome, not a
  claim that the stock Fonts bundle contains account UI. The 180-pixel HUD lane
  fits every valid 24-character username without merging it into ally glyph
  layout.
- Native ally row bar dimensions, identity registration, clipping, health
  ratios, ordering, colors, and 10-pixel pitch remain unchanged below the new
  account line.

## Nearby-system findings and explicit unknowns

- The current auth provider refreshes once on mount and does not synchronize
  cross-tab token changes. That broader account-lifecycle behavior is not
  required to render the provider's current truth and is outside this change.
- Anonymous browser and standalone desktop play retain `Helvidius` as the
  current gameplay display-name default but show no Website-account label.
- The top-left skull is presently an image with `alt="Menu"`, not an active
  button. This change must not invent menu behavior or pointer ownership.
- No stock-versus-web account comparison exists because retail has no Website
  authentication. Native evidence is used only to preserve neighboring Title
  and ally-HUD ownership and geometry.

## Web implementation consequence

- Add one small account-name presentation component shared by Title and
  `GameHud`; it consumes an exact username and owns only accessible/visual text.
- Pass `user?.username ?? null` separately from the existing gameplay
  `displayName`. Thread the optional value through `MainMenuScene`, `HubScene`,
  and `BoneyardScene` into `GameHud` without touching `GameClientSession`, host,
  protocol, snapshots, or renderers.
- Add a top-left fixed-stage semantic overlay beside `TitleMenuPresentation`.
  Add the gameplay instance to the shared `GameHud` while preserving the
  skull/diagnostic row, then move only the `AllyHud` anchor to preserve the
  requested vertical order.

## Validation contract

- Focused coverage must prove a null account produces no label, an authenticated
  username is preserved exactly through the page/scene/HUD seam, and account
  UI remains absent from protocol/host ownership.
- A real Chrome journey with a successful controlled `/api/auth/me` response
  must show the exact username at Title `(11,12)`, then at Hub `(11,44)` below
  the skull and above roster `y=62`, and retain it in Boneyard. A separate
  anonymous context must show no account nodes.
- The journey must preserve skull/diagnostic geometry, reciprocal ally rows and
  their internal dimensions, WebGL readiness, and emit no page or console
  errors.
- The canonical `./scripts/validate.sh` gate must pass the exact Website tree.

## Implementation validation receipt

- `Game.tsx` now projects the provider's current `user?.username ?? null`
  separately from the gameplay display-name fallback. `MainMenuScene` carries
  that presentation value into one top-left Title overlay and the shared
  Hub/Boneyard `GameHud`; no host, protocol, snapshot, renderer, or simulation
  type changed.
- `GameAccountName` renders nothing for `null` and otherwise preserves the
  exact Website username plus `Signed in as <username>` accessibility text.
  Focused Node coverage passes all `3/3` Title/account presentation tests,
  including the valid `Account-Smoke_7` underscore/hyphen case.
- Controlled Chrome `150.0.7871.124` at `1600 x 900` observed two successful
  Strict-Mode `/api/auth/me` requests. The anonymous context retained zero
  account nodes. The signed-in journey rendered exact `Account-Smoke_7` text
  at Title `(11,12,126 x 14)`, Hub `(11,44,108.015625 x 12)`, and Boneyard
  `(11,44,108.015625 x 12)`.
- Hub geometry remained skull `(11,7,31 x 33)` and diagnostics beginning at
  `x=50`; the account occupied `y=44..56`, and the unchanged 180-pixel ally
  lane began at `y=62`. Both gameplay WebGL scenes reached `ready`, with zero
  page, console, or HTTP errors. Visual receipts are
  `/tmp/solomon-account-title-final.png`,
  `/tmp/solomon-account-hub-final.png`, and
  `/tmp/solomon-account-boneyard-final.png`.
- On the rebased `386467d` tree, the canonical `./scripts/validate.sh` gate is
  green: backend build, `23` Website/backend contract tests, formatting, lint
  and architecture boundaries, TypeScript, all `422` frontend tests, all `5`
  desktop tests, production frontend/host build, and production media policy.
