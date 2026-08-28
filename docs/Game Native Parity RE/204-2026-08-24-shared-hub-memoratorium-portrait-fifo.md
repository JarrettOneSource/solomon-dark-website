# 2026-08-24 — Shared-Hub Memoratorium portrait FIFO

## Reported smell and parity question

- Reported web behavior: every browser sees the same ten hard-coded Mortuary
  paintings, so a player completing a run never appears in the shared Hub and
  already-present peers cannot observe a memorial update.
- Stock behavior to recover: the complete post-run portrait producer, ten-slot
  ordering/rollover rule, persisted slot state, external portrait compositor,
  and eulogy selection behind the already-ported ordinary Memoratorium.
- Reproduction inputs/scenes: a populated shared Hub with one player in the
  Mortuary while another party completes a run; ten-plus sequential completed
  portraits; a client joining after prior completions; and interaction with a
  replaced painting.
- Falsifiable questions: whether stock evicts by score, physical slot cursor,
  or persisted age; whether the raw portrait id is unbounded; whether a
  Painting's eulogy stays attached to its physical slot; and whether current
  web ownership can update a Hub while another party is in a Boneyard.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Instructions | retail `SolomonDark.exe` 0.72.5, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`; profile initializer `0x005A8390`; Mortuary builder `0x00515290` instructions `0x0051549F..0x0051557A` | ten persisted ages are scanned with strict lower-than comparisons; the minimum-age slot is blanked and receives the current portrait age | high |
| Instructions | portrait writer `0x005BED10`, especially `0x005BF3B6..0x005BF3CD`; post-run transition `0x005CF4F0`, especially `0x005CF85A..0x005CF88A` | capture writes a `64 x 64` raw portrait, advances age/latest/next ids, and wraps the raw id ring from `109` to `100` | high |
| Instructions | Memorator tick `0x00513090`; Painting renderer `0x00518620`; callback `0x00506190 -> 0x00506100` | stock stages a blank/reveal, renders external ids inside the same easel layers, and formats the eulogy from the Painting's current portrait id | high |
| Persistent data | profile `0x0081A330`: markers `+0x90[10]`, ages `+0xA4[10]`, portraits `+0xCC[10]`, age `+0xF4`, next/latest `+0xF8/+0xFC` | default ages `9,1,0,2,7,4,3,8,5,6` make first-replacement slot order `2,1,3,6,5,8,9,4,7,0`; defaults contain bundled portraits `0..9` | high |
| Asset/data | `images/paintbkg.png` (`64 x 64`, SHA-256 `d46f8e75f8bac8280a66fe1d4092504a60816e896521802749c5682fbb619e7b`); Memoratorium records 3, 4, 7, 8, 14..23 | dynamic captures use the stock background and the same easel/front/marker compositor as fixed portraits | high |
| Current web causal trace | `HubWorldState`, `SharedGameWorldsState`, `stepSharedGameWorlds`, protocol 72, `HubPrivateRoomScene`, and static `MORTUARY_PAINTINGS` | the shared Hub keeps ticking while party runs are partitioned, but it owns no memorial state; snapshots and renderer can only reproduce the fixed strip | high |

The static work used the canonical read-only Ghidra replica wrapper from the
isolated Mod Loader worktree. No runtime address or injected observation is
used in these conclusions.

## System boundary and membership inventory

Native system: the profile-backed Memoratorium portrait archive begins at
local-player capture, owns ten age/marker/portrait slots and their rollover,
and ends at Painting render/eulogy consumption. The Website extension moves
that archive to the one shared-Hub authority while preserving the ten-slot
contract.

| Member | Native source | Disposition before implementation | Proof/target |
| --- | --- | --- | --- |
| ten physical Painting positions/colliders and ordinary records 3/7 | `0x00515290`, `0x00518620` | verified-already-at-parity | existing layout/collision and strip tests |
| initial bundled portraits `0..9` | profile `+0xCC[10]`; records `14..23` | verified-already-at-parity | existing ten-frame strip |
| initial marker bits | profile `+0x90[10]`; record 8 | verified-already-at-parity | existing per-slot marker fixture |
| initial age permutation and strict-min FIFO eviction | profile `+0xA4[10]`; `0x0051549F..0x00515547` | exact-ported | focused kernel sequence/tie tests |
| age counter and ten-id `100..109` rollover | `+0xF4/+0xF8/+0xFC`; `0x005BF3B6..0x005BF3CD`, `0x005CF877..0x005CF880` | exact-ported | 11-completion boundary test |
| per-completion marker draw `Integer(5) != 3` | `0x00515547..0x0051555C` | exact-ported | five-value boundary test |
| every completed run participant | Website shared-party extension over native singleton writer | exact-ported requested product extension | multi-participant archive test |
| shared authority, live replication, and late join | Website shared-Hub extension | exact-ported requested product extension | protocol/keyframe/client tests and built late-join journey |
| `64 x 64` paint background plus frozen wizard pose/equipment | `0x005BED10`; `images/paintbkg` | exact-ported | renderer texture/geometry tests and built pixels |
| blank record-4 ceremony and native 235/25/50/100-tick reveal | `0x00513090` | out-of-system by explicit user product request: publish the finished portrait immediately to everyone present | no delayed client-local ceremony |
| dynamic marker/easel/front layers | records 3/7/8 | exact-ported | asset identity, layer-order tests, and built room capture |
| eulogy follows current portrait id `0..9` or `100..109` | `0x00506190 -> 0x00506100` | exact-ported | interaction override tests |
| Annalist2 story population and story boast ceremony | `0x00513BE0`, records 11..13 | out-of-system — Website survival has no story campaign | existing product boundary |
| ordinary Memorator, 50 flames, triple late glow, portals, remote players/effects | previously closed ordinary compositor | verified-already-at-parity | existing room/presentation journeys |

No member is blocked by the browser platform.

## Native ownership thread

- Owner and construction path: native profile `0x0081A330` persists the ten
  slots; local death captures one raw portrait; the completed-run transition
  builds an eulogy Mortuary; the builder/reveal writes one selected Painting.
  In the Website, `SharedGameWorldsState.hub.world` is the deepest owner that
  survives party partitioning and is common to every Hub client.
- Upstream state producers/callers: authoritative run completion already
  produces frozen heading/scale plus player config/equipment for every run
  participant. Browser Hall storage is not an authority source.
- State representation and transitions: default ten fixed slots -> capture id
  `100..109` -> strict-min age replacement -> next age/id; the requested web
  branch commits the replacement atomically instead of exposing native blank
  and reveal phases.
- Downstream consumers/callees: Hub keyframes/frames, presentation timeline,
  private-room Pixi compositor, Painting interaction/eulogy, and late joins.
- Sibling systems sharing ownership or data: Hall archive pose, shared party
  run partition/merge, protocol replication, equipment appearance, fixed room
  assets, and native profile persistence documentation.
- Entry, interruption, reset, and teardown: a completion is admitted once at
  the Hall archive edge; duplicate ticks/run-player pairs are ignored; player
  disconnect does not erase a portrait; shared-host process reset creates the
  stock defaults; client reconnect receives the current authoritative slots.

## Recovered behavioral contract

- Capacity/order: exactly ten slots. Evict the smallest persisted age; strict
  comparisons preserve the lower physical slot on a tie. The newest portrait
  receives the next monotonically increasing age. This is FIFO.
- Portrait ids: external ids occupy the closed interval `100..109` and wrap to
  `100`; because eviction is FIFO, the reused id belongs to the slot being
  replaced.
- Render geometry/order: stock `64 x 64` paint background, wizard rooted at
  capture center plus `(0,20)`, then Painting easel/front and optional urn
  marker at the existing world position/depth.
- Randomness: marker is present unless `Integer(5)` returns `3`. Frozen heading
  and scale remain the authoritative Hall archive draws; clients do not reroll.
- Network authority: one server-owned shared-Hub state records all completed
  participants and is replicated whole to current and late-joining clients.
  It is neither per-browser local storage nor an account leaderboard.
- Timing: the Website commits at the authoritative archive edge and becomes
  visible on the next Hub snapshot, as explicitly requested. It does not stage
  the stock single-player eulogy entrance ceremony.

## Nearby-system findings

- Durable finding: `darkdata.cfg` offsets `+0xA4..+0xCB` and
  `+0xCC..+0xF3` were previously mislabeled as class permutations; they are
  memorial ages and portrait ids. `+0xF4` is the portrait age counter.
- Evidence: initializer `0x005A8390`, portrait writer `0x005BED10`, strict-min
  scan/write `0x00515290`, and reveal writer `0x00513090` form one closed
  producer/consumer chain.
- Why it matters: save import/export code must not reorder or normalize these
  arrays as class data.
- Native reports updated before code:
  `native-hall-of-fame-and-memoratorium.md` and `native-save-format.md`.

## Confidence and open questions

- Confirmed: capacity, initial slot ages/order, strict tie rule, marker draw,
  id range/wrap, raw capture size/background/placement, reveal writer, current
  eulogy selector, and every persistent field.
- Inferred only for the Website extension: when several participants archive
  in one authoritative tick, the existing sorted Hall-writer order supplies a
  deterministic batch order. Retail has no multiplayer sibling to distinguish
  those simultaneous completions.
- Unknown: none material to the requested shared real-time memorial.

## Web implementation consequence

- Add a focused ten-slot memorial kernel owned by `HubWorldState`; update it
  only from `stepSharedGameWorlds` when a run-player Hall record crosses from
  unarchived to archived.
- Carry semantic frozen portrait recipes (identity, loadout, equipment,
  heading, scale, capture tick), ages, ids, and markers in the Hub protocol.
- Replace only the selected Painting's portrait/marker layers; retain fixed
  geometry, collision, Memorator, flames, glows, remote actors, and portals.
- Resolve Painting dialogue from the slot's current portrait id rather than
  the static catalog id captured in the earlier ordinary-room pass.
- Do not add an HTTP poller, browser-local list, leaderboard sort, or account
  persistence fallback.

## Validation contract

- Focused kernel tests: defaults, exact first-ten slot order, strict tie,
  marker draw boundary, id wrap, all-player batch admission, idempotency, and
  11th-entry FIFO eviction.
- Protocol/client tests: full snapshot, delta frame, malformed capacity/range,
  late join, and atomic discrete presentation update.
- Renderer tests: exact stock layer assets, `64 x 64` background, `(0,20)`
  wizard root, equipment/heading/scale freeze, all ten slots, marker changes,
  painter order, and resource teardown.
- Mac browser journey: keep one client settled in the Mortuary, complete a run
  with another party, observe the name/id change without reload, then join a
  third client and require identical ten-slot state and empty page/console/
  failed-response arrays.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact
  manifest-identical Mac candidate.

## Implementation validation receipt

- Implementation: `HubMemorialState` owns ten slots, native defaults, strict
  minimum-age replacement, marker draw, duplicate admission, and the
  `100..109` id ring. `stepSharedGameWorlds` detects each run-player Hall
  archive edge, consumes the marker word, and commits every participant into
  the one resident Hub. Protocol 73 carries the bounded state through full and
  delta snapshots; the Hub timeline treats replacement atomically; browser
  saves deliberately omit it. Painting dialogue reads the current slot id.
- Presentation: the extractor now emits exact record-3 easel, record-7 front,
  record-8 marker, and `paintbkg` assets. `HubMemorialPaintingView` clips the
  frozen semantic wizard recipe into the stock `64 x 64` capture and leaves
  all ten physical roots, collision, Memorator, flames, and late glow intact.
- Red receipt: detached Mac base `b5c8d42965` with test-only commit
  `9ee51f8e` reached `test:hub-ui` and failed exactly at missing
  `core-kernels/hub-memorial.ts` (`ERR_MODULE_NOT_FOUND`).
- Exact-tree automated receipt: on canonical Website base `80d5fbc0`, the
  rebased 39-file manifest matched Mac byte-for-byte.
  `/opt/homebrew/bin/bash ./scripts/validate.sh` passed the backend `22/22`,
  save/prerequisite `271/271`, Boneyard/game `1499/1499`,
  parties `64/64`, memorial-inclusive Hub UI `66/66`, desktop `5/5`, lint,
  type checks, production build, media policy, and the game bundle budget at
  `130580 / 131072` gzip bytes. The companion Mod Loader static RE gate passed
  `500/500`.
- Built browser receipt: Mac Google Chrome `151.0.7922.170` entered the real
  Mortuary with `nextAge=1001` and zero dynamic portraits. The authoritative
  host published one completed Earth wizard; the mounted WebGL scene changed
  live to one rendered portrait at physical slot 2, portrait id 100, and
  `nextAge=1002` without reload. A newly authenticated raw client then received
  the same slot/id/name in its welcome snapshot. Page, console, failed-response,
  and request-failure arrays were empty. The visually inspected screenshot is
  `/Users/jarrett/codex-acceptance/shared-memorial-final-20260824/shared-memorial-final.png`,
  SHA-256 `74c7a050d9ee78e0eea3a5fed38c2c2857de461acd2f5b96183c153206fce7b5`.
- No browser-platform block or material unknown remains. The stock local
  235/25/50/100-tick entrance ceremony is the one explicit product deviation:
  per the request, the shared portrait commits immediately on the next Hub
  snapshot. No push, deployment, or production verification was performed.

### 2026-08-26 - durable run records and dynamic Painting inspection

The published shared-Hub pass closed the stock ten-slot compositor and live
replication path, but its product boundary was too narrow. It retained only the
wizard recipe in process memory and routed external portrait ids `100..109`
through the stock eulogy table, where those ids have no authored row. A dynamic
Painting consequently showed a generic bad-eulogy tail (or no line after a
successful Boast), omitted the account and run facts already present at the
authoritative Hall archive edge, and reset to bundled portraits whenever the
global supervisor restarted.

The reopened system boundary begins at the same per-participant Hall archive
edge and ends after durable supervisor recovery, protocol replication, dynamic
Painting inspection, and FIFO eviction. Its complete membership is:

| Member | Disposition | Contract |
| --- | --- | --- |
| stock ten-slot age permutation, strict-min replacement, marker draw, and `100..109` ring | verified-already-at-parity | no ordering, capacity, randomness, or physical-slot change |
| every completed party participant, including guests and bots | exact-ported | one retained portrait per run/player archive edge |
| account username | exact-ported Website extension | copy the host-authenticated profile; nullable for guests and bots |
| runtime, wave, level, kills, awesomeness, and awesomest kill | exact-ported Website extension | copy the already-final authoritative Hall/player/wave state; never recompute in presentation |
| dynamic Painting inspection | exact-ported Website extension | show `Wizard (@Account)` when registered, class/level, runtime, wave, kills, awesomeness, and optional awesomest kill |
| bundled portrait inspection | verified-already-at-parity | retain stock eulogy rows `0..9` and Boast behavior |
| restart survival | exact-ported Website extension | atomically replace one protected global-supervisor state document before publishing the completed portrait |
| browser saves and local Hall storage | out-of-system | neither may fork, seed, or restore the shared archive |
| unbounded visible history | out-of-system | the native room has exactly ten physical Paintings; FIFO means every completion enters and the oldest retained completion leaves |

No member is blocked by the browser platform. The protected state document is
the durable authority for the latest ten physical slots and their total age/id
cursors. A missing document starts from stock defaults. A malformed document is
a startup failure, never a silent reset. Completion persistence is synchronous
at the rare Hall edge: the host writes and fsyncs a same-directory temporary
document, renames it atomically, fsyncs the directory, and only then publishes
the stepped Hub state. If persistence fails, the pre-completion state remains
authoritative and the edge is retried rather than acknowledged in memory only.

Protocol 82 extends the bounded portrait recipe with the nullable authenticated
account username and final run summary. It does not add an HTTP poller, client
clock, browser persistence fallback, second score calculator, or leaderboard
sort. Inspection formats the carried facts only. The persistence file contains
no credentials, bearer tokens, email addresses, or session capabilities.

Validation must cover the complete reopened boundary: enriched multi-player
archive records (registered, guest, and bot), strict protocol validation,
unchanged first-ten and 11th-entry FIFO order, atomic file round-trip and
malformed-file rejection, stock-versus-dynamic inspection selection, exact
runtime formatting, live Mortuary replacement, inspection text, supervisor
restart hydration, late join, empty page/console/failed-response arrays, and the
canonical Mac Website gate.
