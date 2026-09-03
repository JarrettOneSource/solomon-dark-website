# Renderer and engine options for Solomon Dark `/game`

**Research date:** 2026-09-03
**Checkout inspected:** `f74a441c21f83521e1786ccb355fe5de34261a0e`
**Decision scope:** renderer/engine direction for the existing React/TypeScript browser game, with physical iPhone XR on iOS 18 as the floor, host-authoritative 100 Hz simulation and 20 Hz snapshots, and exact stock presentation parity as a hard requirement.

This is an architecture recommendation, not a renderer-migration plan. No source reviewed establishes that changing engines would fix the measured lag, and a renderer migration should not be bundled into the current performance work.

## Conclusion

Keep PixiJS 8.19 and WebGL2 as the production renderer. It is the best fit for the target, the existing code, and the parity contract.

Use this escalation order only when physical-device profiles justify it:

1. Optimize the retained PixiJS/WebGL2 renderer and its application code.
2. Replace a measured hot representation with a PixiJS `Mesh`, custom shader/batcher, or `ParticleContainer` while keeping PixiJS resource and render-order ownership.
3. If a large, pure numeric CPU kernel remains dominant, prototype that kernel in Rust/Wasm behind a coarse typed-array boundary.
4. Use a raw WebGL2 pass only where PixiJS cannot express a proven requirement or cannot remove a proven submission bottleneck.
5. Reconsider a full renderer only if those narrower paths fail in controlled iPhone XR comparisons.

Do not move this target to PixiJS WebGPU, a full Rust/wgpu renderer, or Unity Web as a lag fix:

- PixiJS itself labels WebGL/WebGL2 stable and recommended for production and WebGPU experimental because browser implementations can differ. It also cautions that WebGPU is not automatically faster when a workload is CPU-bound. ([PixiJS renderers](https://pixijs.com/8.x/guides/components/renderers), [PixiJS v8 launch analysis](https://pixijs.com/blog/pixi-v8-launches))
- WebKit added shipping WebGPU in Safari 26. An iPhone XR is absent from Apple's iOS 26 compatibility list, which begins with iPhone 11. Therefore the fixed iPhone XR/iOS 18 acceptance target cannot rely on Safari WebGPU and must retain a WebGL2 path. ([WebKit Safari 26 WebGPU](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/#webgpu), [Apple iOS 26 compatible iPhones](https://support.apple.com/guide/iphone/iphone-models-compatible-with-ios-26-iphe3fa5df43/ios))
- On that phone, a browser Rust/wgpu renderer would use wgpu's WebGL2 backend. wgpu's own support table calls browser WebGPU first-class but browser WebGL2 downlevel/best-effort. It would change the CPU-side framework while preserving the same deployable graphics API. ([wgpu v30 support matrix](https://github.com/gfx-rs/wgpu/blob/3e11ff59bf3f9795d285ecc045014089640d7248/README.md#supported-platforms))
- Unity 6.4 technically supports iOS Safari 15+, but WebGL2 remains its default; Unity's WebGPU path is experimental and not recommended for production. Unity would therefore add a new engine/runtime and a second application boundary without bypassing the target's WebGL2 ceiling. ([Unity browser compatibility](https://docs.unity3d.com/6000.4/Documentation/Manual/webgl-browsercompatibility.html), [Unity Web graphics APIs](https://docs.unity3d.com/6000.4/Documentation/Manual/webgl-graphics.html))

## Project facts that control the decision

The decision is not between four greenfield technologies. It is between preserving a substantial, parity-specific implementation and replacing portions of it.

- The frontend is React 19 plus TypeScript and is pinned to `pixi.js` 8.19.0 in [`frontend/package.json`](../frontend/package.json). The three renderer entry points explicitly request WebGL2, disable antialiasing and Pixi's automatic ticker, select the high-performance power preference, and own resolution themselves: [`game-webgl.ts`](../frontend/src/game/renderer/game-webgl.ts), [`hub-world-renderer.ts`](../frontend/src/game/renderer/hub-world-renderer.ts), and [`boneyard-world-renderer.ts`](../frontend/src/game/renderer/boneyard-world-renderer.ts).
- Authoritative simulation is already outside the client bundle. [`engine.ts`](../frontend/src/game/engine.ts) defines the browser as a protocol client, not a simulation host. The fixed step is 0.01 seconds in [`player-character.ts`](../frontend/src/game/core-kernels/player-character.ts), yielding the 100 Hz `GAME_TICK_RATE` in [`game-simulation.ts`](../frontend/src/game/core-server/game-simulation.ts). The host defaults to 20 snapshots per second in [`game-host.ts`](../frontend/src/game/host/game-host.ts), while the client timelines interpolate authoritative samples in [`boneyard-presentation-timeline.ts`](../frontend/src/game/client/boneyard-presentation-timeline.ts) and [`hub-presentation-timeline.ts`](../frontend/src/game/client/hub-presentation-timeline.ts).
- The renderer is already specialized rather than generic Pixi scene code. At the inspected revision, `frontend/src/game/renderer` contains 118 non-test TypeScript files and 51,074 non-test lines; 63 non-test game files import PixiJS. At least five production renderer files construct custom GL shader programs, and at least twelve construct Pixi meshes. These are reproducible inventory counts, not performance measurements.
- Exact native texture alpha, sampler modes, blend factors, custom batch packing, and shader behavior are already installed through [`native-fixed-function-render-pipeline.ts`](../frontend/src/game/renderer/native-fixed-function-render-pipeline.ts) and [`native-arena-render-pipeline.ts`](../frontend/src/game/renderer/native-arena-render-pipeline.ts). The current stack has therefore already demonstrated access to the low-level controls needed for stock presentation; changing languages or engines is not required merely to obtain programmable shaders or mesh buffers.

The 100/20 Hz transport contract is largely orthogonal to renderer choice. Any option still needs to consume the same authoritative checkpoints, preserve discrete events that occur between snapshots, interpolate the same presentation timeline, and render on the browser's display schedule. Porting the renderer must not move authority into a browser, Wasm module, or Unity player.

## Target-platform constraint: WebGL2 is the common denominator

Safari 15 added WebGL2 and moved WebKit's WebGL implementation over Metal. Safari 17 added WebGL rendering through `OffscreenCanvas`, allowing worker rendering. Those capabilities are present in the iOS 18 target. ([WebKit Safari 15](https://webkit.org/blog/11989/new-webkit-features-in-safari-15/#web-apis), [WebKit Safari 17 Offscreen Canvas](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/#offscreen-canvas))

WebGPU is different: WebKit identifies Safari 26 as its shipping introduction. Because iPhone XR cannot upgrade to iOS 26, `navigator.gpu` cannot be an acceptance dependency for that device. This rules out a WebGPU-only renderer and makes every viable option a WebGL2 implementation on the required phone.

That does not make future WebGPU work valueless. It makes it a separate newer-device tier with its own shader output, image-parity, fallback, and performance evidence. It cannot close iPhone XR lag, and PixiJS currently recommends its WebGL renderer for production anyway. The current W3C WebGPU document also remains a Candidate Recommendation Draft, so browser conformance and implementation differences remain relevant. ([W3C WebGPU specification](https://www.w3.org/TR/webgpu/))

Worker rendering is likewise an orthogonal placement choice, not a reason to adopt Rust or Unity. PixiJS 8.19 ships a `WebWorkerAdapter`, and Safari 17+ supplies WebGL `OffscreenCanvas`. A Pixi worker prototype could therefore test main-thread relief without replacing the renderer. It would still require explicit bridges for React/DOM UI, input, accessibility, resize/fullscreen state, Web Audio, diagnostics, and the snapshot timeline. ([PixiJS 8.19 `WebWorkerAdapter`](https://pixijs.download/v8.19.0/docs/environment.WebWorkerAdapter.html))

## Comparison matrix

| Option | iPhone XR/iOS 18 graphics path | Existing-code fit | Exact-parity risk | Performance case before measurement | Relative migration cost | Verdict |
|---|---|---:|---:|---:|---:|---|
| Continue PixiJS 8.19 | WebGL2 | Best | Lowest | Strongest because it preserves known-good rendering and exposes measured tuning levers | Low | **Recommended now** |
| Hybrid raw WebGL2 + targeted Rust/Wasm | WebGL2 | Good if narrowly bounded | Medium | Plausible only for an identified submission or numeric CPU hotspot | Medium | **Conditional escape hatch** |
| Full Rust/Wasm renderer/engine, likely wgpu | wgpu's downlevel WebGL2 backend | Poor | Very high | Unknown; no WebGPU benefit on the target | Very high | **Do not pursue for current lag** |
| Unity Web | Unity WebGL2 player | Poor | Very high | Unknown; adds runtime, heap, asset, bridge, and rebuild costs | Very high | **Reject as a lag fix** |

“Performance case” here means the strength of the causal argument, not a benchmark result. None of the alternatives has been benchmarked against this game on the physical target.

## Option 1: continue PixiJS 8.19/WebGL2

### Why it is the default

PixiJS already owns the expensive infrastructure a custom 2D renderer would have to recreate: scene traversal, transforms, draw batching, texture upload and lifetime, render targets, masks, events, context-loss handling, and GPU state. Its v8 `Mesh` API exposes geometry, UVs, indices, shaders, and GPU state, so a native-specific effect does not need a new engine to obtain low-level control. ([PixiJS renderer architecture](https://pixijs.com/8.x/guides/components/renderers), [PixiJS Mesh](https://pixijs.com/8.x/guides/components/scene-objects/mesh))

The current renderer also uses Pixi in the way its production guidance favors: WebGL2, no antialiasing, retained objects, explicit application timing, texture atlases, meshes, render textures, bitmap glyphs, and a particle container for weather. Preservation matters because exact blend, alpha, painter order, authored timing, and teardown are already encoded and regression-tested in this representation.

### Remaining optimization surface

Pixi's official performance guidance points to levers that do not require a renderer rewrite:

- Group compatible sprites and blend modes to avoid batch breaks; draw order affects batching.
- Prefer sprites or retained meshes over frequently rebuilt complex `Graphics` geometry.
- Keep dynamic text out of per-frame rasterization; bitmap text is intended for changing text.
- Treat culling as a measured tradeoff: it can reduce GPU work but add CPU work, and it is not enabled by default.
- Reduce texture resolution on older mobile hardware where fill rate, bandwidth, or memory is the constraint.
- Pool and explicitly destroy unused GPU-backed objects rather than creating/destructing large groups at once.
- Use `ParticleContainer` when an effect fits its deliberately restricted, packed representation; declare only genuinely dynamic properties so static data is not uploaded each frame.

These are upstream recommendations, not claims that each is currently missing. Apply only the ones a profile ties to a frame phase. ([PixiJS performance tips](https://pixijs.com/8.x/guides/concepts/performance-tips), [PixiJS particle container](https://pixijs.com/8.x/guides/components/scene-objects/particle-container), [PixiJS GPU resource collection](https://pixijs.com/8.x/guides/concepts/garbage-collection))

Render groups and `cacheAsTexture` are also available, but they are not universal wins. Pixi explicitly recommends strategic grouping and profiling because too many render groups can make performance worse; cached textures help static or infrequently changed subtrees, not rapidly changing world content. ([PixiJS render groups](https://pixijs.com/8.x/guides/concepts/render-groups), [PixiJS containers and cached textures](https://pixijs.com/8.x/guides/components/scene-objects/container))

### Main caution

The parity pipeline reaches some Pixi renderer internals. That creates upgrade risk, but not a reason to discard the renderer. Keep 8.19 pinned during lag work; evaluate any Pixi update as a separate change with exact images, shader/blend contracts, context-loss behavior, bundle size, and physical-device performance. PixiJS 8.20 is the current stable release as of this research date, but “newer” is not evidence of a win for this custom pipeline. ([PixiJS versions](https://pixijs.com/versions), [PixiJS 8.19 release](https://github.com/pixijs/pixijs/releases/tag/v8.19.0))

## Option 2: hybrid raw WebGL2 with targeted Rust/Wasm

This is viable, but it should be two narrow tools rather than a vague partial rewrite.

### Raw WebGL2 pass

WebGL2 exposes OpenGL ES 3.0-style rendering, including core instancing, vertex-array objects, multiple draw buffers, and integer indices. It is enough to build specialized packed draws without WebGPU. ([Khronos WebGL 2 specification](https://registry.khronos.org/webgl/specs/2.0/))

Prefer this order:

1. Express the draw as a Pixi `Mesh`, shader, buffer, or custom batcher so Pixi retains resource, render-target, order, and context-loss ownership.
2. If that layer itself is the measured problem or cannot reproduce a stock state, interleave a raw pass on the same WebGL2 context.
3. Call Pixi's `resetState()` around external GL work. Pixi documents this specifically because external programs, bindings, blend modes, and other state can invalidate its caches. ([PixiJS WebGL renderer state reset](https://pixijs.download/v8.19.0/docs/rendering.WebGLRenderer.html#resetState))

A separate overlaid canvas is possible, but it adds another browser-compositing surface and separate texture/resource ownership. That is an engineering inference, not an automatic prohibition; test it only if isolation is worth those costs.

### Targeted Rust/Wasm kernel

Rust/Wasm is most credible here for coarse, pure CPU work such as building a large packed vertex/index stream, updating a dense particle-state array, or producing a visibility/sort list. It is not a useful response to a GPU-fill, texture-bandwidth, shader, draw-order, network, or audio bottleneck.

The interface shape determines whether the experiment is meaningful:

- Initialize one long-lived Wasm state object.
- Use one or a few coarse calls per frame, not one call per entity or property.
- Exchange packed numeric memory, handles, or stable views rather than serialize the object-rich snapshot graph repeatedly.
- Return a small descriptor or expose a buffer view that the existing Pixi upload path can consume.
- Avoid owned boxed slices on the hot path when possible; current `wasm-bindgen` documentation states that boxed numeric slices are copied between Wasm linear memory and JavaScript typed arrays. Its arbitrary-data guidance also notes that repeated Rust/JavaScript calls during serialization can be slow and explicitly says to profile the actual representation. ([`wasm-bindgen` boxed numeric slices](https://wasm-bindgen.github.io/wasm-bindgen/reference/types/boxed-number-slices.html), [`wasm-bindgen` arbitrary data](https://wasm-bindgen.github.io/wasm-bindgen/reference/arbitrary-data-with-serde.html))

Rust can call WebGL2 directly through `web-sys`; the official example obtains a `WebGl2RenderingContext`, compiles shaders, uploads a typed-array view, and draws. It also warns that a raw typed-array view can be invalidated if Wasm memory grows. A Rust renderer therefore still uses the browser's WebGL API and still needs explicit memory and resource discipline; it does not bypass WebKit or Metal translation. ([`wasm-bindgen` WebGL2 example](https://wasm-bindgen.github.io/wasm-bindgen/examples/webgl.html), [`web-sys` overview](https://wasm-bindgen.github.io/wasm-bindgen/web-sys/index.html))

Do not make threads part of the initial Wasm experiment. Rust's standard `wasm32-unknown-unknown` target does not provide ordinary `std::thread::spawn`, and `wasm-bindgen` documents additional build, worker, synchronization, and non-blocking-main-thread constraints for threaded Wasm. A single-threaded bulk kernel can answer the performance question first. ([Rust browser-Wasm target](https://doc.rust-lang.org/stable/rustc/platform-support/wasm32-unknown-unknown.html), [`wasm-bindgen` threaded ray tracer caveats](https://wasm-bindgen.github.io/wasm-bindgen/examples/raytrace.html))

### Promotion gate

Promote a hybrid component only when an identical-scene iPhone XR A/B demonstrates all of the following:

- lower sustained and tail frame CPU time in the phase the prototype replaces;
- no compensating regression in GPU time, memory, cold start, input latency, or network-to-presentation latency;
- identical output for the affected native render contract and no change to painter order, alpha, sampling, timing, or teardown;
- a coarse, documented JS/Wasm or Pixi/raw-GL ownership boundary.

For GPU/CPU attribution, WebGL2's `EXT_disjoint_timer_query_webgl2` can provide asynchronous GPU elapsed-time queries when the device exposes it; Safari 17 added that extension. Treat availability as feature-detected. ([Khronos timer-query extension](https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/), [Safari 17 WebGL additions](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/#webgl))

## Option 3: full Rust/Wasm renderer or engine

There are two technically different variants, neither justified now:

- Direct `web-sys` WebGL2 replaces Pixi with hand-owned GL resources, batching, shaders, state, render targets, text, particles, hit testing, context recovery, and asset lifetime.
- wgpu provides a safer cross-platform GPU abstraction and shader translation, but on iOS 18 it must use its WebGL2 backend. wgpu's current support matrix explicitly classifies that web backend as downlevel/best-effort, while browser WebGPU is first-class. ([wgpu v30 README](https://github.com/gfx-rs/wgpu/blob/3e11ff59bf3f9795d285ecc045014089640d7248/README.md))

The full route does not merely translate 51,074 renderer lines from TypeScript to Rust. It must recover or preserve the behavior those lines encode: atlas frames and trims, texture source alpha modes, exact blend factors, GLSL programs, batch packing, render-texture lifetimes, masks, painter ordering, responsive projection, touch interaction, scene transitions, live mod assets, diagnostics, and destruction. It would also add a new boundary between the React/TypeScript shell, WebSocket protocol objects, Web Audio, DOM UI, and the renderer.

Potential benefits—strong data layout control, fewer JavaScript allocations, a native-capable cross-platform core, and explicit GPU ownership—are real design possibilities. They are not evidence that this game will render faster. On the required phone, wgpu cannot unlock WebGPU compute or direct Metal, and WebAssembly itself only obtains browser functionality through the same Web APIs available to JavaScript. ([WebAssembly portability and host APIs](https://webassembly.org/docs/portability/), [WebAssembly high-level goals](https://webassembly.org/docs/high-level-goals/))

Revisit this option only for a broader product decision—for example, one Rust renderer intended to own native desktop/mobile plus web—or after a narrow WebGL2 prototype proves that Pixi's irreducible CPU submission layer is the dominant remaining limit. It is not a proportionate response to a lag trace by itself.

## Option 4: Unity Web

Unity Web is technically deployable to iOS Safari 15+, so it is not rejected for simple browser incompatibility. It is rejected because it is the least aligned way to solve this problem.

- Unity 6.4 uses WebGL2 as its default Web graphics API. Its WebGPU option is experimental and cannot serve iOS 18 anyway. ([Unity Web graphics APIs](https://docs.unity3d.com/6000.4/Documentation/Manual/webgl-graphics.html))
- A Unity Web build adds loader JavaScript, framework JavaScript, a Wasm player, and scene/asset data. Those pieces can be compressed and stripped, but they are additional startup and caching concerns compared with the existing application bundle. ([Unity Web build folder](https://docs.unity3d.com/6000.4/Documentation/Manual/webgl-building.html))
- Unity documents a contiguous Wasm heap, resident unpacked launch asset data, end-of-frame garbage collection, crash risk if a larger contiguous heap cannot be allocated, and mobile-specific heap tuning. These are material constraints for an older physical phone. ([Unity Web memory](https://docs.unity3d.com/6000.4/Documentation/Manual/webgl-memory.html))
- Standard managed C# remains single-threaded. Unity 6.4 can multi-thread native engine work and Burst jobs, but doing so requires the engine/job-system architecture plus secure cross-origin-isolation headers; it is not a free result of importing the project. ([Unity Web multithreading](https://docs.unity3d.com/6000.4/Documentation/Manual/web-multithreading-intro.html))
- React, authentication, saves, WebSocket session state, mod UI, input, and DOM overlays would communicate through Unity's JavaScript plug-in boundary. Unity's normal JavaScript-to-C# `SendMessage` path addresses GameObjects and accepts no argument or one string/number argument, so rich snapshots need a deliberately designed bridge rather than direct reuse of current TypeScript objects. ([Unity JavaScript-to-C# interaction](https://docs.unity3d.com/6000.4/Documentation/Manual/web-interacting-browser-unity-to-js.html))
- Unity Web audio uses a Web Audio backend with only basic audio functionality. Exact sound voice, timing, spatialization, and lifecycle parity would have to be revalidated rather than assumed from the engine. ([Unity Web technical limitations](https://docs.unity3d.com/6000.4/Documentation/Manual/webgl-technical-overview.html))

Unity becomes reasonable only if the product independently chooses Unity's editor, asset pipeline, component model, and non-web deployment ecosystem and accepts a full reimplementation. It does not offer a smaller renderer substitution for the current React/Pixi game.

## Recommended decision protocol

1. Finish the current measured fixes without changing engine or renderer API.
2. On the physical iPhone XR/iOS 18, capture a repeatable baseline for the same deterministic Hub and Boneyard stress scenes: frame interval distribution, long-frame count, per-phase main-thread time, GPU time when query support exists, draw/batch counts, texture/heap trend, startup, and input/network-to-presentation latency.
3. Attribute the remaining tail to a class of work before choosing a tool:
   - scene traversal, allocation, draw batching, or texture churn → Pixi application changes;
   - dynamic geometry/particle preparation → Pixi packed mesh/particle representation first, then a bulk Wasm kernel if JavaScript CPU remains dominant;
   - a specific unsupported GL state or irreducible Pixi submission path → one raw WebGL2 pass;
   - main-thread contention with a renderer-heavy trace → Pixi `WebWorkerAdapter`/OffscreenCanvas prototype;
   - GPU fill or bandwidth → resolution, overdraw, render-target, texture, and shader work; Rust does not change the GPU budget;
   - snapshot decode/interpolation or WebSocket work → optimize that client phase without replacing the renderer.
4. Compare baseline, stress, and restoration runs on the exact phone. Reject any option that moves the bottleneck, worsens cold load or memory, or changes stock pixels/timing.
5. Reopen the full-engine question only if a minimized prototype proves the existing renderer imposes a material, irreducible floor.

## What would falsify this recommendation

The recommendation to retain PixiJS should be revisited if evidence shows one of these conditions:

- After application-level corrections, Pixi's own scene traversal/batching/submission remains the dominant tail-frame cost on the iPhone XR and cannot be reduced with retained meshes, custom shaders/batchers, pooling, culling, or worker placement.
- A required stock render state cannot be expressed reliably through supported Pixi APIs or a bounded raw WebGL2 pass, and the current internal hooks cannot be made stable.
- A full Rust/WebGL2 prototype with identical assets, draw order, shader math, resolution, and frame input materially wins sustained and tail latency after including bridge and startup costs.
- The product adopts a broader native cross-platform strategy whose value exceeds the web-only migration and parity cost.

Absent one of those results, a full renderer rewrite would be an expensive hypothesis rather than a lag fix.

## Research breakdown

### Sources examined

- **PixiJS:** exact 8.19 release/API material plus current official renderer, mesh, particle, performance, resource lifetime, render-group, and worker documentation.
- **Browser graphics:** current Khronos WebGL2 and timer-query specifications; current W3C WebGPU specification; first-party WebKit release documentation for WebGL2, OffscreenCanvas WebGL, and shipping WebGPU; Apple's first-party iOS 26 device list.
- **Rust/Wasm:** current Rust target documentation, current `wasm-bindgen` guides/examples for typed arrays, serialization, WebGL2, and threading, plus official WebAssembly platform documents.
- **wgpu:** current v30 crate/project documentation and an immutable official support-matrix revision.
- **Unity:** current Unity 6.4 Web browser, graphics, memory, threading, build-output, JavaScript interop, and technical-limit documentation.
- **Repository:** read-only inventory of package versions, renderer entry points, host/client timing seams, shader/batcher extensions, and renderer/Pixi surface at the checkout listed above.

### Evidence discipline and limits

- Only primary specifications, browser-vendor documentation, official project documentation/source, and the inspected repository were used for conclusions. Third-party engine comparisons and synthetic cross-project benchmarks were excluded.
- Upstream capability statements establish what can be built; they do not establish what is faster in Solomon Dark. All performance rankings above are causal-risk assessments pending controlled physical-device measurements.
- File/line counts are repository inventory, not complexity estimates. They show the minimum ownership surface a replacement must account for.
- No implementation, prototype, build, test, or device benchmark was run for this research. The unresolved fact is the exact post-fix distribution of CPU, GPU, memory, audio, and network-to-presentation time on the physical iPhone XR.
