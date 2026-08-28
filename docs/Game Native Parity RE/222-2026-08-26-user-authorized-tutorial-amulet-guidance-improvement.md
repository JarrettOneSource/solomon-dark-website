# 2026-08-26 — User-authorized Tutorial amulet guidance improvement

## Reported smell and product question

- User direction: improve on retail stage 10 by pointing `Found items go in
  your backpack...` at the newly acquired Sorceror's Amulet and pointing the
  equipment lesson at the amulet slot on the wizard body.
- Stock baseline remains proven: retail reads InventoryGrid entry 0 and the
  STAFF/WAND sink. The two starter potions occupy projected indexes 0/1 and
  the authored amulet naturally occupies index 2. This change is an explicit
  user-authorized product divergence, not a revised claim about stock.
- Falsifiers: any name-only/recipe-only match that can select another amulet;
  a pointer that stays at index 2 after the amulet moves; a weapon-sink target;
  a backpack lesson that survives after the authored amulet leaves the
  backpack; or a mobile arrowhead that misses the live amulet action rectangle.

## System boundary and membership inventory

Native boundary remains the complete stage-10 callout/pointer family above.
This product extension is restricted to the authored Tutorial amulet identity
and the two teaching targets it changes.

| Member | Source / owner | Disposition | Proof |
| --- | --- | --- | --- |
| retail cell-0 backpack target | `0x005D16E1` | `out-of-system` for Website targeting after explicit user override; retained as native truth | native report and preceding ledger rows |
| retail STAFF/WAND equipment target | `0x005D1529` | `out-of-system` for Website targeting after explicit user override; retained as native truth | native report and preceding ledger rows |
| exact authored amulet identity | item 3010 / `NATIVE_TUTORIAL_AMULET_IDENTITY` | `verified-already-at-parity` | full identity predicate and near-miss rejection |
| live projected amulet cell | `projectInventoryItems` order plus `hubInventorySlotPosition(index)` | `out-of-system` (user-authorized web UX) | indexes 0, 2, 7, nested projection, move/removal tests |
| amulet body sink | `hubInventoryEquipmentSlotRects('amulet', false)[0]` | `out-of-system` (user-authorized web UX) | exact rect `[1300,169,46,46]`, centre `(1323,192)` |
| amulet absent/equipped | live backpack projection | `out-of-system` (user-authorized web UX) | backpack callout/pointer pair absent; equipment lesson remains on body sink |
| modal opening/settled and all viewport transforms | existing shared modal owner | `verified-already-at-parity` | stock/wide/tall/touch painted-target matrix |
| close/stage/world teardown | existing Tutorial/modal lifetime | `verified-already-at-parity` | no amulet guidance survives stage 10 or modal close |

## Ownership and behavioral contract

- `native-tutorial.ts` owns one exact reusable identity predicate for the
  authored amulet; ItemInfo and Tutorial guidance reuse it, while protocol
  decode retains its equivalent pre-construction structural checks.
- Stage 10 projects the current backpack on every render. The first row whose
  item matches that exact identity supplies `hubInventorySlotPosition(index)`;
  moving the item moves the callout/pointer on the next render. Absence removes
  only the backpack pair.
- The equipment pair always targets the amulet sink centre `(1323,192)` and
  keeps the recovered native relative callout/origin offsets: callout
  `(target.x-250,target.y+50)`, pointer origin
  `(target.x-60,target.y+40)` toward the target.
- Text, UI-28 painter/scale, draw order, blink, modal progress, input,
  inventory/equipment behavior, authority, replication, audio, and teardown
  remain unchanged.

## Implementation and validation contract

- Add the exact amulet identity predicate at the native Tutorial owner and
  reuse it in the existing ItemInfo path and stage-10 plan.
- Red tests must reject the old fixed cell-0 and weapon-sink coordinates, then
  prove natural index 2, another live index, absence, exact identity near
  misses, and amulet sink geometry.
- Mac Chrome must traverse the natural touch pickup/open flow and measure the
  painted backpack arrowhead against the actual Sorceror's Amulet action and
  the equipment arrow against the amulet body action. Repeat the complete
  four-viewport modal matrix, Website canonical gate, and exact-tree manifest
  proof before the already-authorized fast-forward publication.

## Implementation validation receipt

- Implementation: `nativeTutorialAmuletIdentityMatches` moved the existing
  exact ItemInfo classifier to the authored Tutorial owner and now rejects
  name, selector, icon-record, icon-tint-length, and effect near misses.
  `tutorial-modal-callouts.ts` projects the live backpack, finds that identity,
  and uses its current `hubInventorySlotPosition(index)`; absence removes only
  the backpack pair. The equipment pair now uses amulet rect
  `[1300,169,46,46]`, centre `(1323,192)`, with the recovered relative
  callout/pointer offsets. Tooltip behavior is unchanged because it consumes
  the same promoted predicate.
- Red/green: the tests-only Mac gate failed four Tutorial members: the missing
  predicate export, both old weapon-sink coordinate assertions, and the old
  any-item/cell-0 backpack gate. The amended canonical gate passes the complete
  Tutorial group `48/48`, including exact/near-miss identity, natural index 2,
  moved index 7, nested projected index 1, absence, and amulet sink geometry.
- Mac Website gate: `/opt/homebrew/bin/bash ./scripts/validate.sh` exits zero;
  backend/frontend/desktop/build/media contracts pass; production game entry
  is `474603` raw / `133075` gzip against `524288` / `133120`. Logs:
  `evidence/red-amulet-guidance-website-validate.log` and
  `evidence/amulet-guidance-website-validate.log`.
- Four-viewport modal browser matrix passes stock `1600x900`, wide
  `2560x1080`, tall `1200x1000`, and touch `896x414` with empty page, console,
  failed-response, and host-error arrays. Every plan targets backpack direction
  `(24,646)` for the natural two-potion/index-2 fixture and equipment direction
  `(1323,192)`. Touch painted amulet-cell head
  `(105.7853889465332,295.70042419433594)` is horizontally inside the actual
  Amulet action `[91.04000091552734,124.16000366210938]` and 1.46 CSS px above
  its `297.1600036621094` top edge. The painted equipment head is 6.24 CSS px
  from the live amulet sink action `[678,77.73999786376953,21.1600341796875,
  21.160003662109375]`. Log: `evidence/amulet-guidance-modal.log`.
- Natural touch journey at `896x414` passes the authored stage 8 pickup, stage
  9 prompt, stage 10 Amulet-cell/body-sink guidance, ItemInfo, double-click
  equip, save checkpoint, and close edge with empty page/console/response/wire
  arrays. Visually inspected screenshot:
  `evidence/amulet-guidance-natural-stage-10-amulet-guidance.png`; log:
  `evidence/amulet-guidance-natural.log`.
- Unknowns / platform differences: none. This is a deliberate user-authorized
  improvement over the documented retail cell-0/STAFF-WAND targets. Publication
  to both `main` branches remains authorized and pending final exact-tree
  revalidation/fetch; deployment remains separate.
