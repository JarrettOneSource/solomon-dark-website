import type { CSSProperties } from 'react'

import nativeAssetsJson from '../assets/game/skill-picker-native-assets.json' with { type: 'json' }
import { hub } from '../lib/assets.ts'
import type { NativeSecondaryPlayerState } from './core-kernels/native-secondary-abilities.ts'
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
  mode: 'hub' | 'run'
  playerState: NativeSecondaryPlayerState | undefined
  quickbar: readonly (number | null)[]
  selectedPrimarySkillId: number
}

export default function SkillQuickbar({
  mode,
  playerState,
  quickbar,
  selectedPrimarySkillId,
}: SkillQuickbarProps) {
  return (
    <div
      className="hub-hud-skill-quickbar"
      data-mode={mode}
      aria-label="Skill quickbar"
    >
      {NATIVE_SKILL_QUICKBAR_SLOT_OFFSETS.map((offset, slot) => {
        const skillId = quickbar[slot] ?? null
        const skill = skillId === null ? undefined : NATIVE_SKILL_CATALOG[skillId]
        const secondary = skillId !== null && nativeSkillCategory(skillId) === 2
        const { capacity, remaining } = !secondary
          ? { capacity: 0, remaining: 0 }
          : nativeSkillQuickbarCooldownPresentation(
              playerState?.cooldownTicksBySkill[skillId] ?? 0,
              playerState?.cooldownMaximumTicksBySkill[skillId] ?? 0,
              playerState?.globalCooldownTicks ?? 0,
            )
        const input = slot === 0 ? 'right mouse button' : `key ${slot}`
        const active = skillId !== null && (
          skillId === selectedPrimarySkillId
          || secondaryAbilityActive(skillId, playerState)
        )
        const label = skill === undefined
          ? `Empty quickbar slot ${slot + 1}, ${input}`
          : `${skill.name}, ${input}${remaining > 0
            ? `, ${formatCooldown(remaining)} seconds cooldown remaining`
            : ''}${active ? ', active' : ''}`
        return (
          <div
            className="hub-hud-quickbar-slot"
            data-slot={slot}
            data-active={active}
            key={slot}
            style={{ '--quickbar-slot-offset': `${offset}px` } as CSSProperties}
            aria-label={label}
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
            {slot === 0 && skill !== undefined ? (
              <img
                className="hub-hud-quickbar-input-mouse"
                src={hub.hud.mouseRight}
                alt=""
              />
            ) : null}
            {slot > 0 && skill !== undefined ? (
              <NativeKeyboardBinding text={`${slot}`} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

export function NativeSkillIcon({ cooldown, record }: { cooldown: boolean; record: number }) {
  const definition = nativeAssets.atlases.Skills.records[`${record}`]
  if (!definition) throw new Error(`Missing native Skills record ${record}`)
  const [x, y] = definition.frame
  const [logicalWidth, logicalHeight] = definition.logicalSize
  const [trimX, trimY] = definition.trimOrigin
  return (
    <span
      className="hub-hud-quickbar-skill-icon"
      data-record={record}
      style={{
        backgroundImage: `url("${hub.trader.skillsAtlas}")`,
        backgroundPosition: `${trimX - x}px ${trimY - y}px`,
        backgroundSize: `${ATLAS_WIDTH}px ${ATLAS_HEIGHT}px`,
        height: logicalHeight,
        opacity: cooldown ? 0.25 : 0.375,
        width: logicalWidth,
      }}
      aria-hidden
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

function NativeKeyboardBinding({ text }: { text: string }) {
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
