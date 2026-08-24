export type BrowserSaveDetection = 'loading' | 'missing' | 'present' | 'unavailable'

export function shouldOfferStockTutorial(detection: BrowserSaveDetection): boolean {
  return detection === 'missing'
}
