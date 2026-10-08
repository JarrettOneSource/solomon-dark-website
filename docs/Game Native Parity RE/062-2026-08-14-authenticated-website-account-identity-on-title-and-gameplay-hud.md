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


## 2026-10-08 — Report 98: account identity during an editor test

### Reported smell and recovered ownership

The reporter sees an apparent sign-out in the Boneyard editor's pause settings.
The focused original-message and nearby-discussion read on October 8 confirms
that the account claim remains active, without a withdrawal. At current main
`7020dcd8`, `Boneyard` reads the Website `AuthProvider.user`, while
`EditorTestRuntime` sends the current `getToken()` bearer with its optional-auth
`/api/game/editor-test` request but
passes a literal null account into `MainMenuScene`. That shared scene presents
no HUD account and `ACCOUNT: GUEST` in gameplay settings. There is no editor
call to `logout`, `setToken`, or a competing authentication store. The causal
finding is a false guest presentation; actual expiration in the historical
reporter's session is not established.

This reopens the existing Website account-display boundary. Its earlier
membership did not include the subsequently added editor-test shell. Retail
0.72.5 has no Website account, as recorded above; no new native extraction,
authored table, or change to stock game behavior is implicated.

### Complete affected membership

| Member | Ownership / source | Disposition | Validation |
| --- | --- | --- | --- |
| Website token and current user, login/logout/refresh | `lib/auth.tsx`, `lib/api.ts` | verified-already-at-parity | Source trace: editor reads but never clears or replaces credentials |
| Regular Title, Hub, Boneyard and settings | `pages/Game.tsx` → `MainMenuScene` | verified-already-at-parity | Existing provider projection and shared consumer contract; unchanged |
| Standalone `/boneyard` → private test | `pages/Boneyard.tsx` → `EditorTestRuntime` | exact-ported | Built signed-in standalone journey passes the provider's exact current username |
| Dark Cloud Boneyards Edit/Test → private test | Same `Boneyard` and test runtime | exact-ported | Built Edit → Test and direct Test both retain the same provider identity |
| Private-test HUD, pause settings and nested account-dependent settings | `MainMenuScene` → `GameAccountName` / `GameSettingsDialog` | exact-ported | Five built settings/HUD assertions cover signed-in names and guest; correct share-action gating |
| Test boot, loading/cancel, return/repeat, failure and route teardown | `EditorTestRuntime` effect keyed by document | verified-already-at-parity | Document-only effect dependency remains; repeated/cancelled/failed tests retain account and draft |
| Disposable wizard profile, saves, Hall receipts and social isolation | Existing boot profile and editor-test host | verified-already-at-parity | Presentation remains separate from the intentionally anonymous transient wizard; host tests cover no rewards/checkpoints/archives |
| Cross-tab token synchronization and server token expiry policy | Global Website authentication | out-of-system | No new account store or expiry behavior; display follows the existing provider's current truth |

### Implementation consequence and validation contract

Thread only `user?.username ?? null` from the shared Boneyard owner through an
explicit `accountUsername` prop into the existing `MainMenuScene` presentation
seam. Preserve exact spelling/case in the HUD and the settings' existing
uppercase formatting. Keep the profile username null: the fresh Test Wizard is
disposable, and Website account chrome does not grant gameplay social identity,
progression, score, cloud-save or multiplayer participation. Do not add the
presentation prop to the authority-creation effect dependencies.

A source-contract regression must fail on the original literal-null seam.
Current account-presentation tests cover exact username and anonymous semantics.
Mac browser acceptance must use the built candidate, cover signed-in standalone
and both Dark Cloud entry branches, open the actual pause/account settings,
return and repeat, and preserve the token and document. Anonymous play must
still show guest with no false username. Test failure/cancellation must retain
the editor and Website account. Browser errors and unexpected HTTP failures
must be empty. Reuse the dedicated admission and host isolation cases. Required
canonical validation, publication and deployed verification remain pending.


### Implementation and focused acceptance receipt

- Runtime code `f423de0919b6d139ff0a8c0a4eb7703935f49a25`, based on current
  main `7020dcd8`, adds the explicit presentation prop at the one shared editor
  seam. The transient player profile and all host/session isolation remain
  unchanged. Follow-up `6c0f4dad` adds the existing account test file to the
  canonical `test:native-ui` command and normalizes its import/blank-line layout;
  it changes no runtime code or browser assets.
- On the M5 external Drive, restoring the genuine original `Boneyard` and
  `EditorTestRuntime` files under the new contract test fails exactly the new
  seam assertion (2 pass / 1 fail). Restoring the candidate passes all 12
  account/admission tests and all 14 dedicated editor-host/supervisor cases.
  Test TypeScript, production frontend/host build and Release backend build
  pass. These focused results are not a full canonical gate.
- Production-built Mac Chrome on isolated loopback Website/backend/supervisor
  services uses real throwaway local registrations and ordinary `/api/auth/me`,
  with only the local WebSocket address adapted through `example.invalid`.
  No production account, publish, or cloud upload is used. Signed-in standalone
  Test → pause settings → Return, repeated Test, cancelled admission and an
  intentional 503 retain the same bearer, successful `/api/auth/me` identity,
  and exact locally saved editor document.
- After dismissing the normal first-run tutorial prompt, Dark Cloud Boneyards
  Edit → Test and direct Test show the exact current username in the HUD and
  its existing uppercase form in the Account row. Anonymous standalone Test
  keeps the HUD account absent and shows `ACCOUNT: GUEST`. All five settings
  views have no Sign Out control. The mobile-share action retains its real
  existing implementation, remains disabled before customization, and shows
  the sign-in prerequisite only for guests. No share request was submitted.
- The first standalone account frame and immediate Dark Cloud/guest account
  samples were inspected. The latter capture during native-menu presentation;
  account text and DOM state are verified, with no claim of a new layout or
  timing audit. Unexpected page/console/HTTP errors are empty. The deliberate
  503 is recorded separately. An earlier harness attempt stopped at the normal
  tutorial overlay before Dark Cloud entry, then only the remaining journey was
  rerun with that precondition handled. The initial runner also reached the
  browser stage before its script existed; all completed checks were reused.
- The final browser process exited zero and the owned M5 lease was released at
  `2026-10-08T06:56:17.211659+00:00`. Combined canonical validation, normal main
  publication, maintained deployment and deployed-client verification remain
  with the campaign coordinator. No completion reaction is authorized by this
  focused receipt; Report 80 shares the source's representative target.


## October 8 composed canonical acceptance

Runtime/test candidate `cde84b13acd8bd95dfccd153be65bc0a59d0511f` passed the
unchanged complete M5 `scripts/validate.sh` at 07:46:07 UTC: 45 Python tests
and 4,414 Node executions across 22 batches, with no failures, skips or
cancellations. Configured renderer coverage is 100%; mutation acceptance
records 603 killed, 198 compile errors, two nonterminating timeouts, no
survivors, and the existing documented equivalents. Quality failures are empty.

The initial acceptance runner put HOME on an external volume without Unix
ownership, causing two native launchd fixture bootstrap errors. Matching the
maintained worker's real HOME corrected that test setup; source/build/cache/tmp
remained external and temporary test registrations were removed. No volume
security setting, test omission, product change or lowered gate was used.
Later acceptance/investigation edits are documentation only. Normal publication,
managed deployment and scoped live checks remain separate pending steps.

Scope: Report 98 account presentation; disposable test identity and authentication remain separate.
