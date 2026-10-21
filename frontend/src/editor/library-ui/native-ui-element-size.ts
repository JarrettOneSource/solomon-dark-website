import { useLayoutEffect, useState, type RefObject } from 'react'

interface ElementSize {
  readonly height: number
  readonly width: number
}

/** Layout dimensions stay in the plan's coordinate space under a scaled parent. */
export function useNativeUiElementSize<T extends HTMLElement>(
  ref: RefObject<T | null>,
  initialSize: ElementSize,
): ElementSize {
  const [size, setSize] = useState(initialSize)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return
      setSize(previous => previous.width === width && previous.height === height
        ? previous
        : { height, width })
    }
    update(element.offsetWidth, element.offsetHeight)
    const observer = new ResizeObserver(([entry]) => {
      const box = entry!.borderBoxSize[0]!
      update(box.inlineSize, box.blockSize)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}
