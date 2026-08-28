# 2026-08-26 — Wraith terminal-VFX runtime preload closure

## Reported smell and parity question

- The controlled performance matrix on exact Website `b41064ae` reached the
  max-rank Ether / mixed-enemy case and then emitted
  `Native enemy atlas record was not selected for loading: BadGuys:20` on
  every presentation frame. The same run had already completed Hub, idle
  Boneyard, SkillPicker, Inventory, Acid Rain, the five-secondary overlap,
  88-enemy idle, and moving/shooting samples.
- Ether is only the damage source that exposed the defect. The failed actor is
  the independently replicated Wraith terminal dissolve core, so the reopened
  system is the complete enemy terminal-presentation preload membership, not
  Ether primary mechanics or an element-specific fallback.
- Earlier enemy-death and shared `Anim_FadeScale` closures already recovered
  the exact Wraith `BadGuys[20]` additive actor. They proved the host actor and
  painter but did not prove that the production Boneyard asset selector could
  resolve every member of the terminal union.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Mac browser | physical-suite Mac preflight, Safari, exact `b41064ae`, `ether_vfx_max_rank` after 32 explicit mixed enemies | a Wraith death creates record 20; the renderer throws the same missing-preload error every frame | high |
| Existing native closure | retail Wraith terminal constructor `0x0047F8D0`, concrete `Anim_FadeScale` vtable `0x00785A84` | the dissolve core is additive `BadGuys[20]`, life `1`, loss `1/36`, scale `1.5` | high |
| Host authority | `boneyard-enemy-store.ts`, `spawnEnemyDeathEffects`, Wraith branch | authoritative retirement creates one `wraith-dissolve-core` with atlas `BadGuys`, entry `20`, additive blend, and a 36-tick lifetime | high |
| Renderer | `native-enemy-death-effect-view.ts` | every replicated terminal actor resolves its source through `nativeEnemySpriteRecord`; there is no alternate or optional record path | high |
| Runtime asset selector | `native-enemy-assets.ts` at `b41064ae` | both the eager import glob and `requiredBadGuysRanges` omit entry 20 while selecting adjacent entries 18 and 21 | high |
| Existing focused coverage | `native-enemy-assets.test.ts` | the hand-authored terminal record union omits 20, so the preload test remained green while the production actor was unreachable | high |

No new retail disassembly is required: the native record, blend, geometry,
clock, actor ownership, and teardown were already recovered. This reopening is
strictly the web runtime ownership link from that authoritative actor to its
resident texture.

## System boundary and sibling inventory

Native/web system: every independently replicated enemy terminal actor from
host creation through asset selection, texture load, draw, and retirement.
Living enemy poses, primary-spell mechanics, and unrelated loot/projectile
actors remain outside this boundary.

| Family | Terminal presentation membership | Disposition before correction |
| --- | --- | --- |
| Skeleton / Archer / Mage | shared bone records `113,115..121`, skull `1819..1822`, Unbind `86`; optional headgear `92..95`, weapon `2063..2066`, pike `15/55`, and armor `100..109` | selected and covered |
| Imp | Unbind `86`, additive banish `15`, sprite array `401..419` | selected and covered |
| Zombie | fragments `2088,2089,2091,2093,2293,2297`, Unbind `86`, clipped `DeadHawg[30]` | selected and covered |
| Wraith | shared bones/skull/Unbind, additive rays `10/11`, additive dissolve core `20`, bouncers `27` | record 20 host/painter exact; runtime preload missing |
| Demon | additive banish `15`, sprite array `401..419`, `Demon[55..61]`, five `DeadHawg[46..77]` fire arrays, and terminal burst `BadGuys[110,251..254]` | selected and covered |
| Coffin | shared bones/skull/Unbind, main fragments `2013..2062`, and extra fragments `DeadHawg[114..144]` / `BadGuys[2067..2069]` | selected and covered |

The inventory has one missing runtime member and no browser-platform variant:
`BadGuys[20]`. It already exists as a nonempty shipped atlas record and asset,
so no art generation, substitution, renderer fallback, or lifecycle change is
permitted.

## Web implementation consequence and validation contract

- Add only `badguys/0020.png` and range `[20,20]` to the closed native-enemy
  runtime selector. Preserve entry 20's existing geometry and the already exact
  additive Wraith plan.
- Add record 20 to the complete terminal preload union and assert that its
  production URL resolves. Keep all six sibling family memberships in the same
  focused contract so the fix cannot become an Ether-only special case.
- Focused red/green proof must reproduce the missing selection before the
  change, then pass the native enemy asset and Wraith terminal suites after it.
- Browser proof must kill a real Wraith through an ordinary primary path,
  observe the independent `wraith-dissolve-core` actor through its lifetime,
  and retain empty page/console/failed-response arrays. The performance matrix
  must then rerun the max-rank Ether case and all remaining element siblings.
- Final acceptance remains the exact-tree Mac canonical gate followed by the
  physical iPhone baseline/stress/restoration matrix. A green focused test or
  a Mac-only frame rate does not close the physical performance request.
