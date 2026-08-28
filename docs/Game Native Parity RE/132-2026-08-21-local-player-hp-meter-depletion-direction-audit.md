# 2026-08-21 — Local-player HP meter depletion direction audit

## Reported smell and parity question

- Reported Website concern: the local player's red HP meter immediately left
  of the blue mana meter may be losing fill from the wrong end.
- Stock behavior to recover: distinguish the meter's **outer layout anchor**
  from its **current-health fill anchor**. The complete health track and core
  keep their right edges at native `x=750/745` and grow left when maximum HP
  increases, but current HP is a left-clipped `UI.26` strip. Damage therefore
  removes red pixels from the center-facing right end; the remaining red fill
  stays on the far-left end and its live right edge moves left.
- Reproduction states: local player alive in Hub and Boneyard at full, half,
  and near-zero health; default and increased maximum HP; Magic Shield shorter
  and longer than life; local death and return to an alive scene.
- Falsifier: a stock damaged frame with red pixels retained against the
  center-facing right end, or native clip instructions that move the fill's
  left edge while preserving its right edge, would require flipping the web
  implementation.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Native instructions | Clean retail `SolomonDark.exe` SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; fresh read-only Ghidra decompile/disassembly of HUD renderer `0x005D2520`, health block `0x005D2FDD..0x005D3403`, clip setter `0x00420EC0`, repeated strip `0x00415230` | Base/current/maximum are `+0x6C/+0x70/+0x74`; the renderer squares `current/maximum`, applies a clip whose width is `core_width * ratio^2`, and draws `UI.26` from the full core's left origin. | high |
| Clean stock capture | `/mnt/d/codex-evidence/uire-20260806/hud-crops/20260806T115705Z/damaged-health.png` SHA-256 `d5ea1e16a9305befb7b4f583202f8aa0f3ff85340bebc4cf3a1b2a7206b105b5`; `near-death-health.png` SHA-256 `9709208bbec1e2946e3cacb67cfe4bdeb758fcf25b7868b2f1043c4d90d31a3f` | Damaged and near-death red pixels remain against the core's left edge; the empty portion opens on the right. | high |
| Derived-stat capture | Mod Loader `tests/fixtures/webgame/native-derived-hud-goldens.json`, owned retail run `D:\codex-evidence\uire-derived-stats-20260821\live\20260821T155745Z` | Maximum-100 half-current case has core `[620,745]` and visible width about `31.27`; the visible rect begins at `620`, not at `745 - 31.27`. Magic Shield uses the same left origin. | high |
| Current Website | `GameHud.tsx`, `hub.css`, and `native-hud-presentation.ts` at Website `c9600ce1` | The health track is right-anchored, its fill image starts at the core's left inset, and `clip-path: inset(0 <missing>% 0 0)` clips the right side. The squared ratio and dynamic core width already match stock. | high |

## System boundary and membership inventory

Native system: the local-player top-center health meter owned by the ordinary
G9 gameplay HUD, from authoritative local HP/max HP and shield values through
dynamic geometry, clipping, render order, visibility, and teardown. Remote
ally rows, world nameplates, the featured-enemy prefix, mana, and XP have
separate native owners and are not members of this local meter.

| Member (scene/state/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Hub local-player health track/core | `0x005D2520`, `0x005D2FDD..0x005D3403` | verified-already-at-parity | shared `GameHud` geometry and damaged-fill browser receipt |
| Boneyard local-player health track/core | same ordinary HUD owner and health block | verified-already-at-parity | shared `GameHud` after real Boneyard entry |
| Full, damaged, near-death, over-range, and zero HP | squared clamped ratio in `0x005D3029..0x005D306F` | verified-already-at-parity | pure meter tests plus right-inset browser assertions |
| Default, upgraded, fractional, shrinking, and authored-maximum HP geometry | base/max width path `0x005D2FDD..0x005D3028` | verified-already-at-parity | existing v52 per-case meter tests and fixed-right-edge browser geometry |
| Health Up 64, `FX_MAXHP` 23, and Hagatha Life Charm 0 | shared authoritative maximum-HP producers | verified-already-at-parity | v52 producer census and shared meter consumer |
| Damage, poison, healing/orbs, health potion, Regenerate 79, refresh/reset | current-HP writers sampled every HUD render | verified-already-at-parity | no presentation smoothing; shared ratio path |
| Magic Shield 54 / Explosive Shield 55 | actor `+0x1C4/+0x1C8`, `0x005D30CA..0x005D3403` | verified-already-at-parity | same left clip origin, linear width, shorter-first/longer-last tests |
| Local death and respawn visibility | `actor+0x160` early branch to `0x005D3D48` | verified-already-at-parity | existing death/Game Over contracts; alive HUD rebuilds from current snapshot |
| Remote player/Golem ally rows | frame-local vector and shared row loop `0x005D3408..0x005D3669` | out-of-system (separate fixed-row producer/renderer) | native ally-roster report |
| Remote world nameplate health rail | post-world multiplayer presentation lane | out-of-system (camera-projected remote indicator) | 2026-08-20/21 world-nameplate entries |
| Featured-enemy/boss prefix | independent guarded prefix `0x005D257E..0x005D2AEF` | out-of-system (enemy-owned panel before the ordinary HUD) | fresh xref/disassembly sweep |
| Mana fill/reserve and vertical XP fill | independent meter/state fields and assets | out-of-system (not health consumers) | complete G9 element census |

There are no browser-blocked members. CSS clipping represents the native
left-origin strip exactly.

## Native ownership thread and recovered contract

- Owner and lifetime: `0x005D2520` owns the local top-center meter for every
  alive ordinary-HUD frame. It samples the observer's local progression object;
  it allocates no independent meter state and retains no delayed-damage value.
- Upstream state: base/current/maximum HP are progression `+0x6C/+0x70/+0x74`.
  Skill, equipment, charm, combat, potion, regeneration, reset, and refresh
  writers converge on those fields. Shield current/maximum are actor-local
  `+0x1C4/+0x1C8`.
- Geometry: `core_width = 2 * (base + 0.25 * (maximum - base))`;
  `track_width = core_width + 10`; track/core right edges are `750/745` at
  `1600x900`; `visible_width = core_width * clamp(current/maximum,0,1)^2`.
  The visible rect is `[745-core_width, 745-core_width+visible_width]`.
- Direction: as current HP falls, the left edge is invariant and the right edge
  retreats left. In UI terms the bar depletes **right-to-left**, beginning at
  the end nearest the central skill emblems/mana bar.
- Shield: its linear visible rect begins at the identical core left edge. Life
  and shield are ordered by visible width, shorter first, longer last; neither
  reverses direction.
- Timing and lifecycle: values are sampled per render with no smoothing, pulse,
  trailing layer, randomness, audio, input, or independent replication. Local
  death skips the ordinary HUD; respawn restores it from current state.

## Web implementation consequence

- No behavior correction is required. `hub-hud-meter-health` correctly fixes
  the complete track's right edge while `hub-hud-meter-fill` begins at the
  core's left inset. `GameHud` correctly clips the fill image's right side.
- Do not switch the health fill to `transform-origin: right`, left-side inset,
  `right: 3px`, row reversal, or a mirrored image. Those changes would make the
  local meter look superficially symmetric with its placement while contradicting
  the native damaged-health frames.
- Add browser assertions for half-health clipping and both Hub/Boneyard scene
  ownership so a later CSS cleanup cannot silently flip the axis.

## Validation contract

- Focused model: retain the existing exact squared ratio, dynamic widths,
  shield widths, and clamping cases.
- Browser: target half health, require a computed right inset near `75%` (with
  the exact value derived from the HP/max values sampled after native per-tick
  recovery), an invariant fill left edge, and a live right edge at
  `core_width * ratio^2` from that left edge. Repeat after entering the
  Boneyard using the same authoritative player state.
- Acceptance: full health reaches the core right edge; half health retains the
  leftmost quarter; zero health exposes no red fill; page, console, and network
  error lists remain empty.
- Canonical gate: `./scripts/validate.sh` from the isolated final Website tree.

## Implementation validation receipt

- Files/modules changed: `native-hud-presentation.ts` now owns the explicit
  `nativeHudLeftOriginClipPath` rule; `GameHud.tsx` consumes it for the native
  health, shield, and mana strips without changing rendered behavior;
  `native-hud-presentation.test.ts` pins full/quarter/empty and clamp cases;
  `smoke-native-derived-hud.mjs` measures the live clipped rect after actual
  damage in both Hub and Boneyard. This ledger and Mod Loader
  `docs/reverse-engineering/native-hud.md` record the recovered contract.
- Focused Website test: `npm run test:level-up` passed `11/11`, including the
  new exact rule `0.25 -> inset(0 75% 0 0)`. Mod Loader's complete registered
  static RE suite passed `504/504` on both local Linux and the arm64 Mac mini.
- Local canonical Website gate: `./scripts/validate.sh` exited `0`; backend
  build and `15/15` contracts, `4/4` library, `43/43` loot, `225/225`
  prerequisites, `1258/1258` broad game, `25/25` parties, `11/11` level-up/HUD,
  `7/7` diagnostics, `17/17` Hall, `16/16` Hub UI, `5/5` desktop, production
  build, bundle budget, and media policy passed. Only the eight existing Fast
  Refresh warnings remained. Game entry `Game-BwH8oFrg.js` was `384266` raw /
  `108111` gzip bytes.
- Local real-Chrome journey: default and maximum-125 geometry were exact; the
  damaged Hub frame sampled `62.575/125` HP with right clip `74.94%`, left edge
  fixed at `607.5`, and live right edge `641.9575`. After real Boneyard entry,
  `62.653/125` produced right clip `74.8774%`, the same left edge, and live
  right edge `642.043575`. Page, console, and network error lists were empty.
- Exact-tree Mac receipt: the Mac worktrees started at Website
  `c9600ce195a30989c7625bffd2368cc50acf8817` and Mod Loader
  `0173a543d7eb3324828303213850023b38c58a3c`; all six changed-file SHA-256
  values matched the local isolated worktrees before execution. macOS `26.4.1`
  arm64, Node `22.17.0`, .NET SDK `10.0.302`, and Google Chrome
  `151.0.7922.170` passed the same Website canonical gate/counts/build artifact
  and the `504/504` native registry.
- Mac Chrome journey: Hub and Boneyard each sampled `62.501/125` HP, right clip
  `74.9992%`, invariant left edge `607.5`, live right edge `641.8761`, and
  empty page/console/network error lists. The Boneyard capture is
  `.codex-evidence/health-bar-direction-20260821/mac-boneyard-half-health.png`,
  SHA-256 `555f5406149a750112b0d1b1ab3de64b32f0f6a248d9d6116f6c1d5a9e4c3956`;
  visual inspection shows red retained at the far-left end and the empty track
  opening toward the center.
- No member is blocked by the browser platform and no unknown remains inside
  the local-player HP-meter boundary. This validation receipt precedes
  publication; commit and push state are reported separately. No deployment,
  production change, or restart was performed.
