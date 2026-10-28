import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'

import {
  CREATE_ENTRY_ANIMATION_MS,
  CREATE_SELECTION_ANIMATION_MS,
  createDisciplineRevealMotionAt,
  createElementRevealMotionAt,
  createEntryMotionAt,
  createSelectionMotionAt,
} from './create-menu-motion.ts'
import { startCreateLoadoutFinalization, type CreateLoadoutCommit } from './create-loadout-finalization.ts'
import { finalizeNativeCreateLoadout, NATIVE_CREATE_ENTRY_FADE_MS } from './core-kernels/native-create-loadout.ts'
import { createNativeRng, type NativeRngState } from './core-kernels/native-rng.ts'
import type {
  WizardDiscipline,
  WizardDisciplineChoice,
  WizardElement,
} from './core-kernels/player-character.ts'
import {
  CREATE_WIZARD_NAME_MAX_LENGTH,
  finalizeCreateWizardName,
  randomStockWizardName,
  validateCreateWizardName,
} from './create-wizard-name.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import {
  createEntryAudioEvents,
  createSelectionAudioEvents,
  type CreateAudioEvent,
} from './game-audio-native.ts'
import { startGamePresentationLoop } from './game-presentation-frame-loop.ts'
import { nativeApplicationTick } from './native-application-tick.ts'
import {
  CREATE_DISCIPLINES,
  CREATE_RANDOMIZE_BOUNDS,
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
  backDisabled?: boolean
  displayName: string
  onBack: () => void
  onLoadoutCommit: () => void
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
  backDisabled = false,
  displayName,
  onBack,
  onLoadoutCommit,
  onStart,
  retainedLoadoutCanConfirm = false,
  retainedLoadout,
  viewport,
}: CreateMenuSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const rendererRef = useRef<CreateMenuRenderer | null>(null)
  const onStartRef = useRef(onStart)
  // A retained connection does not make the next wizard's name immutable.
  // Keep the draft with this Create instance, not with incoming snapshots.
  const [nameDraft, setNameDraft] = useState(() => retainedLoadout?.displayName ?? displayName)
  const activeDisplayNameRef = useRef(nameDraft)
  const pendingCommitRef = useRef<CreateLoadoutCommit | null>(null)
  const randomStateRef = useRef<NativeRngState | null>(null)
  const inputReadyRef = useRef(false)
  const selectedElementRef = useRef<WizardElement | null>(null)
  const hoveredActionRef = useRef<CreateMenuAction | null>(retainedLoadout?.element ?? null)
  const phaseStartedAtRef = useRef(0)
  const previousPhaseElapsedRef = useRef(0)
  const elementButtonsRef = useRef<Partial<Record<WizardElement, HTMLButtonElement>>>({})
  const disciplineButtonsRef = useRef<Partial<Record<WizardDisciplineChoice, HTMLButtonElement>>>({})
  const uiStateRef = useRef({ disciplinesVisible: false, elementsVisible: false, settled: false })
  const viewportRef = useRef(viewport)
  const [elementsVisible, setElementsVisible] = useState(false)
  const [disciplinesVisible, setDisciplinesVisible] = useState(false)
  const [motionSettled, setMotionSettled] = useState(false)
  const [selectedElement, setSelectedElement] = useState<WizardElement | null>(null)
  const [pendingCommit, setPendingCommit] = useState<CreateLoadoutCommit | null>(null)
  const [inputReady, setInputReady] = useState(false)
  const [nameValidationMessage, setNameValidationMessage] = useState<string | null>(null)
  const [rendererError, setRendererError] = useState<string | null>(null)
  onStartRef.current = onStart
  const nameLocked = pendingCommit !== null
    || Boolean(retainedLoadout && !retainedLoadoutCanConfirm)
  const activeDisplayName = retainedLoadout && !retainedLoadoutCanConfirm
    ? retainedLoadout.displayName
    : nameDraft
  activeDisplayNameRef.current = activeDisplayName
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
      renderer.mount(host)
      renderer.resize(viewportRef.current)
      const sceneStartedAt = performance.now()
      phaseStartedAtRef.current = sceneStartedAt
      previousPhaseElapsedRef.current = 0

      stopPresentationLoop = startGamePresentationLoop((now) => {
        const selected = selectedElementRef.current
        const phase = selected ? 'discipline' : 'element'
        const pending = pendingCommitRef.current
        const presentationNow = pending?.kind === 'randomize' ? pending.startedAtMs : now
        const phaseElapsedMs = presentationNow - phaseStartedAtRef.current
        if (!inputReadyRef.current && now - sceneStartedAt >= NATIVE_CREATE_ENTRY_FADE_MS) {
          inputReadyRef.current = true
          setInputReady(true)
        }
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
          applicationTick: nativeApplicationTick(now),
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
      inputReadyRef.current = false
    }
  }, [audio])

  useEffect(() => () => {
    audio.pauseStream('start-cast')
    audio.pauseStream('choose-element')
  }, [audio])

  useEffect(() => {
    if (!pendingCommit) return
    return startCreateLoadoutFinalization({
      ...pendingCommit,
      requestFrame: callback => window.requestAnimationFrame(callback),
      cancelFrame: handle => window.cancelAnimationFrame(handle),
      onManualFinalize: () => audio.playStream('catch-it'),
      onStart: config => onStartRef.current(config.displayName, config.element, config.discipline),
      onRelease: () => {
        if (pendingCommit.kind === 'randomize') {
          phaseStartedAtRef.current += performance.now() - pendingCommit.startedAtMs
        }
        pendingCommitRef.current = null
        setPendingCommit(null)
      },
    })
  }, [audio, pendingCommit])

  const beginCommit = (commit: CreateLoadoutCommit) => {
    // The ref closes the same-event/repeated-key window before React rerenders.
    if (pendingCommitRef.current) return
    pendingCommitRef.current = commit
    onLoadoutCommit()
    setPendingCommit(commit)
  }

  const selectElement = (element: WizardElement) => {
    if (selectedElementRef.current || pendingCommitRef.current || nameLocked || !elementsVisible) return
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

  const selectDiscipline = (discipline: WizardDisciplineChoice) => {
    const name = finalizeCreateWizardName(activeDisplayNameRef.current)
    if (!name.ok) return
    if (
      !selectedElementRef.current
      || pendingCommitRef.current
      || !disciplinesVisible
      || Boolean(retainedLoadout && !retainedLoadoutCanConfirm)
    ) return
    audio.playSound('pick-skill')
    beginCommit({
      config: { displayName: name.value, element: selectedElementRef.current, discipline },
      kind: 'manual',
      startedAtMs: performance.now(),
    })
  }

  const randomizeLoadout = () => {
    if (!inputReadyRef.current || pendingCommitRef.current || nameLocked || rendererError) return
    const name = finalizeCreateWizardName(activeDisplayNameRef.current)
    if (!name.ok) return
    const source = randomStateRef.current ?? createNativeRng(crypto.getRandomValues(new Uint32Array(1))[0]!)
    const result = finalizeNativeCreateLoadout(source, {
      displayName: name.value,
      element: selectedElementRef.current,
      discipline: null,
    })
    randomStateRef.current = result.state
    audio.playSound('click')
    beginCommit({ config: result.config, kind: 'randomize', startedAtMs: performance.now() })
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
  const nativeDiceStageStyle = nativeStageStyle(
    viewport,
    fixedGameStageBounds(viewport, 'right', 'top'),
  )
  const nativeNameStageStyle = nativeStageStyle(
    viewport,
    fixedGameStageBounds(viewport, 'center', 'top'),
  )
  const nativeActionStageStyle = nativeStageStyle(
    viewport,
    fixedGameStageBounds(viewport, 'center', 'bottom'),
  )
  const nameValidation = finalizeCreateWizardName(activeDisplayName)

  const updateDisplayName = (nextName: string) => {
    if (nameLocked || pendingCommitRef.current) return
    if (nextName.length === 0) {
      setNameDraft('')
      setNameValidationMessage(null)
      return
    }
    const validation = validateCreateWizardName(nextName)
    if (!validation.ok) {
      setNameValidationMessage(validation.reason)
      return
    }
    setNameValidationMessage(null)
    setNameDraft(validation.value)
  }

  const clearWizardName = () => {
    if (nameLocked || pendingCommitRef.current) return
    audio.playSound('click')
    setNameDraft('')
    setNameValidationMessage(null)
    nameInputRef.current?.focus({ preventScroll: true })
  }

  const randomizeWizardName = () => {
    if (nameLocked || pendingCommitRef.current) return
    audio.playSound('click')
    setNameValidationMessage(null)
    setNameDraft(randomStockWizardName())
    nameInputRef.current?.focus({ preventScroll: true })
  }

  return (
    <div
      ref={sceneRef}
      className="create-menu-scene"
      data-phase={selectedElement ? 'discipline' : 'element'}
      data-element={selectedElement ?? undefined}
      data-finalizing={pendingCommit !== null}
      data-finalizing-kind={pendingCommit?.kind}
      data-input-ready={inputReady}
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
          disabled={backDisabled || pendingCommit !== null || Boolean(retainedLoadout)}
          onBlur={() => highlight(null)}
          onClick={() => { if (!pendingCommitRef.current) onBack() }}
          onFocus={() => highlight('back')}
          onPointerDown={(event) => {
            if (event.button === 0) playBackPress()
          }}
          onPointerEnter={() => highlight('back')}
          onPointerLeave={() => highlight(null)}
          onKeyDown={playBackPress}
        />
      </div>

      <div className="create-menu-native-stage create-menu-native-dice-stage" style={nativeDiceStageStyle}>
        <button
          type="button"
          aria-label="Randomize wizard loadout"
          title="Randomize choices and keep your name"
          className="create-menu-randomize"
          data-game-create-randomize="true"
          disabled={!inputReady || nameLocked || !nameValidation.ok || Boolean(rendererError)}
          onClick={randomizeLoadout}
          style={{
            left: CREATE_RANDOMIZE_BOUNDS.left,
            top: CREATE_RANDOMIZE_BOUNDS.top,
            width: CREATE_RANDOMIZE_BOUNDS.width,
            height: CREATE_RANDOMIZE_BOUNDS.height,
          }}
        />
      </div>

      <div className="create-menu-native-stage create-menu-native-name-stage" style={nativeNameStageStyle}>
        <input
          aria-describedby="create-menu-name-validation"
          aria-invalid={!nameValidation.ok || undefined}
          aria-label="Wizard name"
          autoCapitalize="characters"
          autoComplete="off"
          className="create-menu-name-input"
          maxLength={CREATE_WIZARD_NAME_MAX_LENGTH}
          onChange={(event) => updateDisplayName(event.target.value)}
          ref={nameInputRef}
          readOnly={nameLocked}
          spellCheck={false}
          type="text"
          value={activeDisplayName}
        />
        <button
          type="button"
          aria-label="Clear wizard name"
          className="create-menu-name-clear"
          data-game-name-clear="true"
          disabled={nameLocked}
          onClick={clearWizardName}
          title="Clear wizard name"
        />
        <button
          type="button"
          aria-label="Randomize wizard name"
          className="create-menu-name-randomize"
          data-game-name-randomize="true"
          disabled={nameLocked}
          onClick={randomizeWizardName}
          title="Randomize wizard name"
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
              data-game-default-focus={(retainedLoadout
                ? element === retainedLoadout.element
                : element === 'earth') || undefined}
              disabled={!elementsVisible || selectedElement !== null || nameLocked}
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
                || pendingCommit !== null
                || !nameValidation.ok
                || Boolean(retainedLoadout && !retainedLoadoutCanConfirm)
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
  buttons: Partial<Record<WizardDisciplineChoice, HTMLButtonElement>>,
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
