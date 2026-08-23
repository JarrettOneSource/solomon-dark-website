import { useEffect, useState, type CSSProperties } from 'react'

import { useCoarsePointer } from './input/use-coarse-pointer.ts'
import { hub } from '../lib/assets'
import AllyHud from './AllyHud.tsx'
import type { AllyHudRow } from './ally-hud.ts'
import type {
  ProtocolPlayerEconomy,
  ProtocolPlayerProgression,
} from './protocol/game-state.ts'
import {
  NATIVE_SKILL_CATALOG,
  playerExperienceProgress,
} from './core-kernels/player-progression.ts'
import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import GameAccountName from './GameAccountName.tsx'
import { hubPotionShortcut } from './hub-inventory-presentation.ts'
import SkillQuickbar, { NativeSkillIcon } from './SkillQuickbar.tsx'
import type { GameSnapshot } from './protocol/game-protocol.ts'
import type { GameControlBindings } from './game-settings.ts'
import {
  nativeHealthHudPresentation,
  nativeHudLeftOriginClipPath,
  nativeHudSkillBindings,
  nativeManaHudPresentation,
} from './native-hud-presentation.ts'

interface GameHudProps {
  accountUsername: string | null
  additionalAllyRows?: readonly AllyHudRow[]
  /** Touch: hide the ally roster while the Hub party column is open under the chip. */
  allyRosterHidden?: boolean
  controls: GameControlBindings
  getPingMs: () => number | null
  initialSnapshot: GameSnapshot
  mapLabel?: string
  mode?: 'hub' | 'run'
  onInventoryClick?: () => void
  onMapClick?: () => void
  onMenuClick?: () => void
  onPotionClick?: (itemId: number) => void
  onQuickbarInput?: (slot: number, pressed: boolean) => void
  partyMemberIds?: readonly string[]
  onSkillsClick?: () => void
  playerId: string
  progression: ProtocolPlayerProgression
  subscribePing: (listener: (pingMs: number) => void) => () => void
  subscribeSnapshot: (listener: (snapshot: GameSnapshot) => void) => () => void
  uiScale: number
  viewport: Readonly<{ height: number; width: number }>
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
  allyRosterHidden,
  controls,
  getPingMs,
  initialSnapshot,
  mapLabel = 'Map',
  mode = 'hub',
  onInventoryClick,
  onMapClick,
  onMenuClick,
  onPotionClick,
  onQuickbarInput,
  partyMemberIds,
  onSkillsClick,
  playerId,
  progression,
  subscribePing,
  subscribeSnapshot,
  uiScale,
  viewport,
}: GameHudProps) {
  const coarsePointer = useCoarsePointer()
  const [economy, setEconomy] = useState<ProtocolPlayerEconomy>(() => (
    initialSnapshot.players[playerId]!.economy
  ))
  useEffect(() => subscribeSnapshot((snapshot) => {
    const next = snapshot.players[playerId]?.economy
    if (next) setEconomy((current) => current.revision === next.revision ? current : next)
  }), [playerId, subscribeSnapshot])
  const [quickbarHud, setQuickbarHud] = useState(() => ({
    concentrationSkillIds: initialSnapshot.players[playerId]!.progression.concentrationSkillIds,
    playerState: initialSnapshot.secondaryAbilities.players[playerId],
    quickbar: initialSnapshot.players[playerId]!.progression.skillQuickbar,
    selectedPrimarySkillId: initialSnapshot.players[playerId]!.progression.selectedPrimarySkillId,
    weldBuildId: initialSnapshot.players[playerId]!.progression.weldBuildId,
  }))
  useEffect(() => subscribeSnapshot((snapshot) => {
    const player = snapshot.players[playerId]
    if (!player) return
    setQuickbarHud({
      concentrationSkillIds: player.progression.concentrationSkillIds,
      playerState: snapshot.secondaryAbilities.players[playerId],
      quickbar: player.progression.skillQuickbar,
      selectedPrimarySkillId: player.progression.selectedPrimarySkillId,
      weldBuildId: player.progression.weldBuildId,
    })
  }), [playerId, subscribeSnapshot])
  const xpProgress = playerExperienceProgress(progression)
  const healthHud = nativeHealthHudPresentation(
    progression.currentHealth,
    progression.maximumHealth,
    quickbarHud.playerState?.magicShieldAbsorb ?? 0,
    quickbarHud.playerState?.magicShieldMaximum ?? 0,
  )
  const manaHud = nativeManaHudPresentation(
    progression.currentMana,
    progression.maximumMana,
    quickbarHud.playerState?.reservedMana ?? 0,
  )
  const healthLayers = [
    { className: 'hub-hud-meter-fill', progress: healthHud.fillProgress, shield: false },
    ...(healthHud.shieldProgress > 0
      ? [{ className: 'hub-hud-meter-fill hub-hud-meter-shield', progress: healthHud.shieldProgress, shield: true }]
      : []),
  ].sort((left, right) => left.progress - right.progress)
  const skillBindings = nativeHudSkillBindings({
    concentrationSkillIds: quickbarHud.concentrationSkillIds,
    planewalkerActive: (quickbarHud.playerState?.planewalkerTicksRemaining ?? 0) > 0,
    selectedPrimarySkillId: quickbarHud.selectedPrimarySkillId,
    weldBuildId: quickbarHud.weldBuildId,
  })
  const healthPotions = hubPotionShortcut(economy.backpack, 'health-potion')
  const manaPotions = hubPotionShortcut(economy.backpack, 'mana-potion')
  return (
    <div
      className="hub-hud"
      aria-label="Player status"
      data-ui-scale={uiScale}
      style={{
        '--game-ui-scale': uiScale,
        height: viewport.height / uiScale,
        inset: 'auto',
        left: viewport.width / 2,
        top: viewport.height / 2,
        transform: `translate(-50%, -50%) scale(${uiScale})`,
        transformOrigin: 'center',
        width: viewport.width / uiScale,
      } as CSSProperties}
    >
      {/* The stock skull is paint only (HUD painter 0x005D2520; OPEN MENU is a keyboard
          edge in 0x005CB360 / 0x0058F320). A touch player has no keyboard edge, so the
          skull doubles as the pause button — the same gated path as the keydown handler. */}
      <button
        type="button"
        className="hub-hud-skull-button"
        aria-label="Menu"
        disabled={!onMenuClick || !coarsePointer}
        onClick={onMenuClick}
      >
        <img className="hub-hud-skull" src={hub.hud.skull} alt="" />
      </button>
      <GameAccountName placement="hud" username={accountUsername} />
      <AllyHud
        additionalRows={additionalAllyRows}
        hidden={allyRosterHidden}
        initialSnapshot={initialSnapshot}
        partyMemberIds={partyMemberIds}
        playerId={playerId}
        subscribeSnapshot={subscribeSnapshot}
      />
      <div className="hub-hud-diagnostics" aria-label="Performance">
        <FpsCounter />
        <PingCounter getPingMs={getPingMs} subscribePing={subscribePing} />
      </div>
      <div className="hub-hud-meters">
        <div
          className="hub-hud-meter hub-hud-meter-health"
          data-core-width={healthHud.coreWidth}
          data-track-width={healthHud.trackWidth}
          style={{
            '--native-meter-core-width': `${healthHud.coreWidth}px`,
            '--native-meter-track-width': `${healthHud.trackWidth}px`,
          } as CSSProperties}
        >
          {healthLayers.map((layer) => (
            <img
              className={layer.className}
              key={layer.shield ? 'shield' : 'health'}
              src={hub.hud.barRed}
              style={{ clipPath: nativeHudLeftOriginClipPath(layer.progress) }}
              alt={layer.shield
                ? `Magic shield ${quickbarHud.playerState!.magicShieldAbsorb} of ${quickbarHud.playerState!.magicShieldMaximum}`
                : `Health ${progression.currentHealth} of ${progression.maximumHealth}`}
            />
          ))}
        </div>
        <div
          className="hub-hud-meter hub-hud-meter-mana"
          data-core-width={manaHud.coreWidth}
          data-track-width={manaHud.trackWidth}
          style={{
            '--native-meter-core-width': `${manaHud.coreWidth}px`,
            '--native-meter-track-width': `${manaHud.trackWidth}px`,
          } as CSSProperties}
        >
          <img
            className="hub-hud-meter-fill"
            src={hub.hud.barBlue}
            style={{ clipPath: nativeHudLeftOriginClipPath(manaHud.fillProgress) }}
            alt={`Mana ${progression.currentMana} of ${progression.maximumMana}`}
          />
          {manaHud.reserveProgress > 0 ? (
            <span
              className="hub-hud-mana-reserve"
              style={{
                backgroundImage: `url("${hub.hud.manaReserve}")`,
                width: `${manaHud.reserveWidth}px`,
              }}
                aria-label={`${quickbarHud.playerState!.reservedMana} mana reserved`}
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
      <div className="hub-hud-selected-skills" role="group" aria-label="Selected skills">
        {skillBindings.map(({ binding, centerOffset, record, skillId }) => (
          <NativeSkillIcon
            ariaLabel={binding === 12
              ? `${NATIVE_SKILL_CATALOG[skillId]?.name ?? `Skill ${skillId}`} primary spell`
              : `${NATIVE_SKILL_CATALOG[skillId]?.name ?? `Skill ${skillId}`}, concentration ${binding === 16 ? 'A' : 'B'}`}
            className="hub-hud-selected-skill"
            cooldown={false}
            dataBinding={binding}
            key={binding}
            opacity={0.75}
            record={record}
            style={{
              '--native-hud-skill-center-offset': `${centerOffset}px`,
            } as CSSProperties}
          />
        ))}
      </div>
      {mode === 'hub' ? (
        <img className="hub-hud-help" src={hub.hud.help} alt="Help" />
      ) : null}

      <SkillQuickbar
        controls={controls}
        mode={mode}
        onInput={onQuickbarInput}
        playerState={quickbarHud.playerState}
        quickbar={quickbarHud.quickbar}
        selectedPrimarySkillId={quickbarHud.selectedPrimarySkillId}
        uiScale={uiScale}
        viewportWidth={viewport.width}
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
        <button
          type="button"
          className="hub-hud-potion-button hub-hud-potion-button-red"
          aria-label={`Use health potion, ${healthPotions.count} available`}
          disabled={healthPotions.itemId === null || !onPotionClick}
          onClick={() => {
            if (healthPotions.itemId !== null) onPotionClick?.(healthPotions.itemId)
          }}
        >
          <img className="hub-hud-potion hub-hud-potion-red" src={hub.hud.potionRed} alt="" />
        </button>
        <InventoryCount count={healthPotions.count} variant="red" />
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
        <button
          type="button"
          className="hub-hud-tome-button"
          aria-label="Open skills"
          disabled={!onSkillsClick}
          onClick={onSkillsClick}
          title="Skills (K)"
        >
          <img className="hub-hud-tome" src={hub.hud.tome} alt="" />
        </button>
        <button
          type="button"
          className="hub-hud-potion-button hub-hud-potion-button-blue"
          aria-label={`Use mana potion, ${manaPotions.count} available`}
          disabled={manaPotions.itemId === null || !onPotionClick}
          onClick={() => {
            if (manaPotions.itemId !== null) onPotionClick?.(manaPotions.itemId)
          }}
        >
          <img className="hub-hud-potion hub-hud-potion-blue" src={hub.hud.potionBlue} alt="" />
        </button>
        <InventoryCount count={manaPotions.count} variant="blue" />
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
