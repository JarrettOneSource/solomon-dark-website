# 2026-08-22 — Shared-Hub combat seal, equipped-effect pulse ownership, and post-loadout admission

## Reported smell and parity question

- Reported web behavior: players can cast primary and secondary combat actions
  in the shared Hub; an ordinary spell emission visibly enlarges the complete
  staff raster; and entering New Game or the Dark Cloud party lane requests a
  shared-Hub ticket before the player has chosen a complete loadout or entered
  the loading barrier.
- Requested behavior: the shared social Hub admits movement, interaction, and
  loadout editing but no combat cast; staff geometry remains stable during
  every spell; and a new browser player requests shared-Hub admission only
  after accepting a discipline, with the match-loading screen already owning
  presentation and input.
- Stock behavior to preserve: Create owns the complete element/discipline/name
  configuration before gameplay constructs a player; the native cast seal can
  suppress cast state without suppressing movement; Staff actions own pose and
  emitter selection; and PlayerWizard effect phase `+0x268` has fixed-tick
  writers, element-VFX/light consumers, and teardown independent of staff
  geometry.
- Falsifiers: any Hub input produces a primary action, projectile, secondary
  event/actor, mana debit, or cast pose; any ordinary staff/wand sprite scale
  differs from one; any pulse is absent from the element effect; any Boneyard
  cast is blocked; or `/api/game/hub` is requested before the accepted
  discipline has mounted the Hub loading barrier.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail executable | unmodified Beta `0.72.5` `SolomonDarkAbandonware/SolomonDark.exe`, `4,723,200` bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred image base `0x00400000` | Exact stock image used by the existing read-only Ghidra project. | high |
| Fresh instruction/offset census | `find_writes_to_offset.py`, `find_reads_from_offset.py`, and instruction windows against PlayerWizard `+0x268`; constructor `0x0052B4C0`, action callback `0x00550180`, tick `0x00548B00`, render `0x0054BA80`, attachment compositor `0x00538B80`, element helper `0x0053B1D0`, light provider `0x005299A0` | Action modes write the pulse and tick decays it. Attachment calls retain ordinary actor scale. Only the later element helper applies `actorScale*(1+10*pulse)`; the light provider uses `(1+pulse)*2.6`. Staff/wand geometry never consumes the pulse. | high |
| Existing native reports | Mod Loader `origin/main` `4db72854`; `native-input-model.md`, `native-lighting-and-shadow-system.md`, `native-projectile-and-spell-mechanics.md`, `native-skills-and-spells.md`, and `native-session-flow.md` | Game cast seal is `Gameplay+0x1ABE`; Create precedes player construction; all action modes/values, pure primaries, welds, secondaries, and world-entry lifecycles are already catalogued. The two pulse reports are corrected in this pass. | high |
| Current web causal trace | Website `origin/main` `762b6067`; `game-simulation.ts`, `HubScene.tsx`, `gameplay-input.ts`, `SkillQuickbar.tsx`, `player-character-presentation.ts`, `hub-actors.ts` | Hub is admitted as a combat-capable phase; primary/right-stick/quickbar producers remain live. `weaponScale = 1 + 10*primaryCast.weaponPulse` is applied to all four normal/hit staff sprites, while the element view remains at scale one. | high |
| Current admission trace | `Game.tsx`, `MainMenuScene.tsx`, `CreateMenuScene.tsx`, `game-bootstrap.ts`, and the existing discipline-commit loading contract | `beginNewGame` awaits `prepareNewGame`, whose web branch calls `POST /api/game/hub`, before entering Create. The accepted discipline already starts the loading barrier immediately, while `onStart` follows the preserved 880 ms final recurrence. | high |
| Product direction | user correction, 2026-08-22 | The Website shared Hub is noncombat and ticket admission begins only behind the post-loadout loading screen. | authoritative |

## System boundary A and membership — shared-Hub combat admission

System: **world-owned player combat-input seal**. The Hub preserves movement,
social/player selection, traders, Inventory/SkillScreen, potion actions, and
category-1 primary selection. It rejects primary execution and every
category-2 quickbar execution before either spell authority sees the input.

| Member | Native/web owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Courtyard plus Mortuary, Library, Storeroom, and Office | Hub `world.kind` and participant region | `exact-ported` as requested shared-Hub policy | one authority gate covers all five regions; per-region movement remains live |
| Desktop left-button primary and mobile right-stick primary | browser gameplay input | `exact-ported` | Hub producer emits no primary level; touch primary surface is absent |
| Category-1 quickbar primary selection | IDs `8,16,24,32,40,52` and learned weld identity | `verified-already-at-parity` | selection remains available and creates no cast |
| Ether primary `8` | primary authority | `exact-ported` Hub rejection | no action, mana, projectile, pulse, or audio sequence |
| Fire primary `16` | primary authority | `exact-ported` Hub rejection | same |
| Air primary `24` | primary authority | `exact-ported` Hub rejection | same |
| Water primary `32` | primary authority | `exact-ported` Hub rejection | same |
| Earth primary `40` | primary authority | `exact-ported` Hub rejection | same |
| Weld primaries `1000..1009` | selected weld profile | `exact-ported` Hub rejection | table-driven all-build assertion |
| Secondary `11` Call Leviathan | category-2 quickbar | `exact-ported` Hub rejection | table-driven full category-2 assertion |
| Secondary `12` Planewalker | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `15` Phasing | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `21` Ring of Fire | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `23` Firewalker | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `27` Magic Storm | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `30` Prismatic Shock | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `35` Ring of Ice | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `41` Earthquake | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `45` Raise Golem | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `46` Stoneskin | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `48` Teleport | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `49` Magic Circle | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `50` Magic Trap | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `51` Dampen | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `54` Magic Shield | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `72` Acid Rain | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `73` Fire Wall | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `74` Ether Drain | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `76` Call Comet | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `77` Turn Undead | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `78` Mindstar | category-2 quickbar | `exact-ported` Hub rejection | same |
| Secondary `79` Regenerate | category-2 quickbar | `exact-ported` Hub rejection | same |
| Staff melee/spin and proc family | `player-staff-combat-system` | `verified-already-at-parity` | already admitted only for `world.kind === 'boneyard'` |
| Hub movement, pointer player/trader selection, books, inventory, potions, chat | separate noncombat owners | `verified-already-at-parity` | focused movement/UI/browser assertions |
| Boneyard primary, secondary, and staff families | active run world | `verified-already-at-parity` | existing per-member suites plus post-change real cast |
| world replacement/disconnect/post-run return | transition/reset owners | `verified-already-at-parity` | existing primary/secondary reset and owner-removal tests |

No member is browser-blocked. This is an explicit Website social-space policy;
retail has no process-wide multiplayer social Hub policy to claim as stock.
The implementation reuses the native-shaped separation between movement and
cast admission instead of inventing a second combat simulation.

## System boundary B and membership — PlayerWizard `+0x268` pulse

System: **action-authored equipped-element effect/light phase**, from every
native writer through fixed-tick decay, replication/interpolation, renderer and
light consumers, and reset. The previous Website v47 entry incorrectly called
this a held-weapon scale and applied it to the whole staff; that skipped the
complete consumer census and is reopened here.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| constructor/reset zero | `0x0052B76D` and ordinary lifecycle resets | `verified-already-at-parity` | idle/re-entry/disconnect state zero |
| StaffCast1, bare-hand Cast1, wand Cast1 | `0x00550180` modes `3,6,9`, value `0.15` | `verified-already-at-parity` state writer | emission-edge and decay tests |
| StaffConstant and Cast2/constant siblings | `0x00550180` modes `4,5,7,8,10,11`, values `0.25/0.45` | `verified-already-at-parity` through existing cast-light state | channel/secondary coverage retained |
| Ether Blast integer crossing | `0x0054B9C8`, value `0.25` | `verified-already-at-parity` | charge/cue/pulse test |
| float32 tick decay | `0x00548FFC..0x00549012`, `*0.899999976` | `verified-already-at-parity` | pulse recurrence/interpolation test |
| staff selectors `0..3`, wand selectors `0..5`, and unequipped hands | attachment compositor `0x00538B80` | `exact-ported` by removing pulse scaling | every attachment stays uniform scale one across idle/cast/pulse |
| Ether, Fire, Air, Water, Earth equipped element effects | helper `0x0053B1D0` | `exact-ported` by moving the shared scale to the element plan | all five plans consume `1+10*pulse` at their existing attachment socket/depth |
| normal and red hit-copy attachment layers | same item composite and hit overlay | `exact-ported` | both retain unit weapon scale |
| player analytic light radius | `0x005299A0` | `verified-already-at-parity` | existing `(1+phase)*2.6` light tests |
| player state wire/copy/interpolation | PlayerWizard serialization family; Website protocol/timelines | `verified-already-at-parity` | strict domain and owned interpolation tests |
| death/world exit/reconnect | actor and session teardown | `verified-already-at-parity` | no stale pulse or scaled attachment survives replacement |

## System boundary C and membership — new-player shared-Hub admission

System: **Create-to-loading-to-shared-Hub entry ownership**, from a fresh entry
request through complete loadout, single-use ticket acquisition, transport,
welcome, renderer readiness, cancellation, and failure.

| Member / branch | Owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Title Play -> New Game | `MainMenuScene.beginNewGame` | `exact-ported` requested timing | enters fresh Create without `/api/game/hub` |
| Dark Cloud Multiplayer footer and listed-party action | shared `beginNewGame` | `exact-ported` requested timing | both enter fresh Create without admission |
| element/name selection and Create Back | `CreateMenuScene` | `verified-already-at-parity` | no ticket exists to cancel before discipline |
| accepted discipline | Create commit edge | `verified-already-at-parity` | one hidden Hub loading/input barrier starts immediately |
| preserved 880 ms Create finalization and `catch-it` | Create lifecycle | `verified-already-at-parity` | remains beneath the same loading owner |
| web `/api/game/hub` ticket | page control plane | `exact-ported` requested timing | first request occurs only after discipline commit while loading is attached |
| configured desktop/private endpoint | platform adapter | `exact-ported` same ordering | endpoint use/connect remains post-loadout; no browser API request |
| transport/welcome/Hub renderer | existing semantic loading stages | `verified-already-at-parity` | `.44 -> .52 -> .92 -> ready`, one barrier, no restart |
| admission failure | loading and Create owners | `exact-ported` | cancel barrier, surface the existing Create/resume error, allow retry without a partial actor |
| connection/renderer failure | page runtime diagnostics | `verified-already-at-parity` | discard the ticket and enter the established fatal diagnostic surface without a partial actor |
| saved-game resume | complete stored character plus Hub/Boneyard loading flow | `exact-ported` loading-first ordering | loading attaches before ticket request; no new loadout is required |
| retained post-run loadout | existing live session | `out-of-system` (no new admission) | host confirmation uses the retained connection |
| duplicate discipline/request | `pendingDiscipline`, `connecting`, and ticket single-use rules | `verified-already-at-parity` | exactly one request/connect attempt |

## Native ownership thread and recovered contract

- Player input is planned once per 10 ms tick. The active world owns whether
  cast levels are eligible; the Hub projects only movement plus safe primary
  selection, while Boneyard passes the complete combat input.
- `+0x268` is action-owned float state. The attachment compositor consumes
  actor/action geometry without it. The later element helper and light provider
  consume it independently; multiplying the combined staff/hand raster moved
  the field across the native ownership seam.
- Create owns incomplete configuration. The Website loading barrier begins on
  the accepted discipline, then the web control plane acquires the one-use
  ticket and the session constructs a player only from the complete hello.
- Hub admission failure cannot leave a partial authoritative player because no
  WebSocket hello was accepted. Backing out before discipline has no ticket or
  server-side actor to release.
- Hub combat rejection is host-authoritative. Browser suppression removes
  misleading primary/touch affordances, but a crafted client still reaches the
  same server-side world gate and cannot spend mana or materialize an effect.

## Nearby-system findings

- The existing v47 Ether Blast write/replication path is valid; its consumer
  attribution was not. The phase still enlarges the equipped element effect and
  player analytic light exactly as native.
- Category-1 quickbar presses are selection intents, not combat execution, and
  remain valid in Hub. Category-2 presses invoke actions and are rejected.
- The Shared-Hub ticket seals account/mod content. Moving its request later
  means subscription/account state is sampled at the actual post-loadout entry
  boundary instead of while the player is still editing a character.
- No Mod Loader session-flow change is required. Reusable corrected native
  facts are recorded in `native-skills-and-spells.md` and
  `native-lighting-and-shadow-system.md`.

## Confidence and open questions

- Confirmed: complete `+0x268` direct access census in the PlayerWizard family,
  writer values/decay, attachment non-consumption, all three element-helper
  reads, player-light consumption, current Hub combat path, and current ticket
  timing.
- Product policy: noncombat shared Hub and post-loadout ticket acquisition are
  explicit Website requirements, not claims about retail multiplayer behavior.
- Unknown: none material to these three corrections. All browser mechanisms are
  representable without approximation.

## Web implementation consequence

- Filter Hub combat at the authoritative world boundary while retaining
  movement and category-1 selection. Suppress Hub primary mouse/touch output
  and disable category-2 pointer quickbar actions; do not rely on the client.
- Remove pulse-derived scaling from normal and hit-copy staff/wand sprites.
  Feed the recovered shared pulse scale to `NativeElementVfxView` at its existing
  attachment socket and painter depth.
- Make fresh `beginNewGame` Create-only. Acquire the configured/shared endpoint
  inside the already active Hub loading sequence before `connectSession`.
  Resume similarly mounts its loading barrier before admission.
- Update runtime architecture because both Hub input authority and browser
  admission timing change. No protocol or backend route shape is required.

## Validation contract

- Focused authority: all five pure primaries, ten weld IDs, and all 23
  category-2 IDs fail to cast in every Hub region with unchanged mana/effect
  state; category-1 selection and movement remain live; representative primary,
  secondary, and staff actions still execute in Boneyard.
- Focused presentation: every staff/wand selector and hit-copy layer remains at
  scale one for ordinary cast and Ether pulse; all five element-effect plans
  receive `1+10*pulse`; idle returns to one.
- Focused entry: Title and both Dark Cloud actions cause zero admission calls
  through Create; discipline commit attaches loading before the first admission;
  resume attaches loading before admission; admission failure returns to an
  actionable Create/resume state.
- Browser journey: enter Create from Dark Cloud, prove no `/api/game/hub`
  request before discipline, prove the loading overlay precedes the request,
  reach Hub, attempt left/right/keyboard/touch combat with no authoritative or
  rendered effect, enter Boneyard, cast visibly with weapon scale one and an
  independently pulsing element effect, and record zero page/console errors.
- Run the only supported full gate, `./scripts/validate.sh`, on the exact tree
  that is committed and pushed.

## Implementation validation receipt

- Authority: `hub-combat-input.ts` seals primary execution and every category-2
  quickbar intent before the primary/secondary simulation owners run. Movement
  and category-1 selection remain live. `HubScene` also removes the touch-cast
  surface and suppresses primary pointer output, while the quickbar disables
  category-2 pointer actions without becoming the authority boundary.
- Presentation: normal and hit-copy staff/wand sprites remain at uniform scale
  `1`. The recovered `1 + 10 * pulse` transform now belongs to the equipped
  `NativeElementVfxView`; diagnostics expose weapon and element-effect scales
  independently in both Hub and Boneyard renderers.
- Entry: fresh Title and Dark Cloud entry are Create-only. Discipline commit
  mounts the Hub loading barrier, then `startHub` requests the endpoint/ticket
  and connects the complete character. Resume likewise mounts its matching
  loading barrier before requesting admission. Failed admission/session
  attempts discard their tickets so later entry cannot reuse stale credentials.
- Focused red/green receipt: the pre-implementation selection failed seven
  assertions at the missing authority, input, quickbar, admission, and scale
  seams; the completed focused selection passed `82/82`. The table-driven
  authority census covers all five pure primary IDs, weld IDs `1000..1009`, and
  all 23 category-2 IDs.
- Static native-doc receipt: Mod Loader
  `python3 tests/re/run_static_re_tests.py --ci` passed `491/491` after the
  reusable `+0x268` ownership correction.
- Exact Website gate on the implementation tree: `./scripts/validate.sh`
  passed backend build/contracts/formatting, lint and import boundaries, all
  frontend matrices including `227/227` prerequisites and `1275/1275` runtime
  tests, desktop tests, production build, bundle budget, and CSP media policy.
  The Linux runner's default parallel file scheduling starved two pre-existing
  socket-message timers; their two-file isolation passed `49/49`, and the
  unchanged canonical gate passed with one-CPU affinity. No timeout or product
  assertion was loosened.
- Real Chromium/WebGL journey: Chrome `150.0.7871.124`, `1200x900`, reached its
  first `/api/game/hub` request about `1107.5 ms` after discipline commit with
  the loading surface attached at `connecting_transport`. Thirteen Hub combat
  samples retained mana `100`, action pose `0`, element scale `1`, weapon scale
  `1`, primary spell count `0`, and secondary count `0`. A Boneyard Fire cast
  reached attachment pose `8`, element scale `2.3500001430511475`, weapon scale
  `1`, and primary spell count `10`. Page errors, console errors, and failed
  requests were all empty. Receipts:
  `/tmp/solomon-hub-noncombat-final.png` and
  `/tmp/solomon-boneyard-staff-scale-final.png`.
- Rebase receipt: current `origin/main`'s fixed-stage projection and Dark Cloud
  native SimpleMenu were preserved through the two overlapping conflicts; the
  combined affected selection passed `105/105` after resolution.
- Mac mini exact-tree receipt: detached Website commit
  `4fe72cb1473611fed8b254de51f0e14d34d3b931`, Node `22.17.0`, npm `10.9.2`,
  .NET SDK `10.0.302`, and Chrome `151.0.7922.170`. The canonical
  `./scripts/validate.sh` passed, including `227/227` prerequisites,
  `1288/1288` runtime tests, the concurrent weather-boundary suite `8/8`, every
  tail suite, production build, bundle budget, and media policy. The real
  Chrome/WebGL journey issued admission `914.2 ms`
  after discipline commit with loading attached at `connecting_transport`;
  70 Hub samples retained mana `100`, pose `0`, both scales `1`, and zero
  primary/secondary actors. Boneyard Fire reached pose `8`, element-effect
  scale `2.3500001430511475`, weapon scale `1`, and three live primary actors.
  Error arrays were empty. Mac screenshots are
  `/tmp/solomon-hub-cast-entry-final-20260822.ZaMcfn/solomon-hub-noncombat-final.png`
  (SHA-256 `3ecfb25c663ef57d98b1c2b8db28e8e19084a01e2431798b3053df30044cd2fb`)
  and `solomon-boneyard-staff-scale-final.png` (SHA-256
  `00616cbe9136bce5ac2fad83df2787079980c1ac3d9ab0f1688d78012d9f87e9`).
  The temporary host/Vite processes were stopped and both ports were closed.
