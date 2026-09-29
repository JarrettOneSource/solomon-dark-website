/** Update the live draw flag, preserving every born actor and frozen clock. */
export function frozenWorldQuality<T extends { readonly enhancedEffects: boolean }>(
  frame: T,
  enhancedEffects: boolean,
): T {
  return frame.enhancedEffects === enhancedEffects ? frame : { ...frame, enhancedEffects }
}
