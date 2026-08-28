# 2026-08-25 — Tutorial stage-8 pickup and HUD-unlock secondary-report audit

## Reopen statement

The Tutorial rows were reopened after a new production report that the
"grab this item" step had lost its arrow/text and that Inventory/Skills stayed
hidden after pickup. The earlier closure proved the controller and individual
presentation members, but its natural stage-8 browser journey was coupled to
CSS class names removed by the later modal-callout cutover and did not record
the stage-8/9 HUD-access attributes beside the authoritative pickup edge. That
left the exact reported sequence without a durable current-production signal.
This audit reopens stages 7 through 13 as one system and distinguishes stock
membership from web visibility: stage 8 owns a blinking world-Sack pointer and
no instruction string; stage 9 owns `ACCESS YOUR INVENTORY`, the backpack
control, and its pointer; Skills remains intentionally hidden until stage 12.

## Reported smell and parity question

- Reported web behavior: the first Tutorial equipment Sack allegedly has no
  teaching arrow/text; after pickup the bottom Inventory/Skills controls remain
  absent, leaving no visible route forward.
- Stock behavior to recover: stage 7 enables the inventory gate and chooses
  stage 8 only while no top-level non-potion item exists; stage 8 points at the
  first registered ground Sack and advances on pickup; stage 9 renders the
  Inventory instruction/pointer and admits Inventory; stage 10 teaches the
  open modal; stage 11 retains Inventory but withholds Skills until stage 12;
  stages 12/13 own the SkillScreen instruction and modal teaching overlay.
- Reproduction: schema-13 stage-8 continuation with the exact authored
  Sorceror's Amulet in a live Sack, fresh private production session, Windows
  Chrome/WebGL at 1600 by 900, followed by responsive and resume variants.
- Falsifiers: a server stage that remains 8 after the backpack receives the
  item; a stage-9 DOM with `data-tutorial-inventory=false`; a visible Skills
  control before stage 12; or any stock stage-8 call to the text/callout
  primitive `0x005C9C70`.

## Evidence and provenance

| Evidence | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Static instructions | retail 0.72.5 SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; canonical read-only Ghidra replica slot 01; `Tutorial::Render` `0x005D08C0`, window `0x005D0F04..0x005D10BB` | stage 8 looks up registered type `0x7DD`, projects it, pushes blink `1`, and calls only pointer primitive `0x005C9BB0`; the branch exits immediately. It contains no `0x005C9C70` text/callout call. Stage 9 begins at `0x005D10C0`. | high |
| Durable native report | Mod Loader `docs/reverse-engineering/native-hud.md`, Tutorial teaching-overlay table | all stage-8 through stage-13 pointer/callout members, gates, anchors, blink flags, and modal slide ownership were already extracted; the new instruction dump agrees. | high |
| Web causal trace | `native-tutorial.ts`, `BoneyardScene.tsx`, `GameHud.tsx`, `hub.css`, `TutorialOverlay.tsx` at `4a6c25f3` | the host advances 8 to 9 on `hasTopLevelNonPotionItem`; the live snapshot updates Boneyard-local Tutorial state; `nativeTutorialHudAccess` changes Inventory at stage 9 and Skills at stage 12; CSS hides only the still-locked controls. | high |
| Current production browser | deployed `4a6c25f3`; fresh production private session; Windows Chrome; stage-8 fixture and real movement/pickup | stage 8 painted the blinking Sack arrow; pickup advanced to stage 9; `ACCESS YOUR INVENTORY` and its pointer/backpack control painted; Inventory opened, the authored amulet equipped and checkpointed, and closing reached stage 11. The only terminal failure was the old smoke's stale callout CSS selector, then an unhandled favicon 404 after that selector was corrected. | high |

## System boundary and membership inventory

Native system: Tutorial stages 7..13 from the first authored equipment drop
through Inventory teaching, forced level-up completion, and SkillScreen
teaching, including HUD gates, all pointers/callouts, authoritative pickup and
surface actions, save/resume, and teardown.

| Member | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| stage 7 item scan and Inventory enable | `Tutorial::Tick 0x005D6330`, stage byte `+0x7C` | `verified-already-at-parity` | controller branch/unit matrix |
| stage-8 first-Sack pointer | `0x005D0F04..0x005D10B6`, UI 28, blink 1 | `verified-already-at-parity` | current production screenshot and instruction dump |
| alleged stage-8 "GRAB THIS ITEM" text | no stage-8 `0x005C9C70` call | `out-of-system` (retail emits no such text) | complete case-8 instruction window |
| authored amulet pickup and top-level inventory predicate | script 10050/item 3010; insertion `0x0055FF20`; stage-8 tick | `verified-already-at-parity` | current production pickup/equip/save journey |
| stage-9 instruction, backpack gate and pointer | `0x005D10C0..0x005D11F8`; gameplay inventory-enable byte | `verified-already-at-parity` | exact copy, HUD attributes and production frame |
| stage-10 Inventory modal members and close edge | `0x005D1202..0x005D16FF`; InventoryScreen pointer/close byte | `verified-already-at-parity` after `4a6c25f3`; smoke hook stale | semantic callout attributes and modal geometry suite |
| stage-11 Inventory retained / Skills withheld | controller stage 11 and HUD access bytes | `verified-already-at-parity` | access projection tests; current journey reaches 11 |
| stage-12 Skills instruction/control/pointer | `0x005D179D..0x005D18C5`; SkillScreen enable byte | `verified-already-at-parity` | exact copy, pointer/access unit tests and touch button-open receipt |
| stage-13 SkillScreen modal members and close edge | `0x005D18C5..0x005D1D29` | `verified-already-at-parity` after `4a6c25f3` | complete stock/wide/tall/touch modal geometry suite |
| desktop/wide/tall/touch viewport projection | fixed stage plus live world/HUD anchors | `verified-already-at-parity` | natural desktop/touch pickup plus four-viewport modal matrix |
| stage-8/9 save, reconnect and delta/keyframe | save schema 14 / protocol 79 | `verified-already-at-parity` | stage-9 pickup checkpoint revision 4 plus retained protocol/save round trips |
| last-player disconnect and Tutorial retirement | web-only private-session/rejoin lifecycle around the stock singleton Tutorial | `exact-ported` by the empty-run retirement entry | production teardown exception plus private/shared red-green lifecycle matrix |
| later death, run replacement and Tutorial teardown | existing run/save owners | `verified-already-at-parity` | no Tutorial overlay survives world retirement |

## Native ownership and recovered contract

- `Tutorial::Tick` owns stage transitions; pickup/economy owns item insertion;
  `Tutorial::Render` owns teaching copy/pointers; gameplay owns the Inventory
  and SkillScreen enable gates. No client-local pickup or stage advancement is
  permitted.
- Stage 8 deliberately has no heading/subheading. Adding reassuring or guessed
  "GRAB THIS ITEM" copy would diverge from stock rather than fix the report.
- Inventory unlocks on entry to stage 9. Skills is not a sibling unlock at that
  edge: it becomes visible only at stage 12 after Inventory teaching, wave 3,
  and the forced level-up barrier.
- Pointer blink uses the free-running application clock and may be hidden for
  200 ms of each 500-ms cycle; acceptance must sample both phases rather than a
  single screenshot.

## Web implementation consequence and validation contract

- Keep product controller, copy and HUD gates unchanged unless a responsive or
  reconnect reproduction falsifies the current production receipt.
- Repair the natural amulet smoke to use semantic `data-tutorial-callout`
  hooks, suppress its unrelated favicon request, and assert stage-8/9/11 HUD
  access explicitly. Do not add compatibility CSS classes or non-stock copy.
- Re-run the natural pickup/equip/close journey on desktop and touch viewports;
  run the stage-9/10 and stage-12/13 modal matrix; then run the canonical
  Windows gates and a no-cache production journey. Record remaining receipts
  below before publication.

## Implementation validation receipt

- No product controller, copy, HUD-access, protocol, or renderer change was
  required on current main. `4a6c25f3` reached production while this diagnosis
  was starting and the reported boundary then passed. The focused change
  repairs the stale natural amulet smoke: semantic callout hooks replace removed
  CSS classes; favicon noise is owned; remote production endpoints and explicit
  viewports are supported; stage-8 no-copy plus hidden/visible blink, stage-9
  Inventory enable/Skills hold, touch backpack activation, stage-11 retained
  gates, and the stage-9 saved checkpoint are asserted. The modal journey adds
  a real touch scenario and explicit Windows sparse-presentation controls while
  leaving its default strict opening/blink proof intact.
- Windows production Chrome `150.0.7871.124` against deployed `4a6c25f3`
  passed the natural stage-8 -> 9 -> 10 -> 11 journey at `1600x900` and touch
  `896x414`: the Sack pointer occupied the transformed visible bounds, sampled
  both blink phases in the touch receipt, pickup exposed and enabled the
  backpack while Skills remained hidden, clicking the touch backpack opened
  Inventory, both exact stage-10 callout families rendered, the Sorceror's
  Amulet equipped with Ether multiplier `1.100000023841858`, pickup persisted at
  save revision 4, equip at revision 7, and page/console/failed-response/wire
  arrays were empty.
- Built-candidate Windows Chrome completed the Inventory and SkillScreen modal
  matrix at stock `1600x900`, wide `2560x1080`, tall `1200x1000`, and touch
  `896x414`. Touch used the on-screen backpack and tome controls. Stage 10 had
  all eight populated-backpack members and six empty-backpack members; stage 13
  had six two-page members and nine three-page members. Transformed geometry
  error stayed below `0.0001px`, all steady pointers remained visible, and all
  page/console/failed-response arrays were empty. The explicit Windows sparse
  mode permits a settled-first modal/pointer screenshot when SwiftShader skips
  intermediate presentation samples; pure tests continue to pin the exact
  opening recurrence and 20/30 blink duty, and the default browser mode remains
  strict.
- After rebasing over Website `14282691` (Web Lua wearable inventory changes),
  the natural pickup smoke ran self-hosted against the exact rebuilt candidate
  and again reached stage 11 with the visible stage-8 pointer bounds, stage-9
  checkpoint revision 4, equipped checkpoint revision 7, both callout families,
  and empty page/console/failed-response/wire arrays. External production
  endpoint injection remains available for the post-deployment run.
- `./scripts/validate.sh` passed on Windows/WSL: 23 Python contracts, all
  frontend/desktop suites, production builds, media policy, and game entry
  remained under the `524288` raw / `133120` gzip limits. Mod Loader
  `python3 tests/re/run_static_re_tests.py --ci` passed `502/502` after the
  native audit note.
- Stock-versus-web conclusion: stage 8 intentionally has the arrow only. The
  requested text belongs to stage 9 (`ACCESS YOUR INVENTORY`), and Skills is
  intentionally unavailable until stage 12. No guessed `GRAB THIS ITEM` copy or
  premature Skills unlock was added.
- Post-deployment acceptance against Website `840692ec` passed the exact touch
  pickup/equip journey, but its ordinary browser `1001` close exposed a separate
  lifecycle failure: after detaching the only Tutorial player for recovery, the
  private host took one more tick with zero authoritative players. The stock
  singleton invariant threw `the stock Tutorial requires exactly one
  authoritative player`, and the uncaught tick failure restarted the production
  game supervisor. This falsified the earlier teardown disposition above.
- Holding the playerless Tutorial was rejected after the whole-system lifecycle
  sweep: it hid the exception while preserving the same invalid empty run for
  ordinary Boneyards and the shared Hub. Tutorial never arms the live-party
  rejoin slot; its owner checkpoint remains the resume path. The final
  implementation retires a provisioned/shared run when its last materialized
  actor leaves, invalidates its complete recovery lineage, and leaves standalone
  persistent development-host behavior unchanged. The preceding empty-run
  retirement entry owns the complete red/green matrix and Mac browser receipt.
