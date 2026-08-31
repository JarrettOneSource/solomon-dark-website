import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'

import type { GameAudioDirector } from './game-audio-director.ts'
import {
  NATIVE_SELECTOR_ACCEPT_TICKS,
} from './core-kernels/native-hub-npc.ts'
import type { ProtocolPlayerSkillOffer } from './protocol/game-state.ts'
import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import {
  createSkillPickerRenderer,
  type SkillPickerRenderer,
} from './renderer/skill-picker-renderer.ts'
import {
  nativeSkillPickerClose,
  nativeSkillPickerReveal,
  type NativeSkillPickerCloseDirection,
} from './renderer/level-up-presentation.ts'
import {
  SKILL_PICKER_INSIGHT_DETAIL_TEXT,
  skillPickerCardCenters,
  skillPickerCardPresentation,
  skillPickerDetailPresentation,
  skillPickerIconBounds,
  skillPickerSpecialActionBounds,
} from './renderer/skill-picker-render-contract.ts'
import { nativeSkillExactTextRuns } from './renderer/skill-book-render-contract.ts'
import './skill-picker.css'

type SkillPickerPhase =
  | 'closed'
  | 'closed-wait'
  | 'closing'
  | 'opening'
  | 'queued-wait'
  | 'reroll-wait'
  | 'settled'

interface SkillPickerProps {
  audio: GameAudioDirector
  inputSuspended: boolean
  offer: ProtocolPlayerSkillOffer | null
  onClosingChange: (closing: boolean) => void
  onReroll: (offerSequence: number) => void
  onSave: (offerSequence: number) => void
  onSelect: (choiceIndex: number, offerSequence: number, skillId: number) => void
  presentationId: number
  sorcerorsCharmAvailable: boolean
  style: CSSProperties
}

const NATIVE_REROLL_REBUILD_DELAY_MS = 20
const NATIVE_QUEUED_REBUILD_DELAY_MS = 100
const NATIVE_TICK_MS = 10

export default function SkillPicker({
  audio,
  inputSuspended,
  offer,
  onClosingChange,
  onReroll,
  onSave,
  onSelect,
  presentationId,
  sorcerorsCharmAvailable,
  style,
}: SkillPickerProps) {
  const initialOfferRef = useRef(offer)
  if (initialOfferRef.current === null) {
    throw new Error('skill picker requires an initial authoritative offer')
  }
  const stageRef = useRef<HTMLDivElement>(null)
  const curtainRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const closeDirectionRef = useRef<NativeSkillPickerCloseDirection>(-0.75)
  const closeStartedAtRef = useRef<number | null>(null)
  const displayedAvailabilityRef = useRef(sorcerorsCharmAvailable)
  const displayedOfferRef = useRef(initialOfferRef.current)
  const detailIndexRef = useRef<number | null>(null)
  const iconActivationRef = useRef<{
    choiceIndex: number
    pointerType: string
  } | null>(null)
  const latestAvailabilityRef = useRef(sorcerorsCharmAvailable)
  const latestOfferRef = useRef(offer)
  const onClosingChangeRef = useRef(onClosingChange)
  const openPanelPresentationRef = useRef<number | null>(null)
  const phaseRef = useRef<SkillPickerPhase>('opening')
  const queuedStartedAtRef = useRef<number | null>(null)
  const rerollStartedAtRef = useRef<number | null>(null)
  const revealReadyRef = useRef(false)
  const revealStartedAtRef = useRef<number | null>(null)
  const rendererRef = useRef<SkillPickerRenderer | null>(null)
  const selectedIndexRef = useRef(0)
  const submittingRef = useRef(false)
  const chooseRef = useRef<(index: number, automatic?: boolean) => void>(() => undefined)
  const [displayedOffer, setDisplayedOffer] = useState(initialOfferRef.current)
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  const [phase, setPhase] = useState<SkillPickerPhase>('opening')
  const [rendererState, setRendererState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [revealReady, setRevealReady] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [specialActionsAvailable, setSpecialActionsAvailable] = useState(
    sorcerorsCharmAvailable,
  )
  const [submitting, setSubmitting] = useState(false)

  latestOfferRef.current = offer
  latestAvailabilityRef.current = sorcerorsCharmAvailable
  onClosingChangeRef.current = onClosingChange

  const updateDetail = (index: number | null) => {
    detailIndexRef.current = index
    setDetailIndex(index)
    rendererRef.current?.setDetailOption(index)
  }

  useEffect(() => {
    if (openPanelPresentationRef.current === presentationId) return
    openPanelPresentationRef.current = presentationId
    audio.playSound('open-panel', { playbackRate: 1 })
  }, [audio, presentationId])

  useEffect(() => {
    if (revealReady && !inputSuspended) buttonRefs.current[0]?.focus()
  }, [displayedOffer.sequence, inputSuspended, revealReady])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let renderer: SkillPickerRenderer | undefined
    setRendererState('loading')
    void createSkillPickerRenderer().then((created) => {
      if (disposed) {
        created.destroy()
        return
      }
      renderer = created
      rendererRef.current = created
      created.setOffer(
        displayedOfferRef.current,
        displayedAvailabilityRef.current,
      )
      created.setDetailOption(detailIndexRef.current)
      created.setContentVisible(phaseRef.current !== 'queued-wait')
      host.replaceChildren(created.canvas)
      setRendererState('ready')
    }).catch(() => {
      if (!disposed) setRendererState('error')
    })

    const commitOffer = (
      nextOffer: ProtocolPlayerSkillOffer,
      nextAvailability: boolean,
    ) => {
      displayedOfferRef.current = nextOffer
      displayedAvailabilityRef.current = nextAvailability
      updateDetail(null)
      selectedIndexRef.current = 0
      submittingRef.current = false
      revealReadyRef.current = true
      rendererRef.current?.setOffer(nextOffer, nextAvailability)
      rendererRef.current?.setContentVisible(true)
      setDisplayedOffer(nextOffer)
      setSelectedIndex(0)
      setSpecialActionsAvailable(nextAvailability)
      setSubmitting(false)
      setRevealReady(true)
    }

    const startQueuedRebuild = (nowMs: number) => {
      updateDetail(null)
      queuedStartedAtRef.current = nowMs
      phaseRef.current = 'queued-wait'
      rendererRef.current?.setContentVisible(false)
      setPhase('queued-wait')
      audio.playSound('unlock-skill', { playbackRate: 1 })
    }

    const finishCloseIfAuthoritative = (nowMs: number) => {
      const nextOffer = latestOfferRef.current
      if (
        nextOffer !== null
        && nextOffer.sequence !== displayedOfferRef.current.sequence
      ) {
        startQueuedRebuild(nowMs)
      } else if (nextOffer === null) {
        phaseRef.current = 'closed'
        setPhase('closed')
        onClosingChangeRef.current(false)
      }
    }

    const unsubscribe = subscribeGamePresentationFrames((nowMs) => {
      if (!renderer) return
      const currentPhase = phaseRef.current
      let reveal
      if (currentPhase === 'opening') {
        revealStartedAtRef.current ??= nowMs
        reveal = nativeSkillPickerReveal(nowMs - revealStartedAtRef.current)
      } else if (currentPhase === 'closing' || currentPhase === 'closed-wait') {
        closeStartedAtRef.current ??= nowMs
        reveal = nativeSkillPickerClose(
          nowMs - closeStartedAtRef.current,
          closeDirectionRef.current,
        )
      } else if (currentPhase === 'closed') {
        reveal = nativeSkillPickerClose(1_000, closeDirectionRef.current)
      } else {
        reveal = nativeSkillPickerReveal(400)
      }
      renderer.render(nowMs, selectedIndexRef.current, reveal)
      if (curtainRef.current) {
        curtainRef.current.style.opacity = `${reveal.curtainAlpha}`
      }
      const stage = stageRef.current
      if (stage) {
        const startedAt = currentPhase === 'opening'
          ? revealStartedAtRef.current
          : closeStartedAtRef.current
        stage.dataset.revealElapsedMs = `${startedAt === null ? 0 : nowMs - startedAt}`
        stage.dataset.revealAlpha = `${reveal.revealAlpha}`
        stage.dataset.revealInteractive = `${reveal.interactive}`
      }

      if (currentPhase === 'opening' && reveal.interactive) {
        phaseRef.current = 'settled'
        revealReadyRef.current = true
        setPhase('settled')
        setRevealReady(true)
      } else if (currentPhase === 'closing' && reveal.revealAlpha === 0) {
        phaseRef.current = 'closed-wait'
        setPhase('closed-wait')
        finishCloseIfAuthoritative(nowMs)
      } else if (currentPhase === 'closed-wait') {
        finishCloseIfAuthoritative(nowMs)
      } else if (
        currentPhase === 'queued-wait'
        && queuedStartedAtRef.current !== null
        && nowMs - queuedStartedAtRef.current >= NATIVE_QUEUED_REBUILD_DELAY_MS
      ) {
        const nextOffer = latestOfferRef.current
        if (
          nextOffer !== null
          && nextOffer.sequence !== displayedOfferRef.current.sequence
        ) {
          commitOffer(nextOffer, latestAvailabilityRef.current)
          phaseRef.current = 'settled'
          setPhase('settled')
          onClosingChangeRef.current(false)
        }
      } else if (
        currentPhase === 'reroll-wait'
        && rerollStartedAtRef.current !== null
        && nowMs - rerollStartedAtRef.current >= NATIVE_REROLL_REBUILD_DELAY_MS
      ) {
        const nextOffer = latestOfferRef.current
        if (
          nextOffer !== null
          && nextOffer.sequence !== displayedOfferRef.current.sequence
        ) {
          commitOffer(nextOffer, latestAvailabilityRef.current)
          phaseRef.current = 'settled'
          setPhase('settled')
        }
      } else if (currentPhase === 'settled') {
        const nextOffer = latestOfferRef.current
        if (
          nextOffer !== null
          && (
            nextOffer.sequence !== displayedOfferRef.current.sequence
            || latestAvailabilityRef.current !== displayedAvailabilityRef.current
          )
        ) commitOffer(nextOffer, latestAvailabilityRef.current)
      }
    })
    return () => {
      disposed = true
      unsubscribe()
      rendererRef.current = null
      renderer?.destroy()
      host.replaceChildren()
    }
  }, [audio])

  const setSelection = (index: number) => {
    selectedIndexRef.current = index
    setSelectedIndex(index)
  }

  const moveSelection = (delta: number) => {
    if (
      submittingRef.current
      || !revealReadyRef.current
      || displayedOfferRef.current.automaticChoiceIndex !== undefined
    ) return
    const options = displayedOfferRef.current.options
    const next = (selectedIndexRef.current + delta + options.length) % options.length
    setSelection(next)
    buttonRefs.current[next]?.focus()
  }

  const beginClose = (direction: NativeSkillPickerCloseDirection) => {
    updateDetail(null)
    submittingRef.current = true
    revealReadyRef.current = false
    closeDirectionRef.current = direction
    closeStartedAtRef.current = null
    phaseRef.current = 'closing'
    setSubmitting(true)
    setRevealReady(false)
    setPhase('closing')
    onClosingChangeRef.current(true)
  }

  const choose = (index: number, automatic = false) => {
    if (submittingRef.current || !revealReadyRef.current) return
    const currentOffer = displayedOfferRef.current
    if (!automatic && currentOffer.automaticChoiceIndex !== undefined) return
    const option = currentOffer.options[index]
    if (!option) return
    setSelection(index)
    audio.playSound('pick-skill', { playbackRate: 1 })
    audio.playSound('open-panel', { playbackRate: 0.75 })
    beginClose(-0.75)
    onSelect(index, currentOffer.sequence, option.skillId)
  }
  chooseRef.current = choose

  useEffect(() => {
    const choiceIndex = displayedOffer.automaticChoiceIndex
    if (phase !== 'settled' || choiceIndex === undefined) return
    if (!displayedOffer.options[choiceIndex]) return
    selectedIndexRef.current = choiceIndex
    setSelectedIndex(choiceIndex)
    buttonRefs.current[choiceIndex]?.focus()
    const timeout = window.setTimeout(
      () => chooseRef.current(choiceIndex, true),
      NATIVE_SELECTOR_ACCEPT_TICKS * NATIVE_TICK_MS,
    )
    return () => window.clearTimeout(timeout)
  }, [displayedOffer.automaticChoiceIndex, displayedOffer.options, displayedOffer.sequence, phase])

  const reroll = () => {
    if (
      submittingRef.current
      || !revealReadyRef.current
      || !displayedAvailabilityRef.current
      || displayedOfferRef.current.automaticChoiceIndex !== undefined
    ) return
    updateDetail(null)
    submittingRef.current = true
    displayedAvailabilityRef.current = false
    rerollStartedAtRef.current = performance.now()
    phaseRef.current = 'reroll-wait'
    rendererRef.current?.setOffer(displayedOfferRef.current, false)
    setSubmitting(true)
    setSpecialActionsAvailable(false)
    setPhase('reroll-wait')
    audio.playSound('summon', { playbackRate: 0.8 })
    onReroll(displayedOfferRef.current.sequence)
  }

  const save = () => {
    if (
      submittingRef.current
      || !revealReadyRef.current
      || !displayedAvailabilityRef.current
      || displayedOfferRef.current.automaticChoiceIndex !== undefined
    ) return
    const offerSequence = displayedOfferRef.current.sequence
    audio.playSound('click', { playbackRate: 1 })
    audio.playSound('open-panel', { playbackRate: 0.75 })
    beginClose(-1)
    onSave(offerSequence)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveSelection(-1)
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      moveSelection(1)
    } else if (
      event.target === event.currentTarget
      && (event.key === 'Enter' || event.key === ' ')
    ) {
      event.preventDefault()
      choose(selectedIndexRef.current)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const centers = skillPickerCardCenters(displayedOffer.options.length)
  const iconBounds = skillPickerIconBounds(displayedOffer.options.length)
  const specialBounds = skillPickerSpecialActionBounds(displayedOffer.options.length)
  const automaticChoice = displayedOffer.automaticChoiceIndex !== undefined
  const disabled = automaticChoice || submitting || !revealReady || phase !== 'settled'
  const offerContentVisible = phase !== 'queued-wait'
  const detailOption = detailIndex === null ? undefined : displayedOffer.options[detailIndex]
  const detailText = detailOption
    ? skillPickerDetailPresentation(detailOption).lines.map(({ text }) => (
      nativeSkillExactTextRuns(text).map(({ text: runText }) => runText).join('')
    )).join(' ')
    : ''
  return (
    <div
      className="skill-picker-overlay"
      data-input-suspended={inputSuspended}
      role="dialog"
      aria-modal="true"
      aria-label={`Level ${displayedOffer.level}. Select a skill.`}
      inert={inputSuspended || undefined}
      onKeyDown={handleKeyDown}
    >
      <div ref={curtainRef} className="skill-picker-curtain" aria-hidden />
      <div
        ref={stageRef}
        className="main-menu-native-stage skill-picker-stage"
        style={style}
        data-offer-sequence={displayedOffer.sequence}
        data-automatic-choice-index={displayedOffer.automaticChoiceIndex ?? ''}
        data-picker-phase={phase}
        data-detail-choice-index={detailIndex ?? ''}
        data-detail-skill-id={detailOption?.skillId ?? ''}
        data-presentation-id={presentationId}
        data-renderer-state={rendererState}
        data-reveal-interactive={revealReady}
      >
        <div ref={hostRef} className="skill-picker-renderer" aria-hidden />
        <div
          className="skill-picker-actions"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) updateDetail(null)
          }}
        >
          {offerContentVisible ? displayedOffer.options.map((option, index) => {
            const card = skillPickerCardPresentation(option)
            const insightDetail = option.insight === true
              ? ` ${SKILL_PICKER_INSIGHT_DETAIL_TEXT}.`
              : ''
            return (
              <Fragment key={`${index}-${option.skillId}-${option.weldBuildId ?? 0}`}>
                <button
                  ref={(button) => { buttonRefs.current[index] = button }}
                  type="button"
                  className="skill-picker-action"
                  style={{ left: centers[index] }}
                  aria-label={`${option.insight === true ? 'Insight. ' : ''}${card.name}, ${card.familyLabel.trim()}. ${card.quickDescription}${insightDetail}`}
                  aria-pressed={selectedIndex === index}
                  data-choice-index={index}
                  data-description={card.quickDescription}
                  data-insight={option.insight === true}
                  data-root={card.root}
                  data-root-tint={card.rootTint.toString(16).padStart(6, '0')}
                  data-skill-id={option.skillId}
                  disabled={disabled}
                  onClick={() => choose(index)}
                  onFocus={() => {
                    updateDetail(null)
                    if (!revealReadyRef.current || selectedIndexRef.current === index) return
                    setSelection(index)
                  }}
                  onPointerEnter={() => {
                    updateDetail(null)
                    if (!revealReadyRef.current || selectedIndexRef.current === index) return
                    setSelection(index)
                  }}
                />
                <button
                  type="button"
                  className="skill-picker-info-action"
                  style={iconBounds[index]}
                  aria-label={`Show details for ${card.name}`}
                  aria-pressed={detailIndex === index}
                  data-detail-choice-index={index}
                  data-skill-id={option.skillId}
                  disabled={disabled}
                  onBlur={() => {
                    if (iconActivationRef.current?.choiceIndex === index) {
                      iconActivationRef.current = null
                    }
                    if (detailIndexRef.current === index) updateDetail(null)
                  }}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (disabled) return
                    const pointerType = event.detail > 0
                      && iconActivationRef.current?.choiceIndex === index
                      ? iconActivationRef.current.pointerType
                      : null
                    iconActivationRef.current = null
                    if (pointerType === 'mouse') {
                      choose(index)
                      return
                    }
                    setSelection(index)
                    updateDetail(index)
                  }}
                  onFocus={() => {
                    if (disabled) return
                    setSelection(index)
                    updateDetail(index)
                  }}
                  onPointerCancel={() => {
                    if (iconActivationRef.current?.choiceIndex === index) {
                      iconActivationRef.current = null
                    }
                  }}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return
                    iconActivationRef.current = {
                      choiceIndex: index,
                      pointerType: event.pointerType,
                    }
                  }}
                  onPointerEnter={() => {
                    if (disabled) return
                    setSelection(index)
                    updateDetail(index)
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType === 'mouse' && detailIndexRef.current === index) {
                      updateDetail(null)
                    }
                  }}
                />
              </Fragment>
            )
          }) : null}
          {offerContentVisible && specialActionsAvailable ? (
            <>
              <button
                type="button"
                className="skill-picker-special-action"
                style={specialBounds.save}
                aria-label="Save Skill"
                data-level-up-action="save"
                disabled={disabled}
                onFocus={() => updateDetail(null)}
                onClick={save}
              />
              <button
                type="button"
                className="skill-picker-special-action"
                style={specialBounds.reroll}
                aria-label="Roll Again"
                data-level-up-action="reroll"
                disabled={disabled}
                onFocus={() => updateDetail(null)}
                onClick={reroll}
              />
            </>
          ) : null}
        </div>
        {rendererState === 'error' ? (
          <p className="skill-picker-error" role="alert">Skill picker renderer unavailable.</p>
        ) : null}
        {detailText ? (
          <p className="skill-picker-detail-semantic" role="status" aria-live="polite">
            {detailText}
          </p>
        ) : null}
      </div>
    </div>
  )
}
