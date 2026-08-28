# 2026-08-15 — Boneyard shadow submission performance and audio lifecycle audit

## Reported smell and controlled reproduction

The requested whole-game smoothness and erroneous-loop pass was measured
before implementation on Website `4fbb3b7`, a production bundle, Windows
Chrome hardware WebGL (`ANGLE`, Radeon RX 9070 XT, Direct3D 11), a local
authoritative 100 Hz host, and real 20 Hz snapshots. Title, both Create phases,
and Hub were controls rather than assumed hotspots: all held about 144 FPS;
the menus had no frame gap above 10 ms, while a 15-second Hub run had 7.2/7.3
ms p95/p99, a 9.9 ms maximum, and no long task.

Boneyard reproduced a deterministic application stall. A 15-second idle
sample averaged 39.45 FPS and spent 12.467 seconds in browser tasks; movement
averaged 23.74 FPS and spent 13.355 seconds in browser tasks. The one-percent
lows were 2.48 and 1.02 FPS. A one-variable diagnostic build disabled only
complex-shadow submission while retaining the same renderer, generated scene,
lights, actors, culling, camera, and host clocks. Idle and movement both rose
to 143.8 FPS, browser task time fell to 1.87/1.85 seconds per ten seconds, and
there were zero gaps above 20 ms. This falsifies Region light-field rendering,
darkness painting, actor interpolation, and static culling as the dominant
owner for this reproduction.

## System boundary and membership inventory

Native system: Complex Shadows record generation and per-painter submission,
from the already-recovered `Game.ComplexShadows` readers through each caster's
depth-owned projected geometry. This pass changes only web submission
representation; every recovered record, edge, alpha, depth, light, random
jitter, Gate endpoint, and teardown rule remains authoritative.

| Member | Disposition | Performance/lifecycle contract |
| --- | --- | --- |
| Tree, Gravestone, Fencepost, Monument, Building, Goodie authored outlines | `verified-already-at-parity` | one retained depth-owned mesh per caster; update vertices/alpha without per-frame texture creation |
| Intact FenceGrate and moving Gate bars/rail | `verified-already-at-parity` | preserve custom bar count, widths, rail alpha, live Gate geometry, and depth |
| Rails and Wall custom programs | `verified-already-at-parity` | preserve fixed-width line and tapered-quad programs in retained geometry |
| Multi-source records and presentation jitter | `verified-already-at-parity` | recompute exact current geometry; optimization may not lower cadence or cache stale light state |
| Culled static casters | `exact-ported` | remain non-renderable and perform no geometry submission work |
| Removed dynamic Gate leaves and scene teardown | `exact-ported` | destroy owned buffers/views once at semantic removal, never per frame |

The causal allocation error is web-only. `renderCaster` destroyed every
`FillGradient`, cleared every `Graphics`, created one new 256-pixel gradient
texture per projected edge, and retessellated it on every display callback.
The first generated scene normally exposes about 14 casters and 50–73 quads;
at a 144 Hz display this needlessly creates and destroys thousands of canvas,
texture, gradient, and tessellation objects per second. Pixi itself documents
that animated gradients should be retained or implemented with a shader.
Native submits vertex color/alpha through its indexed-gradient path; it does
not allocate browser textures for each edge.

The correct web owner is therefore a retained per-caster indexed mesh with
base/tip alpha as a vertex attribute. Each frame may rewrite compact CPU/GPU
position and alpha buffers because native lights and jitter remain live, but
must not allocate a texture or rebuild a Graphics command graph per edge.

## Audio ownership audit

The audio boundary remains the existing native registry model documented in
“Native audio ownership, cues, and clocks”: streamed scene music; keyed
`SoundStream` channels; four keyed `SoundLoop` cues; overlapping one-shot
`Sound` cues; and scene/director teardown. Every member has a disposition:

| Member | Disposition | Current proof/contract |
| --- | --- | --- |
| Title, Create, Hub, Boneyard, combat, and death music | `verified-already-at-parity` | one looping media channel for the active scene; outgoing channel pauses and resets after its recovered crossfade |
| `gather-rocks-loop`, `ice-loop`, `lightning-loop`, `rolling-stone-loop` | `verified-already-at-parity` | one keyed Web Audio channel per cue, balanced across semantic owners and stopped on final-owner removal |
| Create and Solomon voice streams plus DeathGuitar | `verified-already-at-parity` | restart one keyed non-looping channel; scene exit stops scene-owned voice streams |
| Footsteps, spell starts/impacts, enemy deaths, Teacher summon, menu/skill cues | `verified-already-at-parity` | overlapping one-shots consume new semantic events once and have `loop=false` |
| Session replacement, reconnect, scene exit, component/director destruction | `verified-already-at-parity` | synchronizer removes all current loop owners; playback stops every keyed and one-shot source on director teardown |

The unchanged production audio journey passed Title through Boneyard with the
four expected music entries, exact 25-tick footsteps, Create streams, Teacher
summon, no gameplay `HTMLMediaElement.play()` path, and no page/network/console
error. The remaining acceptance work must explicitly prove that each of the
four loop cues starts once for one or multiple owners, does not restart on
repeated snapshots, stops its exact channel at final-owner removal, and leaves
no active loop after scene/session teardown. No speculative audio rewrite is
authorized unless that lifecycle probe turns red.

## Validation contract

- Pure geometry tests must prove tapered-quad vertex order/alpha, fixed-width
  line quads, empty geometry, and retained buffer/view lifecycle.
- Controlled production A/B/A runs must restore the full exact shadows and
  improve Boneyard p95/p99/maximum gaps, long tasks, and browser task time
  without changing caster/record/quad counts.
- Audio tests and browser probes must cover all four loops, repeated snapshots,
  multiple owners, release/impact, scene exit, reconnect, and director destroy.
- The canonical Website gate and a Windows Chrome WebGL journey remain required.
  Desktop hardware evidence does not replace the existing physical-iPhone
  audio receipt and must not be labeled as a new phone validation.

No Mod Loader document changes are needed: the native caster and audio owner,
membership, instructions, registry records, and lifecycle were already
recovered. This pass diagnoses browser submission cost and revalidates the
existing native audio model without adding a new stock fact.

## Validation receipt

- The retained-mesh production build restored the exact complex shadows and
  held 143.19 FPS idle and 143.39 FPS while moving at 1600x900. Idle measured
  7.9/10.6/30.3 ms p95/p99/maximum frame gaps; movement measured
  8.2/10.4/12.9 ms. Neither 15-second run recorded a long task. Browser task
  time fell from 12.467/13.355 seconds before the fix to 5.000/4.982 seconds.
- A Windows Chrome mobile-emulation stress run at 844x390 and 6x CPU throttle
  held 143.92/143.93 FPS idle/moving, 7.2/7.4/15.4 ms and
  7.1/7.3/12.6 ms p95/p99/maximum gaps, and zero long tasks. This is hardware
  WebGL stress evidence, not a physical-device receipt.
- Windows Chrome shadow smoke retained 14 generated casters, 14 records, and
  50 quads with no page or console error. Before/after screenshots preserve
  the same silhouettes; small pixel deltas are attributable to mesh versus
  Graphics rasterization rather than changed native geometry or packed alpha.
- The two-client browser audio journey observed one start and one exact-channel
  stop for both gather-rocks and rolling-stone loops on both clients, exact
  remote footsteps and Fire, and no console/page error. Focused unit coverage
  passed for all four loop cues, repeated snapshots, multiple owners, final
  owner removal, and playback/director teardown. No production audio defect
  reproduced, so production audio code remains unchanged.
- `./scripts/validate.sh` passed from the isolated Website worktree: backend
  restore/build and 23 backend tests, frontend lint/architecture/tests,
  production frontend and game-host builds, and production media-policy check.
