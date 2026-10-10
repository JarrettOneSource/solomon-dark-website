# Native D3D9 pixel centers, 2026-10-10

## Scope and baseline

This evidence reopens the former inconclusive pixel-phase experiment on Website
`70d7970056745cc2057d6580657d4b4bbe33e307`. That build has the same renderer as
`612d57ee`; the intervening change is CI-only. It does not establish whole-scene
native parity or replace finite-resolution stock art with newly generated art.

The seven combat atlas PNGs and the audited road source pages are byte-identical
to their stock native pages. In particular, DeadHawg, the 2048-square page used
below, has SHA-256
`3758ce24d516f0ca6349e57b988d8a84e8d6f89fb3827856d7bb521618281af0`.
An atlas-gutter or missing-original-detail hypothesis is not supported.

## Fresh native controls

A trusted, unmodified retail 0.72.5 executable was copied to a task-private Windows
root with an empty, isolated profile. Its SHA-256 is
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
The game was not injected, patched, debug-attached, or memory-written. Read-only
process samples bracket each screenshot; they are not draw-time GPU state reads.

The client is exactly 1600x900 at DPI 96, zoom 1.35, with Complex Lighting,
Complex Shadows, and Multiple Shadows enabled. Native LightQuality is .25.
D3DPRESENT_PARAMETERS confirms 1600x900, no MSAA, and A2R10G10B10. Desktop PNGs
are eight-bit output, so a one-LSB residual is not claimed to be exact equality
of native and WebGL framebuffers.

The selected grave main draws use their private RGBA, common CC=D0=1, ordinary
flags138=0 and zero hit/overlay gates. Arena installs float32 saturation .65;
the ordinary Region multiply restores normal blending before the sorted main
queue. The private-color path and live samples support the material state but
do not purport to exhaustively trace every intervening GPU virtual call.

The two opaque ROIs were fixed before scoring:

- Grave 66, variant 9: 007 ROI [944,340,979,376], packed RGBA 251,252,251,255.
- Grave 155, variant 0: 007 ROI [642,220,682,258], packed RGBA 249,249,249,255.

Capture 008 moves the camera naturally. Both ROIs are translated by the
camera-derived nearest integer vertical displacement (+59), with no
residual-based reselection, masking, rescaling, or color fitting. Captures 007
and 008 provide 5,560 distinct scored native pixels across the four patches.
The preceding 006 sample contains an unexplained transient in grave 66 and
remains in the archive rather than being silently promoted as an exact match.

All 16 original native profile files retained identical paths, sizes,
modification times and hashes. The owned game, helper processes, tasks and
exclusive desktop lease were retired before their deadline. The private copy
was recycled after the evidence was hash-verified on the Mac.

## Cross-API convention

The native projection maps fractional XY through 2/W, -2/H and -1,+1, without
an added fixed half-pixel translation. D3D9 evaluates pixel centers at integer
screen coordinates. WebGL evaluates them at half-integer coordinates. The
conversion that preserves this game's submitted geometry is therefore
+0.5 physical pixels in X and Y at the WebGL projection boundary.

This is not the common advice to subtract half a pixel from *D3D9* quads to
change their texel alignment. We preserve the game's existing D3D9 behavior.
Native atlas UVs, including their leading +.5 and trailing +.25 texel biases,
are already source-defined and must not receive a second correction.

Background reference: [Microsoft's D3D9 pixel-center documentation](https://learn.microsoft.com/en-us/windows/win32/direct3d9/directly-mapping-texels-to-pixels).

## Actual GPU controls

An isolated visible Chrome diagnostic on the physical Apple M2 used the current
`installNativeArenaRenderPipeline`, `nativeStockTextureFromImage`, native packed
vertex-color writer, unchanged atlas and exact float32 captured vertices/UVs.
It did not substitute a hand-written reference fragment shader.

V1 holds the physical target at 1600x900 and tests CSS/DPR 1600x900/1,
1280x720/1.25 and 800x450/2, through batched and standalone mesh paths.
V2 adds resolution .5, root versus offscreen targets, and three repeated binds
of each target. The controls do not represent additional independent native
captures or different native backing resolutions.

Across V1's 48 and V2's 128 cases:

- Unchanged projection: native-patch mean absolute RGB error 6.068–6.362/255,
  with maxima 26–29/255.
- +.5 physical projection: mean absolute RGB error .0417–.0466/255, maximum
  1/255 in every case.
- Corrected buffers are pixel-identical across density, batch-route and
  root/offscreen controls after orientation normalization.
- Browser/GL errors are empty, and the diagnostic closes its contexts and lease.

Independent scorer receipts:

- V1 `1e4a3544d5a829d8fcb184931e8f63ff6c4db8225a381b8666f9f17b0163b1f4`.
- V2 `eed8c7c06accf8bc167e1f5c3a8274e5b5e1480f1aded6d3710e5f3df674e7ad`.

## Projection owner, Region composition and generated targets

Only the Hub and Boneyard world renderers opt into the projection conversion.
Separate native UI renderers retain their existing contract. The hook runs after
Pixi's RenderTargetSystem bind rebuilds its matrix and before GlobalUniformSystem
publishes it. It uses the current target's resolution and Y orientation. Repeated
same-target binds also rebuild the matrix; idempotent installation prevents
accumulation. Native world/camera positions and atlas UVs are not adjusted.

Unit controls cover repeated/switching targets, resizing, separate renderers,
256/512/1600/1920 dimensions and resolutions .1 through 4. These and the new Region
coverage tests are in the canonical arena test set.

The Region manager's render target is 512 square. LightQuality .25 produces
float32 .2 render scale; it is not a quarter-resolution .25 target. Its final
composite uses explicit 0..float32(512/scale) corners and whole-target UVs 0..1,
rather than RenderToSprite's separate default centered quad. Raw source proves
an R5G6B5 allocation request and a failure return, but does not establish the live
surface format or a visible color-quantization mismatch. Browser RGBA8 is retained.

An independent two-pass, format-invariant oracle draws three opaque white
fractional quads on the black native-size target, then linearly samples and
multiplies it over RGB [117,173,229]. All 4.32 million final RGBA channels are
scored at each resolution .5, 1, 1.25 and 2, without ROI masks. The first test
exposed a real edge-inclusion difference: WebGL left the first 1,600-pixel row
uncovered although interior values were within one LSB. That failed test remains
in the archive.

The scoped fix extends only the top/left geometric domain of a steady,
viewport-covering Region composite by one physical pixel, outside the clipped
viewport, and extrapolates UVs along the same affine map. It does not shift the
interior samples or enlarge an interior light shape. Shake, displacement, zoom
feedback and finite interior quads retain their original domain. The guarded
retest passes the unchanged full-frame oracle at every tested density, maximum
error 1/255, mean .003273148/255; every incomplete phase policy still fails.
Independent receipt SHA-256:
`70de235e6b3d626ed7400ce2a21f5593870b601f985bbdc1d48fe4220937b356`.
Actual Region geometry is a retained Mesh with explicitly owned vertex, UV and
index buffers, all unloaded and destroyed on retirement. Tests exercise density,
quality and coverage changes without replacing those buffers.

Source recovery also found omitted native generated-target corners in several
existing browser output owners. RenderToSprite::Create 0x417310 subtracts .5 from
all corners; generic Draw consumes those corners at object+0x2c and UVs at +0x4c.
Verified call routes justify size-aware 128.5/256 anchors for Storm, Leviathan
normal/glow/hit, Harden, Webbed and EnhancedHit, and -128.5..127.5 geometry for
Stoneskin Off. Stoneskin On's native custom grid is unchanged. The compact mask
already had the correct anchor; native UI unforge remains untouched.
The bounded raw-disassembly/route receipt has SHA-256
`c82e884ace7f66dfc31239665b289ad4a0007b09ff925245dcbff3555ba17d23`.

## Synthetic filter density

The sole ColorMatrixFilter in these world renderer sources is the Storm strike
white-alpha filter. Its default resolution 1 introduced an extra sampling grid
at nonunit world resolution, even before this change. It also transported a
half-filter-texel phase as the wrong number of final pixels. Its final copy
vertex shader uses its own output frame rather than the world projection, so
applying another root phase there would be incorrect.

The scoped filter now uses Pixi's supported resolution='inherit'. Independent
actual-GPU direct/filtered controls, with and without the projection correction,
are pixel-identical over the entire RGBA frame at resolutions .5, 1, 1.25 and 2:
zero changed channels in all eight pairs. Actual target-bind receipts confirm
the inherited density. Receipt SHA-256:
`a31be004ddf6de8b9da3264316936ce40d63a9e55c37c11c1e2a58d70487e2d5`.
A 48-capture extension through resolutions 2.5 and 3 also has exact opaque
pairs and identical translucent foreground support at alpha .25, .5 and .75.
Translucent colors differ from a direct draw by up to 55/255 with both old and
corrected projection: that separate preexisting material/compositing limitation
is preserved rather than mislabeled as a geometric pass. Its receipt SHA-256 is
`a15f6d13a524137d78a4c6616601b50f7bfef375075503858e83d414d7494baf`.
The existing white-alpha material operation is retained.

## Quality policy and remaining limits

A separate bounded display-density policy removes avoidable whole-world browser
upscaling where measured pixel and side budgets permit. It is a display-quality
choice, not a claim that finite native sprites contain additional source detail.
See [display-density quality policy](display-density-quality-policy-2026-10-10.md).

The broader 512-square editor-capture ground field remains an explicitly open
native owner/membership problem (ledger 272). This correction does not close it,
nor does an opaque-grave result independently prove transparent tree edges,
all road transforms, or full native shadow/lighting composition. Arbitrary
finite-edge raster tie rules and unmeasured physical mobile performance are
also outside the captured proof.

The combined visible M2 source-module run passed 80 constructor/resize cases,
20 context/DOM teardowns, 20 screenshots and two full-buffer density-only DPR2
identity controls. It exercised actual nonzero-camera Region Mesh geometry,
including its one-physical-pixel clipped guard, at DPR2/2.5/3 and desktop, phone,
tablet and oversized legacy viewports. No browser or GL error was reported, and
all source fingerprints remained unchanged. Emulated mobile dimensions are not
physical mobile hardware results. Chromium's subpixel CSS layout is recorded
exactly; its observed 0.0021 CSS-pixel phone-width quantization is accepted within
a .02 CSS-pixel bound, not hidden by image rescaling. Receipt SHA-256:
`703c1867cfe7aa0640171035b0ac3658a30077b6ed083b5d109a46c997d3dc9f`.

Independent review cleared the scoped candidate after finding and correcting
the Region private-buffer retirement defect. Production-built browser validation
and the canonical M5 Mac gate remain required before promotion. Diagnostic GPU
controls and focused tests alone are not a full release gate.

## Evidence archive

On the M2, the task evidence root is
`/Users/jarrett/codex-acceptance/native-visual-parity-sh9aksle-20261010`.
The sealed native archive is `native-capture-archive.zip`, 8,135,825 bytes,
SHA-256 `a399302ce868ab90923a12b472c1f9c3321d4f306fb35d5c90b4811a72fb2fa5`.
It includes original-file integrity receipts, capture brackets, helper sources,
process identity, containment and lease-closure evidence. GPU runs preserve
exact executed probes beside each receipt; later harness revisions do not
replace their provenance. Release receipts record the
archival relocation and SHA-256 manifest outside the retired source workspace;
relative evidence paths remain unchanged.
