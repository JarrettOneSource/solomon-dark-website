# 2026-08-27 — Shared mobile HUD layouts and full-screen touch authoring

## Reported smell and system question

- Owner request: reopen the Website-only Mobile UI editor. On a coarse-pointer
  device the authoring canvas must occupy the complete safe game stage instead
  of being nested inside the Settings dialog. A small draggable overlay owns
  adjacent `SAVE` and `RESET` actions; save commits and leaves the editor,
  while reset restores the adaptive default draft. Fine-pointer desktop keeps
  the detailed windowed editor.
- The editor's default preview currently approximates several controls rather
  than reproducing their live visual bounds. The reopened membership adds the
  Health/Mana meter pair, uses the real pause-art inset and Inventory/Skillbook
  art bounds, and presents FPS/Ping with the live typography and transparent
  background. The full editor seed must project the same centres and sizes as
  the current adaptive touch HUD at the authored viewport and UI scale.
- Owner request: authenticated Website accounts may publish the complete
  committed layout to server-owned durable storage and receive an immutable
  short code. The Dark Cloud gains a `LAYOUTS` section. Anyone, including a
  guest with no bearer token, may resolve a code and install the returned
  layout locally. Settings also exposes `SUBMIT TO DARK CLOUD` directly below
  `CUSTOMIZE MOBILE UI` for authenticated users.
- This remains an explicit Website extension. Retail `0.72.5` has no browser
  account bearer, mobile layout document, share code, Pointer Events editor,
  or anonymous HTTP lookup. No new executable fact or Mod Loader change is
  claimed. The native preservation question is unchanged: geometry and
  publication must not cross into HUD semantics, input authority, tutorial
  gates, session protocol, simulation, saves, or desktop placement.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Refreshed Website tree | `6d3a1d7738ee425ee5876e9e1087afddc940ad0d`; `GameSettingsDialog.tsx`, `MobileUiEditor.tsx`, `mobile-ui-layout.ts` | One 17-member version-1 local record and one editor draft exist. Coarse and fine pointers currently share the same nested Settings page. | high |
| Live default owners | `GameMenuSkull.tsx`, `GameHud.tsx`, `SkillQuickbar.tsx`, `TouchJoystick.tsx`; `main-menu.css`, `hub.css`, `touch-joystick.css` | The touch default is split across one stage owner, the display-scaled HUD frame, and scene joysticks. Meter tracks are a paired `GameHud` presentation lane. Preview art must use those owners' actual hit/art bounds rather than independent guesses. | high |
| Account/API ownership | `AuthEndpoints.cs`, `TokenService.cs`, `AppDb.cs`, `DatabaseSchema.cs`, `frontend/src/lib/api.ts` | JWT account identity is already the authoritative publishing gate. Additive SQLite schema creation supports an immutable author-owned record. Existing typed requests attach a bearer when present but also support public GET routes. | high |
| Dark Cloud ownership | `DarkCloudScene.tsx`, `dark-cloud.css`, current three-section catalog controller | Dark Cloud already owns responsive full-screen content tabs and an authenticated account band. A cohesive Layouts child can own publish/resolve UI without entering the mod-row or party-directory domains. | high |
| Platform boundary | retail executable `0.72.5`, preferred base `0x00400000`; 2026-08-26 mobile editor ledger entry | Server sharing and full-screen phone authoring are product extensions. Native evidence is relevant only to preserving the already recovered HUD members and Settings/Dark Cloud lifecycles. | high |

No new static or live native probe is required. The open questions are fully
owned by current Website code, HTTP integration, and browser geometry.

## Reopened boundary and complete membership

System: versioned mobile HUD presentation documents plus an immutable public
share-code registry. The local committed document remains the only runtime
input. Publishing copies that document to a server record; resolving validates
the server document again before replacing the local committed document.

| Member | Owner | Required disposition |
| --- | --- | --- |
| Existing 17 controls | existing stage/HUD/scene owners | preserve semantic handlers, scene membership, touch-only projection, and versioned complete-document validation |
| Health/Mana meter pair | `GameHud` meter presentation | one new editor member moves/scales/rotates both live tracks as a group; fill, shield, reserve, alt text, and tutorial combat visibility remain live and unchanged |
| Coarse full-screen canvas | `GameSettingsDialog` plus `MobileUiEditor` | replace only the nested coarse editor presentation; canvas is fixed to the safe stage and element gestures do not pan the page |
| Draggable Save/Reset dock | `MobileUiEditor` transient UI state | dock motion is clamped to the visible editor; it is never persisted as layout data; button presses do not begin a drag |
| Fine-pointer detailed editor | existing Settings subpage | retain selector, grid, resize/rotate controls, page pan, deep zoom, status, and outer `SAVE` action |
| Layout publication | new `/api/game/layouts` POST | bearer-required, exact complete document validation, immutable record, cryptographically random unambiguous code, author and UTC creation receipt |
| Layout resolution | new `/api/game/layouts/{code}` GET | anonymous, case/separator-normalized lookup, exact stored document and public author receipt, no account or subscription side effect |
| Settings submit action | root Controls group | authenticated direct publication of the current committed layout and selectable/copyable returned code; guests receive an explicit sign-in requirement |
| Dark Cloud Layouts | cohesive child of `DarkCloudScene` | all visitors may load by code; authenticated visitors may publish current; no mod search/sort/selection or party action leaks into the section |
| Range thumbs on coarse pointers | existing Settings range CSS | atlas thumb retains a transparent background exactly as on fine pointers; no white native button fill |

## Ownership, lifecycle, and falsifiers

- Share codes identify immutable snapshots, not mutable user slots. Publishing
  the same local layout twice may produce two codes; resolving never changes
  the server record. The database owns uniqueness and author deletion cascades.
- The server accepts exactly the declared document version, exact element set,
  exact transform fields, finite bounded centres/scales/rotations, and no
  unknown members. A malformed stored or returned record cannot enter local
  storage. The client does not trust its own TypeScript response annotation.
- Mobile `SAVE` commits once and returns to root Settings. Mobile `RESET`
  changes only the draft until save. Escape/back follows the same commit path.
  Desktop behavior remains windowed and unchanged except for the new meter
  member and corrected preview art.
- The default preview is derived from the current viewport, UI scale, fixed
  game display scale, quickbar constants, dock bounds, stage pause box, meter
  group bounds, and live diagnostics counter seed. Durable coordinates remain
  percentages plus scale/rotation; editor pixels and dock position are not
  serialized.
- Falsifiers: anonymous GET challenges for a token; anonymous POST succeeds;
  a partial or extra document is stored; a code changes after publication;
  importing affects desktop geometry; the meter transform separates health
  from mana or changes fill semantics; the mobile canvas is nested in the
  native Settings frame; save/reset controls cannot be moved clear of a HUD
  member; reset writes before save; range thumbs retain a white fill; or the
  desktop authoring controls disappear.

## Implementation and validation consequence

- Add one author-owned immutable entity and additive SQLite table, one focused
  endpoint module, and one backend integration contract proving authentication,
  strict validation, durable uniqueness, normalized anonymous lookup, and the
  exact response document.
- Extend the existing layout model rather than introduce a second runtime
  profile path. Add transport serialization/parsing there, then consume the new
  meter transform at the existing meter owner.
- Give Dark Cloud a cohesive Layouts component; keep its publish/load state out
  of the mod catalog and party controllers. Keep Settings publication local to
  the Settings owner and use the same typed API/document functions.
- Extend focused model/source contracts and the established production browser
  journeys. Browser acceptance must compare every editor default member with
  the corresponding live default screen rectangle, exercise mobile full-screen
  save/reset and dock drag, prove authenticated publish plus signed-out resolve,
  inspect the corrected diagnostics/meters/range thumb, and retain empty page,
  console, failed-request, failed-response, backend, and supervisor error arrays.
- Run the supported `./scripts/validate.sh` gate from the exact isolated tree.
  Push, deployment, production cutover, and service restart remain separate and
  are not authorized by this implementation request.

## Implementation validation receipt

- The Website now owns one immutable `SharedMobileUiLayout` row per publish,
  a strict version-2 18-member document validator, an account-only POST, and a
  public normalized-code GET. The client validates the public response before
  committing it locally. Dark Cloud exposes the fourth `LAYOUTS` section and
  Settings exposes `SUBMIT TO DARK CLOUD` immediately under the editor action.
- Coarse pointers now replace the Settings frame with a `896 x 414` full-stage
  authoring canvas at the accepted iPhone-landscape viewport. The transient
  action dock measured `176 x 42` and was dragged from `(712,8)` to `(102,129)`
  while remaining clamped inside the stage. `RESET` restored the untouched
  default draft; `SAVE` committed once and returned to root Settings. The
  desktop negative control retained the detailed windowed editor and its
  selector, grid, fit/zoom, resize, rotate, status, and outer Save controls.
- The editor and live default receipt matched the exact screen rectangles for
  pause, diagnostics, paired Health/Mana meters, both joysticks, all eight
  quickbar positions, Inventory, Skillbook, XP, and both potion aliases. The
  diagnostics preview has transparent backing and the live `60 FPS / 0 ms`
  typography; the paired meter preview uses the live red/blue bar art. Range
  thumb contracts require transparent WebKit and Gecko backgrounds around the
  stock atlas art.
- The exact branch is one commit over refreshed Website base
  `e05ffc68edb7946b2b98eaf15d0191f8b0ecf601`. The canonical
  `./scripts/validate.sh` gate passed: backend build had zero warnings/errors;
  `27/27` Website/backend contracts passed; formatting, lint, TypeScript,
  every registered frontend/runtime/ML/desktop group, production frontend and
  game-host builds, bundle budget, and production media/CSP policy passed.
  Production entry `Game-CSNxZB6c.js` measured `250772` raw / `76287` gzip
  bytes under `524288 / 134144`. Gate log SHA-256 is
  `7ef30744d9c3bdf09438fb21af593ea9e2ecd13e927281155b970ce699fb146a`.
- The first post-rebase gate reached `1671/1672` Boneyard tests and hit the
  existing load-sensitive supervisor timeout `shared Hub admissions are
  single-use and expire before authentication`; no task file participates in
  that test. The clean canonical retry passed that test and the complete gate.
- Production-bundle Dark Cloud acceptance published immutable code
  `6Q2L-3GNA` under an authenticated account, signed out, resolved it without an
  Authorization header, and installed the exact document. Desktop, portrait,
  and landscape scenes had zero horizontal overflow; all measured touch
  targets were at least 44 pixels. Page, console, and failed-response arrays
  were empty. The reviewed Layouts frame SHA-256 is
  `13442045b4240bcaf0efd4f12f0ac87e41b0632bce9a89f3fde9eeac21bf8af5`.
- Production-bundle editor acceptance retained all 18 members, verified exact
  default/live geometry, exercised dock drag, Reset, element drag/resize/
  rotate/pinch, Save, reload persistence, and desktop isolation. Page, console,
  failed-response, and unexpected-request arrays were empty; the supervisor
  returned to zero sessions, players, parties, and runs. Receipt SHA-256 is
  `8e0f78224ecfbd3834c8f31e00ba33b6f9d91b11f0e3b8dffd6e640f1ea2b1f6`;
  reviewed mobile/desktop frame SHA-256 values are
  `663a19c89d2b5c85f3fa0c97438b28a5518dac6a8e5c07e609903cdad219f732`
  and `7323816cf12466bb129935ad4b0d936c6b58e9703480b7ff0aa4de6d21295149`.
- No browser-platform member remains blocked. Chrome touch emulation is not a
  physical-phone ergonomics receipt. The work is committed only on the local
  task branch; nothing has been pushed, deployed, restarted, or cut over in
  production.
