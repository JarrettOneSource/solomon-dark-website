# 2026-08-14 — Boneyard footsteps and Tree visibility/lighting parity

## Reported smell and parity questions

Three visible symptoms were reported together: Boneyard footsteps did not
sound like stock, Tree lighting appeared suspect, and Tree art stayed opaque
when it covered the local player. They share presentation ownership but not
one guessed material rule. The investigation therefore traced the native
footstep surface virtual, the complete Tree tick, both Tree painters, the
Region-light dispatcher, and the current browser scene/audio and resident
texture owners before changing code.

The implementation is falsified if it plays footsteps from client velocity
inference, classifies wood from a generic Road or Terrain overlap, lets a
remote participant fade the viewer's Tree, uses image-alpha pixels as the
occlusion shape, fades only one Tree pass, or leaves the Tree secondary pass
white while the main pass receives Region lighting.

## Evidence and provenance

| Evidence class | Exact source | Recovered result | Confidence |
| --- | --- | --- | --- |
| Retail executable | `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; read-only Ghidra project | Player cadence and surface path; RegionLayout bridge derivation; Tree constructor, setup, fixed tick, main painter, secondary painter, bounds, polygon test, and Region-light dispatch. | high |
| Initialized retail data | Read-only live float32 dump of preferred table `0x0081C480` after static initializer `0x005BF6A0` | Exact eight Tree-local secondary polygons, including the native radial expansion and Y translations. | high |
| Stock audio | `sounds/woodstep.wav`, `sounds/Step/Step 1.wav`, and `sounds/Step/Step 2.wav`; native audio registry and wrappers | Ordinary Boneyard ground uses Step1/Step2 at gain `0.5`; exact derived river bridges use woodstep at gain `0.5` and pitch `[0.9,1.25)`. | high |
| Stock-generated web bank | All twelve checked `native-generated-boneyards.ts` templates | Every template contains `terrain: []`; none can materialize the style-zero river mesh or derived bridge predicate. | high |
| Browser source | `BoneyardScene.tsx`, `MainMenuScene.tsx`, `game-audio-native.ts`, `boneyard-world-renderer.ts`, `editor/render.ts`, and `native-render-plan.ts` at analyzed baseline `a272433` | Boneyard never consumed authoritative `footstepTick`; main Tree residents sampled root lighting, while all Tree/Building foreground art was flattened into one permanently white, permanently opaque texture. | high |

The exact initialized polygon vertices are retained in the companion native
ledger at
`../Mod Loader/docs/reverse-engineering/native-boneyards-and-world.md` under
“Tree local occlusion alpha and secondary lighting.” A second read-only dump
of table `0x0081C2F0` proved every native `(x,y,w,h)` record is exactly the
corresponding expanded polygon's float32 bounding box. These are initialized
retail values, not vertices or bounds inferred from the sprite crop.

## Native footstep ownership and surface contract

`PlayerActor::Tick 0x00548B00` owns footsteps inside the movement branch. The
per-tick squared displacement must be strictly greater than `0.01`; player
byte `+0x5C` must be zero; and the shared 100 Hz tick must be divisible by 25.
The event is therefore local-player-only and at most 4 Hz. Collision does not
cancel a request that already passed the movement gate. State `+0x154 == 2`
selects splash registry 216..219. Otherwise Region vtable slot `+0x118`
selects either registry 104 `woodstep` or registry 214..215 Step1/Step2. Both
ordinary paths multiply Region attenuation by the global scalar `0.5`.

Arena implements that virtual at `0x004679B0`. It returns true only when the
player root lies strictly inside one of RegionLayout's derived bridge quads.
Rebuild owner `0x00653BF0` clears and recreates the bridge list from Roads
crossing the central mesh band of style-zero river Terrain. Terrain helper
`0x00651BF0` consumes the randomized vertex mesh built by `0x0064FA90`, not
the serialized control line or a painted stroke. Each crossing uses exact
DeadHawg record 319, a `72 x 135` crop on a `200 x 200` logical canvas, local
quad `(-36,-67.5)..(36,67.5)`, scale `(1,0.9,1)`, Road rotation, and recovered
crossing placement.

The current web host's twelve exact generated scenes contain no Terrain, so
stock takes the Step1/Step2 branch for every supported ordinary Boneyard
footstep. The reported browser failure is earlier in the ownership chain:
simulation already latches authoritative `footstepTick`, Hub consumes it, but
`BoneyardScene` has no audio owner or subscription and plays nothing. The
correct bounded fix is to consume the local player's changed event tick once
and reuse the exact Step1/Step2 cue/gain contract. An approximate generic
wood-surface classifier is explicitly excluded. Exact wood support remains a
future scene-format seam that must preserve the Terrain private RNG, river
mesh, Road intersections, and derived bridge quads together.

## Native Tree visibility-alpha lifecycle

Tree constructor `0x005E46D0` initializes `+0x148` to a random integer in
`0..24`, target alpha `+0x14C` to `1.0`, and current alpha `+0x150` to `1.0`.
`Tree::Tick 0x005F1C50` enables the system only when secondary visibility
byte `+0x144` is true and main variant `+0x140 <= 5`. On each enabled 100 Hz
tick it first approaches current alpha toward target by exactly `0.015` and
clamps, then decrements the countdown. A result below one resets the countdown
to 25, resets target to `1.0`, and scans the Tree's registered spatial cells.

An eligible actor must satisfy `(actor+0x14 & 3) != 0` and local/player byte
`actor+0x5C == 0`. Its root, expressed relative to the Tree, must pass strict
bounds helper `0x00403DA0` and then exact polygon helper `0x00405160` using the
secondary-variant shape selected by `0x005F1A40`. A match changes target alpha
to `0.4`. Because the alpha approach occurs before the scan, fading starts on
the next tick. Forty ticks produce the complete `1.0 -> 0.4` fade; scans
refresh every 25 ticks and recovery follows the same `0.015` step after a scan
no longer finds the local player.

Both Tree halves consume this one current alpha. Main painter `0x00608480`
uses `+0x150`, and secondary foreground painter `0x00608830` submits the same
alpha. The fade is presentation-only, per viewer, and per renderer lifetime.
It does not belong in authoritative simulation, snapshots, collision, camera,
or multiplayer state. Native constructor phase depends on the process-global
RNG consumption order; the deterministic browser replacement may distribute
initial phases from stable Tree identity within the exact `0..24` domain, but
must preserve every scan, step, threshold, and local-player rule.

## Tree lighting correction

The lighting concern is confirmed narrowly rather than as a failure of the
recovered Region-light formula. Common dispatcher `0x00624B40` samples the
analytic maximum scalar at the Tree root and stores it at object `+0xCC`
before main painter `0x00608480`. The browser already samples main Tree
residents at that same root, so their lighting point and falloff are correct.

Tree secondary painter `0x00608830` is an explicit exception to the generic
late-foreground rule. With Complex Lighting active it multiplies Tree color
scalar `+0xD0` by the stored root scalar `+0xCC`, installs that RGB together
with current alpha `+0x150`, draws the secondary sprite, and restores white.
The stock Tree foreground is consequently both lit and faded exactly like the
main Tree even though it paints later. The browser's single flattened
Tree/Building foreground texture erased per-object ownership and was the Tree
defect fixed in this historical pass. The claim made here that Building upper
art remained caller-white was incomplete; the 2026-08-22 Building grid trace
below reopens and corrects it.

## Nearby-system inventory and implementation consequence

- Tree collision remains the small native movement circle selected by the
  main variant. The large secondary polygon is visibility-only and must never
  become collision geometry.
- Tree main art remains in the shared effective-Y population. Secondary art
  remains above the complete population in original foreground source order;
  fading does not change either painter key.
- Tree bounds/shadow art remains in its existing pre-main lane. No evidence
  makes the static shadow part of the alpha pair.
- Building upper art shares the late pass but not Tree's root tint or local
  alpha state. It reuses Building main's specialized packed vertex colors;
  per-object foreground residents remain required to preserve that difference.
- Remote participants, Solomon Dig, enemies, gates, camera visibility, and
  snapshot frequency cannot drive Tree alpha. Only the local player's current
  presentation position is queried at native fixed ticks.
- Audio remains owned by the scene-level `GameAudioDirector`. Boneyard should
  consume the existing authoritative event latch, not create another cadence
  clock or surface state in React.

The renderer cutover therefore needs one resident per native foreground
object in existing source order, with Tree residents retaining Tree identity
and root. The local Tree presentation owner advances exact fixed-tick alpha
state from the initialized polygons. Each visible Tree's main and secondary
residents receive the same alpha and analytic root tint. The historical
Building-white clause is superseded by the 2026-08-22 vertex-grid correction.
The static base, main painter bands, Region multiply boundary,
environment darkness compositor, HUD, collision, protocol, and host simulation
remain unchanged.

## Pre-implementation validation contract

Focused pure tests must pin all eight float32 polygon tables, strict boundary
behavior, the 25-tick scan cadence, one-tick detection delay, 40-tick fade to
exactly `0.4`, delayed recovery, disabled variants/secondary state, stable
presentation phase domain, and remote-player exclusion by interface. Renderer
contract tests must prove that Tree main and secondary residents share alpha
and tint while Building foreground remains independent and foreground source
order is retained.

A real Chromium WebGL run must place the local player outside and inside a
known Tree polygon, observe both Tree passes reach matched alpha/tint, and
show an actual pixel change without changing collision or painter depth. The
real Title -> Create -> Hub -> Boneyard journey must dispatch only stock
Step1/Step2 sources at gain `0.5`, on changed authoritative 25-tick events,
with no replay burst after release. Both journeys require zero page, console,
and failed-response errors, followed by the canonical `./scripts/validate.sh`
gate.

Confidence is high for every ownership boundary, address, field, constant,
polygon, lighting consumer, active-bank surface result, and immediate browser
divergence above. The only retained approximation is the initial per-Tree
scan phase because the retail process-global RNG consumption sequence is not
portable; it does not alter the recovered state machine or acceptance limits.

## Implementation and validation receipt

The browser now gives each native foreground object its own cropped resident
in source order. Eligible Trees retain a shared main/secondary identity and a
renderer-local fixed-tick presentation owner. That owner uses the initialized
retail polygons and bounds, strict containment, the 25-tick scan, `0.015`
alpha step, and `0.4` target. Both Tree residents receive the same current
alpha and Tree-root Region-light tint. At this historical revision Building
foreground remained white; the 2026-08-22 entry below records why that shipped
state was not native and replaces it.
`BoneyardScene` now consumes only the matching run's changed local
`footstepTick` and sends the existing Step1/Step2 cue contract to the shared
audio director at gain `0.5`.

Focused TypeScript coverage passed all 366 current-main Boneyard/game tests, including the
eight polygon/bounds records, strict edges, scan and alpha lifecycle, local
ownership, foreground residency, shared Tree alpha/tint, and scene audio
wiring. App type-checking and lint/import-boundary checks passed; lint emitted
only the repository's pre-existing Fast Refresh warnings.

The isolated Chromium proof used Pixi WebGL2. Moving from just outside to just
inside polygon zero produced one faded Tree at alpha `0.4`, one Tree
foreground resident, zero alpha/tint mismatches, and a framebuffer difference
of 90,676 pixels, total RGB delta 4,530,316, and maximum channel delta 100.
After the local player left, alpha returned to `1.0`; the remaining 5,203
changed pixels were below one fifth of the faded difference. The faded frame
was visually inspected with the wizard visible through the canopy. Receipts:

- `/tmp/solomon-dark-tree-opaque-20260814.png`
- `/tmp/solomon-dark-tree-faded-20260814.png`
- `/tmp/solomon-dark-tree-recovered-20260814.png`

The real Title -> Create -> Hub -> Boneyard audio journey captured Boneyard
semantic ticks `16250,16275,16300,16325,16350,16375`, proving five exact `+25`
deltas. Every held event used Step1/Step2, gain `0.5`, and playback rate `1`.
Dispatch intervals under headless software WebGL were
`11.8,5.5,348.0,712.2,0.9 ms`, averaging `215.68 ms`; the authoritative
semantic ticks remained exact while the headless wave renderer delivered some
snapshots in main-thread bursts. Stopped movement
became silent after the finite release tail. Prelude replaced Academy on
entry, and the journey reported no page, console, or failed-response errors.

Finally, `./scripts/validate.sh` passed the Release backend build with zero
warnings/errors, 23 backend/Website contracts, all 366 frontend tests, all 5
desktop tests, production frontend and game-host builds, and the deployment
media/CSP policy. Its only build diagnostic was the existing Vite chunk-size
warning.
