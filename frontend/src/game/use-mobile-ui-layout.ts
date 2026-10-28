import { useEffect, useState } from 'react'

import {
  MOBILE_UI_LAYOUT_STORAGE_KEY,
  readMobileUiLayoutState,
  subscribeMobileUiLayout,
  type MobileUiLayoutState,
} from './mobile-ui-layout.ts'

export function useMobileUiLayout(): MobileUiLayoutState {
  const [state, setState] = useState(readMobileUiLayoutState)

  useEffect(() => {
    const unsubscribe = subscribeMobileUiLayout(setState)
    const storage = (event: StorageEvent) => {
      if (
        event.storageArea === window.localStorage
        && (event.key === MOBILE_UI_LAYOUT_STORAGE_KEY || event.key === null)
      ) {
        setState(readMobileUiLayoutState())
      }
    }
    window.addEventListener('storage', storage)
    return () => {
      unsubscribe()
      window.removeEventListener('storage', storage)
    }
  }, [])

  return state
}
