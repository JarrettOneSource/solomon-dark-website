/**
 * Pack-time bundling for multi-file mods.
 *
 * The Website backend and the game host only ever read one entry script, so
 * `sdmod pack` appends the other `scripts/*.lua` files to the entry script as a
 * single trailing comment line. Lua ignores the comment, the original line
 * numbers stay exact, and the definition runtime reads the bundle back so that
 * `sd.include` keeps working after packaging.
 */

export const WEB_LUA_SCRIPT_PATH = /^scripts\/.+\.lua$/
export const WEB_LUA_BUNDLE_MARKER = '--@sd-bundle '
export const WEB_LUA_MAX_INCLUDED_SCRIPTS = 64
export const WEB_LUA_MAX_SCRIPT_BYTES = 256 * 1024

export function bundleWebLuaEntryScript(
  entryScript: string,
  scripts: ReadonlyMap<string, string>,
): string {
  validateWebLuaScriptSet(scripts)
  if (scripts.size === 0) {
    validateBundledScriptSize(entryScript)
    return entryScript
  }
  const bundle: Record<string, string> = {}
  for (const path of [...scripts.keys()].sort()) {
    bundle[path] = scripts.get(path)!
  }
  const line = `${WEB_LUA_BUNDLE_MARKER}${JSON.stringify(bundle)}`
  if (line.includes('\n') || line.includes('\r')) throw new Error('bundled scripts must serialize to one line')
  const separator = entryScript.endsWith('\n') ? '' : '\n'
  const bundled = `${entryScript}${separator}${line}\n`
  validateBundledScriptSize(bundled)
  return bundled
}

export function readWebLuaScriptBundle(
  entryScript: string,
): ReadonlyMap<string, string> | null {
  const lines = entryScript.split('\n')
  let bundleLine = ''
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const candidate = lines[index]!.replace(/\r$/, '')
    if (candidate.trim().length === 0) continue
    bundleLine = candidate
    break
  }
  if (!bundleLine.startsWith(WEB_LUA_BUNDLE_MARKER)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(bundleLine.slice(WEB_LUA_BUNDLE_MARKER.length))
  } catch {
    throw new Error('the packed script bundle is not valid JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('the packed script bundle must be an object of script paths to Lua text')
  }
  const scripts = new Map<string, string>()
  for (const [path, text] of Object.entries(parsed)) {
    if (!WEB_LUA_SCRIPT_PATH.test(path) || typeof text !== 'string') {
      throw new Error(`the packed script bundle contains an invalid entry: ${path}`)
    }
    scripts.set(path, text)
  }
  validateWebLuaScriptSet(scripts)
  return scripts
}

export function validateWebLuaScriptSet(scripts: ReadonlyMap<string, string>): void {
  if (scripts.size > WEB_LUA_MAX_INCLUDED_SCRIPTS) {
    throw new Error(`a package may include at most ${WEB_LUA_MAX_INCLUDED_SCRIPTS} extra scripts`)
  }
  let total = 0
  for (const [path, text] of scripts) {
    if (!WEB_LUA_SCRIPT_PATH.test(path)) throw new Error(`included script path is invalid: ${path}`)
    total += Buffer.byteLength(text, 'utf8')
  }
  if (total > WEB_LUA_MAX_SCRIPT_BYTES) {
    throw new Error(`included scripts exceed ${WEB_LUA_MAX_SCRIPT_BYTES} bytes in total`)
  }
}

function validateBundledScriptSize(script: string): void {
  const bytes = Buffer.byteLength(script, 'utf8')
  if (bytes > WEB_LUA_MAX_SCRIPT_BYTES) {
    throw new Error(
      `the entry script and its included scripts total ${bytes} bytes, above the ${WEB_LUA_MAX_SCRIPT_BYTES} byte limit; move large tables into assets or trim the scripts`,
    )
  }
}
