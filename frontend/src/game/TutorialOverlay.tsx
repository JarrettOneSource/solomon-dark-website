import { useEffect, useRef, useState } from 'react'

import type { NativeTutorialState } from './core-kernels/native-tutorial.ts'
import {
  NATIVE_TUTORIAL_CUES,
  NATIVE_TUTORIAL_CUE_DEFINITIONS,
  nativeTutorialInstructionBaselines,
  nativeTutorialPresentation,
} from './core-kernels/native-tutorial.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import { gameBindingLabel, type GameControlBindings } from './game-settings.ts'
import type { NativeTutorialSelectedHudLayout } from './native-hud-presentation.ts'
import NativeBitmapText from './native-ui/NativeBitmapText.tsx'
import NativeUiNineSlice from './native-ui/NativeUiNineSlice.tsx'
import NativeUiSprite from './native-ui/NativeUiSprite.tsx'
import { nativeUiFont, type NativeUiFontName } from './native-ui/native-ui-catalog.ts'
import { layoutNativeUiText } from './native-ui/native-ui-text.ts'
import {
  emptyTutorialHudAnchors,
  nativeTutorialHudAnchorAttributes,
  nativeTutorialHudPointerPlans,
  tutorialClientRectAnchor,
  tutorialHudAnchorsEqual,
  type TutorialHudAnchorAttribute,
  type TutorialHudAnchors,
} from './tutorial-hud-anchors.ts'
import TutorialPrelude from './TutorialPrelude.tsx'
import './tutorial.css'

const TUTORIAL_GOLD = 0xd9ba70

interface TutorialOverlayProps {
  readonly audio: GameAudioDirector
  readonly controls: GameControlBindings
  readonly selectedHudLayout: NativeTutorialSelectedHudLayout | null
  readonly state: NativeTutorialState
  readonly viewport: Readonly<{ height: number; width: number }>
  readonly worldTarget: Readonly<{ x: number; y: number }> | null
}

export default function TutorialOverlay({
  audio,
  controls,
  selectedHudLayout,
  state,
  viewport,
  worldTarget,
}: TutorialOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const lastNarrationEventId = useRef(0)
  const hudAnchors = useTutorialHudAnchors(overlayRef, state.stage, viewport)
  const hudPointers = nativeTutorialHudPointerPlans(state.stage, hudAnchors)
  const presentation = nativeTutorialPresentation(state, {
    inventory: gameBindingLabel(controls.openInventory),
    potion: gameBindingLabel(controls.belt4),
    secondary: gameBindingLabel(controls.belt1),
    skills: gameBindingLabel(controls.openSkills),
  })
  const narration = state.narration.current
  const instructionBaselines = nativeTutorialInstructionBaselines(state.stage, viewport.height)
  const worldPointerTarget = worldTarget === null
    ? null
    : Object.freeze({
        x: clamp(worldTarget.x, 50, viewport.width - 50),
        y: clamp(worldTarget.y, 50, viewport.height - 50),
      })

  useEffect(() => {
    if (!narration || narration.eventId <= lastNarrationEventId.current) return
    lastNarrationEventId.current = narration.eventId
    audio.stopStreams(NATIVE_TUTORIAL_CUES)
    audio.playStream(narration.cue, {
      offsetSeconds: (
        NATIVE_TUTORIAL_CUE_DEFINITIONS[narration.cue].durationTicks
        - state.narration.ticksRemaining
      ) / 100,
    })
  }, [audio, narration, state.narration.ticksRemaining])

  useEffect(() => () => audio.stopStreams(NATIVE_TUTORIAL_CUES), [audio])

  return (
    <div
      ref={overlayRef}
      aria-live="polite"
      className="tutorial-overlay"
      data-active={state.active}
      data-intro-active={state.introActive}
      data-intro-blend={state.introBlend}
      data-intro-fade={state.introFade}
      data-intro-movement-ticks={state.introMovementTicksRemaining}
      data-heading-baseline={instructionBaselines?.heading}
      data-narration-event-id={narration?.eventId ?? 0}
      data-stage={state.stage}
      data-subheading-baseline={instructionBaselines?.subheading ?? undefined}
      data-viewport-height={viewport.height}
      data-viewport-width={viewport.width}
    >
      {state.introActive ? <TutorialPrelude blend={state.introBlend} fade={state.introFade} /> : null}
      {presentation.heading ? (
        <div className="tutorial-instruction">
          <span className="sr-only">
            {presentation.heading.replaceAll('\n', ' ')}. {presentation.subheading ?? ''}
          </span>
          <TutorialShadowedText
            baseline={instructionBaselines!.heading}
            font="heading"
            text={presentation.heading}
          />
          {presentation.subheading ? (
            <TutorialShadowedText
              baseline={instructionBaselines!.subheading!}
              className="tutorial-instruction-subheading"
              font="menu"
              text={presentation.subheading}
            />
          ) : null}
        </div>
      ) : null}

      {narration ? (
        <span
          className="sr-only"
          data-cue={narration.cue}
          role="status"
        >
          {narration.speaker === 'sirmin' ? 'Sirmin' : 'Solomon Dark'}: {narration.text}
        </span>
      ) : null}

      {state.stage === 14
        && !state.selectedSkillHudAcknowledged
        && selectedHudLayout ? (
        <div className="tutorial-selected-hud-lesson">
          <TutorialShadowedText
            baseline={selectedHudLayout.firstLine.y}
            centerX={selectedHudLayout.firstLine.x}
            className="tutorial-selected-hud-first-line"
            font="menu"
            text="click these icons to change your"
          />
          <TutorialShadowedText
            baseline={selectedHudLayout.secondLine.y}
            centerX={selectedHudLayout.secondLine.x}
            className="tutorial-selected-hud-second-line"
            font="menu"
            text="primary attack or concentration"
          />
          <TutorialPointer {...selectedHudLayout.pointer} />
        </div>
      ) : null}
      {hudPointers.map((pointer) => (
        <TutorialPointer
          anchor={pointer.anchor}
          key={pointer.anchor}
          x={pointer.x}
          y={pointer.y}
          toX={pointer.target.x}
          toY={pointer.target.y}
        />
      ))}
      {(state.stage === 8 || state.stage === 17) && worldPointerTarget ? (
        <TutorialPointer
          anchor="world-sack"
          x={worldPointerTarget.x - 20}
          y={worldPointerTarget.y - 60}
          toX={worldPointerTarget.x}
          toY={worldPointerTarget.y}
          visible={state.stageTicks % 50 > 19}
        />
      ) : null}
    </div>
  )
}

export function TutorialModalCallouts({
  controls,
  stage,
}: {
  readonly controls: GameControlBindings
  readonly stage: NativeTutorialState['stage']
}) {
  if (stage !== 10 && stage !== 13) return null
  const resume = `Click here or press '${gameBindingLabel(
    stage === 10 ? controls.openInventory : controls.openSkills,
  )}'\nagain to resume playing`
  return (
    <div className="tutorial-modal-callouts" data-stage={stage}>
      <TutorialCallout className="tutorial-callout-resume" text={resume} />
      <TutorialPointer x={1490} y={105} toX={1550} toY={45} />
      {stage === 10 ? (
        <>
          <TutorialCallout className="tutorial-callout-quick-use" text={'Put items here\nfor quick use'} />
          <TutorialCallout className="tutorial-callout-equipment" text={'Put equippable items\nhere to wear them.'} />
          <TutorialCallout className="tutorial-callout-backpack" text={'Found items go in your backpack.  Click and\ndrag to move items, double-click to use them.'} />
          <TutorialPointer x={480} y={800} toX={480} toY={860} />
          <TutorialPointer x={1320} y={340} toX={1380} toY={340} />
          <TutorialPointer x={1020} y={630} toX={1060} toY={670} />
        </>
      ) : (
        <>
          <TutorialCallout className="tutorial-callout-quick-use" text={'Drag skills here\nfor quick use'} />
          <TutorialCallout className="tutorial-callout-concentration" text={'You are CONCENTRATING on\nyour new skill automatically\n\nThis confers a bonus, but is\nlimited to one skill at a time.'} />
          <TutorialCallout className="tutorial-callout-hover" text={'Hover your mouse over a\nskill icon for more information.'} />
          <TutorialPointer x={480} y={800} toX={480} toY={860} />
          <TutorialPointer x={800} y={145} toX={800} toY={85} />
          <TutorialPointer x={1160} y={360} toX={1220} toY={360} />
        </>
      )}
    </div>
  )
}

function TutorialCallout({ className, text }: { className: string; text: string }) {
  const layout = layoutNativeUiText({
    align: 'center',
    font: 'menu',
    text,
    tint: TUTORIAL_GOLD,
    x: 0,
    y: nativeUiFont('menu').metrics[0] / 2,
  })
  const width = layout.width + 20
  const height = layout.height + 28
  return (
    <div className={`tutorial-callout ${className}`} style={{ height, width }}>
      <NativeUiNineSlice
        atlas="UI"
        height={height}
        record={4}
        style={{ left: 0, top: 0 }}
        width={width}
      />
      <NativeBitmapText
        align="center"
        className="tutorial-callout-text"
        font="menu"
        style={{ left: 10, top: 11.75 }}
        text={text}
        tint={TUTORIAL_GOLD}
        width={layout.width}
      />
    </div>
  )
}

function TutorialShadowedText({
  baseline,
  centerX = '50%',
  className,
  font,
  text,
}: {
  readonly baseline: number
  readonly centerX?: number | string
  readonly className?: string
  readonly font: NativeUiFontName
  readonly text: string
}) {
  const top = baseline - nativeUiFont(font).metrics[0] / 2
  const sharedClassName = className
    ? `tutorial-instruction-text ${className}`
    : 'tutorial-instruction-text'
  return (
    <>
      <NativeBitmapText
        align="center"
        className={`${sharedClassName} tutorial-instruction-shadow`}
        font={font}
        style={{
          left: typeof centerX === 'number' ? centerX + 2.25 : `calc(${centerX} + 2.25px)`,
          top: top + 2.25,
        }}
        text={text}
        tint={0x000000}
      />
      <NativeBitmapText
        align="center"
        className={sharedClassName}
        font={font}
        style={{ left: centerX, top }}
        text={text}
        tint={TUTORIAL_GOLD}
      />
    </>
  )
}

function TutorialPointer({
  anchor,
  toX,
  toY,
  visible = true,
  x,
  y,
}: {
  readonly anchor?: TutorialHudAnchorAttribute | 'selected-skills' | 'world-sack'
  readonly toX: number
  readonly toY: number
  readonly visible?: boolean
  readonly x: number
  readonly y: number
}) {
  const rotation = Math.atan2(toY - y, toX - x) * 180 / Math.PI + 90
  return (
    <span
      aria-hidden
      className="tutorial-pointer"
      data-to-x={toX}
      data-to-y={toY}
      data-x={x}
      data-y={y}
      data-target-x={toX}
      data-target-y={toY}
      data-tutorial-pointer={anchor}
      style={{
        left: x,
        opacity: visible ? 1 : 0,
        top: y,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
      }}
    >
      <NativeUiSprite atlas="UI" record={28} />
    </span>
  )
}

function useTutorialHudAnchors(
  overlayRef: Readonly<{ current: HTMLDivElement | null }>,
  stage: NativeTutorialState['stage'],
  viewport: Readonly<{ height: number; width: number }>,
): TutorialHudAnchors {
  const [anchors, setAnchors] = useState<TutorialHudAnchors>(emptyTutorialHudAnchors)
  const viewportHeight = viewport.height
  const viewportWidth = viewport.width

  useEffect(() => {
    const activeAttributes = nativeTutorialHudAnchorAttributes(stage)
    if (activeAttributes.length === 0) {
      setAnchors((current) => {
        const empty = emptyTutorialHudAnchors()
        return tutorialHudAnchorsEqual(current, empty) ? current : empty
      })
      return
    }
    const measure = () => {
      const overlay = overlayRef.current
      const owner = overlay?.closest<HTMLElement>('.boneyard-native-frame') ?? null
      if (!overlay || !owner) {
        setAnchors((current) => {
          const empty = emptyTutorialHudAnchors()
          return tutorialHudAnchorsEqual(current, empty) ? current : empty
        })
        return
      }
      const overlayRect = overlay.getBoundingClientRect()
      const anchor = (name: TutorialHudAnchorAttribute) => {
        if (!activeAttributes.includes(name)) return null
        const target = owner.querySelector<HTMLElement>(`[data-tutorial-anchor="${name}"]`)
        return target
          ? tutorialClientRectAnchor(
              overlayRect,
              target.getBoundingClientRect(),
              { height: viewportHeight, width: viewportWidth },
            )
          : null
      }
      const next = Object.freeze({
        healthMeter: anchor('health-meter'),
        healthPotion: anchor('health-potion'),
        inventory: anchor('inventory'),
        secondarySlot: anchor('secondary-slot'),
        skills: anchor('skills'),
      })
      setAnchors((current) => tutorialHudAnchorsEqual(current, next) ? current : next)
    }

    measure()
    return subscribeGamePresentationFrames(measure)
  }, [overlayRef, stage, viewportHeight, viewportWidth])

  return anchors
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
