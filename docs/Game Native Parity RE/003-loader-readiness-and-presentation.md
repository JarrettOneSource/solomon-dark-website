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

## Create resource admission (Report134)

The November 7 source check reopens the readiness boundary: the earlier loader
closure did not include the subsequently lazy-loaded Create scene. Original
message `1562280064174002266` and its retained clip show a black Create transition
with the name dice alone before the complete scene. A live recheck found no edit
or withdrawal. This establishes incomplete presentation; the historical delay's
machine, network and GPU cause remain unknown.

The owning system is scene resource admission, from asynchronous acquisition
through first complete render, failure or cancellation. Native `MyLoader`
`0x005BCA40` dispatches the menu only after readiness; Create's existing asset,
clock and input contracts remain in entries005/007/032/108. No authored sprite
table or native timing changes here.

| Member | Current evidence | Disposition |
| --- | --- | --- |
| Startup Loader → Title | `Game.tsx` awaits resident tasks | verified-already-at-parity |
| Pixi fresh and retained Create | `CreateMenuScene.tsx` mounts the HTML name dice before `createCreateMenuRenderer` resolves | exact-ported |
| Create first render | renderer constructor renders with an empty draft; scene callback supplies the actual name and native phase | exact-ported |
| Create cancellation and failure | unmount destroys late renderers; rejection displays an alert; pending scene needs visible Back without native canvas art | exact-ported |
| Hub/Boneyard admission | existing loader barrier in entry053 | out-of-system: no conflicting evidence |
| Rust fresh and retained Create | `MenuUi::attach` awaits `CreateView::new` before exposing Title; `show_create` has no asynchronous asset gap | verified-already-at-parity |

Preserve lazy Create assets. During acquisition use the existing resident match
cover with an explicit Create preparation label and no claimed completed work.
Hide and make inert every native Create control until the scene has rendered
the real name and phase. The native entry clock starts after acquisition, as
before. A visible Back control remains available when the caller permits Back;
failure replaces the cover with the existing explicit error. Leaving before
resolution must destroy a late renderer without exposing it.

Validation: repeatable actual Mac Chrome held Create
asset, release, manual selection, cancellation and failed-asset journeys with
composed screenshot review. Rust's earlier actual guest first/settled screenshots show the complete name,
background and hands together. The admitted Rust menu owners are byte-identical
between 58521585 and this task's cdb4a1c8, and no Rust change is required. These
prior images are bounded controls, not a new current artifact run.

Mac candidate acceptance: 21 existing motion/name/finalization/loading tests,
frontend TypeScript build and Vite production build pass. Chrome156's production
build journey holds the Create atlas through consent: the cover and visible Back
remain, while every native control is hidden/inert and no canvas exists. Release
shows complete Create, accepts edited name/Water/Mind, reaches College and saves
on ordinary Leave. Separate contexts cancel before resolution without a late
canvas and reject the held image with an explicit alert plus working Back.
Success/cancel have empty page, console, failed-response and request-failure
arrays; failure has only the deliberately aborted Create image. Composed images
were directly reviewed. The original delay's cause, full gate and installed
acceptance remain separate; the coordinator owns the latter gates.
