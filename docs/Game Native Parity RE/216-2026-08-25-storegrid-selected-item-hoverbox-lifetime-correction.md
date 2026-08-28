# 2026-08-25 — StoreGrid selected-item HoverBox lifetime correction

## Reported smell and parity question

- Reported web behavior: hovering a merchant item opens its tooltip, but the
  first click immediately closes it when the cell changes to UI 84
  `BUY CLICK AGAIN`.
- Stock behavior to recover: whether the first StoreGrid selection owns a
  tooltip teardown, or whether selected art and the already-open contextual
  HoverBox remain independent until the current cell changes.
- Reproduction inputs/scenes: first-click an ordinary offer under Fomentius,
  Hagatha, Luthacus, or Shlorio while its immediate tooltip is visible; retain
  the pointer over the same fixed-stage cell, then leave/re-enter, purchase,
  select an empty cell, and close the service.
- Falsifiers: pointer press calling the StoreGrid hover vslot; selected art
  requiring kind one; any Shop sibling replacing the shared current/selection
  fields; or a native selection-owned timer/tooltip clone.

This is a secondary report in the contextual-inspection system closed on
2026-08-22. That pass proved the kind-one branch of `0x0055E2C0` but did not
trace the independent current and selection writers. It then mislabeled kind
one as selected state, and the Website encoded that unproved relationship as
two explicit selected-item suppression checks. The skipped rule was complete
state-writer and transition ownership; this section reopens the whole shared
StoreGrid family rather than patching Fomentius alone.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Retail identity | `SolomonDark.exe` 0.72.5, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`, preferred base `0x00400000` | exact executable matches the canonical analyzed program | high |
| Instructions | canonical Windows project `SolomonDark/SolomonDark.exe` through read-only replica wrapper; `decompile_targets.py`, vtable/allocator sweeps; `0x0055C740`, `0x0055CEE0`, `0x00565D40`, `0x0055D680`, `0x00565B40`, `0x0055E2C0`, `0x0055ACB0` | current `+0xF8`, selection `+0xFC`, previous selection `+0x100`, and HoverBox `+0x110` are independent; pointer press changes selection without invoking hover; selected art requires ordinary kind zero | high |
| Existing stock frames | debugger-staged retail `trader-*-selected.png` fixtures and their disclosed capture catalog | exact UI 84/111 art and geometry, but excluded from event-lifetime proof because the helper staged selection instead of performing the pointer sequence | high for pixels; none for lifecycle |
| Current web | `HubInventoryUi.tsx` and `hub-inventory-renderer.ts` at Website `69397270` | both semantic and WebGL paths return early when inspection identity equals selection identity, so React selection state destroys visibility even though the inspection owner remains current | high |

## System boundary and membership inventory

Native system: StoreGrid current-cell inspection, first-click selection,
selected-art rendering, and contextual HoverBox lifetime from service entry
through pointer/focus change, purchase/rebuild, and teardown.

| Member (class/variant/scene/branch) | Native source | Disposition | Proof |
| --- | --- | --- | --- |
| Fomentius ordinary StoreGrid offers, including affordable and UI 46 rejection art | shared functions above; all nine existing web stock definitions | exact-ported | per-service contract and selected-tooltip browser assertion |
| Hagatha reachable PerkShop selectors and bundle | shared StoreGrid; `0x00554690` suffix builder; existing complete selector catalog | exact-ported | selected first-mix offer retains full copy; purchase removes stale copy |
| Luthacus arbitrary InventoryShop storage rows | shared StoreGrid; constructor clears `Shop+0x289`; UI 111 | exact-ported | selected storage retains no-price tooltip and TAKE art |
| Shlorio all 47 Dowsing result rows | Dowsing StoreGrid plus complete recipe catalog; UI 84 | exact-ported | selected result retains recipe/effect/price content and clears on purchase |
| ordinary kind-zero current row while unselected or selected | `0x0055ACB0`, `0x0055CEE0`, `0x0055D680`, `0x00565B40`, `0x0055E2C0` | exact-ported | one shared lifetime rule, WebGL and semantic owners |
| pointer leave/re-entry, current-cell move, empty cell, purchase/rebuild, service close/range/scene exit | `+0xF8` change, `0x0055E2C0`, Shop rebuild/destructors | exact-ported | teardown and no-stale-tooltip contracts |
| keyboard focus and touch focus/select | browser adapters over the same fixed-stage StoreGrid current/selection model | exact-ported | focus selection retains content; blur/re-entry follows shared current ownership |
| dormant UI 85/112 touch-art records | `0x00461F60` returns zero in retail Windows | verified-already-at-parity | records remain cataloged but unselected |
| standalone InventoryScreen ItemInfo and Hagatha owned-perk HoverBox | separate delayed selection and occupied-perk owners | out-of-system (not StoreGrid selection lifetime) | existing focused coverage retained |
| StoreItem kind-one diagnostic branch | `0x0055E2C0`; complete Shop-side 0x14-byte allocation/producer sweep | out-of-system (dormant special-row variant with no retail Shop producer; never selected ordinary state) | Mod Loader report/catalog correction |

There are no `blocked-by-platform` members and no authored content table to
approximate: the already-drained item, perk, recipe, set, and FX catalogs remain
the shared content source.

## Native ownership thread and recovered behavioral contract

- StoreGrid constructor `0x0055C740` owns current smart pointer `+0xF8`,
  selection `+0xFC`, prior selection `+0x100`, and HoverBox `+0x110`.
- Current-cell handler `0x0055CEE0` hit-tests into `+0xF8`, compares it with
  the prior current pointer, and invokes vtable slot `+0xCC` only on change.
  StoreGrid resolves that slot to `0x0055E2C0`, which first destroys the prior
  HoverBox and then builds ordinary kind-zero content immediately and silently.
- StoreGrid pointer press `0x00565D40` delegates selection to `0x0055D680`.
  That function copies `+0xFC` to `+0x100`, clears `+0xFC`, and writes the
  pressed hit back to `+0xFC`; it neither changes `+0xF8` nor calls `+0xCC`.
  The HoverBox already built for the current cell therefore remains alive.
- Selected painter `0x00565B40` reads `+0xFC` and only draws UI 84/111 when
  the selected StoreItem is still kind zero with a live item. The prior claim
  that selection changes the row to kind one is instruction-falsified.
- Ordinary builder `0x0055ACB0` writes kind zero, the live item pointer, and
  price/identity for every Shop/Dowsing offer. The separate kind-one diagnostic
  branch has no retail Shop producer and is not a selected-state representation.
- Observable contract: hover/focus shows the ordinary tooltip; first click
  paints BUY/TAKE while the same tooltip stays visible; leave/current change
  destroys it; re-entry of the selected ordinary row rebuilds it; purchase,
  rebuild, close, range exit, and scene teardown cannot leave stale content.
  Selection does not pin a tooltip after its current owner has gone.
- HoverBox content, zero-delay timing, geometry, painter order, audio silence,
  and participant-local authority remain exactly as recovered in the complete
  2026-08-22 contextual-inspection entry.

## Nearby-system findings

- Durable correction: StoreItem kind is authored row type, not transient
  selection state. The same false relationship is removed from every service,
  the Website ledger, and the Mod Loader report/catalog at once.
- The selected-art pass was independently correct: UI 84/111 and dormant
  UI 85/112 ownership do not change. Only the tooltip lifetime inference made
  from those pixels was wrong.
- Debugger-staged selected frames cannot prove input sequencing. Future
  lifecycle claims must use natural pointer input or exact state-writer traces.

## Confidence and open questions

- Confirmed: all fields, writers, virtual slots, selected-art predicates,
  ordinary offer producers, sibling Shop consumers, and teardown edges needed
  by the web behavior.
- Inferred: none used by the implementation.
- Unknown: none inside this boundary. Runtime perk effects and InventoryScreen
  ItemInfo remain separately owned, already dispositioned systems.

## Web implementation consequence

- Keep `serviceHoverInspection` / `serviceFocusInspection` as the contextual
  owner. Do not invent a selection-owned tooltip snapshot or timer.
- Remove the selected-identity early return from both visible WebGL HoverBox
  composition and the semantic `role=tooltip` mirror. Selection art and content
  inspection must consume their independent model lanes.
- A mouse pointer press on a transparent ShopAction must prevent the browser's
  default persistent button focus. Native mouse input changes StoreGrid
  current/selection only; it does not create a second keyboard-current owner
  which survives pointer exit. Explicit keyboard/programmatic focus remains
  available and continues to build the same HoverBox.
- Retain pointer-leave/focus-blur, missing-item, notice, purchase/rebuild, and
  service teardown invalidation unchanged.

## Validation contract

- Focused contracts must prove the renderer and semantic paths do not suppress
  a still-current selected ordinary row, while selected art remains UI 84/111;
  mouse pointer-down must not leave semantic focus behind, while explicit
  focus retains inspection.
- The complete Hub trader smoke must cover selected-tooltip retention for
  Fomentius, Hagatha, Luthacus, and Shlorio; verify exact price/no-price/suffix
  content; and prove empty/current change, purchase, and close remove stale
  copy. Page, console, failed-response, and host-error arrays must be empty.
- Run the complete Website gate and the Mod Loader registered static RE suite
  on the byte-identical Mac candidate, then repeat the production-bundle
  Chrome/WebGL journey at 1600 by 900 before publication.

## Implementation validation receipt

- `NativeHubSurface` retains the independently owned hover/focus inspection
  while service selection paints UI 84/111. The semantic tooltip and visible
  WebGL compositor no longer suppress matching selected identity. ShopAction
  prevents default focus only for mouse pointer-down, so pointer exit tears
  down exactly once while explicit keyboard/programmatic focus still inspects.
- The rebased, byte-matched behavioral candidate was Website
  `be1b901ea78ae25332ffede0d1318f1a9ab82eaf` on upstream
  `5488941873aaf05e52d36b30f8e885aef0dfb511`; the paired Mod Loader
  documentation candidate was `af004e13aff05f63955e8433f701a2cdcbf20678`
  on upstream `ba547670c6fde43f179195c65d22ea3af8406fb4`. Every changed-file SHA-256
  matched between the local and detached Mac worktrees. This receipt-only
  ledger refresh changes no runtime or acceptance code after that candidate.
- The Mod Loader registered static RE suite passed `502/502`; log SHA-256 is
  `78e6fddf781059a2acaf1fadca053cdbd9bb3973f77360d10a51970033af3dc5`.
  The complete Website `/opt/homebrew/bin/bash ./scripts/validate.sh` gate
  passed all backend contracts and registered frontend/desktop suites, plus
  formatting, lint, production builds, media policy, and bundle budget; log
  SHA-256 is
  `8112e3408592bf931cf007ce266645e4d3ce1048c8bb7e3407ae031cb4d4958c`.
  Its canonical Game entry was `Game-RSCHNaKt.js`, 473,980 raw / 132,830 gzip
  bytes within the 524,288 / 133,120 limits.
- macOS 26.6.2 arm64 Chrome 151.0.7922.174 ran the production build with two
  real clients and the task-owned private authoritative host. The complete
  trader journey returned `status:"ok"`, `browserErrors:[]`,
  `failedRequests:[]`, `failedResponses:[]`, guest gold 500, and no host error
  events. Five `net::ERR_ABORTED` academy/combat/death media cancellations were
  separately labeled expected scene-transition aborts, not HTTP failures. The
  acceptance entry `Game-BxTgNjiZ.js` remained within budget at 474,097 raw /
  132,890 gzip bytes. Browser-log SHA-256 is
  `0c01bfaa8bf9df6d8a6f6e563ea2675734a5408a53e61389dc05ef16e7f358dd`;
  acceptance-build log SHA-256 is
  `88711c7ff2928f3c2af018b6ef483ec0916ea7c9b411c22a9d6d6b4b6149cd86`.
- Reviewed selected-state WebGL captures show UI 84/111 and the ordinary
  HoverBox simultaneously: Fomentius Mana Potion
  `22f0572bc8bf3fe9951ec33172efbc1138ad38219af424fae4a3dba25b87a4b8`,
  Hagatha Life Charm
  `eee7417d9cf486b5fbb3d5f36f326180e9b87f66f098ee4190dbff377ac7083e`,
  Luthacus no-price Mana Potion
  `cea18cb8af745665826f1f0a7229a8215a8f575844654658c2e32df1dd7b06a0`,
  and Shlorio Combinator's Circle
  `1a3703b10ac00e8e73ac83f099d89875bcbeffaaa7b70de8955fa4e4bb292111`.
  Pointer exit, selected re-entry, explicit focus, purchase/rebuild, close,
  insufficient funds, companion activation, drag/equip, and unforge tails all
  passed. No member is browser-blocked and no native unknown remains.
- Publication is authorized and pending final remote freshness proof.
  Deployment remains separate and was not requested.
