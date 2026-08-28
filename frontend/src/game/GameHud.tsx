import { useEffect, useRef, useState, type CSSProperties } from 'react'

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
import { hubRunEntryPresentation } from './hub-presentation.ts'
import GameAccountName from './GameAccountName.tsx'
import {
  HUB_HUD_SHORTCUTS,
  type HubHudShortcutDefinition,
} from './hub-inventory-presentation.ts'
import SkillQuickbar, { NativeSkillIcon } from './SkillQuickbar.tsx'
import type { GameSnapshot } from './protocol/game-protocol.ts'
import type { PartyRosterPlayer } from './protocol/party-state.ts'
import { gameBindingLabel, type GameControlBindings } from './game-settings.ts'
import type { NativeTutorialHudAccess } from './core-kernels/native-tutorial.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import { mobileUiElementStyle } from './mobile-ui-layout.ts'
import type { GameViewportLayout } from './renderer/game-viewport.ts'
import { useMobileUiLayout } from './use-mobile-ui-layout.ts'
import {
  NATIVE_HUD_SKILL_ACTION_HEIGHT,
  NATIVE_HUD_SKILL_ACTION_TOP,
  NATIVE_HUD_SKILL_ACTION_WIDTH,
  nativeHealthHudPresentation,
  nativeHudLeftOriginClipPath,
  nativeHudSkillBindings,
  nativeManaHudPresentation,
  type NativeHudSkillBinding,
} from './native-hud-presentation.ts'

interface GameHudProps {
  accountUsername: string | null
  additionalAllyRows?: readonly AllyHudRow[]
  /** Touch: hide the ally roster while the Hub party column is open under the chip. */
  allyRosterHidden?: boolean
  audio: GameAudioDirector
  controls: GameControlBindings
  controllerQuickbarSlot?: number
  getPingMs: () => number | null
  initialSnapshot: GameSnapshot
  mapLabel?: string
  mapTransitionActive?: boolean
  mode?: 'hub' | 'run'
  onInventoryClick?: () => void
  onHubShortcutClick?: (interaction: HubHudShortcutDefinition['interaction']) => void
  onMapClick?: () => void
  onQuickbarInput?: (slot: number, pressed: boolean) => void
  onQuickbarUnassign?: (slot: number) => void
  onSkillBindingClick?: (binding: NativeHudSkillBinding) => void
  partyRoster?: readonly PartyRosterPlayer[]
  onSkillsClick?: () => void
  playerId: string
  progression: ProtocolPlayerProgression
  subscribePing: (listener: (pingMs: number) => void) => () => void
  subscribeSnapshot: (listener: (snapshot: GameSnapshot) => void) => () => void
  tutorialAccess?: NativeTutorialHudAccess | null
  uiScale: number
  viewport: Readonly<GameViewportLayout>
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
  audio,
  controls,
  controllerQuickbarSlot,
  getPingMs,
  initialSnapshot,
  mapLabel = 'Map',
  mapTransitionActive = false,
  mode = 'hub',
  onInventoryClick,
  onHubShortcutClick,
  onMapClick,
  onQuickbarInput,
  onQuickbarUnassign,
  onSkillBindingClick,
  partyRoster,
  onSkillsClick,
  playerId,
  progression,
  subscribePing,
  subscribeSnapshot,
  tutorialAccess,
  uiScale,
  viewport,
}: GameHudProps) {
  const mobileUi = useMobileUiLayout()
  const [economy, setEconomy] = useState<ProtocolPlayerEconomy>(() => (
    initialSnapshot.players[playerId]!.economy
  ))
  const actionFeedbackSequenceRef = useRef(
    initialSnapshot.players[playerId]!.economy.actionFeedback?.sequence ?? 0,
  )
  useEffect(() => subscribeSnapshot((snapshot) => {
    const next = snapshot.players[playerId]?.economy
    if (!next) return
    setEconomy((current) => current.revision === next.revision ? current : next)
    const feedback = next.actionFeedback
    if (!feedback) {
      actionFeedbackSequenceRef.current = 0
      return
    }
    if (feedback.sequence === actionFeedbackSequenceRef.current) return
    actionFeedbackSequenceRef.current = feedback.sequence
    if (!feedback.accepted) return
    if (feedback.action === 'consume') audio.playSound('drink')
    else if (feedback.action === 'equip') audio.playSound('backpack-open')
    else if (feedback.action === 'activate-belt-slot') audio.playSound('backpack-open')
  }), [audio, playerId, subscribeSnapshot])
  const [quickbarHud, setQuickbarHud] = useState(() => ({
    belt: initialSnapshot.players[playerId]!.belt,
    concentrationSkillIds: initialSnapshot.players[playerId]!.progression.concentrationSkillIds,
    currentMana: initialSnapshot.players[playerId]!.progression.currentMana,
    playerState: initialSnapshot.secondaryAbilities.players[playerId],
    secondaryManaCosts: initialSnapshot.players[playerId]!.progression.secondaryManaCosts,
    selectedPrimarySkillId: initialSnapshot.players[playerId]!.progression.selectedPrimarySkillId,
    tick: initialSnapshot.tick,
    weldBuildId: initialSnapshot.players[playerId]!.progression.weldBuildId,
  }))
  useEffect(() => subscribeSnapshot((snapshot) => {
    const player = snapshot.players[playerId]
    if (!player) return
    setQuickbarHud({
      belt: player.belt,
      concentrationSkillIds: player.progression.concentrationSkillIds,
      currentMana: player.progression.currentMana,
      playerState: snapshot.secondaryAbilities.players[playerId],
      secondaryManaCosts: player.progression.secondaryManaCosts,
      selectedPrimarySkillId: player.progression.selectedPrimarySkillId,
      tick: snapshot.tick,
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
  const runEntry = hubRunEntryPresentation(quickbarHud.tick, mapTransitionActive)
  const shortcutAssets: Readonly<Record<HubHudShortcutDefinition['interaction'], string>> = {
    annalist: hub.hud.npcs.annalist,
    fomentius: hub.hud.npcs.potion,
    hagatha: hub.hud.npcs.perkWitch,
    luthacus: hub.hud.npcs.items,
    shlorio: hub.hud.npcs.shlorio,
  }
  return (
    <div
      className="hub-hud"
      aria-label="Player status"
      data-tutorial-combat={tutorialAccess?.combat}
      data-tutorial-inventory={tutorialAccess?.inventory}
      data-tutorial-quickbar={tutorialAccess?.quickbar}
      data-tutorial-skills={tutorialAccess?.skills}
      data-tutorial-spell={tutorialAccess?.spell}
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
          edge in 0x005CB360 / 0x0058F320). The Website's skull is the stage-level
          GameMenuSkull the host mounts over this HUD at the same (11, 7) / 31 px. */}
      <GameAccountName placement="hud" username={accountUsername} />
      <AllyHud
        additionalRows={additionalAllyRows}
        hidden={allyRosterHidden}
        initialSnapshot={initialSnapshot}
        partyRoster={partyRoster}
        playerId={playerId}
        subscribeSnapshot={subscribeSnapshot}
      />
      <div
        className="hub-hud-diagnostics"
        aria-label="Performance"
        data-mobile-ui-custom={mobileUi.customized || undefined}
        data-mobile-ui-element="diagnostics"
        style={mobileUiElementStyle(mobileUi, 'diagnostics')}
      >
        <FpsCounter />
        <PingCounter getPingMs={getPingMs} subscribePing={subscribePing} />
      </div>
      <div
        className="hub-hud-meters"
        data-mobile-ui-custom={mobileUi.customized || undefined}
        data-mobile-ui-element="meters"
        style={mobileUiElementStyle(mobileUi, 'meters')}
      >
        <div
          className="hub-hud-meter hub-hud-meter-health"
          data-tutorial-anchor="health-meter"
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
        {skillBindings.map(({ binding, centerOffset, skillId }) => {
          const name = NATIVE_SKILL_CATALOG[skillId]?.name ?? `Skill ${skillId}`
          const planeOrbOverride = binding === 12 && skillId === 80
          return (
            <button
              type="button"
              aria-disabled={planeOrbOverride || !onSkillBindingClick}
              aria-label={binding === 12
                ? `Select primary attack, current ${name}`
                : `Select concentration ${binding === 16 ? 'A' : 'B'}, current ${name}`}
              className="hub-hud-selected-skill-action"
              data-binding={binding}
              data-tutorial-anchor={binding === 12
                ? 'primary-skill'
                : binding === 16
                  ? 'concentration-a'
                  : undefined}
              key={`action-${binding}`}
              onClick={() => {
                if (!planeOrbOverride) onSkillBindingClick?.(binding)
              }}
              onPointerDown={(event) => event.preventDefault()}
              style={{
                height: NATIVE_HUD_SKILL_ACTION_HEIGHT,
                left: `calc(50% + ${centerOffset}px - ${NATIVE_HUD_SKILL_ACTION_WIDTH / 2}px)`,
                top: NATIVE_HUD_SKILL_ACTION_TOP,
                width: NATIVE_HUD_SKILL_ACTION_WIDTH,
              }}
            />
          )
        })}
      </div>
      {mode === 'hub' ? (
        <img className="hub-hud-help" src={hub.hud.help} alt="Help" />
      ) : null}

      <SkillQuickbar
        belt={quickbarHud.belt}
        concentrationSkillIds={quickbarHud.concentrationSkillIds}
        controls={controls}
        controllerQuickbarSlot={controllerQuickbarSlot}
        currentMana={quickbarHud.currentMana}
        displayScale={viewport.displayScale}
        economy={economy}
        element={initialSnapshot.players[playerId]!.config.element}
        mode={mode}
        mobileUi={mobileUi}
        onInput={onQuickbarInput}
        onUnassign={onQuickbarUnassign}
        playerState={quickbarHud.playerState}
        secondaryManaCosts={quickbarHud.secondaryManaCosts}
        selectedPrimarySkillId={quickbarHud.selectedPrimarySkillId}
        uiScale={uiScale}
        viewportWidth={viewport.width}
      />

      {mode === 'hub' ? (
        <div className="hub-hud-loadout" aria-label="College interactions">
          {HUB_HUD_SHORTCUTS.map((shortcut) => (
            <button
              type="button"
              className="hub-hud-slot-button"
              data-hub-shortcut={shortcut.interaction}
              data-level-picker-record={shortcut.levelPickerRecord}
              key={shortcut.interaction}
              aria-label={`Open ${shortcut.name} interaction`}
              disabled={!onHubShortcutClick}
              onClick={() => onHubShortcutClick?.(shortcut.interaction)}
            >
              <img className="hub-hud-slot" src={shortcutAssets[shortcut.interaction]} alt="" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="hub-hud-inventory" aria-label="Inventory shortcuts">
        <button
          type="button"
          className="hub-hud-backpack-button"
          data-mobile-ui-custom={mobileUi.customized || undefined}
          data-mobile-ui-element="inventory"
          aria-label={`Open inventory, ${economy.gold} gold`}
          disabled={!onInventoryClick}
          onClick={onInventoryClick}
          style={mobileUiElementStyle(mobileUi, 'inventory')}
          title={`Inventory (${gameBindingLabel(controls.openInventory)})`}
        >
          <img
            className="hub-hud-backpack"
            data-tutorial-anchor="inventory"
            src={hub.hud.backpack}
            alt=""
          />
        </button>
        <div
          className="hub-hud-xp"
          data-mobile-ui-custom={mobileUi.customized || undefined}
          data-mobile-ui-element="xp"
          role="progressbar"
          aria-label="Experience"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={xpProgress * 100}
          style={mobileUiElementStyle(mobileUi, 'xp')}
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
          data-mobile-ui-custom={mobileUi.customized || undefined}
          data-mobile-ui-element="skillbook"
          aria-label="Open skills"
          disabled={!onSkillsClick}
          onClick={onSkillsClick}
          style={mobileUiElementStyle(mobileUi, 'skillbook')}
          title={`Skills (${gameBindingLabel(controls.openSkills)})`}
        >
          <img
            className="hub-hud-tome"
            data-tutorial-anchor="skills"
            src={hub.hud.tome}
            alt=""
          />
        </button>
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
            className="hub-hud-map-state hub-hud-map-compass"
            src={hub.hud.mapCompass}
            style={{ opacity: runEntry.compassAlpha }}
            alt=""
          />
          <img
            className="hub-hud-map-state hub-hud-map-play"
            src={hub.hud.mapPlay}
            style={{ opacity: runEntry.playAlpha }}
            alt=""
          />
        </button>
      ) : null}
    </div>
  )
}
