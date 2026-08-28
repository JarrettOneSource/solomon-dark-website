# 2026-08-27 — Atomic match-loading presentation and complete Boneyard coverage

## Reported smell and parity question

- Reported web behavior: the match progress bar can paint over the prior scene
  before `Wizards_dire_BG` appears. During Boneyard renderer construction the
  bare world/HUD `Preparing the Boneyard…` fallback can therefore leak instead
  of the full loading presentation and its semantic status.
- Required behavior: every nontrivial Hub/Boneyard transition presents one
  complete atomic loading frame—art, scrim, useful lifecycle label, and bar—
  while input remains sealed through destination renderer readiness.
- This reopens the 2026-08-14 match-loading and 2026-08-22 mobile visual-lifetime
  entries. The skipped membership was the process-wide match cover: the mobile
  cutover correctly removed inactive world/actor art from startup but removed
  the cover too, while `MatchLoadingScreen` continued assuming it was decoded.
- Falsifiers: match art already belonging to current startup readiness; the
  component gating its chrome on image readiness; a nontransparent cover behind
  the bar; Boneyard work completing outside the existing barrier; or restoring
  the former route-wide world/actor manifest.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| User observation | browser report, 2026-08-27 | The progress UI sometimes precedes the cover, and the Boneyard preparation fallback is exposed. | authoritative |
| Existing native/loader evidence | retail Beta 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Mod Loader `native-menus-and-boot.md`; Website entries dated 2026-08-14 | One process-wide `LoadingScreenState` owns the exact art, 18-percent scrim, discrete stage label/bar, 150-ms anti-flash gate, input seal, cancel, and renderer-ready completion. | high |
| Current web causal trace | Website `ec98c44ec5001802946289e833a3df5a0e8010fb`; `game-assets.ts`, `MatchLoadingScreen.tsx`, `match-loading-screen.css`, `MainMenuScene.tsx`, `BoneyardScene.tsx` | Startup includes Loader/Title but not `matchLoading`. After 150 ms the component sets `data-visible=true` without testing `<img>` load/decode; the root is transparent, so the already-paintable label/bar and scene fallback can precede the image response. | high |
| Regression history | Website `f94d4f64e01d5ab883ca47943694e0fa1cfd341f` and mobile cutover `cfda6be4980059808d107746b7928e71be70d81a` | The first port put the cover in a route-resident manifest. The mobile fix removed the entire manifest after measuring about 1,064 MiB startup residency, but its inventory omitted the single 7.91-MiB transition-shell surface. | high |
| Exact asset | `frontend/src/assets/game/match-loading-background.png`, 1920 x 1080, 3,579,758 encoded bytes, 8,294,400 RGBA bytes, SHA-256 `251365e025129972707b436d441d52ae2c5f8199bc3f80a1c4e03b2a28a1180c` | One decoded shell surface is sufficient for every Hub/Boneyard branch; no world, actor, mod, or modal atlas needs startup residency. | high |

No new executable address, loader stage, authored row, or asset fact was
recovered. The current Mod Loader report already owns the reusable native
contract and remains unchanged.

## System boundary and membership inventory

Native system: **process-wide match-transition barrier and its browser visual
readiness adapter**, from route readiness and the first transition edge through
semantic stage advancement, atomic painting, destination first frame, cancel,
and teardown.

| Member / branch | Native source | Required disposition | Proof contract |
| --- | --- | --- | --- |
| Exact `Wizards_dire_BG` cover | loader asset/renderer contract | `exact-ported` | one startup-shell member with exact hash and 7.91-MiB decoded cost; no inactive scene atlas joins it |
| Art/scrim/label/bar first visible frame | D3D renderer's composed frame | `exact-ported` | visual readiness is `150 ms elapsed AND image loaded`; no visible child may precede positive image dimensions |
| Discipline commit -> shared/private Hub | `connecting_transport` owner | `verified-already-at-parity` with atomic-art correction | barrier still begins at accepted discipline before Create's final recurrence and ends at Hub renderer ready |
| Last Game -> Hub | same transport/checkpoint path | `exact-ported` shared correction | cover is already decoded before the title action; semantic stages remain monotonic |
| Last Game/rejoin/restart -> Boneyard | connection plus run-content path | `exact-ported` shared correction | no restored renderer/HUD/status leaks before the full cover |
| College-intro admission | Hub transition path | `exact-ported` shared correction | same shell art, transport labels, cancel, and renderer-ready teardown |
| Hub map -> ordinary/custom Boneyard | `preparing_boneyard -> reading_boneyard -> materializing_participants` | `exact-ported` shared correction | `Preparing/Loading/Gathering` labels appear on the cover; scene fallback remains covered |
| Stock Tutorial Boneyard | same Arena/loading owner plus authored prelude | `verified-already-at-parity` with atomic-art correction | prelude remains intentional; after its handoff the same complete cover owns renderer work |
| Non-host start and late restored peer | loaded-content/snapshot writers | `exact-ported` shared correction | already-decoded process cover is available even when the local client did not request the run |
| Progress stage table and strict-greater advancement | existing 18 applicable browser rows from the complete 20-row loader table | `verified-already-at-parity` | every current semantic label/progress row remains exact and no timer fabricates missing host stages |
| Sub-150-ms transition | loader reveal gate | `verified-already-at-parity` | input is sealed but no loading pixels flash; successful teardown has no minimum hold |
| Hub/Boneyard renderer fallback diagnostics | Website renderer-specific diagnostic | `out-of-system` for native presentation; retained for errors/direct isolation | ordinary match flow covers the loading fallback; actionable WebGL error remains visible after cancel |
| Startup Loader, Title/Create/world/actor/modal/mod art | distinct native owners | `out-of-system` | no old route-wide resident manifest or inactive-scene preload returns |
| Failure/cancel, run replacement, route teardown | loading lifecycle | `verified-already-at-parity` plus atomic readiness | asset failure fails route readiness; session/renderer failure cancels; no late child paint survives unmount |

There is no browser-blocked member. A browser image has an asynchronous load
edge, and explicitly owning it is the browser adaptation required to preserve
the native composited-frame invariant.

## Ownership thread and recovered behavioral contract

- Route startup owns only Loader, immediately-next Title, global audio, and the
  one process-wide transition cover. The cover is not Hub/Boneyard scene art:
  either Title, Create, Hub, or an incoming restored run can enter its barrier.
- Startup must finish the cover's successful `load` plus best-effort `decode()`
  through the existing bounded four-worker loader before Title becomes
  interactive. This adds one 7.91-MiB decoded surface, not the superseded
  1,064-MiB route manifest.
- `MatchLoadingScreen` independently requires its mounted image to report
  positive readiness before exposing any sibling child. That local invariant
  protects cached-image eviction and DOM paint ordering without a delay,
  timeout, retry, alternate art, or partial fallback.
- The existing 150-ms reveal threshold, stretched Website art policy, exact
  geometry/colors, semantic stage table, immediate input seal, renderer-ready
  completion, and cancel semantics remain unchanged.
- Boneyard's `Preparing the Boneyard…` node remains a renderer diagnostic, not
  a second transition surface. Once the reveal threshold is crossed it cannot
  be topmost during an ordinary match transition.

## Confidence and open questions

- Confirmed: omitted startup membership, transparent partial-paint mechanism,
  exact asset bytes/cost, all flow entry/advance/ready/cancel owners, and the
  existing mobile cap/scene ownership contract.
- Inferred: none used for the implementation.
- Unknown: none material. Browser eviction is handled by the component's own
  positive image-readiness gate even after startup succeeded.

## Web implementation consequence

- Add one explicit match-transition source group and startup stage; do not put
  any Hub, Boneyard, player, spell, modal, or mod imagery back into startup.
- Make the presentation flag the conjunction of the existing reveal threshold
  and mounted image readiness. Publish readiness in data attributes for the
  browser race probe.
- Keep every useful existing semantic stage label and remove no renderer error
  diagnostic. The reported Boneyard result must emerge from shared cover
  ownership, not from hiding one text node.

## Validation contract

- Focused red/green tests: startup membership contains exactly the transition
  cover; startup-memory policy permits that one member but still rejects every
  inactive scene family; presentation source gates all children on art
  readiness; stage/lifecycle/input contracts remain unchanged.
- Mac Chrome delayed-image journey: throttle the cover beyond 150 ms and prove
  zero frame where progress/label is visible with zero natural image width;
  then observe one atomic complete frame and the exact Hub/Boneyard semantic
  labels through renderer readiness.
- Mobile startup probe: peak work remains at most four and decoded startup
  imagery remains below 128 MiB with only the named 7.91-MiB increase.
- Exact candidate: byte-identical Mac tree, canonical
  `/opt/homebrew/bin/bash ./scripts/validate.sh`, empty page/console/failed-
  response arrays, and no exposed Boneyard renderer fallback after reveal.

## Implementation validation receipt

- `game-assets.ts` now owns one explicit process-wide match-transition source
  group and loads it in the bounded startup program after Title. No Hub,
  Boneyard, player, spell, modal, or mod atlas returned to route-wide
  residency. `MatchLoadingScreen` independently requires both the existing
  150-ms threshold and a positive mounted-image load edge before any child is
  visible; diagnostic data exposes both predicates for the race probe.
- Focused red coverage failed on the omitted source group and absent art-ready
  gate, then the exact final Mac tree passed all 94 focused loading,
  protocol-95, client/save, and College integration contracts. The canonical
  gate passed 26 backend/contracts, 311 prerequisite tests, 1,687 broad
  Boneyard/host tests, 77 ML tests, every remaining registered suite,
  production builds, media policy, and bundle budget (`252,960` raw / `76,818`
  gzip). Gate-log SHA-256 is
  `dcd8d6739ca7fbd7a70de06ab249d9708978c09ac18b16762b24707c7f1e8900`.
- Mac Chrome 151 forced each mounted Hub/Boneyard image to arrive 650 ms late
  on top of 750-ms network latency. Both flows sampled the post-150-ms state at
  `naturalWidth=0` with art, label, and bar all hidden, then exposed one atomic
  `1920 x 1080` image/scrim/label/bar frame. Boneyard published
  `Preparing the boneyard... .73` and then real `Gathering the coven... .92`;
  input held through readiness, did not replay, and fresh input moved normally.
  Page, console, and failed-response arrays were empty. Browser-log SHA-256 is
  `e84ed31ee72cc7a86196e02987ca6574bce6163c3e43c75ae11a29df71e02283`;
  inspected final loading-frame SHA-256 is
  `728958d1ecfc5e9d9228c28a721df13aba7265e453d22fa60c19fc3feaec8555`.
- The production startup probe loaded the transition cover exactly once,
  retained the four-worker cap, decoded 25.01 MiB across 52 startup images,
  and loaded no world/player/SkillPicker-skills texture. It recorded one page
  load with empty crash/page/console/response errors; log SHA-256 is
  `18009aea3e410cf9f23dc611528f8bc907cda7ab1465ef845b988fdb81b4b501`.
- The byte-identical pre-receipt source trees were local commit
  `8acb4f5ac0dc1ba9801986ffee2aef159dad6025` and detached Mac base
  `0bf893b63ab48da9b9b78e583a8f3ecf0e18b262`, with 25 changed/deleted paths
  under manifest SHA-256
  `032480c59c97d6a0ccd07faece62cadb7de83b12825767296e0baba4863880ec`.
  This receipt is the sole post-validation documentation write; no runtime,
  test, build, or browser byte changed afterward.
