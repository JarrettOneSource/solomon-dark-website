import { useEffect, useRef, useState, type CSSProperties } from 'react'
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

interface CreateMenuSceneProps {
  onBack: () => void
  onStart: (element: WizardElement, discipline: WizardDiscipline) => void
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

export default function CreateMenuScene({ onBack, onStart }: CreateMenuSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const [handsReady, setHandsReady] = useState(false)
  const [motionMs, setMotionMs] = useState(0)
  const [selectedElement, setSelectedElement] = useState<WizardElement | null>(null)

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

    const update = (now: number) => {
      const elapsed = Math.min(now - startedAt, duration)
      setMotionMs(elapsed)
      if (elapsed < duration) animationFrame = requestAnimationFrame(update)
    }

    setMotionMs(0)
    animationFrame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animationFrame)
  }, [handsReady, selectedElement])

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
    setMotionMs(0)
    setSelectedElement(element)
  }

  return (
    <div
      ref={sceneRef}
      className="create-menu-scene"
      data-phase={selectedElement ? 'discipline' : 'element'}
      data-element={selectedElement ?? undefined}
      data-hands-ready={handsReady}
      data-motion-settled={motion.settled}
      aria-label="New wizard loadout selection"
    >
      <button type="button" className="create-menu-back" aria-label="Back" onClick={onBack}>
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
                onClick={() => onStart(selectedElement, discipline)}
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
