import type { BoneyardLootEventSnapshot } from './protocol/game-state.ts'

export const NATIVE_LOOT_MESSAGE_INITIAL_LIFETIME = Math.fround(1.5)
export const NATIVE_LOOT_MESSAGE_LIFETIME_LOSS = Math.fround(0.005000000074505806)
export const NATIVE_LOOT_MESSAGE_INITIAL_OFFSET = Math.fround(-18)
export const NATIVE_LOOT_MESSAGE_RISE_PER_TICK = Math.fround(1)
export const NATIVE_LOOT_MESSAGE_INSERT_SHIFT = Math.fround(4)
export const NATIVE_LOOT_MESSAGE_INSERT_LIFETIME_LOSS = Math.fround(0.10000000149011612)
export const NATIVE_LOOT_MESSAGE_SCALE_DENOMINATOR = Math.fround(250)

interface NativeLootMessageState {
  readonly eventId: number
  readonly lifetime: number
  readonly offset: number
  readonly text: string
  readonly tint: number
}

export interface NativeLootMessageVisual extends NativeLootMessageState {
  readonly alpha: number
  readonly scale: number
}

export class NativeLootMessagePresentation {
  private activeEventId: number | null = null
  private lastTick: number
  private messages: NativeLootMessageState[] = []

  constructor(initialTick: number) {
    this.lastTick = initialTick
  }

  consume(event: BoneyardLootEventSnapshot): boolean {
    if (event.text === undefined) return false
    this.advance(Math.max(this.lastTick, event.tick - 1))
    const gold = goldAmount(event.text)
    const activeIndex = this.messages.findIndex(({ eventId }) => eventId === this.activeEventId)
    const active = activeIndex < 0 ? undefined : this.messages[activeIndex]
    const activeGold = active === undefined ? null : goldAmount(active.text)
    if (gold !== null && active && activeGold !== null && active.lifetime > 1) {
      this.messages[activeIndex] = {
        ...active,
        lifetime: NATIVE_LOOT_MESSAGE_INITIAL_LIFETIME,
        text: `${activeGold + gold} GOLD`,
      }
      return true
    }

    if (active && active.offset < 0) {
      while (this.messages[activeIndex]!.offset < 0) {
        this.messages = this.messages.map((message, index) => ({
          ...message,
          lifetime: index === activeIndex
            ? message.lifetime
            : Math.fround(message.lifetime - NATIVE_LOOT_MESSAGE_INSERT_LIFETIME_LOSS),
          offset: Math.fround(message.offset + NATIVE_LOOT_MESSAGE_INSERT_SHIFT),
        }))
      }
    }
    this.messages.push(Object.freeze({
      eventId: event.eventId,
      lifetime: NATIVE_LOOT_MESSAGE_INITIAL_LIFETIME,
      offset: NATIVE_LOOT_MESSAGE_INITIAL_OFFSET,
      text: event.text,
      tint: nativeLootMessageTint(event),
    }))
    this.activeEventId = event.eventId
    return true
  }

  sample(tick: number): readonly NativeLootMessageVisual[] {
    this.advance(tick)
    return Object.freeze(this.messages.map((message) => Object.freeze({
      ...message,
      alpha: Math.min(1, Math.max(0, message.lifetime)),
      scale: Math.max(0, Math.fround(
        1 - Math.max(0, message.offset) / NATIVE_LOOT_MESSAGE_SCALE_DENOMINATOR,
      )),
    })))
  }

  private advance(tick: number): void {
    if (!Number.isSafeInteger(tick) || tick < this.lastTick) return
    for (let current = this.lastTick + 1; current <= tick; current += 1) this.step()
    this.lastTick = tick
  }

  private step(): void {
    const activeIndex = this.messages.findIndex(({ eventId }) => eventId === this.activeEventId)
    if (activeIndex >= 0 && this.messages[activeIndex]!.offset < 0) {
      let remaining = this.messages.length
      this.messages = this.messages.map((message, index) => {
        const minimumLifetime = Math.fround(1 - remaining * Math.fround(0.40000000596046448))
        remaining -= 1
        return {
          ...message,
          lifetime: index === activeIndex
            ? message.lifetime
            : Math.max(
                minimumLifetime,
                Math.fround(message.lifetime - Math.fround(0.02500000037252903)),
              ),
          offset: Math.fround(message.offset + NATIVE_LOOT_MESSAGE_RISE_PER_TICK),
        }
      })
    }
    this.messages = this.messages.flatMap((message) => {
      const lifetime = Math.fround(message.lifetime - NATIVE_LOOT_MESSAGE_LIFETIME_LOSS)
      return lifetime > 0 ? [{ ...message, lifetime }] : []
    })
    if (!this.messages.some(({ eventId }) => eventId === this.activeEventId)) {
      this.activeEventId = null
    }
  }
}

function goldAmount(text: string): number | null {
  const match = /^(\d+) GOLD$/u.exec(text)
  if (!match) return null
  const value = Number.parseInt(match[1]!, 10)
  return Number.isSafeInteger(value) ? value : null
}

function nativeLootMessageTint(event: BoneyardLootEventSnapshot): number {
  if (event.sound === 'pickup-coin' || event.text === 'DAMAGE x4') return 0xd9ba70
  if (event.text === 'BONUS SKILL POINT') return 0xff8080
  if (event.text?.endsWith(' +1')) return 0x80ffff
  return 0xffffff
}
