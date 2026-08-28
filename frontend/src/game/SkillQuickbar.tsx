import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import nativeAssetsJson from '../assets/game/native-ui-assets.json' with { type: 'json' }
import { hub } from '../lib/assets.ts'
import type { HubEconomyState } from './core-kernels/hub-economy.ts'
import {
  nativeBeltEntryItem,
  nativeBeltPotionProjection,
  type NativeBeltEntry,
  type PlayerBeltComponent,
} from './core-kernels/native-belt.ts'
import type { WizardElement } from './core-kernels/player-character.ts'
import type { NativeSecondaryPlayerState } from './core-kernels/native-secondary-abilities.ts'
import {
  gameBindingLabel,
  type GameBindingAction,
  type GameControlBindings,
} from './game-settings.ts'
import {
  NATIVE_SKILL_CATALOG,
  nativeSkillCategory,
} from './core-kernels/player-progression.ts'
import {
  layoutNativeQuickbarBinding,
  nativeCooldownSectorPath,
  nativeSkillQuickbarCooldownPresentation,
  NATIVE_SKILL_QUICKBAR_FONT,
  NATIVE_SKILL_QUICKBAR_SLOT_OFFSETS,
} from './skill-quickbar.ts'
import { mobileQuickbarBankLayout, mobileQuickbarSlotPlacement } from './mobile-quickbar-layout.ts'
import {
  mobileUiElementStyle,
  type MobileUiElementId,
  type MobileUiLayoutState,
} from './mobile-ui-layout.ts'
import NativeBeltPullOffBurst from './NativeBeltPullOffBurst.tsx'
import NativeBeltItemIcon from './NativeBeltItemIcon.tsx'
import { nativeBeltPullOffStarted } from './skill-book-model.ts'

interface AtlasRecord {
  frame: readonly [number, number, number, number]
  logicalSize: readonly [number, number]
  trimOrigin: readonly [number, number]
}

interface NativeAssetManifest {
  atlases: {
    Skills: {
      records: Record<string, AtlasRecord>
    }
  }
}

const nativeAssets = nativeAssetsJson as unknown as NativeAssetManifest
const ATLAS_WIDTH = 1024
const ATLAS_HEIGHT = 512

interface SkillQuickbarProps {
  belt: PlayerBeltComponent
  concentrationSkillIds: readonly [number | null, number | null]
  controls: GameControlBindings
  controllerQuickbarSlot?: number
  displayScale: number
  economy: Pick<HubEconomyState, 'backpack' | 'equipment'>
  element: WizardElement
  mode: 'hub' | 'run'
  mobileUi: MobileUiLayoutState
  onInput?: (slot: number, pressed: boolean) => void
  onUnassign?: (slot: number) => void
  playerState: NativeSecondaryPlayerState | undefined
  selectedPrimarySkillId: number
  /** Settings UI scale; coarse-pointer bank placement is computed in HUD-root pixels. */
  uiScale: number
  /** Logical viewport width (display-scale space) used to keep the touch banks clear of the dock. */
  viewportWidth: number
}

export default function SkillQuickbar({
  belt,
  concentrationSkillIds,
  controls,
  controllerQuickbarSlot,
  displayScale,
  economy,
  element,
  mode,
  mobileUi,
  onInput,
  onUnassign,
  playerState,
  selectedPrimarySkillId,
  uiScale,
  viewportWidth,
}: SkillQuickbarProps) {
  const mobileBank = mobileQuickbarBankLayout(viewportWidth, uiScale)
  return (
    <div
      className="hub-hud-skill-quickbar"
      data-mode={mode}
      aria-label="Item belt"
    >
      {NATIVE_SKILL_QUICKBAR_SLOT_OFFSETS.map((offset, slot) => (
        <SkillQuickbarSlot
          bindingCode={controls[`belt${slot + 1}` as GameBindingAction]}
          economy={economy}
          element={element}
          entry={belt[slot] ?? null}
          concentrationSkillIds={concentrationSkillIds}
          controllerSelected={controllerQuickbarSlot === slot}
          inputScale={displayScale * uiScale}
          key={slot}
          mobilePlacement={mobileQuickbarSlotPlacement(slot, mobileBank)}
          mobileUi={mobileUi}
          mode={mode}
          offset={offset}
          onInput={onInput}
          onUnassign={onUnassign}
          playerState={playerState}
          selectedPrimarySkillId={selectedPrimarySkillId}
          slot={slot}
        />
      ))}
    </div>
  )
}

function SkillQuickbarSlot({
  bindingCode,
  concentrationSkillIds,
  controllerSelected,
  economy,
  element,
  entry,
  inputScale,
  mobilePlacement,
  mode,
  mobileUi,
  offset,
  onInput,
  onUnassign,
  playerState,
  selectedPrimarySkillId,
  slot,
}: {
  bindingCode: string
  concentrationSkillIds: SkillQuickbarProps['concentrationSkillIds']
  controllerSelected: boolean
  economy: Pick<HubEconomyState, 'backpack' | 'equipment'>
  element: WizardElement
  entry: NativeBeltEntry | null
  inputScale: number
  mobilePlacement: ReturnType<typeof mobileQuickbarSlotPlacement>
  mode: SkillQuickbarProps['mode']
  mobileUi: MobileUiLayoutState
  offset: number
  onInput: SkillQuickbarProps['onInput']
  onUnassign: SkillQuickbarProps['onUnassign']
  playerState: SkillQuickbarProps['playerState']
  selectedPrimarySkillId: number
  slot: number
}) {
  const mobileUiId: MobileUiElementId = entry?.kind === 'health-potion'
    ? 'healthPotion'
    : entry?.kind === 'mana-potion'
      ? 'manaPotion'
      : `slot${slot + 1}` as MobileUiElementId
  const pressRef = useRef<{
    castEligible: boolean
    originX: number
    originY: number
    pointerId: number
  } | null>(null)
  const [burstSequence, setBurstSequence] = useState<number | null>(null)
  const skillId = entry?.kind === 'skill' ? entry.skillId : null
  const skill = skillId === null ? undefined : NATIVE_SKILL_CATALOG[skillId]
  const potion = entry?.kind === 'health-potion'
    ? nativeBeltPotionProjection(economy.backpack, 0)
    : entry?.kind === 'mana-potion'
      ? nativeBeltPotionProjection(economy.backpack, 1)
      : null
  const item = entry === null || entry.kind === 'skill'
    ? null
    : potion?.item ?? nativeBeltEntryItem(entry, economy)
  const secondary = skillId !== null && nativeSkillCategory(skillId) === 2
  const concentration = skillId !== null && nativeSkillCategory(skillId) === 3
  const combatDisabled = mode === 'hub' && secondary
  const { capacity, remaining } = !secondary
    ? { capacity: 0, remaining: 0 }
    : nativeSkillQuickbarCooldownPresentation(
        playerState?.cooldownTicksBySkill[skillId] ?? 0,
        playerState?.cooldownMaximumTicksBySkill[skillId] ?? 0,
        playerState?.globalCooldownTicks ?? 0,
      )
  const bindingLabel = gameBindingLabel(bindingCode)
  const input = bindingCode.startsWith('Mouse')
    ? `${bindingLabel.toLowerCase()} button`
    : `key ${bindingLabel}`
  const active = skillId !== null && (
    skillId === selectedPrimarySkillId
    || (concentration && concentrationSkillIds.includes(skillId))
    || secondaryAbilityActive(skillId, playerState)
  )
  const entryName = entry === null
    ? null
    : skill?.name
      ?? (entry.kind === 'health-potion' ? 'Health Potion' : null)
      ?? (entry.kind === 'mana-potion' ? 'Mana Potion' : null)
      ?? item?.name
      ?? 'Unavailable item'
  const label = entryName === null
    ? `Empty belt slot ${slot + 1}, ${input}`
    : `${entryName}, ${input}${potion ? `, ${potion.count} available` : ''}${remaining > 0
      ? `, ${formatCooldown(remaining)} seconds cooldown remaining`
      : ''}${active ? ', active' : ''}${combatDisabled ? ', unavailable in the Hub' : ''}`
  const finishPointer = (event: ReactPointerEvent<HTMLButtonElement>, activate: boolean) => {
    const press = pressRef.current
    if (!press || press.pointerId !== event.pointerId) return
    pressRef.current = null
    if (activate && press.castEligible) {
      onInput?.(slot, true)
      onInput?.(slot, false)
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  return (
    <button
      type="button"
      className="hub-hud-quickbar-slot"
      data-slot={slot}
      data-entry-kind={entry?.kind ?? 'empty'}
      data-populated={entry !== null}
      data-quickbar-bank={mobilePlacement.bank}
      data-tutorial-anchor={entry?.kind === 'health-potion'
        ? 'health-potion'
        : slot === 0
          ? 'secondary-slot'
          : undefined}
      data-binding-code={bindingCode}
      data-active={active}
      data-controller-selected={controllerSelected || undefined}
      data-mobile-ui-custom={mobileUi.customized || undefined}
      data-mobile-ui-element={mobileUiId}
      disabled={entry === null || ((!onInput || combatDisabled) && !onUnassign)}
      style={{
        ...(mobileUiElementStyle(mobileUi, mobileUiId) ?? {}),
        '--mobile-quickbar-slot-bottom': `${mobilePlacement.bottom}px`,
        '--mobile-quickbar-slot-inset': `${mobilePlacement.inset}px`,
        '--mobile-quickbar-slot-size': `${mobilePlacement.size}px`,
        '--quickbar-slot-offset': `${offset}px`,
      } as CSSProperties}
      aria-disabled={combatDisabled || undefined}
      aria-label={`${label}${controllerSelected ? ', controller selected' : ''}`}
      onPointerDown={(event) => {
        const unsupportedMouseButton = event.pointerType === 'mouse' && event.button !== 0
        const canCast = Boolean(onInput) && !combatDisabled
        if (unsupportedMouseButton || entry === null || (!canCast && !onUnassign)) return
        event.preventDefault()
        pressRef.current = {
          castEligible: canCast,
          originX: event.clientX,
          originY: event.clientY,
          pointerId: event.pointerId,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const press = pressRef.current
        if (!press || press.pointerId !== event.pointerId || !onUnassign) return
        const customScale = mobileUi.customized ? mobileUi.layout[mobileUiId].scale : 1
        const transformedInputScale = inputScale * customScale
        const scale = Number.isFinite(transformedInputScale) && transformedInputScale > 0
          ? transformedInputScale
          : 1
        if (!nativeBeltPullOffStarted(
          { x: 0, y: 0 },
          {
            x: (event.clientX - press.originX) / scale,
            y: (event.clientY - press.originY) / scale,
          },
        )) return
        pressRef.current = null
        setBurstSequence((current) => (current ?? 0) + 1)
        onUnassign(slot)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onPointerUp={(event) => finishPointer(event, true)}
      onPointerCancel={(event) => finishPointer(event, false)}
      onLostPointerCapture={(event) => finishPointer(event, false)}
    >
      {remaining > 0 && capacity > 0 ? (
        <CooldownSector remaining={remaining} capacity={capacity} />
      ) : null}
      {skill === undefined ? null : (
        <NativeSkillIcon
          cooldown={remaining > 0}
          record={skill.skills_atlas_icon_record}
        />
      )}
      {item ? (
        <NativeBeltItemIcon
          element={element}
          item={potion ? { ...item, quantity: potion.count } : item}
        />
      ) : entry?.kind === 'health-potion' || entry?.kind === 'mana-potion' ? (
        <img
          className="hub-hud-belt-potion-fallback"
          src={entry.kind === 'health-potion' ? hub.hud.potionRed : hub.hud.potionBlue}
          alt=""
        />
      ) : null}
      {bindingCode === 'Mouse2' && entry !== null ? (
        <img
          className="hub-hud-quickbar-input-mouse"
          src={hub.hud.mouseRight}
          alt=""
        />
      ) : null}
      {bindingCode !== 'Mouse2' && entry !== null ? (
        <NativeQuickbarBinding text={bindingLabel.toUpperCase()} />
      ) : null}
      {burstSequence !== null ? (
        <NativeBeltPullOffBurst
          key={burstSequence}
          className="hub-hud-quickbar-pull-off-burst"
          onComplete={() => setBurstSequence((current) => (
            current === burstSequence ? null : current
          ))}
          style={{ left: '50%', top: '50%' }}
        />
      ) : null}
    </button>
  )
}

export function NativeSkillIcon({
  ariaLabel,
  className = 'hub-hud-quickbar-skill-icon',
  cooldown,
  dataBinding,
  opacity,
  record,
  style,
}: {
  ariaLabel?: string
  className?: string
  cooldown: boolean
  dataBinding?: number
  opacity?: number
  record: number
  style?: CSSProperties
}) {
  const definition = nativeAssets.atlases.Skills.records[`${record}`]
  if (!definition) throw new Error(`Missing native Skills record ${record}`)
  const [x, y] = definition.frame
  const [logicalWidth, logicalHeight] = definition.logicalSize
  const [trimX, trimY] = definition.trimOrigin
  return (
    <span
      aria-hidden={ariaLabel === undefined ? true : undefined}
      aria-label={ariaLabel}
      className={className}
      data-binding={dataBinding}
      data-record={record}
      role={ariaLabel === undefined ? undefined : 'img'}
      style={{
        ...style,
        backgroundImage: `url("${hub.trader.skillsAtlas}")`,
        backgroundPosition: `${trimX - x}px ${trimY - y}px`,
        backgroundSize: `${ATLAS_WIDTH}px ${ATLAS_HEIGHT}px`,
        height: logicalHeight,
        opacity: opacity ?? (cooldown ? 0.25 : 0.375),
        width: logicalWidth,
      }}
    />
  )
}

function CooldownSector({ capacity, remaining }: { capacity: number; remaining: number }) {
  return (
    <svg className="hub-hud-quickbar-cooldown" viewBox="0 0 53 53" aria-hidden>
      <path d={nativeCooldownSectorPath(remaining, capacity)} />
    </svg>
  )
}

export function NativeQuickbarBinding({ text }: { text: string }) {
  const layout = layoutNativeQuickbarBinding(text)
  const maskImage = `url("${hub.hud.fontAtlas}")`
  const backingImage = `url("${hub.hud.keyBacking}")`
  const maskSize = `${NATIVE_SKILL_QUICKBAR_FONT.atlasWidth}px ${NATIVE_SKILL_QUICKBAR_FONT.atlasHeight}px`
  return (
    <>
      <span
        className="hub-hud-quickbar-key-backing"
        style={{
          left: layout.backingLeft,
          width: layout.backingWidth,
        }}
        aria-hidden
      >
        <span style={{ backgroundImage: backingImage, backgroundPosition: '0 0', left: 0 }} />
        <span
          style={{
            backgroundImage: backingImage,
            backgroundPosition: '-5px 0',
            left: 5,
            width: Math.max(0, layout.backingWidth - 10),
          }}
        />
        <span
          style={{
            backgroundImage: backingImage,
            backgroundPosition: '-10px 0',
            left: layout.backingWidth - 5,
          }}
        />
      </span>
      {layout.glyphs.map((glyph, index) => (
        <span
          key={`${index}:${glyph.char}`}
          className="hub-hud-quickbar-key-glyph"
          style={{
            height: glyph.height,
            imageRendering: 'pixelated',
            left: glyph.left,
            maskImage,
            maskPosition: `${-glyph.atlasX}px ${-glyph.atlasY}px`,
            maskSize,
            top: 64 + glyph.top,
            WebkitMaskImage: maskImage,
            WebkitMaskPosition: `${-glyph.atlasX}px ${-glyph.atlasY}px`,
            WebkitMaskSize: maskSize,
            width: glyph.width,
          }}
          aria-hidden
        />
      ))}
    </>
  )
}

function secondaryAbilityActive(
  skillId: number,
  player: NativeSecondaryPlayerState | undefined,
): boolean {
  if (!player) return false
  if (skillId === 12) return player.planewalkerTicksRemaining > 0
  if (skillId === 23) return player.firewalker
  if (skillId === 78) return player.mindstar
  if (skillId === 79) return player.regenerate
  return false
}

function formatCooldown(ticks: number): string {
  return (ticks / 100).toFixed(2)
}
