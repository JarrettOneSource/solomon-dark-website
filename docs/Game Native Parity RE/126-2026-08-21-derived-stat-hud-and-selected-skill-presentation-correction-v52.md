# 2026-08-21 — Derived-stat HUD and selected-skill presentation correction (v52)

> **2026-08-29 correction:** the v52 receipt proved dynamic geometry, but its
> claim that Magic Shield presentation was exact did not cover the native
> additive blend, third-strip construction, equality tie, or poisoned `UI.52`
> sibling. Those dispositions are superseded by the reopened compositor
> closure in `132-2026-08-21-local-player-hp-meter-depletion-direction-audit.md`.

The user-reported smell is correct: Website current main computes Health Up and
Mana Up maxima, but `GameHud` keeps both meter tracks at a fixed 110 pixels and
both fill images at a fixed 102 pixels. The v49/v51 closure therefore missed a
downstream presentation consumer. This entry supersedes only those affected
status cells; the already verified gameplay, world VFX, lighting, audio, and
lifecycle owners remain closed.

### Evidence and baseline

| Source | Finding | Confidence |
| --- | --- | --- |
| retail `0x005D2520` instructions `0x005D2C02..0x005D33F2` | meter length is derived from base and maximum HP/MP before current-ratio clipping; `0x007DE8F0` is double `0.25` | high |
| repeated strip `0x00415230` | track, fill, reserve, and shield consume the requested dynamic width; this is not a transform applied after drawing | high |
| owned native vital capture, binary SHA `03a83456...f1e3` | default, rank-one, half-current, reserve, shield, and authored-maximum states reproduce the formulas and fixed opposing anchors | high |
| owned selected-skill captures plus `0x005D367A..0x005D399F` | binding 12 is selected primary; 16/20 are concentration A/B; exact alpha, scale, record mapping, layout, and order are recovered | high |
| Website `GameHud.tsx` / `hub.css` at `a2f749eb` | squared/linear ratios, reserve, and shield ordering exist, but dynamic core/track geometry, concentration emblems, Weld identity, and Plane Orb override are absent | high |

The native core formulas at stock base HP 50 / MP 100 are:

```text
healthCore = 2 * (50 + 0.25 * (maximumHealth - 50))
healthTrack = healthCore + 10
healthVisible = healthCore * clamp(currentHealth / maximumHealth, 0, 1)^2

manaCore = 100 + 0.25 * (maximumMana - 100)
manaTrack = manaCore + 10
manaVisible = manaCore * clamp(currentMana / maximumMana, 0, 1)
```

With concentration B empty, Health keeps track/core right edges at native
`750/745` and grows left; Mana keeps track/core left edges at `850/855` and
grows right. Occupied B shifts both tracks outward by 20, to Health `730/725`
and Mana `870/875`; the September 27 report 41 reopening below corrects the
previous unconditional-anchor claim. Rank-one 100 HP and
200 MP each produce core 125 / track 135. Authored maximum ranks produce HP
core 425 / track 435 and MP core 412.5 / track 422.5; stock applies no authored-
rank width cap. Reserve uses the dynamic mana core and its right edge. Magic
Shield uses the dynamic health core and preserves shorter-first/longer-last
layer order.

### Complete affected membership

| Member | Native consequence | Current Website disposition before implementation |
| --- | --- | --- |
| Mana Up 56 | maximum MP and dynamic meter width | maximum exact; geometry missing |
| Health Up 64 | maximum HP and dynamic meter width | maximum exact; geometry missing |
| equipment `FX_MAXHP` 23 / `FX_MAXMP` 24 | ordered transforms can grow, shrink, or fractionalize the same widths | maxima exact; dynamic geometry missing |
| Hagatha Life Charm 0 / Mana Charm 1 | each multiplies its maximum by 1.25 before the same HUD consumer | ownership/economy present; both derived effects and geometry missing |
| current HP/MP writers: damage, poison, healing/orbs, spell costs, recovery, potions, Magic Circle 49, Channel Mana 57, Meditation 58, Regenerate 79 | ratio/fill only; no geometry change or HUD pulse | mechanical owners retained; shared geometry must consume their authoritative current values |
| reserve writers: Firewalker 23, Mindstar 78, Regenerate 79 | right-side `UI.41` segment over dynamic mana core | reserve state exact; dynamic width missing |
| Magic Shield 54 / Explosive Shield 55 | cyan `UI.26` layer over dynamic health core | shield state/order exact; dynamic width missing |
| pure selected primaries 8/16/24/32/40 | selected row's Skills record at native 0.75 scale/alpha | element-family image exists; shared native emblem owner missing |
| Spell Welding 52, all ten builds | active build-specific selected-primary Skills record | in-run build identity missing |
| Planewalker 12 / Plane Orb 80 | active primary becomes Plane Orb record 107 until restore | gameplay override exact; in-run emblem override missing |
| concentrations 57..63 and 65..71 | selected A/B records 84..90 and 92..98 | selection/runtime exact; both in-run emblems missing |
| Split Mind 21 | primary/B/A centers 760/800/840; A-only uses primary/A 780/820 | state exact; cluster layout missing |
| Mind Chug potion | all concentration consumers active and selection locked; no extra emblem/buff row | mechanics exact; negative HUD disposition retained |
| remote ally rows and world nameplates | fixed authored widths using health ratio | already correct; explicitly excluded from local maximum-driven growth |
| DamageX4, Earth charge, wave/score/status timers | no additional retail in-run HUD member | negative dispositions retained |

The complete 82-row rescan found no second world/player/enemy VFX, light,
audio, actor, or replication producer hidden behind Health Up or Mana Up.
The residuals are the shared local-meter consumer and shared selected-skill
emblem owner above. Passive Health Up 64 is not category 3 and must not receive
a concentration emblem.

### Lifecycle and validation contract

- Skill choice, equipment change, Hagatha purchase, new-run reset, and level
  reset must publish the resulting maxima and preserve the existing native
  ratio/full-reset rules. Snapshot equality must compare maxima, not only
  current values and revision.
- One pure presentation module must own all core/track/fill/reserve/shield
  widths and selected-skill records/centers. React/CSS consume its output and
  do not reconstruct native rules.
- Per-member regressions must cover default, rank one, authored skill maximum,
  fractional/shrinking equipment results, Life/Mana Charm, half-current,
  reserve, shield crossover, all 14 reachable concentrations, both Split Mind
  layouts, all five pure primaries, all ten Weld builds, and Plane Orb.
- Browser proof must measure DOM rectangles/anchors and rendered Skills records
  in Hub and Boneyard, then run the canonical gate on Linux, native Windows, and
  the Mac mini. The Mac is a separate browser receipt, not inferred from unit
  tests.

A nearby Mod Loader current-main defect was also found while obtaining this
evidence: `[gameplay.pause]` split `[gameplay.globals]` in
`config/binary-layout.ini`, causing every later gameplay-global key to parse
under the wrong section and blocking a current Release launch at
`cursor_secondary_at_mouse`. The Mod Loader task branch moves the pause section
before the complete globals section and requires a section-ownership
regression. That configuration correction is independent of the Website
presentation implementation but required for reproducible native evidence.

### Implementation and cross-platform receipt

- `native-hud-presentation.ts` is the sole web owner of native vital geometry
  and selected-skill binding presentation. `GameHud` projects its values through
  CSS variables. Default track/core rectangles are exactly
  HP `[640,14.5,750,34.5]` / `[645,19.5,745,29.5]` and
  MP `[850,14.5,960,34.5]` / `[855,19.5,955,29.5]`. The browser box-model
  regression measures both outer and inner rectangles so the two-pixel ridge
  cannot silently shift the native five-pixel inset.
- Health/Mana Up, equipment maximum transforms, Mindstar effective ranks, and
  Hagatha Life/Mana Charms now converge on the same authoritative maxima and
  shared geometry. The two charms apply the recovered `1.25` final-maximum
  factor independently. Snapshot equality includes both maxima, closing the
  zero-current/dead-owner update edge.
- Reserve and Magic Shield consume their expanded cores. The accepted
  maximum-125/250 charm witness has 137.5-pixel cores, a 27.5-pixel
  50-of-250 reserve ending at `x=992.5`, and a 50-percent shield over
  `[607.5,19.5,745,29.5]`.
- Binding presentation covers five pure primaries, all ten Weld build records,
  Plane Orb 107, and every reachable concentration record. The exact Split Mind
  browser witness is primary/A/B draw order with centers `760/840/800` and
  records `67/84/85`. Passive Health Up 64 remains excluded.
- The current-main rebase preserves the concurrent mobile quickbar/potion
  controls and shared book-pause policy. The existing Skill Book smoke now
  releases its authoritative book pause before injecting test-only learned
  state, then reopens the same book; the real duplicate-quickbar and Fireball
  selection journey remains green.

Exact code cutoff `a8c955726938d01f880efb4860abb5ef5213230f` is one commit
above Website `origin/main` `1361f097cf9ff2676e5c01c7b822f44b52a1220a`.
Linux, native Windows, and the arm64 Mac mini each ran the unchanged canonical
`./scripts/validate.sh` entrypoint with Node `22.17.0`, npm `10.9.2`, and
.NET SDK `10.0.302`. Every accepted run passed 13 backend contracts, lint and
architecture boundaries, 41 loot tests, 218 focused/pretests, 1,237 broad
game/frontend tests, 17 party tests, 10 level-up/HUD tests, 7 diagnostics
tests, 17 Hall tests, 15 Hub UI tests, 5 desktop tests, production builds,
media policy, and the bundle gate. The production game entry is
`Game-BonTeEJ0.js`, 346,628 raw / 98,018 gzip bytes. Only the eight existing
Fast Refresh warnings remain.

The first cold Mac full run recorded one unrelated Web Lua timing failure:
p99 `25.798 ms` exceeded its 20 ms/two-tick gate while the other `1,236` broad
tests passed. The isolated six-test Web Lua suite immediately passed on the
settled machine, and the complete canonical rerun then passed all `1,237`
broad tests plus every remaining gate. The retained logs are
`/Users/jarrett/codex-acceptance/native-derived-hud-a8c9557-mac-validate.log`
and `native-derived-hud-a8c9557-mac-validate-rerun.log`.

Linux Chrome, Windows Chrome `151.0.7922.170`, and Mac Chrome
`151.0.7922.170` returned identical measured HUD contracts:

- default tracks `110` and cores `100` at the native anchors;
- Health/Mana Up plus Life/Mana Charm tracks `147.5` and cores `137.5`;
- dynamic reserve/shield geometry above;
- selected Earth 67, Split Mind 67/84/85, Weld 81, and Plane Orb 107;
- empty page, console, and network error arrays.

Screenshots are `/tmp/solomon-dark-native-derived-hud.png`
(SHA-256 `393d96f67502100c42e419660f37716f3bec7ad77689365343fbefbcb26d0cf1`),
`C:/sdw/receipts/native-derived-hud-a8c9557-windows.png`
(`26d4b0e06a7e883d372b147963af5cadf026d8449e6b63a3d40dcb0bf951a0f8`),
and
`/Users/jarrett/codex-acceptance/native-derived-hud-a8c9557-mac.png`
(`ee86b9dafea19ca35346cb49de9a1edf390fd56e7cf09bd0dbd026008e46eec9`).

Mod Loader evidence cutoff `ced002e3d54374afb4954cbdbf4e37a7ee4349cc`
passes 88/88 ordinary modules (801 tests) and 491/491 static RE contracts on
Linux and the Mac mini. Native Windows additionally passes the six derived-HUD
contracts, all 491 static contracts, and the complete Release build with zero
warnings/errors. The x86 loader build is correctly Windows-only; no Mac binary
build is claimed. No member remains blocked by the browser platform.


## 2026-09-27 — Report 41: Split Mind concentration and meter overlap

### Evidence and causal model

Two archived screenshots show selected concentration art crossing the mana
track's left edge. Their SHA-256 values are
`ac297257628b9c90d1815746825e8b50555e0a8352a19524557341ddf2ba3444`
and `88953fc8b2b8d35fc3b6a006f968cef61b2f16f92a0c0dc6ecbbb12bd6cee1b7`.
The reporter suggests grouping icons closer. Native instructions establish
that the missing behavior belongs to the meter anchors instead.

Fresh read-only Ghidra 12.0.3 slot 01 recovery verifies retail 0.72.5,
4,723,200 bytes, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
preferred base `0x00400000`. Existing Mod Loader wrapper/scripts and canonical
project remain unchanged. `0x005D50E0` still lays out primary/B/A centers at
`760/800/840` (single concentration `780/820`); `0x005D367A..0x005D399F`
paints their exact centers with float `.75` scale/alpha. Those values and
40 x 65 click rectangles are already correct.

The previous closure missed two binding-dependent translation branches inside
`Game::RenderHUD 0x005D2520`. Mana pushes binding 20 at `0x005D2CA9`, resolves
it through `0x0046B140` at `0x005D2D18`, compares against -1 and adds double 20
(`0x007DE920`) to X at `0x005D2D2F`. Health pushes the same binding at
`0x005D2F3C` and subtracts double 20 at `0x005D2FBF` after the same occupied
check. Thus the common meter inset from viewport center is 50 with B empty,
70 with B occupied, independently of the A slot. Width/fill/shield/reserve
geometry travels with its owning meter. Fixed web inset 50 omits this native
branch. For Enchant Staff record 92 at center 840, its 41px logical width at
.75 scale reaches 855.375, crossing the old mana edge 850 by 5.375 pixels.
The native occupied-B mana edge 870 clears that art by 14.625 pixels.

### Boundary and membership

The owning system is binding-dependent selected-HUD/meter placement in the
shared Hub/Boneyard GameHud. It includes zero/A-only/B-only/A+B layouts, all
five pure primaries, ten authored Weld icons, Plane Orb, all fourteen valid
concentration records, HUD click rectangles and all child meter layers.
Skill acquisition, concentration mechanics, vital-value writers, dynamic
meter-width calculations and custom mobile repositioning remain separate
owners. Native viewport width-cap branches exist in the surrounding renderer
(`0x005D2C64..0x005D2C93`, `0x005D3042..0x005D3071`); they are separate
from the inward anchor and cannot explain this overlap. No width or fill
formula is changed by this correction.

| Member | Final disposition | Evidence |
| --- | --- | --- |
| Empty/A-only binding cluster and default meter inset | verified-already-at-parity | Default geometry and return after clearing B |
| B-only and A+B meter insets | exact-ported | Exact 70 inset for both meters; no dependence on A or a merely owned charm |
| All primary/Weld/Plane Orb and 14 concentration art records | verified-already-at-parity | Full catalog bounds stay between correct inward edges |
| Native icon centers, 40 x 65 hit rectangles and selector input | verified-already-at-parity | Centers/hits unchanged; real A/B selector activation after reposition |
| Track, fill, poison, Magic Shield and reserve layers | exact-ported through the shared meter parent | All shift together; widths and fill ratios remain unchanged |
| Hub/Boneyard, viewport/UI scaling, touch and lifecycle | exact-ported through the shared GameHud owner | Real desktop/touch scenes and live selection changes with clean errors |
| Vital-value mechanics, dynamic widths, arbitrary custom mobile placement | out-of-system; independent owners | Preserve existing contracts and regression suites |

### Implementation and acceptance plan

Reproduce the overlap through the current real GameHud before edits. Add the
native occupied-B offset to the existing HUD presentation model and feed
both meter CSS anchors from that one value. Do not shrink icons or alter
click targets to conceal the missing branch. Test the binding cases and all
art families; verify live default/Split Mind transitions, selector clicks,
Hub/Boneyard and responsive views. Run all Website checks and built browser
acceptance on Windows/WSL, then publish and clean task paths before report 42.


### Reproduction and initial implementation

The unmodified WSL browser reproduces the submitted layout in a private
profile with Lightning, Enchant Staff A and Rush B. Track inward edges are
-50/+50 relative to center; Enchant Staff reaches +55.375, a 5.375-pixel overlap.
The regression fails on the missing native 70 inset with empty browser/host
error arrays. The baseline screenshot visibly matches the reported overlap.

The repair adds one binding-derived meter offset to the existing presentation
model. GameHud publishes that value to both CSS anchors; every meter layer
moves with its parent. Icon spacing, art, input rectangles, gameplay state and
wire/save formats are unchanged. All 13 focused HUD tests pass, including all
16 primary/Weld/Plane Orb variants across the binding layouts and all 14
concentration records, checking both bitmap and click bounds against the
correct native meter edges. The existing derived-HUD smoke also gains exact
Split Mind anchor assertions. Live complete browser acceptance is in progress.


### Completed preflight before canonical acceptance

The maintained desktop journey passes 24 layout samples, including widths
1280, 1600 and the submitted 2409-pixel aspect, zero/A-only/B-only/full slots,
all 14 concentrations, real addressed A/B selection and Hub-to-Boneyard entry.
Touch at 896x414, DPR2 and 150% UI scale passes 22 samples through the same
selection/lifecycle paths. Both use Chrome 150.0.7871.124 on WSL and have empty
page, console, failed-response and host error arrays. The initial repaired
layout keeps all icon centers and widths identical while moving each meter
20 pixels outward. Both repaired screenshots were visually reviewed.
Application/test TypeScript checks and frontend lint also pass. The full
canonical gate and post-build desktop/touch journeys remain required.

Verified read-only tooling hashes: wrapper
`b02530616ecc07c2e5be468d481778e84eeab35c4032a70005a51920973e9d49`,
`decompile_targets.py`
`899167ca42624e09f26d22233365631a6ee8b3d106e337e20b77574894e97465`,
`dump_function_instructions.py`
`273f6426824849790041dcd0f7a0b25ad9e700458827f3a9db3c34ec3ad50cef`.


### September 27 final Windows/WSL acceptance

Exact candidate `38b5d1d6bdf756b91bed9f2009126d0dced6c272` passes
`bash ./scripts/validate.sh` on `home-wsl` with Node 22.17.0 and .NET 10.0.302:
3,920 Node executions, 24 Python backend/contract tests, zero failures, production
builds and the configured renderer quality gate. The measured renderer slice
retains 100% statement/branch/function/line coverage, 468 killed mutations,
one timeout, 147 compile errors, 24 reviewed equivalents and no survivors or
quality failures. Gate SHA-256:
`bf55f497ecb413d82b6491eb5c0eaae46071333b89d4fbfcdd91511b4e503cb9`.

Dependent production Chrome 150.0.7871.124 journeys pass 24 desktop and 22
touch layout samples. Desktop tests UI scale 100% at 1280/1600/2409 widths;
touch tests 896x414, DPR2 at 150%. All 14 concentrations stay between the inward
meter edges. Empty/A-only layouts use 50; B-only/full layouts use 70. Both
addressed selector clicks succeed, Boneyard entry retains the correct gap,
and clearing B restores 50. On desktop, Enchant Staff ends at +55.375 while
mana begins at +70, leaving 14.625 pixels of separation instead of the baseline
5.375-pixel overlap. Both built screenshots were visually reviewed. Page,
console, failed-response and host error arrays are empty.

No in-scope member remains unknown or browser-blocked. These receipts use a
private learned-skill profile and browser-emulated touch; they do not claim
a physical touch device, an FPS benchmark or independently verified production
deployment. Native placement is instruction-derived. Final job
`job_20260927T091551Z_3cfdfa405f` completed at 2026-09-27T10:00:44Z with all
three exit codes zero. Only this documentation receipt changes after the
accepted candidate. Publication and task cleanup have separate archive receipts.
