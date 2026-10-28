import { createRoot } from 'react-dom/client'

import NativeUiDomWorkbenchPreview from './NativeUiDomWorkbenchPreview.tsx'

const WIDTH = 1_600
const HEIGHT = 900

export interface NativeUiDomWorkbench {
  destroy(): void
  readonly element: HTMLDivElement
  setVisible(visible: boolean): void
}

export function mountNativeUiDomWorkbench(host: HTMLElement): NativeUiDomWorkbench {
  const element = document.createElement('div')
  element.className = 'native-ui-dom-workbench'
  element.dataset.nativeUiDomWorkbench = 'ready'
  host.append(element)
  const root = createRoot(element)
  root.render(<NativeUiDomWorkbenchPreview />)
  const resize = () => {
    const scale = Math.min(host.clientWidth / WIDTH, host.clientHeight / HEIGHT)
    element.style.left = `${(host.clientWidth - WIDTH * scale) / 2}px`
    element.style.top = `${(host.clientHeight - HEIGHT * scale) / 2}px`
    element.style.transform = `scale(${scale})`
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()
  return {
    destroy() {
      observer.disconnect()
      root.unmount()
      element.remove()
    },
    element,
    setVisible(visible) {
      element.hidden = !visible
    },
  }
}
