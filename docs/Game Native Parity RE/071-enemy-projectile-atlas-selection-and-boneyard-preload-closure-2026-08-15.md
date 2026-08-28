# Enemy projectile atlas selection and Boneyard preload closure — 2026-08-15

## Reported smell and parity question

The real waves flow reached Archer projectile presentation, then repeatedly
threw `Native enemy atlas record was not selected for loading` for
`BadGuys:266` and `BadGuys:255` from `nativeEnemySpriteRecord` before a texture
could be assigned. The parity question is which stock records every reachable
enemy-projectile plan can select, and which Website owner must make those
records resident before the first projectile appears.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Real web runtime | Waves journey; `native-enemy-projectile-view.ts` layer resolution | Archer arrows reached records 266 and 255, but the asset selector rejected both before texture lookup. | high |
| Preserved native executable/catalog | Beta 0.72.5 `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Mod Loader `native-projectiles-and-effects.md`, `native-game-object-catalog.json`, and `native-atlas-consumers.json` | Direct native consumers pin Arrow `0x7DA`, Firebolt `0x7EB`, GuidedMissile `0x7EC`, and DemonBomb `0x7F7` to the record families below. | high |
| Current web source | `native-enemy-projectile-presentation.ts`, `native-enemy-assets.ts`, and `boneyard-textures.ts` | Presentation can select six BadGuys families plus DeadHawg 46..77. The eager glob omitted BadGuys 2 and 270..279; the required-range filter omitted BadGuys 2 and 255..282. | high |
| Deterministic web repro | Vite SSR load of `native-enemy-assets.ts` on the exact Website tree | Resolution failed for BadGuys 2, 255, 266, 270, 271, and 282, while BadGuys 110/112 and DeadHawg 46/77 resolved. | high |

## Native ownership thread and recovered record contract

- Archer callback `0x00477B90` creates Arrow `0x7DA`. Arrow draw
  `0x0060F590` consumes BadGuys 255..266 and 271..282; trail/draw consumer
  `0x005E5EC0` also consumes exact record 2.
- Mage dispatch `0x0047FDE0` can create Firebolt `0x7EB` or GuidedMissile
  `0x7EC`. Firebolt body/trail consumes BadGuys 255..266, with 251..254 owned
  by its impact path. GuidedMissile draw `0x00612960` consumes BadGuys 110..112
  and 381..382.
- Demon event `0x0049A270` creates DemonBomb `0x7F7`. Draw `0x0061A690`
  consumes BadGuys 267..270 and DeadHawg 46..77.
- Rotten Zombie death can create PoisonPool `0x806`. Its native auxiliary draw
  `0x005EDFA0` has no fixed atlas literal in the closed catalog. The current
  Website's DeadHawg 46..77 pool animation remains an already named bounded
  presentation choice; this preload repair does not promote it to an exact
  PoisonPool art claim.
- The complete currently reachable Website set is: fire-arrow effect record 2;
  normal/fire Arrow 255..266; poison Arrow 271..282; Firebolt 251..266;
  GuidedMissile 110..112; DemonBomb 267..270; and PoisonPool DeadHawg 46..77.
  GuidedMissile's native 381..382 sibling range remains GuidedMissile-owned;
  it must not be borrowed by Mage lightning.

Nearby presentation findings remain outside this selection-only repair. The
current Firebolt flight plan spans 251..266 even though stock separates impact
251..254 from body/trail 255..266; current GuidedMissile flight omits its native
381..382 sibling effect; current DemonBomb flight omits its native DeadHawg
46..77 secondary pass; and PoisonPool has no proven fixed atlas record. Making
the currently reachable records resident does not claim those draw plans are
otherwise complete native parity.

The host enemy store owns projectile birth and stable snapshots. Client
presentation maps a snapshot to atlas records. `native-enemy-assets.ts` owns
the eager asset selection and exports `NATIVE_ENEMY_ASSET_SOURCES`;
`loadBoneyardWorldTextures` loads that complete list before
`BoneyardDynamicScene` can construct or update a projectile view. A projectile
view must therefore never discover a missing allow-list entry during a wave.

## Confidence, implementation consequence, and validation contract

- Confirmed: native direct-art families, current Website reachability, the
  selector/filter mismatch, and the Boneyard preload owner.
- Inferred/unchanged: current per-family Website frame cadence and PoisonPool
  presentation; neither is reclassified as exact native behavior here.
- Expand only the BadGuys eager-glob coverage and required selector ranges
  needed by the reachable plan. Do not change projectile simulation,
  replication, draw behavior, or unrelated enemy assets.
- A focused test must enumerate every reachable heading/age/payload plan,
  require all 68 unique atlas records to resolve through the real Vite asset
  module, and retain exact family boundaries so fixing 255/266 alone cannot
  pass.
- App/test TypeScript and the supported Website lint/boundary gate must pass.
  Browser proof is intentionally deferred because this repair was requested
  without a browser run; the deterministic selector repro is the original
  feedback loop.

No Mod Loader document changes are required: this entry consumes existing
durable native projectile/catalog evidence and recovers no new native fact.

## Implementation validation receipt

- `native-enemy-assets.ts` now includes exact BadGuys record 2, glob coverage
  for 270..279, and one required 251..282 range covering all reachable Arrow,
  Firebolt, and DemonBomb records. Existing 110..112 and DeadHawg 46..77
  selection remains unchanged.
- `native-enemy-assets.test.ts` enumerates all current projectile headings,
  payloads, and animation ages, then resolves the resulting 68-record union
  through the actual Vite-transformed asset module. The test failed first on
  `BadGuys:255` and passes after the selector repair.
- The original deterministic resolver now passes BadGuys 2, 110, 112, 255,
  266, 270, 271, and 282 plus DeadHawg 46 and 77. App and test TypeScript pass;
  `./scripts/validate.sh lint` passes backend formatting, frontend lint, and
  game-boundary validation with only the pre-existing Fast Refresh warnings.
- No browser, runtime simulation, renderer behavior, protocol, or projectile
  authority was changed or claimed as revalidated in this repair.
