# 2026-08-25 — Empty active-run retirement and recovery-capacity ownership

## Reported smell and parity question

- Reported production behavior: leaving the stock Tutorial caused the game
  supervisor to crash and restart. Eight journaled failures shared the exact
  invariant `the stock Tutorial requires exactly one authoritative player` and
  `playerCount: 0`.
- Reopened system: active-party detach/rejoin and durable party leadership. The
  earlier rejoin ledger already required singleton/last-human departure to
  invalidate the live capability, and explicitly excluded Tutorial-only solo
  runs. The implementation armed every active Boneyard anyway. The later
  durable-leadership pass preserved an empty shared run and failed to reopen
  those two inventory rows.
- Required behavior: actor detachment retains recovery state only while another
  materialized actor keeps the exact run live. The final actor retires the run,
  invalidates every run-scoped recovery owner, and leaves ordinary owner-save
  resume as the continuation path.
- Falsifiers: detached capacity is native simulation authority; stock Tutorial
  can step without its one actor; a zero-actor ordinary Boneyard must keep
  advancing; or a final-player private College must remain provisioned.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Production journal | NFO `solomon-dark-game.service`, deployed `7d1a6bbf` then `4a6c25f3`, protocol 78, `2026-08-25T19:04:16Z..19:27:49Z` | One shared-Hub and seven private Tutorial final-player disconnects produced `simulation.tick_failed`, an uncaught exception, process exit 1, and five-second systemd restart | high-live |
| Mac differential repro | exact `1428269151a5be725a29707f0b1fb0cd7ed47b9f`, Node 22.17.0 | Private and shared final-player Tutorial disconnects reproduced the exact exception; a zero-player ordinary Boneyard advanced from tick 7 to 18 in 100 ms; one-player Tutorial and two-player/one-detached rejoin controls passed | high-live |
| Existing native/rejoin contract | retail Beta 0.72.5 evidence already recorded in the 2026-08-24 active-party rejoin entry | Native late materialization requires a retained authoritative run; empty/terminal run nonce rejects it. Tutorial owns exactly one authoritative actor. | high |
| Current Website causal trace | `game-host.ts`, `shared-game-worlds.ts`, `game-session-supervisor.ts`, `game-simulation.ts` at `14282691` | Rejoin arms all active Boneyards; detach removes the actor but retains capacity/membership; shared release stores the zero-player run; private supervisor tests capacity as liveness; both schedulers step the invalid state | high |

No new binary extraction is required. The native facts were already closed; the
defect is a web ownership transition contradicting those recorded facts.

## System boundary and membership inventory

Native system: authoritative Arena actor lifetime. Website extension boundary:
transport detach, durable recovery capacity, run liveness, session closure,
scheduler admission, and teardown of run-scoped recovery/mod/pause owners.

| Member (class/variant/scene/branch) | Native/web source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Private Tutorial final actor | stock one-actor Tutorial plus private supervisor | `exact-ported` | no tick after removal, zero recovery capacity, private session closes without host error |
| Shared-Hub Tutorial final actor | stock one-actor Tutorial plus shared run owner | `exact-ported` | party run retires while shared Hub keeps ticking; no process restart |
| Private ordinary Boneyard final actor | empty-run/private-session contract | `exact-ported` | run and loaded Boneyard retire; ordinary save remains the only resume source |
| Shared ordinary Boneyard final actor | shared run partition | `exact-ported` | run disappears from directory/health and no empty world tick occurs |
| One member detaches while peer remains | native late materialization plus Website capability | `verified-already-at-parity` | run continues; detached capacity and durable leadership remain; rejoin materializes once |
| Earlier member detached, then final live peer leaves | run-level recovery lineage | `exact-ported` | entire lineage and all member slots retire together; neither token can reclaim the dead run |
| Staged catch-up client loses final live peer | detached picker/materialization transaction | `exact-ported` | run retirement closes staging with active-run-ended semantics; no staged socket keeps world authority |
| Final human leaves with bots | Website ML-bot lifetime | `exact-ported` | bots are removed by existing last-human policy, then the now-empty run retires |
| Observer remains after final actor | read-only observer owner | `exact-ported` | observer never counts as authority and closes when its observed run retires |
| Hub-only disconnect | shared Hub/College participant lifetime | `verified-already-at-parity` | no active-run recovery state is created; ordinary participant teardown remains unchanged |
| Same-tab transport replacement | connection resume owner | `verified-already-at-parity` | superseded socket does not detach the still-materialized actor |
| Deployment drain | frozen deployment owner | `verified-already-at-parity` | final checkpoints and code 1012 close remain distinct from gameplay run retirement |
| Game Over/loadout/Hub terminal transition | existing terminal pruning | `verified-already-at-parity` | lineage invalidation remains idempotent and no active capability survives |
| Standalone persistent development host | explicit `resetWhenEmpty: false` product seam without supervisor recovery tickets | `out-of-system` (not a provisioned party session) | its existing empty-interval fixture behavior remains unchanged |

## Native ownership thread and recovered behavioral contract

- A detached slot is durable actor data plus reserved admission capacity. It is
  not a materialized actor and cannot satisfy Boneyard or Tutorial authority.
- The active run is the capability root. A slot is valid only while that run has
  at least one materialized player entity. Removing the last actor atomically
  destroys the root and therefore every descendant slot, reservation, signed
  lineage, pause, observer target, and run-scoped prepared-mod owner.
- Shared-Hub lifetime is independent: its fixed clock and future admissions
  remain resident after one party run retires. Private College lifetime is
  claimed-player/proxy owned and closes after the final transport drains.
- Capacity, connected humans, materialized actors, and active runs are distinct
  quantities. Admission may count detached slots; teardown may not use that
  capacity count as proof of a live player.
- The Tutorial's one-player assertion remains fail-fast. Correct teardown makes
  the invalid zero-player Tutorial state unrepresentable instead of suppressing
  its error.

## Nearby-system findings

- Ordinary Boneyards tolerated the same invalid state and silently advanced;
  Tutorial was only the first strict consumer. A Tutorial-specific guard would
  preserve world/RNG/enemy/mod drift and is therefore rejected.
- Tutorial browser smokes used direct hosts with `resetWhenEmpty: true`, unlike
  production provisioned hosts. Existing rejoin acceptance always retained a
  peer. The validation matrix must include production-shaped final-actor edges.
- Internal `GameHost.playerCount()` conflated capacity occupancy with transport
  liveness. The interface must expose those meanings explicitly rather than
  rely on call-site convention.

## Confidence and open questions

- Confirmed: both production call stacks, both deterministic Mac reproductions,
  introducing commits `6c52d758` and `a3d5a94f`, sibling ordinary-run drift,
  existing native/rejoin contract, and every teardown consumer above.
- Unknowns: none material. No browser constraint blocks the recovered lifecycle.

## Web implementation consequence

- Make shared-world actor detachment always remove a run whose player-entity
  store becomes empty; retaining party membership cannot retain an empty world.
- Add one host-owned empty-run retirement step after player and last-human bot
  removal. It retires private loaded state and invokes existing lineage pruning
  before the supervisor observes counts.
- Replace the ambiguous host count interface with explicit capacity and human
  counts. Capacity remains admission-only; private teardown uses humans.
- Keep the invariant, exception policy, systemd policy, and valid peer-backed
  rejoin flow. Add no Tutorial ID branch, zero-player tick skip, fallback, flag,
  or swallowed error.

## Validation contract

- Focused Mac tests: every inventory row above, including two-step all-member
  detach, staged catch-up, bots/observer, token invalidation, zero host errors,
  and unchanged persistent standalone behavior.
- Complete Mac gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact
  manifest-identical candidate.
- Mac Chrome/WebGL: production-shaped shared-Hub Tutorial and private Tutorial
  journeys close their final browser; a peer-backed ordinary party detaches and
  rejoins successfully; page/console/network/host-error arrays stay empty and
  the task owns and stops every spawned process.

## Implementation validation receipt

- The Website candidate is based on `328163a4ddab26003901185517a02a3306f233e2`.
  `detachSharedGamePlayer` now retires a run when its player store becomes
  empty. The host performs private empty-Boneyard retirement and complete
  lineage pruning before publishing counts; staged clients whose root run ended
  no longer retain unauthoritative roster membership. `GameHost` now exposes
  `capacityParticipantCount()` separately from `humanPlayerCount()`, and the
  private supervisor closes on the latter. The Tutorial assertion, valid
  peer-backed rejoin, deployment drain, and standalone persistent-host seam are
  unchanged.
- The Mac red matrix first reproduced the shared container defect (`1 !== 0`),
  ordinary private capacity leak (`1 !== 0`), and exact private/shared/supervisor
  Tutorial uncaught exception. The corrected candidate passed `98/98` complete
  host/supervisor/shared-world/bot focused tests plus test TypeScript checking.
  Coverage includes final Tutorial and ordinary actors, two-step party teardown,
  staged catch-up loss, token invalidation, bot removal, observers, heartbeat,
  deployment restart, and the peer-backed rejoin control.
- The exact changed-file manifest matched the detached Mac worktree byte for
  byte. `/opt/homebrew/bin/bash ./scripts/validate.sh` passed: zero-warning/error
  backend Release build, `23/23` Website/backend contracts, strict formatting
  and lint/generated checks, `2,288/2,288` frontend/desktop tests, production
  frontend and bundled host builds, media policy, and the bundle budget
  (`474,599` raw / `133,076` gzip bytes against `524,288` / `133,120`).
- Mac Chrome/WebGL completed the production-shaped restored-Tutorial journey
  and closed its final browser with zero remaining humans, capacity, or runs.
  It reported empty page, console, failed-response, and host-error arrays.
  Global-Hub and private-College three-player journeys each retained a detached
  member while a peer kept the run live, resolved offer sequences
  `[4,6,8,10,12,14,16,18]`, rematerialized once, then closed the remaining peers
  and proved zero humans/capacity/runs, no party, and invalid old/rotated tokens.
  Both reported empty page, console, failed-request, failed-response, and host-
  error arrays.
- Reviewed evidence is retained under Mac path
  `/Users/jarrett/codex-acceptance/tutorial-last-actor-lifecycle-20260825-final2/evidence/`.
  Key frame SHA-256 values are Tutorial selected HUD
  `86ea489912dd33ab76e384350be2991fd4627b143b217853c58e736487135bde`,
  global rejoin `6aae7a341599f1a91fe3a5017f110c64476e053491857db79701c6970b6bde5b`,
  and private rejoin
  `a127f49d31f1748893f29007be029ae7e6f9cb5b8a4d730aa35c30ec1075acd0`.
  Visual inspection found the expected Tutorial pointer/HUD and live Boneyard
  ally/lighting frames with no broken or fallback rendering.
- No browser-blocked member or material unknown remains. Publication and
  deployment are separate from this receipt.
