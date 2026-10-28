export interface GameAccountPresentation {
  accessibleLabel: string
  username: string
}

export function gameAccountPresentation(
  username: string | null,
): GameAccountPresentation {
  return username === null
    ? {
        accessibleLabel: 'Not logged in',
        username: 'Not logged in',
      }
    : {
        accessibleLabel: `Signed in as ${username}`,
        username,
      }
}
