# 2026-08-27 — Two-second authoritative resume grace with progress presentation

## Reported smell and parity question

- Product correction: reduce the Website resume grace from three seconds to
  two and replace the numeric `RESUMING IN 3,2,1` countdown with a progress bar.
- Preserve the recovered authority boundary: the host, not the bar, owns the
  deadline; pending renderer/player readiness remains an indefinite textual
  wait; expiry clears input and resumes with no catch-up.
- This reopens the 2026-08-26 resume-grace and 2026-08-27 mutual-renderer-
  readiness entries only at their explicit Website extension. No retail timing
  claim changes: stock still has no post-modal resume grace.
- Falsifiers: a retained 3,000-ms host deadline, a client-only two-second bar
  over three seconds of held simulation, numeric countdown copy/digits, a bar
  during nullable pending readiness, or any reason/surface retaining the old
  duration.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Product direction | user correction, 2026-08-27 | Exactly two seconds and a progress bar replace the countdown. | authoritative |
| Existing retail evidence | same pinned retail image and `native-gameplay-pause.md`; `0x005CBD40`, `0x00427800`, `0x005ABF10` | Stock suspension/release and no-catch-up semantics remain the base; stock supplies no grace duration or countdown. | high |
| Current authority trace | Website `ec98c44e`; `GAMEPLAY_RESUME_GRACE_DURATION_MS`, `game-host.ts`, strict decoder, client session | One shared 3,000-ms constant caps the wire projection and creates every standalone/shared/menu/picker/loading deadline. | high |
| Current presentation trace | `GameplayResumeCountdown.tsx`, `gameplay-resume-grace.ts`, CSS and browser journeys | The client derives `3,2,1` from host-issued remaining time and renders one large number; nullable pending state already has the correct waiting copy. | high |

## System boundary and membership inventory

System boundary: **run-scoped authoritative resume grace**, including every
admission reason, waiting/deadline phase, wire bound, presentation projection,
input/simulation hold, late projection, expiry, and teardown.

| Member / branch | Required disposition | Proof contract |
| --- | --- | --- |
| Multiplayer Pause Menu and gameplay Settings release | `exact-ported` Website policy correction | one 2,000-ms host deadline and monotonic bar; no numeric countdown |
| Multiplayer Inventory close | `exact-ported` shared correction | same duration/bar and held authority |
| Multiplayer full Skill Book close/handoff | `exact-ported` shared correction | 40-tick native close remains; grace begins only at actual release |
| Multiplayer compact skill-selector close | `exact-ported` shared correction | same duration/bar |
| Final mandatory SkillPicker cohort release | `exact-ported` shared correction | pending close/readiness first, then one 2,000-ms bar for all peers |
| Initial ordinary/custom/Tutorial Boneyard readiness | `exact-ported` shared correction | `Waiting on players ...` remains until all renderers; then two-second bar |
| Active-party rejoin, staged catch-up, and same-tab takeover | `exact-ported` shared correction | all existing readiness/materialization composition retained; bar starts only at the valid all-ready edge |
| Active saved-run restart, including solo | `exact-ported` shared correction | two-second authoritative bar after renderer readiness |
| `party-rejoin-wait` | `exact-ported` shared correction | indefinite `Waiting for players to rejoin` has no bar; valid return changes to the same two-second bar |
| Late client during an active grace | `exact-ported` | receives current remainder and begins at the corresponding nonzero fill; cannot restart or lengthen the deadline |
| Gameplay pause/level barrier composition | `verified-already-at-parity` with new duration | no progress accrues beneath an older owner because the deadline remains null |
| Solo menu/modal release and pause-owner disconnect | `verified-already-at-parity`, no grace | immediate ordinary resume remains unchanged |
| Hub/title/Create/loading/Game Over/loadout/observer/bot/unrelated party | `out-of-system` | no active-run grace progress surface or hold |
| Stale/duplicate ready intent, expiry, run replacement, empty retirement | `verified-already-at-parity` | cannot shorten authority; teardown removes bar and record exactly once |
| Strict wire contract | `exact-ported` Website protocol 95 | maximum positive remainder is 2,000; 2,001 is rejected; shape and reason family are unchanged |

No browser member is blocked. `performance.now()` supplies the monotonic host
deadline and presentation clock required for the exact Website policy.

## Ownership thread and recovered behavioral contract

- `GAMEPLAY_RESUME_GRACE_DURATION_MS` remains the one authority constant but is
  exactly `2_000`. Every host deadline and strict maximum consumes it; tests do
  not carry independent three-second literals.
- Nullable `remainingMs` still means waiting, has no numeric/progress value,
  and retains the two existing messages. A positive remainder begins progress
  at `1 - remainingMs / 2_000` and advances monotonically to 100 percent from
  the client receipt clock. It never sends a ready/release intent or changes
  host state.
- The active presentation is one centered native-gold panel labeled
  `RESUMING...` with an accessible 0-to-100 progressbar. The old seconds
  function, number node, countdown classes/selectors, and screenshot names are
  removed rather than retained as compatibility paths.
- Protocol 95 prevents an old 3,000-ms server projection from being accepted as
  the same wire contract. Saves remain unchanged because grace is ephemeral.
- Input clearing, prediction/presentation hold, per-party isolation, readiness
  cohorts, late projection, scheduler reset, and no catch-up are unchanged.

## Confidence and open questions

- Confirmed: complete reason/surface family, sole duration constant, host/wire
  consumers, pending/active phases, and presentation clock ownership.
- Inferred: none used for authority.
- Unknown: none. Bar styling is Website presentation policy and does not claim
  a retail record.

## Web implementation consequence

- Change the authority/wire constant and protocol version together; update
  every duration assertion across host, supervisor, client, and protocol
  coverage.
- Replace the countdown module and CSS completely with a progress component.
  Preserve pending waiting copy and the existing centralized presentation-frame
  subscription.
- Update every browser journey to prove monotonic early/middle/late progress,
  exact held simulation, two-second teardown, and no old selector/digit.

## Validation contract

- Pure tests: exact 2,000-ms constant; progress at full/partial/expired
  remainder; nullable waiting; clamp before/after bounds; strict 2,001 rejection;
  protocol 95.
- Host/client tests: all reasons start above 1,900 ms, remain held through a
  1,500-ms sample, expire no earlier than the tolerance around 2,000 ms, and
  preserve no-catch-up/readiness/stale-intent behavior.
- Mac Chrome: initial loading readiness, Inventory, Skill Book, selector,
  Pause Menu, SkillPicker, rejoin/restart, and party-rejoin wait show waiting or
  monotonic progress as applicable; authority tick/world stays exact until
  teardown; old countdown DOM/copy is absent.
- Exact candidate: canonical Mac gate plus the loading and pause/rejoin browser
  journeys with empty error arrays.

## Implementation validation receipt

- `GAMEPLAY_RESUME_GRACE_DURATION_MS` is now the single exact `2_000` authority
  and strict-wire maximum. The concurrent viewport-height wire change owns
  protocol 94, so their correctly combined contract is protocol 95. Every
  standalone/shared/menu/picker/loading deadline consumes the same constant;
  a 2,001-ms projection fails closed and save schemas remain unchanged.
- `GameplayResumeProgress` completely replaces the old countdown component,
  seconds projector, CSS names, selectors, and screenshot contracts. Nullable
  readiness retains only its two useful waiting messages. Positive remainder
  projects `1 - remaining / 2_000` through the existing presentation-frame
  clock into a centered `RESUMING...` progressbar; the bar never sends a ready
  or release intent and its frequently changing value is outside the polite
  text live region.
- Mac Chrome 151 observed monotonic 10/50/90-percent progress with exact held
  authority for initial renderer readiness, Inventory, Skill Book, compact
  selector, Pause Menu, peer ownership, and a solo saved restart. Example held
  ticks were owner `1780`, peer `1789`, and restart `1795`; all resumed without
  catch-up. Page and failed-response arrays were empty. Log SHA-256 is
  `91738d8cd567b145d31e52057076914e43ad1f78b5f7655d95341cb065b5d0d5`;
  inspected progress-frame SHA-256 values are
  `2dcf6a5d198549d62cb2600eab28c873293475b55c55472733faad0d5e2a1538`
  and
  `aac381bbb9721b20968daacff1239d94159534d98772ca094a58a3cdb0f668db`.
- The two-client SkillPicker journey held tick `8769` through both clients'
  10/50/90-percent progress and resumed at `8770`, retaining distinct offers,
  level-up particles/audio, and empty page/console errors. Log SHA-256 is
  `b77bd62764aa51ba66a167cb6c8f3125bf8247f531cc7fa3a94c40465761887c`.
- The active-party journey retained tick `999`, resolved catch-up offer
  sequences `[4,6,8,10,12,14,16,18]`, showed the indefinite rejoin message
  without a bar, switched to authoritative progress only after readiness, and
  resumed at `1000`; save revision advanced `2 -> 23`. Page, console,
  request/response, and host-error arrays were empty. Log SHA-256 is
  `ace9d2da173eab798ffb0005ffb50416be743ba6abeae61aff77bba5a84d7f66`;
  inspected waiting/catch-up frame SHA-256 values are
  `a452791c8ab7c4d0899ea31937915b3ddc40203605de1992116bc6d7763c80ac`
  and
  `de50c92d4eef05028f9921f430e7e76e2446d698cdab509fb743ecbc7e9ccbb2`.
- No browser-platform exception, native unknown, or retained compatibility path
  remains. No Mod Loader file changed because its existing reports already own
  the reusable retail facts. Deployment and production cutover remain outside
  the user-authorized `main` publication.
- Publication rebase: the exact pre-receipt candidate was Website
  `aaa220a21eaceacdf81fb33cef9c356a5e3b77d6` over current `main`
  `2f2f4097df0488854064a62fc8a5b3eae172e308`; its local/Mac 25-path manifest
  matched at SHA-256
  `348ae73126d7d926a3b8e04a9c5ab657715bc6cccae7b4726793641fa774bcaf`.
  The canonical Mac gate passed 27 backend/contracts, 311 prerequisites,
  1,691 Boneyard/host tests, 77 ML tests, all auxiliary suites, production
  builds/media policy, and the bundle budget (`251,319` raw / `76,425` gzip).
  Gate-log SHA-256 is
  `c2b5e556a5ed0980cfab69d4ec3ff9c18563a1b7a205d518edae08922f143a0b`.
- Publication Chrome 151 receipts repeated one bounded startup, two atomic
  delayed-art loading transitions, all modal/restart progress branches,
  SkillPicker tick `10543 -> 10544`, and active-party rejoin with offers
  `[4,6,8,10,12,14,16,18]`. Every page/console/request/response/host error
  array was empty. Log SHA-256 values are
  `6a4104ed77b042721d692a662359156160eca08e87a52e4390cc67e21b795067`,
  `6ad73c75519f25dd0afdb4c2ea3104d2a50018e3c1dc4706034eb44c23161cc0`,
  `69e581018a17ee0b10dafba8837163aea42c51b4ac070fb850573792dd3087ea`,
  `8050c9d602e4fe105d2a2417987a6972e90074ab6415337d84952a3ffe245a75`,
  and
  `317304d50728d53fdfa999f4ae3ebfd0e254647e2cc570946eb9f27103a47bdb`.
  This publication receipt is the sole post-validation documentation write;
  no runtime, test, build, or browser byte changed afterward.
