# 2026-08-24 — Developer-cheat neutrality and authoritative player grants

## Reported smell and parity question

- Owner requirement: an account carrying the protected developer entitlement
  may use every developer/cheat control without converting the player's save to
  `local-only`, revoking global Hall eligibility, or tainting the party's run.
  Developer-only Lua must also be able to grant Gold, stock inventory items,
  and learned skills to another player in the Hub or the developer's active
  run; Hub grants must enter the ordinary player store and survive run launch.
- This is an intentional Website administration extension. Retail Solomon Dark
  has no account-bound web developer entitlement, signed global leaderboard,
  browser save-integrity class, or portable host Lua VM, so no stock behavior or
  native address is claimed.
- Falsifiers: trusting a browser-authored developer flag; exempting the visible
  setting while an accepted Lua request still taints; leaving bot-assisted
  developer runs ineligible; granting into a detached cache instead of the
  target player's economy/skill book; allowing an ordinary cheat host or mod VM
  to see the grant namespace; resetting Hub grants at Boneyard entry; or
  suppressing ordinary mod/private/save/Tutorial eligibility rules.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Backend authorization trace | `DeveloperAccessPolicy.cs`, `GameSessionEndpoints.cs`, `GameSessionProvisioner.cs` | `DeveloperAccess:UserIds` is resolved from the authenticated JWT subject and sealed into a one-use supervisor admission. No request body or gameplay packet can mint it. | high |
| Host causal trace | `game-host.ts` admission, `client-cheat-mode`, `client-lua-execute`, `taintIneligibleClientRuns`, save checkpoint, and leaderboard receipt branches | Initial and live cheat mode already ignore developer connections, but every accepted Lua request still unconditionally clears `globalScoreEligible`, sets `localOnly`, and taints the active run. Any summoned bot independently taints its run even though `sd.bots.summon()` exists only for a developer admission. | high |
| Lua/API trace | `web-lua-api.ts`, `web-lua-contract.ts`, `web-lua-game-api.ts`, `web-lua-runtime.ts` | Developer entitlement currently gates only `sd.bots`; all semantic player commands are queued at the fixed-tick boundary and then applied through the authoritative player entity store. | high |
| Hub/run lifecycle trace | `shared-game-worlds.ts`, `partitionGameSimulationPlayers`, `enterBoneyardWorld`, `resetPlayerEntitiesForNewRun` | A Hub party is partitioned with its complete player entities. Economy, inventory, permanent/effective skill ranks, advanced unlocks, and quickbar are retained while combat/placement/runtime state is rebuilt. | high |
| Authored catalog data | `FOMENTIUS_STOCK_DEFINITIONS`, `NATIVE_SKILL_BOOK_DEFINITIONS`, `DOWSING_EQUIPMENT_RECIPES`, `NATIVE_SKILL_CATALOG`, `NATIVE_WELD_BUILDS` | The web authority owns nine Fomentius consumable/utility definitions, two stock skill-book rows, 47 equipment recipe rows, 72 learnable skill rows `8..79`, and ten welded-primary builds `1000..1009`. | high |

No reusable retail-binary fact was recovered. The Mod Loader native reports do
not receive a duplicate entry; this change consumes already recovered Website
catalogs and changes only the web developer policy and semantic adapters.

## System boundary and membership inventory

Web system: authenticated developer capability propagation, every cheat-taint
writer/consumer, developer-console namespace construction, typed fixed-tick
grant commands, authoritative target-player economy/skill mutation, Hub-to-run
lifecycle, snapshots/checkpoints, and global leaderboard receipt publication.

| Member | Source/owner | Disposition | Proof contract |
| --- | --- | --- | --- |
| Developer identity | backend allowlist -> provisioner -> supervisor ticket -> `GameHostAdmission.developerAccess` | `verified-already-at-parity` | Only authenticated server material may set it; hello/settings/profile fields remain irrelevant. |
| Initial `Enable Cheats` admission | `client-hello`, `clientCheatsEnabled`, `globalScoreEligible`, `localOnly` | `verified-already-at-parity` | A developer hello treats the setting as false while an ordinary caller retains existing taint/private routing. |
| Live cheat toggle | `client-cheat-mode` | `verified-already-at-parity` | Developer messages are neutral; ordinary enable permanently taints the connection/run/save. |
| Accepted console execution | `client-lua-execute` | `exact-ported` web policy | Developer execution remains eligible and global-clean; an ordinary authorized host still becomes local-only and taints its run before VM work. |
| Seed, resource, enemy-spawn, and callback/timer cheat effects | developer console command queue and existing Lua APIs | `exact-ported` web policy | Their eligibility follows the authenticated console owner, not the semantic command kind. |
| Developer-summoned bot | `sd.bots.summon`, bot store, `taintIneligibleClientRuns` | `exact-ported` web policy | Bots can only originate from a developer binding and therefore no longer taint human receipts; ordinary clients still cannot create bots. |
| Anonymous admission, ordinary cheats, enabled mods, private College, local-only/resumed save | existing eligibility inputs | `verified-already-at-parity` | No developer-policy shortcut broadens these independent branches. |
| Stock Tutorial | explicit `leaderboardIneligibleRunIds.add` | `out-of-system` | It is a non-ranked authored lesson, not a developer-cheat invalidation path. |
| Gold grant | new developer-only Lua adapter -> target `HubEconomyState.gold` | `exact-ported` web extension | Positive bounded addition targets the named live player and emits the existing `gold.changed` projection. |
| Nine Fomentius consumable/utility definitions | `FOMENTIUS_STOCK_DEFINITIONS` | `exact-ported` web extension | Every row has one deterministic grant key/descriptor and uses ordinary inventory identification/stacking. |
| Two stock Book of Skill variants | `NATIVE_SKILL_BOOK_DEFINITIONS`, native miscellaneous subtypes `2/3` | `exact-ported` web extension | Bonus-choice and random-rank books keep distinct keys/subtypes and enter the ordinary read/consume path. |
| 47 stock equipment recipes | `DOWSING_EQUIPMENT_RECIPES` rows `0..46` | `exact-ported` web extension | Every recipe has one `equipment:<sourceIndex>` key and is constructed by the existing equipment-item owner. |
| Procedurally generated equipment | `native-loot.ts` random level/effect/color construction | `out-of-system` | It has no stable authored item identity to grant; accepting arbitrary RNG/effect structs would be raw state injection. The 47 named recipes remain fully grantable. |
| Skill rows `8..51`, `53..79` | `NATIVE_SKILL_CATALOG`/stat book | `exact-ported` web extension | Bounded rank increments clamp at each row's authored maximum, update learned order/quickbar/advanced unlocks, refresh derived combat state, and rebuild any pending offer against the new ranks. |
| Spell Welding row `52` and builds `1000..1009` | `NATIVE_WELD_BUILDS` | `exact-ported` web extension | A separate build grant establishes component ranks, row 52, selected build/component ranks, and welded primary ownership atomically. |
| Dynamic mod items/custom content | per-mod `sd.items` registry | `out-of-system` | Developer stock grants do not fabricate mod ownership or cross a mod VM's content boundary. |
| Hagatha perks, arbitrary raw item structs, cross-run/offline players | separate economy/runtime or persistence owners | `out-of-system` | This grant slice exposes authored stock inventory and skills only; it does not accept untyped state injection or mutate a player absent from the developer's current world. |
| Hub-to-run transfer | shared-world partition plus `resetPlayerEntitiesForNewRun` | `verified-already-at-parity` with new coverage | Gold, backpack items, learned ranks, quickbar, and advanced unlocks remain on the target entity after launch. |
| Snapshot/save/receipt consumers | ordinary replication, `publishSaveCheckpointForClient`, `publishLeaderboardReceipts`, client receipt submission | `exact-ported` web policy | Developer grants replicate normally, checkpoints stay `global-clean`, and an otherwise eligible completed run receives and submits its signed receipt even if stale local setting storage still says cheats are on. |

No member is blocked by the browser platform.

## Ownership and recovered/requested contract

```text
authenticated JWT subject -> protected developer allowlist
  -> one-use admission/ticket -> immutable HostClient.developerAccess
  -> developer console VM receives sd.dev + sd.bots
  -> Lua validates a live target from the developer's current semantic frame
  -> bounded typed grant enters the existing WebLua command queue
  -> next 100 Hz host boundary mutates the target PlayerEntityStore component
  -> ordinary snapshot/save/event projections observe the new state
  -> shared Hub partition carries that same entity into the Boneyard
  -> developer origin leaves save integrity and Hall eligibility unchanged
```

- `sd.dev` exists only when `WebLuaRuntime` receives server-authenticated
  developer bindings. It is absent from ordinary host-cheat and per-mod VMs.
- Targets are optional and last, matching the existing `sd.player` convention.
  Omitting one targets the active developer; another live player id comes from
  `sd.player.list()`.
- Item grants accept only keys returned by `sd.dev.list_items()`. Skill and
  Weld grants accept only authored catalog identities returned by
  `sd.dev.list_skills()` and `sd.dev.list_welds()`.
- Command acceptance is queued, as with existing semantic Lua writers. No raw
  `HubEconomyState`, `PlayerSkillBookComponent`, item id, recipe object, or
  browser-authored entitlement crosses the Lua boundary.
- Developer neutrality belongs to the authenticated connection that authored
  the cheat. It does not make mods, a private College, a local-only save, or the
  Tutorial ranked merely because a developer is present.

## Confidence and open questions

- Confirmed: authorization provenance; every current cheat-taint writer;
  leaderboard/save consumers; all stock grant catalog members; fixed-tick
  command ordering; same-world target ownership; and Hub-to-run retention.
- Inferred product intent: developer-summoned bots count as developer cheats
  and therefore become neutral under the owner's explicit "any run" rule. This
  is mechanically testable and no non-developer bot creation path exists.
- Unknowns: none material. Cross-run/offline administration and arbitrary mod
  item grants are explicitly outside this typed live-world capability.

## Web implementation consequence

- Keep entitlement and eligibility policy in `game-host.ts`; do not add a
  client setting, protocol developer claim, or leaderboard verifier bypass.
- Add one bounded `sd.dev` API and pure descriptor/item-construction adapter in
  `host/lua`; add typed command variants to the existing fixed-tick queue.
- Put direct learned-skill/Weld mutation in the progression/player-entity
  owners so derived stats, quickbar, advanced unlocks, and run reset share one
  consistent model.
- Remove only the developer-origin Lua and bot taint. Retain all independent
  ordinary eligibility branches.

## Validation contract

- Runtime/API tests: `sd.dev` absent without developer bindings; complete item,
  skill, and Weld catalogs; strict bad-key/id/quantity rejection; targeted
  Gold/item/skill/Weld command shapes.
- Domain/adapter tests: all eleven utility/skill-book rows, all 47 equipment rows, all 71
  non-Weld skill rows, and all ten Weld builds construct/apply without invalid
  inventory or skill state; a representative remote target keeps every grant
  through `enterBoneyardWorld`.
- Host tests: ordinary Lua still withholds receipts and creates `local-only`
  checkpoints; developer Lua and developer bots remain `global-clean` and an
  otherwise eligible run emits the account-bound signed receipt.
- Built Mac browser journey: developer admission with a second player in the
  global Hub; `sd.dev` lists and grants Gold, consumables, equipment, a skill,
  and a Weld to that player; snapshots prove the state before and after that
  player's Boneyard entry; ordinary host console proves the namespace absent; page,
  console, failed-response, wire, and host-error arrays are empty.
- Run `/opt/homebrew/bin/bash ./scripts/validate.sh` on the exact clean Mac
  candidate after focused tests. Push and deployment remain separate and are
  not authorized by this request.

## Implementation validation receipt

- `game-host.ts` now leaves `globalScoreEligible`, `localOnly`, and active-run
  taint untouched for a sealed developer connection while retaining all three
  mutations for ordinary accepted Lua. The bot-only taint was removed because
  every bot constructor remains reachable only through that same developer
  binding. `MainMenuScene` submits a signed receipt when the welcome carries
  developer access even if stale browser setting storage still says cheats are
  enabled.
- The developer VM alone now receives `sd.dev`: complete list/grant adapters
  for 58 deterministic stock items, 72 skill rows, and ten Weld builds. The
  item catalog drains nine Fomentius rows, both Book of Skill variants, and all
  47 named recipes. Non-applicable descriptor fields are omitted in the Lua
  projection so Wasmoon receives native `nil` rather than a nested JavaScript
  `null`; ordinary and mod VMs have no `sd.dev` table.
- Gold, item, skill, and Weld writes enter the existing bounded fixed-tick
  command queue. The target player's real economy/skill components own the
  result; rank grants refresh advanced unlocks, derived combat, quickbar, and
  any pending offer, while Weld grants establish all component rows and the
  selected build atomically. Inventory insertion is atomic and bounded by the
  existing 2,048-item replication contract.
- Focused Mac tests proved strict developer namespace absence/presence,
  malformed key/id/quantity rejection, all 58 item rows, all 71 non-Weld skill
  rows, every Weld, pending-offer rebuild, Hub-to-run transfer, in-run remote
  grants, ordinary Lua taint, developer global-clean saves/receipts, and a
  developer-bot run receipt. The one unrelated multiplayer Game Over timing
  assertion that failed under a six-file parallel batch passed immediately in
  isolation and in the canonical gate.
- The initial manifest-identical Mac canonical gate completed every backend,
  lint/import, frontend/game, ML, Hall, Hub, Tutorial, desktop, production-build,
  bundle-budget, and media-policy stage. Backend build had zero warnings/errors;
  the Game entry was `461,615` raw / `129,815` gzip bytes against
  `524,288` / `131,072` limits. Log SHA-256:
  `a9dc3d3ed3a6a5778160fd82f8b712d7a297cccd437c3eba289b8d3e84eee058`.
  A final full-gate rerun after the smoke-only Tutorial dismissal change is
  recorded in the completion receipt.
- Built Chrome `151.0.7922.170`, protocol `solomon-dark/72`, proved the ordinary
  console exposes no `sd.dev`, with zero unexpected request failures/budget
  crossings and callback p50/p95/p99/max
  `0.289/0.524/0.623/0.790 ms`. Log SHA-256:
  `acef986a1619411ae9e6298018bcead177d39eb72b29313c7187c70235266c90`.
- The built two-player developer journey returned catalog sizes `58/72/10`,
  granted an ordinary Hub player Gold `500 -> 750`, Health Potions `1 -> 4`,
  equipment recipe `0`, Acid Rain rank `2`, and Weld `1000`, then proved the
  target's separate Boneyard snapshot retained those exact values. Page,
  console, failed-request, and host-error arrays were empty. Log SHA-256:
  `4ec0db98860309ca8256f3aff3c02e39e6c1b3edbd01c5dc6b8ba18b8aba6893`.
- No member is browser-blocked. No commit, push, deployment, or production
  mutation was performed.
