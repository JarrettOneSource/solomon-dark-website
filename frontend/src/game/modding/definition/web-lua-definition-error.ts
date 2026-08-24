import type { WebLuaDefinitionSource } from './web-lua-definition-types.ts'

export const WEB_LUA_DEFINITION_ERROR_CODES = [
  'E_API_VERSION',
  'E_ASSET',
  'E_BUDGET',
  'E_CAPABILITY',
  'E_CONTENT_KEY',
  'E_CYCLE',
  'E_DUPLICATE',
  'E_GRAPH',
  'E_INTENT',
  'E_MOUNT_CONFLICT',
  'E_REDUCER',
  'E_REFERENCE',
  'E_RULE',
  'E_SCHEMA',
  'E_UNKNOWN_FIELD',
] as const

export type WebLuaDefinitionErrorCode = typeof WEB_LUA_DEFINITION_ERROR_CODES[number]

export interface WebLuaDefinitionIssue {
  readonly code: WebLuaDefinitionErrorCode
  readonly hint: string | null
  readonly message: string
  readonly path: string
  readonly source: WebLuaDefinitionSource | null
}

export class WebLuaDefinitionError extends Error {
  readonly issues: readonly WebLuaDefinitionIssue[]

  constructor(issues: readonly WebLuaDefinitionIssue[]) {
    if (issues.length === 0) throw new Error('WebLuaDefinitionError requires at least one issue')
    super(formatWebLuaDefinitionIssues(issues))
    this.name = 'WebLuaDefinitionError'
    this.issues = Object.freeze([...issues])
  }
}

export function formatWebLuaDefinitionIssues(
  issues: readonly WebLuaDefinitionIssue[],
): string {
  return issues.map((issue) => {
    const location = issue.source
      ? `${issue.source.file}${issue.source.line === null ? '' : `:${issue.source.line}`}`
      : null
    const heading = [issue.code, issue.path, location].filter(Boolean).join(' ')
    return `${heading}: ${issue.message}${issue.hint ? `\n${issue.hint}` : ''}`
  }).join('\n')
}

export function webLuaDefinitionIssue(
  code: WebLuaDefinitionErrorCode,
  path: string,
  message: string,
  options: Readonly<{
    hint?: string
    source?: WebLuaDefinitionSource
  }> = {},
): WebLuaDefinitionIssue {
  return Object.freeze({
    code,
    hint: options.hint ?? null,
    message,
    path,
    source: options.source ?? null,
  })
}
