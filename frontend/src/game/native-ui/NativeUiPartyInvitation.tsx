import type { CSSProperties } from 'react'

import NativeUiButton from './NativeUiButton.tsx'
import NativeUiMessageBox from './NativeUiMessageBox.tsx'
import {
  NATIVE_UI_PARTY_INVITATION,
  nativeUiPartyInvitationActionBounds,
  nativeUiPartyInvitationBody,
} from './native-ui-party-chip.ts'

export interface NativeUiPartyInvitationProps {
  readonly className?: string
  /** Curtain alpha behind the box; pass 0 when the host stage dims the scene itself. */
  readonly dimAlpha?: number
  readonly height?: number
  readonly inviter: string
  readonly onAccept: () => void
  readonly onDeny: () => void
  readonly style?: CSSProperties
  readonly width?: number
}

/**
 * A party invitation as the stock message box: PARTY INVITATION over the
 * inviter's name, ACCEPT and DENY on the party menu's footer line. DENY is the
 * back action, so the game's back key answers the box the safe way.
 */
export default function NativeUiPartyInvitation({
  className,
  dimAlpha,
  height,
  inviter,
  onAccept,
  onDeny,
  style,
  width,
}: NativeUiPartyInvitationProps) {
  const [accept, deny] = nativeUiPartyInvitationActionBounds()
  return (
    <NativeUiMessageBox
      accessibleTitle="Party invitation"
      body={nativeUiPartyInvitationBody(inviter)}
      bounds={NATIVE_UI_PARTY_INVITATION.bounds}
      className={className}
      dimAlpha={dimAlpha}
      height={height}
      style={style}
      title={NATIVE_UI_PARTY_INVITATION.title}
      width={width}
    >
      <NativeUiButton data-game-default-focus="true" name="accept" nativeBounds={accept} onClick={onAccept}>
        ACCEPT
      </NativeUiButton>
      <NativeUiButton data-game-back="true" name="deny" nativeBounds={deny} onClick={onDeny}>
        DENY
      </NativeUiButton>
    </NativeUiMessageBox>
  )
}
