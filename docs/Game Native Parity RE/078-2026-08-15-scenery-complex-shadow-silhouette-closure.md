# 2026-08-15 — scenery complex-shadow silhouette closure

## Reopened failure and system boundary

The repeat report that some scenery silhouettes remained wrong reopens the
complex-shadow entry. The earlier pass violated the full-membership rule: it
ported exact tables for the reported Tree/Grave/Monument/Building families but
left an alpha-derived convex outline as the default for unknown objects,
broken FenceGrate, and Goodie states it did not recognize. Native never has a
generic "opaque sprite pixels cast" rule. That fallback made unsupported art
silently become a caster and selected Goodie geometry by visible atlas phase
instead of its stored subtype.

The system boundary is every direct reader of retail
`Game.ComplexShadows` at `0x00B3BCA9`, from common record production through
each class painter and the indexed-gradient submission. A fresh read-only
Ghidra xref census found 19 reads in 17 functions. Excluding settings UI and
four non-persistent actor/effect renderers, the scenery membership is:

| Member | Native owner | Disposition in this pass |
| --- | ---: | --- |
| Tree variants 0..14 | `0x00608AB0`, `0x0081B910` | `verified-already-at-parity` |
| Gravestone selectors 0..16 | `0x0060F260`, `0x0081BE50` | `verified-already-at-parity` |
| Fencepost selectors 0..6, styles 0..1 | `0x00612DC0`, `0x0081B0B8` | `verified-already-at-parity` |
| Monument selectors 0..20 | `0x0060E280`, `0x00819EE8` | `verified-already-at-parity` |
| Building selectors 0..3 | `0x0060EDC0`, `0x0081B430` | `verified-already-at-parity` |
| Goodie subtype 0, every visible phase | `0x0061F180`, `0x0081B390` | `exact-ported` — subtype, not atlas phase, selects the row |
| Intact FenceGrate | `0x00600ED0` | `verified-already-at-parity` |
| Moving Gate | `0x00600ED0` / `0x005ED100` | `verified-already-at-parity` |
| Rails | `0x00607440` | `verified-already-at-parity` |
| Wall | `0x0061E780` / `0x006561A0` | `verified-already-at-parity` |
| Broken FenceGrate | `0x00600ED0` / `0x005EC6E0` | `out-of-system` for the shipped `/game` templates: census is zero; its unrecovered shared-RNG half-segment is no longer replaced by an alpha hull |
| Scrub 2062 | `0x00620120` | `out-of-system` for the shipped `/game` templates: materialized census is zero; arbitrary imported/unknown objects no longer inherit an alpha hull |
| Road, Terrain, compact decoration, unknown object types | no persistent scenery xref | `out-of-system` — not native complex-shadow casters |

The current shipped membership census covers all twelve generated templates:
1,299 Trees (variants 0..6), 3,794 Graves (0..16), four Buildings (1..2),
44 subtype-zero Goodies, 230 intact grates, and 18 Gates. There are no Broken,
Rails, Wall, Monument, or Scrub members in those generated scenes; authored
content still uses the exact recovered programs where applicable.

Evidence provenance is the 4,723,200-byte retail `SolomonDark.exe`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred image base `0x00400000`; fresh read-only pooled-Ghidra xrefs and
decompilation of `0x006046C0`, `0x00607440`, `0x006105F0`, `0x0061E780`, and
`0x00620120`; and the generated-template census at Website `origin/main`
`46b495b67a3d8e923e3535d1c3b26fdec4aea37a`.

Implementation consequence: the renderer has no alpha-derived fallback in the
complex-shadow caster selector. A class must select an extracted authored row
or one of the recovered custom programs. Goodie uses stored subtype zero even
when phase changes its visible DeadHawg record. Unsupported custom programs
remain non-casters instead of shipping a known-wrong silhouette.

## Validation contract

Regression coverage must prove every authored table cardinality, Goodie's
subtype/phase separation, all intact/Gate/Rails/Wall custom programs, and that
unknown objects and Broken bodies cannot fall through to alpha geometry. The
canonical Website gate and Windows Chrome/WebGL `/game` journey must then show
the generated-scene caster census, changing directional shadows, no page or
console errors, and no fallback caster marker.

Validation receipt: `./scripts/validate.sh` passed from the isolated Website
worktree (23 backend tests, 712 frontend tests, five desktop tests, production
build, and media-policy gate). Windows Node 22.17.0 driving Windows Chrome
through `smoke-boneyard-complex-shadows.mjs` passed in WebGL2 with no page,
console, or response errors. The synthetic scene produced five class-owned
casters; moving the light changed 1,245,758 pixels. The first generated stock
scene produced 14 visible casters and 50 projected quads. A second full gate
could not be executed natively on Windows because that host currently has only
.NET SDK 7.0.410 and 9.0.300 while the repository pins 10.0.302; this is an
environment limitation, not a Windows gate receipt.
