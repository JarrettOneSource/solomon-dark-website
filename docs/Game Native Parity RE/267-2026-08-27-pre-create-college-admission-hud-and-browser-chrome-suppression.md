# 2026-08-27 — Pre-Create College admission HUD and browser-chrome suppression

## Reported smell and parity question

- Reported web behavior: the post-Tutorial College introduction shows browser
  HUD/UI around the native title cards and forced wizard walk. The UI should
  remain absent through the pre-Create admission and return when the Office
  exit hands control to the loadout screen.
- Current causal defect: `college-intro.css` hides only `.hub-hud` and the party
  panel, and attempts to hide a nonexistent `.touch-joystick` class, all only
  while the transient `participant.collegeIntro` object is non-null.
  Stage-owned chat, fullscreen, mod UI, and WebGL NPC/help markers are
  independent consumers. Acknowledging `ARCH_INTRO_0` sets
  `collegeIntro=null` while the durable pre-loadout Office state remains
  active, so even the scoped descendants can return before the player reaches
  Create.
- Reproduction: complete the Tutorial into the College; inspect Title records
  7 and 9, automatic Arch dialogue, dialogue acknowledgement, manual Office
  exit, Create, post-confirmation Courtyard incoming, a refresh from the
  acknowledged Office checkpoint, and a fresh/declined new-save branch.
- Falsifiers: a native title frame includes the ordinary HUD or onboarding
  markers; `collegeIntro=null` proves loadout confirmation; a post-loadout
  incoming transition can occur before confirmation; or save/restore loses the
  state needed to distinguish acknowledged Office from returned Courtyard.
## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity and recovered admission | retail Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000`; `GameOver::Tick 0x005CF4F0`, Courtyard `0x00506490/0x0050C970`, Office `0x00509C70/0x00509F10`, `Office::AfterSwitch 0x00504AD0` | `DAT_00B3BCA0` owns the admission walk and suppresses ordinary controls/HUD/markers while live; Office exit, not dialogue teardown or a timer, opens Create. | high |
| Native HUD/marker membership | HUD renderer `0x005D2520`; NPC common marker `0x00518280`; Courtyard onboarding painter `0x0051EB60`; existing `native-hud.md`, `native-hub-npc-interactions.md`, and `native-session-flow.md` | The ordinary 26-member HUD, actor markers, and fresh-profile help overlays are presentation siblings outside the title/wizard world composition. | high |
| Current web source trace | exact Website base `b44c9f23e1f997e20c064c62e749604371032b3c`; `HubScene.tsx`, `college-intro.css`, `MainMenuScene.tsx`, `hub-world-renderer.ts`, `hub-npc-marker-presentation.ts` | The transient CSS gate cannot reach stage siblings; marker surface remains null; chat/fullscreen/mod surfaces mount from session presence rather than admission phase. | high |
| Current web pixels | `/tmp/sd-college-title-walk-20260826/web-final-raptisoft.png` SHA-256 `14e3cfd624614a743b8944566891dd155a282fb69277d190d55f3baa972afa47`; `web-final-solomon.png` SHA-256 `9f917a713a3d26b6e8fe5894e79cb0c924fb8a32f64faf16558d4d7b6801f637`; `/tmp/college-candidate-office.png` SHA-256 `919fa77592a1f90f528df02a1d7dc3e260040b045adc20e22f91497eec90b636` | Fullscreen and chat controls remain visible in both title frames; fresh Courtyard help text/arrows and NPC markers paint beneath the title; the Office dialogue frame retains the same browser chrome. The owning source is unchanged on the current base. | high-visible |
| Authoritative web lifecycle | `HubParticipantState`, `stepParticipantTransition`, `confirmHubCollegeIntroLoadout`, `confirmGameSimulationLoadout`, current save schema 18 | `collegeIntroPending` spans the pre-confirmation admission; `collegeIntro=null` means only dialogue acknowledgement. Loadout confirmation atomically clears both onboarding bits and creates `transition.phase='incoming'` from Office to Courtyard. All consumed fields round-trip in saves. | high |

## System boundary and membership inventory

Native system: participant-local College admission presentation from the
Tutorial handoff through Create ownership and the confirmed Courtyard return.
The web projection includes every gameplay/browser UI surface that can cover
the title/walk, plus refresh and save boundaries that can reconstruct it.

| Member / branch | Native or web source | Disposition | Proof required |
| --- | --- | --- | --- |
| Courtyard world, green scroll-bearing wizard, Title 7 and Title 9 | admission paths/title spline and existing exact renderer | `verified-already-at-parity` | remain visible and unchanged while chrome is absent |
| Office path, Arch dialogue, and manual exit | Office spline/contact/Chat/exit owner | `verified-already-at-parity` | automatic dialogue stays operable; player can still reach exit |
| ordinary 26-member gameplay HUD, account, allies, diagnostics | `0x005D2520`; `GameHud` | `exact-ported` suppression | hidden for every pre-loadout Hub state; visible on returned Hub |
| menu skull and OPEN MENU input | native HUD/menu gate; stage `GameMenuSkull` | `exact-ported` suppression | unmounted/hidden and keyboard/gamepad request rejected pre-loadout |
| named-NPC markers and fresh-profile onboarding arrows/text | `0x00518280`, `0x0051EB60`; WebGL marker surface | `exact-ported` suppression | renderer receives a suppressing surface through the complete pre-loadout interval |
| remote world nameplates, activity badges, and speech bubbles | Website multiplayer presentation layers | `out-of-system` (browser social UI) | all stay non-renderable while the local admission owns presentation |
| contextual INTERACT prompt | Website coarse-pointer/accessibility extension | `out-of-system` (browser interaction UI) | prompt stays hidden; direct actor tap and keyboard/gamepad interaction remain available |
| Inventory, SkillBook, selected-HUD picker, level picker/wait, pause, settings, and resume countdown | native modal owners plus Website multiplayer surfaces | `verified-already-at-parity`, admission gate strengthened | no stale or addressed HUD action can mount one over the admission; required story Chat is independent |
| party panel and player-card entry | Website shared-Hub extension | `out-of-system` (browser social UI) | hidden pre-loadout, unchanged afterward |
| game chat button/panel/world speech | Website chat extension | `out-of-system` (browser social UI) | not mounted pre-loadout; authoritative dialogue remains independent |
| mod minimap, panels, and authored scene overlay | Website mod extension | `out-of-system` (browser mod UI) | not mounted pre-loadout; no mod runtime authority changes |
| fullscreen control | Website browser chrome | `out-of-system` (browser viewport UI) | absent pre-loadout and restored in Create |
| touch joystick during forced walk/dialogue | browser coarse-pointer input | `exact-ported` suppression | hidden while the native program owns movement or dialogue |
| touch joystick after acknowledgement and before Office exit | no hardware keyboard on touch-only browser | `blocked-by-platform` (manual exit otherwise has no locomotion surface) | joystick alone returns; all nonessential HUD/chrome remains absent |
| loading, connection error, deployment error, and portrait-orientation guidance | application recovery/accessibility owners | `out-of-system` (not gameplay HUD) | remain available when applicable; never mistaken for admission chrome |
| Create/loadout screen | `Office::AfterSwitch 0x00504AD0`; `college-loadout` | `verified-already-at-parity`, chrome release boundary | complete Create UI and browser chrome appear without a Hub-frame flash |
| post-confirmation Office-to-Courtyard incoming | `confirmHubCollegeIntroLoadout` and atomic onboarding-bit clear | `verified-already-at-parity`, chrome release witness | HUD is live with both current onboarding bits false; exact incoming also releases an older saved continuation whose pending bit cleared at settlement |
| acknowledged-Office refresh/save restore | schema-18 participant/economy state | `exact-ported` | `collegeIntro=null` plus pending still suppresses; no replay or leak |
| refresh in `college-loadout` or post-confirmation incoming | serialized transition state from schema 15 onward | `exact-ported` | Create owns the former; exact incoming witness releases the latter across both current and earlier completion boundaries |
| Tutorial-declined/fresh ordinary Create and existing saves | authoritative pending=false admission branches | `verified-already-at-parity` | no false suppression from page-local profile or stale component state |

## Native ownership thread and recovered behavioral contract

- Native `DAT_00B3BCA0` establishes that the admission state, not elapsed time
  or player-object presence, owns HUD/marker suppression. Native clears that
  flag when its first question path acknowledges the forced program; the user-
  requested Website policy deliberately keeps nonessential browser chrome
  absent through the later manual exit and releases it at Create.
- The browser durable projection already has the necessary state. Pending=true
  identifies the current pre-confirmation admission; loadout confirmation
  clears it while creating the exact `incoming / office -> courtyard`
  transition. That incoming witness remains an explicit release for a saved
  continuation from the earlier settlement-clear schema. `collegeIntro` alone
  is insufficient because it is null throughout acknowledged Office, outgoing,
  loadout wait, and returned incoming.
- Screen ownership still matters: `college-loadout` may be observed for one
  React frame while Hub is mounted, so Hub chrome remains suppressed there;
  once `screen='create'`, Create is the visible owner and browser chrome may
  return. No timeout, mount counter, localStorage flag, or inferred wizard
  config participates.
- Required story Chat stays mounted and interactive. General HUD shortcuts,
  chat, menu, party, mods, and marker painters are presentation consumers only
  and cannot mutate or release admission authority.

## Nearby-system findings

- The current architecture overview still described the superseded direct-
  Office/100-tick admission and restart-on-refresh behavior. The current
  schema instead preserves the exact Courtyard/Office program and transition.
  `game-runtime-architecture.md` is corrected in this pass.
- `markerSurface=null` currently allows both the WebGL actor-marker family and
  fresh-profile help overlays under the title cards. The same suppressing
  renderer surface closes both siblings without adding College-only sprite
  exceptions.

## Confidence and open questions

- Confirmed: native suppression owner, current browser leak, complete current
  surface membership, dialogue/loadout/return transition graph, and save
  persistence fields.
- Requested browser policy: continue hiding nonessential chrome from native
  dialogue acknowledgement through Create instead of releasing at the native
  first-question edge.
- Platform constraint: touch-only manual Office movement needs the existing
  joystick after acknowledgement. No other member is blocked.

## Web implementation consequence

- Add one pure lifecycle predicate beside the Hub transition owner. It consumes
  authoritative `collegeIntroPending` and participant transition state and
  identifies pre-loadout admission; MainMenu and Hub presentation must share
  that result.
- Scope suppression to a mounted Hub scene. Use it for the inner HUD/party,
  stage menu/chat/mod/fullscreen surfaces, HUD keyboard/gamepad actions, and
  WebGL marker surface. Keep automatic College dialogue and world movement
  alive. Retain the touch joystick only after the forced program ends.
- Remove the transient `collegeIntro` CSS rule as the HUD owner. Keep the
  transient object only for its title overlay and forced-movement presentation.

## Validation contract

- Focused lifecycle tests cover fresh Courtyard, Office walk/dialogue,
  acknowledged Office, outgoing, `college-loadout`, post-confirmation incoming,
  settled Hub, Tutorial decline, and missing/transient participant state.
- Save round-trip coverage proves acknowledged Office stays suppressed and
  post-confirmation incoming stays released from the serialized authority.
- Presentation contracts enumerate every React/WebGL member and prove the
  required dialogue and touch-only exit remain usable.
- Mac Chrome/WebGL runs the Tutorial through both title cards, dialogue,
  acknowledged Office, manual exit, Create, and returned Hub; reload the
  acknowledged checkpoint and repeat the exit. Title pixels contain no browser
  chrome or marker/help overlay, Create and returned Hub restore normal UI, and
  page/console/network error arrays remain empty.
- Run the complete Mod Loader static-RE registry and Website canonical gate on
  byte-identical detached Mac worktrees. Publication and deployment remain
  separate and unrequested.

## Implementation validation receipt

- Root cause and implementation: `hubCollegeAdmissionPreLoadout` classifies the
  portable admission from authoritative pending/transition state. MainMenu and
  Hub consume that one result for gameplay HUD, menu, chat, mod, fullscreen,
  party, modal, shortcut, quickbar, contextual-prompt, and world-presentation
  membership. The renderer receives the flag before its first frame and hides
  NPC/help markers, remote nameplates, activity badges, and speech bubbles.
  `collegeIntro` now owns only the title/forced-program presentation. Current
  confirmation clears both onboarding bits as it enters
  `incoming / office -> courtyard`; that exact transition also releases an
  earlier saved continuation whose pending bit survived until settlement. No
  timer, storage latch, wizard-config inference, or refresh-local React flag
  exists.
- Lifecycle/save coverage exercises fresh pending state, every forced/dialogue
  and transition branch, acknowledged Office, serialized `college-loadout`,
  serialized post-confirmation incoming, settlement, decline, and missing
  participant state. Presentation coverage enumerates every React/WebGL sibling
  and seals quickbar/menu/skills/inventory input while retaining story Chat and
  manual movement.
- Exact validated pre-receipt candidates are Website commit
  `4032c259f113698ba6098e611f527af7e9273c9c` over current-main base
  `ced3632acc5e87ae744dd7237031a3e258735433`, and Mod Loader commit
  `94c046c198ed34d74d5201c3386907c3232cdbeb` over base
  `4b44b9fa3147e08be11c52159860f11b4b7df485`. The 14 Website changed files and
  one Mod Loader report were byte-identical in the local and detached Mac
  worktrees before validation. Concurrent Sack, crash-page recovery, and
  Global/Boneyard chat changes were preserved through their current-main
  rebases; the latter chat surface remains inside this admission gate.
- The complete supported Mac Website gate passes the backend Release build
  with zero warnings/errors, `26/26` backend/contracts, lint/type/generated and
  formatting checks, every registered frontend/runtime/desktop suite,
  production frontend/game-host builds, bundle budget, and media/CSP policy.
  The Hub UI group passes `85/85`. Production entry `Game-C4wkWiwx.js` is
  `252,409` raw / `76,678` gzip bytes under `524,288 / 134,144`. Gate-log
  SHA-256 is
  `c392cb4599316aeb77142d572ec4e82c5c7c0c359a72ba573f0c111b3ed26e1a`.
  An earlier superseded-base run passed every test but exceeded the old packed
  entry by 53 gzip bytes; no budget was raised. The current-main chat split and
  lifecycle-only module produce the passing final bundle above.
- The exact Mod Loader candidate passes the complete registered Mac static-RE
  suite `517/517`; log SHA-256 is
  `51d96a8f2eb673d910c1385ddfebdbd26db732c569dea0a31d71820c6db2109a`.
- Mac Chrome `151.0.7922.174` completes both stock `1600x900` and touch
  `896x414` journeys with `status: ok`. In each, Title 7, Title 9, automatic
  Arch dialogue, acknowledged Office, and a real page reload into the saved
  acknowledged Office report: gameplay HUD hidden; chat/menu/party/mod/
  fullscreen absent; marker surface modal; zero NPC markers, directional hints,
  or walk-to-talk prompt; and world UI non-renderable. Create restores chat and
  fullscreen, and returned Hub restores HUD/menu/markers/world UI. Desktop
  samples 517 Courtyard and 260 Office moving frames; touch samples 517 and 259,
  with no facing mismatch. Both retain one automatic Arch voice, advancing
  Academy playback, the green selector-0 Robe/Staff wizard, and zero orb.
- The touch journey proves the sole platform exception: movement joystick is
  hidden at both titles and during dialogue, visible in acknowledged and
  restored Office so the manual exit remains reachable, absent on Create, and
  restored with the normal returned-Hub HUD. Desktop shows no joystick. Page,
  console, and failed-response arrays are empty in both journeys. Stock and
  touch log SHA-256 values are
  `31c2b03e20472c055e9759875a4724cbadf615f04c8d8d7af8a93d8cab44ce2c`
  and `ffe2abaadd87cc1a8e114ef862095eb921393df7489b2e24a750ac2c4185a8b8`.
- Reviewed stock Title 7 / Title 9 / restored-Office / Create frame SHA-256
  values are
  `985026a2d288adc3209c943781bdbeda9e2b978d5f49fe326f76f8fa2d1cf5da`,
  `67fe0a6008cfc9fda87bc264ee3783ecfe8857e27091b34c69927b97ee3782df`,
  `477bd24ad2966bb6709b8ba0f859eb76c16af3bfe6432b4c91b004e74bc52181`,
  and `10242d4ffb2de1f2e262ae3ef1e4f3c2fdbfbdf42fcc0d44e39243bf43422c0a`.
  Touch equivalents are
  `1428346171d60dd31a582a6860303fdb3db31d6ca87b400465fade76f5d5bc45`,
  `dd74ce4c151c6c4806a54675f59f74c5b83bd74eaa549f824b52b8bd71caa203`,
  `385a40a88cbc2d203629b6e1dd33f2643db814807b0bf738441b8f884cafc728`,
  and `cdef59a03c09a8caae2401b7b4b5bfc560bfe29100a9c818af6bedca2b4f380e`.
  Evidence remains under Mac
  `/Users/jarrett/codex-acceptance/tutorial-hud-20260827-current-r3/website/evidence/`.
- No native unknown or additional platform block remains. Website and Mod
  Loader changes are locally committed, unpushed, undeployed, and not live.

## Publication rebase validation receipt

- Before the authorized push, Website `origin/main` advanced through the
  Tutorial movement/Staff/title closure to
  `5fa7a54f01e4f7bba1ea96d20c1f439c17f13f04`; Mod Loader advanced to its
  paired native report at `6ff32d0623c0fb5781be3ac90fdb16b9817ed9ba`.
  This HUD work was rebased over both. The exact pre-receipt candidates were
  Website `71d3822bd34bcff46cf54ab1436090ecac102990` (tree
  `776133863606782f51e8e88bccce2de3d2a08052`) and Mod Loader
  `5dee6814495c2363b6d63c91e4311b4906a76e06` (tree
  `fa22373c4928c1773c7d2cf8d7bcb3bb42ec3f11`). Their local/detached-Mac
  changed-file manifests matched at
  `2bb985b78197c77dc508e3ee264eefeafabd6b5ef0c461b1ecc6c980c7ce542e`
  and `dcb9bee6bdd862eacc7319cab455701ddd260edf9df0b485541af2dcc2e42ea5`.
- The fresh detached Mac Website tree passed the complete canonical gate,
  including all backend contracts, registered frontend/runtime/desktop suites,
  production frontend and game-host builds, budget, and media/CSP policy.
  `Game-wmc1Uq1S.js` is `252,409` raw / `76,680` gzip bytes under
  `524,288 / 134,144`; gate-log SHA-256 is
  `bcbb15818c64ec18754a723e1eb2596792655c2dab177e76a582e0b707861b76`.
  The paired Mod Loader tree passed the expanded registered static-RE suite
  `521/521`; log SHA-256 is
  `16965fd97860cd7b869623060a0452fedca7dfcd0d836d20c8de329dc664e0ce`.
- Mac Chrome `151.0.7922.174` passed the merged production-bundle stock
  `1600x900` and touch `896x414` journeys with `status: ok`. Both retained the
  newer idle/movement, moving-Staff, title timing, surface, scripted-facing,
  collision-exemption, and loadout-reset checks. Title 7, Title 9, automatic
  Arch dialogue, acknowledged Office, and a real page reload into acknowledged
  Office all reported hidden gameplay HUD; absent chat/menu/party/mod/
  fullscreen chrome; modal marker surface; zero NPC/help markers; and
  non-renderable world UI. Create restored its browser chrome, and the returned
  Courtyard restored HUD/menu/markers/world UI. The touch joystick alone was
  visible in acknowledged and restored Office, then normal touch UI returned
  with the Hub. Page, console, and failed-response arrays were empty.
- Both journeys crossed the deterministic player/Student blockers, completed
  Office/Create, saved schema 18 with `tutorialPending=false` and
  `collegeIntroPending=false` during the ordinary incoming transition, then
  restored normal collision from a 40-unit overlap to 50.1 units. Stock and
  touch log SHA-256 values are
  `d629f43c949a76433b4db2ed664396735e30d8690decc24bae3ee51e81db3dd0`
  and `6b5cf4c2c00a8b39e42faa75c667eac5596e74350566f05bc24136a616b0f934`.
- Reviewed stock Title 7 / Title 9 / restored-Office / Create frame SHA-256
  values are
  `43fbb15802bf21910f419a45a8fba37996de4c115a0b5b3c8c882bd776295e6b`,
  `1e75a79fea11cab51b70f8a162d107adf552355ba04398c5838fca35d1129042`,
  `8315633f4948f0dc4672d4d1d2d61e53527562ec8fd0ff9695cac15c50877f42`,
  and `e41f151ae92ff71083fb3586eaa79fa8c09f45ee3d999015612d550550b402aa`.
  Touch equivalents are
  `96a7f73ac9f642688eae26cd7885fa7d7dde92fd68bacb422ef398f5ab42cafe`,
  `222cdf0e77fd6be72640b8f347a4766f924db62f29bb57d8dacad28ef42e07cc`,
  `9c7f70d7121bfb2830541b3babca8571e739ba3ddb0091b656760d86c37b42b1`,
  and `2883cec475a67f6c576163468486fb7183edcc790bfa58f45a8a5434ec744850`.
  Evidence is retained outside the disposable validation worktree at
  `/Users/jarrett/codex-evidence/tutorial-hud-20260827-publish-r2/`.
- The earlier HUD candidate/base receipts remain historical evidence; this
  receipt supersedes them for publication. Deployment and production cutover
  remain outside the authorized push.
