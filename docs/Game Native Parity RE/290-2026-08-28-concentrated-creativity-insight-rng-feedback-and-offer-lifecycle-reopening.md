# 2026-08-28 — Concentrated Creativity Insight RNG, feedback, and offer lifecycle reopening

## Reported smell and parity question

- Reported web behavior: Creativity itself adds the fourth card and otherwise
  appears to work, but a player saw no Insight after another four or five
  levels.
- Stock behavior to recover: Creativity is not an ability-grant timer. When
  learned, it adds one card and lowers offer requirements by two. Only while
  Creativity occupies concentration slot A does each newly built offer make
  one exact 20% Insight roll; a successful offer visibly marks one eligible
  card, and choosing that card grants two ranks and emits stock feedback.
- Reproduction inputs: a learned row 63 in concentration A, repeated ordinary,
  queued, rerolled, deferred, bonus, multiplayer, and reconnect offers; both a
  successful roll and each non-success/candidate-empty branch; Hub, Boneyard,
  and detached reconnect presentation.
- Falsifiers: the picker uses a stream other than active gameplay RNG; the
  first five fresh web rolls are not forced by a fixed seed; stock does not
  render or acknowledge the marked card; any issuing path skips or repeats the
  chance draw; or the double application/seed order differs.
- This is a secondary report against a system previously marked closed. The
  earlier pass tested the isolated marker/apply helpers and ran a generic
  SkillPicker journey, but it did not enumerate the Insight RNG source or the
  renderer/dialog xrefs. That omission allowed a fixed secondary-effects seed
  and a renderer which never consumes `option.insight` to be called parity.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | Same retail 0.72.5 image as the existing progression ledger. | high |
| Instructions | canonical Ghidra 12.0.3 read-only replica; `LevelupScreen` build `0x0066F920`, instructions `0x0066FB55..0x0066FCCD` | The native offer is built first; concentration index 16 must equal 63; `Random::Integer(5)` at `0x0066FB75` uses the object loaded from active-gameplay-RNG slot `0x00818B08`; result 1 alone continues; a nonempty candidate selection consumes the next word and stores its ID at screen `+0xFC`. | high |
| Instructions | render `0x0067DF80`, `0x0067EA49..0x0067EABD`, `0x0067ED01..0x0067EDD0`; string `Insight` at `0x007A0D94`; Fonts body face `DAT_008199A0 + 0xFC` | A marked card receives a second gold draw using RGB floats `(0.85,0.73,0.44)` and alpha `0.5 + 0.5*sin(2*screenAgeTicks degrees)`, then draws case-sensitive `Insight`, body font, centred in that card at panel top plus 33 logical pixels (`y=305.5` at 1600x900). It is not metadata-only. | high |
| Instructions | card pointer/detail builder `0x00670E20`, `0x00671174..0x0067128A`; string `Insight Bonus: Skill +2` at `0x007A0B40`; apply `0x00671470` | The marked card's native detail object appends the exact bonus line. The separate apply function compares the chosen ID with `screen + 0xFC`, performs the common acquisition twice on a match, then refreshes/closes. | high |
| Current web trace | `game-simulation.ts`, `player-entity-store.ts`, `player-skill-runtime.ts`, `skill-picker-renderer.ts`, `SkillPicker.tsx` at `origin/main` `daa6707a` | Every Insight issue path passes `secondaryAbilities.rng`; `createNativeSecondarySimulation()` seeds that stream with zero. The protocol and apply kernel preserve `insight: true`, but neither renderer nor semantic card label/detail reads it. | high |
| Mac diagnostic | Mac mini stable Website source, `drawNativeInteger(createNativeRng(0), 5)` repeated six times | Exact outputs are `[3,4,2,3,3,1]`: five deterministic misses, then the first hit. This predicts the player's reported four/five-level run rather than merely assigning it a 32.768%/40.96% independent chance. | high |
| Injected-loader supporting visual | task-owned retail process and current Release loader; `screen + 0xFC` observed naturally and pinned while active-card index `+0x5F8 == -1`; `/mnt/c/sd-creativity-insight-20260828-root/native-creativity-insight.png` | The stock renderer independently paints the marked card's gold outer/card/icon treatment and gold `Insight` label with no hover/focus owner. Loader injection exposed/pinned state only; static instructions own the conclusion, and the exact task PID/path was stopped. | medium-high |

The reusable native correction is recorded first in Mod Loader
`docs/skill-picker-re.md` and
`docs/reverse-engineering/native-progression-and-skills.md`.

## System boundary and membership inventory

Native system: actor-private concentrated-Creativity Insight, from the active
gameplay RNG at every offer-build edge through marked-card presentation,
authority validation, double acquisition, feedback, refresh, queued rebuild,
replication, persistence, and teardown. Ordinary Creativity offer count and
minimum-level changes are siblings; a standalone skill named Insight is not.

| Member / branch | Native source | Required disposition and proof |
| --- | --- | --- |
| Creativity learned, not concentrated | row 63 and `0x0065F480` desired-count branch | `verified-already-at-parity`: four cards and requirement minus two; no Insight RNG word |
| Creativity in concentration A/index 16 | `0x0066FB57..0x0066FB66` | `exact-ported`: enters the roll |
| Creativity only in Split Mind B/index 20 | literal index 16 read | `verified-already-at-parity` stock defect: no Insight word or marker |
| Mind Chug/all-concentration timer | no read of progression `+0x828` in this branch | `verified-already-at-parity` stock defect: no Insight word or marker |
| chance miss values `0,2,3,4` | `RandomInt(5)==1` | `exact-ported`: one active gameplay word, unchanged offer |
| chance hit with empty candidate set | candidate list `0x0066FB83..0x0066FCB5` | `exact-ported`: one active gameplay word, no selection word, no marker |
| candidate option unlearned behind native virtual `+0x30` | effective-rank gate | `exact-ported`: excluded unless already effective-ranked |
| candidate at `current >= maximum-2` | compiled maximum table | `exact-ported`: excluded; all authored rows share the same predicate |
| category-4 unlearned candidate | same virtual/effective gate | `exact-ported`: excluded; learned category-4 rows may qualify |
| apparent Spell Welding exclusion | loop index compared with 52, not ID | `verified-already-at-parity` stock typo: three/four-card indices never equal 52; apply validation still rejects an Insight Weld |
| successful candidate selection | `0x0066FCB5..0x0066FCCD` | `exact-ported`: one additional active gameplay word and exactly one marked ID |
| initial solo level offer | `0x0067C250 -> 0x0065F480 -> 0x0066F920` | `exact-ported`: offer shuffle then Insight on the same gameplay stream |
| shared multiplayer cohort | per-participant materialized progression/screen | `exact-ported`: deterministic participant order, private marker, shared stream advanced per offered owner |
| selected-card queued successor | acquire, refresh, next screen build | `exact-ported`: one/two acquisition reseeds, concentration A/B and primary autofill, offer build, then Insight in that order |
| Sorceror ROLL AGAIN | `0x006714D9..0x00671532`, two-tick rebuild | `exact-ported`: reroll seed draw, offer build, then a fresh Insight roll |
| SAVE SKILL/deferred successor | pending/deferred counters and later build | `exact-ported`: saving consumes no Insight word; only the later newly built offer rolls |
| bonus book / bonus-choice pickup | forced screen producer `0x0067C320` family | `exact-ported`: an actually new offer rolls once; appending a pending level behind an existing offer does not |
| automatic selection | same host-authored marked offer | `exact-ported`: automatic selection receives the same double apply and feedback result; it does not reroll Insight |
| active-run and detached reconnect catch-up | actor-private pending sequence | `exact-ported`: each newly built retained offer uses the live authority gameplay stream; no copied/fixed stream |
| save/load with an already pending offer | serialized authoritative offer | `exact-ported`: marker and RNG cursor round-trip; load-time concentration repair uses the saved gameplay stream and does not reroll an existing offer |
| card presentation | `0x0067DF80`, strings/color/age branch above | `exact-ported`: pulsing gold second draw plus body-font `Insight` at card centre / logical `y=305.5`, included in accessible card identity |
| marked-card detail feedback | `0x00670E20`, string `0x007A0B40`, `Dialog_AddLine` | `exact-ported`: card identity/detail exposes `Insight Bonus: Skill +2`; this is not a post-selection notification |
| chosen-card application | `0x00671470` | `verified-already-at-parity` after RNG/order integration: two common acquisitions, maximum guard, one learned identity |
| host/client protocol | owner offer identity and choice validation | `verified-already-at-parity` after active-stream correction: host marks and applies; clients never roll or invent Insight |
| Hub, Boneyard, detached staging picker | shared `SkillPicker` renderer | `exact-ported`: identical marker/card semantics in all three consumers |
| a separate learned ability named Insight | no native row, CFG, selector, or acquisition | `out-of-system`: Insight is a marked-card double-rank event, not a book entry |

There are no browser-platform-blocked members. The existing extracted body
font and shared notification renderer can represent every stock surface.

## Native ownership thread and recovered behavioral contract

- `LevelupScreen` owns the roll only after its ordered cards exist. The native
  call at `0x0066FB75` receives the active global RNG object, not the
  actor-private offer generator and not a secondary-effect stream.
- The exact success probability is one value of five. Four or five genuinely
  random misses remain normal, but the current web's fixed sequence is not:
  every fresh secondary stream begins `3,4,2,3,3,1` when no unrelated
  secondary consumer interleaves.
- On success, candidate filtering precedes the second draw. Empty candidates
  consume only the chance word. A nonempty list consumes one uniform index and
  stores exactly one skill ID at screen `+0xFC`.
- The same `+0xFC` field is consumed by render, card-detail construction, and
  activation. Presentation is
  therefore not optional feedback: the player must know which mandatory card
  owns the double application.
- Renderer age owns a 1.8-second gold pulse period: RGB float
  `(0.85,0.73,0.44)` (nearest packed tint `#d9ba70`) is submitted with
  `alpha=0.5+0.5*sin(2*ageTicks*pi/180)` as a second draw over the ordinary
  card/icon treatment. Hover/focus remains a separate `+0x5F8` owner.
- Pointer/detail builder `0x00670E20` appends `Insight Bonus: Skill +2` to the
  marked card's native information object. It does not create a post-selection
  HUD notification. Choice application `0x00671470` calls the common
  acquisition once, then once more on the
  marked ID, so two offer-seed draws precede refresh and any queued successor.
  The first draw is intermediate; the second seed and RNG cursor own the next
  offer.
- Actor progression refresh repairs concentration A, optional B, then primary
  through the active gameplay RNG before a queued screen builds. Offer final
  shuffle and Insight follow those refresh draws. Browser code must not build
  the queued offer first and repair concentration afterward on another stream.
- Host authority owns option order, marker, selected ID, double apply, feedback
  result, and active RNG cursor. Replication carries the marker; presentation
  clients and reconnect staging consume it without rerolling.

## Nearby-system findings

- The fixed-zero secondary RNG is also used by independent secondary combat
  effects. This pass removes progression/concentration consumers from that
  stream but does not merge unrelated already-partitioned combat simulations;
  their native RNG parity remains owned by their respective system ledgers.
- Earlier detached-reconnect text naming “gameplay/secondary RNG owners” is
  superseded for progression: offer final order, concentration repair,
  Creativity Insight, automatic choice, and acquisition all advance the live
  gameplay RNG in their recovered order.
- The current web renderer already extracts the native body font (records
  `1..92`), so the missing `Insight` label is an omitted consumer, not an asset
  or platform limitation.

## Confidence and open questions

- Confirmed: retail image identity, active RNG pointer and bound/result branch,
  slot-A-only precondition, candidate/selection word counts, render string/font/
  logical position and gold pulse, detail string, separate double-acquisition
  apply function, all current web
  producer/consumer call sites, and the fixed-seed six-value web sequence.
- Inferred for deterministic multiplayer: process-global retail calls are
  serialized in stable authority participant order, matching the Website's
  existing deterministic host policy.
- Unknown: the second native `Dialog_AddLine` value is initialized card-detail
  data. It does not change the confirmed bonus line, double application, RNG
  order, or marked-card presentation and requires no new web field.

## Web implementation consequence

- Move every Creativity marker draw and concentration auto-repair in this
  progression lifecycle onto `GameSimulationState.gameRng`; leave
  `secondaryAbilities.rng` unchanged by progression.
- Centralize new-offer finalization in the player-entity store so each offer is
  immediately marked on the same returned RNG before another participant or
  automatic choice advances it.
- For selected cards, perform acquisition reseed(s), actor skill refresh and
  A/B/primary repair, queued offer build, then Insight. Remove the old path that
  builds a successor before refresh.
- Render native `Insight` and its gold pulse from authoritative
  `option.insight`, include `Insight Bonus: Skill +2` in the card's semantic
  detail, and do not invent a post-selection notification, a separate ability,
  or a guaranteed hit by level count.
- Preserve slot-B/Mind-Chug stock defects, candidate eligibility, ordinary
  Creativity behavior, Sorceror actions, protocol validation, and all 72
  offerable rows.

## Validation contract

- Focused kernels: chance values `0..4`, empty/nonempty candidates, every
  eligibility branch, exact one/two-word consumption, slot A/B/Mind Chug,
  double rank/max guards, and two acquisition reseeds.
- Store/simulation: initial solo, two-participant cohort, selected queued,
  reroll, save/defer, bonus book, bonus pickup, automatic, active/detached
  reconnect, and save/load paths; assert exact gameplay cursor/order and no
  secondary-RNG mutation.
- Presentation/protocol: marked metadata survives strict wire and save
  projection; native body-font label and gold pulse are at every three/four-card
  centre; only the marked semantic button names Insight and its +2 detail.
- Browser: deterministic active RNG produces a visible marked card in Hub and
  Boneyard, the selected rank advances by two, the native feedback appears,
  queued/reconnect presentation retains identity, and page/console/failed-
  response/protocol errors remain empty.
- Canonical Mac gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` on the
  byte-identical candidate; Mod Loader static suite on its byte-identical
  report/test tree.

## Implementation validation receipt

- Root cause reproduced before implementation: the Mac diagnostic returned
  `[3,4,2,3,3,1]` for the first six `RandomInt(5)` values from the web's
  fixed-zero secondary stream, and the two new focused assertions were the only
  failures in a 67-test red run.
- Implemented on Website base `a24bb5d02d37775612886e0aa912a5264a1732d6`:
  every offer producer now finalizes Insight through the actor store on the
  returned active gameplay RNG; selected-card acquisition, refresh/autofill,
  queued rebuild, and Insight use native order; the secondary RNG is unchanged;
  protocol/save identity round-trips; and the shared renderer exposes the
  pulsing gold card treatment, `Insight`, and `Insight Bonus: Skill +2`.
- Focused Mac green receipt: TypeScript build plus 305 affected progression,
  simulation, save, protocol, renderer, and mod-skill tests passed, including
  queued successor, replacement, exact cursor/order, and double-apply cases.
- Browser receipt on the exact candidate: a fresh session crossed its first Hub
  threshold and first Boneyard threshold with four legal cards and active RNG
  seed 1. Each scene showed exactly one marked card; selecting it advanced Magic
  Circle `0 -> 2` and then `2 -> 4`; the run consumed six offer words and two
  acquisition words, did not move the secondary RNG, and recorded no page,
  console, failed-response, or protocol errors. Captures are retained at
  `/Users/jarrett/codex-evidence/creativity-insight-20260828-root-r5/creativity-insight-hub.png`
  (SHA-256 `a256b506e9b9b724c01746f8fe60755144fa87befe9fdb16aa684533bd22c2ed`)
  and `creativity-insight-boneyard.png` (SHA-256
  `620dea674f5288b5dd38bbd38640f51d6b4d48f4ef43cddca056a32be6b8b1e6`).
- Native visual receipt is retained at
  `/mnt/c/sd-creativity-insight-20260828-root/native-creativity-insight.png`;
  it shows the independent stock gold treatment and label with no hovered card.
  The exact task-owned retail process was stopped after capture.
- The byte-identical Mod Loader RE report/test tree passed all 526 registered
  static checks on the Mac. The exact Website candidate passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`; its first receipt log is
  retained as `validate.log` (SHA-256
  `9315535116c23d76f08e326bc90bb72473f95c378578e0f7c469dae0031ec243`).
  The canonical gate is repeated after this receipt-only ledger edit so the
  final receipt names the exact final tree.
- Publication was subsequently authorized. Immediately before publication,
  Website `origin/main` had advanced to
  `f974f26801de7630d60a57cf0bea2baeff253575` and Mod Loader `origin/main` to
  `80df2ed5dcaba3d5e5be50820a83259193ce6c15`; both focused branches were
  rebased. The sole Website conflict was this append-only ledger boundary, and
  resolution retained the complete upstream render/VFX closure before this
  complete Insight entry. All other Website patches and the Loader patch were
  range-diff identical.
- Direct SHA-256 comparison found zero mismatches across the 15 changed Website
  files and five changed Mod Loader files transferred to clean detached Mac
  worktrees at those exact bases. The rebased Loader tree passed `531/531`
  registered static checks; log SHA-256 is
  `92be72482314f5ba41487c93f60083430c92c1d3ae05994086ca9a830521bfd9`.
- The rebased Website tree passed the complete canonical Mac gate; pre-receipt
  log SHA-256 is
  `0fc1b2b2c39ecd1468a96c8e747ae20dabb1f326503b8ddb30d9cb5f8828db62`.
  A fresh production Chrome/WebGL journey then repeated the Hub and Boneyard
  four-card offers, exactly one Insight marker, Magic Circle `0 -> 2 -> 4`,
  unchanged secondary RNG, and empty page, console, response, and protocol
  error arrays. Browser log SHA-256 is
  `ac963459a0d0e98607a12a3fc352a27f5e987bd58fc4e24109b1c8d654ef7b25`;
  Hub/Boneyard capture SHA-256 values are respectively
  `c37c6cfbff709a5be7fb643aa870f4cb0d8e9e55e47676bf36849749a71cebe3`
  and `0c463280f7f37725dae9edfa13f01296c4cd5c18f9c56b524e08080079a92e74`.
- This publication receipt is the sole post-gate tracked edit. The canonical
  Website gate is repeated on that exact final tree before the normal
  fast-forward push. Deployment was not requested and is not part of this
  publication receipt.
- That final gate completed successfully, but concurrent Website publication
  advanced `origin/main` to `300d8eb6abddd219fbee83e6613eb970efd541b6`
  and then, before the next Mac gate began, to
  `77e31bf46b4fe2446d576c9a22bf5cd1b202515c`. Focused rebases retained both the
  complete upstream fresh-match readiness and College-walker entries before
  this Insight entry; every non-ledger patch remained range-diff identical.
  This is the final tracked Website tree, so the canonical gate and
  Hub/Boneyard browser journey are repeated on a byte-identical Mac worktree at
  `77e31bf4` before push.
- Mod Loader main was fast-forwarded and independently verified at
  `f31429459320a7ece21c98e3fc6c45afd747be6f`; local `HEAD`, `origin/main`, and
  `refs/heads/main` matched. Website deployment was not requested.
- The byte-identical `77e31bf4` candidate passed the complete canonical gate;
  pre-harness-adjustment log SHA-256 is
  `c98cdb6dd1f11177960d91c7a784be6b9d866b4cde04187283fb4088b702bdae`.
  Its first two browser repeats then deterministically exposed a validation-
  harness defect: direct `host.state()` mutation created the Boneyard level-up
  barrier between ticks, so the frozen host could not observe that out-of-band
  transition and emit its snapshot. Tagged host/client probes proved the
  authoritative offer and barrier existed while no barrier snapshot was sent;
  readiness had already released and presentation never received an offer.
- The smoke now grants threshold XP through the existing authority-owned Web
  Lua `sd.player.grant_experience` command, which enters on the game thread and
  exercises the normal barrier snapshot. No gameplay module changed. The clean
  rerun restored Hub/Boneyard Magic Circle `0 -> 2 -> 4` with exactly one
  Insight card and empty error arrays. Browser log SHA-256 is
  `e6c1aec42b807c45222808780aa9be787ed2fc982399f7cb0e4969dedc39a052`;
  Hub/Boneyard capture SHA-256 values are respectively
  `13a98c979a5e3fb75a9857fe20ebb22a162cfe386ebd08e9dacf80d962096eae`
  and `5b91fd2f2318b860c69182da4b689b470d272f05f7fc58952aa4a400f9d23fd8`.
  The complete gate is repeated after this receipt and harness-only change.
