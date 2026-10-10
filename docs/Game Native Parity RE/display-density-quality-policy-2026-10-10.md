# Bounded world display density — October 10, 2026

## Scope and source

This is a Website display-quality policy for the shared Hub/Boneyard renderers,
not a newly recovered native constant or replacement high-resolution art. The
native texture pages, linear sampling, sprite geometry, authored shadow ramps,
camera, compact target dimensions and ground capture are unchanged by this
policy. The separate physical-pixel phase investigation has its own evidence.

The baseline runtime was `70d7970056745cc2057d6580657d4b4bbe33e307` (the
last runtime change was `612d57ee863a46aa9cc418679b44c75e53d29c9a`). The old
`initialHubResolution` maximum of 2 forced a final compositor enlargement when
`devicePixelRatio * displayScale > 2`. Existing <=2 output already matched the
requested display density and must remain unchanged.

The asset audit found all seven reconstructed combat pages and all eight loose
road/fence/terrain textures byte-identical to the clean stock files. In
particular, the suspected atlas-gutter mismatch was falsified. Grave 99 is a
47×98 native record; increasing output density does not create detail absent
from that bitmap. No nearest-neighbour, sharpening or replacement-art change
is supported by this investigation.

## Measured quality and cost

Task-private `dpr-diagnostic-v1/receipt.json` records a frozen stock Tutorial
fixture, two camera positions, density 2/2.5/3/4, exact source/tree hashes,
backbuffer hashes, final compositor captures and WebGL timer queries. The
fixture used real Apple M2 / ANGLE Metal Chrome with emulated DPR, not physical
Retina-device acceptance. The code change for this experiment was an in-memory
Vite transform of the maximum-density constant; the source checkout was clean.

At 1600×900 logical pixels, the observations were:

| Density | Backbuffer | Pixels | One RGBA8 buffer | GPU p95 |
| --- | --- | ---: | ---: | ---: |
| 2 | 3200×1800 | 5.76 M | 21.97 MiB | about 3.2–3.6 ms |
| 2.5 | 4000×2250 | 9 M | 34.33 MiB | 4.71 ms |
| 3 | 4800×2700 | 12.96 M | 49.44 MiB | 9.61 ms |
| 4 | 6400×3600 | 23.04 M | 87.89 MiB | 17.92 ms |

The density-3/4 cases also crossed the default Region-light target from
1024×1024 to 2048×2048, adding approximately 12 MiB to referenced texture
storage. Single-buffer figures are not total GPU-process memory measurements.
Unbounded native-DPR output is therefore rejected.

`dpr-visible-cap25-abba/receipt.json` repeats density 2/2.5/2.5/2 at emulated
DPR 3 in visible Chrome, with 180 valid GPU queries per case. GPU p95 was
3.198/4.584/4.576/3.212 ms; requestAnimationFrame p95 stayed approximately
17.9–18.2 ms. The frozen fixture does not establish dense-combat or mobile
performance. The initial headless rAF tails are not FPS evidence.

`dpr-diagnostic-v1/pixel-analysis.json` compares the same source-backed art and
camera. Density-2 controls were pixel-identical. At DPR 3, full density 3 vs
the cap-2 output increased grave high-frequency energy about 1.99×; the bounded
density-2.5 result increased it about 1.17×, with mean RGB difference 0.37/255.
These are modest resampling improvements, not native-framebuffer parity or
proof that all visible softness is removed. The saved side-by-side grave crops
were inspected. Road and tree crops also recover some lost high-frequency
contrast; source art remains finite-resolution.

Summary artifact: `dpr-diagnostic-summary.json`, SHA-256
`9f50c3780d06fb3b325cd8dfcc4c100199f78422d535650e389942dc7c448e64`.
It links both experiment receipts, the analysis, exact hashes and limitations.
The source-image audit is `art-rendering-audit.json`, SHA-256
`dab7e4a11629e39f0f31ff866caf92cb7f99c0049f946055fe25b129d9ad7b16`.

## Implemented policy

`hub-render-contract.ts` retains the minimum density 0.5 and the requested
`devicePixelRatio * displayScale`. Additional density above 2 is allowed only
when current positive, finite logical width and height are supplied. Its upper
bound is the smaller of:

- maximum density 4;
- `sqrt(9_000_000 / width / height)`;
- `4096 / max(width, height)`.

That upgrade bound is floored at the existing maximum 2, then restricted by
the caller's explicit lower `maxResolution`. Missing or invalid dimensions
retain the legacy maximum 2. A NaN maximum also conservatively uses 2;
positive/negative infinity retain ordinary upper-bound clamp semantics.

The 9 M-pixel and 4096-side constraints apply only to an **upgrade above 2**.
They are not new global allocation limits: an existing 3840×2160 logical
viewport at density 2 is preserved, rather than silently downgraded. Pixi rounds
physical dimensions to whole pixels, so the continuous area bound is
approximately 9 M after rounding. At the measured 1600×900 and 1920×1080
boundaries, the physical result is exactly 4000×2250.

Hub and Boneyard initialization and resize both supply the current logical
dimensions. Density changes on resize are deterministic; there is no frame-rate
quality fallback or dynamic resolution fluctuation. Explicit low-density callers
remain capped even when more budget is available.

## Verification boundary

Focused pinned Node 22.17.0 / npm 10.9.2 tests cover density 2/2.5/3/4,
phone/tablet/desktop and long-aspect sizes, resize/display-scale transitions,
both budget constraints, missing/invalid inputs, explicit maxima, and an
independent legacy-formula matrix. The helper and viewport suite passes 27/27.

The combined visible Apple M2 Chrome source-module run passed 80 constructor and
resize cases and 20 complete GPU/DOM teardowns. Both Hub and Boneyard retain
pixel-identical full buffers under a density-policy-only DPR2 control. At desktop
1600×900, DPR2 uses 3200×1800; DPR2.5 uses 4000×2250; DPR3 remains bounded at 4000×2250
(backing/display ratio 5/6 rather than legacy 2/3). At phone 844×390, displayScale
.4333 keeps effective renderer density 1.3 at DPR3 and full 2532×1170 backing;
there is no density upgrade there. Tablet 1366×1024 at DPR3 uses 3465×2597 within
approximately 9M pixels. Exact CSS layout quantization and ratios are retained in
receipt 703c1867cfe7aa0640171035b0ac3658a30077b6ed083b5d109a46c997d3dc9f.

These emulated viewport results do not claim physical mobile or dense-combat
performance. The maintained full gate and deployed-client acceptance remain
release-coordinator obligations. See ledger 302 for separate native sampling and
composition proof, including limitations.
The broad 512×512 editor-ground capture remains an explicitly separate native
owner-recovery debt under ledger 272; this policy does not close it.
