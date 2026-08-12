import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { hub } from '../lib/assets'
import type { WizardDiscipline, WizardElement } from './CreateMenuScene'
import ElementVfx from './ElementVfx'
import HubTeacher from './HubTeacher'
import {
  HUB_FOUNTAIN_ORIGIN,
  HUB_STATUE_ROOT,
  hubColorCss,
  hubFountainParticleAlpha,
  hubMarkerAlpha,
  hubSealColors,
  hubStatueOffsets,
  hubStudentHeadOffset,
  hubStudentPropOffset,
} from './hub-presentation.ts'
import {
  HUB_SPAWN_ROOF_DEPTH,
  HUB_USEFUL_THYNGS_DEPTH,
  HUB_USEFUL_THYNGS_SHADOW_DEPTH,
  hubActorDepth,
} from './hub-depth.ts'
import {
  HUB_CAMERA_SCALE,
  HUB_SPAWN,
  hubCameraOrigin,
  hubPlayerFixedRobeOffset,
  hubPlayerFixedRobePose,
  hubPlayerFrontAttachmentOffset,
  hubPlayerHeadOffset,
  hubStaffIsFront,
  hubStaffOrbOffset,
} from './core-kernels/hub-math.ts'
import type { HubSnapshot } from './protocol/game-protocol.ts'
import type {
  ProtocolFountainParticleState,
  ProtocolStudentState,
} from './protocol/game-state.ts'
import './hub.css'

interface HubSceneProps {
  discipline: WizardDiscipline
  element: WizardElement
  initialSnapshot: HubSnapshot
  onInput: (input: { x: number; y: number }) => void
  playerId: string
  subscribe: (listener: (snapshot: HubSnapshot) => void) => () => void
}

interface ActorProps {
  alt: string
  className?: string
  marker?: 'help' | 'talk'
  src: string
  x: number
  y: number
}

function Actor({ alt, className = '', marker, src, x, y }: ActorProps) {
  const markerSource = marker ? hub.markers[marker].right : undefined
  return (
    <div
      className={`hub-actor ${className}`}
      style={{ left: x, top: y, zIndex: hubActorDepth(y) }}
    >
      {markerSource && (
        <img
          className="hub-actor-marker"
          src={markerSource}
          alt=""
        />
      )}
      <span className="hub-actor-shadow" />
      <img className="hub-actor-sprite" src={src} alt={alt} />
    </div>
  )
}

interface StudentProps {
  onRef: (id: number, node: HTMLDivElement | null) => void
  onPropRef: (id: number, propIndex: number, node: HTMLSpanElement | null) => void
  reading: boolean
  student: ProtocolStudentState
}

function Student({ onPropRef, onRef, reading, student }: StudentProps) {
  const sheet = reading ? hub.npcs.studentRead : hub.npcs.studentWalk
  const headOffset = hubStudentHeadOffset(student)
  const style = {
    left: student.position.x,
    top: student.position.y,
    zIndex: hubActorDepth(student.position.y),
    '--hub-student-heading-y': `${-student.headingIndex * 170}px`,
    '--hub-student-pose-x': `${-Math.floor(student.framePhase) * 170}px`,
    '--hub-student-head-x': `${headOffset.x}px`,
    '--hub-student-head-y': `${headOffset.y}px`,
    '--hub-student-scale': student.scale,
    '--hub-student-sheet': `url("${sheet}")`,
  } as CSSProperties
  return (
    <div
      ref={(node) => onRef(student.id, node)}
      className="hub-actor hub-student"
      data-student-id={student.id}
      data-student-path={student.pathId}
      data-student-state={reading ? 'read' : 'walk'}
      style={style}
      aria-label="Student"
    >
      <span className="hub-actor-shadow" />
      <span className="hub-student-sprite" />
      {!reading && student.props.map((prop, propIndex) => {
        const offset = hubStudentPropOffset(student.heading, prop, propIndex)
        return (
          <span
            key={propIndex}
            ref={(node) => onPropRef(student.id, propIndex, node)}
            className="hub-student-prop"
            style={{
              '--hub-student-prop-x': `${offset.x}px`,
              '--hub-student-prop-y': `${offset.y}px`,
              '--hub-student-prop-sheet': `url("${hub.npcs.studentProps[prop.paletteIndex]}")`,
            } as CSSProperties}
            aria-hidden
          />
        )
      })}
      <span className="hub-student-head" />
    </div>
  )
}

function HudSlot({ src }: { src: string }) {
  return <img className="hub-hud-slot" src={src} alt="" />
}

function renderFountainParticles(
  container: HTMLSpanElement,
  elements: Map<number, HTMLImageElement>,
  particles: readonly ProtocolFountainParticleState[],
): void {
  const liveIds = new Set<number>()
  for (const particle of particles) {
    liveIds.add(particle.id)
    let element = elements.get(particle.id)
    if (!element) {
      element = document.createElement('img')
      element.className = 'hub-fountain-particle'
      element.src = hub.fountainParticle
      element.alt = ''
      element.draggable = false
      element.style.left = `${HUB_FOUNTAIN_ORIGIN.x}px`
      element.style.top = `${HUB_FOUNTAIN_ORIGIN.y}px`
      container.append(element)
      elements.set(particle.id, element)
    }
    element.style.opacity = `${hubFountainParticleAlpha(particle)}`
    element.style.transform = `translate(-50%, -50%) scale(${particle.scale})`
  }
  for (const [id, element] of elements) {
    if (liveIds.has(id)) continue
    element.remove()
    elements.delete(id)
  }
}

export default function HubScene({
  discipline,
  element,
  initialSnapshot,
  onInput,
  playerId,
  subscribe,
}: HubSceneProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const playerLayerRefs = useRef<Array<HTMLSpanElement | null>>([])
  const playerFixedRobeRef = useRef<HTMLSpanElement>(null)
  const playerStaffFrontRef = useRef<HTMLSpanElement>(null)
  const playerHeadRef = useRef<HTMLSpanElement>(null)
  const playerOrbRef = useRef<HTMLSpanElement>(null)
  const fountainLayerRef = useRef<HTMLSpanElement>(null)
  const fountainParticleElementsRef = useRef(new Map<number, HTMLImageElement>())
  const statueAuraRef = useRef<HTMLImageElement>(null)
  const statueBodyRef = useRef<HTMLImageElement>(null)
  const sealCoreRef = useRef<HTMLSpanElement>(null)
  const sealGlyphsRef = useRef<HTMLSpanElement>(null)
  const keysRef = useRef(new Set<string>())
  const studentElementsRef = useRef(new Map<number, HTMLDivElement>())
  const studentPropElementsRef = useRef(new Map<number, Array<HTMLSpanElement | null>>())
  const snapshotRef = useRef(initialSnapshot)
  const [studentRoster, setStudentRoster] = useState([...initialSnapshot.students])
  const [stageScale, setStageScale] = useState(1)

  useLayoutEffect(() => {
    const scene = sceneRef.current
    if (!scene) return
    const updateScale = () => setStageScale(scene.clientWidth / 1600)
    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(scene)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const fountainParticleElements = fountainParticleElementsRef.current
    const movementKeys = new Set(['arrowdown', 'arrowleft', 'arrowright', 'arrowup', 'a', 'd', 's', 'w'])
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (!movementKeys.has(key)) return
      event.preventDefault()
      keysRef.current.add(key)
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (!movementKeys.has(key)) return
      event.preventDefault()
      keysRef.current.delete(key)
    }
    const handleBlur = () => keysRef.current.clear()
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)

    const unsubscribe = subscribe((snapshot) => {
      snapshotRef.current = snapshot
      setStudentRoster((currentRoster) => {
        const students = snapshot.students
        const rosterChanged = currentRoster.length !== students.length
          || currentRoster.some((student, index) => student.id !== students[index]?.id)
        return rosterChanged ? [...students] : currentRoster
      })
    })
    let frame = 0
    const animate = () => {
      const keys = keysRef.current
      const keyboard = {
        x: Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft')),
        y: Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup')),
      }
      onInput(keyboard)
      const snapshot = snapshotRef.current
      const { students } = snapshot
      const playerState = snapshot.players[playerId]
      if (!playerState) {
        frame = requestAnimationFrame(animate)
        return
      }
      const ambientState = snapshot.ambient

      if (worldRef.current) {
        worldRef.current.style.setProperty('--hub-marker-opacity', `${hubMarkerAlpha(ambientState)}`)
      }
      const sealColors = hubSealColors(ambientState)
      if (sealCoreRef.current) {
        sealCoreRef.current.style.backgroundColor = hubColorCss(sealColors.core)
      }
      if (sealGlyphsRef.current) {
        sealGlyphsRef.current.style.backgroundColor = hubColorCss(sealColors.glyphs)
      }
      if (fountainLayerRef.current) {
        renderFountainParticles(
          fountainLayerRef.current,
          fountainParticleElements,
          ambientState.fountainParticles,
        )
      }

      const statue = hubStatueOffsets(ambientState)
      if (statueAuraRef.current) {
        statueAuraRef.current.style.transform = `translate3d(${statue.aura.x}px, ${statue.aura.y}px, 0)`
      }
      if (statueBodyRef.current) {
        statueBodyRef.current.style.transform = `translate3d(${statue.body.x}px, ${statue.body.y}px, 0)`
      }
      const moving = Math.hypot(playerState.velocity.x, playerState.velocity.y) > 0.01
      const player = playerRef.current
      const fixedRobe = playerFixedRobeRef.current
      const staffFront = playerStaffFrontRef.current
      const head = playerHeadRef.current
      const orb = playerOrbRef.current
      const backgroundPosition = `0 ${-playerState.headingIndex * 170}px`
      for (const layer of playerLayerRefs.current) {
        if (layer) layer.style.backgroundPosition = backgroundPosition
      }
      const fixedRobePose = hubPlayerFixedRobePose(playerState.walkCyclePrimary)
      const fixedRobeOffset = hubPlayerFixedRobeOffset(playerState.gaitDegrees)
      if (fixedRobe) {
        fixedRobe.style.backgroundPosition = `${-fixedRobePose * 170}px ${-playerState.headingIndex * 170}px`
        fixedRobe.style.transform = `translate3d(${fixedRobeOffset.x}px, ${fixedRobeOffset.y}px, 0)`
      }
      const frontAttachmentOffset = hubPlayerFrontAttachmentOffset(playerState.gaitDegrees)
      if (staffFront) {
        staffFront.style.transform = `translate3d(${frontAttachmentOffset.x}px, ${frontAttachmentOffset.y}px, 0)`
      }
      const headOffset = hubPlayerHeadOffset(playerState.headingIndex, playerState.gaitDegrees)
      if (head) {
        head.style.transform = `translate3d(${headOffset.x}px, ${headOffset.y}px, 0)`
      }
      if (orb) {
        const offset = hubStaffOrbOffset(playerState.headingIndex)
        orb.style.left = `${offset.x}px`
        orb.style.top = `${offset.y}px`
        const staffOffset = hubStaffIsFront(playerState.headingIndex)
          ? frontAttachmentOffset
          : { x: 0, y: 0 }
        orb.style.transform = `translate3d(${staffOffset.x}px, ${staffOffset.y}px, 0)`
        orb.style.zIndex = hubStaffIsFront(playerState.headingIndex) ? '6' : '2'
      }
      if (player) {
        player.style.left = `${playerState.position.x}px`
        player.style.top = `${playerState.position.y}px`
        player.style.zIndex = `${hubActorDepth(playerState.position.y)}`
        player.dataset.moving = moving ? 'true' : 'false'
        player.dataset.walkPose = `${fixedRobePose}`
      }

      for (const student of students) {
        const node = studentElementsRef.current.get(student.id)
        if (node) {
          node.style.left = `${student.position.x}px`
          node.style.top = `${student.position.y}px`
          node.style.zIndex = `${hubActorDepth(student.position.y)}`
          node.style.setProperty('--hub-student-heading-y', `${-student.headingIndex * 170}px`)
          node.style.setProperty('--hub-student-pose-x', `${-Math.floor(student.framePhase) * 170}px`)
          const headOffset = hubStudentHeadOffset(student)
          node.style.setProperty('--hub-student-head-x', `${headOffset.x}px`)
          node.style.setProperty('--hub-student-head-y', `${headOffset.y}px`)
          node.style.setProperty('--hub-student-scale', `${student.scale}`)
        }
        const propNodes = studentPropElementsRef.current.get(student.id)
        if (!propNodes) continue
        student.props.forEach((prop, propIndex) => {
          const propNode = propNodes[propIndex]
          if (!propNode) return
          const offset = hubStudentPropOffset(student.heading, prop, propIndex)
          propNode.style.setProperty('--hub-student-prop-x', `${offset.x}px`)
          propNode.style.setProperty('--hub-student-prop-y', `${offset.y}px`)
        })
      }

      const camera = hubCameraOrigin(playerState.position)
      if (worldRef.current) {
        worldRef.current.style.transform = `translate3d(${-camera.x * HUB_CAMERA_SCALE}px, ${-camera.y * HUB_CAMERA_SCALE}px, 0) scale(${HUB_CAMERA_SCALE})`
      }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(frame)
      fountainParticleElements.clear()
      unsubscribe()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [onInput, playerId, subscribe])

  const frameStyle = { transform: `scale(${stageScale})` } as CSSProperties
  const sceneStyle = {
    '--hub-player-staff-back-sheet': `url("${hub.player.staffBack}")`,
    '--hub-player-robe-dynamic-sheet': `url("${hub.player.robeDynamic[element]}")`,
    '--hub-player-robe-fixed-sheet': `url("${hub.player.robeFixed[element]}")`,
    '--hub-player-staff-front-sheet': `url("${hub.player.staffFront}")`,
    '--hub-player-head-sheet': `url("${hub.player.head[element]}")`,
    '--hub-student-head-sheet': `url("${hub.npcs.studentHead}")`,
  } as CSSProperties
  const initialPlayer = initialSnapshot.players[playerId]
  const initialCamera = hubCameraOrigin(initialPlayer?.position ?? HUB_SPAWN)
  const initialStatue = hubStatueOffsets(initialSnapshot.ambient)
  const initialSealColors = hubSealColors(initialSnapshot.ambient)
  const worldStyle = {
    transform: `translate3d(${-initialCamera.x * HUB_CAMERA_SCALE}px, ${-initialCamera.y * HUB_CAMERA_SCALE}px, 0) scale(${HUB_CAMERA_SCALE})`,
  } as CSSProperties

  return (
    <div
      ref={sceneRef}
      className="hub-scene"
      data-discipline={discipline}
      data-element={element}
      style={sceneStyle}
      aria-label="College courtyard. Move with W A S D or the arrow keys."
      tabIndex={0}
    >
      <div className="hub-native-frame" style={frameStyle}>
        <div ref={worldRef} className="hub-world" style={worldStyle}>
          <img className="hub-courtyard" src={hub.courtyard} alt="" draggable={false} />
          <span
            ref={sealGlyphsRef}
            className="hub-seal hub-seal-glyphs"
            style={{
              backgroundColor: hubColorCss(initialSealColors.glyphs),
              '--hub-seal-mask': `url("${hub.seals.glyphs}")`,
            } as CSSProperties}
          />
          <span
            ref={sealCoreRef}
            className="hub-seal hub-seal-core"
            style={{
              backgroundColor: hubColorCss(initialSealColors.core),
              '--hub-seal-mask': `url("${hub.seals.core}")`,
            } as CSSProperties}
          />
          <img
            className="hub-tent-layer hub-tent-shadow"
            src={hub.tent.shadow}
            style={{ zIndex: HUB_USEFUL_THYNGS_SHADOW_DEPTH }}
            alt=""
            draggable={false}
          />
          <img
            className="hub-tent-layer hub-tent-back"
            src={hub.tent.back}
            style={{ zIndex: HUB_USEFUL_THYNGS_DEPTH }}
            alt=""
            draggable={false}
          />

          <span ref={fountainLayerRef} className="hub-fountain-particles" />

          <img
            ref={statueAuraRef}
            className="hub-prop-statue-aura"
            src={hub.props.statue.aura}
            style={{
              left: HUB_STATUE_ROOT.x - 24,
              top: HUB_STATUE_ROOT.y - 166,
              transform: `translate3d(${initialStatue.aura.x}px, ${initialStatue.aura.y}px, 0)`,
              zIndex: hubActorDepth(HUB_STATUE_ROOT.y) - 1,
            }}
            alt=""
          />
          <img
            ref={statueBodyRef}
            className="hub-prop-statue-body"
            src={hub.props.statue.body}
            style={{
              left: HUB_STATUE_ROOT.x - 76,
              top: HUB_STATUE_ROOT.y - 189,
              transform: `translate3d(${initialStatue.body.x}px, ${initialStatue.body.y}px, 0)`,
              zIndex: hubActorDepth(HUB_STATUE_ROOT.y),
            }}
            alt="College statue"
          />

          <Actor alt="Perk witch" src={hub.npcs.perkWitch} marker="help" x={1340} y={280} />
          <Actor alt="Potion trader" src={hub.npcs.potion} marker="help" x={1397} y={664} />
          <Actor alt="Annalist" src={hub.npcs.annalist} marker="talk" x={895.5} y={455.5} />
          <Actor alt="Items trader" src={hub.npcs.items} marker="help" x={1700.5} y={449.5} />
          <HubTeacher x={576.5} y={710.5} />

          {studentRoster.map((student) => (
            <Student
              key={student.id}
              student={student}
              reading={student.reading}
              onRef={(id, node) => {
                if (node) studentElementsRef.current.set(id, node)
                else studentElementsRef.current.delete(id)
              }}
              onPropRef={(id, propIndex, node) => {
                const propNodes = studentPropElementsRef.current.get(id) ?? []
                propNodes[propIndex] = node
                if (node || propNodes.some(Boolean)) {
                  studentPropElementsRef.current.set(id, propNodes)
                } else {
                  studentPropElementsRef.current.delete(id)
                }
              }}
            />
          ))}

          <div
            ref={playerRef}
            className="hub-player"
            aria-label={`${element} wizard`}
            style={{
              left: initialPlayer?.position.x ?? HUB_SPAWN.x,
              top: initialPlayer?.position.y ?? HUB_SPAWN.y,
              zIndex: hubActorDepth(initialPlayer?.position.y ?? HUB_SPAWN.y),
            }}
          >
            <span className="hub-player-shadow" />
            <span className="hub-player-visual">
              <span
                ref={(node) => { playerLayerRefs.current[0] = node }}
                className="hub-player-layer hub-player-staff-back"
              />
              <span
                ref={(node) => { playerLayerRefs.current[1] = node }}
                className="hub-player-layer hub-player-robe-dynamic"
              />
              <span
                ref={(node) => {
                  playerLayerRefs.current[2] = node
                  playerFixedRobeRef.current = node
                }}
                className="hub-player-layer hub-player-robe-fixed"
              />
              <span
                ref={(node) => {
                  playerLayerRefs.current[3] = node
                  playerStaffFrontRef.current = node
                }}
                className="hub-player-layer hub-player-staff-front"
              />
              <span
                ref={(node) => {
                  playerLayerRefs.current[4] = node
                  playerHeadRef.current = node
                }}
                className="hub-player-layer hub-player-head"
              />
              <span ref={playerOrbRef} className="hub-player-orb-vfx" style={{ left: 32.5, top: -1.5 }}>
                <ElementVfx element={element} variant="staff" />
              </span>
            </span>
          </div>

          <img
            className="hub-spawn-roof"
            src={hub.foreground.spawnRoof}
            style={{ zIndex: HUB_SPAWN_ROOF_DEPTH }}
            alt=""
            draggable={false}
          />
          <img
            className="hub-tent-layer hub-tent-front"
            src={hub.tent.front}
            style={{ zIndex: HUB_USEFUL_THYNGS_DEPTH }}
            alt=""
            draggable={false}
          />
        </div>

        <div className="hub-hud" aria-label="Player status">
          <img className="hub-hud-skull" src={hub.hud.skull} alt="Menu" />
          <div className="hub-hud-meters">
            <div className="hub-hud-meter hub-hud-meter-health"><img src={hub.hud.barRed} alt="Health 50 of 50" /></div>
            <div className="hub-hud-meter hub-hud-meter-mana"><img src={hub.hud.barBlue} alt="Mana 100 of 100" /></div>
          </div>
          <img className="hub-hud-primary" src={hub.primary[element]} alt={`${element} primary spell`} />
          <img className="hub-hud-help" src={hub.hud.help} alt="Help" />

          <div className="hub-hud-loadout" aria-label="Equipped spells">
            <HudSlot src={hub.hud.npcs.annalist} />
            <HudSlot src={hub.hud.npcs.perkWitch} />
            <HudSlot src={hub.hud.npcs.items} />
            <HudSlot src={hub.hud.npcs.potion} />
            <HudSlot src={hub.hud.npcs.teacher} />
          </div>

          <div className="hub-hud-inventory" aria-label="Inventory shortcuts">
            <img className="hub-hud-potion hub-hud-potion-red" src={hub.hud.potionRed} alt="3 health potions" />
            <span className="hub-hud-count">3</span>
            <img src={hub.hud.backpack} alt="Backpack" />
            <span className="hub-hud-inventory-divider" />
            <img src={hub.hud.tome} alt="Spellbook" />
            <img className="hub-hud-potion hub-hud-potion-blue" src={hub.hud.potionBlue} alt="4 mana potions" />
            <span className="hub-hud-count hub-hud-count-blue">4</span>
          </div>

          <div className="hub-hud-map">
            <img src={hub.hud.parchment} alt="College map" />
            <span className="hub-hud-compass">N<span>E</span><span>S</span><span>W</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}
