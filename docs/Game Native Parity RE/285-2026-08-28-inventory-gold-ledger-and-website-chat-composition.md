# 2026-08-28 — Inventory gold-ledger and Website chat composition

## Reported smell and parity question

- Reported Website behavior: at some desktop resolutions the closed player-chat
  widget paints over the bottom-left gold icon while Inventory is open. The
  `1600x900` current-main frame reproduces the overlap over both the coin sprite
  and the `500` balance.
- Requested behavior: while Inventory is visible, move the small chat surface
  horizontally far enough to leave the gold ledger readable. Preserve the
  stock Inventory pixels, chat lifecycle, retained-modal input priority, and
  every non-Inventory chat placement.
- Retail has no player-authored chat surface. This reopens the 2026-08-27
  chat/modal coexistence entry only at its responsive Website-composition seam;
  it does not reopen the closed native player-chat census or authorize moving
  the native gold ledger.

## Evidence and causal trace

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail Inventory witness | unmodified retail Beta `0.72.5` `SolomonDark.exe`, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; Mod Loader `inventory-screen.png`, SHA-256 `0d99c6bb3f1815aa061fd4ee49e7bfccbd0ee058ea69b0e8936155c7e5156d8b` | Stock owns one bottom-left gold ledger on the fixed `1600x900` InventoryScreen. | high |
| Native asset and current renderer | `native-ui-assets.json#UI.21`; `hub-inventory-renderer.ts#addGold` | UI record 21 is `74x65`, centered at `(38,868)`, so its native x-domain is `1..75`; the body-font balance begins at x `48`, baseline y `870`. Standalone Inventory and every companion service renderer share this exact `addGold` call. | high |
| Current Website chat geometry | `game-chat.css`; `GameChat.tsx`; fixed-stage projection in `MainMenuScene.tsx` | Fine-pointer chat is screen-space at bottom `34`, left `clamp(14px,2.2vw,34px)`; its 32-pixel closed control occupies the same vertical band as the scaled native coin. Coarse-pointer chat is already top-left and cannot cover the bottom ledger. | high |
| Mac current-main reproduction | Website `6c8ac1940d6ff858b3183ec09073e7ed7c46eb72`; Mac Chrome `151.0.7922.174`; `/Users/jarrett/codex-acceptance/chat-inventory-gold-overlap-20260828-root/evidence/baseline-inventory.png`, SHA-256 `f1fa5f8425eec42cd7cdb1474b6aef07e22f5281cd27047e1188889289969cb5` | Real Hub Inventory at `1600x900` visibly places the closed Chat control over UI.21 and the balance. The complete retained-modal journey otherwise passes with empty page/console/failed-response arrays. | high |

No new retail address, authored table, asset record, or timing constant was
recovered. `native-hub-and-economy.md` and
`native-player-chat-boundary.md` already own the native ledger and negative
player-chat boundary, so no Mod Loader document changes in this pass.

## System boundary and complete membership

System: **fine-pointer Website chat composition over native gold-ledger
surfaces**, from fixed-stage projection through closed/open chat placement and
surface teardown.

| Member / branch | Owner/source | Disposition | Proof contract |
| --- | --- | --- | --- |
| standalone Hub Inventory | InventoryScreen plus Website `HubInventoryUi` | `exact-ported` requested Website composition | closed transcript/opener and open composer begin beyond the live scaled ledger right edge |
| standalone Boneyard Inventory | same renderer plus Inventory pause source | `exact-ported` through the shared rule | same clearance while authoritative Boneyard pause and item state remain unchanged |
| Fomentius Shop | companion Inventory plus Shop | `exact-ported` through the shared service selector | common gold ledger remains unobscured |
| Hagatha PerkShop | companion Inventory plus PerkShop | `exact-ported` through the shared service selector | common gold ledger remains unobscured |
| Luthacus InventoryShop | companion Inventory plus storage pane | `exact-ported` through the shared service selector | common gold ledger remains unobscured |
| Shlorio DowsingShop | companion Inventory plus Dowsing states | `exact-ported` through the shared service selector | pre-roll, result, and insufficient-funds siblings keep the same clearance |
| closed opener, unread badge, and non-faded transcript | session-scoped `GameChat` | `exact-ported` requested composition | the complete closed visual moves as one surface |
| open Global/Party/Boneyard/Whisper composer | same owner | `exact-ported` requested composition | the complete panel shares the clearance without routing/input changes |
| desktop viewport scale and horizontal letterbox | fixed native stage in `MainMenuScene` | `exact-ported` responsive projection | clearance follows native stage x and scale rather than a resolution-specific CSS nudge |
| coarse-pointer/touch layout | existing top-left chat sheet/opener | `verified-already-at-parity` | remains at the top and never consumes bottom-ledger space |
| trader dialogue, Skill Book/selectors, Skill Picker, Pause, loading, Settings, title, Tutorial, Game Over | surfaces with no shared bottom gold ledger | `out-of-system` | existing chat placement/admission remains byte-for-byte unchanged |

No member is `blocked-by-platform`. CSS relational selection and the existing
fixed-stage projection expose all state needed for exact collision avoidance.

## Recovered composition contract and implementation consequence

- The native ledger stays at its recovered renderer coordinates. The Website
  chat computes the visible ledger right edge from the exact UI.21 logical
  width plus the current locale-formatted balance measured by the same native
  body-font metrics; an eight-native-stage-pixel gap follows it.
- `MainMenuScene` supplies the current fixed native stage x/scale and local
  authoritative gold. `GameChat` publishes one computed screen-space clearance
  custom property. A fine-pointer CSS `:has()` rule consumes it only while an
  `inventory` or `service` native UI root exists.
- The new left edge is the maximum of normal chat inset and ledger clearance.
  Thus letterboxing cannot pull chat backward, gold-width changes cannot
  reintroduce overlap, and every surface without the shared renderer retains
  its current position.
- Chat open/close/fade/unread, channel routing, modal suspension, focus,
  pointer ownership, pause, Inventory state, renderer order, and native pixels
  do not change.

## Validation contract

- Focused contracts pin UI.21 `74x65`, native centers/baselines, formatted
  balance right-edge measurement, the `inventory` plus `service` selector,
  fine/coarse partition, and exact stage x/scale wiring.
- Mac Chrome at `1600x900` must prove the closed Chat bounds start at or after
  the computed clearance in Hub and Boneyard Inventory; a companion service
  must prove the same shared branch. Reviewed pixels must leave the coin and
  balance unobscured while page, console, request, and response errors remain
  empty.
- Run the exact candidate through `/opt/homebrew/bin/bash
  ./scripts/validate.sh` on the Mac mini.
