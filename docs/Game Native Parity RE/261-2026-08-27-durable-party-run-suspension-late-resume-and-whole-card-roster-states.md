# 2026-08-27 — Durable party-run suspension, late resume, and whole-card roster states

## Reported smell and parity question

- Reported web behavior: party rejoin does not reliably return former members
  to one run. The last actor's disconnect retires the run and all in-memory
  claims; an ordinary checkpoint cannot seed a replacement host because its
  signed `targetRevision` is null. A coordinated recovery additionally freezes
  on every signed roster member, so the first returner cannot continue while
  absent allies remain disconnected. Dead and disconnected styling is applied
  only over the seven-pixel health bar and contains no visible status copy.
- Required behavior: launching a Boneyard solidifies the complete ordered party
  into the run. Same-host disconnect, all-member disconnect, and unplanned
  same-revision host loss preserve that admission roster. The first former
  member to press `Resume Game` spins up the suspended run if needed, restores
  every party row as disconnected except itself, and may continue immediately.
  Any other former member's later `Resume Game` converges on that exact live run
  even after it advances. Reconnect must change the row immediately to the
  actor's live `DEAD` or ordinary state.
- Added liveness rule: if a living member disconnects while at least one dead
  human remains connected and no other materialized living actor remains, hold
  the exact run before all-dead arbitration and show `Waiting for players to
  rejoin`. Renderer-ready materialization of a recoverable living member starts
  the existing three-second authority countdown. If every browser leaves, the
  instance suspends instead of keeping a dead/empty simulation ticking.
- Presentation rule: `DISCONNECTED` is the visible label while transport is
  absent, including a dead-disconnected member. Once connected, a dead actor
  shows `DEAD`. Red death tint and dim/striped disconnect tint cover the complete
  ALLY card and may compose; accessible status retains both facts.
- Reproduction boundaries: shared-Hub and private-College parties; leader and
  nonleader first return; same-host loss, all-member clean leave, abrupt browser
  loss, unplanned same-revision supervisor replacement, coordinated
  cross-revision deployment, repeated suspend/resume, later return after live
  progress, connected alive/dead, disconnected alive/dead, dead-connected plus
  last-living disconnect, existing pause/level/loading barriers, Game Over,
  return to Hub, full capacity, forged/replayed/wrong-revision claims, Golem,
  reduced motion, desktop, and compact touch HUD.
- Falsifiers: a browser owner document is allowed to overwrite a still-live run;
  absent roster members must render before the first returner can play; a dead
  connected actor should trigger Game Over while a recoverable living member is
  temporarily detached; party membership may be reconstructed from current
  sockets; or bar-local tint is sufficient to communicate a card-wide state.

This reopens three earlier Website policies. The 2026-08-25 empty-run entry
correctly rejected zero-actor ticking but incorrectly made retirement terminal
rather than resumable. The 2026-08-25 durable-roster entry retained the right
membership but specified bar-local red/signal treatments. The 2026-08-27 mutual
readiness entry correctly required render receipts from present materializing
humans but incorrectly promoted the entire signed recovery roster into a
must-connect-before-play set. Native actor lifetime remains unchanged; these are
Website party-continuation and presentation extensions.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native session/lifetime evidence | retail Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `Gameplay_SwitchRegion 0x005CDDD0`, attach `0x005CBA00`, reset `0x005CF920`; existing `native-session-flow.md` | A retained nonzero run admits an authenticated late actor with durable player state and fresh transient bindings. A zero-actor world is not simulation authority. Retail process resurrection and retained disconnected rows remain unclaimed. | high for native lifetime; explicit Website recovery policy |
| Native death/ally evidence | player ally producer `0x0052C910`, Golem producer `0x00615CD0`, append `0x005CF480`, renderer `0x005D2520`; existing ally/death reports | Stock emits living connected remote players and live Golems only; it has no dead/disconnected card branch. Life state remains actor-authoritative and all-dead arbitration is downstream of fixed-tick admission. | high |
| Current recovery causal trace | exact base `d62ed09561e4b35567ace587d0b2d97ef1c8f89e`; `game-host.ts`, `game-session-supervisor.ts`, `party-recovery-claim.ts`, `game-bootstrap.ts`, `MainMenuScene.tsx` | Ordinary claims use `targetRevision: null`; final actor removal deletes run/lineage; `/admin/rejoin` seeds only an exact target revision; replacement recovery requires every signed roster ID; the live-host lookup otherwise routes a later claimant without importing its browser world. | high |
| Current roster/presentation trace | same base; `party-state.ts`, `ally-hud.ts`, `AllyHud.tsx`, `hub.css` | Protocol already separates `connected` from `lifeState` and retains the roster. React exposes both semantic attributes, but red and striped pseudo-elements are children of `.hub-hud-ally-bar`; no card status label exists. | high |
| Deterministic regression witness | `game-host.test.ts` current `saved party member catches up...` tail and `staged catch-up loses...`; `game-session-supervisor.test.ts` deployment-only recovery | Current tests assert that the final two disconnects produce zero runs/parties/capacity and null tokens; only a target-revision deployment is expected to seed a replacement. | high |

No new retail address, table, or native behavior is asserted. The canonical
native reports already close actor attach, zero-actor lifetime, death, and ally
producer membership, so no Mod Loader document changes are required.

## System boundary and membership inventory

System boundary: one party-run continuation owner spans launch-time ordered
membership, signed owner capabilities, live lookup, suspended/replacement host
seeding, late actor materialization, no-living-player hold, terminal teardown,
and the participant-local ALLY projection. Browser documents authenticate one
former member; they never replace an already-live world.

| Member / branch | Disposition | Required proof |
| --- | --- | --- |
| Same-host member disconnect while a living peer remains | `exact-ported` actor detach plus Website roster extension | run ticks; actor disappears; ordered member/card/capacity remain; later Resume routes to the same authority |
| Original leader disconnect | `out-of-system` explicit Website leadership extension | leader ID remains; no permission migrates; later return does not reorder membership |
| Every member disconnects cleanly | `out-of-system` Website suspended-run extension | zero-actor instance stops; revision-bound claims remain seedable; first Resume restores one run and full roster |
| Abrupt browser/app loss | `out-of-system` same checkpointed extension | most recent accepted autosave claim follows the same path; no post-crash browser write is invented |
| Unplanned same-revision host/supervisor replacement | `out-of-system` Website process recovery | ordinary claim seeds one replacement authority under the exact build revision |
| Coordinated cross-revision deployment | `verified-already-at-parity` Website recovery path | explicit target-revision final checkpoint remains the only cross-build seed |
| First former member returns, leader or nonleader | `out-of-system` Website election/admission extension | signed original leader and ordered roster restore; only claimant connects; absent rows show disconnected; countdown does not require them |
| Later former member returns after run progress | `exact-ported` late actor materialization | supervisor resolves the live recovery/run first; browser world is ignored; one actor catches up/imports at current authored spawn |
| Simultaneous first-return race | `verified-already-at-parity`, strengthened | one recovery start wins; every other claimant waits/routes to that host; no fork |
| Repeated all-leave/resume cycle | `out-of-system` Website suspended-lineage extension | an empty suspension is seedable again and is not confused with terminal retirement |
| Connected dead member plus last connected living member disconnects | `out-of-system` explicit Website liveness policy | host installs a run-scoped hold before the next tick/all-dead edge and publishes `Waiting for players to rejoin` |
| Another materialized living actor or bot remains | `verified-already-at-parity` | no disconnect hold; run continues normally |
| Waiting member reconnects | `exact-ported` attach plus Website readiness extension | hold survives detached catch-up; exact renderer-ready materialization starts one 3-second countdown with no tick catch-up |
| Waiting member does not reconnect, then all clients leave | `out-of-system` suspension composition | live hold retires with the empty instance; durable claims can spin up later |
| Existing ESC/book/selector pause or level/loading barrier | `verified-already-at-parity` with composition coverage | independent owners remain; rejoin readiness cannot release or consume them |
| Game Over, loadout, returned Hub, replaced run | `verified-already-at-parity` terminal boundary | current supervisor retires the lineage; terminal/profile saves contain no capability; stale claim cannot overwrite a live/terminal run |
| Wrong player/run/content/account/revision, forged claim, duplicate reservation | `verified-already-at-parity`, strengthened | strict verification fails before mutation or ordinary-save fallback |
| Full capacity | `verified-already-at-parity` | each disconnected roster member reserves exactly one place; staged/connected member never counts twice |
| Alive connected remote player card | `verified-already-at-parity` | stock ratio/name/glyph/card remain with no status overlay |
| Dead connected remote player card | `out-of-system` requested Website extension | full card receives red tint and visible `DEAD`; live actor remains health/life authority |
| Alive disconnected remote player card | `out-of-system` requested Website extension | full card dims/stripes and visibly says `DISCONNECTED`; last authoritative ratio remains |
| Dead disconnected remote player card | `out-of-system` requested Website extension | full-card red and signal-loss treatments compose; visible precedence is `DISCONNECTED`; accessible copy reports both |
| Reconnected dead/alive player card | `out-of-system` requested Website extension | same roster row instantly drops disconnect treatment and displays `DEAD` or no label from live actor state |
| Local player and live/dead Golem | `verified-already-at-parity` | local player remains excluded; Golem membership/lifetime never receives player connection labels |
| Reduced motion | `out-of-system` browser accessibility branch | full-card disconnected stripe remains static and legible |

The only browser-blocked member remains a process killed before any
capability-bearing checkpoint reaches local/cloud storage. Same-revision crash
recovery can use the last accepted document; no code can commit a newer browser
document after the process has stopped. Cross-revision recovery without an
announced target remains rejected because protocol/save compatibility is not
inferable from a stale client document.

## Ownership thread and recovered behavioral contract

- Party/run authority owns the ordered roster, original leader, recovery ID,
  sealed content, capacity, current run ID, terminal/suspended disposition, and
  last authoritative ally rows. Socket presence owns only `connected`; the ECS
  owns only materialized actors; the save/claim authenticates exactly one former
  member and admissible revision.
- Every active-run checkpoint signs the current immutable host revision.
  Deployment checkpoints override it with the announced target revision. A
  missing live target plus an exact claim may seed one authority; a live target
  always wins and cannot be overwritten by submitted browser simulation bytes.
- Empty is suspension, not ticking authority and not party deletion. Removing
  the final actor destroys the in-memory world, pauses/mod VM/transients, and
  session process as already required, while leaving the signed former-member
  lineage restartable. Terminal Game Over/Hub/loadout remains retirement.
- Replacement seeding restores the full social roster but requires readiness
  only from humans actually connecting/materializing. Absent members are
  disconnected admission reservations, not renderer participants. A later
  claimant joins the same recovery/run and receives current live world state.
- Before detaching a run-surviving living actor, the host examines the remaining
  materialized cohort. If no living actor remains but a dead human client does,
  it creates a required-member `party-rejoin-wait` resume grace before actor
  removal. The run remains on one fixed tick. Rejoin unions current renderers and
  the returner into a fresh sequence; all valid ready receipts and materialized
  identity start the existing 3,000-ms deadline.
- The ALLY renderer consumes one row model. `connected` and `dead` stay
  orthogonal; visible label precedence is disconnected over dead. Both tints
  attach to the row root, not the bar, and status text is presentation-only.

## Nearby-system findings

- Disconnect publishes a snapshot and party roster at the same authoritative
  tick. The shell may retain the prior same-tick scene snapshot, so an explicit
  roster row with `connected=false` must outrank a stale actor still present in
  the presentation cache. Snapshot vitals/config remain preferred only while
  the roster says that member is connected. This is presentation arbitration,
  not a second transport owner.

## Confidence and open questions

- Confirmed: current final-retirement/test contract, null ordinary target
  revision, exact supervisor seed gate, full-roster readiness cause, live-first
  rejoin resolution, durable protocol roster, bar-local CSS cause, fixed-tick
  all-dead ordering, and every touched teardown/presentation consumer.
- Explicit Website policy: first-return owner checkpoint seeds a suspended run;
  later claims can import only their actor. The first returner may progress while
  signed roster peers remain absent. Empty suspension is distinct from terminal
  retirement.
- Unknown but nonmaterial: retail host-process resurrection and retained
  dead/disconnected rows remain unrecovered and are not represented as stock.

## Web implementation consequence

- Pass the supervisor's current revision into every hosted authority and use it
  as the default signed recovery target; keep deployment's explicit target
  override. Treat empty-lineage cleanup as suspend/seedable and terminal cleanup
  as retired within the live supervisor.
- Stop promoting a signed replacement roster into renderer-required IDs. Keep
  the roster in party/capacity state and let only present materializing humans
  participate in readiness. Preserve live-first lookup and actor-only late
  import so a later browser save cannot rewind the world.
- Add one `party-rejoin-wait` protocol reason and one host transition that arms
  it before detaching the last materialized living member when dead connected
  humans remain. Reuse the existing run-scoped hold/readiness/countdown owner.
- Add a semantic status-label derivation and one card-wide overlay layer. Remove
  bar-local death/disconnect pseudo-elements and update reduced-motion targeting.

## Validation contract

- Protocol/presentation: protocol 91 strict reason round trip; exact waiting
  copy; alive/dead/disconnected/dead-plus-disconnected label precedence,
  accessible status, full-row pseudo-element selectors, reconnect transition,
  Golem and reduced-motion nonregression.
- Host: same-host detach, last-member suspension, same-revision global/private
  replacement, leader/nonleader first, roster restored disconnected, first
  returner countdown without absent-member receipts, later return after tick/
  wave progress, repeat suspension, simultaneous race, live-first no-overwrite,
  terminal retirement, wrong revision/content/account/capacity, and deployment
  target override.
- Liveness hold: dead connected plus last living disconnect freezes tick before
  Game Over and publishes `party-rejoin-wait`; living peer/bot controls do not;
  returning materialization/readiness produces one `3,2,1`; all-client departure
  suspends cleanly; pause/level/loading owners compose.
- Mac Chrome/WebGL: three real clients start a shared run, kill one, disconnect
  the last living peer, inspect the waiting overlay and frozen tick, reconnect
  and release; then disconnect everybody, Resume with a nonleader first, verify
  full disconnected cards and live progress without the leader, Resume the
  leader after progress, and inspect immediate `DISCONNECTED -> DEAD/alive`.
  Repeat replacement seeding for a private College. Require empty page, console,
  failed-response/request, and host-error arrays.
- Exact candidate: byte-identical detached Mac worktree, canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh`, then browser receipt before
  publication.

## Implementation validation receipt

- Protocol 91 adds `party-rejoin-wait`. Every ordinary active-run checkpoint is
  bound to the host's immutable current revision, while deployment retains its
  explicit target override. Empty authority retirement now reports a seedable
  suspension to the supervisor; Game Over/Hub/loadout remains terminal. The
  first valid recovery restores the signed ordered roster but waits only on
  humans actually connecting/materializing, so later former members resolve the
  live run and cannot replay their browser world over it. Repeated suspension
  and private-session reprovisioning use the same owner.
- Detaching the last living actor while a dead human remains installs one
  required-member hold before actor removal/all-dead arbitration. A current
  pause owner may still release its own pause without bypassing that hold. The
  returning actor plus current renderers start the existing three-second grace;
  no held wall time becomes fixed ticks.
- ALLY rows now paint red death and dim/striped disconnect layers over the whole
  card. Visible text is `DISCONNECTED` while transport is absent and `DEAD` for
  a connected dead actor. Explicit roster connection state outranks a stale
  same-tick actor cache; snapshot config/vitals remain preferred only while the
  roster says the member is connected. Golem and local-player membership are
  unchanged.
- The validated pre-receipt runtime candidate is commit
  `81ef227bc647d610a551524be816feb641f05547`
  over `6fcfdd6f8e60f8c58a811eabdc1f3c811cdeddd1`, tree
  `7599d78801d0202fa31b17627799b4f05b28a770`. All 17 changed files were
  byte-identical in the local worktree and detached Mac worktree
  `/Users/jarrett/codex-acceptance/party-run-rejoin-publish-20260827/Website`.
  The canonical Mac gate passed 26 backend contracts, lint/type/generated and
  formatting checks, `310/310` save/prerequisite tests, `1,651/1,651` broad
  Boneyard/host/supervisor tests, `74/74` party tests, `77/77` ML tests, every
  remaining frontend/desktop group, production frontend/game-host builds, and
  media policy. `Game-B60YTKvZ.js` is `479,137` raw / `134,116` gzip against
  `524,288` / `134,144`; gate-log SHA-256 is
  `e8669eea735b62608538de2d5abf0d13c3d9b1a38439258ba448c22b177081f0`.
- Mac Chrome `151.0.7922.174`/WebGL completed the exact shared-Hub journey on
  run `0ab2fe79250a2a594a1648747816e526`: tick `1006` held, then resumed at
  `1045`; catch-up sequences were `[4,6,8,10,12,14,16,18]`; save revision
  advanced `2 -> 23`. The private-College journey used run
  `492febf255586c86ccd95eb3fca97d7e`: tick `965` held, resumed at `1003`,
  resolved `[2,4,6]`, and advanced `2 -> 18`. Both visibly showed whole-card
  `DISCONNECTED`, the centered `Waiting for players to rejoin` hold, immediate
  alive reconnect, and `DISCONNECTED -> DEAD` for the returning dead leader.
  Page, console, failed-response, failed-request, and host-error arrays were
  empty in both runs. Browser-log SHA-256 values are
  `e83faa2f35bc38abec26fdbdddff2986f4d5bbdd55bfd33f30c3e041aeb86549`
  and `c6562c37cd41949657c3156b615fc860aee06715eeef27f3f9419177d70936a7`.
- Reviewed shared waiting/dead frames have SHA-256
  `2ee7e3251d8ea4ffc03d0658ef2f7200b2faf81f5981574725c7b6189c8becf8`
  and `bfe79a6810a6bc7847efe8b247918794a696f92afd10e38adf43086745e67e09`;
  private equivalents are
  `1da6094f863570a59eaac11c0b4b3a2437aea011a08ff64f33c817577ca6a66a`
  and `1cc5ed2f556c9fb7c94733e7ec40c8e486cc7b78ec53e58a63748d218c14d5bf`.
  They are retained beside the final Mac worktree under `evidence-global/` and
  `evidence-private/`. No browser-platform member is blocked beyond a process
  killed before its latest checkpoint can persist. No deployment was performed.
