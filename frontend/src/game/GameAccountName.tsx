import { gameAccountPresentation } from './game-account.ts'
import './game-account.css'

interface GameAccountNameProps {
  placement: 'hud' | 'title'
  username: string | null
}

export default function GameAccountName({
  placement,
  username,
}: GameAccountNameProps) {
  const presentation = gameAccountPresentation(username)
  if (!presentation) return null

  return (
    <span
      className={`game-account-name game-account-name-${placement}`}
      data-account-username={presentation.username}
      aria-label={presentation.accessibleLabel}
    >
      {presentation.username}
    </span>
  )
}
