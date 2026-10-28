export const MATCH_LOADING_PRESENTATION_DELAY_MS = 150

export const MATCH_LOADING_STAGE_DEFINITIONS = [
  {
    stage: 'connecting_transport',
    label: 'Waking the multiplayer transport...',
    progress: 0.44,
  },
  {
    stage: 'authenticating_session',
    label: 'Proving your sigil to the host...',
    progress: 0.52,
  },
  { stage: 'establishing_route', label: 'Opening the route...', progress: 0.56 },
  {
    stage: 'synchronizing_host_settings',
    label: "Receiving the host's settings...",
    progress: 0.60,
  },
  {
    stage: 'receiving_host_checkpoint',
    label: "Receiving the host's checkpoint...",
    progress: 0.66,
  },
  { stage: 'preparing_host', label: 'Preparing the host...', progress: 0.66 },
  {
    stage: 'receiving_run_plan',
    label: "Receiving the host's boneyard...",
    progress: 0.70,
  },
  { stage: 'preparing_boneyard', label: 'Preparing the boneyard...', progress: 0.73 },
  { stage: 'generating_boneyard', label: 'Raising the boneyard...', progress: 0.77 },
  { stage: 'serializing_boneyard', label: 'Sealing the boneyard...', progress: 0.80 },
  { stage: 'reading_boneyard', label: 'Loading the boneyard...', progress: 0.83 },
  { stage: 'materializing_world', label: 'Awakening the world...', progress: 0.87 },
  {
    stage: 'receiving_world_checkpoint',
    label: 'Receiving the living world...',
    progress: 0.90,
  },
  {
    stage: 'receiving_wave_checkpoint',
    label: "Aligning the host's wave...",
    progress: 0.91,
  },
  {
    stage: 'materializing_participants',
    label: 'Gathering the coven...',
    progress: 0.92,
  },
  {
    stage: 'waiting_for_participants',
    label: 'Waiting for the coven...',
    progress: 0.95,
  },
  {
    stage: 'confirming_participants',
    label: 'Binding the coven...',
    progress: 0.98,
  },
  { stage: 'gameplay_ready', label: 'Entering the boneyard...', progress: 1.00 },
] as const

export type MatchLoadingStage = typeof MATCH_LOADING_STAGE_DEFINITIONS[number]['stage']
export type MatchLoadingFlow = 'boneyard' | 'hub'

export interface MatchLoadingState {
  flow: MatchLoadingFlow
  label: string
  progress: number
  stage: MatchLoadingStage
  startedAtMs: number
}

const definitionsByStage = new Map<MatchLoadingStage, {
  label: string
  progress: number
}>(MATCH_LOADING_STAGE_DEFINITIONS.map(({ label, progress, stage }) => [
  stage,
  { label, progress },
]))

export function beginMatchLoading(
  flow: MatchLoadingFlow,
  stage: MatchLoadingStage,
  startedAtMs = performance.now(),
): MatchLoadingState {
  const definition = definitionFor(stage)
  return {
    flow,
    label: definition.label,
    progress: definition.progress,
    stage,
    startedAtMs,
  }
}

export function advanceMatchLoading(
  loading: MatchLoadingState,
  stage: MatchLoadingStage,
): MatchLoadingState {
  const definition = definitionFor(stage)
  if (definition.progress <= loading.progress) return loading
  return {
    ...loading,
    label: definition.label,
    progress: definition.progress,
    stage,
  }
}

export function completeMatchLoading(loading: MatchLoadingState): MatchLoadingState {
  return advanceMatchLoading(loading, 'gameplay_ready')
}

export function shouldPresentMatchLoading(
  loading: MatchLoadingState,
  nowMs = performance.now(),
): boolean {
  return nowMs - loading.startedAtMs >= MATCH_LOADING_PRESENTATION_DELAY_MS
}

function definitionFor(stage: MatchLoadingStage): {
  label: string
  progress: number
} {
  const definition = definitionsByStage.get(stage)
  if (!definition) throw new Error(`Unknown match loading stage: ${stage}`)
  return definition
}
