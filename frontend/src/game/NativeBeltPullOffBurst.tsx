import { useMemo, type CSSProperties } from 'react'

import {
  nativeBeltPullOffBurstMembers,
  type NativeBeltPullOffBurstMember,
} from './skill-book-model.ts'
import { hub } from '../lib/assets.ts'
import './native-belt-pull-off.css'

const RECORD_GEOMETRY = {
  65: { height: 33, x: 976, y: 0, width: 34 },
  69: { height: 23, x: 242, y: 391, width: 23 },
} as const

interface NativeBeltPullOffBurstProps {
  readonly className?: string
  readonly onComplete?: () => void
  readonly style?: CSSProperties
}

export default function NativeBeltPullOffBurst({
  className,
  onComplete,
  style,
}: NativeBeltPullOffBurstProps) {
  const members = useMemo(() => nativeBeltPullOffBurstMembers(
    Math.random() < 0.5 ? 90 : 120,
  ), [])
  const terminalIndex = members.reduce((winner, member, index) => (
    member.durationMs > members[winner]!.durationMs ? index : winner
  ), 0)
  return (
    <span
      className={['native-belt-pull-off-burst', className].filter(Boolean).join(' ')}
      data-move-fade-count={members.filter(({ record }) => record === 69).length}
      data-smoke-count={members.filter(({ record }) => record === 65).length}
      style={style}
      aria-hidden
    >
      {members.map((member, index) => (
        <span
          className="native-belt-pull-off-member"
          data-native-ui-record={`UI.${member.record}`}
          key={`${member.record}:${index}`}
          onAnimationEnd={index === terminalIndex ? onComplete : undefined}
          style={memberStyle(member)}
        />
      ))}
    </span>
  )
}

function memberStyle(member: NativeBeltPullOffBurstMember): CSSProperties {
  const record = RECORD_GEOMETRY[member.record]
  return {
    '--native-belt-burst-brightness': member.brightness,
    '--native-belt-burst-duration': `${member.durationMs}ms`,
    '--native-belt-burst-end-x': `${member.endX}px`,
    '--native-belt-burst-end-y': `${member.endY}px`,
    '--native-belt-burst-rotation': `${member.rotationDegrees}deg`,
    '--native-belt-burst-scale-x': member.scaleX,
    '--native-belt-burst-scale-y': member.scaleY,
    '--native-belt-burst-start-x': `${member.startX}px`,
    '--native-belt-burst-start-y': `${member.startY}px`,
    backgroundImage: `url("${hub.trader.uiAtlas}")`,
    backgroundPosition: `${-record.x}px ${-record.y}px`,
    height: record.height,
    marginLeft: -record.width / 2,
    marginTop: -record.height / 2,
    width: record.width,
  } as CSSProperties
}
