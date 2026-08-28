import type { HubParticipantState } from './hub-regions.ts'

/**
 * `collegeIntro === null` only acknowledges the Arch dialogue. The exact
 * Office-to-Courtyard incoming transition is the first authoritative state
 * that can exist only after loadout confirmation; the broader pending bit is
 * retained until that entrance settles.
 */
export function hubCollegeAdmissionPreLoadout(
  participant: HubParticipantState | undefined,
  collegeIntroPending: boolean,
): boolean {
  const transition = participant?.transition
  return collegeIntroPending && !(
    transition?.phase === 'incoming'
    && transition.sourceRegion === 'office'
    && transition.destination === 'courtyard'
  )
}

export function hubCollegeAdmissionPrimaryUnset(
  participant: HubParticipantState | undefined,
  collegeIntroPending: boolean,
): boolean {
  return participant !== undefined
    && hubCollegeAdmissionPreLoadout(participant, collegeIntroPending)
    && (
      participant.collegeIntro !== null
      || participant.region === 'office'
      || participant.transition?.phase === 'college-loadout'
      || participant.transition?.sourceRegion === 'office'
    )
}
