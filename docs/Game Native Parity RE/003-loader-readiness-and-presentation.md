# Loader readiness and presentation

Native owner and renderer:

- startup construction: `0x005BAB60`;
- `MyLoader` renderer: `0x005BCA40`;
- embedded `Bundle_Loader`: `MyLoader + 0x78`;
- completed-work global: `DAT_0081F6A8`;
- total-work global: `DAT_0081F6AC`;
- forced-complete byte: `DAT_0081F6B0`.

The native loader is a real readiness gate, not a timed splash. Every render
computes `progress = completed / total`, clamps it to `1`, and calls the
loader's vtable slot `+0x18` only when progress is at least `1` (or the
forced-complete byte is set). The menu cannot render before that completion
dispatch.

The renderer also corrects an older static-art conclusion. It calls four
sprite draw helpers on fields inside the `MyLoader` object:

- `this + 0xB0` (`Bundle_Loader` record 0);
- `this + 0x174` (record 1);
- `this + 0x238` (record 2);
- `this + 0x2FC` (record 3).

Because these are embedded-owner-relative accesses rather than references
through published singleton `DAT_008199BC`, a singleton-only consumer search
incorrectly classified all Loader records as dormant. A clean mod-free 60 fps
desktop capture at
`C:\Users\User\AppData\Local\Temp\solomon-clean-startup-0811.mkv`
confirms that records 0..3 render the Raptisoft mark, URL, bar chrome, and red
fill. Only record 4 remains unobserved in this renderer.

The exact logical composition recovered from `0x005BCA40` and the Loader
bundle metadata is:

- a `480 x 320` virtual canvas, centered with
  `((surfaceWidth - 480) / 2, (surfaceHeight - 320) / 2)`;
- clear color `(0, 0, 0.33, 1)`;
- record 2 at top-left `(41, 13)`, logical size `388 x 227`;
- record 3 at top-left `(119, 251)`, logical size `244 x 18`;
- record 1, logical size `54 x 230`, centered at `(240, 290)` and rotated
  `90 degrees`, producing the horizontal bar frame;
- record 0, logical size `18 x 192`, centered at `(240, 291)` and rotated
  `90 degrees`, producing the red gradient fill.

Progress is not primitive colored geometry. `FUN_00420ec0` installs a clip
rectangle `(0, 0, 144 + progress * 192, 320)`; the renderer then draws the
entire rotated record 0 and clears the clip with `FUN_00420e40`. Since the
rotated fill spans logical `x=144..336`, the visible fill width is exactly
`progress * 192`. This ownership distinction matters: the web loader must crop
the native gradient rather than approximate it with a CSS color ramp.

In that run the native bar advanced in discrete work-completion steps and the
loader disappeared immediately after readiness; the title screen followed
under its ordinary fade. The web implementation consequence is:

1. preload and decode the resident `/game` asset manifest;
2. drive progress from completed asset tasks, not elapsed time;
3. keep the main menu unmounted until all required tasks succeed;
4. render the extracted Loader sprite records and clip the native fill sprite;
5. transition only when progress is complete.

Confidence: high from the full renderer instruction stream, draw-helper
decompilation, bundle metadata, and clean stock startup capture.

The 2026-08-13 unified-renderer cutover now presents this exact `480 x 320`
composition through `renderer/loader-renderer.ts`: the blue clear, records 2
and 3, both rotated bar records, and the progress-width mask are one WebGL
scene. `Game.tsx` still owns readiness and does not mount the title until the
resident asset promise succeeds. The loader therefore remains a real work
gate; only its browser painter changed. `NativeLoader.tsx` retains the live
semantic percentage as a DOM status surface and paints no artwork.

## 2026-10-15 — Coalesce redundant browser progress paints

Unchanged-package Intel desktop diagnostics at Website
`c20fd89cb98c3a76f0852305252f1a3ba06fd59a` reproduced the original 90-second
guest-Title deadline failure. Run
[38753814155](https://github.com/JarrettOneSource/solomon-dark-website/actions/runs/38753814155)
attributed about 46.67 seconds of wall time to Pixi `GlContextSystem.destroy`
when `NativeLoader` unmounted. Independent run
[38761759417](https://github.com/JarrettOneSource/solomon-dark-website/actions/runs/38761759417)
bracketed the loader context's `WEBGL_lose_context.loseContext()` call at
61,849.8 ms (page time 41,616.6 to 103,466.4 ms); the preceding
`useProgram(null)` took 0 ms. Loader frame count was 206, progress was
257/258, and the RAF observer count was 49. No diagnostic event drops or
unsupported instrumentation were reported.

The second run also observed 76 loader draws (frame 68 to 144) while the RAF
observer stayed at 45. Source inspection identifies the producer:
`NativeLoader` synchronously calls `renderer.render` for every committed
progress change, and that API immediately submits `application.render()`.
These redundant submissions are confirmed; whether they cause the Intel
context-destruction stall remains a hypothesis until an exact-package rerun.
This is browser scheduling evidence, not new native reverse engineering.

The bounded implementation contract is one pending RAF for progress paints,
consuming the latest bounded progress when that frame runs. Renderer creation
still paints immediately, including progress received during asynchronous
creation. Native artwork, crop geometry, backing resolution, synchronous
renderer API, resize visibility, readiness ownership and ordinary context
destruction remain unchanged. Unmount cancels pending presentation before
destroying the owned renderer; cancelled asynchronous creation destroys only
its own result. Progress presentation must never delay Title readiness.

Test-first evidence on the Mac mini: a real React/Chrome lifecycle test with
controlled renderer/RAF boundaries observed all 117 separate progress commits
being painted before any RAF delivery on the unmodified source. Coalescing,
pending-frame cancellation and StrictMode coalescing assertions failed;
latest initial paint, cancelled creation and visible creation-error controls
passed. The GPU renderer is intentionally outside this focused test seam.

Final acceptance additionally requires the exact candidate's full Mac
`/opt/homebrew/bin/bash ./scripts/validate.sh`, real-renderer browser checks of
the Loader art/progress/resize/teardown and Title transition, and the original
Intel packaged-desktop startup gate with its unchanged 90-second deadline and
all existing assertions. A passing component test alone does not establish
that the Intel failure is fixed. Keep before/after package identity, render
counts, timing and teardown attribution with those receipts.

Focused candidate receipt: all eight real React/Chrome lifecycle cases pass,
including resize during a queued paint, stale callbacks across remount, late
creation, StrictMode replay and unchanged creation-error presentation. This
test runs through the existing `test:native-ui` entry (164 tests passed), so the
canonical gate invokes it. The 23 existing Loader/viewport/asset-readiness
contracts, TypeScript project build, frontend lint and whitespace checks also
passed. No dependency, renderer, asset or desktop-smoke assertion changed.
Real-renderer and final packaged-Intel acceptance remain open at this receipt.
