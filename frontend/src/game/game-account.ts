export interface GameAccountPresentation {
  accessibleLabel: string
  username: string
}

export function gameAccountPresentation(
  username: string | null,
): GameAccountPresentation | null {
  return username === null
    ? null
    : {
        accessibleLabel: `Signed in as ${username}`,
        username,
      }
}
