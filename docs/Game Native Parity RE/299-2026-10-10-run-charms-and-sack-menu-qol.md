# 2026-10-10 — Active-run charms and Sack menu quality of life

## Scope and acceptance boundary

The user explicitly requested persistent charm visibility during an active run,
inactive styling that reverses when a charm becomes active, the loss sound,
renaming Sacks, and the proposed Sack/menu keyboard navigation. This entry
separates recovered native facts from those deliberate Website quality-of-life
changes. It makes no new claim of complete native UI or final-frame parity.

The work is bounded to reports 101, 104, and 22. Report 57, new storage
navigation, native Windows probes, the protected Mod Loader checkout, charm
purchase/removal rules, and charm gameplay/reactivation rules are unchanged.

## Evidence and provenance

- Verified base: `790b5e439ed9d13fc876e57fce67ab985d286af6`.
- Retail Solomon Dark 0.72.5 executable SHA-256:
  `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`.
  Preferred image base is `0x00400000`. The fresh read-only M2 PE
  disassembly is retained with the task's authoritative M2 evidence archive.
- Instructions `0x0052FCEA–0x0052FDEB` test either Reverie `+0x73D`
  or Serendipity `+0x73C` active and positive summed post-defense damage.
  `0x0052FD56` plays the sound registry's `+0x13B4` entry at gain one;
  `0x0052FD82` and `0x0052FDAF` clear the respective flags and
  refresh progression. This branch does not construct a Notebox.
- Constructor `0x004F0A48` refers to literal `0x0078F804`;
  `0x004F0A5E` stores the resulting sound at `+0x13B4`.
  The stock resource is `sounds\\LoseReverie__Stream.wav`, 20,806 bytes,
  PCM mono 16-bit at 11,025 Hz, duration 0.9415873 seconds, SHA-256
  `7119ded647e6709167571fb22908c74bda77a2dca71a97c511aada13d6966beb`.
  The Website can use these identical WAV bytes under its existing media policy.
- Existing ledger 175 owns the Hagatha gameplay model and until-hurt state.
  The persistent HUD is an approved addition; the stock loss stream is a
  recovered missing presentation effect.
- Existing ledgers 170, 252, 255, 262, and 293 own recursive exact-ID Sack
  ownership, stored names, item-addressed slots, captions, and parent-cell
  navigation. Report 22's corrected page motion is 37 ten-millisecond ticks
  using the existing vertical grid model. The stock configured Inventory
  action closes the whole Inventory. The approved Website action instead
  steps back one Sack, closing at the root. Native Escape's final behavior
  is not established by this work and is not used to justify the QoL change.

## Charm system membership and ownership

The authority owns the ordered purchased selector list and progression state.
The presentation reads only the local owner's current run state. A maximum of
nine owned entries is preserved, including two Tonic entries in purchase order.
All stock icons are Skills atlas record `127 + selector`.

Every catalog row below keeps its existing gameplay implementation. Its target
disposition for gameplay is `verified-already-at-parity`; the status HUD is
explicitly Website QoL and is not a new native-layout claim.

| Selector | Stock name | Status presentation source |
| --- | --- | --- |
| 0 | LIFE CHARM | Owned membership |
| 1 | MANA CHARM | Owned membership |
| 2 | SPEED CHARM | Owned membership |
| 3 | ITEM CHARM | Owned membership |
| 4 | GOLD CHARM | Owned membership |
| 5 | SEEKER'S CHARM | Owned membership |
| 6 | REVELATION CHARM | Owned membership |
| 7 | CHEAT DEATH CHARM | Existing remaining charge state |
| 8 | PERKY CHARM | Native offer builder excludes it; do not offer it |
| 9 | SCATTER CURSE | Owned membership |
| 10 | WAR CHARM | Owned membership |
| 11 | CURING CHARM | Owned membership |
| 12 | THE LAST WORD CHARM | Owned membership |
| 13 | SPELLWELDER'S CHARM | Owned membership |
| 14 | WEIRD CASTER CHARM | Owned membership |
| 15 | DRINKER'S CHARM | Owned membership |
| 16 | GLASS CANNON CURSE | Owned membership |
| 17 | SORCEROR'S CHARM | Owned membership |
| 18 | FOCUS CHARM | Owned membership |
| 19 | DISFIGURING CURSE | Owned membership |
| 20 | BARE HANDS CHARM | Existing no-equipped-weapon condition |
| 21 | SPLIT MIND CHARM | Owned membership |
| 22 | CURSE BOSSES | Owned membership |
| 23 | ARCANE ATTRACTOR CHARM | Owned membership |
| 24 | SERENDIPITY CHARM | Existing serendipityActive flag |
| 25 | REVERIE CHARM | Existing reverieActive flag |
| 26 | BRUTE'S CHARM | Owned membership |
| 27 | TONIC | Both permitted entries remain in owned order |

The new display must dim inactive entries and supply explicit accessible
inactive text. It must restore enabled styling from authoritative state;
no presentation timer, inferred hit, or new reactivation rule may change it.
An empty list, no owner, or no active run must not expose another player's
state or a stale prior run.

| Native/lifecycle member | Target disposition | Acceptance |
| --- | --- | --- |
| Reverie-only positive post-defense damage | exact-ported loss presentation | One native stream and cleared flag |
| Serendipity-only positive post-defense damage | exact-ported loss presentation | One native stream and cleared flag |
| Both active on the same damaging event | exact-ported loss presentation | One stream, both cleared |
| Zero or fully absorbed damage | verified-already-at-parity | No loss event or cue |
| Repeated damage after both are spent | verified-already-at-parity | No duplicate event or cue |
| Direct/contact damage, poison tick, lethal damage | exact-ported shared presentation | Each producer preserves existing damage ordering |
| Drinker, Cheat Death, death/rescue effects | out-of-system for gameplay changes | Existing ordering and cues preserved |
| Purchase/removal, save/restore, reactivation | verified-already-at-parity | No rule change; display reflects current state |
| Initial snapshot, reconnect, stale/repeated event | exact-ported event ownership | Seed/deduplicate event cursor; no historical cue |
| Other-player event and owner/scene teardown | exact-ported event ownership | No wrong-owner cue or stale HUD |
| Persistent HUD and accessible inactive status | out-of-system for native layout | Explicit user-approved Website QoL |

Loss audio must originate from the actual authoritative transition, through the
existing deduplicated Boneyard event lane. Diffing two rendered snapshots would
incorrectly play it on initialization, restore, or unrelated item removal.
No loss cue is added for Bare Hands. Existing Cheat Death audio stays under its
existing owner.

## Sack naming and menu membership

Renaming is a user-approved Website operation, not an invented stock editor.
It changes only the name of an exact owned Sack. Recursive backpack and
Luthacus storage trees are the two owned item collections; shops, dowsing
offers, and scavenged offers are not owned until acquired. Equipment cannot
hold a Sack. IDs, contents, addressed slots, belt bindings, and loadout
references must remain unchanged.

A visible Rename action addresses the selected owned Sack, including a storage
selection, or the current open Sack when none is selected. The existing
generated name remains until a valid committed rename. The authority trims
input and rejects blank names, control characters, or names longer than
32 UTF-16 code units. Cancellation submits nothing. Existing saves already
store item names, so no regenerated default may overwrite a custom name.

Custom Sack names may contain glyphs absent from the stock menu atlas. Only
those Sack captions and tooltip titles use bounded browser text; supported
names keep stock bitmap rendering. The fallback checks every code point,
including mixed-script and combining names, rather than testing total width.

Durable charm flags and Sack names remain in the existing save schema. The
new loss cue and rename acknowledgement are presentation-only: checkpoint
projection omits only `player-charm-lost` events and `rename-sack` feedback.
It must leave live replication unchanged, preserve other events and the next
event ID, and cover both continuation and retired-profile economies. This
follows the existing save-only dye-feedback projection. Compatibility must be
checked against the prior build's actual restore and strict snapshot decoder.
The maintained deployer retains a SQLite backup and restores runtime and
configuration on failed release; it does not automatically restore that
database or roll back browser IndexedDB saves.

| Member | Target disposition | Acceptance |
| --- | --- | --- |
| Root and nested backpack Sacks | out-of-system native naming QoL | Exact-ID rename, contents and identity preserved |
| Root and nested Luthacus storage Sacks | out-of-system native naming QoL | Authority handles exact owned ID; visible storage selection can rename |
| Unowned, stale, and non-Sack IDs | verified-already-at-parity ownership boundary | Rejected with no mutation |
| Empty, overlength, control-containing input | out-of-system native naming QoL | Authority rejects invalid request |
| Cancel and unchanged generated name | verified-already-at-parity until explicit rename | No request or incidental mutation |
| Save/reload and moved/nested Sack | verified-already-at-parity persistence | Same saved name and ID survive |
| Inventory configured binding inside a Sack | out-of-system native input QoL | One parent per fresh activation |
| Inventory configured binding at root | out-of-system native input QoL | Close Inventory and use existing resume lifecycle |
| Menu/Escape in Inventory or service companion | out-of-system native input QoL | Close whole optional surface; preserve service cleanup |
| Optional Skills | out-of-system native input QoL | Dismiss whole optional book and resume the current scene |
| Mandatory level-up choice | out-of-system for dismissal change | Cannot dismiss a required choice |
| Dye child confirmation | verified-already-at-parity | Child cancel takes priority; no accidental dye commit |
| Rename text field and rebound letter keys | out-of-system native naming QoL | Editing does not leak navigation; Escape cancels edit |
| Parent-cell pointer, keyboard activation, and held input | verified-already-at-parity | Existing one-step and release-consumption rules remain |
| Sack page animation | verified-already-at-parity | Existing 37×10 ms clock and traversal remain unchanged |
| New storage navigation and unrelated optional menus | out-of-system | Preserve existing scope unless explicitly authorized |

## Validation contract

1. Focused regression tests exercise complete charm membership, authoritative
   loss state and event producers, zero/absorbed/repeated/both/poison/lethal
   cases, restoration, ownership, initial/replayed events, and strict protocol.
2. Sack tests cover recursive backpack/storage ownership, all invalid-name
   classes, cancel, IDs/contents/slots/belt/loadouts, and persisted custom names.
3. Input tests cover Inventory back/root close, Menu whole close, rebound and
   repeated keys, text editing, dye cancellation, optional Skills, and mandatory
   level-up protection.
4. Headed Mac Chrome journeys exercise touched behavior on desktop and
   touch-emulated mobile, collect page/console/request/host errors, inspect
   screenshots, and observe actual native audio starts. Mobile emulation is not
   a claim of physical-device acceptance.
5. The exact final source must pass the unchanged complete
   `scripts/validate.sh` gate on M5's /Volumes/Drive with real HOME and isolated
   caches, then independent review, normal publication, maintained deployment,
   exact live acceptance, hosted CI terminal checks, and task cleanup.

## Implementation validation receipt

The integrated prepublication candidate passed 301 focused and save regression
tests, both application and test type checks, the full frontend lint/import
boundary checks, and the production build. Lint retains the 21 existing
warnings and reports no errors. Independent source review found no unresolved
implementation defect before the final source freeze.

Headed Mac Chrome acceptance passed the owner-only nine-entry charm display,
dim/restore state, silent initial load and reload, owner/peer isolation,
zero/repeated/both-charm damage, focused shortcut isolation, and actual native
audio starts. Sack acceptance passed nested rename and persistence, Unicode
captions and titles, invalid/cancel behavior, rebound-key editing, one-parent
Inventory navigation, whole optional-menu close, mandatory choice protection,
and all four College service companions with dye cancellation and cleanup.
The existing Sack page motion remained approximately 370 milliseconds.

Desktop and touch-landscape screenshots were inspected independently. The
rename frame reserves its crown and footer, scales only ornament art on short
viewports, and retains readable input and action targets. Browser measurements
found no clipped frame art, overlapping controls, or focus-induced ancestor
scrolling. The existing portrait rotation gate remains intact; portrait
gameplay and physical-device/onscreen-keyboard acceptance are not claimed.
The nearby-Goodie focused shortcut guard is source-reviewed, not covered by a
dedicated rendered nearby-Goodie journey.

An additional bounded compatibility probe restored a newly generated save
using the exact previous build at `790b5e4`, including its strict snapshot
decoder. Nested Unicode names, item identity and contents, belt references,
spent charm flags, other events, and event IDs survived. Only the two new
presentation-only receipts were omitted from disk; live state was unchanged.
This does not establish compatibility with arbitrary older builds.

Raw native evidence, test logs, full browser error receipts, screenshots, and
the previous-build save probe are retained in the authoritative M2 report
archive. The clean final-commit replay, unchanged M5 all-mode gate, publication,
exact deployed acceptance, and hosted CI are release requirements recorded in
that archive after this source freeze; this entry does not preclaim them.
