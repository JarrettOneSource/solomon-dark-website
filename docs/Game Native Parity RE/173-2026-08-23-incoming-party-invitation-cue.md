# 2026-08-23 — Incoming party-invitation cue

## Reported smell and parity question

- Reported web behavior: the authoritative Hub invitation toast appears with
  Accept/Deny actions but produces no audible notification.
- Requested behavior: play a small sound exactly when a new invitation is
  received.
- Stock boundary: retail has no Website party model or invitation trigger. Cue
  selection and first-seen semantics are explicit Website policy; native asset
  identity and playback class remain exact.

## Evidence, membership, and ownership

| Member | Source | Disposition | Contract |
| --- | --- | --- | --- |
| invitation creation/id/revision | `party-system.ts`, `shared-game-worlds.ts`, host party projection | verified-already-at-requested-policy | host alone introduces a unique invitation id for its recipient |
| recipient state delivery | protocol/client `LocalPartyState.invitations` | verified-already-at-requested-policy | sound derives from delivered authoritative state, never Invite-button optimism |
| new-id edge | session-owned invitation cursor | out-of-system native extension | one request per id introduced after the initial connected baseline |
| revision-only/unchanged state | same cursor | out-of-system native extension | no replay |
| accept, deny, expiry, disconnect, scene remount | existing invitation lifecycle | verified-already-at-requested-policy | removal is silent and does not re-arm an old id |
| reconnect with pending history | new session baseline | out-of-system native extension | existing ids seed the cursor and do not replay |
| simultaneous newly introduced ids | state delta | out-of-system native extension | one cue request per new id |
| cue | native registry row 0 `sounds\\click`, SHA-256 `8aeebcfeb69625bee2ee78fe9c63939e6b40edcc89d5facf2c0d35e1b5920307` | exact native asset; explicit new trigger | resident overlapping one-shot at pitch 1 and gain 1 |
| registry streams 131/150 | `MessageDone__Stream`, `yougotamessage__stream` | out-of-system | suggestive names remain unsupported by the closed native chat census |
| Pause/SkillPicker interaction | session audio mute above | out-of-system product composition | an invite received while muted is consumed silently and never queued |

No member is browser-blocked. The cursor belongs beside the session's party
state subscription so React rerenders, Hub renderer replacement, and unchanged
snapshots cannot retrigger it. Focused tests cover baseline, one/many new ids,
unchanged revisions, removal/reintroduction within a session, and session reset.
The Mac party journey must invite, observe one decoded/started `click` request,
refresh unrelated party state with no second request, deny, invite again under
a new id, and require clean browser error arrays.

## Implementation validation receipt

- `party-invitation-audio.ts` owns a bounded 128-id session cursor and the exact
  registry-zero `click` request. A nullable session cursor seeds whichever
  party-state view arrives first, so reconnect history is silent even when the
  initial state follows welcome. Revision-only updates, removal, and a recently
  seen reintroduction are inert; each genuinely new id produces one request.
- Focused party/chat coverage passed `48/48`. The built protocol-62 desktop and
  mobile journeys each observed the first invite advance the click count to
  `3` and the second to `4`, with no intervening snapshot replay. Both denial
  and later acceptance retained their existing authoritative party semantics.
- The old party smoke failed closed before feature assertions because its raw
  protocol-62 input omitted required `viewportWidth`; the harness now sends the
  strict current shape and rejects pending waits immediately on socket close.
  This changes acceptance scaffolding only, not game input behavior.
