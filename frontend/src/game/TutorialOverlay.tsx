import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { HubInventoryItem } from './core-kernels/hub-economy.ts'
import type { NativeTutorialState } from './core-kernels/native-tutorial.ts'
import {
  NATIVE_TUTORIAL_CUES,
  NATIVE_TUTORIAL_CUE_DEFINITIONS,
  nativeTutorialInstructionBaselines,
  nativeTutorialPresentation,
} from './core-kernels/native-tutorial.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import { nativeApplicationTick } from './native-application-tick.ts'
import {
  initialNativeModalSlideProgressSnapshot,
  nativeModalSlideProgressSnapshot,
  subscribeNativeModalSlideProgress,
} from './native-modal-slide-progress.ts'
import { gameBindingLabel, type GameControlBindings } from './game-settings.ts'
import { nativeTutorialSelectedHudLayoutFromCenters } from './native-hud-presentation.ts'
import {
  NativeUiText,
  NativeUiNineSlice,
  NativeUiSprite,
} from './native-ui/react-raw.ts'
import type { NativeUiFontName } from './native-ui/core.ts'
import type { ProtocolPlayerProgression } from './protocol/game-state.ts'
import {
  emptyTutorialHudAnchors,
  nativeTutorialHudAnchorAttributes,
  nativeTutorialHudPointerPlans,
  nativeTutorialHudTargetHeight,
  tutorialHudInstructionBaselines,
  tutorialClientRectAnchor,
  tutorialHudAnchorsEqual,
  type TutorialHudAnchorAttribute,
  type TutorialHudAnchors,
} from './tutorial-hud-anchors.ts'
import {
  TUTORIAL_CALLOUT_FONT,
  tutorialModalTeachingPlans,
  tutorialPointerVisible,
  type TutorialCalloutGeometry,
  type TutorialModalCalloutId,
  type TutorialModalPointerId,
} from './tutorial-modal-callouts.ts'
import TutorialPrelude from './TutorialPrelude.tsx'
import { useCoarsePointer } from './input/use-coarse-pointer.ts'
import './tutorial.css'

const TUTORIAL_GOLD = 0xd9ba70

interface TutorialOverlayProps {
  readonly audio: GameAudioDirector
  readonly controls: GameControlBindings
  readonly solomonPointer: Readonly<{
    toX: number
    toY: number
    x: number
    y: number
  }> | null
  readonly state: NativeTutorialState
  readonly viewport: Readonly<{ height: number; width: number }>
  readonly worldTarget: Readonly<{ x: number; y: number }> | null
}

export default function TutorialOverlay({
  audio,
  controls,
  solomonPointer,
  state,
  viewport,
  worldTarget,
}: TutorialOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const lastNarrationEventId = useRef(0)
  const coarsePointer = useCoarsePointer()
  const pointerBlink = useTutorialPointerBlink()
  const hudAnchors = useTutorialHudAnchors(overlayRef, state.stage, viewport)
  const hudPointers = nativeTutorialHudPointerPlans(state.stage, hudAnchors)
  const selectedHudLayout = hudAnchors.primarySkill && hudAnchors.concentrationA
    ? nativeTutorialSelectedHudLayoutFromCenters(
        hudAnchors.primarySkill,
        hudAnchors.concentrationA,
        hudAnchors.primarySkill.scale,
      )
    : null
  const presentation = nativeTutorialPresentation(state, {
    inventory: gameBindingLabel(controls.openInventory),
    moveDown: gameBindingLabel(controls.moveDown),
    moveLeft: gameBindingLabel(controls.moveLeft),
    moveRight: gameBindingLabel(controls.moveRight),
    moveUp: gameBindingLabel(controls.moveUp),
    potion: gameBindingLabel(controls.belt4),
    secondary: gameBindingLabel(controls.belt1),
    skills: gameBindingLabel(controls.openSkills),
  }, coarsePointer ? 'mobile' : 'desktop')
  const narration = state.narration.current
  const instructionBaselines = tutorialHudInstructionBaselines(
    state.stage,
    nativeTutorialInstructionBaselines(state.stage, viewport.height),
    hudAnchors,
  )
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
          <TutorialPointer anchor="selected-skills" {...selectedHudLayout.pointer} visible={pointerBlink} />
        </div>
      ) : null}
      {hudPointers.map((pointer) => (
        <TutorialPointer
          anchor={pointer.anchor}
          key={pointer.anchor}
          scale={pointer.scale}
          x={pointer.x}
          y={pointer.y}
          toX={pointer.target.x}
          toY={pointer.target.y}
          visible={pointer.blink ? pointerBlink : true}
        />
      ))}
      {!state.introActive && solomonPointer ? (
        <TutorialPointer
          anchor="solomon-dig"
          {...solomonPointer}
          visible={pointerBlink}
        />
      ) : null}
      {(state.stage === 8 || state.stage === 17) && worldPointerTarget ? (
        <TutorialPointer
          anchor="world-sack"
          x={worldPointerTarget.x - 20}
          y={worldPointerTarget.y - 60}
          toX={worldPointerTarget.x}
          toY={worldPointerTarget.y}
          visible={pointerBlink}
        />
      ) : null}
    </div>
  )
}

export function TutorialModalCallouts({
  backpack,
  controls,
  progression,
  stage,
}: {
  readonly backpack: readonly HubInventoryItem[]
  readonly controls: GameControlBindings
  readonly progression: ProtocolPlayerProgression
  readonly stage: NativeTutorialState['stage']
}) {
  const coarsePointer = useCoarsePointer()
  const pointerBlink = useTutorialPointerBlink()
  const modalSlides = useSyncExternalStore(
    subscribeNativeModalSlideProgress,
    nativeModalSlideProgressSnapshot,
    initialNativeModalSlideProgressSnapshot,
  )
  if (stage !== 10 && stage !== 13) return null
  const modalProgress = modalSlides[stage === 10 ? 'inventory' : 'skills']
  const plans = tutorialModalTeachingPlans({
    backpack,
    coarsePointer,
    modalProgress,
    progression,
    resumeBindingLabel: gameBindingLabel(stage === 10 ? controls.openInventory : controls.openSkills),
    stage,
  })
  return (
    <div
      className="tutorial-modal-callouts"
      data-modal-progress={modalProgress}
      data-stage={stage}
    >
      {plans.map((plan) => (plan.kind === 'callout' ? (
        <TutorialCallout geometry={plan.geometry} id={plan.id} key={`callout:${plan.id}`} />
      ) : (
        <TutorialPointer
          anchor={`modal-${plan.id}`}
          key={`pointer:${plan.id}`}
          toX={plan.toX}
          toY={plan.toY}
          visible={plan.blink ? pointerBlink : true}
          x={plan.x}
          y={plan.y}
        />
      )))}
    </div>
  )
}

function TutorialCallout({
  geometry,
  id,
}: {
  readonly geometry: TutorialCalloutGeometry
  readonly id: TutorialModalCalloutId
}) {
  const { frame, lines } = geometry
  return (
    <div
      className="tutorial-callout"
      data-center-x={geometry.centerX}
      data-center-y={geometry.centerY}
      data-tutorial-callout={id}
      style={{ height: frame.height, left: frame.x, top: frame.y, width: frame.width }}
    >
      <NativeUiNineSlice
        atlas="UI"
        height={frame.height}
        record={4}
        style={{ left: 0, top: 0 }}
        width={frame.width}
      />
      {lines.map((line, index) => (
        <NativeUiText
          className="tutorial-callout-text"
          font={TUTORIAL_CALLOUT_FONT}
          key={`${index}:${line.text}`}
          placement="baseline"
          style={{ left: line.x - frame.x, top: line.y - frame.y }}
          text={line.text}
          tint={TUTORIAL_GOLD}
        />
      ))}
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
  const sharedClassName = className
    ? `tutorial-instruction-text ${className}`
    : 'tutorial-instruction-text'
  return (
    <>
      <NativeUiText
        align="center"
        className={`${sharedClassName} tutorial-instruction-shadow`}
        font={font}
        placement="baseline"
        style={{
          left: typeof centerX === 'number' ? centerX + 2.25 : `calc(${centerX} + 2.25px)`,
          top: baseline + 2.25,
        }}
        text={text}
        tint={0x000000}
      />
      <NativeUiText
        align="center"
        className={sharedClassName}
        font={font}
        placement="baseline"
        style={{ left: centerX, top: baseline }}
        text={text}
        tint={TUTORIAL_GOLD}
      />
    </>
  )
}

function TutorialPointer({
  anchor,
  scale = 1,
  toX,
  toY,
  visible = true,
  x,
  y,
}: {
  readonly anchor?:
    | TutorialHudAnchorAttribute
    | 'selected-skills'
    | 'solomon-dig'
    | 'world-sack'
    | `modal-${TutorialModalPointerId}`
  readonly scale?: number
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
      data-pointer-scale={scale}
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
        transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`,
      }}
    >
      <NativeUiSprite atlas="UI" record={28} />
    </span>
  )
}

/**
 * `0x005C9BB0` blink state: the pointer is drawn iff `App+0x28 % 50 > 19`,
 * where `App+0x28` is the never-paused 100 Hz application tick. The web
 * derives that tick from the presentation clock (never from `stageTicks`,
 * which the single-player modal pause freezes) and re-renders only on the
 * hidden/visible edges.
 */
function useTutorialPointerBlink(): boolean {
  const [visible, setVisible] = useState(
    () => tutorialPointerVisible(true, nativeApplicationTick(performance.now())),
  )
  const visibleRef = useRef(visible)

  useEffect(() => subscribeGamePresentationFrames((now) => {
    const next = tutorialPointerVisible(true, nativeApplicationTick(now))
    if (next === visibleRef.current) return
    visibleRef.current = next
    setVisible(next)
  }), [])

  return visible
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
              nativeTutorialHudTargetHeight(name),
            )
          : null
      }
      const next = Object.freeze({
        concentrationA: anchor('concentration-a'),
        healthMeter: anchor('health-meter'),
        healthPotion: anchor('health-potion'),
        inventory: anchor('inventory'),
        primarySkill: anchor('primary-skill'),
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
