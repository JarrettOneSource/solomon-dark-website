import type {
  GameClientSession,
  GameLuaExecutionResult,
} from './client/game-client-session.ts'
import { gameCheatsEnabled } from './game-settings.ts'

export interface SolomonDarkLuaConsole {
  execute(code: string): Promise<GameLuaExecutionResult>
  help(): string
}

export interface SolomonDarkDeveloperApi {
  readonly lua: SolomonDarkLuaConsole
}

declare global {
  interface Window {
    solomonDark?: SolomonDarkDeveloperApi
  }
}

const HELP = [
  'Solomon Dark web Lua console',
  "await solomonDark.lua.execute('return sd.runtime.get_frame_state()')",
  'Supported namespaces: runtime, state, events, timer, rng, scene, gameplay, hub, player, world, waves, enemies.',
  'Authoritative execution is restricted to the current session host.',
].join('\n')

export function installGameLuaConsole(
  target: Window,
  session: Pick<GameClientSession, 'executeLua' | 'isHost'>
    & Partial<Pick<GameClientSession, 'developerAccess'>>,
  isEnabled: () => boolean = gameCheatsEnabled,
): () => void {
  const authorized = () => session.developerAccess === true || (isEnabled() && session.isHost)
  if (!authorized()) return () => {}
  const consoleApi: SolomonDarkLuaConsole = Object.freeze({
    async execute(code: string) {
      if (!authorized()) throw new Error('Authoritative Lua access is unavailable.')
      const result = await session.executeLua(code)
      for (const line of result.output) console.info(`[Lua] ${line}`)
      if (result.ok) {
        if (result.values.length > 0) console.info('[Lua return]', ...result.values)
      } else {
        console.error(`[Lua error] ${result.error ?? 'execution failed'}`)
      }
      return result
    },
    help() {
      console.info(HELP)
      return HELP
    },
  })
  const developerApi: SolomonDarkDeveloperApi = Object.freeze({ lua: consoleApi })
  Object.defineProperty(target, 'solomonDark', {
    configurable: true,
    enumerable: false,
    value: developerApi,
    writable: false,
  })
  console.info('[Solomon Dark] Developer Lua ready. Run solomonDark.lua.help() for Lua usage.')
  return () => {
    if (target.solomonDark === developerApi) delete target.solomonDark
  }
}
