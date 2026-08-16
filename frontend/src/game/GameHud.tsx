import { useEffect, useState } from 'react'
import { hub } from '../lib/assets'
import AllyHud from './AllyHud.tsx'
import type { AllyHudRow } from './ally-hud.ts'
import type { WizardElement } from './core-kernels/player-character.ts'
import type {
  ProtocolPlayerEconomy,
  ProtocolPlayerProgression,
} from './protocol/game-state.ts'
import { playerExperienceProgress } from './core-kernels/player-progression.ts'
import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import GameAccountName from './GameAccountName.tsx'
import SecondaryAbilityBelt from './SecondaryAbilityBelt.tsx'
import type { GameSnapshot } from './protocol/game-protocol.ts'

interface GameHudProps {
  accountUsername: string | null
  additionalAllyRows?: readonly AllyHudRow[]
  element: WizardElement
  getPingMs: () => number | null
  initialSnapshot: GameSnapshot
  mapLabel?: string
  mode?: 'hub' | 'run'
  onInventoryClick?: () => void
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
  const atlasDigit = Math.min(9, Math.max(0, count))
  return (
    <span
      className={`hub-hud-count hub-hud-count-${variant}`}
      style={{
        backgroundImage: `url("${hub.hud.inventoryDigits}")`,
        backgroundPosition: `${-atlasDigit * 8}px 0`,
      }}
      aria-label={`${count}`}
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
  onInventoryClick,
  onMapClick,
  playerId,
  progression,
  subscribePing,
  subscribeSnapshot,
}: GameHudProps) {
  const [economy, setEconomy] = useState<ProtocolPlayerEconomy>(() => (
    initialSnapshot.players[playerId]!.economy
  ))
  useEffect(() => subscribeSnapshot((snapshot) => {
    const next = snapshot.players[playerId]?.economy
    if (next) setEconomy((current) => current.revision === next.revision ? current : next)
  }), [playerId, subscribeSnapshot])
  const [secondaryHud, setSecondaryHud] = useState(() => ({
    belt: initialSnapshot.players[playerId]!.progression.secondaryBelt,
    playerState: initialSnapshot.secondaryAbilities.players[playerId],
  }))
  useEffect(() => subscribeSnapshot((snapshot) => {
    const player = snapshot.players[playerId]
    if (!player) return
    setSecondaryHud({
      belt: player.progression.secondaryBelt,
      playerState: snapshot.secondaryAbilities.players[playerId],
    })
  }), [playerId, subscribeSnapshot])
  const xpProgress = playerExperienceProgress(progression)
  const healthProgress = clampUnit(progression.currentHealth / progression.maximumHealth) ** 2
  const manaProgress = clampUnit(progression.currentMana / progression.maximumMana)
  const shieldProgress = secondaryHud.playerState === undefined
    ? 0
    : clampUnit(
        secondaryHud.playerState.magicShieldAbsorb
          / secondaryHud.playerState.magicShieldMaximum,
      )
  const reserveProgress = secondaryHud.playerState === undefined
    ? 0
    : clampUnit(secondaryHud.playerState.reservedMana / progression.maximumMana)
  const healthLayers = [
    { className: 'hub-hud-meter-fill', progress: healthProgress, shield: false },
    ...(shieldProgress > 0
      ? [{ className: 'hub-hud-meter-fill hub-hud-meter-shield', progress: shieldProgress, shield: true }]
      : []),
  ].sort((left, right) => left.progress - right.progress)
  const healthPotions = inventoryQuantity(economy, 'health-potion')
  const manaPotions = inventoryQuantity(economy, 'mana-potion')
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
          {healthLayers.map((layer) => (
            <img
              className={layer.className}
              key={layer.shield ? 'shield' : 'health'}
              src={hub.hud.barRed}
              style={{ clipPath: `inset(0 ${(1 - layer.progress) * 100}% 0 0)` }}
              alt={layer.shield
                ? `Magic shield ${secondaryHud.playerState!.magicShieldAbsorb} of ${secondaryHud.playerState!.magicShieldMaximum}`
                : `Health ${progression.currentHealth} of ${progression.maximumHealth}`}
            />
          ))}
        </div>
        <div className="hub-hud-meter hub-hud-meter-mana">
          <img
            className="hub-hud-meter-fill"
            src={hub.hud.barBlue}
            style={{ clipPath: `inset(0 ${(1 - manaProgress) * 100}% 0 0)` }}
            alt={`Mana ${progression.currentMana} of ${progression.maximumMana}`}
          />
          {reserveProgress > 0 ? (
            <span
              className="hub-hud-mana-reserve"
              style={{
                backgroundImage: `url("${hub.hud.manaReserve}")`,
                width: `${reserveProgress * 100}px`,
              }}
              aria-label={`${secondaryHud.playerState!.reservedMana} mana reserved`}
            />
          ) : null}
        </div>
      </div>
      <svg className="hub-hud-native-filters" aria-hidden>
        <filter id="hub-hud-magic-shield-tint" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.5 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"
          />
        </filter>
      </svg>
      <img className="hub-hud-primary" src={hub.primary[element]} alt={`${element} primary spell`} />
      {mode === 'hub' ? (
        <img className="hub-hud-help" src={hub.hud.help} alt="Help" />
      ) : null}

      <SecondaryAbilityBelt
        belt={secondaryHud.belt}
        mode={mode}
        playerState={secondaryHud.playerState}
      />

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
        <img className="hub-hud-potion hub-hud-potion-red" src={hub.hud.potionRed} alt={`${healthPotions} health potions`} />
        <InventoryCount count={healthPotions} variant="red" />
        <button
          type="button"
          className="hub-hud-backpack-button"
          aria-label={`Open inventory, ${economy.gold} gold`}
          disabled={!onInventoryClick}
          onClick={onInventoryClick}
        >
          <img className="hub-hud-backpack" src={hub.hud.backpack} alt="" />
        </button>
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
        <img className="hub-hud-potion hub-hud-potion-blue" src={hub.hud.potionBlue} alt={`${manaPotions} mana potions`} />
        <InventoryCount count={manaPotions} variant="blue" />
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

function inventoryQuantity(
  economy: ProtocolPlayerEconomy,
  kind: 'health-potion' | 'mana-potion',
): number {
  return economy.backpack.reduce((total, item) => (
    item.kind === kind ? total + item.quantity : total
  ), 0)
}

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}
