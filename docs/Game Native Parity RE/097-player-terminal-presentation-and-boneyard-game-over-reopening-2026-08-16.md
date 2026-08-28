# Player terminal presentation and Boneyard Game Over reopening — 2026-08-16

## Why the prior parity claim is reopened

The 2026-08-14 pass recovered the death-frame thresholds and the tick-1000
Game Over edge, but stopped one ownership layer too early. The asset
extractor treated `Clothes[76..99]` as an untinted terminal attachment even
though native item virtuals own that range as robe style zero. It omitted the
other robe styles, every equipped-hat branch, and the terminal black corpse
shadow. The burst retained a named web approximation after its constructor and
tick were recoverable. Game Over then used one increasing 150-tick black fade,
which is the opposite direction from the stock entry recurrence and erased the
authored clear hold. The all-dead acknowledgement also destroyed the Boneyard
immediately, omitting the stock 400-tick exit fade.

The process failure was accepting address-range adjacency and a black capture
as semantic proof. A second audit also found that the recovered internal
tick-1000 acceptance write had been mistranslated into a host click gate, and
that browser acceptance clicked the invisible overlay instead of falsifying
that invented authority. This reopening follows the item virtuals,
sprite-array selectors, object fields, tick recurrence, render order, and
surface transition gate through their actual consumers before changing the web
renderer.

## Evidence and confidence

- Retail artifact: 4,723,200-byte `SolomonDark.exe`, SHA-256
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
- Static owners: `PlayerWizard::Render` `FUN_00538550`, death tick
  `FUN_00533520`, robe render virtual `FUN_00578510`, hat render virtual
  `FUN_005758F0`, `Anim_Fade` constructor/tick `FUN_00452E20` /
  `FUN_00452F20`, Game Over constructor/render/tick `FUN_005CAD40` /
  `FUN_005C9030` / `FUN_005CF4F0`.
- Live corroboration: the loaded Clothes singleton exposed three robe style
  arrays, four hat style arrays, the six-record special hat bank, and the exact
  range membership listed below. Existing native normal-mode and Boneyard
  Game Over captures corroborate the semantic branch: normal mode paints the
  title/prompt; Boneyard is fade-only and reveals the resident Arena.
- Fresh last-player corroboration: an isolated one-participant retail run on
  exact loader source `a816dba38a9219a44fe479e1259e8c9900d8fa55` sampled the
  native death drive while GameOver already owned the surface. The drive stayed
  one and PlayerWizard `+0x1BC` advanced monotonically from 3 through 201 over
  33 read-only samples; the GameOver object later reported counter 637 in the
  Boneyard fade-only branch. The surface freezes interaction, not the corpse
  clock.
- Confidence: high for membership, selection, ordering, transforms, fixed
  recurrences, and atlas records. The shared retail RNG stream position is not
  portable to a host-authoritative web client; only its per-draw bounds remain
  a named deterministic presentation policy.

## Causal trace and state machines

```text
HP <= -10 -> lethal-pending -> one death epoch at tick 0
  -> hide living robe/staff/head/orb passes
  -> one held staff/wand bouncer
  -> corpse frame 0 through tick 152
  -> frame 1 at 153, frame 2 at 156
  -> frame 3 + black y+4 corpse shadow + 18-sprite additive burst at 159
  -> corpse loses grid collision and receives sort bias -1000
  -> surviving peers keep the run active; dead local player spectates

last eligible player enters the death epoch
  -> one host-authored Game Over event for the run nonce
  -> freeze Arena gameplay but continue every dying player's corpse clock
  -> frames 1/2/3 and the tick-159 burst still occur beneath Game Over
  -> entry black 1.0 - 0.025/tick, clear at tick 40
  -> clear hold; GameOver::Tick synthesizes acceptance at tick 1000
  -> the same tick starts exit alpha at 0.0025; no client message exists
  -> exact black at exit tick 400
  -> following fixed tick retires the run into the web retained-loadout route
```

Death presentation state is `(runId, playerId, deathEpoch, deathTick)`. The
corpse is the same player actor, not a spawned corpse entity. Burst and weapon
drop are one-shot presentation owners keyed to the crossing of that epoch;
late subscribers seed their crossing trackers and do not replay births. Game
Over state is `(runId, eventId, gameOverTicks, exitTicks|null)`. The host's
fixed simulation clock changes `exitTicks` automatically at tick 1000; every
client renders the replicated recurrence. There is no Game Over input message,
host button, guest wait state, or acknowledgement replay surface.

## Corpse compositor membership

The six-facing index is `frame * 6 + floor((headingIndex + 2) / 4) mod 6`.
The normal hat retains the 24-way integer `headingIndex`.

| Ordered member | Native records/selector | Web ownership |
|---|---|---|
| robe style primary | `76..99`, `100..123`, `124..147`; item image `0..2` | raw 4-by-6 texture bank, item/element primary tint |
| robe style secondary | `148..171`, `172..195`, `196..219`; item image `0..2` | raw 4-by-6 texture bank, item/element secondary tint |
| robe fixed primary A/B | `220..243`, `268..291` | two raw 4-by-6 passes in native order |
| robe fixed secondary A/B | `244..267`, `292..315` | two raw 4-by-6 passes in native order |
| actor corpse primary/secondary | `28..51`, then `52..75` | existing element-colored body sheet |
| normal hat primary | `316..339`, `340..363`, `364..387`, `388..411` | selected 24-way raw strip at death anchor |
| normal hat secondary | `412..435` for selectors `0..2`; `436..459` for selector `3` | selected 24-way raw strip at death anchor |
| selector-3 terminal hat | primary `16..21`, secondary `22..27` | six-facing strips at actor origin, frame 3 only |
| terminal shadow | repeat every selected pass black at `(0,+4)` | separate shadow compositor beneath normal pass |

The death anchor is point zero of `Clothes[76 + corpseIndex]` plus `(0,25)`.
The robe helper always adds all four fixed ranges after its two style ranges.
Item constructors default both colors to white; explicit native recipe colors
replace only the declared fields. With no equipped robe/hat, selector zero and
the element descriptor's primary/secondary palette are used. The stock
new-character Hat, Robe, and Staff are the native recipe-UID-0 loadout, which
the web economy represents with `recipeIndex: null`; while equipped they own
the same selector-zero element-palette Hat/Robe and selector-zero Staff death
appearance as the absent override. Non-null equipped recipe indices select
their catalog image and colors; no name-based inference or fallback selector
is legal.

## Tick-159 burst contract

The burst owns exactly 18 additive BadGuys record-10 sprites. Base angles are
`0,20,...,340` degrees; native sampling adds signed jitter bounded by 8 degrees,
spawn radius `15 + RandomInt(5)`, and speed `3 + RandomInt(1)`. Initial scale is
`(0.5,0.2)`, color is `(0.5,0.5,0.5,1)`, velocity multiplies by `0.9` after
each move, and alpha subtracts `0.1` before each move. Age zero therefore draws
full alpha at the radial spawn offset; ages one through nine use alpha
`0.9..0.1` and the damped geometric displacement; age ten is retired. The web
seed stays stable per `(run, player, death epoch)` so render clients agree,
while the constants, count, recurrence, and consumption edge are exact.

## Held staff/wand bouncer contract

The death transition creates exactly one independently registered weapon
bouncer. Staff image selectors use `Clothes[5..10]`; the wand uses
`Clothes[15]`. Native recipes map staff 8/18/33/34 to selectors 1/3/0/2 and
wand 2/13/28/41..45 to selectors 2/4/3/5. The absent web equipment override
uses the native default staff selector zero.

The bouncer copies the death origin and heading. Horizontal speed is `1.5`,
radial placement is `15 + RandomFloat(10)`, perspective height is
`-RandomFloat(20)`, and both vertical velocity and its retained bounce seed
start at `-(2 + RandomFloat(3))`. Rotation starts in `[0,360)` with angular
speed `[1,11)`. Airborne motion runs on two of every three world ticks with
gravity `0.4`. On ground contact the retained bounce seed, not the
gravity-adjusted impact velocity, is multiplied by `0.65` and copied to the
new vertical velocity; angular speed is rerolled, and a fresh 50-percent branch
damps horizontal velocity by `0.65`. Motion settles when the new vertical
velocity is greater than `-0.75`. The registered item persists for the terminal
surface and draws a black shadow at Y plus 2 with Y scale `0.75`, then the
rotated normal sprite. The Website reconstructs this independent object from
`(run, player, death epoch, deathTick)` and freezes its copied origin. Its
stable per-epoch RNG samples/update phase are the named deterministic policy
for retail's unavailable process-global stream; the ranges, recurrence,
settlement, art, shadow, painter ownership, and one-shot lifecycle are closed.

## Game Over membership and branch dispositions

| Member/variant | Disposition | Reason/artifact and next step |
|---|---|---|
| Boneyard entry overlay, clear hold, automatic tick-1000 acceptance, exit overlay, frozen Arena gameplay, live terminal-player clocks | `exact-ported` | protocol 30 carries the nullable exit clock and death ticks; the server freezes world dynamics but advances dying players through frame 3, starts exit at tick 1000 without input, and resets only on the fixed tick after exit 400; display-time sampling presents both 100 Hz clocks |
| normal story GAME/OVER atlas and prompt | `out-of-system` | `/game` launches the Boneyard survival route with the native mode flag's fade-only branch; normal story UI is not reachable in this web product surface |
| native Hall of Fame/MainMenu post-run lineage | `out-of-system` | the accepted Website product deviation returns to retained-choice Create/loadout after the exact Boneyard fade completes |
| fresh post-Game-Over player generation | `exact-ported` | superseding 2026-08-26 correction resets level/XP, learned ranks/order, selections, and quickbar after the retained choice is confirmed |

## Death-member pre-implementation dispositions

| Member/variant | Disposition | Reason/artifact and next step |
|---|---|---|
| five element bodies, four frames, six facings | `verified-already-at-parity` | thresholds, body records, element palettes, and actor position already match focused tests |
| robe selectors/colors/fixed layers, hats/anchors/special terminal bank, terminal shadow | `exact-ported` | raw native banks, point-zero anchor table, recipe-owned tints, selector-three terminal switch, ordered color pass, and complete black pass are renderer-owned and hash-pinned |
| 18-member additive burst mechanics | `exact-ported` | count, record, radial domains, scale, alpha, damping, timing, and one-shot edge are exact |
| burst process-global RNG cursor | `blocked-by-platform` | the browser has no access to retail's shared process-global draw position; the documented stable death-epoch seed is an explicit deterministic authority policy |
| held staff/wand one-shot bouncer mechanics | `exact-ported` | art selection, copied origin, independent painter/shadow, retained-seed bounce recurrence, settlement, and epoch ownership are exact |
| bouncer process-global RNG cursor and absolute world-tick phase | `blocked-by-platform` | those process-global inputs do not exist in the host-authoritative browser runtime; stable per-epoch samples and phase preserve every recovered domain and recurrence |
| collision disable and `-1000` sort bias at tick 159 | `verified-already-at-parity` | combat and renderer contracts already pin both edges |
| dead input/cast suppression and living-peer continuation | `verified-already-at-parity` | server authority rejects dead input while active peers continue |
| fullscreen red Arena blend | `out-of-system` | the browser does not carry the executable's Arena red-overlay mechanism; the MP-mod contract instead keeps native storage below the red threshold throughout grace and transfers camera ownership only at five-second expiry |
| all-dead event authority | `verified-already-at-parity` | event is host-authored, run/event scoped, and replay rejected; only its visual/exit lifecycle is reopened |

## Validation contract

- Extractor tests pin every Clothes range, output geometry, death-anchor table,
  robe/hat selector count, and removal of the false attachment sheet.
- Presentation tests cover all four frame boundaries, six corpse facings,
  24 normal-hat headings, every robe/hat recipe selector and color default,
  selector-three frame-2/frame-3 split, full ordered shadow membership, and
  lighting-tint multiplication.
- Burst tests pin count 18, record 10, native bounds, anisotropic scale,
  alpha/damping samples at ages 0/1/9/10, one crossing per epoch, and no
  late-subscription replay.
- Lifecycle/protocol tests pin Game Over entry alphas at 0/1/39/40, automatic
  acceptance and first exit step at 999/1000, exit at 1/399/400, one fully
  black terminal snapshot, transition on the following fixed tick, frozen
  Boneyard dynamics with advancing dying-player clocks, absence of every
  acknowledgement message/API/button, and a clean retained-loadout reset.
- Browser acceptance must show all four corpse frames and terminal shadow for
  the last player beneath Game Over, a non-opaque Boneyard during the clear
  hold, the input-free tick-1000 transition, the complete clear-to-black exit,
  and the retained-choice loadout with no page
  or console errors. Canonical acceptance remains `./scripts/validate.sh` and
  the final production browser receipt on the Mac mini exact tree.

## Validation receipts

The following receipt belongs to the superseded implementation and is retained
only as diagnostic history. It is not acceptance for the corrected lifecycle:
the browser sampled only the first and terminal corpse states, froze the last
player at death tick zero, and explicitly clicked the invented Game Over input
surface. Those assertions could pass while both reported bugs remained.

The superseded implementation tree passed `./scripts/validate.sh` on WSL before
the receipt-only smoke-harness and ledger edits. The final exact source tree
then passed the same gate on the Mac mini, including all 24 backend contracts,
the complete Boneyard/frontend suite, auxiliary and desktop suites, lint and
architecture boundaries, the production builds, and the media-policy gate.
Lint reported only the repository's eight pre-existing Fast Refresh warnings.
The Mac tree was checksum-identical to the isolated source before acceptance.
The Mac was `arm64` macOS `26.4.1` with Node `22.17.0`, npm `10.9.2`, .NET
`10.0.302`, and Google Chrome `151.0.7922.138`.

The focused command
`npm --prefix frontend run smoke:game:player-death-game-over` exited zero on
that Mac tree. It used two real, isolated browser clients in one owned Chrome
process and one loopback authoritative host. The players began 110.54 pixels
apart; the first browser observed dying tick 5 with one weapon and no burst,
then spectator handoff at death tick 169 with the persistent weapon after the
short-lived burst had retired. The terminal snapshots retained two weapons,
froze the Boneyard with a null exit clock at Game Over tick 5, rejected input
before tick 1000, and accepted one host acknowledgement. The measured exit
sample was alpha `0.2575` at tick `103`; the host then alone confirmed the
retained loadout and both clients returned to the same Hub. Both page- and
console-error arrays were empty.

The inspected Mac artifacts are under
`/Users/jarrett/codex-acceptance/player-death-game-over-publish-artifacts-20260816-v27-contexts2/browser`:

- dying corpse and weapon:
  `solomon-dark-multiplayer-death-animation.png`, SHA-256
  `bc37d6c50720dca0843be7d0e5daf38b06fc4a83df8b5dfaf48d4d226e5202a9`;
- terminal corpse after spectator handoff:
  `solomon-dark-multiplayer-first-death.png`, SHA-256
  `68da3e784ecff09f961d299d2adaf668054a27aecd154e0eed741ca4e805ef12`;
- fade-only Boneyard Game Over entry and exit:
  `solomon-dark-multiplayer-game-over.png`, SHA-256
  `1d0476f536398919f3812297369661602a8e795b7a24ac4a20bb2803e104a883`,
  and `solomon-dark-multiplayer-game-over-exit.png`, SHA-256
  `5a177ce8c9a6919a6454c548ae8bea833c1c4131c8dcbcd7c666e85fda7d7390`;
- retained loadout and returned Hub:
  `solomon-dark-multiplayer-loadout.png`, SHA-256
  `ad564d0d1d722d8de3581bd14374a76d8071a58745dc9af2d73929f1de799256`,
  and `solomon-dark-multiplayer-returned-hub.png`, SHA-256
  `1a4a767b563ced905097bfa229012b1947f75dd2765eeea2c2343646b11602b0`.

Visual inspection confirms that the corpse is independently readable from the
survivor, the held weapon becomes its own grounded object, the terminal corpse
retains the complete equipment silhouette and black offset pass, the Boneyard
branch displays no normal-story title/prompt, the exit reveals the frozen
terminal image, and the retained loadout/Hub transition is intact. An earlier
broad WSL attempt exhausted the VM's swap under two Chrome processes, and an
earlier broad Mac run stalled in the unrelated enemy-kill/level-up prelude;
neither is counted as acceptance. Two attempts to repeat the final WSL gate
were externally terminated during backend contract enumeration while all 3
GiB of WSL swap remained consumed; neither reported a failed assertion and
neither is counted as a gate receipt. Two post-rebase Mac receipts exposed a
smoke-harness browser-close stall after all behavior assertions had passed;
they are likewise not counted. The harness now gives both real clients
isolated browser contexts in one owned browser, then closes both contexts and
owned servers before that browser. The focused target changes only the lethal
stimulus and keeps every authoritative death, spectator, Game Over, fade, and
return assertion live. Those historical commands exited zero and teardown left
no task-owned browser or listener process, but their behavioral receipt is
invalidated by the native ownership evidence above. Corrected Mac and
production receipts are recorded only after the automatic transition and all
four last-player frames pass.

## Corrected Mac mini acceptance, 2026-08-20

The corrected implementation, tests, smoke harness, and pre-receipt ledger
were committed as `d6f91ba3fd80eb32de29968a550ad275e15b2993`, transferred as
a complete Git bundle, and verified in the fresh detached Mac clone
`/Users/jarrett/codex-acceptance/player-death-game-over-pass2-final-20260820/tree`.
The source bundle SHA-256 was
`5fbdc15c99c6910b6eec2e1057ed14465d2b8ff48c49a4df8f59f3152929649d`.
The clone was clean before and after acceptance. The host was `arm64` macOS
`26.4.1` with Node `22.17.0`, npm `10.9.2`, .NET `10.0.302`, and Google Chrome
`151.0.7922.138`.

`./scripts/validate.sh` exited zero on that exact tree. It passed the Release
backend build with zero warnings/errors, all 24 backend/route contracts, the
formatting and architecture boundaries, lint with only the eight established
Fast Refresh warnings, 122 prerequisite tests, all 939 Boneyard/frontend tests,
5 level-up tests, 6 diagnostics tests, 14 Hub UI tests, 5 desktop tests, both
production builds, and the production media-policy gate. The retained log is
`validate.log`, SHA-256
`70f385f7d7f595b3b5499325b3088c058185850186981b540c48495a435284f2`.

Three independent invocations of
`npm --prefix frontend run smoke:game:player-death-game-over:strict` then
started fresh loopback authorities and fresh two-context Chrome clients. Their
run IDs were `d4ce96a677962fbb256522d064a4cd7e`,
`986198d1944c8de8d0309daefc691b4f`, and
`deed99269d5908167ab9b531c626bec9`. Every first-player and last-player sample
was exactly `[0,1,2,3]`; each frame had nine color layers, frames 0/1/2 had no
death-shadow layers, and frame 3 had all nine. The intermediate samples landed
only inside native tick ranges 153..155 and 156..158. In all three terminal
cases, the last player's clock advanced from frame 0 to frame 3 while the run
was already in Game Over.

No pass exposed a Game Over button or sent an acknowledgement. Each observed
the clear hold below tick 1000, the automatic exit, the exact recurrence
`gameOverTicks == 999 + exitTicks`, and retained-loadout return. Exit samples
were `(102, 0.255)`, `(103, 0.2575)`, and `(102, 0.255)` for
`(exitTicks, alpha)`. All six client error collectors were empty; each run
returned two authenticated players to one Hub. The three complete JSON log
SHA-256 values are, in pass order,
`a38f8981ddb9ec94634c083a17c95fedf007d8efb8e550e983202ec650ed0213`,
`15082a8fc2e64d6f4797bc4a221a06214c66f66c9c66fac16c47af651710f0a5`,
and `440218ed83c881318d2325a9ada9e660df452de3b13ce02b27853a8aaafeeb02`.

The visually inspected third-pass artifacts show the dying pose, grounded
weapon and terminal corpse; the clear resident Arena; the correctly darkening
exit; retained Create/loadout; and the returned shared Hub. The absence of the
normal-story GAME/OVER title and prompt is the recovered Boneyard branch, not
a missing screen. Their SHA-256 values are:

- death animation: `75be94d9ed733c5dec2e6748d32025cd039f5b276a92db0955061590a216d30d`;
- terminal first-player corpse: `1162e16b51b2dbc8a01090069e4be0e57cf27b94118cd3f07253b7425a9384e0`;
- clear Game Over hold: `23d047257629a349f07cbe8aad6f1529aceca19e76cfeed53e0896876d5f1238`;
- Game Over exit: `57cf3ec76edd7caa7edf65ff3438957eba7be8db40235acc0b8b003f9a5b5705`;
- retained loadout: `6ad0f534bd1eb43480123663f9c0b494d5123d12a5b2f76c489c3be6be24a4ec`;
- returned Hub: `c2067d74cbb52faceb5e80f912b2c01a1cca9707ffe316f9106a0d9e46d3637f`.

All task-owned Chrome, Vite, and game-host processes exited after each pass;
the final process census found no command referencing the acceptance root.

## Corrected production acceptance, 2026-08-20

Website commit `e311342643d3d6d78f6b3ae10d6659293922834f` reached `main` by
fast-forward after its rebased implementation and receipt commits reproduced
the pre-rebase stable patch IDs. GitHub Actions run `32360821876` completed
successfully. The independent machine-local deployment worker fetched that
exact commit into its own mirror, reran `./scripts/validate.sh`, built immutable
artifact SHA-256
`ae8b6e9b1789ab5286a7a625754a7c7aa088ddcc9fde8d102ee61f6aa824e486`,
backed up and integrity-checked the SQLite database, and performed the
zero-active-session atomic cutover. Its rollback directory is
`/opt/solomon-dark-revived.rollback-pre-e311342643d3-20260820T105450Z`;
the database backup is
`/var/backups/solomon-dark-revived/pre-e311342643d3-20260820T105450Z/sdr.db`.
After cutover both systemd services were active with zero restarts, the live
database reported `ok`, and the supervisor reported protocol
`solomon-dark/30`.

The first public-path probe provisioned a real
`wss://solomondarker.com/game-sessions/...` endpoint, completed the protocol-30
handshake, and observed authoritative movement from X `950.64` to
`950.9299999991059`. Its log SHA-256 is
`2a82d27de097c9a75fc7d1a3eb1931015520be7f6ad98b5a2c50716254ac4502`.

The decisive production browser journey used the public
`https://solomondarker.com/game` bundle and public provisioned authority from
the Mac mini. Three real clients completed Create and shared Hub/Boneyard;
the mobile client then disconnected cleanly. The two remaining clients crossed
the authored gate, triggered Solomon's hello/laugh/get-him-boys sequence and a
real ten-Skeleton opening, and deliberately cast no damaging spell. Stock enemy
attacks alone reduced both players from live health through the native death
epochs. No server state, damage helper, local host, or debug endpoint was used.

The first player's rendered death samples were frames `[0,1,2,3]` at ticks
`[4,154,156,159]`; the last player's were `[0,1,2,3]` at
`[0,153,156,160]`. Every sample carried nine color layers, only frame 3 carried
the nine shadow layers, and the last player's intermediate frames advanced
while Game Over already owned the run. The fade-only hold was clear at Game
Over tick 162 with a null exit clock. No Game Over button existed. Automatic
exit was observed at exit tick 102, Game Over tick 1101, alpha `0.255`, exactly
matching `102 / 400`. The host alone confirmed the retained loadout and both
players returned to the same Hub. The renderer was WebGL2 at resolution 1,
network pings were 44/30 ms, every host/guest/mobile page and console error
array was empty, and supervisor health returned to zero sessions and zero
lobbies. The complete JSON log SHA-256 is
`fcd77beea411c2732f5d46c6b27a4f034ca240c63e3d3d8af9fe9c91434fe26d`.

Visual inspection of the public production frames confirms the active stock
wave, the layered dying wizard and grounded weapon, the clear fade-only
Boneyard Game Over image, its darker exit sample, retained Create/loadout, and
the shared returned Hub. The relevant SHA-256 values are:

- active Solomon wave: `d099c6bb37c27f47f9b2c2f48e1df2131cf8d259bdef98a08f91f01f0d0a5122`;
- death animation: `3610ddee3a921b392c0e4f7988a09d7a9d389040804b20a7f20beef979856466`;
- clear Game Over hold: `d2d7b1c408060d108d6528af80ea362d973390811e20a45df482252efb6b1bbe`;
- Game Over exit: `55bb3e2c32e9556c989af49488635bf6822fcf2b40e7d700677042255d238ac5`;
- retained loadout: `81aa26890f0d743f5d21668aca28d599af917df8471ed250aab47fe6ce1cb7cf`;
- returned Hub: `1b33b13e4cc47eac6fc14bdcd03398fd965f4bd332260ab575cd73c12579e994`.

The first generic production smoke attempt is not counted: its external test
harness tried to dynamically import a Vite-only `/src/...` oracle after the
deployed Boneyard was already healthy, and production correctly returned no
source module. The decisive journey removed only that external oracle and
added the organic death assertions above; it did not modify the deployed
bundle or authority. This receipt is written afterward, so its commit changes
only this ledger.
