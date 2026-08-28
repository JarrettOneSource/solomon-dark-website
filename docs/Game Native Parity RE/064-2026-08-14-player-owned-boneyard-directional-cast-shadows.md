# 2026-08-14 — Player-owned Boneyard directional cast shadows

## Reported discrepancy

The browser Boneyard has the player's light-map glow and per-object tint, but
not the stock directional black shadows projected from nearby fences, trees,
gravestones, and adjacent scenery. The visible source appears beside the
staff/orb, so source ownership and the shadow geometry path both had to be
recovered before implementation.

## Native evidence and confidence

All static addresses below are from preserved retail `SolomonDark.exe`,
SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.

| Finding | Evidence | Confidence |
| --- | --- | --- |
| Source owner | Player provider `0x005299A0` calls sibling Region submitter `0x00580130` at player position plus 15 world units along heading, with radius `2.6`, intensity `1`, and flag `1`. Prior live manager sampling independently recovered the same record. | high |
| Stock setting state | Retail initialization maps `Game.ComplexLighting`, `Game.ComplexShadows`, and `Game.MultipleShadows` to `0x00B3BCA8..AA`. Complex Lighting and Complex Shadows default true. Multiple Shadows defaults to platform capability `0x00B3BCAE`, true on shipped Windows; the captured sandbox profile explicitly records a false override. | high |
| Shadow record builder | `0x0057F0E0` clears and fills the per-object list at `+0xAC` only from in-range sources whose shadow flag is nonzero. Its 0x24-byte records contain unit source-to-object direction, source point, base alpha factor, one-unit-behind light sample, normalized elliptical distance, projection distance, and radius. | high |
| Multi-source rule | For multiple records, `0x0057F0E0` pairwise attenuates base alpha with `max(dot(directionA, directionB), other.distanceFraction)`. This is separate from raster-source containment. | high |
| Projected geometry | Shape closer `0x00655570` stores authored `(edge.dy,-edge.dx)` without winding normalization. Helper `0x00655970` accepts strict-positive `dot(normal, midpoint-source)`, radially projects both endpoints by `(145 - RandomFloat()) * radius`, and emits a black quad. Object-edge alpha is the record base factor; projected-edge alpha is `((1 - behindScalar) * (1 - distanceFraction))^3`. | high |
| Direct caster ownership | Tree painter `0x00608AB0`, Gravestone `0x0060F260`, and Fencepost `0x00612DC0` consume class/variant outline tables through `0x00655970`. FenceGrate painter `0x00600ED0` uses the sibling projected-mesh path. | high |
| Visible oracle | Clean-stock Boneyard capture `boneyard-re-direct-mode0-settled.png` visibly shows long source-opposed black projections from nearby tree and fence silhouettes under the forward orange player light. | high |

The player source flag is always `1`, while Lantern provider `0x005E6220`
passes the retail Multiple Shadows byte. Therefore this is not
a Lantern-only or orb-sprite effect: the player owns the normal stock
cast-shadow source whenever its existing drive-state light predicate permits
the source. The staff/orb presentation follows the same heading and is the
likely visual motivation for the offset, but it does not own the Region record.

## Native contract and adjacent-system sweep

- Ownership: Region owns the source field; the player provider owns the
  forward source; the common Puppet dispatcher owns per-caster query timing;
  each scenery/fence painter owns its outline and shadow draw immediately
  before its main art.
- State and timing: sources are rebuilt every Arena render. Shadow records are
  presentation state only and are not serialized, simulated, interpolated, or
  replicated. Native's sub-radius projection jitter consumes presentation RNG.
- Geometry: source distance uses the same `x/r`, `y/(0.85*r)` ellipse and
  145-unit cutoff as scalar lighting. Authored edge order and the strict
  `dot((dy,-dx), midpoint-source)>0` predicate decide which edges project; the
  result is not a fixed drop shadow or blurred oval.
- Render order: in the Complex Lighting branch the Region light texture first
  multiplies the pre-main lanes. Each painter then emits its shadow quads and
  main sprite/mesh within shared world painter order. Ordinary source-alpha
  blending creates the tapered black projection.
- Collision and authority: the outline is presentation geometry. It neither
  changes gameplay collision nor blocks the light field, and no shadow state
  belongs in snapshots or host authority.
- Lifecycle: a caster or accepted source disappearing from the current frame
  removes its work immediately. No retained particle/fade object owns the
  shadow.
- Adjacency: Complex Shadows xrefs also cover Monument, Building, Goodie,
  Scrub, Rails, Wall, and other scenery/fence painters. The browser seam must
  therefore be one shared Boneyard system, not three type-local effects.

## Implementation consequence and acceptance

- Add a shared Boneyard complex-shadow model that consumes the already
  accepted Region light candidates. Preserve the source flag independently
  from source-containment acceptance; the ordinary player always participates,
  while Lantern participation follows the active Multiple Shadows profile.
- Give each supported resident its recovered authored outline. Because the
  web port already owns exact registered native alpha art but has not extracted
  every runtime-initialized outline coordinate, derive a simplified convex
  silhouette from that alpha at asset-build time. Keep this approximation
  explicit and replaceable; do not substitute an axis-aligned rectangle.
- Emit tapered black projected edge quads at the caster's painter root before
  its main art. Include static scenery, fence posts/bodies, and moving gate
  leaves through the same model; do not alter world units, camera FOV,
  collision, simulation RNG, protocol, or multiplayer state.
- Focused pure tests must pin the flagged-source gate, native elliptical
  cutoff, source-opposed projection, facing-edge selection, opacity endpoints,
  pairwise multi-source attenuation, and stable silhouette construction.
- A real browser/WebGL Boneyard receipt must show a player-relative shadow
  direction change around fences, trees, and gravestones, report nonzero
  caster/record/quad diagnostics, retain zero page errors, and be inspected
  against the clean-stock image. The canonical `./scripts/validate.sh` gate
  must pass on the exact implementation tree.

## Bounded unknowns and falsifiers

- This historical subsection predates the later `Complex shadows v3` and
  complete-system closure. The hand-authored Tree, Gravestone, Fencepost,
  Monument, Building, and Goodie tables are now extracted, while grate, Gate,
  Rails, Wall, and Scrub own class-specific programs. Alpha-derived convex
  outlines are fallback-only for still-unknown classes.
- Exact global presentation-RNG sequencing is neither available nor gameplay
  relevant. The browser may use stable presentation-only jitter within the
  recovered inclusive `[144,145] * radius` lattice, but must not consume simulation RNG
  or make network-visible state.
- Falsifiers are a circular blob beneath every object, projection toward the
  source, shadows from an enabled-profile Lantern but not the player, shadows
  that survive source/caster removal, a protocol field for shadow state, a
  shadow layer that darkens HUD/foreground proxies, or no visible direction
  change when the player crosses a caster.

## Implementation validation receipt

- `boneyard-complex-shadows.ts` now owns the shared presentation-only record
  and edge model: the native source flag and ellipse gate, source-to-caster
  direction, one-unit-behind light sample, pairwise multi-source attenuation,
  inclusive `[144,145] * radius` projection range, facing-edge selection, and recovered
  base/tip alpha endpoints. Its jitter is stable presentation state and never
  consumes simulation RNG.
- `boneyard-complex-shadow-presentation.ts` submits black tapered projections
  immediately below each owning resident's painter depth, rebuilds moving Gate
  leaf silhouettes from their live native quad, and removes dynamic views on
  the same frame as their caster. Static outlines are bounded convex hulls of
  the exact registered native alpha art; the still-unrecovered retail outline
  table coordinates remain the explicit approximation recorded above.
- Five focused tests pass for source filtering/cutoff, presentation jitter,
  multi-source attenuation, source-opposed edge projection and alpha, and
  stable non-rectangular silhouettes. On the final tree rebased to
  `origin/main` at `3eb6171`, `./scripts/validate.sh` passes the backend build,
  all `23` Website/backend contracts, formatting, lint and architecture
  boundaries, all `431` frontend tests, all `5` desktop tests, production
  frontend/host builds, and production media policy.
- Chrome `150.0.7871.124` at `1600 x 900` exercised the real Pixi WebGL2
  renderer. Moving the player source across a synthetic Tree, Gravestone, and
  Fence reversed the projections and changed `1,261,177` pixels with
  `104,302,938` aggregate RGB-channel delta. The exact generated retail scene
  rendered `492` static layers and `603` paints with `14` visible shadow
  casters, `14` records, and `73` projected edge quads over 30 yielded frames,
  averaging `3.95 ms` per render with zero page, console, or HTTP errors.
  Inspected receipts are `/tmp/solomon-dark-complex-shadows-left-final.png`,
  `/tmp/solomon-dark-complex-shadows-right-final.png`, and
  `/tmp/solomon-dark-complex-shadows-generated-final.png`.
