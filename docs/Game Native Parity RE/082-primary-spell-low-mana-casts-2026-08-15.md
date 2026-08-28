# Primary-spell low-mana casts (2026-08-15)

## Reported smell and parity question

At report time, the Website rejected a primary cast whose requested debit
exceeded current MP and stopped sustained casts at zero. Stock visibly emits
weaker versions instead. The parity question was the complete pure-primary
weak-cast system: debit timing and boundary conditions, all five damage/state
branches, their render/light/audio consumers, scene and network ownership, and
every adjacent learned branch whose behavior changes under low mana.

This entry supersedes the bounded insufficient-mana rejection rule recorded
for the first primary-spell slice. Retail primary spells do not reject a cast
when MP is below the requested debit. They spend whatever MP remains, clamp MP
to zero, and materialize a fixed underpowered branch. The branch is selected
from the **post-debit** value: a cast that starts with exactly its cost is also
underpowered, while a cast leaves the normal branch only when MP remains
strictly above zero after payment. Payment belongs to the handler tick that
actually emits or sustains the spell, not the earlier Staff action-start edge.

## System boundary and membership inventory

Native system: the Boolean low-mana branch returned by `0x0052B150` and
consumed by every pure-primary handler. The table records the completed final
disposition and its regression or browser proof.

| Member | Native source | Disposition | Proof / reason |
| --- | --- | --- | --- |
| Shared debit, exact/partial/zero edges, emission-time ownership | `0x0052B150` and five pure-primary callers | `exact-ported` | Authority tests pin all four MP boundaries, emission-time one-shots, and zero-MP held casts. |
| Ether weak projectile, homing, damage, flight alpha, launch audio | `0x0053CFE0`, `0x005E0460`, `0x00535A30` | `exact-ported` | Kernel, renderer, Boneyard combat, audio-order, and zero-MP browser assertions. |
| Fire weak projectile, damage, body-only alpha, unaffected trail/impact, launch audio | `0x0053DC60`, `0x006099C0`, `0x005FDD90`, `0x005E5160` | `exact-ported` | Kernel, renderer, Boneyard combat, audio-order, and zero-MP browser assertions. |
| Air weak contact, ribbons, contact/path lights, shortened fade, loop gain, learned gates | `0x0053F9C0`, `0x00531640`, `0x0045B2C0`, `0x00534510` | `exact-ported` | Kernel, exact renderer/light-plan, combat, audio-gain, and zero-MP browser assertions. |
| Water weak contact, mask, particle count/class/opacity, loop gain, learned gates | `0x00543860`, Normal draw `0x00457720` | `exact-ported` | Kernel, exact Normal-plan, protocol, combat, audio-gain, and zero-MP browser assertions. |
| Earth weak charge freeze, repeated damage-base halves, release finalizer, periodic fizzle | `0x00544C60` and Boulder release path | `exact-ported` | Float32 recurrence, release/contact, audio cadence, and zero-MP browser assertions. |
| Existing normal lanes for Ether, Fire, Air, and Water | same handlers' zero-return branches | `verified-already-at-parity` | Existing primary-spell kernel/render/combat tests and prior browser receipts; focused tests will guard them against regression. |
| Normal Earth release finalizer exposed by the weak-branch trace | Boulder release path | `exact-ported` | Replaces the refuted linear `base*charge` approximation for both normal and weak releases; normal-power regression and browser journeys pin it. |
| Hub visual/audio consumer | general primary-spell presentation and local point audio | `exact-ported` | Five real zero-MP Hub casts expose authoritative wire state to the WebGL/audio probes and preserve full-power presentation. |
| Boneyard visual/audio/damage consumer | Arena spell contact and general presentation | `exact-ported` | Five real zero-MP Boneyard journeys pin presentation; host combat regressions pin half damage, masks, and Earth release damage. |
| Replication and late-join state | authoritative spell/player snapshots | `exact-ported` | Strict protocol-20 shape/version tests plus pre-cast and late-held two-client browser receipts cover all five primaries. |
| Learned effects suppressed by weak primary handlers | Ether pierce/bounce; Fire payload/procs; Air Hurricane/chain/Disintegrate/Stun; Water widen/push/Over/Hail/Permafrost/Cold Aura/Harden | `out-of-system` | Their positive normal-lane implementations are a separate progression-effects system; this pass records and enforces that the weak lane cannot create them. |
| Welded spell handlers sharing the debit helper (`1003..1008`) | `0x005408F0`, `0x00541870`, `0x00542D20`, `0x00545360`, `0x0052BB60`, `0x00545C20` | `out-of-system` | Website base-game casting currently exposes pure primaries only; welded debit/weak rules have distinct handlers and are not inferred from this system. |

No member is blocked by the browser platform: the recovered fixed-tick state,
blend/color multipliers, lights, WAV playback, pitch/gain, collision masks, and
replication are all directly representable.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Preserved retail binary | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | All addresses and constants below refer to the unmodified 0.72.5 executable. | high |
| Shared mana helper | `0x0052B150`, called by pure-primary handlers with a negative cost and `rejectIfInsufficient=0` | Stores `max(0,currentMP-cost)` and returns underpowered when the stored MP is `<=0`; therefore exact-cost, partial-cost, and zero-MP casts all emit in the fixed weak lane. | high |
| Pure-primary handlers | Ether `0x0053CFE0`, Fire `0x0053DC60`, Air `0x0053F9C0`, Water `0x00543860`, Earth `0x00544C60` | The helper result owns damage, projectile/effect construction, learned-upgrade gates, collision masks, and audio at the actual emission/sustain tick. | high |
| Draw/tick consumers | Ether draw `0x005E0460`; Fire draw `0x006099C0`, tick `0x005FDD90`, impact `0x005E5160`; Air factory `0x00531640`, ribbon constructor `0x0045B2C0`, tessellator `0x00534510`; Water Normal draw `0x00457720` | Weak state is consumed by the native visual owners. It is not a generic CSS opacity treatment and does not propagate into unaffected impact/trail actors. | high |
| Adjacent upgrade/audio paths | Lightning chain helper `0x00641340`; channel-volume helper `0x00407500`; Sound play helpers `0x00407B70` / `0x00407CD0`; registry entry 32 at audio registry `+0x598`, `sounds\\fizzle.wav` | Weak casts suppress specific learned branches and use spell-specific loop gain or one-shot launch pitch. Earth owns a periodic pitched fizzle rather than a dimmed Boulder body. | high |

## Native low-mana contract

The result is a Boolean branch, not proportional scaling by the MP fraction:

```text
spent = min(currentMP, requestedCost)
postMP = max(0, currentMP - requestedCost)
underpowered = postMP <= 0
```

For one-shot Ether and Fire, that calculation happens at the Staff emission
marker. Air, Water, and held Earth run it on every active handler tick. Mana
regeneration during a one-shot wind-up can therefore change which branch is
emitted. Running out of MP never ends an otherwise eligible channel.

| Primary | Damage and gameplay | Native weak presentation and audio |
| --- | --- | --- |
| Ether / Magic Missile | Half direct damage; force one missile; speed `3 -> 2.4`; effective homing turn input `2 -> 1.2`; suppress pierce/bounce payloads. Target acquisition and collision stay native. | Projectile byte `+0x160` wraps the complete flight compositor in white alpha `0.5`; impact stays full strength. Play `fizzle` at pitch/gain `1/1`, then `magicmissile` at pitch/gain `0.75/1`. |
| Fire / Fire Missile | Half direct damage; zero secondary fire payloads and suppress learned proc fields. Speed and collision stay unchanged. | Projectile byte `+0x168` halves all three Fireball body draws. Per-tick Fire particles, outbound light, and impact remain full strength. Play `fizzle` at pitch/gain `1/1`, then `throwfire` at pitch/gain `0.75/1`. |
| Air / Lightning | Half direct damage; no Hurricane progression, chains, Disintegrate, or Stun. Targeting and the first contact remain active. | Factory input becomes width `0.75`, RGBA `(0.5,1,1,0.5)`; the constructor's second ribbon is width `0.5625`, RGBA `(0,1,1,0.25)`, phase `+15`. The source corona is unchanged. Endpoint alpha is `.5,.3,.1`; its light starts at radius `.5*(1+U[0,.75))`, intensity `.5`, delta `-.05`. Path-light intensity is quartered and the loop gain is `0.75`. |
| Water / Frost Jet | Half direct damage; actor query mask is `0x2`, excluding the normal `0x1080` environmental lane; suppress widen/push, Over, Hail, Permafrost scaling, Cold Aura, and Harden (including cleaning an active Harden owner). The weak ColdSlow scalar is fixed `0.75`. | Emit `max(1,trunc(normalCount/4))`; shipped Enhanced Effects therefore emits one particle instead of two. Force the Normal class, then multiply its additive-core alpha and whole-effect opacity by `0.25`: initial additive alpha is `0.1875`, core alpha is quartered, and the `<0.9` opacity gate suppresses the glint. Ice-loop gain is `0.5`. |
| Earth / Boulder | The Boulder still materializes at zero MP. On every weak tick below full charge, halve its two release-damage bases. Once charge is strictly above `0.3`, set growth to zero; a cast below the gate keeps growing until it crosses, then remains near `0.30125`. Repeated float32 halves may deplete the held bases to exactly zero; the wire therefore permits non-negative held damage, while flight remains positive. | No persistent weak-alpha flag is drawn on the Boulder. Every global tick divisible by 50 in the weak branch plays `fizzle` at pitch `0.5` and half positional gain. Release damage is `max(0.25,min((base*charge)*charge,base*1.25))`; the `0.25` floor survives an arbitrarily depleted base. |

The Website implementation must store the underpowered decision on replicated
projectiles/channel transients and the current cast/audio edge so rendering,
collision, audio, and late-join state consume the same authority. Suppressed
learned branches are explicit invariants even where the corresponding positive
rank upgrades are not implemented yet; they must not be inferred later from
the normal lane.

## Acceptance contract

Focused authority tests must cover normal (`MP > cost`), exact-cost, partial,
and zero-MP casts for all five elements, including debit at emission rather
than action start and continued Air/Water/Earth channels at zero. Damage tests
must prove the fixed half branch, Water mask `0x2`, Ether speed/turn changes,
and Earth's repeated half/freeze/release-floor recurrence. Renderer tests must
prove the weak Ether/Fire body-only alpha, the exact Air two-ribbon/contact/path
light plan, and Water's one forced-Normal quarter-opacity particle. Audio tests
must prove Ether/Fire fizzle-before-launch, `0.75` launch pitch, Air/Water loop
gains `0.75/0.5`, and Earth's 50-tick pitched fizzle without restarting loops.

Browser acceptance requires a real `/game` Boneyard flow at zero MP for each
element, with authoritative damage and MP inspected from snapshots and the
actual WebGL spell bodies observed—not a synthetic renderer-only page. The
receipt must distinguish desktop emulation from any real-device claim and must
also show that ordinary full-power casts are unchanged.

## Website implementation and Windows browser receipt

The authoritative fixed-tick kernels now debit at emission/sustain time and
carry `underpowered` and fizzle-sequence state through protocol 21. Ether and
Fire projectile state owns the persistent weak flag; Air and Water transient
state owns the current weak channel; Earth derives its weak recurrence while
charging and releases through the shared native quadratic finalizer. Native
render planners, Boneyard lights/combat, and owner-scoped audio loops consume
that same state. The stock `fizzle.wav` is shipped with its original bytes
(SHA-256 `938420950d859ebc00a9b1a37e548c7c2183a8504689b32aab3de3c683899e76`).

The decisive acceptance ran from Windows on 2026-08-15 in headless desktop
Chrome at `1600x900`; it is not a phone or real-device receipt. A forced
authoritative zero-MP fixture completed all five Hub and Boneyard journeys with
empty page/console error arrays. The browser/wire/audio probes observed:

- Ether damage `1`, speed `2.4`, turn input `1.2`, half-flight composition,
  full impact, then fizzle pitch `1.0` before launch pitch `0.75`;
- Fire damage `2`, half-alpha body draws, unchanged light/trail/impact, then
  fizzle pitch `1.0` before launch pitch `0.75`;
- Air's exact two-ribbon and light plan, continued zero-MP contact, and loop
  gain `0.75`;
- Water's forced single Normal quarter-opacity plan, continued zero-MP contact,
  mask/slow state, and loop gain `0.5`;
- Earth's float32 freeze at `0.3012498915`, repeatedly depleted damage base,
  `0.25` release floor, no persistent weak-alpha flag, and periodic fizzle at
  pitch/gain `0.5/0.5`.

A post-rebase Windows run joined an observer before Ether/Fire and during the held
Air/Water/Earth casts. Every observer received owner `player-1` and
`underpowered=true`; all five journeys returned `status=ok` with zero errors.
The orchestrator requires zero connected players, a fresh Hub, and an empty
player store between the independently scoped element journeys rather than
racing the previous browser's WebSocket close.
The 17 inspected weak-cast frames are under
`C:\Users\User\AppData\Local\Temp\solomon-low-mana-primary-spells-peer-publish-final-windows-20260815`.
An independent ordinary-MP run completed all five primaries with no fizzle and
unchanged normal render/audio plans; its 10 inspected frames are under
`C:\Users\User\AppData\Local\Temp\solomon-primary-spells-full-power-windows-20260815`.

The rebased candidate's canonical Linux gate completed all 23 backend
contracts, all 734 frontend tests, all five desktop tests, formatting, lint
(with the existing eight Fast Refresh warnings), the production
frontend/game-host build, and media-CSP validation. The same Windows gate built
the backend and executed all 23 assertions successfully, but still stops on
its pre-existing teardown race: `WinError 32` while deleting the temporary
`sdr.db` immediately after the unchanged server shutdown. Both new static-RE
contracts pass on Windows. The broad static-RE audit is `471/475` under Linux;
its four failures are the existing Boneyard Tree inventory, actor-facing, Tree
overlay-entry, and 64-row audio-census documentation drifts. The Windows UNC
linked-worktree form is `463/475`, adding eight path/history resolution
failures; neither broad-audit set includes the low-mana contracts.
