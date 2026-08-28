# 2026-08-22 — Party-directory active-run visibility

## Reported smell and parity question

- Requested web behavior: a listed party must remain visible in every party
  browser while it is playing, with its current Boneyard and squad size shown,
  but it must not be joinable until it returns to the College.
- This is a Website social extension. The retail executable has no Website
  party directory, public visibility, browser admission, or equivalent authored
  UI, so this entry makes no native-parity claim for the product rule.
- Current causal trace at `origin/main` `db3c1f4f`: the host already retains
  party membership during `SharedPartyRun`, projects `status: playing` plus the
  loaded Boneyard name, and the supervisor rejects all playing-party resolution
  and admission. Dark Cloud renders the state and Boneyard. The Play wrapper
  renders only a disabled `IN GAME` button, omits the Boneyard, and hides its
  separate squad-size cell on narrow/mobile layouts. Dark Cloud's selected-row
  footer is disabled but still says `JOIN PARTY`.

## Evidence and provenance

| Evidence class | Exact source | Observation | Confidence |
| --- | --- | --- | --- |
| Host state trace | `shared-game-worlds.ts`, `game-host.ts`, `public-party-directory.ts` at `db3c1f4f` | Starting a run partitions players out of the Hub but retains `PartyMembership`; the directory joins membership to `SharedPartyRun` by internal party id and emits the loaded choice name. | high |
| Supervisor/API trace | `game-session-supervisor.ts`, `GameSessionProvisioner.cs`, `api.ts` at `db3c1f4f` | Directory reads allow `hub` and `playing`; resolve, request, accepted-request, and final-admit seams all require `status === hub`. The backend does not yet require a nonblank Boneyard name for a `playing` DTO. | high |
| Presentation trace | `JoinPartyScene.tsx`, `join-party.css`, `DarkCloudScene.tsx`, `dark-cloud.css` at `db3c1f4f` | Both wrappers consume the same poller/action classifier. Only Dark Cloud shows location; Play hides squad size on small screens; Dark Cloud's footer label omits the `wait` branch. | high |
| Stock boundary | retail executable SHA-256 `03a834566ce70fd8088f4cf9ee6693157130d8aec28c092cb814d6221231f1e3`; preceding Party-ID ownership entry | Stock has no corresponding public browser data or action contract to extract. | high |

No new executable instruction, runtime address, asset, or reusable native fact
is involved, so no Mod Loader report or catalog changes ownership in this pass.

## System boundary and membership inventory

System: **public party directory projection, presentation, and admission gate**,
from authoritative visibility/run state through both browser wrappers and every
join seam. Party membership mutation, run simulation, and private-College
discovery remain outside this presentation correction.

| Member (scene/branch) | Source | Disposition | Proof contract |
| --- | --- | --- | --- |
| Public party in College | host projection and `directoryPartyAction` | `out-of-system` (Website product policy) | Listed with `IN HUB`, courtyard, squad size; direct join enabled. |
| Invite-only party in College | same shared projection | `out-of-system` (Website product policy) | Listed with `IN HUB`, courtyard, squad size; request enabled. |
| Public party in Boneyard | membership/run join | `out-of-system` (Website product policy) | Remains listed with `IN GAME`, exact Boneyard, squad size; no action. |
| Invite-only party in Boneyard | membership/run join | `out-of-system` (Website product policy) | Remains listed with the same run truth; no request action. |
| Private party, Hub or Boneyard | visibility filter | `out-of-system` (Website privacy policy) | Never listed. |
| Play -> Join Party, desktop and mobile | `JoinPartyScene.tsx`, `join-party.css` | `out-of-system` (Website presentation) | Status, Boneyard/courtyard, and squad size remain visible; playing control is disabled. |
| Dark Cloud -> Parties, desktop and mobile | `DarkCloudScene.tsx`, `dark-cloud.css` | `out-of-system` (Website presentation) | Row and selected footer both name the nonjoinable state; Boneyard and squad stay visible. |
| Public resolve and invite-only request | supervisor resolve/request handlers | `out-of-system` (Website admission) | Playing target returns conflict without minting an intent/request. |
| Accepted request and final admission race | request-status/admit handlers | `out-of-system` (Website admission) | A party that starts after discovery/approval is rejected before a ticket or reservation is consumed. |
| Run completion, disconnect, visibility change | shared-world and party lifecycles | `out-of-system` (Website lifecycle) | Return restores `IN HUB`; removal/visibility updates remove or reclassify the same listing on the next poll. |

## Ownership and behavioral contract

- `GameHost` is the sole producer of directory truth. It pairs the retained
  party membership with the active run and never infers playing state in a
  browser. The Website backend validates and relays only the bounded DTO.
- A playing listing must have a nonblank Boneyard name. A Hub listing must have
  no Boneyard name. Both carry current member count and host capacity.
- Public/invite-only visibility controls discoverability independent of world
  state. `playing` controls admission independent of visibility: every visual
  action is disabled and every server admission seam fails closed.
- Both visual owners must present the same status/location/squad truth at every
  supported viewport. Polling and run teardown naturally transition the row
  back to `IN HUB`; no client timer guesses run lifetime.

## Web implementation consequence

- Retain the host projection and supervisor admission rules; do not filter
  active runs or create a spectator/join path.
- Make the backend DTO validator enforce the status/Boneyard relationship.
- Add status and Boneyard/courtyard copy to the Play wrapper and keep its squad
  size visible on mobile. Make Dark Cloud's selected footer explicitly say
  `IN GAME` for the shared `wait` action.
- Keep private parties filtered and keep the two visual wrappers over the same
  headless directory/action owner.

## Validation contract

- Focused tests cover public and invite-only `playing -> wait`, the complete
  host projection with exact Boneyard/squad data, backend DTO invariants, both
  wrappers' status/location/count output, and disabled row/footer actions.
- Run the canonical `./scripts/validate.sh` gate on the exact Website tree.
- Browser acceptance opens both party views with one active listed run and
  proves the same party, Boneyard, squad size, and disabled admission at desktop
  and mobile dimensions, with no page, console, request, protocol, or asset
  errors.

## Implementation validation receipt

- The existing authoritative host projection remains the directory owner. A
  focused supervisor journey starts a real shared-Hub party run, reads the same
  party back as `status: playing` with its exact Boneyard and member count, and
  receives `409` when it attempts public admission during the run. Public and
  invite-only presentation both map `playing` to the shared `wait` action;
  private visibility remains filtered.
- `PublicGameParty` now expresses the Hub/null-Boneyard and
  playing/named-Boneyard states as a discriminated contract. The Website
  backend independently rejects playing rows with null/blank names and Hub rows
  carrying a Boneyard. Both visual owners consume one status/location/squad
  presenter. Play -> Join Party keeps all three values visible on mobile, and
  Dark Cloud labels both the row and selected footer `IN GAME` while disabling
  them. The visually discovered empty-error-row footer stretch was removed by
  assigning explicit grid areas.
- Exact-tree acceptance used Website base
  `fdcf3f2a50f9adc45a1327961670c7d4502fcfb0` plus this focused patch on
  `Jarretts-Mac-mini.local`: arm64 macOS `26.6.2`, Node `22.17.0`, npm
  `10.9.2`, .NET `10.0.302`, and Chrome `151.0.7922.170`. The repository's
  canonical `./scripts/validate.sh` passed backend build, `17/17` contracts,
  formatting, lint/import boundaries, every frontend group (including `43/43`
  party tests), `5/5` desktop tests, production builds, media policy, and the
  game bundle budget.
- Mac Chrome exercised the built bundle at `1600 x 900`, `390 x 844`, and
  `844 x 390`. Dark Cloud -> Parties and Play -> Join Party each retained
  Hagatha/Luthacus, `2 / 16`, `IN GAME`, and the complete `The Survival
  Grounds` location with disabled admission. Minimum visible touch target was
  `44` CSS px, horizontal overflow was zero, and page, console, and failed
  response arrays were empty.
- Task-owned Mac captures are under
  `/Users/jarrett/.codex-evidence/party-browser-active-run-20260822/`:
  `parties-desktop.png` SHA-256
  `8b4862cceeea13c6bbc44cca8b4f1569a92963c419ab9b44a6259546549e271c`,
  `parties-mobile.png`
  `ec285c1cf9e1eaf9cb39005778dd93088799f57fe2a83ee9e616ec88fd5779d6`,
  `join-party-desktop.png`
  `630b37cf45c0644fabacab827bd4b9ee8b05aa9b31f61c738c90bc7c71a997bf`,
  and `join-party-mobile.png`
  `ba53302f4b89e37ac8020d8f53afc4eb19fa8876bca4d17719e8a33f6157f178`.
  Task-owned local and Mac servers were stopped; no platform-blocked member or
  material unknown remains. No commit, push, deployment, or production restart
  was performed.
