# 2026-08-22 — Shared Fire explosion, Ember, camera preference, and spawn-failure reopen

> **2026-10-13 correction — report 118:** the special-death producer exclusion,
> shared area-damage/query assumptions and shared-contact closure claims below
> are superseded by the report-118 recovery at the end of this entry. Flame
> Lash is a live type-1 producer; Steam is a type-2 sibling through the same
> terminal receiver. Native area damage has two half lanes, Fire and Steam use
> distinct queries, and newborn contacts are synchronous. The separate maximum
> Ring amount/query/order defect is recorded open, not silently included in the
> report-118 runtime patch. Historical receipts are retained as historical.

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
| Explode mechanics | row 18 damage/radius; `0x00642BF0` | reopened 2026-10-13 | two half damage lanes, strict root-circle query and synchronous newborn contacts; presentation clocks retained |
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
| FireMissile and web weld builds 1000/1003/1007 | caller `0x005E4CA0` and welded vectors; build 1003 uses type-1 death consumer | recovered; shared compatibility required | separate direct projectile and death-payload fixtures, not a per-hit Flame burst |
| Steam Jet build 1005 | `Mod_Steamed::Tick 0x00625F40`, event type 2, `0x00643CA0` | in-system shared terminal-receiver/area sibling; distinct gray factory | no direct Fire-helper call; terminal-only type-2 burst and distinct Steam query/child fixtures |
| Burning Man Ring contact | Shockwave `0x005FF8C0`, scale 1.5, three Embers | recovered separate defect; open outside report-118 runtime patch unless touched | full paired damage, strict root radius 82.5 and grid order; preserve independent queue and presentation |
| scripted `DO EXPLOSION AT` | action 1060, `0x00466BC0` | out-of-system — Website does not execute the native timeline action family | negative producer census, durable native record retained |
| special enemy-death mode | `0x00477020`; Flame writes `0x00540C6D/0x00541710`, Steam writes `0x00625FDA` | in-system; prior negative producer census falsified | per-damage payload, eligible terminal dispatch, victim root XY, no survivor bursts |
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

### 2026-09-06: spawn reachability uses the destination owner's footprint

A Mac continuation of a real production save reproduces another finite spawn
failure at tick `511204`, wave 48: radius `35`, policy `dark`, origin
`(342.5671081542969, 398.1956481933594)`. A saved pre-failure state reproduces
the same exception in one ordinary `stepGameSimulationTick` call.

| Evidence | Observation | Confidence |
| --- | --- | --- |
| Exact saved world and collision queries | The raw spawn point is a legal radius-35 placement. The living player's position `(982.9186581096685, 1384.0702625000654)` is legal at its own radius 25, but overlaps scenery objects 130 and 145 when tested at radius 35. | high, Mac runtime |
| Existing world spawn-domain callback | It passes the newborn's reachability radius to both route endpoints, including the living player's position. Every candidate is rejected when the player cannot hold that larger footprint. | high, source and reproduction |
| Same endpoints and geometry, both mesh classes | Destination checks at radius 25 find a route through both the clearance-25 and clearance-50 meshes; checks at radius 35 reject both. | high, Mac runtime |
| Existing native navigation record, entry 273 | Mesh class, endpoint lookup, adjacency, and final movement clearance are separate owners. A spawn's collision radius does not change the connected player's physical radius. | high for the recovered constants and ownership; this fix is a Website query correction |

The world owns the destination participant and must supply its radius to the
spawn reachability query. The route query will allow a distinct destination
footprint while preserving its existing mover footprint by default. This
does not change native placement rings, light/offscreen policies, RNG draws,
mesh clearance, graph adjacency, or the newborn's collision checks.

| Member | Disposition and acceptance |
| --- | --- |
| Ordinary and larger enemy births, including the reproduced Demon | Website ownership correction: mover and destination footprints remain distinct |
| Direct, dark, light, and offscreen world policies | Same world-owned reachability predicate; cover a living player beside collision |
| Start endpoint and spawn body clearance | Preserve the newborn's full radius and placement rejection |
| Existing locomotion routes without an explicit destination footprint | Preserve existing route decisions and movement clearance |
| Disconnected geometry and Demon-only narrow-lane rejection | Preserve failure; the correction cannot join disconnected navigation components |
| Empty or impossible authored worlds | Preserve explicit rejection; do not hide the exception or place an invalid actor |

Acceptance requires focused route and world regressions, the saved failing
tick, a longer Mac continuation, the canonical Mac gate, and actual production
continuation through the requested wave target.

The two new regressions failed against the original query. After the correction,
all 47 navigation/world cases passed, including the four world policies and
existing disconnected-domain tests. The saved failing tick completes normally.
The same Mac checkpoint continuation then completed wave 50 and entered wave
51 after 762.87 simulated seconds with the private pilot's normal combat inputs.
This is isolated simulation evidence; production continuation remains separate.

The complete canonical Mac gate for the spawn correction passed at
08:46:36 UTC on 2026-09-06, including the configured coverage and mutation
checks. The subsequent title-only Resume consent correction in entry 152
received its own Mac lint/type/build and real-browser checks.

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
  flags to the Region-owned helper. The helper requests audio, creates its three
  VFX children, performs area contact, then registers and immediately pre-ticks
  each Ember in sequence before constructing the next.
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

## 2026-10-13 — Report 118 shared terminal-payload and area-contact recovery

### Owning-system inventory and evidence

This recovery supersedes the prior negative special-death producer claim.
Flame Lash writes type 1 at `0x00540C6D/0x00541710`; Steamed writes type 2 at
`0x00625FDA`. The current damage event carries the payload through the real
terminal receiver; it is not a persistent status or free per-tick explosion.
Entry 123 owns the authored vectors, low-mana/count/RNG and presentation phase
details. The machine-readable
[report-118 native evidence](report118-native-death-payload-evidence.json)
pins retail 0.72.5 SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
image base `0x00400000`, source HEAD `762f0c9c`, raw instruction excerpts
and every PE-verified slot below.

All **six** direct Fire-helper CALLs were recovered from the complete static
disassembly, not a search limited to Flame:

| Call site | Native owner | Website disposition |
| --- | --- | --- |
| `0x00466C49` | script action 1060, `0x00466BC0` | Native record retained; no current Website timeline adapter, do not invent one |
| `0x0047712A` | terminal special-death type 1, `0x00477020` | In-system Flame payload consumer |
| `0x005E4F0E` | FireMissile/Burning Bolt, `0x005E4CA0` | Direct-caller compatibility mandatory |
| `0x005E5427` | Fireball, `0x005E5160` | Direct-contact amount remains distinct from shared area |
| `0x005FFC0B` | maximum Ring Shockwave, `0x005FF8C0` | Separate recovered amount/query/order defect remains open unless touched |
| `0x0060DA2A` | spent Immolate Ember, `0x0060D7E0` | Shared area compatibility, no arbitrary direct-damage scaling |

Steam has exactly one direct helper call, `0x004770B7 -> 0x00643CA0`.
Meteor's current Website reuse is an adapter, not a seventh native direct
Fire-helper call; test its impact/direct-versus-area partition explicitly.
Ordinary direct projectile, Ember, Burn and Meteor damage are separate
producers and must not be doubled with the shared area.

The shared `vtable + 0x88` handler `0x00477020` occurs in these **21**
catalogued native receiver tables. The evidence JSON checks `+0x88`,
damage `+0x4C` and death gate `+0x64` against the retail bytes for each
row. Inherited membership does not prove hostile targeting or terminal
payload eligibility.

| Types and native family | Damage receiver | Terminal/admission consequence |
| --- | --- | --- |
| Badguy `0x3E8`, DemonSkull `0x3F0`, Demon `0x3F1`, Coffin `0x3F5`, Maggot `0x7FD`, Solomon Dig/Riff/DriveBy `0x1391/0x139B/0x139C` | `0x0048A290` | Common shields, dead flag, HP and family gate apply |
| Skeleton/Archer/Mage `0x3E9/0x3EA/0x3EB`, DireFaculty `0x3F2`, Heartmonger `0x3F3` | `0x0048A600` | Admitted body damage forwards; armor break through `0x0048D130` may reject terminal death |
| Imp/GoodImp/GreenImp `0x3EC/0x3ED/0x7FC` | `0x0048B1C0` | Rejects `+0x234`; accepted branch forwards; friendly/alignment membership remains separate |
| Zombie `0x3EE`, Wraith `0x3EF` | `0x0048B1E0/0x0048B290` | Admitted branch forwards |
| Spider `0x809` | `0x0048BC80` | Magic-hit flag `0x02` affects reaction/admission at `0x0048BC85`; do not infer the flag from a nonzero magic lane |
| Cocoon `0x80A` | `0x0048BCE0` | Special nonterminal receiver: no terminal payload, even when the web's generic result says killed |
| Portal `0x139D` | `0x0048C370` | Admitted branch forwards at `0x0048C5C6` |

### Terminal dispatch is a stronger condition than “killed”

Region damage submission `0x0063E7D0` invokes victim vslot `+0x4C` at
`0x0063E808`. The common receiver `0x0048A290` first handles shields and
already-dead `+0x94`, subtracts damage lanes, requires HP <= 0 at
`0x0048A49A..A7`, then invokes family gate `+0x64` at
`0x0048A4AD..B8`. Only an accepted terminal path sets `+0x94` at
`0x0048A4F6`, removes living membership at `0x0048A530`, and calls
`+0x88` at `0x0048A53F`. The special consumer requires victim
`+0x5C == 0` and uses its root XY `+0x18/+0x1C`.

Cocoon restraint subtracts both lanes at `0x00533368..82`; a survivor
returns false at `0x0048C326`. Release sets `+0x94` before the common
receiver. Missing/invalid owner can return true at `0x0048C33C..63` without
calling `+0x88`. Consequently a generic positive/killed result is not a
native terminal-dispatch marker. The web must never run a Flame/Steam payload
for Cocoon. Preserve the other shields, armor, existing-dead, alignment and
family admission gates rather than deriving one universal hit condition.

### Two damage lanes, flags and no second damage owner

Fire computes `payload * .5` at `0x00643089..96`, writes that same half
to magic `DAT_0081C6EC` at `0x006430DF` and physical `DAT_0081C6E8`
at `0x006430E6`. Steam does the same at `0x00644164/0x0064416B`.
Common shield handling at `0x0048A2E3..2FD` consumes the lane sum without
HP spill; unshielded HP subtraction at `0x0048A3E8..40A` applies physical
then magic. A neutral unshielded target therefore receives full payload,
not half.

Independent source review found no second primary area HP owner. The shared
factory stored half, `fire.ts` submitted once, and `enemies/damage.ts`
subtracted that request once. A source-neutral branch fixture also reproduced
the missing half for ordinary Fire. This justifies correcting this producer,
not multiplying every Fire-family request.

Each area victim first receives reset context at Fire `0x006430A5` or
Steam `0x0064413A`; flags reset to zero at `0x00624717`. The magic
damage lane is **not** the magic-hit flag. The port must represent this as
`hasMagicDamage: true` while keeping `magic: false` for receiver behavior;
Burn does not set the magic-hit flag either. Spider flag suppression and
Cocoon's `0x00533388` magic-flag pulse are distinct consumers. The extra
susceptibility arithmetic `0x0048A410..425` is conditional and does not
authorize a blanket multiplier. Reset also clears special-death payload:
area collateral kills cannot recursively inherit type 1 or type 2.

### Distinct query footprints and stable native order

Fire passes `f32(scale * 110)` as diameter. Region helper `0x00642280`
halves it at `0x00642288`, then grid query `0x00523140` uses strict
root-center circle membership (`0x005232D9..0x00523312`). No target-body
radius expansion applies. At scale 1 the radius is 55.

Steam passes `r = f32(scale * 55)` to `0x00642090`. Its stack/FPU trace
at `0x006420D7..0x00642116` constructs
`(origin.x-r/2, origin.y-r/2, r, r)`. Constructor `0x0040F9E0` stores
these four values directly. Grid `0x00522F50` filters target **roots**
through `0x005230D5 -> 0x00403DA0`, lower-inclusive and upper-exclusive.
Only those candidates then undergo `distanceSquared < r*r + bodyRadius*bodyRadius`
at `0x00642203..4B`. For ordinary mask-2 hostiles the square of side
`55*scale` is already the limiting footprint; a free radius-55 circle and
the former square of side 110 are both wrong.

Both queries traverse X cell, then Y cell, then cell binding order. The
current web actor/Maggot concatenation and Set-based candidate collection
lose this order. Preserve authoritative grid/binding order for area damage
and resulting deaths; do not replace it with ID sorting.

Both helpers exclude native type `0xBB9`; its identity remains unverified.
The prior entry-198 shorthand calling that type “Coffin” is disproved by
Coffin's catalogued type `0x3F5`. Do not filter web Coffins based on that
mislabel. Preserve the numeric native evidence without inventing an adapter.

### Synchronous newborn construction and callback ownership

The native helper requests the two Fire sounds first
(`0x00642CE9/0x00642D4F`), creates core/array/rising-array children, resolves
area contact, then constructs each Ember. An Ember is registered at
`0x006432E4`, receives its Region pointer at `0x006432EA`, and executes
ten immediate tick attempts at `0x006432ED..0x00643302`. Removal byte
`+5` is checked after each; a consumed child has no later pre-tick
contacts. Only then is the next child constructed. These operations finish
inside the originating damage call, before the next Flame chain target
query. Do not invent a later ordinary manager step in the same tick.

The current shared factory constructs all Embers/contact records before
server resolution and registers actors later. Flame's owned burst is born
after the existing fire-contact pass, which scans source and impact
transients, not the newly owned set. Subsequent source advancement moves it
past the age-zero gate, permanently losing the required splash and
construction contacts. A second complete fire pass would risk replaying
unrelated sources and is not an approved correction.

The scoped repair may introduce an optional synchronous construction visitor
owned by the shared factory and used by the special-death consumer:
area resolution first, then each child registration and each construction
contact/removal result before the next tick/child. Existing direct consumers
keep their default scheduling unless separately proved and changed. The
parent must test default Fireball, Burning Bolt, Meteor-adapter and Immolate
behavior plus the new synchronous path. Particle registration and contact
resolution must have one owner and cannot replay on the next world tick.

Steam's distinct helper owns gray overlays, one registry-27 cue and normal
zero-own-payload Steam children. It has no Ember ten-pre-tick loop. Its typed
payload is attached to the current modifier damage event, and admitted
terminal processing must resolve its area before any subsequent chain or
modifier event. Shared audiovisual identities, three visual clocks, 37-tick
maximum child lifetime, lights, protocol/copy/interpolation, observer cue
dedup and owner/world teardown remain unchanged contracts.

### Separately open Ring defect and implementation disposition

Independent review proved the maximum Ring queue stores half and applies it
only once; its current radius `165 + bodyRadius`, inclusive boundary and
ID sorting also disagree with the native helper at scale 1.5: strict root
radius **82.5** and grid order. Preserve its separate secondary-world path.
Record this defect as **recovered, open outside the report-118 runtime patch**
unless a shared change actually touches it, in which case add explicit
red-to-green coverage before claiming compatibility. It is not evidence of
a hidden second half for the primary pipeline.

Independent byte/source review result: **PASS for the bounded shared-owner
repair; FAIL for a blanket multiplier, second full Fire pass, or killed-only
callback.** The native/source evidence is ready for implementation. No runtime
change, passing candidate gate, Mac/browser/audio acceptance or report closure
is asserted by this documentation update. Required tests cover each direct
non-Flame consumer and the web Meteor adapter, both query edge predicates and
grid order, shield/armor/Spider/Cocoon/alignment/dead admission, one-time
newborn splash, per-child consumption, collateral-before-next-chain behavior,
negative recursive payload inheritance and all scene/observer teardown paths.

### Residual receiver-state boundary

The 21-table inventory is exhaustive native membership, not proof that every inherited native state is represented by the Website. In particular, Imp `+0x234` is a proved rejection byte with unresolved semantic identity and unverified `BoneyardImpBrain` correspondence. Friendly/non-authoritative `+0x5C` states are also distinct from the current live hostile mask-2 store. The scoped terminal-dispatch marker must report actual admitted current receiver branches, preserve known armor/shield/Cocoon behavior, and must not invent missing Imp/alignment state. Native path-light RNG loop cardinality versus the web owner remains an explicit presentation boundary in entry 123.

### Report118 independent candidate review, 2026-10-13

The synchronous constructor visitor introduces a reachable audio-consumer
obligation. Parent Fire cues at retail 0x642CE9/0x642D4F precede area damage
and Ember registration/pre-ticks. The prior PrimarySpellAudioSynchronizer
iterated all fire-impact births before fire-explosion births, so a consumed
construction Ember could sound before its parent. A read-only Mac reproduction
confirmed that reversal with parent transient registration100 and child101.
The scoped repair merges only those two Fire birth kinds in transient-manager
registration order. Ordinary direct impact-before-explosion, Steam's single
cue, initial-snapshot silence, dedup and spatial gain remain separate tests.
The red receipt is report118-audio-order-red.log in the task evidence root.

Acceptance remains bounded to the report's stock learned-skill rows and the
ported event/damage ownership. Additional independently recovered limits:
- Positive Explode with radius zero reaches unconditional native parent cues
  and core creation. Stock positive Explode ranks have radius10..20; this
  combination is not a stock-authored report118 loadout. The current Fire
  factory and positive-scale protocol do not represent this degenerate branch.
  It remains open; do not infer a radius gate in the native dispatcher.
- Flame chain width consumes the recovered .8-Float(.3) draw, but the current
  channel projection still renders normal width1. The semantic width field
  and geometric path-light RNG cardinality remain unported presentation work.
- Steam terminal damage and newborn resolution occur synchronously within the
  secondary damage consumer, but modifier producers are still prequeued and
  use the existing secondary RNG stream, separately from primary combat RNG.
  Collateral can invalidate a later contact without undoing its earlier
  producer draws. This patch does not claim native global-RNG interleaving.
- Hub input is sealed for all primary casts. The suspected non-Boneyard deferred
  birth regression was withdrawn; an authoritative held-Flame Hub test keeps
  the existing seal. Real Boneyard targeted/no-target/death births are tested.

The source code uses an explicit specialDeathAccepted result for admitted
ordinary and active-Maggot terminal branches, false for shield absorption,
armor break, rejected/dead actors and Cocoon release. Unrepresented native
alignment and Imp +0x234 states remain the documented limits above.
