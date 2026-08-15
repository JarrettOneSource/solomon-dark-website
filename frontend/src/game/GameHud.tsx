import { useEffect, useState } from 'react'
import { hub } from '../lib/assets'
import AllyHud from './AllyHud.tsx'
import type { AllyHudRow } from './ally-hud.ts'
import type { WizardElement } from './core-kernels/player-character.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'
import { playerExperienceProgress } from './core-kernels/player-progression.ts'
import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import GameAccountName from './GameAccountName.tsx'
import type { GameSnapshot } from './protocol/game-protocol.ts'

interface GameHudProps {
  accountUsername: string | null
  additionalAllyRows?: readonly AllyHudRow[]
  element: WizardElement
  getPingMs: () => number | null
  initialSnapshot: GameSnapshot
  mapLabel?: string
  mode?: 'hub' | 'run'
  onMapClick?: () => void
  playerId: string
  progression: ProtocolPlayerProgression
  subscribePing: (listener: (pingMs: number) => void) => () => void
  subscribeSnapshot: (listener: (snapshot: GameSnapshot) => void) => () => void
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
    let frameIntervals = 0
    let sampleStartedAt: number | null = null

    return subscribeGamePresentationFrames((now) => {
      if (sampleStartedAt === null) {
        sampleStartedAt = now
        return
      }
      frameIntervals += 1
      const elapsed = now - sampleStartedAt
      if (elapsed >= 1_000) {
        setFps(Math.round(frameIntervals * 1_000 / elapsed))
        frameIntervals = 0
        sampleStartedAt = now
      }
    })
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
  accountUsername,
  additionalAllyRows,
  element,
  getPingMs,
  initialSnapshot,
  mapLabel = 'Map',
  mode = 'hub',
  onMapClick,
  playerId,
  progression,
  subscribePing,
  subscribeSnapshot,
}: GameHudProps) {
  const xpProgress = playerExperienceProgress(progression)
  const healthProgress = progression.currentHealth / progression.maximumHealth
  const manaProgress = progression.currentMana / progression.maximumMana
  return (
    <div className="hub-hud" aria-label="Player status">
      <img className="hub-hud-skull" src={hub.hud.skull} alt="Menu" />
      <GameAccountName placement="hud" username={accountUsername} />
      <AllyHud
        additionalRows={additionalAllyRows}
        initialSnapshot={initialSnapshot}
        playerId={playerId}
        subscribeSnapshot={subscribeSnapshot}
      />
      <div className="hub-hud-diagnostics" aria-label="Performance">
        <FpsCounter />
        <PingCounter getPingMs={getPingMs} subscribePing={subscribePing} />
      </div>
      <div className="hub-hud-meters">
        <div className="hub-hud-meter hub-hud-meter-health">
          <img
            src={hub.hud.barRed}
            style={{ clipPath: `inset(0 ${(1 - healthProgress) * 100}% 0 0)` }}
            alt={`Health ${progression.currentHealth} of ${progression.maximumHealth}`}
          />
        </div>
        <div className="hub-hud-meter hub-hud-meter-mana">
          <img
            src={hub.hud.barBlue}
            style={{ clipPath: `inset(0 ${(1 - manaProgress) * 100}% 0 0)` }}
            alt={`Mana ${progression.currentMana} of ${progression.maximumMana}`}
          />
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
          aria-valuenow={xpProgress * 100}
        >
          <img
            className="hub-hud-xp-fill"
            src={hub.hud.xpFill}
            style={{ clipPath: `inset(${(1 - xpProgress) * 100}% 0 0)` }}
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
