import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { hub } from '../lib/assets'
import GameHud from './GameHud'
import HubTeacher from './HubTeacher'
import PlayerCharacter from './PlayerCharacter.tsx'
import {
  HUB_FOUNTAIN_ORIGIN,
  HUB_STATUE_ROOT,
  hubColorCss,
  hubFountainParticleAlpha,
  hubMarkerAlpha,
  hubPotionTraderActorFrameAt,
  hubPotionTraderBalloonFrameAt,
  hubPotionTraderBalloonOffsetYAt,
  hubSealColors,
  hubStatueOffsets,
  hubStudentHeadOffset,
  hubStudentPropOffset,
} from './hub-presentation.ts'
import {
  HUB_COURTYARD_FOREGROUND_DEPTH,
  HUB_SPAWN_ROOF_DEPTH,
  HUB_USEFUL_THYNGS_BALLOON_DEPTH,
  HUB_USEFUL_THYNGS_COUNTER_DEPTH,
  HUB_USEFUL_THYNGS_FRONT_DEPTH,
  HUB_USEFUL_THYNGS_MARKER_DEPTH,
  HUB_USEFUL_THYNGS_SHADOW_DEPTH,
  hubActorDepth,
} from './hub-depth.ts'
import {
  HUB_CAMERA_SCALE,
  HUB_SPAWN,
  hubCameraOrigin,
} from './core-kernels/hub-math.ts'
import type { PlayerCharacterInput } from './core-kernels/player-character.ts'
import type { GameAudioDirector } from './game-audio-director.ts'
import {
  hubTeacherSummonPitch,
  hubTeacherSummonVolume,
  nativeFootstepCue,
  nativeFootstepTicksBetween,
  nativeMovementOccurredBetween,
} from './game-audio-native.ts'
import type { BoneyardChoice, GameSnapshot } from './protocol/game-protocol.ts'
import type {
  HubWorldSnapshot,
  ProtocolFountainParticleState,
  ProtocolStudentState,
} from './protocol/game-state.ts'
import './hub.css'

interface HubSceneProps {
  audio: GameAudioDirector
  boneyards: readonly BoneyardChoice[]
  initialSnapshot: GameSnapshot
  onInput: (input: PlayerCharacterInput) => void
  onStartMatch: (boneyardId: string) => void
  playerId: string
  subscribe: (listener: (snapshot: GameSnapshot) => void) => () => void
}

type HubGameSnapshot = Omit<GameSnapshot, 'world'> & { world: HubWorldSnapshot }

function isHubSnapshot(snapshot: GameSnapshot): snapshot is HubGameSnapshot {
  return snapshot.world.kind === 'hub'
}

const HUB_TEACHER_POSITION = { x: 576.5, y: 710.5 } as const

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
  audio,
  boneyards,
  initialSnapshot,
  onInput,
  onStartMatch,
  playerId,
  subscribe,
}: HubSceneProps) {
  if (!isHubSnapshot(initialSnapshot)) {
    throw new Error('Hub scene requires a Hub snapshot')
  }
  const sceneRef = useRef<HTMLDivElement>(null)
  const worldRef = useRef<HTMLDivElement>(null)
  const fountainLayerRef = useRef<HTMLSpanElement>(null)
  const fountainParticleElementsRef = useRef(new Map<number, HTMLImageElement>())
  const statueAuraRef = useRef<HTMLImageElement>(null)
  const statueBodyRef = useRef<HTMLImageElement>(null)
  const potionTraderBalloonsRef = useRef<HTMLSpanElement>(null)
  const potionTraderSpriteRef = useRef<HTMLSpanElement>(null)
  const sealCoreRef = useRef<HTMLSpanElement>(null)
  const sealGlyphsRef = useRef<HTMLSpanElement>(null)
  const keysRef = useRef(new Set<string>())
  const studentElementsRef = useRef(new Map<number, HTMLDivElement>())
  const studentPropElementsRef = useRef(new Map<number, Array<HTMLSpanElement | null>>())
  const snapshotRef = useRef<HubGameSnapshot>(initialSnapshot)
  const [playerRoster, setPlayerRoster] = useState({ ...initialSnapshot.players })
  const [studentRoster, setStudentRoster] = useState([
    ...initialSnapshot.world.students,
  ])
  const [hostPlayerId, setHostPlayerId] = useState(initialSnapshot.hostPlayerId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [stageScale, setStageScale] = useState(1)
  const [matchReady, setMatchReady] = useState(false)

  const playTeacherSummon = useCallback((releaseIndex: number) => {
    const player = snapshotRef.current.players[playerId]
    if (!player) return
    audio.playSound('summon', {
      playbackRate: hubTeacherSummonPitch(releaseIndex),
      volume: hubTeacherSummonVolume(HUB_TEACHER_POSITION, player.position),
    })
  }, [audio, playerId])

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
    let previousAudioSnapshot = initialSnapshot
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
      if (!isHubSnapshot(snapshot)) return
      const hubWorld = snapshot.world
      const player = snapshot.players[playerId]
      if (player) {
        const moving = nativeMovementOccurredBetween(
          previousAudioSnapshot.players[playerId],
          player,
        )
        for (const tick of nativeFootstepTicksBetween(
          previousAudioSnapshot.tick,
          snapshot.tick,
          moving,
        )) {
          audio.playSound(nativeFootstepCue(tick, playerId), { volume: 0.5 })
        }
      }
      previousAudioSnapshot = snapshot
      snapshotRef.current = snapshot
      setPlayerRoster({ ...snapshot.players })
      setHostPlayerId(snapshot.hostPlayerId)
      setStudentRoster((currentRoster) => {
        const students = hubWorld.students
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
      onInput({ movement: keyboard })
      const snapshot = snapshotRef.current
      const { students } = snapshot.world
      const playerState = snapshot.players[playerId]
      if (!playerState) {
        frame = requestAnimationFrame(animate)
        return
      }
      const ambientState = snapshot.world.ambient

      if (potionTraderSpriteRef.current) {
        const traderFrame = hubPotionTraderActorFrameAt(snapshot.tick)
        potionTraderSpriteRef.current.style.backgroundPosition = `${-traderFrame * 35}px 0`
        potionTraderSpriteRef.current.dataset.frame = `${traderFrame}`
      }
      if (potionTraderBalloonsRef.current) {
        const balloonFrame = hubPotionTraderBalloonFrameAt(snapshot.tick)
        potionTraderBalloonsRef.current.style.backgroundPosition = `${-balloonFrame * 54}px 0`
        potionTraderBalloonsRef.current.style.transform = `translateY(${hubPotionTraderBalloonOffsetYAt(snapshot.tick)}px)`
        potionTraderBalloonsRef.current.dataset.frame = `${balloonFrame}`
      }

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
  }, [audio, initialSnapshot, onInput, playerId, subscribe])

  const frameStyle = { transform: `scale(${stageScale})` } as CSSProperties
  const isHost = hostPlayerId === playerId
  const beginMatch = () => {
    if (!isHost) return
    if (boneyards.length === 1) {
      onStartMatch(boneyards[0].id)
      return
    }
    setPickerOpen(true)
  }
  const sceneStyle = {
    '--hub-potion-balloons-sheet': `url("${hub.tent.balloons}")`,
    '--hub-potion-trader-sheet': `url("${hub.npcs.potion}")`,
    '--hub-student-head-sheet': `url("${hub.npcs.studentHead}")`,
  } as CSSProperties
  const initialPlayer = initialSnapshot.players[playerId]
  const localPlayer = playerRoster[playerId] ?? initialPlayer
  const element = localPlayer?.config.element ?? 'ether'
  const discipline = localPlayer?.config.discipline ?? 'arcane'
  const initialCamera = hubCameraOrigin(initialPlayer?.position ?? HUB_SPAWN)
  const initialStatue = hubStatueOffsets(initialSnapshot.world.ambient)
  const initialSealColors = hubSealColors(initialSnapshot.world.ambient)
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
            style={{ zIndex: HUB_USEFUL_THYNGS_COUNTER_DEPTH }}
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
          <div
            className="hub-actor hub-potion-trader"
            style={{ left: 1397, top: 664, zIndex: hubActorDepth(664) }}
            role="img"
            aria-label="Potion trader"
          >
            <span ref={potionTraderSpriteRef} className="hub-potion-trader-sprite" data-frame="0" />
          </div>
          <Actor alt="Annalist" src={hub.npcs.annalist} marker="talk" x={895.5} y={455.5} />
          <Actor alt="Items trader" src={hub.npcs.items} marker="help" x={1700.5} y={449.5} />
          <HubTeacher
            x={HUB_TEACHER_POSITION.x}
            y={HUB_TEACHER_POSITION.y}
            onRelease={playTeacherSummon}
          />

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

          {Object.entries(playerRoster).map(([id, player]) => (
            <PlayerCharacter
              key={id}
              depth={hubActorDepth(player.position.y)}
              state={player}
            />
          ))}

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
            style={{ zIndex: HUB_USEFUL_THYNGS_FRONT_DEPTH }}
            alt=""
            draggable={false}
          />
          <span
            ref={potionTraderBalloonsRef}
            className="hub-tent-balloons"
            style={{ zIndex: HUB_USEFUL_THYNGS_BALLOON_DEPTH }}
            data-frame="0"
            aria-hidden
          />
          <img
            className="hub-actor-marker hub-potion-trader-marker"
            src={hub.markers.help.right}
            style={{ zIndex: HUB_USEFUL_THYNGS_MARKER_DEPTH }}
            alt=""
            draggable={false}
          />
          <img
            className="hub-courtyard-foreground"
            src={hub.foreground.courtyard}
            style={{ zIndex: HUB_COURTYARD_FOREGROUND_DEPTH }}
            alt=""
            draggable={false}
          />
        </div>

        <GameHud
          element={element}
          mapActive={matchReady}
          mapLabel={matchReady ? 'Leave match queue' : 'Ready for match'}
          onMapClick={() => setMatchReady((ready) => !ready)}
        />

        <div className="hub-match-control">
          {isHost ? (
            <button type="button" className="hub-start-match" onClick={beginMatch}>
              Start Match
            </button>
          ) : (
            <span className="hub-waiting-host">Waiting for host</span>
          )}
        </div>

        {pickerOpen && isHost && (
          <div className="hub-boneyard-picker-backdrop" role="presentation">
            <section
              className="hub-boneyard-picker"
              role="dialog"
              aria-modal="true"
              aria-labelledby="hub-boneyard-picker-title"
            >
              <h2 id="hub-boneyard-picker-title">Choose a Boneyard</h2>
              <div className="hub-boneyard-options">
                {boneyards.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    className="hub-boneyard-option"
                    data-boneyard-id={choice.id}
                    onClick={() => onStartMatch(choice.id)}
                  >
                    <strong>{choice.name}</strong>
                    <span>
                      {choice.source === 'default'
                        ? 'A stock-generated random arena'
                        : choice.modName ?? choice.modId}
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="hub-boneyard-cancel"
                onClick={() => setPickerOpen(false)}
              >
                Cancel
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
