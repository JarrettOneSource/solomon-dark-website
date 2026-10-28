import { fileURLToPath } from 'node:url'

export function resolveWebLuaWasmPath(entryUrl: string): string {
  const entry = new URL(entryUrl)
  const wasm = entry.pathname.endsWith('.mjs')
    ? new URL('./lua54.wasm', entry)
    : new URL('../../../node_modules/wasmoon/dist/glue.wasm', entry)
  return fileURLToPath(wasm)
}
