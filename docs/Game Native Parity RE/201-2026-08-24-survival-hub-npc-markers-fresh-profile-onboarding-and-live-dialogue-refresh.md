# 2026-08-24 — Survival-Hub NPC markers, fresh-profile onboarding, and live dialogue refresh

## Reported smell and parity question

- Reported question: verify that NPC interaction bubbles and dialogue match
  stock on a genuinely new save and continue to update after conversation,
  progression mutations, room reconstruction, save, and resume.
- Current web behavior: the complete survival dialogue catalog and selector
  mutations exist, but the world presentation hardcodes only six marker
  sprites, uses one synchronized phase, omits four named actors, assigns wrong
  styles/sides to Luthacus and Shlorio, and never persists or clears stock's
  first-profile guidance. A generic bottom-centre `E / INTERACT` product
  extension remains the explicit browser admission control.
- Stock behavior to recover: the common actor marker owner and all five Region
  banks; every survival actor's style, side, phase owner, and visibility; the
  ten-row durable help table; the three NPC-owned rows and reconstruction
  boundary; the pristine Provokatus walk-to-talk callout; the Fomentius and
  Luthacus follow-up directional hints; Chat/modal ordering; and the already
  recovered complete dialogue graph and live selector mutations.
- Reproduction membership: a brand-new profile, first Provokatus/Fomentius/
  Luthacus interactions, same-Courtyard post-action state, leave/re-enter,
  save/resume, all ten named actors, all ten Paintings, all questions and
  dismissals, all three selectors, Lace removal, Teacher purchase omission,
  Boast mutation, and optional Skorcha absent/present/variant branches.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail image | Beta 0.72.5 `SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, base `0x00400000` | Canonical analyzed executable for every address below. | high |
| Fresh canonical instructions | `NPC` ctor `0x005016E0`, marker render `0x00518280`, Courtyard render `0x0051EB60`, clamp/arrow helper `0x00518410`, builders `0x0050B720/0x00513BE0`, actions `0x00501800/A0/B0/C0`, Chat ctor/dtor `0x004F5D90/0x004FCB40` | Exact marker fields, record selection, alpha, profile gates/clearers, modal ordering, and reconstruction behavior. | high |
| Complete authored banks | College `59..62`; Memoratorium `24..27`; Library `17..20`; Storage `7..10`; Office `13..16`; UI `28,88,89`; Fonts group 1 `93..184` | Drains every four-row Region marker table plus every onboarding art/text consumer. | high |
| Durable profile capture | Loader `tests/fixtures/webgame/save-format-goldens.json#fresh_profile`; native initializer `0x005A8390`, serializer `0x005BC1B0` | Profile `+0x9A..+0xA3` is ten one bytes on a fresh profile. Earlier `class-selection enabled` labeling was false. | high |
| Clean-stock retained captures | `hub_new_game.png`, `hub_pristine_second_new_game.png`, `hub_resumed.png`, and trader Chat captures under the retained Windows native-menu corpus; principal SHA-256 values `195efb3feb63b9d4ac672c7b44e9d7c8cc303ca816ee9622605012dd17f469e0` and `e8cc312c275c95d006bfa7936419a938f3b3a38c462835a7afb224eb8c5ee8b0` | Pristine profile paints the exact walk-to-talk callout over Provokatus. Ordinary `!`/`?` bubbles remain visible behind Chat, including on the engaged actor. | high |
| Native durable report/catalog | Mod Loader `native-hub-npc-interactions.md`, `native-hub-npc-marker-catalog.json`, corrected `native-hub-and-economy.md`, and corrected `native-save-format.md` | Full ownership, membership, tables, lifecycle, and the corrected Fomentius row-1 attribution. | high |
| Current Website trace | base `69c577db`; `HubWorldScene`, `HubPrivateRoomScene`, `HubInventoryUi`, `native-hub-npc.ts`, protocol/save modules, `smoke-hub-npcs.mjs` | Dialogue content tests and action-driven rows refresh, but marker presentation has no authoritative profile state and only a partial hardcoded census. | high |

## System boundary and membership inventory

Native system: the participant-private survival-Hub interaction presentation,
from durable profile guidance and Region actor construction through the common
marker renderer, world interaction, Chat/selectors, state mutation, Region
reconstruction, save/resume, and teardown. Rows marked `exact-ported` are the
closing implementation contract; final evidence is recorded in the receipt.

| Member | Native source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Hagatha help-right marker | type 5001; College 61 | exact-ported | exact plan and browser census |
| Provokatus talk-right marker plus pristine callout | type 5003; College 59; profile row 0; UI 28; Fonts group 1 | exact-ported | new-profile, clear, reconstruct, save/resume |
| Fomentius help-right marker plus follow-up hint | type 5004; College 61; profile row 1; UI 88 | exact-ported | corrected ownership and transition journey |
| Luthacus talk-left marker plus follow-up hint | type 5005; College 60; profile row 2; UI 88 | exact-ported | exact side and transition journey |
| Skorcha variant-facing marker | type 5007; College 59/60 | exact-ported | absent plus variants 0/1/2 |
| Machinimbus help-left marker | type 5008; College 62 | exact-ported | exact static-phase plan and browser |
| Declarius help-left marker | type 5017; Memoratorium 27 | exact-ported | private-room plan and browser |
| Semicus help-right marker | type 5013; Library 19 | exact-ported | formerly missing member |
| Shlorio help-left marker | type 5016; Library 20 | exact-ported | replaces wrong College help-right row |
| Archchancellor help-right marker | type 5012; Office 15 | exact-ported | formerly missing member |
| Paintings `0,1,100,3..9` | direct Memorator speech callback `0x00506190 -> 0x00506100`; no common dialogue root | verified-already-at-parity; no marker by native design | ten-target dialogue census |
| all ten actor/Painting Chat graphs | `survival.txt`; common Chat and Painting callback | verified-already-at-parity | complete graph tests and continuous browser census |
| Boast, BookReview/Lace, SellSpell/unlocks | native selector functions and downstream state writers | verified-already-at-parity; refresh regression retained | mutation, omission, save/resume |
| profile rows 3..5 | `0x0081A3CD..CF`; Courtyard navigation volumes | out-of-system (non-NPC navigation guidance) | full xref disposition in marker catalog |
| profile rows 6..7 | `0x0081A3D0..D1`; InventoryScreen | out-of-system (separate inventory UI) | full xref disposition in marker catalog |
| profile rows 8..9 | `0x0081A3D2..D3` | out-of-system (no compiled producer or consumer) | exhaustive direct-address sweep |
| StoreRoom marker bank | Storage `7..10` | out-of-system (loaded bank, no normal-survival named actor) | builder/actor census |
| Students | type 5002, null dialogue root/no-op action | out-of-system (native noninteractive) | constructor/vtable census |
| story Polisher/Annalist2/Arch variants | alternate builder `0x00513BE0` | out-of-system (Website survival mode) | static membership retained in native catalog |
| recipe `GameNPC` | type 5015, Boneyard scripting | out-of-system (separate authored Boneyard system) | native Region report |

No member is blocked by the browser platform.

## Native ownership thread and recovered contract

- Common constructor `0x005016E0` initializes marker phase `+0x160` from
  `Integer(5000)`, style `+0x164 = 0`, offsets `+0x168/+0x16C = 30/60`, and
  facing scale `+0x15C = -1`. Subclasses select help style or right-facing
  scale. `0x00518280` chooses `style*2 + (scale<0)`, roots the bubble at
  `(actor.x + sign(scale)*30, actor.y-60)`, and applies
  `sin(phase*pi/180)*0.25+0.75` alpha.
- Provokatus, Fomentius, Luthacus, Skorcha, Shlorio, Semicus, Declarius, and
  the Archchancellor advance phase one degree per 100-Hz tick. Hagatha and
  Machinimbus retain their randomized construction phase.
- Marker paint requires a dialogue root, root byte `+0x04 != 0`, and no
  general modal. Chat sets `DAT_008199F0`, not the general-modal byte, so
  ordinary markers remain painted behind Chat. Inventory/services hide them.
- Fresh profile rows 0..2 suppress the ordinary marker in that constructed
  Courtyard. The matching actor wrapper clears its durable row before Chat but
  does not restore actor `dialogue+0x04`; therefore the onboarding overlay
  disappears immediately and the ordinary marker returns only after Region
  reconstruction. The row persists on the next profile checkpoint.
- While row 0 is live and no Chat/general modal is active, the Courtyard paints
  UI 28 at Provokatus `(15,-65)`, rotated 200 degrees, plus exact text
  `WALK INTO WIZARDS\nTO TALK TO THEM` at `(15,-115)`, Fonts group 1, black
  outline radii 1/3 at 20-degree steps, foreground RGBA
  `(0.85,0.73,0.44,1)`.
- After row 0 clears, live rows 1/2 blink when `tick%80>40`, use UI 88, and
  point/clamp from `(Fomentius +32,-62)` or `(Luthacus -32,-62)` to the current
  viewport.
- Dialogue graph/content, scroll/accelerate/choice/dismissal/service
  replacement, distance/Region close, Lace one-shot, Teacher omission, Boast
  failures/success, and Skorcha Courtyard lifetime remain owned by the complete
  2026-08-24 interaction entry immediately above.

## Web implementation consequence

- Extend participant-private native NPC profile state with the complete
  ten-row help table. Fresh construction uses ten `true` rows; pre-v11 browser
  saves without the field migrate to acknowledged rows so an established web
  profile is not falsely treated as a pristine native profile.
- Add one host-authoritative, idempotent world-NPC acknowledgement action for
  Provokatus/Fomentius/Luthacus. It clears only the native row, increments the
  economy revision, replicates immediately, and uses the normal progress-save
  checkpoint. Hub rail shortcuts do not impersonate actor collision.
- Replace partial per-class marker sprites with a complete data-driven marker
  presenter using exact Region assets, actor styles/sides, independent phases,
  Skorcha facing, modal ordering, and Courtyard-entry suppression latches.
- Add the pristine callout and the two directional hints to the same owner.
  Retain the user-confirmed visible `E / INTERACT` plaque as a named browser
  product extension; it continues to use exact native geometry/authority and
  is not substituted for the native bubbles.
- Keep selector rows derived on every replicated economy/progression update;
  add save/resume regression coverage rather than caching a dialogue-open
  snapshot.

## Validation contract

- Focused contracts: all ten durable rows/default/migration; three exact
  acknowledgement mappings and idempotence; protocol rejection of other IDs;
  checkpoint persistence; all ten named marker plans, five Region banks,
  styles/sides/phases/alpha; Chat versus service visibility; new-profile
  callout; same-Courtyard suppression; reconstruction; two blink/clamp hints;
  Skorcha absent/variants 0/1/2.
- Dialogue regressions: all actor/Painting graphs, questions/dismissals,
  selector live refresh, Lace 26->25, Teacher purchase omission, Boast
  selection/failure/success, and save/resume state.
- Mac Chrome journey from an empty browser profile: prove the pristine
  callout, open Provokatus and observe immediate clear, reconstruct Courtyard
  and observe the ordinary bubble, exercise Fomentius/Luthacus rows, persist
  and resume, then traverse all named actors/Paintings and mutation families.
- Matching `1600x900` stock/web frames must retain marker art/root/side and the
  callout composition. Page-error, console-error, failed-response, and runtime
  error arrays must remain empty. The Website's complete
  `/opt/homebrew/bin/bash ./scripts/validate.sh` and Loader static-RE suite are
  required on manifest-identical Mac candidates.

## Implementation validation receipt

- Authority and persistence: participant economy now owns all ten native help
  rows. Fresh profiles initialize ten `true` values; only world interactions
  with Provokatus, Fomentius, and Luthacus issue the bounded idempotent host
  acknowledgement. Protocol 75 replicates the table/action, and save schema 11
  persists it. Schema 10 retains its active-party rejoin capability while
  migrating an absent help table as already acknowledged; schemas 1..9 retain
  both prior migration rules.
- Presentation: the generated catalog and extracted Region/UI/font assets drive
  all ten named actor markers, exact style/side/root/alpha, independent static
  versus advancing phases, Skorcha mirroring, Chat-versus-modal ordering, the
  pristine walk-to-talk callout, both clamped directional hints, and the
  current-Courtyard suppression latch. Region reconstruction captures the live
  durable rows and restores the ordinary marker. Painting dialogue now reads
  the shared memorial's live physical-slot portrait id rather than the obsolete
  `painting-100` test label.
- Exact-tree Mac automation: Website candidate
  `418690ad1235a8dbf43a4d334f5799e661486558` in
  `/Users/jarrett/codex-acceptance/npc-dialog-refresh-20260824/Website` passed
  `/opt/homebrew/bin/bash ./scripts/validate.sh`: backend/contracts `22/22`,
  save/prerequisite `274/274`, Boneyard/game `1523/1523`, ML bot `77/77`,
  parties `65/65`, Hub UI `75/75`, desktop `5/5`, lint, type checks,
  production build, media policy, and the game bundle budget at
  `130499 / 131072` gzip bytes. Log SHA-256 is
  `78a25416b4fdc92844efe542f229a64b0bb227216715efb952f78e71d276a249`.
  The manifest-identical Mod Loader candidate passed its registered static-RE
  suite `501/501`.
- Fresh-profile production-browser proof: the same built revision in Mac Chrome
  151 on `ANGLE Metal Renderer: Apple M2` began at `1111111111`, painted the
  exact retained-stock callout with only Hagatha/Machinimbus ordinary markers,
  cleared row 0 on Provokatus, exposed the two follow-up hints, checkpointed
  schema 11, kept Provokatus absent in that Courtyard, restored his talk-right
  marker after Library reconstruction, and resumed Last Game at `0111111111`.
  Page-error, console-error, and failed-response arrays were empty. Browser-log
  SHA-256 is `705ad953e098d57a44e710c6c8848c7f45603ed917efa110570a6c221b15c3e8`.
- Complete production-browser proof: one continuous journey opened all 20
  named actor/Painting targets, every compiled question/dismissal and all three
  service selectors; exercised the five-row Boast selector, Lace removal,
  Teacher skill-72 purchase/omission, and Skorcha variant 2; and resolved the
  ten physical Painting slots through live portrait ids `0..9`. Page-error,
  console-error, and failed-response arrays were empty. Browser-log SHA-256 is
  `a4c50378898395b99de354cca5be4f938ac9b39a6c23713f8baf99522b7f7fca`.
  Separate seeded Chrome journeys also passed Skorcha variants 0 and 1; their
  screenshot SHA-256 values are
  `5fb02e4bc5cf3fefe12157108e087e9070481b37493aff136909d22cc34539a7`
  and `e3e128d6d1bbe274f863ba72392c6fddedaacec9a10b1f9e64ffd6610eba6359`.
- Visually inspected `1600x900` receipts are retained under
  `/Users/jarrett/codex-acceptance/npc-dialog-refresh-20260824/browser`.
  The pristine callout, reconstructed marker, resumed marker state, live
  Painting, and Archchancellor frame SHA-256 values are respectively
  `240734414bd5e09a7598eb111809e350f6d7860cd78f6740bdb7f0bb7870727f`,
  `c653d7a2f0bb525e78f96af86cf1e0b541d95ffe56f04c9346424603a43b687e`,
  `4684a55dff5256b7daf38e2304c21676f6122812f15c0415195e099446216c3c`,
  `3c7d6c34a7b588909865a765c33633bd0a0a761748dcb5615de7823d5530201e`,
  and `5c98dcec755da7fa47a14064d91e8ee8374979c13c1d2fd2ec1a18236959c834`.
  No browser-platform block or material unknown remains.
