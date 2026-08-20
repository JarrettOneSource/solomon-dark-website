import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

import {
  CREATE_ENTRY_ANIMATION_MS,
  CREATE_SELECTION_ANIMATION_MS,
  createDisciplineRevealMotionAt,
  createElementRevealMotionAt,
  createEntryMotionAt,
  createSelectionMotionAt,
} from './create-menu-motion.ts'
import type {
  WizardDiscipline,
  WizardElement,
} from './core-kernels/player-character.ts'
import { validateCreateWizardName } from './create-wizard-name.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import {
  CREATE_DISCIPLINE_FINALIZE_MS,
  createEntryAudioEvents,
  createSelectionAudioEvents,
  type CreateAudioEvent,
} from './game-audio-native.ts'
import { startGamePresentationLoop } from './game-presentation-frame-loop.ts'
import {
  CREATE_DISCIPLINES,
  CREATE_ELEMENTS,
} from './renderer/create-menu-render-contract.ts'
import {
  createCreateMenuRenderer,
  type CreateMenuAction,
  type CreateMenuRenderer,
} from './renderer/create-menu-renderer.ts'
import {
  fixedGameStageBounds,
  fixedGameStageCssBounds,
  type FixedGameViewportLayout,
  type GameViewportBounds,
} from './renderer/game-viewport.ts'

interface CreateMenuSceneProps {
  audio: GameAudioDirector
  displayName: string
  onBack: () => void
  onDisplayNameChange: (displayName: string) => void
  onDisciplineCommit: () => void
  onStart: (
    displayName: string,
    element: WizardElement,
    discipline: WizardDiscipline,
  ) => Promise<boolean>
  retainedLoadoutCanConfirm?: boolean
  retainedLoadout?: Readonly<{
    discipline: WizardDiscipline
    displayName: string
    element: WizardElement
  }>
  viewport: FixedGameViewportLayout
}

function playCreateAudioEvents(audio: GameAudioDirector, events: readonly CreateAudioEvent[]): void {
  for (const event of events) {
    if (event.action === 'play-sound') audio.playSound(event.cue)
    else if (event.action === 'play-stream') audio.playStream(event.cue)
    else audio.pauseStream(event.cue)
  }
}

export default function CreateMenuScene({
  audio,
  displayName,
  onBack,
  onDisplayNameChange,
  onDisciplineCommit,
  onStart,
  retainedLoadoutCanConfirm = false,
  retainedLoadout,
  viewport,
}: CreateMenuSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<CreateMenuRenderer | null>(null)
  const onStartRef = useRef(onStart)
  const activeDisplayNameRef = useRef(retainedLoadout?.displayName ?? displayName)
  const selectedElementRef = useRef<WizardElement | null>(retainedLoadout?.element ?? null)
  const hoveredActionRef = useRef<CreateMenuAction | null>(null)
  const phaseStartedAtRef = useRef(0)
  const previousPhaseElapsedRef = useRef(0)
  const elementButtonsRef = useRef<Partial<Record<WizardElement, HTMLButtonElement>>>({})
  const disciplineButtonsRef = useRef<Partial<Record<WizardDiscipline, HTMLButtonElement>>>({})
  const uiStateRef = useRef({ disciplinesVisible: false, elementsVisible: false, settled: false })
  const viewportRef = useRef(viewport)
  const [elementsVisible, setElementsVisible] = useState(false)
  const [disciplinesVisible, setDisciplinesVisible] = useState(false)
  const [motionSettled, setMotionSettled] = useState(false)
  const [selectedElement, setSelectedElement] = useState<WizardElement | null>(
    retainedLoadout?.element ?? null,
  )
  const [pendingDiscipline, setPendingDiscipline] = useState<WizardDiscipline | null>(null)
  const [nameValidationMessage, setNameValidationMessage] = useState<string | null>(null)
  const [rendererError, setRendererError] = useState<string | null>(null)
  onStartRef.current = onStart
  activeDisplayNameRef.current = retainedLoadout?.displayName ?? displayName
  viewportRef.current = viewport

  useEffect(() => rendererRef.current?.resize(viewport), [viewport])

  useEffect(() => {
    const host = hostRef.current
    const scene = sceneRef.current
    if (!host || !scene) return
    let cancelled = false
    let stopPresentationLoop: (() => void) | null = null
    let previousSemanticPhase: 'discipline' | 'element' | null = null
    let previousSemanticTick = -1
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setRendererError(null)

    void createCreateMenuRenderer({
      viewport: viewportRef.current,
    }).then((renderer) => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      host.replaceChildren(renderer.canvas)
      renderer.resize(viewportRef.current)
      const sceneStartedAt = performance.now()
      phaseStartedAtRef.current = sceneStartedAt
      previousPhaseElapsedRef.current = 0

      stopPresentationLoop = startGamePresentationLoop((now) => {
        const selected = selectedElementRef.current
        const phase = selected ? 'discipline' : 'element'
        const phaseElapsedMs = now - phaseStartedAtRef.current
        const motionDuration = selected
          ? CREATE_SELECTION_ANIMATION_MS
          : CREATE_ENTRY_ANIMATION_MS
        const motionElapsedMs = Math.min(phaseElapsedMs, motionDuration)
        const motion = selected
          ? createSelectionMotionAt(motionElapsedMs)
          : createEntryMotionAt(motionElapsedMs)

        playCreateAudioEvents(
          audio,
          selected
            ? createSelectionAudioEvents(
              selected,
              previousPhaseElapsedRef.current,
              phaseElapsedMs,
            )
            : createEntryAudioEvents(previousPhaseElapsedRef.current, phaseElapsedMs),
        )
        previousPhaseElapsedRef.current = phaseElapsedMs

        if (motion.elementsVisible !== uiStateRef.current.elementsVisible) {
          uiStateRef.current.elementsVisible = motion.elementsVisible
          setElementsVisible(motion.elementsVisible)
        }
        if (motion.disciplinesVisible !== uiStateRef.current.disciplinesVisible) {
          uiStateRef.current.disciplinesVisible = motion.disciplinesVisible
          setDisciplinesVisible(motion.disciplinesVisible)
        }
        const settled = phaseElapsedMs >= motionDuration
        if (settled !== uiStateRef.current.settled) {
          uiStateRef.current.settled = settled
          setMotionSettled(settled)
        }

        const semanticTick = Math.floor(motionElapsedMs / 10)
        if (phase !== previousSemanticPhase || semanticTick !== previousSemanticTick) {
          updateSemanticElementBounds(elementButtonsRef.current, motionElapsedMs)
          updateSemanticDisciplineBounds(disciplineButtonsRef.current, motionElapsedMs)
          previousSemanticPhase = phase
          previousSemanticTick = semanticTick
        }
        renderer.render({
          displayName: activeDisplayNameRef.current,
          hoveredAction: hoveredActionRef.current,
          phase,
          phaseElapsedMs,
          reducedMotion,
          sceneElapsedMs: now - sceneStartedAt,
          selectedElement: selected,
        })
      })
    }).catch((error: unknown) => {
      if (!cancelled) {
        setRendererError(error instanceof Error
          ? error.message
          : 'The WebGL loadout renderer could not start.')
      }
    })

    return () => {
      cancelled = true
      stopPresentationLoop?.()
      rendererRef.current?.destroy()
      rendererRef.current = null
      host.replaceChildren()
    }
  }, [audio])

  useEffect(() => () => {
    audio.pauseStream('start-cast')
    audio.pauseStream('choose-element')
  }, [audio])

  useEffect(() => {
    if (!pendingDiscipline || !selectedElement) return
    const startedAt = performance.now()
    let animationFrame = 0
    let active = true
    const update = (now: number) => {
      if (now - startedAt < CREATE_DISCIPLINE_FINALIZE_MS) {
        animationFrame = requestAnimationFrame(update)
        return
      }
      audio.playStream('catch-it')
      void onStartRef.current(
        activeDisplayNameRef.current,
        selectedElement,
        pendingDiscipline,
      ).then((started) => {
        if (active && !started) setPendingDiscipline(null)
      })
    }
    animationFrame = requestAnimationFrame(update)
    return () => {
      active = false
      cancelAnimationFrame(animationFrame)
    }
  }, [audio, pendingDiscipline, selectedElement])

  const selectElement = (element: WizardElement) => {
    if (selectedElementRef.current || pendingDiscipline || !elementsVisible) return
    audio.playSound('pick-skill')
    const now = performance.now()
    selectedElementRef.current = element
    phaseStartedAtRef.current = now
    previousPhaseElapsedRef.current = 0
    uiStateRef.current = { disciplinesVisible: false, elementsVisible: false, settled: false }
    setElementsVisible(false)
    setDisciplinesVisible(false)
    setMotionSettled(false)
    setSelectedElement(element)
  }

  const selectDiscipline = (discipline: WizardDiscipline) => {
    if (!validateCreateWizardName(activeDisplayNameRef.current).ok) return
    if (
      !selectedElementRef.current
      || pendingDiscipline
      || !disciplinesVisible
      || Boolean(retainedLoadout && !retainedLoadoutCanConfirm)
      || Boolean(retainedLoadout && discipline !== retainedLoadout.discipline)
    ) return
    audio.playSound('pick-skill')
    onDisciplineCommit()
    setPendingDiscipline(discipline)
  }

  const playBackPress = (event?: KeyboardEvent<HTMLButtonElement>) => {
    if (event && (event.repeat || (event.key !== 'Enter' && event.key !== ' '))) return
    audio.playSound('click')
  }

  const highlight = (action: CreateMenuAction | null) => {
    hoveredActionRef.current = action
  }

  const nativeBackStageStyle = nativeStageStyle(
    viewport,
    fixedGameStageBounds(viewport, 'left', 'top'),
  )
  const nativeNameStageStyle = nativeStageStyle(
    viewport,
    fixedGameStageBounds(viewport, 'center', 'top'),
  )
  const nativeActionStageStyle = nativeStageStyle(
    viewport,
    fixedGameStageBounds(viewport, 'center', 'bottom'),
  )
  const activeDisplayName = retainedLoadout?.displayName ?? displayName
  const nameValidation = validateCreateWizardName(activeDisplayName)

  const updateDisplayName = (nextName: string) => {
    if (retainedLoadout) return
    if (nextName.length === 0) {
      onDisplayNameChange('')
      setNameValidationMessage('Enter a wizard name.')
      return
    }
    const validation = validateCreateWizardName(nextName)
    if (!validation.ok) {
      setNameValidationMessage(validation.reason)
      return
    }
    setNameValidationMessage(null)
    onDisplayNameChange(validation.value)
  }

  return (
    <div
      ref={sceneRef}
      className="create-menu-scene"
      data-phase={selectedElement ? 'discipline' : 'element'}
      data-element={selectedElement ?? undefined}
      data-finalizing={pendingDiscipline !== null}
      data-motion-settled={motionSettled}
      data-retained-loadout={Boolean(retainedLoadout) || undefined}
      data-retained-loadout-can-confirm={retainedLoadout
        ? retainedLoadoutCanConfirm
        : undefined}
      aria-label={retainedLoadout ? 'Confirm retained wizard loadout' : 'New wizard loadout selection'}
    >
      <div ref={hostRef} className="create-menu-renderer" aria-hidden />
      {rendererError && (
        <div className="main-menu-renderer-error" role="alert">{rendererError}</div>
      )}

      <div className="create-menu-native-stage create-menu-native-back-stage" style={nativeBackStageStyle}>
        <button
          type="button"
          className="create-menu-back"
          aria-label="Back"
          data-game-back="true"
          disabled={pendingDiscipline !== null || Boolean(retainedLoadout)}
          onBlur={() => highlight(null)}
          onClick={onBack}
          onFocus={() => highlight('back')}
          onPointerDown={(event) => {
            if (event.button === 0) playBackPress()
          }}
          onPointerEnter={() => highlight('back')}
          onPointerLeave={() => highlight(null)}
          onKeyDown={playBackPress}
        />
      </div>

      <div className="create-menu-native-stage create-menu-native-name-stage" style={nativeNameStageStyle}>
        <input
          aria-describedby="create-menu-name-validation"
          aria-invalid={(!nameValidation.ok || nameValidationMessage !== null) || undefined}
          aria-label="Wizard name"
          autoCapitalize="characters"
          autoComplete="off"
          className="create-menu-name-input"
          maxLength={64}
          onChange={(event) => updateDisplayName(event.target.value)}
          readOnly={Boolean(retainedLoadout)}
          spellCheck={false}
          type="text"
          value={activeDisplayName}
        />
        <div id="create-menu-name-validation" className="create-menu-name-validation" role="status">
          {nameValidationMessage ?? (!nameValidation.ok ? nameValidation.reason : '')}
        </div>
      </div>

      <div className="create-menu-native-stage create-menu-native-action-stage" style={nativeActionStageStyle}>
        <div
          className="create-menu-elements"
          data-visible={elementsVisible}
          aria-label="Choose your element"
        >
          {CREATE_ELEMENTS.map((element) => (
            <button
              key={element}
              ref={(node) => {
                if (node) elementButtonsRef.current[element] = node
                else delete elementButtonsRef.current[element]
              }}
              type="button"
              className={`create-menu-element create-menu-element-${element}`}
              aria-label={element}
              data-game-default-focus={element === 'earth' || undefined}
              disabled={!elementsVisible || selectedElement !== null}
              onBlur={() => highlight(null)}
              onClick={() => selectElement(element)}
              onFocus={() => highlight(element)}
              onPointerEnter={() => highlight(element)}
              onPointerLeave={() => highlight(null)}
            />
          ))}
        </div>

        <div
          className="create-menu-disciplines"
          data-visible={disciplinesVisible}
          aria-label="Choose your discipline"
        >
          {CREATE_DISCIPLINES.map((discipline) => (
            <button
              key={discipline}
              ref={(node) => {
                if (node) disciplineButtonsRef.current[discipline] = node
                else delete disciplineButtonsRef.current[discipline]
              }}
              type="button"
              className={`create-menu-discipline create-menu-discipline-${discipline}`}
              aria-label={discipline}
              data-game-default-focus={(retainedLoadout
                ? discipline === retainedLoadout.discipline
                : discipline === 'arcane') || undefined}
              disabled={
                !disciplinesVisible
                || pendingDiscipline !== null
                || !nameValidation.ok
                || Boolean(retainedLoadout && !retainedLoadoutCanConfirm)
                || Boolean(retainedLoadout && discipline !== retainedLoadout.discipline)
              }
              onBlur={() => highlight(null)}
              onClick={() => selectDiscipline(discipline)}
              onFocus={() => highlight(discipline)}
              onPointerEnter={() => highlight(discipline)}
              onPointerLeave={() => highlight(null)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function nativeStageStyle(
  viewport: FixedGameViewportLayout,
  stage: GameViewportBounds,
): CSSProperties {
  const css = fixedGameStageCssBounds(viewport, stage)
  return {
    height: `${stage.height}px`,
    transform: `translate3d(${css.x}px, ${css.y}px, 0) scale(${viewport.displayScale})`,
    width: `${stage.width}px`,
  }
}

function updateSemanticElementBounds(
  buttons: Partial<Record<WizardElement, HTMLButtonElement>>,
  elapsedMs: number,
): void {
  for (const element of CREATE_ELEMENTS) {
    const button = buttons[element]
    if (!button) continue
    const reveal = createElementRevealMotionAt(element, elapsedMs)
    button.style.left = `${reveal.position.x / 16}cqw`
    button.style.top = `${reveal.position.y / 9}cqh`
  }
}

function updateSemanticDisciplineBounds(
  buttons: Partial<Record<WizardDiscipline, HTMLButtonElement>>,
  elapsedMs: number,
): void {
  for (const discipline of CREATE_DISCIPLINES) {
    const button = buttons[discipline]
    if (!button) continue
    const position = createDisciplineRevealMotionAt(discipline, elapsedMs)
    button.style.left = `${position.x / 16}cqw`
    button.style.top = `${position.y / 9}cqh`
  }
}
