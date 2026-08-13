import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { createMenu } from '../lib/assets'
import ElementVfx from './ElementVfx'
import {
  CREATE_ENTRY_SETTLED_MS,
  CREATE_SELECTION_SETTLED_MS,
  createEntryMotionAt,
  createHandIdleOffsetAt,
  createSelectedElementMotionAt,
  createSelectionMotionAt,
  type CreateHandPose,
} from './create-menu-motion'
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

interface CreateMenuSceneProps {
  audio: GameAudioDirector
  onBack: () => void
  onStart: (element: WizardElement, discipline: WizardDiscipline) => Promise<boolean>
}

const HAND_SOURCE: Record<CreateHandPose, string> = {
  cupped: createMenu.handCupped,
  fist: createMenu.handFist,
  raised: createMenu.handRaised,
}

const FALLING_STARS = Array.from({ length: 50 }, (_, index) => ({
  delay: (index * 0.067) % 1.25,
  duration: 2.6 + (index * 0.19) % 2.1,
  large: index % 5 === 0,
  scale: 0.55 + (index * 0.23) % 0.9,
  x: (11 + index * 37) % 98,
  y: (5 + index * 29) % 92,
}))

function playCreateAudioEvents(audio: GameAudioDirector, events: readonly CreateAudioEvent[]): void {
  for (const event of events) {
    if (event.action === 'play-sound') audio.playSound(event.cue)
    else if (event.action === 'play-stream') audio.playStream(event.cue)
    else audio.pauseStream(event.cue)
  }
}

export default function CreateMenuScene({ audio, onBack, onStart }: CreateMenuSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const onStartRef = useRef(onStart)
  const [handsReady, setHandsReady] = useState(false)
  const [motionMs, setMotionMs] = useState(0)
  const [selectedElement, setSelectedElement] = useState<WizardElement | null>(null)
  const [pendingDiscipline, setPendingDiscipline] = useState<WizardDiscipline | null>(null)
  onStartRef.current = onStart

  useEffect(() => {
    let mounted = true
    const handImages = [
      createMenu.handFist,
      createMenu.handCupped,
      createMenu.handRaised,
    ].map((source) => {
      const image = new Image()
      image.src = source
      return image.decode()
    })
    void Promise.all(handImages).then(() => {
      if (mounted) setHandsReady(true)
    })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!handsReady) return

    const startedAt = performance.now()
    const duration = selectedElement
      ? CREATE_SELECTION_SETTLED_MS
      : CREATE_ENTRY_SETTLED_MS
    let animationFrame = 0
    let previousElapsed = 0

    const update = (now: number) => {
      const elapsed = Math.min(now - startedAt, duration)
      playCreateAudioEvents(
        audio,
        selectedElement
          ? createSelectionAudioEvents(selectedElement, previousElapsed, elapsed)
          : createEntryAudioEvents(previousElapsed, elapsed),
      )
      setMotionMs(elapsed)
      previousElapsed = elapsed
      if (elapsed < duration) animationFrame = requestAnimationFrame(update)
    }

    setMotionMs(0)
    animationFrame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationFrame)
  }, [audio, handsReady, selectedElement])

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

  useEffect(() => {
    if (!handsReady) return

    const startedAt = performance.now()
    let animationFrame = 0

    const update = (now: number) => {
      const { x, y } = createHandIdleOffsetAt(now - startedAt)
      sceneRef.current?.style.setProperty('--create-hand-idle-x', `${x / 16}cqw`)
      sceneRef.current?.style.setProperty('--create-hand-idle-y', `${y / 9}cqh`)
      animationFrame = requestAnimationFrame(update)
    }

    animationFrame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationFrame)
  }, [handsReady])

  const motion = selectedElement
    ? createSelectionMotionAt(motionMs)
    : createEntryMotionAt(motionMs)
  const selectedElementMotion = selectedElement
    ? createSelectedElementMotionAt(selectedElement, motionMs)
    : null
  const selectElement = (element: WizardElement) => {
    if (selectedElement || pendingDiscipline) return
    audio.playSound('pick-skill')
    setMotionMs(0)
    setSelectedElement(element)
  }

  const selectDiscipline = (discipline: WizardDiscipline) => {
    if (!selectedElement || pendingDiscipline) return
    audio.playSound('pick-skill')
    setPendingDiscipline(discipline)
  }

  const playBackPress = (event?: KeyboardEvent<HTMLButtonElement>) => {
    if (event && (event.repeat || (event.key !== 'Enter' && event.key !== ' '))) return
    audio.playSound('click')
  }

  return (
    <div
      ref={sceneRef}
      className="create-menu-scene"
      data-phase={selectedElement ? 'discipline' : 'element'}
      data-element={selectedElement ?? undefined}
      data-hands-ready={handsReady}
      data-finalizing={pendingDiscipline !== null}
      data-motion-settled={motion.settled}
      aria-label="New wizard loadout selection"
    >
      <button
        type="button"
        className="create-menu-back"
        aria-label="Back"
        disabled={pendingDiscipline !== null}
        onClick={onBack}
        onPointerDown={(event) => {
          if (event.button === 0) playBackPress()
        }}
        onKeyDown={playBackPress}
      >
        <img src={createMenu.backSkull} alt="" />
      </button>

      <div className="create-menu-name" aria-label="Wizard name: Helvidius">
        <div className="create-menu-name-field" />
        <img src={createMenu.nameRail} alt="" className="create-menu-name-rail" />
        <img src={createMenu.nameEnd} alt="" className="create-menu-name-end create-menu-name-end-left" />
        <img src={createMenu.nameEnd} alt="" className="create-menu-name-end create-menu-name-end-right" />
        <img src={createMenu.textNameCaption} alt="Wizard name" className="create-menu-name-caption" />
        <img src={createMenu.textName} alt="Helvidius" className="create-menu-name-value" />
        <img src={createMenu.textNameCaret} alt="" className="create-menu-name-caret" />
      </div>

      <img src={createMenu.dice} alt="" className="create-menu-dice" />

      <img src={createMenu.arcaneWheel} alt="" className="create-menu-wheel" />

      <span
        className="create-menu-hand-layer create-menu-hand-layer-left"
        data-pose={motion.leftPose}
        style={{
          '--create-hand-travel-x': `${motion.leftOffset.x / 16}cqw`,
          '--create-hand-travel-y': `${motion.leftOffset.y / 9}cqh`,
          '--create-hand-impulse-x': `${motion.leftImpulse.x / 16}cqw`,
          '--create-hand-impulse-y': `${motion.leftImpulse.y / 9}cqh`,
        } as CSSProperties}
        aria-hidden
      >
        <img src={HAND_SOURCE[motion.leftPose]} alt="" className="create-menu-hand" />
      </span>

      {selectedElement ? (
        <>
          <div className="create-menu-stars" aria-hidden>
            {FALLING_STARS.map((star, index) => (
              <img
                key={index}
                src={star.large ? createMenu.stars.large : createMenu.stars.small}
                alt=""
                className={`create-menu-star ${star.large ? 'create-menu-star-large' : 'create-menu-star-small'}`}
                style={{
                  '--star-delay': `${star.delay}s`,
                  '--star-duration': `${star.duration}s`,
                  '--star-scale': star.scale,
                  '--star-x': `${star.x}%`,
                  '--star-y': `${star.y}%`,
                } as CSSProperties}
              />
            ))}
          </div>
          <ElementVfx
            className="create-menu-selected-vfx"
            element={selectedElement}
            nativeScale={(selectedElementMotion?.scale ?? 1) * 2}
            style={{
              left: `${(selectedElementMotion?.position.x ?? 450) / 16}cqw`,
              top: `${(selectedElementMotion?.position.y ?? 660) / 9}cqh`,
            }}
            variant="held"
          />
          <div
            className="create-menu-disciplines"
            data-visible={motion.disciplinesVisible}
            aria-label="Choose your discipline"
          >
            {(['arcane', 'body', 'mind'] as const).map((discipline) => (
              <button
                key={discipline}
                type="button"
                className={`create-menu-discipline create-menu-discipline-${discipline}`}
                disabled={pendingDiscipline !== null}
                onClick={() => selectDiscipline(discipline)}
              >
                <img src={createMenu.disciplines[discipline]} alt={discipline} />
              </button>
            ))}
          </div>
          <img
            src={createMenu.chooseDiscipline}
            alt="Choose your discipline"
            className="create-menu-prompt create-menu-discipline-prompt"
            data-visible={motion.disciplinesVisible}
          />
        </>
      ) : (
        <>
          <div className="create-menu-elements" data-visible={motion.elementsVisible} aria-label="Choose your element">
            <button type="button" className="create-menu-element create-menu-element-earth" onClick={() => selectElement('earth')}>
              <ElementVfx element="earth" variant="picker" />
              <img src={createMenu.elements.earth} alt="Earth" />
            </button>
            <button type="button" className="create-menu-element create-menu-element-ether" onClick={() => selectElement('ether')}>
              <ElementVfx element="ether" variant="picker" />
              <img src={createMenu.elements.ether} alt="Ether" />
            </button>
            <button type="button" className="create-menu-element create-menu-element-fire" onClick={() => selectElement('fire')}>
              <ElementVfx element="fire" variant="picker" />
              <img src={createMenu.elements.fire} alt="Fire" />
            </button>
            <button type="button" className="create-menu-element create-menu-element-water" onClick={() => selectElement('water')}>
              <ElementVfx element="water" variant="picker" />
              <img src={createMenu.elements.water} alt="Water" />
            </button>
            <button type="button" className="create-menu-element create-menu-element-air" onClick={() => selectElement('air')}>
              <ElementVfx element="air" variant="picker" />
              <img src={createMenu.elements.air} alt="Air" />
            </button>
          </div>
          <img
            src={createMenu.chooseElement}
            alt="Choose your element"
            className="create-menu-prompt"
            data-visible={motion.elementsVisible}
          />
        </>
      )}

      <span
        className="create-menu-hand-layer create-menu-hand-layer-right"
        data-pose={motion.rightPose}
        style={{
          '--create-hand-travel-x': `${motion.rightOffset.x / 16}cqw`,
          '--create-hand-travel-y': `${motion.rightOffset.y / 9}cqh`,
          '--create-hand-impulse-x': `${motion.rightImpulse.x / 16}cqw`,
          '--create-hand-impulse-y': `${motion.rightImpulse.y / 9}cqh`,
        } as CSSProperties}
        aria-hidden
        data-discipline-visible={selectedElement ? motion.disciplinesVisible : undefined}
      >
        <img src={HAND_SOURCE[motion.rightPose]} alt="" className="create-menu-hand" />
      </span>

      <span className="create-menu-native-flash" aria-hidden />
    </div>
  )
}
