# Enemy damage-presenter closure correction (2026-08-15)

This secondary report reopens and supersedes the nonterminal-damage portion of
the immediately preceding hit/death pass. That pass correctly recovered the
common Actor red latch and terminal family presenters, but it did not enumerate
the enemy polymorphic damage seam (`vtable +0x4C`) and did not follow the
positive shield branch inside `Badguy::Contact`. The reported missing effects
and sounds are therefore one skipped native ownership layer, not four unrelated
asset-playback bugs.

## Evidence ledger

| Tier | Evidence | Finding | Confidence |
| --- | --- | --- | --- |
| Retail executable | `SolomonDarkAbandonware/SolomonDark.exe`, 4,723,200 bytes, SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3` | Exact stock provenance used for every address and constant below. | high |
| Static class census | Native enemy catalog vtables and slot `+0x4C` | Skeleton/Archer/Mage share `0x0048A600`; Zombie uses `0x0048B1E0`; Imp uses `0x0048B1C0`; Wraith thunks to common; Demon/Coffin/Maggot use common; Spider/Cocoon/Portal own non-Website overrides. | high |
| Static receiver instructions | `0x0048A290`, `0x0048A600`, `0x0048B1E0`, `0x004835F0`, `0x0047CE00` | Exact hurt-sound gates, shield early-return/no-overflow rule, 10-tick cue throttle, pulse values/decay, break cue, and twenty-particle constructor fields. | high |
| Static shield-writer xrefs | complete `0x00477140` xref set and Mage dispatch `0x0047FDE0` | Action `0x13` shields the Mage itself. Action `0x14` calls the helper at `0x0047FE8B` only for a same-team Skeleton `0x3E9`, Archer `0x3EA`, or Zombie `0x3EE`; other enemy families are not reachable ally-shield recipients. | high |
| Static render instructions | Skeleton-family blocks at `0x0048F20F..0x0048F3B1` and siblings | Active shield is one additive BadGuys record 49 at `y-30`, with pulse-derived brightness and sine scale; it is not a health-ratio copy of body layers. | high |
| Asset/catalog identity | Retail audio catalog and untouched WAVs | `bonecrack` entry 12, `hitshield` 42, `popshield` 74, and `zombieouch` 107 are exact point cues with pinned source hashes. | high |
| Negative spell census | Rank-one Air/Water dispatch plus Earth `0x00620B60` | Air and Water have no target-contact cue. Earth `rockhit` is a vertical ground-bounce cue at `0x0062141B`, not an enemy-contact event. | high |
| Pre-fix Website base | origin/main `4fbb3b7`; `boneyard-enemy-store.ts`, `native-enemy-presentation.ts`, protocol/audio manifests | The web rolled shield overflow into HP, armed the red latch on pure absorption, drew body-copy glow, emitted no hurt/shield events or break particles, and did not ship the four damage WAVs. | high |

## Closed stock state machine

For an ordinary unshielded hit, Skeleton/Archer/Mage play `bonecrack` and
Zombie plays `zombieouch` only when the prior common latch is zero and damage
flag `0x10` is clear. Pitch is `1 + RandomFloat(0.1, signed)`, hence
`[0.9,1.1)`. The wrapper then enters common contact, which refreshes the
20-tick red body latch. A first lethal hit still emits its family hurt cue
before terminal output; repeated hits inside the latch window do not replay it.

For `shieldHealth > 0`, native common contact exits through a separate lane:

```text
shield -= primaryDamage + secondaryDamage
if shieldCueCooldown == 0:
    play hitshield at 0.8 + U[0,0.05)
    shieldCueCooldown = 10
    shieldPulse = 2
if shield <= 0:
    play popshield at 0.8
    create 20 stationary additive BadGuys[69] fades
    shield = 0
return without body-hit reaction or health damage
```

The breaking hit never transfers excess damage to health. Common tick
`0x004835F0` subtracts `0.05` from pulse and one from the cooldown, clamping
both at zero. Applying a shield writes pulse `3`. Each break fade starts at
`(x,y-30)`, rotation `U[0,360)`, alpha `0.5+U[0,0.75)`, loss `0.05`, uniform
scale `1.5+U[0,0.25)`, zero velocity, additive blend, and stable world-owned
identity until its sampled alpha expires.

While shield health remains positive, the renderer draws one additive
BadGuys[49] shell at `(x,y-30)`. With pulse `p` and Region light `L`:

```text
brightness = (0.5 * (max(p,1) - 1) + 0.25) * L
scale = 1.5 + 0.1 * sin(worldTick * 20 degrees) * min(p,1)
```

Current/max shield ratio is not a visual input. Pure absorption must leave the
ordinary body hit latch unchanged.

## Membership and negative dispositions

- Implemented wave membership: Skeleton, Archer, Mage, Imp, Zombie, Wraith,
  Demon, Coffin, and subordinate Maggot.
- Skeleton/Archer/Mage receive `bonecrack`; Zombie receives `zombieouch`;
  other implemented families receive only their reachable common body-hit
  presentation.
- The positive shield branch is reachable for Mage self and same-team Skeleton,
  Archer, or Zombie allies only. Stock Mage action `0x14` rejects Mage-as-other,
  Imp, Wraith, Demon, Coffin, and Maggot by exact runtime type before applying a
  shield. Their inherited common receiver does not imply a stock shield writer.
- Native Imp `+0x234` rejects damage during its ejected/materializing phase.
  The Website's supported Imp lifecycle starts in active flight and has no
  corresponding phase; this pass does not disguise that separate lifecycle
  omission as a sound effect.
- DireFaculty, Heartmonger, DemonSkull, GreenImp/GoodImp, Spider, Cocoon,
  Portal, Crow, and player-owned Golem are not Website wave-family producers.
  Their recovered overrides are documented but do not justify unreachable
  protocol variants.
- Ether and Fire retain their recovered projectile impacts. Air's target
  corona is already the native visual. Water has no target-local hit actor.
  Earth `rockhit` remains a separate rolling-boulder bounce-physics concern;
  attaching it to enemy contact would be false parity.

## Implementation and acceptance contract

The host must own hurt/shield event IDs, pitch RNG, shield cooldown/pulse,
no-overflow damage acceptance, and every break-particle sample. Damage results
must publish semantic events into the existing retained run lane during the
same authoritative spell tick. The live enemy sample must carry one native
record-49 shield sample; break particles use the already-independent effect
entity lane and survive shield-state changes without client rerolls.

The renderer must remove the body-copy shield approximation. Exact untouched
WAVs enter the existing positional event path with native point attenuation.
Protocol decoding must reject unknown event/sound variants and remain strict
about effect counts and fields.

Focused acceptance must prove: no health overflow and no red body latch on the
breaking hit; 10-tick `hitshield` throttle; pulse `3 -> ...` on application and
`2 -> ...` on an audible hit; exactly twenty record-69 additive fades with
bounded fields; one record-49 active shell with the stock formula; first-hit
Skeleton-family/Zombie sounds and 20-tick suppression; once-only replicated
playback; and no invented Air/Water/Earth contact cue. Final completion also
requires Windows-side focused/canonical tests plus a real browser/Web Audio
receipt on the exact final tree.

## Website closure and Windows browser receipt

Protocol 21 closes this presenter as one host-owned system. The replicated
living actor now carries the shield pulse and cue cooldown, while the retained
enemy-event lane carries host-selected hurt/shield cue IDs and pitch. Damage
returns its semantic events to the spell tick that accepted it. The positive
shield branch absorbs the complete invocation, leaves body health and the
ordinary damage latch untouched, publishes the throttled hit cue, and on the
break edge publishes the pop cue plus twenty host-authored effect entities.
Mage ally selection now mirrors the native type gate: only Skeleton, Archer,
and Zombie are candidates, while the separate self-shield lane remains Mage
owned.
The integrated low-mana and enemy-damage changes each extend the protocol-19
wire schema, so their combined contract advances past either independently
authored protocol-20 shape to protocol 21.
The strict protocol accepts the shield break's `1.25` maximum alpha only for
the exact additive BadGuys[69] fade shape; every other existing effect shape
retains its prior maximum of one.

The renderer now plans exactly one BadGuys[49] active shell from the native
pulse/light/sine formula and no longer copies the enemy body layers as a glow.
It also excludes a shield-only contact from the body-red redraw. The unchanged
retail WAVs are shipped through the existing point-audio path:

| Cue | Bytes | SHA-256 |
| --- | ---: | --- |
| `bone-crack.wav` | 6,652 | `9b42d96a3d505cc1d631d43b6fde4b7fb9670ed2fa758a7692207f2c514047c4` |
| `hit-shield.wav` | 4,348 | `ad5a4870955e5393c17a03c847af274f7a054b62a4c712582206623d1d92ad3f` |
| `pop-shield.wav` | 6,152 | `b4d6bf4d9a68f11bab92def6e823a53f6b8534c49b96e80bbf25d99972af2503` |
| `zombie-ouch.wav` | 10,930 | `db5400fa0d40ec3507d56d6d29c77ca23dfff4686abe97193b13945da0772d32` |

Focused coverage exercises every implemented family disposition, the first
and suppressed Skeleton/Zombie cue edges (including first-hit lethal), silent
Coffin/Demon/Imp/Wraith body hits, shield application and decay, the exact
10-tick cue replay edge, the complete eligible/ineligible Mage shield target
set, no overflow/latch, all twenty break rows, strict protocol bounds, the
active shell, event retention, and decoded audio. The exact integrated Windows
full gate covers 23 backend/contract tests, 738
frontend/Boneyard tests, five desktop tests, lint/import boundaries, the
production build, and media policy; the focused ten-file enemy-damage set
covers 164 tests.

The decisive two-client Windows Chrome `151.0.7922.138` journey ran on
2026-08-15 from current origin/main `f3944f2` plus this exact change set with
`smoke-multiplayer-combat-lifecycle.mjs --feature-only`. It completed the real
menu, physical gate, Solomon proximity, Skeleton kill, shared picker barrier,
and ordinary browser combat in run `926b752a48f6ff15093f5aa839570c99` with
empty console/page-error arrays. To isolate one shield damage invocation, the
receipt armed a reachable actor at
`1/1024` shield health and published down/up through the browser input listener
in one task; those commands still traversed client tick sequencing, WebSocket,
the host simulation, replication, both renderers, and both Web Audio contexts.
It proved:

- actor 11 was armed at authoritative tick `19846` and broke at the
  presentation sample for tick `19880.839999997617`, retained body health
  `2.5 -> 2.5`, retained its prior body damage owner/tick latch, and ended with
  current/maximum shield zero;
- both peers observed the identical twenty effect IDs `21..40`; sampled alpha
  spanned `0.25..0.8984296876191366` and every row was the
  additive BadGuys[69] fade;
- both peers decoded `hit-shield` at `0.8373821377754211` and `pop-shield` at
  the exact serialized native float `0.800000011920929`;
- the later ordinary Air contact remained separately visible, actor 11 health
  changed `2.5 -> 2.464638671875007`, and the positive body-red latch sampled
  at `0.7099999999998545`;
- the terminal Skeleton path played `bone-crack` and `skeleton-die`, preserved
  its twenty independent death-effect actors through the picker barrier, and
  retired them on both presentation timelines.

The visual receipts are under
`C:/Users/User/AppData/Local/Temp/solomon-dark-enemy-damage-browser-receipt-final2-20260815`:

- active shield: `solomon-dark-multiplayer-enemy-shield.png`, SHA-256
  `605aafcc626184e98c5339a8e5f77bd3a8422b9b9ee4b2a3bef74a892713d0b4`;
- shield break: `solomon-dark-multiplayer-enemy-shield-break.png`, SHA-256
  `60da7fbed999d96b0118bd64b45cdd5666dace0059275e99192cab163eecdf94`;
- ordinary body hit: `solomon-dark-multiplayer-enemy-hit.png`, SHA-256
  `ac5138c1bf66f6bc7f267f689bd3a745e19971df0ee2dbc0e595ad10dead8548`;
- shared picker and waiting frames: SHA-256
  `a42ad1d8a48f6e5af7aa9f85659311023813a24d167ad2625d92910ac734af77`
  and `27f6ab7e3d64e455956f33daa286378539c6dd938430f8a2c88de56e65fe29eb`.

There are no browser-platform approximations or undisposed members inside the
implemented Website enemy-damage presenter. The separately documented Imp
materialization phase and the remaining numeric death-effect physics are not
producers in this system and remain outside this closure.
