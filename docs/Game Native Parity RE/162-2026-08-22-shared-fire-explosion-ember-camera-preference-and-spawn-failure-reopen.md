# 2026-08-22 — Shared Fire explosion, Ember, camera preference, and spawn-failure reopen

## Reported smell and parity questions

- Reported web behavior: hitting an enemy with a Fireball after learning
  Explode briefly stutters the game and appears to shake the camera. Fireball
  Embers are visually glitchy. The player also requested a setting that turns
  camera shaking off.
- Connection report `b9e20b23-4ea3-480b-ae89-8160bdb41340` ended the session
  with `frame.primarySpells.transients[0].life is outside the live Ember
  interval`.
- Stock questions: whether Explode itself writes Region camera feedback; what
  the shared explosion and Ember own across mechanics, VFX, light, audio,
  randomness, interpolation, and teardown; and which complete camera-feedback
  producer set the preference must gate.
- Recent-server-log question: whether the submitted client failure was the only
  current fault. It was not: the same protocol-52 production window also
  crashed the authoritative process after finite spawn placement could not
  relocate a legal wave birth.
- Falsifiers: a direct `0x0063EEB0` xref from the shared explosion/Fireball/
  Ember thread; stock removal of ordinary mode-zero Embers at life one; a
  renderer branch for `fire-explosion` hidden outside the primary world view;
  a camera producer that bypasses the persisted preference; or an interior
  origin that reproduces the finite spawn failure would disprove the leading
  models.

This reopens the 2026-08-21 82-row ledger. Its Fire rows 17, 18, and 20 were
called closed from mechanics tests and a family-level census, but the pass did
not instantiate `fire-explosion` in `PrimarySpellWorldView`, did not exercise
the mode-zero Ember fade below one through the strict wire parser, and retained
the earlier one-core Ring explosion surrogate. That skipped renderer,
protocol-boundary, sibling-caller, audio, and light ownership from the declared
system.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Submitted browser diagnostics | NFO `/var/lib/solomon-dark-revived/diagnostic-logs/2026/08/b9e20b23-4ea3-480b-ae89-8160bdb41340.zip`; captured `2026-08-22T17:46:11.257Z`, protocol 52 | Before disconnect the renderer emitted `Unsupported primary spell presentation` every display frame, dropped 1,279 log entries, then the strict parser rejected a `fire-ember` whose life had entered its native fade lane. | high-live |
| Production game journal | NFO `journalctl -u solomon-dark-game.service`; `2026-08-22T17:46:08Z` | Host remained alive but closed the affected player with code 4008 and the exact Ember reason. | high-live |
| Production game journal | same service; `2026-08-22T16:44:14.673Z`, protocol 52 | `resolveBoneyardSpawnPosition` threw for radius `13.156531408429146` from `(4.738685131072998,3483.47802734375)`; `simulation.tick_failed` became an uncaught exception and systemd restarted the whole host after five seconds. | high-live |
| Current Website source | `primary-spell-world-view.ts`, `game-protocol.ts`, `primary-spell-fire-native.ts`, `primary-spell-presentation.ts` | `fire-explosion` is protocol/state-bearing but no view constructor accepts it; Ember validation requires `life >= 1`; linear interpolation runs backward across phase `4 -> 0`; its plan reverses native draw order/scales/blends and omits the second Enhanced pass and light. | high |
| Fresh retail instructions | pinned 4,723,200-byte `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; shared helper `0x00642BF0`; Anim constructors/ticks/draws `0x00452E20/0x00454000/0x00455A20`, `0x00453410/0x00457540/0x0045D6E0`; `ZAnimLit 0x005E03D0/0x005FD1D0/0x005E48E0` | The explosion is three independently clocked children using BadGuys 15, 401..419, and 420..433, plus two sounds and one lit-array provider. Longest visible life is 37 ticks. | high |
| Fresh retail instructions plus live stock quad | `Ember 0x005E0BD0`, tick `0x0060D7E0`, draw `0x0060DDD0`, airborne pass `0x005E5A20`, light `0x005E5960`; live `DAT_00819978 + 0xBB4` | Mode zero remains live for `0 < life < 1`; draw is source-over body, one/two randomized additive copies, then additive orange glow; actor light radius is `[0.75,1]`, intensity `.25*min(life,1)`. The Enhanced airborne member is an untextured `38x37` registered ground quad scaled by `.75,.600000024`, not another Ember atlas sprite. | high-live |
| Full xref census | `0x00642BF0` references from `0x00466BC0`, `0x00477020`, `0x005E4CA0`, `0x005E5160`, `0x005FF8C0`, `0x0060D7E0` | Shared membership is script explosion, special enemy death, FireMissile, Fireball, maximum Ring Shockwave, and Immolate. | high |
| Camera xref census | all ten direct references to `Region::ApplyCameraShake 0x0063EEB0` in nine functions; `native-camera-control.md` | No shared explosion, Fireball, or Ember owner writes camera magnitude. Enemy terminal presenters do; Ring of Fire separately writes `.25` on cast, before Shockwave contact. | high |
| Settings evidence | `native-settings-system.md`; native global `Game.ZoomFX`; current `zoomEffects` consumers | The stock `ZOOM EFFECTS` preference already gates world/camera pulses. Every web scalar, displacement, and world-shake consumer funnels through the same value; the requested work is an explicit label/acceptance clarification rather than a second overlapping state bit. | high |
| Deterministic spawn reproduction | all 12 `NATIVE_GENERATED_BONEYARDS`, logged point/radius, each sealed combat rectangle | The current raw-origin search fails in 7/12 templates. Projecting the exterior raw point into the radius-inset active bounds before the unchanged native-topology rings resolves all 12 and preserves identity placement for already-valid points. | high |

## Reopened Fire-system boundary and complete membership

Native system: shared `0x00642BF0` Fire detonation plus its Ember actor family,
from immutable cast/contact payload through combat, fixed-tick children,
presentation, lights/audio, replication, interpolation, and teardown.

| Member | Native source / authored row | Required disposition in this pass | Proof contract |
| --- | --- | --- | --- |
| pure Fireball ordinary contact/impact | row 16; `0x005E5160` | verified-already-at-parity except shared child handoff | existing direct/splash partition plus browser hit |
| Explode mechanics | row 18 damage/radius; `0x00642BF0` | verified-already-at-parity for target damage; exact-port presentation/audio/light | direct and nearby target damage plus complete child census |
| explosion orange core | Anim_Fade, BadGuys 15 | exact-port | ages 0..9, fixed scale/order/alpha |
| explosion array one | Anim_SpriteArray, BadGuys 401..419 | exact-port | float32 `.75 * .98^n`, truncation frames, ages 0..34 |
| explosion rising lit array | Anim_SpriteArray/ZAnimLit, BadGuys 420..433 | exact-port | float32 `.625 * .97^n`, rise, ages 0..36, provider light |
| shared explosion audio | registry 30 then 97 | exact-port | `fireballhit` signed `.1`, then `throwfire` `.8`, once per birth |
| direct Explode camera pulse | complete `0x0063EEB0` xrefs | out-of-system — no native writer | negative xref contract |
| enemy-death pulse after a lethal Explode | family terminal presenters | verified-already-at-parity | only a terminal event changes camera magnitude |
| Embers construction/fan | row 17; Ember constructor; private seed | exact-port | constructor and ten pre-ticks, every registration-time contact callback, first-contact consumption, randomized cadence/RNG |
| mode-zero Ember airborne/bounce/ground/fade | `0x0060D7E0` | exact-port through life `(0,3]` | protocol, fixed-tick, contact, terminal removal |
| Ember main/additive/glow draws | `0x0060DDD0`, BadGuys 15 and 267..270 | exact-port | order, scales, two Enhanced copies, phase-wrap interpolation |
| Ember Enhanced airborne pass | `0x005E5A20`, live shared quad corners `±19,±18.5` | exact-port | negative-height-only `28.5x22.2000009` untextured ground quad, `(1,.5,.25)` tint, exact height alpha, teardown |
| Ember actor light | `0x005E5960` | exact-port | per-actor registration, radius/intensity/no-shadow |
| Embers to Imps | row 19 | verified-already-at-parity; revalidate shared Ember retirement | four fragments, GoodImp/Fire sibling ownership |
| Immolate | row 20; spent mode one | exact-port via same explosion stack | scale one, no fragments, damage/audio/VFX/light |
| FireMissile and web weld builds 1000/1003/1007 | caller `0x005E4CA0` and welded vectors | exact-port via shared view/protocol/audio | per-build detonation fixture |
| Steam Jet build 1005 | `Mod_Steamed::Tick 0x00625F40`, event type 2, `0x00643CA0` | `out-of-system` — the 2026-08-30 corrective trace proves this is the separate gray Steam-detonation family in entry 123, not shared helper `0x00642BF0` | negative shared-helper caller census plus Steam-family fixtures |
| Burning Man Ring contact | Shockwave `0x005FF8C0`, scale 1.5, three Embers | exact-port; replace one-core surrogate and simplified fragments | mechanics, three-layer stack, three exact Embers, cue pair, lights |
| scripted `DO EXPLOSION AT` | action 1060, `0x00466BC0` | out-of-system — Website does not execute the native timeline action family | negative producer census, durable native record retained |
| special enemy-death mode | `0x00477020` | out-of-system — no supported web enemy recipe currently emits this stock mode | negative producer census |
| Hub Courtyard/private rooms | shared primary view | exact-port | each world key renders and tears down the same stack |
| Boneyard | shared primary view plus Region lights/audio | exact-port | WebGL painter/light/audio receipt |
| protocol/snapshot/copy/interpolation | strict wire and two presentation timelines | exact-port | life `(0,1)`, registrations, 37-tick state, wrap-forward phase |
| disconnect/world/player teardown | owner removal and view/audio caches | exact-port | no retained view, cue replay, or provider after removal |

No member is blocked by the browser platform. Stock display RNG is projected
from stable effect identity and display frame so clients agree without moving
gameplay RNG into the renderer; exact range, count, order, and blend remain the
visible contract.

## Camera-setting boundary and membership

The existing persisted `zoomEffects` bit is the complete web adaptation of
native `Game.ZoomFX`. Adding another bit would create contradictory settings.
This pass exposes the row as `CAMERA SHAKE` and retains one owner:

| Producer/consumer | Required disposition |
| --- | --- |
| enemy terminal magnitude | gate with the shared preference in Boneyard |
| Earthquake displacement vector | gate with the shared preference in Boneyard |
| secondary scalar magnitude (Ring, Shield, Trap, Flash, Ether Blast, etc.) | gate in Hub and Boneyard |
| Meteor/secondary displacement | gate in Hub and Boneyard |
| semantic camera tracking, FOV, spectator targeting | out-of-system — never disabled |
| screen color/alpha overlays | out-of-system — visual flash is not camera motion |
| persistence/title/Dark Cloud/gameplay Settings contexts | exact same stored toggle and live subscription |

All motion producers are already routed through the bit; regressions must keep
that exhaustive gate while changing the player-facing name.

## Spawn-safety boundary and membership

The native ring topology itself is retained: identity candidate, actor-radius
rings, `trunc(pi*(r+s)/r)` samples, fixed start angle in the deterministic web
projection, and Y scale `.8`. The failure belongs to the declared web safety
adaptation that confines a stock full-Arena raw point to a smaller sealed
combat rectangle but still centers a finite search on the exterior point.

| Member | Required disposition |
| --- | --- |
| already valid raw point | verified-already-at-parity; return byte-for-byte |
| generated transition exterior raw point | exact safety projection to radius-inset active bounds before rings |
| static collision at projected point | retain native-topology rings and mobility probe |
| all 12 generated templates, north/south combat rectangles | exact finite-total regression with logged point/radius |
| custom Boneyard with no generated transition | verified-already-at-parity; authored full bounds remain active |
| invalid/nonpositive radius | retain strict rejection |
| truly saturated active rectangle | retain explicit error; do not materialize an invalid actor |
| process failure propagation | no legal exterior input may reach this branch; host tick remains strict for impossible worlds |

## Native ownership thread and recovered behavior

- Fireball/FireMissile/Ember/Ring/script callers submit immutable origin,
  scale, damage, fragment count, status payload, private seed, and alignment
  flags to the Region-owned helper. The helper creates its three VFX children,
  requests audio, performs area contact, then constructs Embers.
- The longest explosion child is not the 16-tick Fireball impact. It remains
  visible through age 36 and independently owns a transient light provider.
- Mode-zero Ember lifetime does not end at one. Life below one is the stock
  alpha/glow fade; only spent modes one/two consume on the first crossing.
- Ember display phase advances by `.25` and wraps at four only while life is
  above one. Snapshot interpolation must move forward through that wrap.
- Each Ember is registered before its ten construction-time pre-ticks. Every
  cadence crossing therefore executes contact immediately; the first accepted
  target consumes that child and suppresses its later pre-age queries.
- The Enhanced airborne vslot draws the shared untextured ground quad with
  alpha `float32((1-height/-50*.5)*.25)`. The previous web same-record copy was
  a visible surrogate and the source of the duplicated/glitchy Ember shape.
- Explode itself never calls the scalar camera lane. A lethal target's family
  can immediately request its own local-player-anchored zoom pulse, explaining
  the observed coincidence without assigning it to the spell.
- `ZOOM EFFECTS` is the stock label for that camera-motion lane. The requested
  `CAMERA SHAKE` wording is a local Website accessibility clarification and
  leaves its single persisted boolean and native-on default intact.
- Native spawn retry has no finite failure, while the Website deliberately has
  bounded work. Projecting only exterior raw origins into the active inset
  keeps the finite adaptation total for legal generated schedules without
  changing valid authored positions or ring topology.

## Web implementation consequence and validation contract

- Correct the protocol interval and carry Ember/explosion light registrations
  and explosion audio pitch as stable authoritative state; bump the strict
  protocol because the wire shape changes.
- Add a cohesive shared Fire explosion plan/view rather than a one-off
  `fire-explosion` branch. Load all 33 consumed BadGuys records and use the same
  plan for Fireball, Immolate, weld, and Burning Man Ring membership.
- Correct Ember presentation order, Enhanced copy count, exact ground-quad pass, actor
  light, and circular phase interpolation; remove the Ring fragment surrogate.
- Do not create an Explode camera event. Keep enemy-death and secondary camera
  owners, all gated by the renamed setting.
- Clamp only exterior spawn origins to the radius-inset active rectangle before
  the unchanged finite rings.
- Focused tests must cover every table row above, exact float32 age/frame
  boundaries, audio one-shot de-duplication, light registration/order, both
  scenes, on/off camera transform, the submitted life sample, the exact logged
  spawn point across all generated templates, and teardown.
- Browser acceptance must cast learned Explode plus Embers into a live enemy,
  observe all Fire views without page/protocol error or long frame stall, prove
  nonlethal Explode has no direct camera motion, prove a lethal enemy pulse is
  disabled by `CAMERA SHAKE`, and retain audio/light/provider evidence.
- Canonical `./scripts/validate.sh`, focused Loader static contracts, and final
  Mac hardware Chrome/WebGL acceptance are required. Publication and deployment
  remain separate: publication is authorized by this request; deployment is not.

## Implementation validation receipt

- Protocol 58 now carries the full live Ember interval `(0,3]`, contact cadence
  and due edge, actor/transient light registrations, 37-tick shared explosion,
  and sampled signed hit pitch. The primary view admits `fire-explosion`
  explicitly, so the submitted diagnostics' per-display-frame exception loop
  and subsequent code-4008 parser close no longer have a reachable state.
- The shared Fire implementation now serves Fireball, FireMissile/welded Fire
  builds 1000/1003/1007, Immolate, and Burning Man Ring from the same
  three-child explosion clocks, cue pair, Ember physics/contact program, light
  ownership, and teardown. The 2026-08-30 Steam correction in entry 123 removes
  build 1005 from this family: its event-type-2 detonation has gray overlays,
  one `explodesteam` cue, and `Anim_SteamJetEffect` children. The
  registration-time ten-tick Ember loop publishes every contact query and
  consumes the child on its first accepted target.
- Ember interpolation moves forward through the four-frame wrap. Its renderer
  owns the source-over body, two independently sampled Enhanced additive
  copies, orange BadGuys-15 glow, and the exact live-recovered untextured
  ground quad. The previous duplicate atlas-sprite surrogate is gone. Explosion
  lit-array scale and provider radius retain the local Region point gain sampled
  at view birth rather than changing as the camera moves.
- The existing persisted `zoomEffects` owner is exposed as `CAMERA SHAKE`.
  Every Boneyard and Hub scalar/displacement consumer remains gated by that one
  value; tracking, FOV, spectator selection, and screen-color overlays remain
  independent. No Fireball, shared explosion, or Ember camera event was added.
- Generated-wave placement now clamps only an exterior raw origin into the
  radius-inset combat rectangle before retaining the native actor-radius ring
  topology. The exact logged point/radius resolves in all 12 generated
  templates; already valid origins remain identity placements.
- The clean detached Mac worktree at pre-publication commit
  `5c9585a241459f4a2a30384f273da4605537ce69`, tree
  `fdb5ff0128d429efa982eca1f82f8baf2289d74e`, passed the complete canonical
  `./scripts/validate.sh` gate on Apple M2: `17/17` backend/repository
  contracts and frontend groups `4/4`, `44/44`, `234/234`, `1368/1368`,
  `9/9`, `43/43`, `11/11`, `7/7`, `17/17`, and `21/21`; desktop `5/5`;
  backend formatting/build, frontend lint/import boundaries, production
  frontend/game-host builds, CSP media policy, and bundle budget (`420073` raw
  / `117464` gzip bytes). The log SHA-256 is
  `35a76b00c1afb8cab5f7e4a0fb9c6de6da9ad3001549ae54801db3fc8f7bf143`.
  The Mac was arm64 macOS `26.6.2` with Node `22.17.0`, npm `10.9.2`,
  .NET `10.0.302`, and Chrome `151.0.7922.170`. Only the repository's eight
  existing Fast Refresh warnings and the non-fatal large-chunk advisory
  remained.
- The rebased Mod Loader documentation commit
  `8384eaab53ae502077f7d871ef469bba2b926bca`, tree
  `ff35bc8172b95d3daabd8ccb05c9d80607467436`, passed its complete registered
  static RE gate on the Mac: `504/504` under Homebrew Python `3.13.15` with
  the repository-pinned Pillow `12.2.0`; log SHA-256
  `ec25d0339b84f4dd293778308e2935b409be0e090149f63ba1a000a5f8ba4ebb`.
- The same Website commit passed physical-Mac Chrome/WebGL acceptance with
  empty page, console, HTTP, and runtime-error arrays. The final run observed
  nine Fireball-hit requests, six Throw Fire requests, signed playback range
  `0.9002779722..1.0829219818`, a live Ember at life `0.9299941063`, direct
  nonlethal Explode camera magnitude `0`, lethal enemy-terminal magnitude
  `0.009999999776`, and the same lethal outcome at `0` after persisting
  `CAMERA SHAKE: OFF`. The browser log SHA-256 is
  `dc56b2bb49e1ca3ba19e8be050b0cea176df523284dd12cf6048d24a0087f291`.
- The controlled Mac display samples show no Explode regression: baseline p95
  `26.2 ms` / max `26.3 ms`, explosion-and-Ember p95 `26.1 ms` / max
  `26.4 ms`, and restored p95/max `26.3 ms`. This distinguishes the removed
  exception storm from the stock enemy-death pulse instead of inferring
  performance from source.
- The final acceptance harness follows the generated `11..17` opening count,
  retains the player on the combat side of Solomon's retreat, projects pointer
  coordinates through the canvas CSS scale, accepts only an authentic shared
  explosion with a live newborn Ember, and bounds every owned shutdown step.
  Inspected Mac captures are `/tmp/solomon-fireball-explode-embers.png`
  SHA-256
  `eda40a84f6a7646216d36d51eebb72c2cc50135444fb1d689454510dd0e4509b`
  and `/tmp/solomon-fireball-camera-shake-off.png` SHA-256
  `7f0b81fab2f97d07d228906d76f76b9409ac85e168eaf498d5423c977012c1d1`.
  The first visibly retains the discrete orange explosion/Ember stack without
  the duplicate-Ember silhouette; the second shows the gameplay Settings row
  and persisted Off state. No system member remains blocked by the browser
  platform. Publication is pending; no deployment or production restart was
  performed.
