import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

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
import type { GameAudioDirector } from './game-audio-director.ts'
import {
  CREATE_DISCIPLINE_FINALIZE_MS,
  createEntryAudioEvents,
  createSelectionAudioEvents,
  type CreateAudioEvent,
} from './game-audio-native.ts'
import {
  CREATE_DISCIPLINES,
  CREATE_ELEMENTS,
} from './renderer/create-menu-render-contract.ts'
import {
  createCreateMenuRenderer,
  type CreateMenuAction,
  type CreateMenuRenderer,
} from './renderer/create-menu-renderer.ts'
import { fixedGameViewportScale } from './renderer/game-viewport.ts'

interface CreateMenuSceneProps {
  audio: GameAudioDirector
  onBack: () => void
  onStart: (element: WizardElement, discipline: WizardDiscipline) => Promise<boolean>
}

function playCreateAudioEvents(audio: GameAudioDirector, events: readonly CreateAudioEvent[]): void {
  for (const event of events) {
    if (event.action === 'play-sound') audio.playSound(event.cue)
    else if (event.action === 'play-stream') audio.playStream(event.cue)
    else audio.pauseStream(event.cue)
  }
}

export default function CreateMenuScene({ audio, onBack, onStart }: CreateMenuSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<CreateMenuRenderer | null>(null)
  const onStartRef = useRef(onStart)
  const selectedElementRef = useRef<WizardElement | null>(null)
  const hoveredActionRef = useRef<CreateMenuAction | null>(null)
  const phaseStartedAtRef = useRef(0)
  const previousPhaseElapsedRef = useRef(0)
  const elementButtonsRef = useRef<Partial<Record<WizardElement, HTMLButtonElement>>>({})
  const disciplineButtonsRef = useRef<Partial<Record<WizardDiscipline, HTMLButtonElement>>>({})
  const uiStateRef = useRef({ disciplinesVisible: false, elementsVisible: false, settled: false })
  const [elementsVisible, setElementsVisible] = useState(false)
  const [disciplinesVisible, setDisciplinesVisible] = useState(false)
  const [motionSettled, setMotionSettled] = useState(false)
  const [selectedElement, setSelectedElement] = useState<WizardElement | null>(null)
  const [pendingDiscipline, setPendingDiscipline] = useState<WizardDiscipline | null>(null)
  const [rendererError, setRendererError] = useState<string | null>(null)
  onStartRef.current = onStart

  useLayoutEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const resize = () => {
      rendererRef.current?.resize(fixedGameViewportScale(scene.clientWidth, scene.clientHeight))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(scene)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    const scene = sceneRef.current
    if (!host || !scene) return
    let cancelled = false
    let animationFrame = 0
    let previousSemanticPhase: 'discipline' | 'element' | null = null
    let previousSemanticTick = -1
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setRendererError(null)

    void createCreateMenuRenderer({
      displayScale: fixedGameViewportScale(scene.clientWidth, scene.clientHeight),
    }).then((renderer) => {
      if (cancelled) {
        renderer.destroy()
        return
      }
      rendererRef.current = renderer
      host.replaceChildren(renderer.canvas)
      renderer.resize(fixedGameViewportScale(scene.clientWidth, scene.clientHeight))
      const sceneStartedAt = performance.now()
      phaseStartedAtRef.current = sceneStartedAt
      previousPhaseElapsedRef.current = 0

      const animate = (now: number) => {
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
          hoveredAction: hoveredActionRef.current,
          phase,
          phaseElapsedMs,
          reducedMotion,
          sceneElapsedMs: now - sceneStartedAt,
          selectedElement: selected,
        })
        animationFrame = requestAnimationFrame(animate)
      }
      animationFrame = requestAnimationFrame(animate)
    }).catch((error: unknown) => {
      if (!cancelled) {
        setRendererError(error instanceof Error
          ? error.message
          : 'The WebGL loadout renderer could not start.')
      }
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrame)
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
      void onStartRef.current(selectedElement, pendingDiscipline).then((started) => {
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
    if (!selectedElementRef.current || pendingDiscipline || !disciplinesVisible) return
    audio.playSound('pick-skill')
    setPendingDiscipline(discipline)
  }

  const playBackPress = (event?: KeyboardEvent<HTMLButtonElement>) => {
    if (event && (event.repeat || (event.key !== 'Enter' && event.key !== ' '))) return
    audio.playSound('click')
  }

  const highlight = (action: CreateMenuAction | null) => {
    hoveredActionRef.current = action
  }

  return (
    <div
      ref={sceneRef}
      className="create-menu-scene"
      data-phase={selectedElement ? 'discipline' : 'element'}
      data-element={selectedElement ?? undefined}
      data-finalizing={pendingDiscipline !== null}
      data-motion-settled={motionSettled}
      aria-label="New wizard loadout selection"
    >
      <div ref={hostRef} className="create-menu-renderer" aria-hidden />
      {rendererError && (
        <div className="main-menu-renderer-error" role="alert">{rendererError}</div>
      )}

      <button
        type="button"
        className="create-menu-back"
        aria-label="Back"
        data-game-back="true"
        disabled={pendingDiscipline !== null}
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

      <div className="create-menu-name-semantic" aria-label="Wizard name: Helvidius" />

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
            data-game-default-focus={discipline === 'arcane' || undefined}
            disabled={!disciplinesVisible || pendingDiscipline !== null}
            onBlur={() => highlight(null)}
            onClick={() => selectDiscipline(discipline)}
            onFocus={() => highlight(discipline)}
            onPointerEnter={() => highlight(discipline)}
            onPointerLeave={() => highlight(null)}
          />
        ))}
      </div>
    </div>
  )
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
