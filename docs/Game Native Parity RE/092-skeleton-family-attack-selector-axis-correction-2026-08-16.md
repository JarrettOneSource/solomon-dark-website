# Skeleton-family attack selector-axis correction — 2026-08-16

## Production reproduction and falsified causes

The reported production symptom is reproducible on the deployed Website tree
`39d7c97207e18fda7c74cd15ec15ed774867e4e6`. The public `/game` HTML and
`assets/Game-BoKTP6IW.js` match the deployment host byte for byte, protocol 27
is accepted, and a live WebSocket sample advances one Skeleton claw-A action
from progress `0` to `5.375` without page, console, or wire errors. A fixed
camera capture of that same actor changed only marginally (SSIM `0.998026`,
PSNR `44.691 dB`). CI/CD, stale HTML, a stale service worker, protocol
rejection, and missing action replication are therefore falsified. The defect
is in the shared Skeleton-family presentation/state boundary.

## Native selector ownership and complete membership

Fresh instruction extraction from retail Beta 0.72.5 `SolomonDark.exe`,
SHA-256
`03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`,
shows that all three family renderers load and truncate two independent actor
fields. Skeleton `0x0048DFF0/0x0048DFFB`, Archer
`0x0048F5CA/0x0048F5D5`, and Mage `0x0049185A/0x00491865` use `+0x144` for
the shared limb vector at BadGuys owner `+0x49DC`, then use `+0x150` for the
family body vector. Skeleton weapon overlays reuse the `+0x150` selector.
Action ticks write only `+0x150`; ordinary movement advances `+0x144`.

The correction covers every reachable member of this shared system:

| Family/action | Body/action selectors | Native body/equipment bank |
| --- | --- | --- |
| unarmored Skeleton claw | `[4,5,6,7,8,9,10,11]` | body `1117..1332`, 12 poses |
| armored Skeleton claw | `[2,3,4,5,6,7,8,9]` | body `613..774`, 9 authored poses |
| ordinary Skeleton weapon | `[1 x8,2,3 x8,2 x4,1 x4]` | body `1333..1404` or `919..990`; matching overlay `1045..1116`, `847..918`, or `775..846` |
| Skeleton pike | `[1,2 x11,1]` | body `1405..1458` or `991..1044`, 3 poses |
| Archer shot | `[3,4,5,6,7,6,7,6,7,6,7,6,7,8,8,8,8]` | body `451..612`, 9 poses |
| Mage short/long cast | recovered 42/48-entry cast arrays | body `1729..1818`, 5 poses |

Every row continues to draw limbs as
`1585 + 18*trunc(+0x144) + facing`; an action-array index must never replace
that gait selector. The claw table is chosen by the live armor byte `+0x233`,
not actor identity: zero selects the unarmored table and one selects the
armored table. The shipped armored selector 9 reaches the vector range guard;
the vector grows a zeroed Sprite, so that final torso slot is intentionally
blank. It must not clamp to pose 8 or alias adjacent weapon record 775.

## Authority and lifecycle contract

Badguy construction initializes `+0x150` to zero; Mage construction replaces
it with `RandomInt(2)`. The authoritative fixed tick retains this body pose as
actor state. Claw completion writes its wrapped first selector, ordinary
weapon completion writes selector 1, while Pike and Archer completion retain
their last written selector and Mage completes on selector 0. Cancellation
also retains the last write. Snapshot projection carries that discrete state;
the client may interpolate action progress but must not derive body pose from
gait or interpolate selector identity. The renderer alone maps gait and body
selectors to native records.

## Pre-implementation acceptance contract

- Renderer tests must hold gait and action progress at deliberately different
  values and prove independent limb/body selection for both claw armor tables,
  ordinary weapons, Pike, Archer shot, and both Mage casts.
- Skeleton equipment must use exactly the same body/action selector as its
  torso. The armored-claw selector-9 sample must omit only the blank torso
  while preserving limbs and headgear.
- Server tests must prove armor-owned claw program selection, constructor and
  completion body-pose lifetime, and Mage pose ownership. Timeline tests must
  prove body selectors remain discrete between authoritative snapshots.
- The exact tree must pass `./scripts/validate.sh` and a fixed-camera real
  Chromium attack receipt on the Mac mini. The final production receipt must
  observe a deployed action progressing through visibly different torso
  records with no page, console, wire, or failed-response errors.
