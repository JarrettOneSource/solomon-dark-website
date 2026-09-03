import { useMemo, type CSSProperties } from 'react'

import NativeUiPlanView from './NativeUiPlanView.tsx'
import {
  parseNativeUiPartyChipAction,
  planNativeUiPartyChip,
  type NativeUiPartyChipMember,
  type NativeUiPartyChipRequest,
} from './native-ui-party-chip.ts'
import { NATIVE_UI_PARTY_MENU_TAGS } from './native-ui-party-menu.ts'
import './native-ui.css'

export interface NativeUiPartyChipProps {
  readonly className?: string
  /** Touch: the header collapses and expands the rows instead of opening the menu. */
  readonly collapsible?: boolean
  readonly error?: string | null
  readonly expanded: boolean
  readonly members: readonly NativeUiPartyChipMember[]
  readonly onMember?: (memberId: string) => void
  /** Header press on a pointer device: open the party menu on Members. */
  readonly onOpen?: () => void
  /** A WANTS TO JOIN row: open the party menu where the request can be answered. */
  readonly onRequest?: (requestId: string) => void
  readonly onSettings?: () => void
  /** Header press while `collapsible`. */
  readonly onToggle?: () => void
  readonly requests?: readonly NativeUiPartyChipRequest[]
  /** Draws the gold gear and its Party settings button. */
  readonly settings?: boolean
  readonly style?: CSSProperties
}

const NO_REQUESTS: readonly NativeUiPartyChipRequest[] = []

/**
 * The hub party chip drawn from the native kit: a marble card with a skull,
 * PARTY, the gold gear and the arrow in its header, and a bracket row per
 * member and pending request. Transparent buttons cover the plan's actions.
 */
export default function NativeUiPartyChip({
  className,
  collapsible = false,
  error = null,
  expanded,
  members,
  onMember,
  onOpen,
  onRequest,
  onSettings,
  onToggle,
  requests = NO_REQUESTS,
  settings = false,
  style,
}: NativeUiPartyChipProps) {
  const plan = useMemo(
    () => planNativeUiPartyChip({ collapsible, error, expanded, members, requests, settings }),
    [collapsible, error, expanded, members, requests, settings],
  )
  const classes = ['native-ui-party-chip', className].filter(Boolean).join(' ')
  return (
    <div
      className={classes}
      data-native-ui-party-chip-expanded={expanded}
      style={{ height: plan.height, width: plan.width, ...style }}
    >
      <NativeUiPlanView plan={plan} />
      {plan.actions.map((action) => {
        const parsed = parseNativeUiPartyChipAction(action.id)
        if (!parsed) return null
        const bounds: CSSProperties = {
          height: action.bounds.height,
          left: action.bounds.left,
          top: action.bounds.top,
          width: action.bounds.width,
        }
        switch (parsed.kind) {
          case 'header':
            return (
              <button
                key={action.id}
                aria-expanded={collapsible ? expanded : undefined}
                className="native-ui-party-chip-action"
                data-native-ui-party-chip="header"
                onClick={collapsible ? onToggle : onOpen}
                style={bounds}
                type="button"
              >
                {collapsible ? 'Party' : 'Party menu'}
              </button>
            )
          case 'settings':
            return (
              <button
                key={action.id}
                className="native-ui-party-chip-action"
                data-native-ui-party-chip="settings"
                onClick={onSettings}
                style={bounds}
                type="button"
              >
                Party settings
              </button>
            )
          case 'member': {
            const member = members.find(candidate => candidate.id === parsed.target)
            return (
              <button
                key={action.id}
                className="native-ui-party-chip-action"
                data-native-ui-party-chip="member"
                data-native-ui-party-chip-id={parsed.target}
                onClick={() => onMember?.(parsed.target)}
                style={bounds}
                type="button"
              >
                <span data-native-ui-party-chip-name="true">{member?.name ?? parsed.target}</span>
                {member?.tags.map(tag => (
                  <span key={tag}>, {NATIVE_UI_PARTY_MENU_TAGS[tag].label.toLowerCase()}</span>
                ))}
              </button>
            )
          }
          case 'request': {
            const request = requests.find(candidate => candidate.id === parsed.target)
            return (
              <button
                key={action.id}
                className="native-ui-party-chip-action"
                data-native-ui-party-chip="request"
                data-native-ui-party-chip-id={parsed.target}
                onClick={() => onRequest?.(parsed.target)}
                style={bounds}
                type="button"
              >
                {request?.name ?? parsed.target} wants to join
              </button>
            )
          }
          default:
            return null
        }
      })}
    </div>
  )
}
