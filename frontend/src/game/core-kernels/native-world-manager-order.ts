export const NATIVE_WORLD_MANAGER_LANES = ['actor', 'transient'] as const

export type NativeWorldManagerLane = typeof NATIVE_WORLD_MANAGER_LANES[number]

export interface NativeWorldManagerRegistration {
  readonly managerLane: NativeWorldManagerLane
  readonly registrationOrdinal: number
}

export interface NativeWorldPainterOwner {
  readonly painterRegistrations?: readonly NativeWorldManagerRegistration[]
}

export interface NativeWorldManagerOrderState {
  readonly nextRegistrationOrdinal: Readonly<Record<NativeWorldManagerLane, number>>
}

export interface NativeWorldManagerOrder {
  register(managerLane: NativeWorldManagerLane): NativeWorldManagerRegistration
  registerMany(
    managerLane: NativeWorldManagerLane,
    count: number,
  ): readonly NativeWorldManagerRegistration[]
  state(): NativeWorldManagerOrderState
}

export interface DeferredNativeWorldManagerRegistrations {
  commit(order: NativeWorldManagerOrder): void
  register(managerLane: NativeWorldManagerLane): NativeWorldManagerRegistration
}

export type RegisterNativeWorldPainter = NativeWorldManagerOrder['register']

export function registerNativeWorldPainterRoots(
  register: RegisterNativeWorldPainter,
  managerLane: NativeWorldManagerLane,
  count = 1,
): readonly NativeWorldManagerRegistration[] {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError('native world-painter root count must be nonnegative')
  }
  return Object.freeze(Array.from({ length: count }, () => register(managerLane)))
}

export function nativeWorldPainterRegistration(
  owner: NativeWorldPainterOwner,
  rootIndex = 0,
): NativeWorldManagerRegistration {
  if (!Number.isSafeInteger(rootIndex) || rootIndex < 0) {
    throw new RangeError('native world-painter root index must be nonnegative')
  }
  const registration = owner.painterRegistrations?.[rootIndex]
  if (!registration) {
    throw new Error(`native world-painter root ${rootIndex} has no manager registration`)
  }
  return registration
}

export function createNativeWorldManagerOrder(
  source: NativeWorldManagerOrderState = {
    nextRegistrationOrdinal: { actor: 0, transient: 0 },
  },
): NativeWorldManagerOrder {
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
    registerMany(managerLane, count) {
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new RangeError('native world-manager registration count must be nonnegative')
      }
      return Object.freeze(Array.from(
        { length: count },
        () => {
          const registrationOrdinal = nextRegistrationOrdinal[managerLane]
          nextRegistrationOrdinal[managerLane] += 1
          return Object.freeze({ managerLane, registrationOrdinal })
        },
      ))
    },
    state() {
      return Object.freeze({
        nextRegistrationOrdinal: Object.freeze({ ...nextRegistrationOrdinal }),
      })
    },
  }
}

export function createDeferredNativeWorldManagerRegistrations(): DeferredNativeWorldManagerRegistrations {
  const pending: Array<{
    managerLane: NativeWorldManagerLane
    setRegistrationOrdinal(value: number): void
  }> = []
  let committed = false
  return {
    commit(order) {
      if (committed) throw new Error('native world-manager registrations are already committed')
      committed = true
      for (const registration of pending) {
        registration.setRegistrationOrdinal(
          order.register(registration.managerLane).registrationOrdinal,
        )
      }
    },
    register(managerLane) {
      if (committed) throw new Error('native world-manager registrations are already committed')
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
            throw new Error('native world-manager registration has not been committed')
          }
          return registrationOrdinal
        },
      })
    },
  }
}

export function mergeNativeWorldManagerOwners<T>(
  groups: readonly (readonly T[])[],
  registrationOf: (owner: T) => NativeWorldManagerRegistration,
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

function laneOrdinal(managerLane: NativeWorldManagerLane): number {
  return managerLane === 'actor' ? 0 : 1
}

function validatedOrdinal(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('native world-manager registration ordinal must be nonnegative')
  }
  return value
}
