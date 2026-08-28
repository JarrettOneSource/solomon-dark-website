# 2026-08-20 — Fireball contact, secondary cooldown, picker, player-light, and title-identity audit

## Reported smells and evidence boundary

This pass was requested after five observable mismatches: Fireball hitboxes,
right-click cooldown cadence, level-up offer selection, a recently over-bright
player light, and the logged-in name moving away from the title's left corner.
They cross four native owners, so each is traced independently rather than
sharing one visual or timing patch.

The static oracle is the 4,723,200-byte retail `SolomonDark.exe`, SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
Fresh read-only Ghidra work covered Fireball tick/contact `0x005FDD90` /
`0x005E5160`, line walker `0x00524D70`, point query `0x00641220`, secondary
belt input `0x005D5600`, dispatcher `0x0054CC50`, StaffCast2
`0x0044B7E0/0x0044B770`, cooldown arming/recharge
`0x00661F40/0x00656E70`, and offer builder `0x0067CB70` plus its category and
eligibility helpers. The existing lighting report remains authoritative for
`PlayerWizard 0x005299A0`, common painter `0x00624B40`, and environment-player
pass `0x00470EE0`; no brightness constant is inferred from a screenshot.

| Smell | Current web observation | Native result | Confidence |
| --- | --- | --- | --- |
| Fireball scenery collision | actor combat queries mask `0x2`; terrain lookahead reuses the complete player movement world | query mask is `6`; stock hits five flag-`0x4` scenery actors, including Gravestone, while mask-`0x700` terrain ignores grave/fence polygons | high |
| secondary cooldown | Phasing/Teleport capacities and radial HUD exist, but timers always drain by one, omit the fixed common gate, and no shared cast action blocks immediate zero-cooldown repeats | accepted ordinary casts own StaffCast2 no-interrupt occupancy and a 150-tick common timer; longer row timers drain independently by max of Focus and category recharge factors | high |
| skill offers | the nine-phase shape was present, but a later controlled 100-roll pass found missing exact-ID insertion uniqueness and wrong RNG ownership for Welding/final shuffle | category 4 remains unique; category 1 alone escapes its cross-ID family retry after 50 collisions; exact IDs never repeat | superseded by the 2026-08-25 differential |
| player lighting | the recent mode-1/2 direct record-18 pass visibly brightens the composed player and nearby ground | stock draws the same record after the main actor queue with `SRCALPHA,ONE` and alpha `.2375..25`; current browser center alpha is 61/255 and matches the native branch | high; verified already at parity |
| title identity | save work changed fixed-stage anchoring and CSS to top-right | established title account placement is logical `(11,12)`, top-left | high |

## System boundary and membership inventory

| Member / branch | Native owner | Required disposition | Regression contract |
| --- | --- | --- | --- |
| Fireball hostile actor contact | `0x005FDD90 -> 0x00641220`, flag `0x2` | preserve existing damage contact | enemy hit still consumes and publishes impact |
| Tree `2001`, radius `8` | flag-`0x4` actor constructor `0x005E46D0` | exact-port scenery contact | strict distance `<28` consumes without damage |
| Monument `2009`, radius `1` | `0x005E0DB0` | exact-port scenery contact | strict distance `<21` |
| Gravestone `2029`, radius `.01` | `0x005E5C30` | exact-port scenery contact | strict distance `<20.01`; large grave polygon is not used |
| Building `2040`, radius `1` | `0x005F2C30` | exact-port scenery contact | strict distance `<21` |
| Goodie `2061`, radius `20` | `0x005E3D60`, flags `0x2004` | exact-port scenery contact | strict distance `<40` |
| Fence/Fencepost | actor flag zero; line masks `0x100` | preserve non-contact | Fireball crosses their player-blocking geometry |
| Gravestone promoted polygon | line mask `0x600` | preserve non-contact | five-tick lookahead ignores it |
| Monument/Building/Wall terrain | line mask zero | exact-port blocking | lookahead still creates terrain impact |
| Phasing row cooldown | authored 1 second at 100 fixed ticks | exact-port native subsumption by the longer common gate | row current clears; its fan displays common 150/150 and reaches ready after 150 neutral or 75 rank-1 Focus updates |
| Teleport row cooldown | authored 60 seconds at 6,000 fixed ticks | preserve and apply shared recharge | its row fan remains after the 150-tick common gate; other slots then become available |
| progression-wide cooldown | constructor `0x006594E0`, `+0x68=150`; arming `0x0065EDE0`; recurrence `0x00656E70` | exact-port fixed common right-click gate | every dispatcher success gates all slots for 150 ticks, independent of longer row timers |
| other 21 category-2 rows | no authored `mCooldown` | keep row capacity zero; add shared action ownership where native does | no invented timer, no immediate ordinary recast during StaffCast2 |
| Firewalker toggle-off, Mindstar, Regenerate | dispatcher state-only branches | no common StaffCast2 | state transition remains immediate/actionless |
| Dampen | mode-21 CastSpin | preserve specialized 73-tick action | never replace with generic StaffCast2 |
| Focus row 60 | progression `+0xD0`; concentrated roll in `0x00661F40` | exact-port learned recharge factor; concentration remains out-of-system until selection state exists | rank-one drains two; no invented concentration RNG |
| Faster Caster row 70 | progression `+0x94` | exact-port secondary action duration | float32 recurrence shortens occupancy by rank |
| equipment `FX_RECHARGECLASS` | progression `+0xD4[category]` | out-of-system until the equipment-effect producer is modeled | baseline stays one, not a guessed item bonus |
| category-4 offer collision | helper `0x0067BFA0` | verified already at parity | at most one category-4 option |
| category-1 offer collision | builder counter in `0x0067CB70` | verified already at parity | a single eligible row can fill all slots after 50 retries |
| desired 3/Creativity 4, root/general pools, forced prefix, welding, learned pruning, attempt-100 fallback, attempt-200 stop, final shuffle | `0x0067CB70` and helpers | verified already at parity | existing phase tests plus exact duplicate-row fixture |
| Region analytic player source | `0x005299A0 -> 0x00580130` | preserve radius `2.6`, intensity `1`, heading offset `15` | no guessed scalar dimming |
| environment modes 1/2 direct player pass | `0x00470EE0` | preserve additive record 18 at alpha `.2375..25` | bounded transparent surface remains exact |
| direct-pass painter order | main queue flush `0x0046FDAA`, then player pass `0x0047128F..0x00471417` | verified already at parity | player and ground both receive the stock late additive aperture |
| signed-in / signed-out title label | title fixed stage | restore left/top anchor and CSS | exact text at logical x 11, y 12 for both states |

## Native ownership and recovered contracts

Fireball has two collision lanes. Every tick, after movement, the current-cell
actor query uses radius 20 and mask 6. Flag-4 scenery contact removes the
projectile and creates the normal burst/audio but does not dispatch damage.
Every fifth tick, before movement, the five-velocity lookahead passes exclusion
mask `0x700` to the terrain walker. Grave mask `0x600` and fence mask `0x100`
are ignored; zero-mask monuments, buildings, and walls block. The answer to
the reported question is therefore yes: Fireball collides with gravestones at
their almost-point actor roots, not at their large navigation polygons.

The secondary belt first checks pause, the wizard no-interrupt latch, the
progression-wide timer, and the selected row timer. An accepted ordinary cast
installs StaffCast2. At neutral speed its float32 `.1` progress crosses strict
`>5` after 51 updates and uses attachment pose 9. Faster Caster multiplies that
progress. Successful casts then arm the authored row timer, clear active row
currents strictly below the fixed common capacity, and set the progression-wide
timer to 150. That common value blocks all right-click slots while longer row
timers remain private. Progression drains every row by `max(Focus recharge,
category recharge)`, drains the common timer by Focus, and clamps both lanes at
zero.
Concentrated Focus can skip arming on RNG values `75..99`, but the current web
book has no concentration-lane producer, so that branch is explicitly deferred
instead of approximated.

This audit followed all visible phases from private seed construction to the
final full-range shuffle, but its parity conclusion was later falsified by the
2026-08-25 controlled differential. Category-4 exclusion remains permanent and
category-1 cross-ID collisions alone escape after 50; exact-ID uniqueness and
the active-gameplay-RNG phases were missing here.

The lighting audit found no parity defect to tune. Native main-queue flush
`0x0046FDAA` precedes the mode-1/2 branch, and `0x00471338` multiplies the
`.95..1` sample by the exact qword `0x007DE8F0 = .25` before record 18 is drawn
additively. The browser's full-page mode-2 idle journey measured center RGBA
`(255,255,255,61)`, `plus-lighter`, which is inside the exact native
`.2375..25` alpha interval. Preserved stock runtime captures
`runtime/direct_testrun_host.png`, `runtime/multiplayer_player_visibility_run_host.png`,
and `runtime/steam_friend_active_pair_visuals_host.png` show the same bright
staff orb, illuminated player material, and bounded ground aperture. A proposed
Region-glyph preprocessing change was falsified by an exact base/current WebGL
comparison: both decoded 1,600-by-900 frames were pixel-identical. It was
removed rather than retained as a placebo. Dimming the player would now be an
intentional non-stock art change, not a parity repair.

The account label is a Website identity adaptation, but its title placement is
an established parity contract. The browser-save change intentionally made it
top-right and updated its smoke to accept that regression. This pass restores
the fixed stage and CSS to logical top-left `(11,12)` while leaving the HUD name
at its separate existing left-side position.

## Web implementation consequence

- Give Boneyard blocking shapes their native line masks and let Fireball alone
  query with exclusion mask `0x700`.
- Publish the five exact flag-4 scenery root targets beside the existing
  Earthquake scenery inventory; Fire contact consumes on those targets without
  creating a damage event.
- Add owner-authoritative secondary cast-action and fixed common-cooldown state,
  apply Focus-derived recharge to common and row timers, and project action
  pose 9 in Hub and Boneyard.
  Bump the strict protocol and initialize the new state in every fixture.
- Do not rewrite the offer builder. Correct its ledger and add the missing
  category-1 retry-escape regression.
- Keep the native player-light provider, late painter order, alpha interval,
  and additive composition unchanged; do not apply a guessed dimming scalar.
- Restore the title identity stage/CSS/smoke to the left corner.

## Validation contract

- Focused authority tests: every five-member scenery radius; strict grave edge;
  scenery consumption with no damage; wall/building/monument blocking;
  grave/fence polygon pass-through; hostile contact unchanged.
- Focused secondary tests: neutral/Faster-Caster action occupancy, silent action
  rejection, Phasing/Teleport capacities, rank-one Focus drainage, zero-timer
  ordinary ability lock, and actionless state branches.
- Picker test: a book with only one eligible category-1 row must reproduce four
  duplicate offers after the exact retry escape, while category 4 remains
  unique.
- Render/UI tests: pose 9 during the host-authored action, preserved direct-pass
  constants/order, and exact title-left anchor.
- Real browser journey: Fireball into a grave root and a grave polygon edge;
  repeated right-click with visible cooldown/action behavior; level-up picker;
  mode-1/2 player-light before/after pixel receipt; signed-in title at left.
  Acceptance requires no page, console, protocol, asset, or WebGL error.

## Confidence and open boundaries

All native facts above are high confidence static results. The picker and
player-light appearance are verified-already-at-parity results, not speculative
rewrites. Concentration selection and equipment recharge-class effects remain
outside the current web state model and are named rather than faked. The
lighting differential is closed: the hypothesized glyph preprocessing change
altered zero decoded pixels, while the current full-page direct aperture and
preserved native captures agree on the visibly bright player result.

## Implementation validation receipt

- The rebased Website implementation carries both this system and the
  concurrent Ether tracking correction. Fireball now queries the five exact
  flag-`0x4` scenery roots and the mask-`0x700` terrain lane; secondary state
  carries StaffCast2 occupancy plus the 150-tick progression-wide cooldown;
  protocol 35 carries those fields strictly; the title identity is fixed at
  left/top. The audited picker and player-light code were left intact except
  for regression coverage and a focused browser fixture.
- Windows Loader static RE coverage passed `504/504`. Windows Website
  TypeScript, lint, and architecture boundaries passed. The secondary/save
  prerequisite suite passed `155/155`; the broad game suite passed
  `1,029/1,030`. Its sole failure is the pre-existing Windows file-URL assertion
  in `web Lua resolves source and deployed WASM ownership`; this branch has no
  diff in that test or its path resolver. The unrelated unclaimed-session test
  that timed out on WSL passed on Windows. The remaining Windows canonical
  gates passed: 25 backend contracts, 5 level-up, 6 diagnostics, 14 Hub UI, 5
  desktop, backend Release build, production frontend/game-host build, the
  68,823-byte gzip game budget, and media policy.
- Final Windows 1,600-by-900 Chrome Fire receipt struck generated Gravestone
  `object-30` at root distance `16.25139140752614`, below the strict native
  `20.01` edge, retired the projectile, and published the ordinary impact with
  empty page/application-console errors. Capture:
  `C:/sdw/receipts/fire/solomon-primary-fire-boneyard-impact.png`.
- Final Windows right-click receipts exercised Phasing's common-only fan and
  Teleport's longer private fan in WebGL2, observed Staff pose 9, both native
  effect/audio families, and empty page/application-console errors. Captures:
  `C:/sdw/receipts/secondary/15-phasing.png` and
  `C:/sdw/receipts/secondary/48-teleport.png`.
- Final Windows picker receipt presented exact skill IDs `16,21,56` at logical
  centers `600,800,1000`, completed one Sorceror reroll, save/pick and queued-offer
  transitions, booked skill 49, released the input barrier, and retained the
  expected sound sequences in a WebGL2 1,600-by-900 surface with empty errors.
  It also observed presentation ID 1 with 49 live particles. Capture:
  `C:/sdw/receipts/picker/skill-picker.png`.
- Final Windows mode-2 idle lighting measured RGBA `(255,255,255,61)` at the
  player center with `plus-lighter`, exactly preserving the native late
  additive aperture. The final Windows signed-in title receipt rendered
  `ParityWizard` at logical `(11,12)` on the WebGL title with empty errors.
  Captures:
  `C:/sdw/receipts/lighting/solomon-primary-air-boneyard-idle.png` and
  `C:/sdw/receipts/title/solomon-title-left.png`.
