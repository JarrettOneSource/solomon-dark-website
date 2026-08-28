# 2026-08-14 — Mobile right-stick primary attack producer

## Reported smell and parity question

- Reported web behavior: coarse-pointer gameplay has a left movement joystick
  but no equivalent mobile control for aiming and primary attacks.
- Stock behavior to recover: left mouse over the world owns a current aim plus
  a primary held level; the fixed-tick player path turns toward that aim and
  preserves each primary spell's press, hold, retarget, and release semantics.
- Reproduction inputs/scenes: Hub and Boneyard at mobile landscape size, with
  the left movement stick held independently and concurrently with a proposed
  right attack stick.
- Falsifiable questions: a rightward stick must yield heading index `6` and a
  primary cast; releasing it must lower the primary level without clearing the
  retained aim direction; interruption or an input barrier must lower both
  sticks synchronously before render suspension can retain authoritative input.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Existing native RE | retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, `Mod Loader/docs/reverse-engineering/native-input-model.md` | `Game::Tick` `0x005D7EF0` reanchors aim to `project(player) + (0, -25)` screen pixels; `PlayerActor::Tick` `0x00548B00` consumes current aim and primary level every nominal 10 ms tick. Left down/held/up are primary press/hold/release. | high |
| Existing native RE | `native-input-model.md`, Earth `0x00544C60` / `0x00609D30` / `0x005E5450`, Frost `0x00543860` / `0x00549725` | Earth retargets while held and fires on the falling level; Frost starts and sustains while held and stops after release. | high |
| Current web ownership trace | Website `386467d`, `input/TouchJoystick.tsx`, `input/gameplay-input.ts`, `HubScene.tsx`, `BoneyardScene.tsx` | Each scene owns one browser input adapter. The existing touch component produces only movement; mouse aim/cast already enters the shared `PlayerCharacterInput` sent to the authoritative session. | high |
| Current simulation trace | Website `386467d`, `core-kernels/primary-spells.ts` and `core-kernels/player-character.ts` | `cast.primary && aim` derives press/release, samples aim through the native torso anchor, writes cast-owned heading, and dispatches element-specific primary behavior. No touch-specific simulation path is needed. | high |
| Existing browser receipt | 2026-08-13 responsive/input-lifecycle and 2026-08-14 built-joystick receipts in this ledger | Pointer ownership survives snapshot renders; blur, hidden document, page hide, blocking, and destruction must synchronously clear retained input. Production CSS must be exercised because dev and built transform output previously differed. | high |

## Native ownership thread

- Owner and construction path: Win32 input and the embedded aim/cast control
  produce stock levels; `Game::Tick` reanchors aim and `PlayerActor::Tick` owns
  spell dispatch. In the port, each scene constructs one `BrowserGameplayInput`
  and the authoritative session/simulation remains the sole gameplay owner.
- Upstream state producers/callers: native left-button level plus cursor aim;
  browser mouse and touch controls are sibling producers of the same retained
  `PlayerCharacterInput` fields.
- State representation and transitions: a non-zero right-stick direction owns
  a world aim and primary held level. Direction updates retarget the held cast;
  stick release lowers only the touch primary level and retains its last aim.
- Downstream consumers/callees: the session publishes input to the host; the
  100 Hz simulation derives press/hold/release, updates cast-facing, and owns
  projectiles/channels; presentation and audio consume replicated spell state.
- Sibling systems sharing ownership or data: mouse primary/secondary casting,
  the left touch movement lane, gamepad/keyboard movement, loading barriers,
  and scene/browser interruption all share the browser input adapter.
- Entry, interruption, reset, and teardown: a new contact may begin only after
  the prior pointer ends. Pointer up/cancel, blur, hidden document, page hide,
  scene teardown, and blocking release the primary level; the component also
  recenters its own knob.

## Recovered behavioral contract

- Timing/ticks/thresholds: touch edges publish synchronously so a short gesture
  cannot disappear between render frames. While held, the current level and
  aim are resampled for the authoritative tick path. The simulation retains
  native element timing; the input producer adds no cooldown or timer.
- Geometry/transforms/coordinate spaces: the right stick reports a normalized
  screen direction. Its world aim starts at the recovered torso anchor
  `player + (0, -25 / viewScale)` and extends along that direction by the
  largest centered radius inside the logical viewport,
  `(min(viewport.width, viewport.height) / 2 - 25) / viewScale`. At the native
  `1600x900` viewport this is `425 / viewScale` world units. This reach is a
  deterministic browser representation; primary spell direction is unchanged
  by its magnitude.
- Render/hit/collision/traversal order: left and right controls are separate
  topmost DOM pointer surfaces. Each owns one pointer id, allowing simultaneous
  movement and attack without forwarding an accidental mouse cast to the world
  renderer. Projectile collision remains simulation-owned.
- Assets/audio/randomness: no new asset, audio, or RNG path. Existing primary
  spell state drives native-derived presentation and audio.
- Input/network authority/replication: only `PlayerCharacterInput` crosses the
  session seam. The right stick does not directly turn actors or spawn spells;
  the host derives both from aim and the primary level.
- Boundary and failure behavior: zero/non-finite direction is release. A touch
  primary lane composes with, rather than overwrites, mouse levels. Blocking or
  interruption emits idle input immediately and drops barrier-time changes.

## Nearby-system findings

- Durable finding: the prior twin-stick design's separate right trigger is not
  appropriate to a screen-only mobile surface; this owner-requested producer
  intentionally combines right-stick aim with the existing primary held lane.
- Evidence: the native intent contract keeps aim and primary press/hold/release
  independent, so one browser producer may emit both without changing the sim.
- Why it matters or may matter later: gamepad right-stick aim remains a separate
  future producer and must not inherit auto-cast from the mobile control.
- Native report/catalog also updated: no. No new retail fact was recovered;
  this entry consumes the closed G14 input contract and labels mobile layout
  and reach as browser policy.

## Confidence and open questions

- Confirmed: native aim anchor, fixed-tick level semantics, cast-owned facing,
  element-specific hold/release behavior, web input/session ownership, and
  interruption requirements.
- Inferred: none in the authoritative simulation path.
- Unknown: touch-control size and sensitivity have no stock oracle. They remain
  explicit browser policy matching the existing movement stick.
- Next falsifying probe if the unknown becomes material: device playtesting at
  the minimum supported landscape viewport, measuring acquisition and diagonal
  precision without altering simulation aim rules.

## Web implementation consequence

- Correct owner/module: reuse `input/TouchJoystick.tsx` for pointer geometry;
  keep independent touch aim/cast state in `input/gameplay-input.ts`; derive the
  world aim in `input/gameplay-pointer.ts` from scene player/viewport data.
- Shared model change: add a touch-primary producer method to the browser input
  adapter and mount a right-side instance in both gameplay scenes.
- Stock behavior preserved: the existing authoritative primary-spell kernel
  continues to own facing, press/hold/release, projectiles, channels, audio,
  collision, and replication.
- Browser-specific approximation, if unavoidable: right-side HUD-safe joystick
  placement, dimensions, and derived visible aim reach are mobile UI policy.
- Symptom patch or obsolete path to remove: none; split the existing hard-coded
  left positioning into explicit movement/primary side modifiers.

## Validation contract

- Focused automated test: prove screen direction projection uses the 25-pixel
  torso anchor and derived reach; prove touch press/update/release, last-aim
  retention, mouse-lane composition, blocking, and interruption.
- Playwright or runtime journey: at `844x390`, require two centered controls;
  drag the right stick right, observe Water primary state and heading index `6`,
  release and observe the channel stop; retain left-stick movement coverage and
  exercise simultaneous distinct contacts.
- Stock-versus-web comparison: compare the emitted aim direction and primary
  level transitions to the G14 mapping, not touch pixels to nonexistent native
  mobile UI.
- Measurable acceptance criteria: both knobs follow/recenter within `1 px` in
  the production bundle, rightward aim resolves to `(1, 0)` within floating
  tolerance, primary starts/stops exactly once per gesture, movement and attack
  coexist, and browser/page errors remain empty.

## Implementation validation receipt

- Implemented in the shared browser-input seam and mounted in both `HubScene`
  and `BoneyardScene`. The right touch lane projects its normalized direction
  from the local presentation player through the recovered 25-pixel torso aim
  anchor, then publishes the existing primary held level; the simulation still
  owns facing and every element-specific spell lifecycle.
- Focused contracts were written red first: the initial gate produced the three
  expected missing-symbol failures before implementation. The final canonical
  `./scripts/validate.sh` passed 23 backend contracts, all 426 frontend tests,
  all five desktop contracts, lint/architecture checks, formatting, production
  builds, and media policy on the tree integrated with account-HUD commit
  `5a66aa3`. Before that integration, one unchanged-tree run reported 423/424
  frontend tests; the immediate full canonical rerun passed 424/424.
- The freshly built production bundle passed the `844x390` Chrome journey:
  movement center `(51.13, 325.00)`, primary center `(737.40, 325.00)`,
  rightward Water cast heading `6`, simultaneous independently owned movement
  and primary touches, primary release/recenter, and a second primary cast in
  Boneyard. Browser/page errors were empty. The first post-integration browser
  launch stalled in the existing startup loader at 1/663 assets with no page
  error; an unchanged fresh-browser rerun completed the full journey.
- Visual receipts:
  `/tmp/solomon-dark-right-stick-idle-final.png` and
  `/tmp/solomon-dark-right-stick-held-final.png`. The idle frame confirms the
  right control clears the parchment map; the held frame shows the knob at its
  right limit and the player facing/casting Water in that direction.
- The broader pre-existing device journey currently stops in Create before
  gameplay because it still expects the removed
  `.create-menu-native-top-stage` DOM surface. The focused production journey
  directly covers this input contract in both gameplay scenes; gamepad mapping
  and physical-device tuning remain outside this change.
