# 2026-08-20 — Late light-source visibility and environment-player pass correction

## Reported smell and parity question

- Reported web behavior: some new Boneyards retain the player's light while
  spell, Solomon Dig Lantern, enemy, and other sources that appear later seem
  not to illuminate the world.
- Stock behavior to recover: Region sources born or admitted after the first
  frame must remain visible in every environment mode; the separate player
  environment pass must not erase them.
- Reproduction: a real Air cast in a generated dark Boneyard produced
  `/tmp/sdr-late-light-air-run1/solomon-primary-air-boneyard-target.png`.
  The Air body/contact art was present, but its world illumination outside the
  player aperture was reduced to the nearly-black post-pass floor.
- Falsifiers: if a player-only renderer cannot admit a later Air source, the
  source manager is at fault; if candidate/accepted/grid counts grow but the
  dark-mode result alone hides the light, the later environment compositor is
  at fault.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| WebGL differential | current `origin/main` `dd4f87e`; modified complex-shadow browser probe | After 120 player-only frames, a new Air birth changed provider candidates `1 -> 2`, accepted sources `1 -> 6`, indexed references `25 -> 67`, and 551,960 output pixels. Dynamic source admission, registration, the retained grid, and Pixi child growth are not the failure. | high |
| Real web journey | Title -> Create -> Hub -> generated Boneyard -> gate -> held Air | The failure-shaped frame occurs in the dark environment presentation while the spell itself remains visible. | high |
| Retail instructions | pinned `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; `0x0046EC80`, `0x00470EE0`, `0x004208A0`, `0x004715C1..0x00472828` | The Region field is complete first. Mode-1/2 player record 18 and the local record-9 target are later additive draws. No fullscreen black/inversion draw exists. | high |
| Exact constants/assets | `0x00785D18/1C/20/28/30/34`, `0x00784E20`; DeadHawg 9/18 | Target scale `2.025000095`, record-9 scale `2.009999990`, center `128`, target/query sizes `256/512`, target alpha `0.95+U(0.05)`, direct alpha `0.25*(0.95+U(0.05))`. | high |
| Existing web source trace | `BoneyardScene.tsx::paintDarkness` | The browser combined player masks, then `source-out` filled the entire viewport black at alpha `.96`. That invented fullscreen operation double-darkened the Region result outside player holes. | high |

## System boundary and membership inventory

Native system: the complete environment-mode player-light pass and its
composition with the already closed Region source field.

| Member | Native source | Disposition after this correction | Proof / consequence |
| --- | --- | --- | --- |
| Region persistent providers: players, Lantern, enemies, actor/transient projectiles, ZAnimLit, secondary actors | `0x0046ECFA..0x0046ED32` plus provider census | `verified-already-at-parity` | later-admission differential plus existing per-family source tests |
| Region MiscLights: Air/Mage path lights and modeled secondary/effect tails | `0x0046ED34` replay plus complete Misc census | `verified-already-at-parity` | age-zero/timeline/source-order tests remain authoritative |
| environment mode 0 | `Arena +0x8F20 == 0` | `verified-already-at-parity` | no player environment pass |
| environment modes 1 and 2 direct player record 18 | `0x0047128F..0x00471417` | `exact-ported` | bounded additive white aperture; no black fill |
| environment modes 1 and 2 local record-9 target | `0x004715C1..0x00472828` | `out-of-system` for the current web actor model | native constructs the target only when either target-mask grid contains a member; no unconditional radial exists |
| multiple visible players | slot loop in `0x00470EE0` | `exact-ported` | independent additive contributions in slot order |
| target-mask grids `Arena +0x8F24/+0x8F84` | 512-square `0x00588040` queries | `out-of-system` for the current web actor model | the Website has no replicated native environment/compact target-mask actor lane; absence cannot be replaced by a fullscreen mask. The native class registrations remain catalogued in the Loader report. |
| Lantern, spell, enemy, and secondary positions outside every player target | Region field only | `exact-ported` | they remain untouched by the bounded player pass |
| HUD and screen feedback | post-world Arena lanes | `verified-already-at-parity` | remain above both light owners |

## Native ownership thread and recovered contract

`Arena::Render` builds the Region raster/analytic products and composites the
Region texture before the shared main queue. `0x00470EE0` later loops occupied
player slots. The direct record-18 draw selects blend mode 1
(`SRCALPHA,ONE`). The optional 256 target is cleared transparent white, receives
class-owned masks, and has record 9 multiplied into it with blend mode 2
(`ZERO,SRCCOLOR`). After restoring the main backbuffer, the completed target is
drawn at that player with blend mode 1 and scale `2.025000095`. Pixels outside
the target quad are never touched. Multiple player contributions add; neither
player pass enumerates or suppresses Region sources.

The web symptom is mode-deterministic rather than an intermittent registration
race. Generated Boneyards vary environment mode, so mode 0 exposed the correct
Region result while modes 1/2 reliably placed the invented fullscreen black
sheet over every non-player light. The earlier first-frame barrier fixed a real
readiness race but also made this incorrect pass reliably present. All prior
`far alpha 245` receipts are historical evidence of the bug, not acceptance
oracles for parity.

## Web implementation consequence and validation contract

- Replace `paintDarkness` and `.boneyard-darkness` with a transparent,
  plus-lighter environment-light surface. Draw the always-valid record-18
  direct pass for each visible player; remove the fullscreen `source-out`
  black fill, unconditional record-9 radial, and `.96` calibration constant.
- Keep Lanterns, spells, enemies, and secondary effects exclusively in the
  Region collector. Do not add them to the player pass as a symptom patch.
- Preserve environment mode 0 as no extra surface and retain the first-paint
  readiness barrier for modes 1/2.
- Regression: one player-only frame followed after 120 frames by a new Air
  source must grow the provider/Misc/accepted/grid products and change pixels.
- Regression: modes 1/2 direct alpha must remain inside `.2375..25`, the
  environment surface must have zero alpha outside the bounded record-18
  draws, mode 0 must have no surface, and multiple players must add rather
  than create a fullscreen inverse mask.
- Browser: repeat real mode-0 and mode-2 starts, cast Air beyond the player
  aperture, approach the Lantern, and assert both late Region sources visibly
  change ground pixels with no page/console errors.

## Implementation validation receipt

`boneyard-environment-light.ts` now owns one transparent presentation surface.
Modes 1/2 draw only the exact record-18 direct contribution for every visible
player and composite it with CSS `plus-lighter`; mode 0 mounts no surface.
`BoneyardScene` still awaits the one resident asset and paints the first frame
before publishing `ready`. The unconditional record-9 draw, grayscale-alpha
rewrite, fullscreen `source-out` fill, and `.96` constant are removed. No
authority, protocol, Region-source, camera, collision, or gameplay RNG changed.

Focused render-contract, TypeScript, lint, syntax, and diff checks passed. The
late-admission WebGL regression held a renderer at player-only sources for 120
frames, then introduced Air at age zero: provider candidates changed `1 -> 2`,
accepted sources `1 -> 6`, indexed references `25 -> 64`, and 531,875 pixels /
25,168,826 RGB-channel units changed. Complex-shadow Z mismatches remained
zero.

A real mode-1 generated run reported first-ready environment-light alpha
`64`, settled alpha `61`, RGB total `765`, `plus-lighter`, and exact far alpha
and RGB zero. A separate real environment-mode-2 held-Air journey crossed the
entry gate and acquired Gravestone `scenery:object-40`. Provider candidates
changed `2 -> 7`; the current Lantern sample was `0.581906`, accepted sources
remained the native-contained pair, five Air actors rendered, and the endpoint
illumination remained visibly present away from the player. The journey's
page/console error array was empty and its screenshot is
`/tmp/sdr-late-light-air-fixed2/solomon-primary-air-boneyard-target.png`.

After rebasing onto the combined loot, Solomon Dig audio, Golem, and gameplay
pause tree, `./scripts/validate.sh` passed the complete Website gate; its log
SHA-256 is
`09cf77c174dfbab7bcd4a50447dfc541060b56ca5dde5d60ad30676c403275a1`.
The paired Loader portable suite passed 87/87 modules and 795 tests; its log
SHA-256 is
`d43697c5bdc8e90f54be5be4dbcc58279b3ea59bf2118f0d864045d2e993daf3`.

The identical rebased tree passed the full Apple-M2 Mac gate with all reported
test fail counts zero, both production builds, bundle budget, and media policy;
its log SHA-256 is
`aaecfb2c9cf5022809b00fb4d09f845eb8331562ac2b2d4ac3abaf3127ba8192`.
A real hardware mode-2 Boneyard held 60 FPS idle/moving with zero LongTasks.
Its first-ready and settled environment surface both reported direct alpha
`61`, RGB `765`, `plus-lighter`, and far alpha/RGB zero; log SHA-256
`1b3c695c75532054c2fa8c87c89941acf0c24e2ae54ff8603efd8d9006bf2be5`.

The decisive Mac mode-2 Air run crossed the gate, acquired Gravestone
`scenery:object-30`, changed providers `2 -> 7`, retained Lantern intensity
`0.586402`, rendered five Air actors, and returned `errors: []`. Its log and
inspected screenshot SHA-256 values are
`3aa98e137b20198b0bea168157258c27e5c74d1d1d02dad76fec2e6411d04bb9`
and
`59c65b12286174d424f5b260938a8d7f9e5e656d7f447ddbabf32a337acd5f98`.
The hardware late-admission/shadow probe also passed with two identical startup
pixel receipts, zero Z-order mismatches, provider/accepted growth after 120
player-only frames, and no LongTasks; log SHA-256
`181d563456ec5847750ef397043d4c76ba5a52798bd522afb9baf532f6491697`.

The unrelated broad `smoke:game` stopped twice on its pre-Boneyard Astronomer
telescope animation-sampling assertion. It never reached a lighting assertion;
no changed file in this pass owns the Hub telescope. Lighting acceptance is
therefore based on the focused real journeys above plus the complete canonical
gate, not misreported as a broad-smoke success.
