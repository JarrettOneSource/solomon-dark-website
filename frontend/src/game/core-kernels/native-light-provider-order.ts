export const NATIVE_LIGHT_MANAGER_LANES = ['actor', 'transient'] as const

export type NativeLightManagerLane = typeof NATIVE_LIGHT_MANAGER_LANES[number]

export interface NativeLightProviderRegistration {
  readonly managerLane: NativeLightManagerLane
  readonly registrationOrdinal: number
}

export interface NativeLightProviderOrderState {
  readonly nextRegistrationOrdinal: Readonly<Record<NativeLightManagerLane, number>>
}

export interface NativeLightProviderOrder {
  register(managerLane: NativeLightManagerLane): NativeLightProviderRegistration
  state(): NativeLightProviderOrderState
}

export interface DeferredNativeLightProviderRegistrations {
  commit(order: NativeLightProviderOrder): void
  register(managerLane: NativeLightManagerLane): NativeLightProviderRegistration
}

export type RegisterNativeLightProvider = NativeLightProviderOrder['register']

export function createNativeLightProviderOrder(
  source: NativeLightProviderOrderState = {
    nextRegistrationOrdinal: { actor: 0, transient: 0 },
  },
): NativeLightProviderOrder {
  const nextRegistrationOrdinal = {
    actor: validatedOrdinal(source.nextRegistrationOrdinal.actor),
    transient: validatedOrdinal(source.nextRegistrationOrdinal.transient),
  }
  return {
    register(managerLane) {
      const registrationOrdinal = nextRegistrationOrdinal[managerLane]
      nextRegistrationOrdinal[managerLane] += 1
      return Object.freeze({ managerLane, registrationOrdinal })
    },
    state() {
      return Object.freeze({
        nextRegistrationOrdinal: Object.freeze({ ...nextRegistrationOrdinal }),
      })
    },
  }
}

export function createDeferredNativeLightProviderRegistrations(): DeferredNativeLightProviderRegistrations {
  const pending: Array<{
    managerLane: NativeLightManagerLane
    setRegistrationOrdinal(value: number): void
  }> = []
  let committed = false
  return {
    commit(order) {
      if (committed) throw new Error('native light-provider registrations are already committed')
      committed = true
      for (const registration of pending) {
        registration.setRegistrationOrdinal(
          order.register(registration.managerLane).registrationOrdinal,
        )
      }
    },
    register(managerLane) {
      if (committed) throw new Error('native light-provider registrations are already committed')
      let registrationOrdinal: number | null = null
      pending.push({
        managerLane,
        setRegistrationOrdinal(value) {
          registrationOrdinal = value
        },
      })
      return Object.freeze({
        managerLane,
        get registrationOrdinal() {
          if (registrationOrdinal === null) {
            throw new Error('native light-provider registration has not been committed')
          }
          return registrationOrdinal
        },
      })
    },
  }
}

export function mergeNativeLightProviderOwners<T>(
  groups: readonly (readonly T[])[],
  registrationOf: (owner: T) => NativeLightProviderRegistration,
): readonly T[] {
  return groups
    .flatMap((group) => group)
    .map((owner, sourceOrdinal) => ({
      owner,
      registration: registrationOf(owner),
      sourceOrdinal,
    }))
    .sort((first, second) => (
      laneOrdinal(first.registration.managerLane)
      - laneOrdinal(second.registration.managerLane)
      || first.registration.registrationOrdinal
      - second.registration.registrationOrdinal
      || first.sourceOrdinal - second.sourceOrdinal
    ))
    .map(({ owner }) => owner)
}

function laneOrdinal(managerLane: NativeLightManagerLane): number {
  return managerLane === 'actor' ? 0 : 1
}

function validatedOrdinal(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('native light-provider registration ordinal must be nonnegative')
  }
  return value
}
