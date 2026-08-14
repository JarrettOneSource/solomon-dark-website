# Web ECS and NPC Crowd Architecture Research

_Research date: 2026-08-14_

## Decision

Solomon Dark should **not** move to Unity. Unity DOTS and Rukhanka are useful reference architectures, but the production architecture should remain the existing TypeScript authoritative server and PixiJS/WebGL browser renderer.

The recommended order is:

1. Replace all-pairs student queries with a deterministic spatial broadphase.
2. Move the hot student simulation fields into a structure-of-arrays (SoA) store without changing stock behavior.
3. Separate static spawn/appearance data from dynamic network state, then add interest management and deltas.
4. Pool presentation objects and optimize only the visible NPC lane; never cull the Hub's large static/parallax art with the NPC culler.
5. Consider workers, WebAssembly, a JavaScript ECS library, or WebGPU only when a benchmark proves that the preceding stages are insufficient.

Do **not** add a general ECS dependency yet. The current Hub students are one homogeneous population with known systems; a small purpose-built SoA store is less invasive and addresses the actual memory/allocation problem directly. If the game later has several large entity families sharing many systems, `bitECS` is the best library to pilot. `Miniplex` is useful for object-oriented organization, not for the data-local throughput problem at hand.

### Implementation status

The recommended first production slice is now implemented on the current
worktree:

- `HubStudentStore` owns hot Student fields in typed arrays with stable
  iteration and reusable retired slots. Current route planning uses scalar work
  views reused in place; a direct typed-array route kernel remains a measured
  future option rather than an implementation claim.
- `DynamicActorGrid` and `HubStudentNeighborGrid` replace the stressed
  all-pairs candidate discovery while preserving source order and retaining an
  exact all-pairs test oracle.
- the headless environment supports deterministic reset, packed action and
  observation buffers, batched worlds, state hashes, and persistent Node
  worker lanes;
- protocol `9` separates Student descriptors from compact dynamic samples and
  owns ACKed baselines, spawn/retire lifecycle, periodic keyframes, and explicit
  gap recovery;
- Hub Student views cache discrete sprite state and use a bounded retirement
  pool;
- Student visibility remains diagnostic-only, while all authored southern Hub
  architecture and the complete Astronomer/telescope ensemble stay
  unconditionally renderable.

Binary transport, network interest management, a general ECS package, far-crowd
impostors, WebAssembly, and WebGPU remain evidence-gated follow-up work.

## Baseline Risks and Implemented Response

The pre-change implementation already separated authoritative simulation from browser presentation, which was the right foundation:

| Lane | Baseline risk | Implemented response | Remaining gate |
| --- | --- | --- | --- |
| Student steering | Quadratic Student lookahead scans at `100 Hz` | Stable grid candidates in `HubStudentNeighborGrid` | Profile future enemy steering before sharing more systems |
| Actor pushing | Order-sensitive all-body candidate scans | `DynamicActorGrid` candidates restored to original body order before the existing solver | Keep the all-pairs equivalence oracle |
| World storage | Hot Student values rebuilt through object arrays | `HubStudentStore` typed arrays, stable slots, and reusable runtime buffers | Convert another family only when measured |
| Network | Full authoritative Student objects per client at `20 Hz` | Static descriptors, compact samples, ACKed baselines, lifecycle deltas, and keyframes | Add enemy codecs, then interest sets; binary remains gated |
| Client presentation | Repeated Student appearance writes and view allocation | Cached discrete texture state and a bounded retired-view pool | Measure physical-GPU populations and lifecycle reuse |
| Visibility | A broad culler risked lower-Hub art | Conservative Student counts are instrumentation only | Add NPC culling only after a no-pop camera sweep proves a benefit |

The student art is already prepared as sprite sheets: walk and read sheets contain 5 poses by 24 headings, with separate head and prop strips in `frontend/src/game/renderer/hub-textures.ts`. This means Solomon Dark does not need skeletal GPU skinning. Its equivalent problem is efficient frame selection and batching of textured quads.

A local representative measurement of the current JSON shape produced approximately 746 bytes per student before the surrounding snapshot envelope. Actual payloads vary with float text and prop count, but the growth is linear and becomes material before thousands of students.

### Pre-change synthetic scale receipt

On the current worktree, a warmed Node 22 microbenchmark called `stepHubWorldTick` repeatedly with no players and a dispersed, non-overlapping Student population. This isolates the ordinary Student planning and actor-body scan without dense recursive push chains or WebSocket work:

| Students | Mean authoritative tick | Current full snapshot | Per-client traffic at 20 Hz |
| ---: | ---: | ---: | ---: |
| 16 | `0.127 ms` | `11,834 bytes` | `231 KiB/s` |
| 32 | `0.174 ms` | `23,333 bytes` | `456 KiB/s` |
| 64 | `0.450 ms` | `46,347 bytes` | `905 KiB/s` |
| 128 | `1.421 ms` | `92,405 bytes` | `1,805 KiB/s` |
| 256 | `5.392 ms` | `184,592 bytes` | `3,605 KiB/s` |

The 256-Student dispersed case consumed about half of the server's `10 ms` tick budget before players, dense collision chains, snapshot creation/encoding, socket work, or other game systems. The network shape was the more immediate multiplier: `3,605 KiB/s` was **per client**. These figures are the pre-change directional baseline, not Windows-runtime acceptance results.

### Optimized synthetic receipt

The same deterministic population family now produces:

| Students | Mean authoritative tick | Five-second compact traffic at 20 Hz | Reduction from legacy traffic |
| ---: | ---: | ---: | ---: |
| 16 | `0.1150 ms` | `20.61 KiB/s` | `91.79%` |
| 32 | `0.1421 ms` | `31.77 KiB/s` | `93.48%` |
| 64 | `0.2578 ms` | `54.15 KiB/s` | `94.40%` |
| 128 | `0.5490 ms` | `99.34 KiB/s` | `94.82%` |
| 256 | `1.9883 ms` | `190.55 KiB/s` | `95.04%` |

At `256`, the 50-tick episodic authoritative tick is about `63.1%` faster than the original
`5.392 ms` baseline. A normal compact delta is about `9,371` bytes; the
five-second recovery keyframe is about `47,907` bytes; the legacy full frame was
about `196,533` bytes. These remain WSL Node microbenchmarks. Windows physical
GPU and connected-client receipts are separate gates.

For headless training, the default benchmark also runs `1,000` uninterrupted
ticks with route reversal so the exact population remains alive and later
route, collision, and push work is included. Medians across three warmed runs
were `0.1246`, `0.1511`, `0.2990`, `0.8218`, and `2.8296 ms` per tick. The
`256` lane sustained `353.4` ticks per second, and each population produced an
identical state hash across runs.

### Connected-client acceptance receipt

Headed Windows Chrome `151.0.7922.110` identified the physical `AMD Radeon RX
9070 XT` through ANGLE D3D11 in every run. Exact moving populations of `16`,
`64`, `128`, and `256` Students measured `130.673`, `130.897`, `130.582`, and
`131.605` average FPS, with respective one-percent lows of `123.023`, `120.069`,
`120.482`, and `123.239`; no frame exceeded `20 ms`.

At `256`, the final post-guard two-page run on the same Windows machine received
`101` snapshots per page over `5.012 s` at `20.150 Hz`, with sequences
`3597..3697`, zero gaps, one recovery keyframe, and exact Student/player counts.
Each page received `207.141 KiB/s` of snapshot traffic; aggregate ingress and
ACK egress were `417.100 KiB/s`.

The exact-256 southern stress sweep reached `(1196.031, 1074.941)` at `131.645`
average FPS. A zero-crowd camera-control run removed pushing from the traversal
and reached the true east extreme at `(1972.254, 1071.001)`, at `129.766`
average FPS and `123.457` one-percent low. Both retained all `16` southern
architecture sprites and `19` southern-bank children with no frame over `20
ms`. Direct inspection of `/mnt/c/Temp/sdr-hub-telescope-extreme-final.png`
retained the castle row, circular architecture, animated statue base,
telescope, and Wizards. These checks reject any optimization that hides
authored Hub art.

## Separate the Four Problems

“ECS” is often used to describe several independent optimizations. They should remain separate here:

- **Simulation architecture:** how movement, collision, AI, and lifecycle systems find and update entities.
- **Data layout:** whether hot values are packed into predictable arrays or scattered across JavaScript objects.
- **Scheduling:** whether independent kernels run on one thread, workers, WebAssembly, or GPU compute.
- **Rendering:** how many scene objects, texture/state changes, buffer uploads, and draw calls the browser issues.

An ECS library can improve entity queries and organization. It does not automatically fix an all-pairs algorithm, parallelize the order-sensitive push solver, compress snapshots, or turn layered Pixi containers into one draw call.

## Lessons From Unity and Rukhanka

These are patterns to translate, not packages to adopt.

### Unity Entities and Entities Graphics

Unity Entities stores entities of the same archetype in tightly packed 16 KiB chunks and warns that frequent structural moves are expensive. It schedules jobs over component data and tracks read/write dependencies. The transferable lesson is stable, packed data plus staged kernels, not Unity itself. See [Unity archetypes and chunks](https://docs.unity3d.com/Packages/com.unity.entities@1.4/manual/concepts-archetypes.html), [job scheduling](https://docs.unity3d.com/Packages/com.unity.entities@1.4/manual/systems-scheduling-jobs.html), and [sync points](https://docs.unity3d.com/Packages/com.unity.entities@1.4/manual/performance-sync-points.html).

Unity's own guidance says selective multithreaded jobs are easier to add to an existing project than selectively introducing an ECS foundation. That maps directly to Solomon Dark: first isolate the hot student kernels rather than rewrite the whole game around an ECS framework. Unity also notes that its official entity stack does not itself provide a complete entity animation solution. See [Unity's DOTS introduction and adoption guidance](https://learn.unity.com/tutorial/65bbbee8edbc2a1bb56409d4?version=6.0).

Entities Graphics is a separate bridge that collects ECS render data and feeds Unity's renderer. It gains efficiency when many instances share mesh/material state, but its current mesh-deformation path is experimental, does not update deformed bounds, and does not cull deformation work. The web translation is: keep simulation state separate from Pixi views, group compatible sprites, and treat bounds/culling as an explicit correctness system. See [Entities Graphics overview](https://docs.unity3d.com/Packages/com.unity.entities.graphics@1.4/manual/index.html), [batching performance](https://docs.unity3d.com/Packages/com.unity.entities.graphics@1.4/manual/entities-graphics-performance.html), and [mesh-deformation limitations](https://docs.unity3d.com/Packages/com.unity.entities.graphics@1.4/manual/mesh_deformations.html).

The official [DOTS samples](https://github.com/Unity-Technologies/EntityComponentSystemSamples) are useful for data/job/render separation. The old [`Unity.Animation.Samples`](https://github.com/Unity-Technologies/Unity.Animation.Samples) repository explicitly describes itself as highly experimental and not production-ready, so it is historical context rather than an implementation target.

### Rukhanka

Rukhanka 2.9.1 is a commercial Unity package whose public documentation describes Burst/job-based CPU animation and compute-shader GPU animation. Its architecture keeps controller selection, visibility culling, animation evaluation, and deformation as separate stages. Its GPU path omits CPU-dependent features such as root motion, IK, physics integration, and pose-driven bounds updates. See [Rukhanka overview](https://docs.rukhanka.com/), [runtime architecture](https://docs.rukhanka.com/runtime-architecture), [CPU/GPU feature comparison](https://docs.rukhanka.com/animation-engines), [deformation batching](https://docs.rukhanka.com/deformation_system), and [bounding-box limitations](https://docs.rukhanka.com/smr_bounding_box_recalculation).

The useful web mapping is:

- Keep authoritative movement, pushing, events, and interaction bounds on the CPU/server.
- Let the presentation lane choose animation frames, visibility, and render representation.
- Allow different presentation tiers, but never let a GPU-only tier own gameplay state that must be read back to the server.
- Avoid processing detail that cannot affect gameplay or visible output, while retaining semantic events for culled agents. Rukhanka similarly keeps selected event/root-motion work even when visual animation is culled. See [Rukhanka animation culling](https://docs.rukhanka.com/Optimizing%20Rukhanka/animation_frustum_culling).

Rukhanka's package source was not publicly available for this review; the evaluation is based on its public documentation and [Unity Asset Store metadata](https://assetstore.unity.com/packages/tools/animation/rukhanka-animation-system-2-298480), not an independent source audit.

### Crowd and GPU Research

- Animated crowd rendering research consistently separates CPU-owned game logic/LOD selection from GPU-owned batched drawing. NVIDIA's reference stores animation data once and supplies per-instance transform/frame data, reducing CPU draw setup. Solomon Dark already has the analogous animation textures; the next step is reducing per-student scene/presentation overhead, not adding bone textures. See [GPU Gems 3: Animated Crowd Rendering](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-2-animated-crowd-rendering).
- Large-agent collision research treats nearby-agent discovery as a spatial query rather than an all-pairs scan. ClearPath uses nearby-agent queries and exposes data/thread parallelism; its historical throughput figures are not product targets, but the data decomposition is relevant. See [ClearPath](https://gamma-web.iacs.umd.edu/CA/ClearPath.pdf).
- Continuum Crowds shows both the value and limitation of aggregate simulation: it supports large groups with shared goals rather than individually distinct intent, and notes that neighbor-grid binning can make minimum-distance enforcement linear in the population. This is appropriate for far/background added crowds, not stock interactive students. See [Continuum Crowds](https://grail.cs.washington.edu/projects/crowd-flows/continuum-crowds.pdf).
- Crowd LOD should cover behavior and motion as well as geometry. The [ALOHA crowd LOD paper](https://doi.org/10.1111/1467-8659.00631) supports a near/mid/far system, but any transition must be perceptually validated.
- GPU LOD/culling research uses conservative bounds and screen relevance before deformation/rendering. See [A Real-time System of Crowd Rendering](https://people.cs.vt.edu/yongcao/publication/pdf/chao2011_MIG.pdf). The key production lesson is to validate culling bounds; GPU execution alone does not make bad visibility decisions safe.

## JavaScript/TypeScript ECS Options

| Option | Strength | Limitation here | Recommendation |
| --- | --- | --- | --- |
| Purpose-built `HubStudentStore` | Exact hot fields, stable deterministic order, no query or migration overhead | Requires a small amount of bespoke storage/lifecycle code | **Use first** |
| [`bitECS`](https://github.com/NateTheGreatt/bitECS) | Data-oriented TypeScript ECS, typed component arrays, numeric IDs, serialization tools, worker-friendly buffers | Adds entity/query/lifecycle machinery; still does not solve the algorithms or Pixi representation | Pilot only when multiple large entity families share systems |
| [`Miniplex`](https://github.com/hmans/miniplex) | Excellent TypeScript ergonomics and archetypal queries over ordinary objects | Its object-identity/object-component model does not provide the desired SoA hot loop or compact network layout | Use for organization only, not this optimization |

The current [bitECS multithreading guidance](https://bitecs.dev/docs/multithreading) also recommends workers only for measured CPU-heavy populations, generally much larger than the current Hub roster. Its [serialization module](https://bitecs.dev/docs/serialization) could be evaluated independently even if the simulation does not adopt the whole ECS.

Adopt `bitECS` only if all of these become true:

1. At least three large entity families need the same movement/health/targeting/animation/network queries.
2. Component membership changes are common enough that hand-maintained active lists are error-prone.
3. A representative benchmark shows the library is no slower than the custom SoA kernel.
4. Deterministic ordering and snapshot compatibility have focused tests.

## Recommended Authoritative Data Shape

Use stable numeric slots and typed arrays for hot, per-tick values:

```ts
interface HubStudentStore {
  count: number
  id: Uint32Array
  flags: Uint8Array
  positionX: Float64Array
  positionY: Float64Array
  heading: Float64Array
  currentSpeed: Float64Array
  desiredSpeed: Float64Array
  radius: Float64Array
  pushStrength: Float64Array
  pushResistance: Float64Array
  pathId: Uint16Array
  pathCursor: Float64Array
  rngState: Uint32Array
}
```

Use `Float64Array` initially because JavaScript numbers and the current deterministic kernel use double precision. Narrowing to `Float32Array` is a separate, evidence-gated change because it can alter long-running path, collision, and RNG-dependent behavior.

Keep cold data outside the hot loop:

- Spawn identity and appearance: scale, reading variant, prop palette/angles/radii.
- Path definitions and immutable physical defaults.
- ID-to-slot and slot-to-ID mappings.
- Pending spawn/retire commands, applied between system phases rather than during iteration.

Suggested fixed-tick phases:

1. Apply queued spawns and retirements.
2. Rebuild the dynamic spatial grid into reusable arrays.
3. Evaluate routes and student speed factors from grid candidates.
4. Resolve actor movement/pushing with deterministic candidate order.
5. Advance presentation phases and derived headings.
6. Extract the minimal replication state at snapshot ticks.

This is “ECS-like” data-oriented design without forcing the whole codebase into entity/component queries.

## Spatial Indexing Without Breaking Native Behavior

Use a uniform grid for dynamic courtyard actors. Derive cell size from the maximum interaction reach: body-radius sums plus the student's 15-unit look-ahead, rather than selecting an arbitrary tuning value.

This is also a native-parity recovery, not an invented crowd behavior. The existing reverse-engineering ledger records a separate stock actor grid for dynamic circle contacts, while the current web `resolveActorMotion` scans the complete body list. Recover the remaining native grid ownership, insertion, and candidate-order details before implementation, then use the current all-pairs path as the deterministic oracle.

Important parity constraints:

- The grid is only a **broadphase**. Existing narrow-phase distance and separation equations remain authoritative.
- Candidate lists must be emitted in original body-index order. The stock-faithful recursive push solver is sequential and order-sensitive; unordered sets or parallel conflict resolution can change outcomes and reintroduce jitter.
- Static Hub collision remains in its existing region/collision system. A small static-actor list can use a separate fixed grid or be appended in its current stable order.
- Use a one-tick rebuild first. Incremental grid maintenance adds complexity and is unnecessary until measured.
- Run the old and new solvers from identical seeded states for thousands of ticks and compare every student/player state before removing the old benchmark oracle.

For the native 5–25-student roster, the old all-pairs solver may already be fast enough. The grid becomes essential for hundreds; it should still be introduced only if its parity test and measured crossover justify the added code.

## CPU Workers and the “Burst” Analogue

There is no direct JavaScript equivalent of Unity Burst. The practical ladder is:

1. Monomorphic typed-array loops on the main Node.js thread.
2. Persistent `worker_threads` for independent CPU-heavy phases.
3. A narrow WebAssembly kernel, potentially using SIMD/threads, only if V8 remains the measured bottleneck.

Node's official documentation recommends workers for CPU-intensive work, shared or transferred buffers, and persistent worker pools rather than creating a worker per task. See [`node:worker_threads`](https://nodejs.org/api/worker_threads.html).

For Solomon Dark:

- Keep the order-sensitive actor push solver on one thread unless it is replaced with a deliberately different crowd solver.
- Good server-worker candidates are coarse far-agent planning, route preprocessing, or partitions whose output can be joined without cross-partition pushes.
- A 100 Hz authority has a 10 ms tick budget. A worker phase that must synchronize every tick can cost more than it saves at hundreds of agents; benchmark the whole tick, not only worker compute time.
- On the browser, a worker can build visibility/animation instance buffers or interpolate hundreds of remote agents, but Pixi display objects still belong to the rendering lane. Start with transferable double-buffered `ArrayBuffer`s. [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) move ownership without copying.
- `SharedArrayBuffer` requires cross-origin isolation headers in browsers, which affects deployment and embedded resources. Do not make it a prerequisite without auditing the Website's COOP/COEP compatibility. See [cross-origin isolation requirements](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/crossOriginIsolated).

## PixiJS/WebGL Rendering Architecture

The current renderer explicitly requests PixiJS 8 WebGL, which is still Pixi's recommended production renderer; Pixi describes its WebGPU renderer as feature-complete but still subject to browser inconsistencies. See [Pixi renderers](https://pixijs.com/8.x/guides/components/renderers).

### Near lane: stock-faithful students

- Retain `HubStudentView` with separate shadow, body, head, and props.
- Pool views by stable student ID/slot; do not allocate or destroy during ordinary snapshot interpolation.
- Cache the last heading, pose, reading state, scale, and prop configuration. Set textures/visibility only when a discrete value changes; continue updating position/depth as required.
- Keep all student textures on the existing sheets. Pixi recommends spritesheets and automatically batches compatible sprites; measure draw calls/state breaks before writing a custom shader. See [Pixi performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips).

### Mid lane: visible but noninteractive added crowds

- Continue interpolating transform every display frame.
- Evaluate texture/frame changes at a lower cadence only if a visual test cannot distinguish them at the current camera scale.
- Do not reduce collision or animation cadence for the stock roster merely because an NPC is away from the player; use this tier for added crowd populations or proven noninteractive states.

### Far lane: offscreen or explicit background crowds

- Solomon Dark's Hub is orthographic, so an NPC elsewhere in the visible courtyard is not automatically smaller. “Far” should primarily mean outside an expanded camera rectangle, in another region, or intentionally authored as a background crowd.
- Pixi's [`ParticleContainer`](https://pixijs.com/8.x/guides/components/scene-objects/particle-container) is suitable only for a flat, lightweight representation. It omits scene-graph children and automatic bounds, so it cannot reproduce a 1:1 layered student by itself.
- If thousands of background NPCs are required, use one particle/impostor per far agent and switch to full layered views before entering the visible/interactable band. Use hysteresis and a preload margin to prevent popping.

### Culling safety

Pixi leaves culling disabled by default because it can help or hurt depending on the bottleneck, and its culler requires explicit bounds/configuration. See [Pixi culling](https://pixijs.com/8.x/guides/components/application/culler-plugin).

For the Hub:

- Never attach NPC culling to the root `world` or `southern` containers.
- Keep courtyard architecture, southern castle walls/platforms, the large circular west castle element, the Astronomer/telescope/wizards, statue, fountain, tents, and other parallax banks outside the NPC visibility system.
- Cull only individual student roots or a dedicated far-crowd container.
- Use conservative bounds based on the 170×170 actor frame plus maximum prop/shadow offset, then add camera hysteresis. Never infer bounds from the currently visible body frame alone.
- Maintain an automated camera sweep across all Hub extrema and transitions. Screenshots and renderability assertions must prove that large static art never disappears, pops, or clips while NPC culling changes.

## WebGPU Position

WebGPU exposes compute passes, storage buffers, and indirect draw/dispatch, but device limits are explicit and capability-dependent. See the [W3C WebGPU specification](https://www.w3.org/TR/webgpu/). Browser support is not yet universal, and secure contexts are required; see [MDN WebGPU availability](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API).

Do not migrate the production Hub to WebGPU now:

- Pixi still recommends WebGL for production.
- The current 2D animation is texture-frame selection, not expensive skeletal deformation.
- Authoritative movement and pushing cannot benefit from GPU compute without readback/synchronization and a second implementation of deterministic game logic.
- A custom compute/indirect rendering path bypasses much of the simple Pixi sprite pipeline and increases browser/driver test surface.

Run a WebGPU spike only after a WebGL far-crowd benchmark reaches thousands of visible quads and proves GPU submission/buffer construction is the bottleneck. The spike must retain a WebGL path and show end-to-end frame-time improvement on the actual Windows GPU and remote-browser environment, not just faster compute dispatches in isolation.

## Network Snapshot Scaling

Protocol `9` no longer sends authoritative RNG, collision flags, path internals,
or physical profiles in the Student lane. It implements the transport split as:

1. **Spawn descriptor:** type, ID, scale, reading variant, and static props.
2. **Dynamic sample:** type, ID, quantized position, heading, frame phase, and gait.
3. **Lifecycle/event stream:** spawn, retire/despawn, semantic animation/audio/gameplay events.
4. **Periodic keyframe:** full relevant dynamic state for recovery and late join.

The host deltas from each client's acknowledged baseline and forces a keyframe
after a gap request, missing baseline, or five-second interval. Remaining work,
in order:

- Per-client region and expanded-camera interest sets with hysteresis.
- Delta masks against the prior acknowledged/sent state.
- Quantized transport values whose maximum visual error is explicitly tested; the server remains full precision.
- Lower snapshot cadence for noninteractive offscreen/background agents while preserving 20 Hz for nearby interactive state.
- Binary typed-array payloads only after field splitting and deltas, because a binary encoding of unnecessary full state still wastes bandwidth.

At `256` Students, a benchmark-only packed entity lane estimates `5,548` bytes
and about `10.7 microseconds` of entity encoding, versus `9,371` bytes for the
compact JSON delta. Deflate estimates `4,278` bytes but costs about `143.8
microseconds` per message. Keep text transport until a declared representative
scene exceeds `64 KiB/s` per client at P95 or encoding becomes a named server
cost. The synthetic `256` case crosses the bandwidth threshold, so a future
hundreds-of-enemies product target must reopen this gate; the stock Hub roster
does not justify mixed text/binary tooling today.

Network LOD must not suppress authoritative simulation. It only controls what each client needs to render and predict. A client approaching an interest boundary must receive the spawn descriptor and at least two dynamic samples before the agent becomes visible.

## Practical Scale Targets

| Population | Authoritative simulation | Network | Browser rendering | ECS/parallelism |
| --- | --- | --- | --- | --- |
| Tens (stock 5–25) | Preserve the 100 Hz native-faithful solver; remove needless allocation only when measured | Existing 20 Hz snapshots can remain initially | Full layered `HubStudentView` | No ECS library; no worker |
| Hundreds (100–500) | SoA store, deterministic grid broadphase, reusable work arrays; lower-rate planning only for added/noninteractive crowds | Static/dynamic split, deltas, interest sets, periodic keyframes | Full views near; cached updates and conservative offscreen culling; optional authored far lane | Consider a persistent worker only after single-thread profiling; optional `bitECS` pilot |
| Thousands | Full solver only for active/interactive agents; aggregate or group-flow far simulation, then promote agents before interaction | Binary compact deltas, per-client interest, multi-rate background updates | Dedicated batched/particle/impostor crowd lane; WebGPU experiment only if WebGL submission is proven limiting | Worker partitions/WASM for independent kernels; a general ECS becomes more defensible |

Thousands of individually interactive, layered students at 100 Hz with full JSON replication are a different product requirement, not a small optimization of the stock Hub. Research such as Continuum Crowds achieves scale by trading individual intent for aggregate flow; Solomon Dark should make that trade explicit rather than silently degrading stock behavior.

## Staged Benchmark and Acceptance Plan

Use deterministic populations at 13 (current warm-start example), 25, 64, 128, and 256 students. Use 512/1,024 only in an isolated crowd harness until the protocol and product requirement intentionally exceed the current 256-student limit.

Run performance measurements in the actual target environments:

- Windows Chrome using the user's real GPU.
- The browser connected to the remote server, including real latency and snapshot traffic.
- Headless Chromium only for repeatable correctness/smoke checks, not as the final GPU performance claim.

Record at each population:

- Server tick p50/p95/p99, missed 10 ms deadlines/catch-up steps, phase timings, heap growth, and GC pauses.
- Snapshot encode time, bytes/s/client, snapshot rate, and client parse time.
- Browser average FPS, 1% low, p95/p99 frame time, main-thread task time, heap/GC, GPU renderer, draw calls/batches if available, and visible sprite/view counts.
- Deterministic state hash, collision/push outcomes, spawn/retire sequence, and client interpolation error.
- A fixed camera-path video or screenshots that cover all Hub art and every LOD/culling boundary.

The existing `frontend/tools/measure-hub-performance.mjs` already records FPS, 1% low, task time, snapshot rate/bandwidth, renderer/GPU identity, student count, and optional screenshots. Extend that tool rather than creating disconnected benchmark scripts. Its uncapped mode is useful to expose headroom, but uncapping FPS is not itself an optimization; production rendering should still follow browser `requestAnimationFrame` pacing.

### Stage gates

Stages 1 through 5 are implemented for the deterministic Student slice.
Stage 6 remains instrumentation-only, and stages 7 and 8 remain deferred.

1. **Baseline:** capture every population before changing algorithms.
2. **Grid broadphase:** require identical seeded authoritative output over long runs and a better server tick curve at the first stressed population.
3. **SoA/reuse:** require identical output plus a measurable reduction in CPU time or allocation/GC. Revert if the extra storage layer has no end-to-end benefit.
4. **Transport split/deltas:** require recovery/late-join tests, stable 20 Hz near presentation, and a measured bandwidth/parse reduction.
5. **View pooling/cached updates:** require identical screenshots/animation state and improved 1% low or main-thread time at the stressed population.
6. **NPC-only culling/LOD:** require a camera sweep proving every large static/parallax asset remains rendered, plus no visible NPC pop at band transitions.
7. **Worker/WASM:** attempt only if a named CPU phase remains over budget; include synchronization/transfer time in the result.
8. **WebGPU:** attempt only if a thousands-visible-agent WebGL test is GPU-submission-bound; require a WebGL fallback and a browser/device compatibility matrix.

No stage is “good” based on average FPS alone. It must pass deterministic gameplay, network, 1% low, memory/GC, and visual-occlusion gates. In particular, any optimization that makes the southern castle wall, circular castle piece, animated Astronomer/telescope group, or another large Hub asset disappear is a correctness failure regardless of frame-rate gain.

## Non-goals

- Porting Solomon Dark to Unity.
- Integrating Rukhanka into the web game.
- Moving authoritative movement, collision, or pushing to the GPU.
- Replacing native-faithful stock-student behavior with an aggregate crowd model.
- Treating uncapped FPS as proof of optimization.
- Applying broad scene culling to static/parallax Hub art.
