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
  'Supported namespaces: runtime, state, events, timer, rng, scene, gameplay, hub, player, world, waves, enemies; developer accounts also receive dev and bots.',
  "Grant another live player Gold: await solomonDark.lua.execute(\"return sd.dev.grant_gold(5000, sd.player.list()[2].id)\")",
  "List developer stock items/skills/Welds with sd.dev.list_items(), sd.dev.list_skills(), and sd.dev.list_welds().",
  "Grant stock state with sd.dev.grant_item(key, quantity, player_id), sd.dev.grant_skill(id, ranks, player_id), or sd.dev.grant_weld(build_id, player_id).",
  "Summon a Hub bot: await solomonDark.lua.execute('return sd.bots.summon()')",
  'Authoritative execution requires current session-host authority or an account-bound developer entitlement.',
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
      if (session.developerAccess !== true) {
        if (!isEnabled()) throw new Error('Enable Cheats is off.')
        if (!session.isHost) throw new Error('Only the current session host may execute Lua.')
      }
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
