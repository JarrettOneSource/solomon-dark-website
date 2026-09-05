import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { subscribeGamePresentationFrames } from './game-presentation-frame-loop.ts'
import { setNativeModalSlideProgress } from './native-modal-slide-progress.ts'
import { nativeOptionalBookHudProgress } from './native-optional-book.ts'
import type { HubInventoryRenderer } from './renderer/hub-inventory-renderer.ts'
import type {
  HubInventoryRendererModel,
} from './renderer/hub-inventory/model.ts'
import type { RetainedRendererOwner } from './renderer/retained-renderer-owner.ts'
import {
  HUB_NATIVE_UI_TIMING,
  hubNativeUiCloseReveal,
  hubNativeUiReveal,
} from './renderer/hub-inventory-render-contract.ts'

interface HubInventoryRendererBinding {
  readonly rendererOwner: RetainedRendererOwner<HubInventoryRenderer>
  readonly model: HubInventoryRendererModel
  readonly closing: boolean
  readonly forceModalHudSettled: boolean
  readonly onInventoryCloseComplete: () => void
  readonly chatCompletionHandledRef: RefObject<boolean>
  readonly advanceChatRef: RefObject<() => void>
}

export function useHubInventoryRenderer({
  rendererOwner, model, closing, forceModalHudSettled, onInventoryCloseComplete,
  chatCompletionHandledRef, advanceChatRef,
}: HubInventoryRendererBinding) {
  const hostRef = useRef<HTMLDivElement>(null)

  const rendererRef = useRef<HubInventoryRenderer | null>(null)

  const modelRef = useRef<HubInventoryRendererModel | null>(null)

  const revealStartedAtRef = useRef<number | null>(null)

  const closeStartedAtRef = useRef<number | null>(null)

  const closeStartRevealRef = useRef(0)

  const closeCompletedRef = useRef(false)

  const closingRef = useRef(closing)

  const forceModalHudSettledRef = useRef(forceModalHudSettled)

  const onInventoryCloseCompleteRef = useRef(onInventoryCloseComplete)

  const [rendererState, setRendererState] = useState<'error' | 'loading' | 'ready'>('loading')

  closingRef.current = closing

  forceModalHudSettledRef.current = forceModalHudSettled

  onInventoryCloseCompleteRef.current = onInventoryCloseComplete

  useLayoutEffect(() => {
    if (model.kind !== 'inventory') return
    closeStartedAtRef.current = null
    closeStartRevealRef.current = 0
    closeCompletedRef.current = false
    setNativeModalSlideProgress('inventory', 0)
  }, [model.kind])

  useLayoutEffect(() => {
    revealStartedAtRef.current = null
  }, [model.kind])

  useLayoutEffect(() => {
    modelRef.current = model
    rendererRef.current?.setModel(model)
  }, [model])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    let renderer: HubInventoryRenderer | undefined
    let detachCanvas: (() => void) | undefined
    void rendererOwner.get().then((created) => {
      if (disposed) return
      renderer = created
      rendererRef.current = created
      created.setModel(modelRef.current!)
      detachCanvas = created.mount(host)
      revealStartedAtRef.current = null
      setRendererState('ready')
    }).catch(() => {
      if (!disposed) setRendererState('error')
    })
    const unsubscribe = subscribeGamePresentationFrames((nowMs) => {
      if (!renderer) return
      revealStartedAtRef.current ??= nowMs
      const currentKind = modelRef.current?.kind
      if (!currentKind) return
      const step = currentKind === 'dialogue'
        ? HUB_NATIVE_UI_TIMING.chatRevealPerTick
        : HUB_NATIVE_UI_TIMING.inventoryRevealPerTick
      const openingReveal = hubNativeUiReveal(nowMs - revealStartedAtRef.current, step)
      let reveal = openingReveal
      if (currentKind === 'inventory' && closingRef.current) {
        if (closeStartedAtRef.current === null) {
          closeStartedAtRef.current = nowMs
          closeStartRevealRef.current = openingReveal
        }
        reveal = hubNativeUiCloseReveal(
          closeStartRevealRef.current,
          nowMs - closeStartedAtRef.current,
          step,
        )
      }
      if (currentKind === 'inventory') setNativeModalSlideProgress('inventory', reveal)
      const frame = renderer.render(
        nowMs,
        reveal,
        currentKind === 'inventory'
          ? nativeOptionalBookHudProgress(reveal, forceModalHudSettledRef.current)
          : reveal,
      )
      if (
        currentKind === 'inventory'
        && closingRef.current
        && reveal === 0
        && !closeCompletedRef.current
      ) {
        closeCompletedRef.current = true
        onInventoryCloseCompleteRef.current()
      }
      const current = modelRef.current
      if (frame.chatComplete && current?.kind === 'dialogue'
        && current.content.kind === 'speech' && !chatCompletionHandledRef.current) {
        chatCompletionHandledRef.current = true
        advanceChatRef.current()
      }
    })
    return () => {
      disposed = true
      unsubscribe()
      rendererRef.current = null
      detachCanvas?.()
    }
  }, [rendererOwner, chatCompletionHandledRef, advanceChatRef])
  return { hostRef, rendererRef, rendererState }
}
