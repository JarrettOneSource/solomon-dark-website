import { api, type SharedMobileUiLayout } from '../lib/api.ts'
import {
  mobileUiLayoutDocument,
  mobileUiLayoutFromDocument,
  readMobileUiLayoutState,
  setMobileUiLayout,
} from './mobile-ui-layout.ts'

export async function publishCurrentMobileUiLayout(): Promise<SharedMobileUiLayout> {
  const current = readMobileUiLayoutState()
  if (!current.customized) {
    throw new Error('Customize and save a mobile layout before submitting it.')
  }
  return api.mobileUiLayouts.publish(mobileUiLayoutDocument(current.layout))
}

export async function loadSharedMobileUiLayout(code: string): Promise<SharedMobileUiLayout> {
  const shared = await api.mobileUiLayouts.get(code.trim())
  const layout = mobileUiLayoutFromDocument(shared.layout)
  if (!layout) throw new Error('That shared layout is not a supported mobile UI document.')
  setMobileUiLayout(layout)
  return shared
}
