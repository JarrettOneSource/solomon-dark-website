# 2026-08-25 — Update-safe party recovery and detached rejoin catch-up

## Reported smell and parity question

- Reported web behavior: the active-party capability added on 2026-08-24 is
  owned only by one live supervisor. A coordinated game update checkpoints and
  disconnects every browser, then destroys that capability map with the old
  process. `LAST GAME` therefore lets the first former member restore a
  singleton saved run, but later members cannot identify it as their party's
  continuation. The previous catch-up path also materializes the returner
  before its missed choices and expands the run's ordinary level barrier,
  holding every live participant.
- Required behavior: any former member, including a nonleader returning before
  the old leader, can recover the exact party run after the announced update.
  The first valid returner becomes the recovered party's current leader; later
  former members converge on that same run. A returner behind the live shared
  level remains detached and unmaterialized while resolving its actor-private
  offers. The run does not acquire a new pause from that detached picker, and
  every additional level crossed while it is open appends another ordered
  choice before materialization.
- Reproduction inputs/scenes: global-Hub and private-College parties; old
  leader first/last and nonleader first; coordinated `1012 game updating`
  restart; same-host transport loss; zero/one/many missed levels; a new
  milestone during the first catch-up offer; peer-owned level barrier and ESC
  pause; reroll/save/select; second disconnect; deployment while staged;
  terminal run; mod/content mismatch; duplicate/racing claims; forged save and
  token; schema migration; capacity; leaderboard provenance.
- Falsifiers: native Arena authority requires the departed leader specifically;
  durable progression becomes world-owned when an actor is absent; a player
  must be materialized before its private book can own offers; catch-up choices
  require replaying elapsed ticks; or a browser-authored world may overwrite a
  still-live run.

This section supersedes the 2026-08-24 Website policy that a rejoin catch-up
must immediately join the live cohort and that supervisor loss necessarily
invalidates the capability. It does not supersede the recovered stock cohort
rule for players who are already materialized. The new picker is deliberately
before the native late-materialization edge: the actor is not a run participant
until its private pending sequence is empty.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail/native session identity | retail Beta 0.72.5 `SolomonDark.exe`, preferred base `0x00400000`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; G13 and `native-session-flow.md` | Authenticated Arena materialization depends on the retained map digest plus authority run intent/nonzero nonce, not on the departed participant being the authority. Durable participant data survives separately from scene-local actor bindings. Retail host-process resurrection remains unrecovered. | high for native ownership; explicit web policy for process recovery |
| Retail progression ownership | `0x0067C250`, `0x0067CB70`, `0x00671470`, ActorWorld dispatcher `0x004022A0`; `native-progression-and-skills.md`; `skill-picker-re.md` | Level, XP, pending sequence, offer seed, ranks, books, and vitals are actor-private. The stock cohort barrier applies to materialized participants. Nothing requires an absent actor to enter ActorWorld before its durable book is synchronized. | high |
| Existing save authority | schema-11 owner projection; `createGameSaveDocument`, `GameSaveCoordinator`, `server-deployment-restart`; native save report | The final deployment checkpoint already contains the complete authoritative world plus exactly one owner actor. It is sufficient to seed a new authority, but browser bytes are editable and cannot preserve ranked provenance unless the old host seals their exact normalized contents for the announced target revision. | high |
| Current web causal trace | exact base `934b10ef2e2c3dae0455dffbb4b412af90f883ad`; `game-host.ts`, `game-session-supervisor.ts`, `game-bootstrap.ts`, `shared-game-worlds.ts` | Rejoin resolution scans only in-memory slots. Restart destroys every slot. Immediate `rejoinGameSimulationPlayer` imports the actor and reconstructs/expands `levelUpBarrier`, so `stepGameSimulationTick` holds the run until the returner finishes. | high |
| Current deployment identity | `restartForDeployment(targetRevision)`, build-injected `/deployment.json`, release `DEPLOYED_GIT_SHA`, and `ops/local-ci/deploy-main.sh` | The old host knows the exact target SHA before its final checkpoint, and the replacement supervisor can be configured with that same immutable SHA. This supplies a bounded anti-replay generation without trusting a browser revision string. | high |

No new retail address or authored table is claimed. The native session,
progression, and save reports receive matching dated addenda because the
changed Website policy reuses their ownership split in a new order.

## System boundary and membership inventory

Native system: authenticated Arena materialization plus actor-private
progression. Browser extension: revision-bound recovery claims, first-return
authority reconstruction, convergence of later former members, detached
catch-up, live milestone accumulation, final materialization, and teardown.

| Member (class/variant/scene/branch) | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Same-host nonleader disconnect/rejoin | retained live run and detached actor slot | `exact-ported` | continues using host actor authority; no browser world import |
| Same-host old leader disconnect/rejoin | live leader promotion | `exact-ported` | remaining member stays leader; return never rolls authority back |
| Whole party disconnected by announced update | deployment-final owner checkpoints | `exact-ported` | every responsive participant persists one revision-bound sealed claim before `1012` |
| Nonleader is first after update | native authority-independent late materialization plus Website election | `exact-ported` | exact run/world resumes and first returner becomes current leader without requiring old leader |
| Old leader is first after update | same recovery seed | `exact-ported` | resumes identically and becomes current leader only because it returned first |
| Later former members after update | recovery ID plus signed player/run/content claim | `exact-ported` | all route to one recovered session/run; no singleton forks |
| Simultaneous first-return race | supervisor recovery reservation | `exact-ported` | one seed wins; the other claim waits/routes to the resulting run |
| Global Hub and private College | session kind and sealed content digest | `exact-ported` | global routes to resident Hub; private provisions one College with exact content |
| Modded private continuation | signed normalized save and manifest digest | `exact-ported` | exact package graph/state restores; changed subscriptions fail closed |
| Vanilla/global continuation | empty sealed manifest | `exact-ported` | no mod content can enter the recovered run |
| Ranking lineage | HMAC seal, target deployment revision, original run/player/account lineage, backend run idempotence | `exact-ported` | exact untampered update recovery preserves eligibility; ordinary editable save restore still taints |
| Forged/edited save or token | HMAC-SHA-256 over normalized owner document and bounded claim fields | `exact-ported` | mismatch is rejected before host state mutation or fallback |
| Old deployment claim | target revision mismatch | `exact-ported` | cannot seed a later build; a live matching host may still resolve its current token |
| Duplicate/replayed claim in the recovered process | recovery/player reservation and retired recovery set | `exact-ported` | connected, reserved, terminal, and consumed claims cannot fork |
| Schemas 1..11 and legacy 43-character token | strict migration | `verified-already-at-parity` | parse safely; only schema 12 carries a restart-seedable signed claim; legacy falls back normally |
| Zero missed levels and no pending offer | detached actor book versus current milestone | `exact-ported` | materializes atomically at authored spawn with no picker or new barrier |
| Pending offer at disconnect | detached actor progression | `exact-ported` | picker opens while actor stays outside run membership |
| One/several missed levels before return | current live shared milestone | `exact-ported` | exactly one actor-private pending choice per crossed level |
| Additional milestone while picker is open | live milestone observation plus detached synchronization | `exact-ported` | new levels append in order; completing the earlier card cannot materialize early |
| Select card | native actor-private apply path | `exact-ported` | only detached book changes; live gameplay RNG advances at action time |
| Sorceror reroll and save/defer | existing native picker actions | `exact-ported` | same legality, RNG, deferred queue, and next-offer behavior while detached |
| Automatic choices/Creativity insight | existing progression helpers | `exact-ported` | same actor-private resolution and RNG; no synthetic UI pause |
| Live simulation while staged | ActorWorld excludes the detached actor | `exact-ported` browser ordering | ticks/enemies/peers continue unless their own independently owned pause/barrier is active |
| Peer-owned level barrier while staged | ordinary materialized cohort | `verified-already-at-parity` with composition coverage | peers may pause for themselves; the detached returner neither joins nor prolongs it |
| ESC/book/selector pause while staged | independent gameplay pause owner | `verified-already-at-parity` with composition coverage | detached choices never release or acquire that pause |
| Staging projection and renderer | client-private live-world projection with materializing-player flag | `exact-ported` | picker sees current world; staged actor is absent from every public snapshot and not painted as spawned |
| Final choice/materialization | native cold Boneyard attach | `exact-ported` | one atomic import at authored spawn, fresh transient/light identity, party membership, and current leadership |
| Second disconnect during catch-up | retained detached slot/claim | `exact-ported` | no peer hold; unresolved queue survives and reopens on next claim |
| Deployment during catch-up | detached owner projection plus current live world | `exact-ported` | final sealed checkpoint retains all resolved/unresolved choices and can seed the target revision |
| Run ends while picker is open | terminal run nonce | `exact-ported` | staging claim retires; no actor materializes into Game Over/loadout/Hub |
| Empty/replaced run or supervisor shutdown without an announced target | lifecycle teardown | `verified-already-at-parity` | no claim invents a live run; ordinary saved continuation remains available |
| Capacity | materialized, staged, detached, bot, and ticket counts | `exact-ported` | each former member consumes one logical place, never two |
| New Party-ID/public/request member during play | existing admission boundary | `out-of-system` (not a former-member recovery) | remains rejected |
| Bots, observers, Tutorial solo ownership | nonbrowser/read-only owners | `out-of-system` | unchanged |

There is no browser-blocked native member in this change. The established
asynchronous-write limit remains: a browser killed before receiving/persisting
any claim-bearing checkpoint can recover only its previous durable slot.

## Native ownership thread and recovered behavioral contract

- Stock separates durable participant state from actor materialization and
  permits authority-authenticated late Arena attachment. It does not establish
  a leader-only restore requirement. The Website may therefore elect the first
  valid returning former member after process loss without claiming native host
  migration parity.
- The deployment-final save remains host-authored. The old host first emits a
  canonical owner document with a null claim, hashes those exact normalized
  bytes, and signs a bounded payload containing recovery ID, player ID, run ID,
  session kind, content digest, provenance, document digest, and announced
  target revision. The final schema-12 document embeds that signed claim.
- A replacement supervisor accepts restart seeding only when its configured
  immutable revision equals the signed target. It verifies signature, field
  bounds, exact document digest, character/player/run/content/integrity, and
  account lineage before selecting or constructing a host. Browser-declared
  Party ID, run ID, revision, or integrity alone grants nothing.
- The first valid owner document supplies the recovered world and one actor.
  Existing strict restore owns all world validation. The recovered party is a
  new live authority projection of the same run ID; the first returner is its
  leader. Other signed claims with the same recovery ID may contribute only
  their own actor-private durable projection, never their saved enemy/world
  copy.
- Catch-up occurs before materialization. The host compares the detached
  progression with the current live participant milestone and runs the
  existing actor-private synchronization/offer helpers against that detached
  store while advancing the live gameplay RNG in event/action order. It does
  not add the actor to `playerEntities`, `GameRunLifecycleState`, Hall
  membership, party membership, collision, targeting, XP, effects, or
  `levelUpBarrier`.
- A private staging snapshot composes the current live world with the detached
  player's picker state and explicitly marks that player materializing so the
  renderer does not paint a spawned wizard. Other clients receive no actor or
  roster member. Further milestones synchronize and append before the next
  staging snapshot.
- When the pending sequence becomes empty, the host performs one cold
  materialization at the authored spawn, allocates fresh transient bindings,
  joins the current party, arms the next claim, and begins accepting gameplay
  input. This serialized edge makes a same-turn new milestone impossible to
  miss.

## Nearby-system findings

- Deployment already freezes every host before asking browsers to persist, so
  all responsive final owner documents share a causally compatible target
  revision and pre-disconnect world. First-return selection is therefore a
  recovery election, not a merge of competing live worlds.
- Offer construction consumes the live gameplay RNG even though the actor is
  detached. Generating offers from a private copied RNG and merging later would
  reorder unrelated live draws; detached synchronization and every picker
  action must transact against the current run RNG immediately.
- The backend Hall submission is keyed by authoritative run ID and user. A
  revision-bound, document-sealed recovery retains that same run ID; it does
  not create a second ranked lineage.

## Confidence and open questions

- Confirmed: native authority-independent late materialization, durable versus
  transient participant ownership, actor-private progression, materialized
  cohort barrier, current Website restart loss, deployment target/checkpoint
  ordering, strict owner save contents, current score/run identity, and every
  affected web ownership seam.
- Explicit Website policy: the first returning former member after supervisor
  loss becomes leader. This is deterministic and answers the update case, but
  is not represented as recovered retail authority migration.
- Unknown but nonmaterial: retail behavior when its authority process itself
  disappears. No remaining implementation decision depends on it.

## Web implementation consequence

- Add schema 12 support for the bounded signed recovery claim while migrating
  schemas 1..11. Keep the field nullable outside active party Boneyards.
- Add one Node-only recovery-claim module for normalization, digest, HMAC,
  revision binding, and strict decoding. Supply the stable supervisor secret
  and exact deployed SHA to global and private hosts; keep secrets out of
  browser payloads and logs.
- Generalize host rejoin reservations from an exact in-memory token lookup to
  a verified `(recovery, player, run)` claim. Preserve host-retained actor state
  when it exists; use the sealed owner actor only after process recovery.
- Add detached progression transactions and a staging snapshot projection.
  Do not add a second simulation, copied RNG, compatibility barrier, ghost
  actor, or client-authored authority.
- Update the deployment environment atomically with the target SHA and restore
  it on rollback. A push remains distinct from running that deployment.

## Validation contract

- Claim/save contracts: normalization, HMAC, exact digest, revision, player,
  run, content, integrity, account, malformed/oversize/tampered payloads, and
  schema 1..12 migration.
- Core contracts: detached zero/one/many synchronization; select/reroll/save;
  live RNG interleaving; unchanged tick/world/party/barrier; atomic final
  import; exact durable/transient membership.
- Host/supervisor contracts: both topologies; either old leader order; one
  recovery session under racing claims; later-member convergence; capacity;
  second disconnect; terminal/retired/old-revision rejection; deployment while
  staged; active-host fast path remains authoritative.
- Renderer/protocol contracts: only the staging client gets the private
  materializing marker; no client paints or targets that actor before final
  materialization.
- Mac Chrome/WebGL: start a two-client run, advance multiple levels, begin the
  returner's picker, let peers resume/advance and add another level while it is
  still open, prove live tick/enemy movement and absent public actor, then
  finish and prove one authored-spawn materialization. Drain both clients for
  an announced target, restart the supervisor at that revision, resume the
  former nonleader first, then the old leader, and prove one run/party with the
  first returner leading. Repeat for private content. Capture empty page,
  console, failed-request, and host-error arrays.

## Implementation validation receipt

- The Website implementation is based on exact upstream
  `934b10ef2e2c3dae0455dffbb4b412af90f883ad`. Protocol 76 adds the private
  materializing-player projection and schema 12 adds the signed recovery
  claim. `party-recovery-claim.ts` owns strict normalization, document digest,
  HMAC, player/run/content/provenance bindings, and deployment revision.
  `GameHost` retains live detached actors, stages catch-up outside party/run
  membership, advances the live RNG for synchronization and every picker
  action, stacks later milestones, and performs one final cold import. The
  supervisor serializes recovery seeding and makes the first valid returner the
  new party leader; the deployment script installs/restores the immutable
  target SHA beside the stable secret.
- The complete exact-candidate Mac Website gate passed: backend build with zero
  warnings/errors; `22/22` backend/contracts; formatting, lint, architecture,
  generated-Lua checks; `275/275` save/prerequisite tests; `1539/1539` broad
  gameplay tests; `77/77` ML tests; every weather, party/chat, level-up,
  Tutorial, diagnostics, Hall, Hub UI, and desktop group; production frontend
  and GameHost builds; media policy; and bundle budget. Focused additions prove
  the exact claim seal/tamper rejection, detached zero/one/many synchronization,
  advancing live ticks and stacked milestones, and replacement-supervisor
  recovery with the former nonleader returning first and remaining leader.
- Mac Chrome 151/WebGL2 completed both real three-client journeys. Global Hub
  retained run `86984eaa94b89f43f120a5d268b80ddd`: the live run advanced from
  tick `1372` while the browser actor was absent, accumulated/resolved offer
  sequences `[4,6,8,10,12,14,16,18]`, materialized once, and reached tick
  `1992`; the local save advanced revision `2 -> 21`. Private College retained
  run `445698ffb3acc267966714708e46f44d`, advanced from `1290 -> 1916`,
  resolved the same eight-offer sequence, and advanced save revision `2 -> 21`.
  The renderer reported only the two live peers during both detached pickers.
  Page-error, console-error, failed-response, and failed-request arrays were
  empty in both topologies.
- Reviewed detached-picker frames are
  `party-rejoin-detached-catch-up-global-hub.png` SHA-256
  `84e3083010a2246e455ffcdf388a702fdc51970644df789dd26200199d61e30a`
  and `party-rejoin-detached-catch-up-private-college.png` SHA-256
  `047915a606524841e09634abfd2fd08a0f2736725871fe77b217eab98037cbea`.
  They show a live peer/world beneath the native picker and no spawned local
  wizard. Final-materialization frames are SHA-256
  `f7b87e02be51f27a6abe332d5a5333dcf661c90156a4e4460c3ffba452bda59f`
  (global) and
  `c1cd073085b91bdbeaee6ae146a6ca7492a4fb7891cfde22162bb50441f8adf5`
  (private). Evidence is retained under Mac task path
  `/Users/jarrett/codex-acceptance/party-recovery-detached-20260825/evidence/`.
- The Mod Loader exact documentation candidate on base
  `b638bb7ada23f7476bc694f1235fc50d29c9de72` passed the complete registered
  Mac static RE suite `501/501`. No new retail address was asserted and the
  unrecovered retail authority-process migration remains explicitly separated
  from the Website's first-return election.
- No member is blocked by the browser platform beyond the pre-existing fact
  that a dead browser cannot persist a checkpoint after it has stopped.
  Publication is authorized and pending final rebase/remote proof; deployment
  remains separate and unauthorized.
