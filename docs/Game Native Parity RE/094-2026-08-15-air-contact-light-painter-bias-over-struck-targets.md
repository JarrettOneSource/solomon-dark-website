# 2026-08-15 — Air contact-light painter bias over struck targets

> **2026-08-29 split-painter closure:** [entry 297](<297-2026-08-29-complete-region-world-painter-layering-audit.md>)
> leaves the independently registered contact root and `+50` bias closed, but
> supersedes this file's former single-root disposition for the Air bolt body.
> The `ZAnimSplit` body is now a clipped multi-root queue program rather than
> one midpoint container.

## Reported smell and parity question

- Reported web behavior: the Air lightning contact light/corona can paint
  underneath the Gravestone or enemy it strikes.
- Stock behavior to recover: the complete player-Air endpoint wrapper order,
  including normal and underpowered casts, primary and chained contacts,
  combat-actor and Gravestone targets, clipped world endpoints, and the
  factory siblings that do not share its painter owner.
- Reproduction inputs/scenes: cast Air at a Boneyard enemy and at the
  priority-1000 Gravestone fallback. The authoritative target endpoint is
  shifted upward by 20 world units before the contact's sub-10-unit radial
  jitter, so a zero-bias painter sorts behind the target root.
- Falsifiers: a native post-world overlay, a target-owned composite, a zero
  `Puppet +0xA0` field, a bias used as light radius, or a separate target-type
  branch would disprove the shared world-queue model below.

This reopens the Air presentation entry above. That pass recovered and
documented the `50.0` `Puppet` painter bias but left all three web Air roots at
`sortBias: 0`. The earlier implementation therefore violated its own native
contract; fixing only the reported Gravestone or enemy would repeat that
process failure.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail executable identity | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000`, verified in the current workspace on 2026-08-15 | The file identity matches the executable used by the existing Air instruction audit. No live PID, ASLR address, or loader-injected observation is reused. | high |
| Existing native instructions | Mod Loader `origin/main` `6376a42a16bba895fbb628e635c7419cfbcde26a`; `docs/reverse-engineering/native-projectile-and-spell-mechanics.md`; player handler `0x0053F9C0`, factory `0x00531640`, `Anim_FadeLightning` `0x00452E20/0x00476230/0x004572C0`, `ZAnimLit` `0x005E03D0/0x005FD1D0/0x005E48E0`; Air writes at `0x00540072..0x005400F8` | The contact is an independently registered `Anim_FadeLightning` child wrapped by `ZAnimLit`. Constant `50.0` at `0x00784CF8` is written to inherited `Puppet +0xA0`, the shared painter sort bias. It is not a light radius. | high |
| Existing native xref sweep | same report; five direct `0x00531640` calls plus `Anim_FadeLightning` xrefs | Player primary and chain branches share the wrapper. Skeleton Mage uses direct world or target-embedded contact ownership with no `ZAnimLit`; StormCloud constructs the bolt directly. ElectricBurn and Ball Lightning are separate owners: the category-2 implementation now models ElectricBurn's trap-chain-zero light/audio path, while Ball Lightning remains unmodeled. | high |
| Pre-fix web causal trace | Website `fd0e784092edfdd6c53cec9f55a2d69b22614ddb`; `core-kernels/primary-spell-targeting.ts`, `renderer/primary-spell-air-view.ts`, `primary-spell-world-view.ts`, `boneyard-painter-order.ts`, and `renderer/boneyard-world-renderer.ts` | Target acquisition publishes the native `-20` Y attachment. The Air view preserves the jittered contact world Y but assigns body, source, and contact `sortBias: 0`; the shared queue computes `trunc(worldY)+trunc(sortBias)`. The contact is therefore keyed 10..30 rows before the target instead of the native 20..40 rows after it. | high |
| Existing authoritative fixture | `core-server/game-simulation.test.ts`, Gravestone root `(250,100)` and published Air endpoint `(250,80)` | The same semantic target path reaches the renderer for the priority-1000 Gravestone fallback; the renderer does not and must not branch on target type. | high |

No new native address, field, asset, or class fact was recovered in this pass.
The current Mod Loader report already owns the complete reusable instruction
and xref evidence, so it remains unchanged.

## System boundary and membership inventory

Native system: **player-Air endpoint `Anim_FadeLightning` world-painter
ownership** — from an accepted Air presentation endpoint through contact
jitter, `ZAnimLit` wrapping, five-tick fade/light enrollment, shared world-row
submission, and retirement. The boundary includes every branch that creates
that wrapper and dispositions every nearby lightning/corona sibling found by
the factory and class xrefs.

There is no authored variant table in this system. The complete consumed art
membership remains BadGuys record `110` and fork records `1836..1839`, already
extracted and hash-pinned in the Air entry.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof / reason |
| --- | --- | --- | --- |
| Normal player-Air primary contact | `0x0053F9C0 -> 0x00452E20 -> 0x005E03D0`, `+0xA0=50` | `exact-ported` | focused root contract and Boneyard queue-order assertion |
| Underpowered player-Air primary contact | parameter-nine branch in `0x0053F9C0/0x00531640`; same wrapper and bias | `exact-ported` | focused weak-root assertion; only alpha/radius/intensity differ |
| Learned chained Air contacts | chain branch in `0x0053F9C0`; same `Anim_FadeLightning` owner, including the low-detail scale/fade branch | `exact-ported` | all Air transient views consume the shared contact bias independent of target id or visual strength |
| Combat-actor target | actor attachment plus Y `-20`, then sub-10 contact jitter | `exact-ported` | synthetic enemy-root painter-order regression and real-browser enemy hit |
| Priority-1000 Gravestone fallback | Air acquisition/attachment path and type `2029` scenery target | `exact-ported` | generated-scene Gravestone painter-order regression and real-browser grave hit |
| Clipped/untargeted world endpoint | player handler valid-endpoint branch; same independently registered wrapper | `exact-ported` | focused no-target root assertion; remains world-sorted rather than promoted globally |
| Air contact's five visible ages and outbound `ZAnimLit` light | `0x00476230`, `0x005FD1D0`, `0x005E48E0` | `verified-already-at-parity` | existing alpha/intensity/radius/lifetime tests; painter bias does not change light enrollment |
| Air bolt body and source `Anim_SpellGlow` | `0x00531640`, `ZAnimSplit`, and source registration | `verified-already-at-parity` | retain separate midpoint/source roots with zero bias |
| Hub and Boneyard scene consumers | shared `PrimarySpellWorldView`; Boneyard adds the native row queue | `exact-ported` | shared Air-root contract plus Boneyard target receipts; no scene exception |
| Fireball contact `Anim_FireBurst` in `ZAnimLit` | `0x005E5160 -> 0x005E03D0`, bias `50` | `verified-already-at-parity` | `NATIVE_FIRE_IMPACT_DEPTH_BIAS=50` is already included in its painter key and covered by Fire tests |
| Ether `Anim_FadeMM` contact in `ZAnimLit` | `0x005F1F00 -> 0x005E03D0`, bias `100` | `verified-already-at-parity` | `ETHER_PRIMARY_IMPACT_SORT_BIAS=100` is already included in its painter key and covered by Ether tests |
| Earth independently wrapped breakup fragments | `0x0060B700`, `ZAnimLitObject`, bias `-15` | `verified-already-at-parity` | every fragment root exposes `sortBias=-15`; Earth painter tests cover interleaving |
| Skeleton Mage lightning contact | Mage `0x00490860`; direct world contact or player embedded manager, no `ZAnimLit` contact provider | `out-of-system` (different painter owner and ordering interval) | existing Mage tests pin world roots and target post-main lane |
| StormCloud contact | `0x006021A0`; direct bolt construction and separate FadeLightning use | `out-of-system` (different owner, modeled by the Website category-2 system rather than primary Air) | the secondary snapshot/presenter owns StormCloud's native bolt geometry; it does not reuse this primary-Air wrapper |
| `Mod_ElectricBurn` contact | `0x00628F10` | `out-of-system` (different modifier owner, modeled by the Website category-2 system) | Magic Trap's recovered chain count is zero, so ElectricBurn owns its target-attached misc light and loop audio but creates no FadeLightning actor |
| Ball Lightning contact | sibling `Anim_FadeLightning` xrefs | `out-of-system` (different, currently unmodeled projectile owner) | native xref disposition; no Website actor is inferred from shared art |

There are no `blocked-by-platform` members. Pixi/WebGL can represent the exact
shared painter bias.

## Native ownership thread

- Owner and construction path: every accepted player-Air held tick creates a
  semantic Air transient. Its endpoint fade is an independent
  `Anim_FadeLightning` child in a `ZAnimLit`/`Puppet` world-queue wrapper.
- Upstream state producers/callers: authoritative Air acquisition selects a
  combat actor before the lower-priority Gravestone fallback, retains or
  chains targets under the existing rules, applies attachment offsets, and
  publishes source/midpoint/endpoint and transient identity.
- State representation and transitions: the contact center is the endpoint
  plus native-domain radial jitter below 10 units. Normal alpha follows
  `1,.8,.6,.4,.2`; weak/selected sibling branches change fade or scale but do
  not change wrapper bias.
- Downstream consumers/callees: `ZAnimLit` follows the child for outbound
  Region light enrollment while its inherited `Puppet` root enters the shared
  painter with `worldY=contactY`, `sortBias=50`. The child draw is self-lit and
  bypasses inbound Region tint.
- Sibling systems sharing ownership or data: body `ZAnimSplit`, source
  `Anim_SpellGlow`, Mage direct/embedded contacts, Fire/Ether `ZAnimLit`
  impacts, Earth wrappers, StormCloud, ElectricBurn, and Ball Lightning are
  dispositioned above.
- Entry, interruption, reset, and teardown: release stops new births; each
  contact expires after its branch-specific fade; scene/run reset removes the
  semantic transient and its view. The bias is immutable construction/render
  metadata and owns no tick or network state.

## Recovered behavioral contract

- Timing: preserve the existing per-held-tick birth and five-age normal or
  shortened weak/chain fade. Painter bias does not alter clocks.
- Geometry and coordinate space: retain the contact's exact jittered world
  center. Do not move its pixels or replace target attachment with a screen
  overlay.
- Painter order: submit the contact root with native `sortBias=50` through the
  existing `trunc(worldY)+trunc(sortBias)` queue. Body and source remain at
  zero bias. For a zero-attachment target, the `-20` target lift plus sub-10
  jitter and `+50` bias places the contact's row strictly after the struck
  target while retaining ordinary occlusion against sufficiently later world
  residents.
- Lighting and assets: the same contact root continues to draw records
  `110/1836..1839` additively and publish the existing jittered outbound light.
  The number 50 must never be reused as radius or raster distance.
- Input/network authority: no target selection, contact damage, transient id,
  snapshot, protocol, RNG, audio, or replication change.

## Confidence and open questions

- Confirmed: native field/address, world-queue ownership, exact bias, complete
  factory/class xref membership, web omission, target Y lift, and shared
  painter-row formula.
- Inferred: none required for the implementation.
- Unknowns: exact process-global RNG stream identity remains the already named
  browser presentation substitution. It cannot affect the fixed bias or its
  ordering guarantee.

## Web implementation consequence

- Correct owner/module: expose the recovered Air contact painter bias beside
  the Air-native render constants and consume it only for the contact root in
  `AirPrimarySpellView`.
- Shared model change: all player-Air endpoint variants receive the one native
  rule automatically; no target-type or scene branch is permitted.
- Stock behavior preserved: the contact stays a separately depth-sorted world
  root. “On top” means the native `+50` row bias over its struck target, not a
  post-world/HUD z-index that would overpaint every later resident.
- Browser-specific approximation: none.
- Obsolete path to remove: the contact root's hard-coded zero bias. Body and
  source zero-bias paths remain authoritative.

## Validation contract

- Focused automated test: fail first on the current zero-bias root, then pin
  `+50` for normal, weak, targeted, chained-shaped, and no-target Air
  transients while body/source remain zero.
- Painter integration test: feed a Gravestone/static root and enemy/dynamic
  root together with deterministic Air contacts through
  `buildBoneyardPainterOrder`; require each contact to paint after its struck
  root and before a resident whose native row is later than contact+50.
- Playwright journey: physically cast Air into both a generated Gravestone and
  a live enemy in `/game`; capture the active corona plus the semantic
  Gravestone target or authoritative enemy damage edge while the effect is
  live, with empty page/console error arrays. The focused painter integration
  test, rather than a browser-only diagnostic field, owns the exact contact /
  target / later-resident queue comparison.
- Canonical acceptance: `./scripts/validate.sh` and final Mac mini focused
  tests/browser journey on the exact tree.

## Implementation validation receipt

Captured on 2026-08-16. The focused and browser receipts were first taken from
the Website worktree based on `fd0e784092edfdd6c53cec9f55a2d69b22614ddb`.
Before publication, the focused four-file change was rebased without conflict
onto `8d2fb1a6e4fced16eaf78dcb72f0d67be1d7ebc4`; the final canonical receipt
below is from that rebased tree.

- Red proof: the focused Air file initially passed 10 of 12 tests and failed
  exactly the new root-bias and target-order assertions: all three roots still
  exposed zero bias and the contact did not sort after the enemy.
- Focused green proof: `primary-spell-air-native.test.ts` passes 12 of 12. It
  pins contact `sortBias=50` for normal, weak, targeted, and no-target views,
  keeps body/source at zero, and sends enemy, Gravestone, contact, and a later
  resident through the real Boneyard painter queue.
- Canonical Mac mini gate: `./scripts/validate.sh` exited 0 on macOS 26.4.1
  arm64 with Node 22.17.0, npm 10.9.2, and .NET SDK 10.0.302. Dependency
  restore, backend build/contracts/formatting, frontend lint and tests, desktop
  tests, production build, and production-media policy all passed.
- Supplemental Windows/WSL gate: backend, contracts, formatting, lint, and the
  modified Air tests passed. The broad frontend run reached 816 of 817 passing;
  the unchanged `native-enemy-assets.test.ts` projectile-preload census then
  hit Vite's 60-second module-transport timeout after 1,102,304 ms. The same
  complete gate passed on the canonical Mac tree.
- Gravestone browser receipt: the real `/game` Air smoke acquired
  `scenery:object-335`, rendered five live Air transients, captured
  `solomon-primary-air-boneyard-target.png`, emitted `status: ok`, and reported
  no page or console errors.
- Enemy browser receipt: a focused path through the existing deterministic
  multiplayer combat harness struck live actor `7`, reducing health from `2.5`
  to `2.485933593748483`. The captured frame at tick `10071.280000000446`
  contained two Air transients and hit flash `0.5540000000597501`; both browser
  error arrays were empty. Visual inspection of
  `solomon-dark-multiplayer-enemy-hit.png` and the Gravestone capture confirmed
  the additive contact corona paints over the struck art. The harness emitted
  `status: ok`; its existing Playwright cleanup remained open afterward and
  the task-owned process was terminated only after the receipt and screenshot
  were complete.
- The temporary focused browser-only flag used to bypass unrelated level-up
  and shield coverage was removed after capture. Final scope is four files:
  this ledger, the Air-native constants, the Air view, and the Air regression
  test. `git diff --check` passes.

## Production verification follow-up — 2026-08-16

The first live audit found production healthy at Website revision
`6826e62bc981c53b7c1f9800a6de1c97c6da18db`, with `e68372a9617aef51f241f85f0c519d701c8c8e4d`
in its ancestry. The installed deployment worker matched current `origin/main`,
its last-success receipt named the same deployed revision, and the Website/game
services plus Caddy were active with zero restarts. SQLite integrity was `ok`,
the public and loopback `/game` routes returned 200, and the public index hash
matched the deployed artifact. The Website unit is named
`solomon-dark-revived.service`; it serves the release and API on loopback port
5220 behind Caddy. There is no unit named `solomon-dark-website.service`. The
supervisor reported protocol `solomon-dark/29` with zero sessions and zero
lobbies before acceptance.

The first Mac mini production Air run exposed an acceptance-harness defect,
not a game or deployment defect. `smoke-primary-spells.mjs` reached the live Hub
and cast Air, then attempted to import
`/src/game/core-kernels/primary-spells.ts` inside the browser. The built site
correctly does not publish Vite source modules, so Chrome rejected that import
before the Boneyard target assertion. The provisioned production session
retired immediately; five successive supervisor samples remained at zero
sessions and zero lobbies.

The permanent repair is limited to the smoke owner. Browser pose evidence must
come from the renderer-owned `__primarySpellPoseEvents` already captured by the
journey, so built and development bundles use the same observable contract. The
Gravestone leg records the loaded generated Boneyard, crosses the real entry
Gate, and aims at visible type-2029 objects instead of blindly sweeping across a
closed Fence. A temporary acceptance-only enemy driver additionally crossed the
Gate, activated the real Solomon/wave lifecycle, aimed at a live rendered actor,
retained the authoritative `enemy:*` target id, observed its health decrease
while Air contacts remained live, and captured the frame with empty browser
error arrays. The exact target/contact/later-resident depth inequality remains
owned by the focused painter test; the production browser journey owns deployed
bundle, target membership, live damage, audio, presentation, and visual evidence.

The repaired smoke passed a supplemental WSL production preflight against that
same deployed revision. Gravestone mode acquired `scenery:object-195`, retained
five rendered Air contacts, emitted no browser errors, and captured a 1600x900
PNG with SHA-256
`69a31ed69c060952cd30dcb3dedbe4832986dd95582daed36920a4677f3b3d27`.
Enemy mode crossed the generated Gate, contacted Solomon, escaped during the
opening, and kept a collision-independent movement lane active while aiming so
the ten stock opening Skeletons could not turn a visual acceptance wait into a
death test. It acquired `enemy:3`, reduced health from `2.5` to
`0.9248046875`, retained five rendered Air contacts in the captured frame,
reported no page or console errors, and wrote a 1600x900 PNG with SHA-256
`63419e8d9a27738d86c6f7924b3e727c17177c4a2006727068d12bbfa1c49e15`.
Visual inspection shows the additive contact disk over the target art in both
captures. The supervisor returned to zero sessions and zero lobbies after each
attempt. These are useful live-production preflights, but the required final
acceptance remains repeated runs on the Mac mini and the exact published tree.

The Mac mini then completed three consecutive generated-Gravestone production
runs on macOS 26.4.1 with Chrome 151. Each run crossed its generated Gate,
acquired a real scenery target (`scenery:object-368`, `scenery:object-23`, and
`scenery:object-45`), retained five rendered Air contacts, and reported no page
or console errors. The three 1600x900 target captures have SHA-256 values
`97e74e6e7a353b2b811c7122a1a9e23b3ccb3b7411300c47aa4fb4406401d6fb`,
`d3446515edf4b7fdbe067e0d06b8024323eb1cbbf5ea2a8865396f4cc69d6d9b`,
and `d7d7bec08112a45cb45f1ea0d1b496cd15bcbc4f9c217753cdc2ca0dd1645406`.

The temporary enemy driver first exhausted one 120-second generated-scene
navigation budget; that attempt produced no target capture and is not counted.
The diagnostic rerun then passed, followed by three consecutive clean Mac runs.
Those three acquired `enemy:2`, `enemy:2`, and `enemy:4`; reduced health from
`2.5` to `2.297054687514901`, `2.120249999985094`, and
`2.302554687485099`; observed `hitFlash=1` with five live Air contacts; and
reported empty browser-error arrays. Their target-capture SHA-256 values are
`470b9812cadfc3e87661ef9d887884e18059e61d777990ef8e16f0eb670b7697`,
`34957864520226e5aa94b63812a1f40cc2e80e0dc27dc52a1b08b2a7269bdbc5`,
and `4536ddd78cb4ab95921e9aa03a4e5fa0576e530d253b7d24f7997fbaa12beee9`.
Visual inspection of all six counted frames confirms that the additive contact
corona paints over the struck Gravestone or Skeleton art while remaining in the
world painter. The supervisor returned to zero sessions and zero lobbies after
the sequence. The temporary enemy driver was removed after capture; the final
permanent smoke change contains only the built-bundle pose repair, deterministic
generated-Gravestone targeting/Gate traversal, and failure diagnostics.

The first run from the trimmed exact candidate completed every gameplay and
visual assertion (`scenery:object-23`, five live contacts, and no browser
errors), saved its target frame, and retired its production session, but the Mac
Node process retained an `fsevents` handle after Chrome closed. That manually
terminated attempt is not counted. A process sample identified the idle libuv
loop and watcher; the smoke now closes its owned Playwright context before its
owned browser, matching the repository's multiplayer-smoke teardown order.
The first WSL teardown-repair check then exposed a random-layout Gate timeout:
the movement helper published a zero-input `blur` but did not restore page focus
before pressing the crossing key. That attempt never cast and is not counted.
Restoring focus at the same edge used by the established Gate drivers produced
three consecutive clean production runs against `scenery:object-18`,
`scenery:object-368`, and `scenery:object-23`; all three rendered five contacts,
reported no browser errors, exited normally, and retired their sessions.

The corrected behavior-bearing candidate
`af7fe2eb3cd89c71341fac7a2f652c9835282e14` then passed three consecutive Mac
mini production runs with normal teardown. It crossed three independently
generated Gates, acquired `scenery:object-381`, `scenery:object-30`, and
`scenery:object-21`, retained five live Air contacts in every capture, and
reported empty page/console error arrays. The target-frame SHA-256 values are
`47a90b3b62c0b9f599aa27ffc7ea932010ac73168181649192885a27f423593c`,
`c9b15e1e71c30d12fc957d9897b11c59e5ddb13a9242cda395d2805c8395ab82`,
and `8b79f8402d76ccedf8a006c85e6903fe559f451d6125d79d83801231ea863675`.
Visual inspection confirms that the contact corona paints in front of each
struck Gravestone while the source/body remain world-sorted. No task-owned
Chrome or smoke process remained, and the supervisor returned to zero sessions
and zero lobbies.

Publication follow-up on 2026-08-20 pushed
`4ea09a35015235f5cac54ca5be687fc6b6e826ad` to `main`. GitHub Validate run
`32360415035` completed successfully, and the independent deployment worker
validated the same commit before cutting over production. The live revision and
worker last-success receipt both named that SHA; `solomon-dark-revived.service`,
`solomon-dark-game.service`, and Caddy were active with zero restarts; protocol
29 reported zero sessions/lobbies; live and backup SQLite integrity checks were
`ok`; and public plus loopback root/`/game` returned 200. The deployed, loopback,
and public index bodies all had SHA-256
`d437b78dfed59e6375f87af52e265b7588ced54342d6146a7a37ed6394fefeeb`.
The cutover retained rollback
`/opt/solomon-dark-revived.rollback-pre-4ea09a350152-20260820T104851Z` and backup
`/var/backups/solomon-dark-revived/pre-4ea09a350152-20260820T104851Z/sdr.db`.

The first final-production enemy capture completed gameplay with `status: ok`,
authoritative damage, five live contacts, and no browser errors, but reproduced
the already diagnosed context-close hang in the retained acceptance-only driver;
it was manually terminated and is not counted. After applying the same explicit
context teardown, the next attempt exited normally but exposed a second harness
race: the five-tick transient array still contained an older `enemy:1` contact
after the authoritative held target moved to `enemy:2`. The scanner had selected
that oldest contact and compared it with the current cast target. Permanent and
acceptance-only Air scanners now choose the newest contact whose target matches
the same wire frame's authoritative `primaryCast.targetId`; neither failed
attempt is treated as visual acceptance.

The behavior-bearing final production revision was then rebased over the
concurrent Game Over work and published as
`81f8e825a1ee8573d1b17c4935780a0efc050b01`. GitHub Validate run
`32361677050` succeeded. The independent worker validated and built the same
tree, deferred its first cutover when one unrelated browser session became
active, retained the validated artifact, and deployed it after that session
closed naturally. Live revision, `origin/main`, `git ls-remote`, and the worker
receipt agreed; protocol 30 reported zero sessions/lobbies; Website, game, and
Caddy services were active with zero restarts; live and backup database checks
were `ok`; all public/loopback routes returned 200; and all three index bodies
had SHA-256
`3aa64401d71302e1013d85e206b67ed532d5e2fb3b37537797a4369b0ca53e5f`.
The worker retained rollback
`/opt/solomon-dark-revived.rollback-pre-81f8e825a1ee-20260820T110529Z` and backup
`/var/backups/solomon-dark-revived/pre-81f8e825a1ee-20260820T110529Z/sdr.db`.

Three consecutive exact-tree Mac Gravestone journeys on that production
revision acquired `scenery:object-43`, `scenery:object-45`, and
`scenery:object-45`, rendered five Air contacts, emitted no browser errors, and
exited normally. Their target-frame SHA-256 values are
`18c16ae0704e3bc6de4c00a83e87477cecd918af3d22f1a650aca9408d2f0078`,
`f715157ec26063706e01a07ea7fe4adf126e544882dd4d19e57e6a91100746c2`,
and `0abfc0927571d3fa943fee381a6f8118e1960760474199c4082bbb8993f59553`.

The acceptance-only enemy route was hardened without shipping its temporary
driver: collision-aware waypoints now begin only after a full player radius plus
100 units of dynamic Gate clearance, key-up plus the renderer/velocity-settle
interval replaces a synthetic browser `blur`, and teardown has an owned bound
after Chrome exits. Earlier Gate/route-bound attempts never reached an enemy and
are not counted. The final three consecutive Mac runs traversed 19, 10, and 10
route nodes; acquired `enemy:10`, `enemy:5`, and `enemy:5`; reduced health from
`2.5` to `2.159499999955301`, `2.4611992187320695`, and
`2.215859375000002`; retained five Air contacts with hit flash
`1`, `0.5160000002384549`, and `1`; emitted no browser errors; and exited
normally. Their target-frame SHA-256 values are
`46274b52fe36305d67196ddfbb098054efc8e860f6a65af3eaf0c9e46dc0d2d2`,
`2dcdb3fddd241c25ab626c55a75da37ebfc4f0c2c57aaab625c2c87e1a603774`,
and `0a595399bc6c1cd47bb38f48c9ffe6d08114a3533a43bda085139b5ba59da83f`.
Visual inspection of all six frames confirms the additive corona is in front of
the struck Gravestone or Skeleton while body/source retain world ownership.
Teardown left zero production sessions/lobbies and no task-owned Mac browser or
smoke process.

After concurrent enemy-presentation work advanced production to
`97cf4f4f39c317285d035ae228bbe7fc2174d837`, the rebased smoke repeated both
sets on that newer renderer. Three Gravestone runs acquired
`scenery:object-36`, `scenery:object-18`, and `scenery:object-45`, with exact
current-target agreement, five contacts, zero errors, and target-frame SHA-256
values
`a4dae30ff2a0cb80890bdd5255467859f84e02e3238f425108fe2bd62007210c`,
`8abe5e2b651b75aa3a47e2b8a9b0d8f2ae4d0f48a9b38c91619e0391befa262b`,
and `e85e734565d3a3ccfbceb328abf18ff898801d9b0d46fe4e923532c4153569bb`.
Three enemy runs traversed 26, 26, and 44 collision-safe nodes; acquired
`enemy:6`, `enemy:8`, and `enemy:10`; reduced health from `2.5` to
`2.342804687544708`, `2.141000000014901`, and `2.448566406223108`; retained
five contacts with hit flash `1`, `1`, and `0.6840000003576279`; emitted zero
errors; and exited normally. Their target-frame SHA-256 values are
`cfb07c848fe183639977cf197654e4237a9d56b366cd0ad6d5429192c2308d0e`,
`41ae690a01dbbaff0e5b97007cbc5bc3c6224f9d0c5447ef7f5dd8b5124e8a08`,
and `0737e5f626120e3f8129dd5a1e815b618f94b5cd02baa59c83d19da4f11af469`.
Visual inspection again confirms contact-over-target painter order in all six
frames. Task-owned journeys retired to zero sessions/lobbies; unrelated Mac
browser activity remained untouched.

On the subsequent first-frame-lighting revision, a third Gravestone journey
again completed with `status: ok`, exact current-target agreement, five
contacts, and a saved frame, but Playwright's `browser.close()` promise remained
pending after both Chrome and the production session had already gone away. The
manually terminated process is not counted. The permanent CLI now bounds both
owned close promises, flushes its receipt, and exits only after that cleanup
boundary; behavioral exceptions still bypass the success exit and remain
nonzero.

With that boundary in place, three consecutive Gravestone runs on the
lighting/runtime revision `83daf5d4f57432a064e241755c13135533d954da`
acquired `scenery:object-36`, `scenery:object-16`, and `scenery:object-16`,
each with current-target equality, five contacts, zero errors, and normal exit.
Their target-frame SHA-256 values are
`91c3433b7647561abbd639c2d14ea56bf15e5421ca218d6dcd61b79734b29eb0`,
`dfe968ed175535ee8a7871d16ca443d29bb8f2549908614911c4674b17930161`,
and `e5c4c0301409ac7c8314d3258ea4f5c39434b9285baae5218d090e974012effc`.
Three enemy runs traversed 11, 10, and 18 nodes; acquired `enemy:2`, `enemy:2`,
and `enemy:1`; reduced health from `2.5` to `2.4470078124525045`,
`2.219390624985101`, and `2.311695312485108`; retained five contacts with hit
flash `0.532000000476819`, `1`, and `1`; emitted zero errors; and exited
normally. Their target-frame SHA-256 values are
`d93a30861f87e5d6493e7d3aaa25f5b2e967267a906586c815c97a8437471a91`,
`d3e82ef5a574cd84cd2a9d97f9c3b474c09017ac22b0a987e1cf6d8b712597c4`,
and `d71b70f18b672beded03ed51c609b8bb31ae491b6bfa859d45f27653dfc1a812`.
All six inspected frames preserve contact-over-target order, and the supervisor
returned to zero sessions/lobbies.
