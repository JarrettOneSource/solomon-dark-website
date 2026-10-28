type ResumeTokenStorage = Pick<Storage, 'getItem' | 'setItem'>

const RESUME_TOKEN_KEY_PREFIX = 'solomon-dark-game-resume-v1:'

export function readGameResumeToken(
  playerId: string,
  storage: ResumeTokenStorage | null = browserSessionStorage(),
): string | undefined {
  if (!storage) return undefined
  try {
    return storage.getItem(`${RESUME_TOKEN_KEY_PREFIX}${playerId}`) ?? undefined
  } catch {
    return undefined
  }
}

export function rememberGameResumeToken(
  playerId: string,
  token: string,
  storage: ResumeTokenStorage | null = browserSessionStorage(),
): void {
  if (!storage) return
  try {
    storage.setItem(`${RESUME_TOKEN_KEY_PREFIX}${playerId}`, token)
  } catch {
    // A blocked session store leaves ordinary post-disconnect save restore available.
  }
}

function browserSessionStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.sessionStorage
}
