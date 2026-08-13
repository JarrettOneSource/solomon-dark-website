import { useEffect, useState } from 'react'
import { hub } from '../lib/assets'
import type { WizardElement } from './core-kernels/player-character.ts'

const XP_PROGRESS = 0.45

interface GameHudProps {
  element: WizardElement
  getPingMs: () => number | null
  mapLabel?: string
  mode?: 'hub' | 'run'
  onMapClick?: () => void
  subscribePing: (listener: (pingMs: number) => void) => () => void
}

function HudSlot({ src }: { src: string }) {
  return <img className="hub-hud-slot" src={src} alt="" />
}

function InventoryCount({ count, variant }: { count: number; variant: 'blue' | 'red' }) {
  return (
    <span
      className={`hub-hud-count hub-hud-count-${variant}`}
      style={{
        backgroundImage: `url("${hub.hud.inventoryDigits}")`,
        backgroundPosition: `${-count * 8}px 0`,
      }}
      aria-hidden
    />
  )
}

function FpsCounter() {
  const [fps, setFps] = useState<number | null>(null)

  useEffect(() => {
    let animationFrame = 0
    let frameCount = 0
    let sampleStartedAt = performance.now()

    const sample = (now: number) => {
      frameCount += 1

      const elapsed = now - sampleStartedAt
      if (elapsed >= 1_000) {
        setFps(Math.round(frameCount * 1_000 / elapsed))
        frameCount = 0
        sampleStartedAt = now
      }

      animationFrame = requestAnimationFrame(sample)
    }

    animationFrame = requestAnimationFrame(sample)
    return () => cancelAnimationFrame(animationFrame)
  }, [])

  return (
    <span
      className="hub-hud-fps"
      aria-label={fps === null ? 'Measuring frames per second' : `${fps} frames per second`}
    >
      {fps ?? '--'} FPS
    </span>
  )
}

function PingCounter({
  getPingMs,
  subscribePing,
}: Pick<GameHudProps, 'getPingMs' | 'subscribePing'>) {
  const [pingMs, setPingMs] = useState<number | null>(() => getPingMs())

  useEffect(() => {
    setPingMs(getPingMs())
    return subscribePing(setPingMs)
  }, [getPingMs, subscribePing])

  return (
    <span
      className="hub-hud-ping"
      aria-label={pingMs === null ? 'Measuring network ping' : `${pingMs} milliseconds ping`}
    >
      {pingMs ?? '--'} ms
    </span>
  )
}

export default function GameHud({
  element,
  getPingMs,
  mapLabel = 'Map',
  mode = 'hub',
  onMapClick,
  subscribePing,
}: GameHudProps) {
  return (
    <div className="hub-hud" aria-label="Player status">
      <img className="hub-hud-skull" src={hub.hud.skull} alt="Menu" />
      <div className="hub-hud-diagnostics" aria-label="Performance">
        <FpsCounter />
        <PingCounter getPingMs={getPingMs} subscribePing={subscribePing} />
      </div>
      <div className="hub-hud-meters">
        <div className="hub-hud-meter hub-hud-meter-health">
          <img src={hub.hud.barRed} alt="Health 50 of 50" />
        </div>
        <div className="hub-hud-meter hub-hud-meter-mana">
          <img src={hub.hud.barBlue} alt="Mana 100 of 100" />
        </div>
      </div>
      <img className="hub-hud-primary" src={hub.primary[element]} alt={`${element} primary spell`} />
      {mode === 'hub' ? (
        <img className="hub-hud-help" src={hub.hud.help} alt="Help" />
      ) : null}

      <div className="hub-hud-secondary" aria-label="Acid Rain, right mouse button">
        <img className="hub-hud-secondary-ability" src={hub.hud.secondaryAcidRain} alt="Acid Rain" />
        <img className="hub-hud-secondary-mouse" src={hub.hud.mouseRight} alt="Right mouse button" />
      </div>

      {mode === 'hub' ? (
        <div className="hub-hud-loadout" aria-label="Equipped spells">
          <HudSlot src={hub.hud.npcs.annalist} />
          <HudSlot src={hub.hud.npcs.perkWitch} />
          <HudSlot src={hub.hud.npcs.items} />
          <HudSlot src={hub.hud.npcs.potion} />
          <HudSlot src={hub.hud.npcs.teacher} />
        </div>
      ) : null}

      <div className="hub-hud-inventory" aria-label="Inventory shortcuts">
        <img className="hub-hud-potion hub-hud-potion-red" src={hub.hud.potionRed} alt="3 health potions" />
        <InventoryCount count={3} variant="red" />
        <img className="hub-hud-backpack" src={hub.hud.backpack} alt="Backpack" />
        <div
          className="hub-hud-xp"
          role="progressbar"
          aria-label="Experience"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={XP_PROGRESS * 100}
        >
          <img
            className="hub-hud-xp-fill"
            src={hub.hud.xpFill}
            style={{ clipPath: `inset(${XP_PROGRESS * 100}% 0 0)` }}
            alt=""
          />
          <img className="hub-hud-xp-frame" src={hub.hud.xpFrame} alt="" />
        </div>
        <img className="hub-hud-tome" src={hub.hud.tome} alt="Spellbook" />
        <img className="hub-hud-potion hub-hud-potion-blue" src={hub.hud.potionBlue} alt="4 mana potions" />
        <InventoryCount count={4} variant="blue" />
      </div>

      {mode === 'hub' ? (
        <button
          type="button"
          className="hub-hud-map"
          aria-label={mapLabel}
          onClick={onMapClick}
        >
          <img className="hub-hud-map-parchment" src={hub.hud.parchment} alt="" />
          <img
            className="hub-hud-map-state"
            src={hub.hud.mapCompass}
            alt=""
          />
        </button>
      ) : null}
    </div>
  )
}
