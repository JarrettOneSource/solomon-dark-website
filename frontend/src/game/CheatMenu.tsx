import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

import { gameSettings as settingsAssets } from '../lib/assets.ts'
import type { GameClientSession } from './client/game-client-session.ts'
import {
  CHEAT_MENU_BOT_DISCIPLINES,
  CHEAT_MENU_BOT_ELEMENTS,
  CHEAT_MENU_CATALOG_QUERY,
  CHEAT_MENU_EXPERIENCE_MAX,
  CHEAT_MENU_GOLD_MAX,
  CHEAT_MENU_RUN_SEED_MAX,
  CHEAT_MENU_SPAWN_COUNT_MAX,
  CHEAT_MENU_TABS,
  appendCheatConsoleHistory,
  compileCheatMenuAction,
  decodeCheatMenuCatalogs,
  formatCheatConsoleValues,
  gameCheatMenuAvailable,
  type CheatMenuAction,
  type CheatMenuCatalogs,
  type CheatMenuTab,
} from './cheat-menu-contract.ts'
import type { GameSnapshot } from './protocol/game-state.ts'
import { MAX_LUA_CONSOLE_CODE_LENGTH } from './protocol/game-protocol.ts'
import NativePanelArt from './native-ui/NativePanelArt.tsx'
import './cheat-menu.css'

interface CheatMenuProps {
  onClose: () => void
  openKeyCode: string
  session: GameClientSession
  snapshot: GameSnapshot
}

interface ConsoleEntry {
  readonly code: string
  readonly error: string | null
  readonly id: number
  readonly output: readonly string[]
  readonly returned: string
}

interface ActionReceipt {
  readonly message: string
  readonly tone: 'error' | 'ok' | 'working'
}

const EMPTY_CATALOGS: CheatMenuCatalogs = Object.freeze({
  enemies: Object.freeze([]),
  items: Object.freeze([]),
  skills: Object.freeze([]),
  welds: Object.freeze([]),
})

export default function CheatMenu({
  onClose,
  openKeyCode,
  session,
  snapshot,
}: CheatMenuProps) {
  const [tab, setTab] = useState<CheatMenuTab>('cheats')
  const [catalogs, setCatalogs] = useState<CheatMenuCatalogs | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [targetPlayerId, setTargetPlayerId] = useState(session.playerId)
  const [gold, setGold] = useState(() => String(
    snapshot.players[session.playerId]?.economy.gold ?? 10_000,
  ))
  const [experience, setExperience] = useState('1000')
  const [runSeed, setRunSeed] = useState('42')
  const [enemyKey, setEnemyKey] = useState('')
  const [enemyCount, setEnemyCount] = useState('1')
  const [itemKey, setItemKey] = useState('')
  const [itemQuantity, setItemQuantity] = useState('1')
  const [skillId, setSkillId] = useState('')
  const [skillRanks, setSkillRanks] = useState('1')
  const [weldId, setWeldId] = useState('')
  const [botDiscipline, setBotDiscipline] = useState<typeof CHEAT_MENU_BOT_DISCIPLINES[number]>('arcane')
  const [botElement, setBotElement] = useState<typeof CHEAT_MENU_BOT_ELEMENTS[number]>('fire')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionReceipt, setActionReceipt] = useState<ActionReceipt | null>(null)
  const [consoleCode, setConsoleCode] = useState('return sd.runtime.get_frame_state()')
  const [consoleEntries, setConsoleEntries] = useState<readonly ConsoleEntry[]>([])
  const [consoleHistory, setConsoleHistory] = useState<readonly string[]>([])
  const [historyCursor, setHistoryCursor] = useState<number | null>(null)
  const [consoleBusy, setConsoleBusy] = useState(false)
  const nextConsoleEntryIdRef = useRef(1)
  const consoleDraftRef = useRef(consoleCode)
  const consoleEditorRef = useRef<HTMLTextAreaElement>(null)

  const target = snapshot.players[targetPlayerId] ?? snapshot.players[session.playerId] ?? null
  const developer = session.developerAccess
  const available = gameCheatMenuAvailable(session)
  const activeCatalogs = catalogs ?? EMPTY_CATALOGS
  const grantableSkills = useMemo(
    () => activeCatalogs.skills.filter(({ weldOnly }) => !weldOnly),
    [activeCatalogs.skills],
  )
  const hubSeedAvailable = snapshot.world.kind === 'hub' && snapshot.run.phase === 'hub'
  const enemySpawnAvailable = snapshot.world.kind === 'boneyard'
    && snapshot.run.phase === 'active'
  const botSummonAvailable = developer
    && session.sessionKind === 'global-hub'
    && snapshot.world.kind === 'hub'
  const sceneLabel = snapshot.world.kind === 'hub'
    ? 'HUB'
    : `${snapshot.world.tutorial ? 'TUTORIAL' : 'BONEYARD'} · ${snapshot.run.phase.toUpperCase()}`

  useEffect(() => {
    if (!available) onClose()
  }, [available, onClose])

  useEffect(() => {
    if (snapshot.players[targetPlayerId]) return
    const nextPlayerId = snapshot.players[session.playerId]
      ? session.playerId
      : Object.keys(snapshot.players)[0] ?? ''
    setTargetPlayerId(nextPlayerId)
    const nextPlayer = snapshot.players[nextPlayerId]
    if (nextPlayer) setGold(String(nextPlayer.economy.gold))
  }, [session.playerId, snapshot.players, targetPlayerId])

  useEffect(() => {
    let cancelled = false
    setCatalogError(null)
    void session.executeLua(CHEAT_MENU_CATALOG_QUERY).then((result) => {
      if (cancelled) return
      if (!result.ok) throw new Error(result.error ?? 'Catalog query failed.')
      setCatalogs(decodeCheatMenuCatalogs(result.values))
    }).catch((error: unknown) => {
      if (cancelled) return
      setCatalogError(errorMessage(error))
      setCatalogs(EMPTY_CATALOGS)
    })
    return () => { cancelled = true }
  }, [session])

  useEffect(() => {
    if (!enemyKey && activeCatalogs.enemies[0]) setEnemyKey(activeCatalogs.enemies[0].key)
    if (!itemKey && activeCatalogs.items[0]) setItemKey(activeCatalogs.items[0].key)
    if (!skillId && grantableSkills[0]) setSkillId(String(grantableSkills[0].id))
    if (!weldId && activeCatalogs.welds[0]) setWeldId(String(activeCatalogs.welds[0].id))
  }, [activeCatalogs, enemyKey, grantableSkills, itemKey, skillId, weldId])

  useEffect(() => {
    const closeFromKey = (event: KeyboardEvent) => {
      if (
        event.repeat
        || event.altKey
        || event.ctrlKey
        || event.metaKey
        || (event.code !== openKeyCode && event.key !== 'Escape')
      ) return
      event.preventDefault()
      event.stopImmediatePropagation()
      onClose()
    }
    window.addEventListener('keydown', closeFromKey, { capture: true })
    return () => window.removeEventListener('keydown', closeFromKey, { capture: true })
  }, [onClose, openKeyCode])

  useEffect(() => {
    if (tab === 'console') consoleEditorRef.current?.focus()
  }, [tab])

  const runAction = useCallback(async (label: string, action: CheatMenuAction) => {
    if (actionBusy) return
    setActionBusy(true)
    setActionReceipt({ message: `${label}…`, tone: 'working' })
    try {
      const result = await session.executeLua(compileCheatMenuAction(action))
      if (!result.ok) throw new Error(result.error ?? `${label} failed.`)
      const returned = formatCheatConsoleValues(result.values)
      setActionReceipt({
        message: returned ? `${label}: ${returned}` : `${label} accepted.`,
        tone: 'ok',
      })
    } catch (error) {
      setActionReceipt({ message: errorMessage(error), tone: 'error' })
    } finally {
      setActionBusy(false)
    }
  }, [actionBusy, session])

  const executeConsole = useCallback(async () => {
    const code = consoleCode.trim()
    if (!code || consoleBusy) return
    setConsoleBusy(true)
    setConsoleHistory((history) => appendCheatConsoleHistory(history, code))
    setHistoryCursor(null)
    consoleDraftRef.current = ''
    const id = nextConsoleEntryIdRef.current
    nextConsoleEntryIdRef.current += 1
    try {
      const result = await session.executeLua(consoleCode)
      setConsoleEntries((entries) => Object.freeze([
        ...entries,
        {
          code,
          error: result.ok ? null : result.error ?? 'Lua execution failed.',
          id,
          output: Object.freeze([...result.output]),
          returned: result.ok ? formatCheatConsoleValues(result.values) : '',
        },
      ].slice(-100)))
    } catch (error) {
      setConsoleEntries((entries) => Object.freeze([
        ...entries,
        { code, error: errorMessage(error), id, output: Object.freeze([]), returned: '' },
      ].slice(-100)))
    } finally {
      setConsoleBusy(false)
    }
  }, [consoleBusy, consoleCode, session])

  const navigateHistory = (direction: -1 | 1) => {
    if (consoleHistory.length === 0) return
    if (historyCursor === null) consoleDraftRef.current = consoleCode
    const next = historyCursor === null
      ? direction < 0 ? consoleHistory.length - 1 : consoleHistory.length
      : Math.min(consoleHistory.length, Math.max(0, historyCursor + direction))
    setHistoryCursor(next === consoleHistory.length ? null : next)
    setConsoleCode(next === consoleHistory.length ? consoleDraftRef.current : consoleHistory[next]!)
  }

  const handleConsoleKey = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void executeConsole()
      return
    }
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault()
      navigateHistory(event.key === 'ArrowUp' ? -1 : 1)
    }
  }

  const submit = (
    event: FormEvent,
    label: string,
    action: () => CheatMenuAction,
  ) => {
    event.preventDefault()
    try {
      void runAction(label, action())
    } catch (error) {
      setActionReceipt({ message: errorMessage(error), tone: 'error' })
    }
  }

  return (
    <div className="game-settings-backdrop cheat-menu-backdrop" role="presentation">
      <section
        aria-label="Cheat menu"
        aria-modal="true"
        className="game-settings-dialog cheat-menu-dialog"
        data-cheat-menu-tab={tab}
        role="dialog"
        style={{
          '--settings-control-panel-atlas': `url("${settingsAssets.controlPanelAtlas}")`,
          '--settings-ui-atlas': `url("${settingsAssets.uiAtlas}")`,
        } as CSSProperties}
      >
        <NativePanelArt />
        <header className="cheat-menu-topbar">
          <div className="cheat-menu-identity">
            <strong>DEBUG MENU</strong>
            <span>{developer ? 'DEVELOPER' : 'CHEATS ON'} · {sceneLabel} · TICK {snapshot.tick}</span>
          </div>
          <nav aria-label="Debug menu tabs" className="cheat-menu-tabs" role="tablist">
            {CHEAT_MENU_TABS.map((candidate) => (
              <button
                aria-controls={`cheat-menu-${candidate}`}
                aria-selected={tab === candidate}
                id={`cheat-menu-${candidate}-tab`}
                key={candidate}
                onClick={() => setTab(candidate)}
                role="tab"
                type="button"
              >
                {candidate.toUpperCase()}
              </button>
            ))}
          </nav>
          <button
            aria-label="Close cheat menu"
            className="cheat-menu-close"
            data-game-back="true"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        {tab === 'cheats' ? (
          <div
            aria-labelledby="cheat-menu-cheats-tab"
            className="game-settings-content cheat-menu-content"
            id="cheat-menu-cheats"
            role="tabpanel"
          >
            <section aria-label="Target player" className="cheat-menu-target">
              <label>
                <span>TARGET</span>
                <select
                  aria-label="TARGET"
                  onChange={(event) => {
                    const playerId = event.currentTarget.value
                    setTargetPlayerId(playerId)
                    const player = snapshot.players[playerId]
                    if (player) setGold(String(player.economy.gold))
                  }}
                  value={target ? targetPlayerId : ''}
                >
                  {Object.entries(snapshot.players).map(([playerId, player]) => (
                    <option key={playerId} value={playerId}>{player.config.displayName}</option>
                  ))}
                </select>
              </label>
              {target ? (
                <dl>
                  <div><dt>HP</dt><dd>{round(target.progression.currentHealth)} / {round(target.progression.maximumHealth)}</dd></div>
                  <div><dt>MP</dt><dd>{round(target.progression.currentMana)} / {round(target.progression.maximumMana)}</dd></div>
                  <div><dt>LEVEL / XP</dt><dd>{target.progression.level} / {round(target.progression.experience)}</dd></div>
                  <div><dt>GOLD</dt><dd>{target.economy.gold}</dd></div>
                  <div><dt>STATE</dt><dd>{target.progression.lifeState.toUpperCase()}</dd></div>
                  <div><dt>POSITION</dt><dd>{round(target.position.x)}, {round(target.position.y)}</dd></div>
                </dl>
              ) : null}
            </section>

            <div className="cheat-menu-columns">
              <CheatGroup title="PLAYER">
                <div className="cheat-menu-button-pair">
                  <ActionButton
                    disabled={actionBusy || !target}
                    label="RESTORE HEALTH"
                    onClick={() => target && void runAction('Health restored', {
                      kind: 'restore-health',
                      playerId: targetPlayerId,
                    })}
                  />
                  <ActionButton
                    disabled={actionBusy || !target}
                    label="RESTORE MANA"
                    onClick={() => target && void runAction('Mana restored', {
                      kind: 'restore-mana',
                      playerId: targetPlayerId,
                    })}
                  />
                </div>
                <InlineAction
                  button="SET GOLD"
                  disabled={actionBusy || !target}
                  label="GOLD"
                  maximum={CHEAT_MENU_GOLD_MAX}
                  minimum={0}
                  onChange={setGold}
                  onSubmit={(event) => submit(event, 'Gold set', () => ({
                    gold: integerInput(gold, 'Gold', 0, CHEAT_MENU_GOLD_MAX),
                    kind: 'set-gold',
                    playerId: targetPlayerId,
                  }))}
                  value={gold}
                />
                <InlineAction
                  button="GRANT XP"
                  disabled={actionBusy || !target}
                  label="EXPERIENCE"
                  maximum={CHEAT_MENU_EXPERIENCE_MAX}
                  minimum={0}
                  onChange={setExperience}
                  onSubmit={(event) => submit(event, 'Experience granted', () => ({
                    amount: integerInput(
                      experience,
                      'Experience',
                      0,
                      CHEAT_MENU_EXPERIENCE_MAX,
                    ),
                    kind: 'grant-experience',
                    playerId: targetPlayerId,
                  }))}
                  value={experience}
                />
              </CheatGroup>

              <CheatGroup title="WORLD">
                <InlineAction
                  button="SET NEXT SEED"
                  disabled={actionBusy || !hubSeedAvailable}
                  label="RUN SEED"
                  maximum={CHEAT_MENU_RUN_SEED_MAX}
                  minimum={1}
                  onChange={setRunSeed}
                  onSubmit={(event) => submit(event, 'Next run seed set', () => ({
                    kind: 'set-run-seed',
                    seed: integerInput(runSeed, 'Run seed', 1, CHEAT_MENU_RUN_SEED_MAX),
                  }))}
                  value={runSeed}
                />
                {!hubSeedAvailable ? <small>Run seed is available in the Hub.</small> : null}
                <form
                  className="cheat-menu-catalog-action"
                  onSubmit={(event) => submit(event, 'Enemy spawn queued', () => ({
                    count: integerInput(
                      enemyCount,
                      'Enemy count',
                      1,
                      CHEAT_MENU_SPAWN_COUNT_MAX,
                    ),
                    enemyKey,
                    kind: 'spawn-enemy',
                    playerId: targetPlayerId,
                  }))}
                >
                  <label><span>ENEMY</span><select aria-label="ENEMY" onChange={(event) => setEnemyKey(event.currentTarget.value)} value={enemyKey}>
                    {activeCatalogs.enemies.map((enemy) => (
                      <option key={enemy.key} value={enemy.key}>{displayIdentity(enemy.base)}</option>
                    ))}
                  </select></label>
                  <label className="cheat-menu-small-number"><span>COUNT</span><input
                    aria-label="COUNT"
                    max={CHEAT_MENU_SPAWN_COUNT_MAX}
                    min={1}
                    onChange={(event) => setEnemyCount(event.currentTarget.value)}
                    type="number"
                    value={enemyCount}
                  /></label>
                  <button disabled={actionBusy || !enemySpawnAvailable || !enemyKey} type="submit">SPAWN</button>
                </form>
                {!enemySpawnAvailable ? <small>Enemy spawning requires an active Boneyard.</small> : null}
              </CheatGroup>
            </div>

            {developer ? (
              <CheatGroup title="DEVELOPER GRANTS">
                <div className="cheat-menu-developer-grid">
                  <CatalogGrant
                    button="GRANT ITEM"
                    disabled={actionBusy || !itemKey}
                    label="ITEM"
                    numberLabel="QTY"
                    numberMaximum={100}
                    numberValue={itemQuantity}
                    onNumberChange={setItemQuantity}
                    onSelect={setItemKey}
                    onSubmit={(event) => submit(event, 'Item granted', () => ({
                      itemKey,
                      kind: 'grant-item',
                      playerId: targetPlayerId,
                      quantity: integerInput(itemQuantity, 'Item quantity', 1, 100),
                    }))}
                    options={activeCatalogs.items.map((item) => ({ label: item.name, value: item.key }))}
                    value={itemKey}
                  />
                  <CatalogGrant
                    button="GRANT SKILL"
                    disabled={actionBusy || !skillId}
                    label="SKILL"
                    numberLabel="RANKS"
                    numberMaximum={selectedSkillMaximum(grantableSkills, skillId)}
                    numberValue={skillRanks}
                    onNumberChange={setSkillRanks}
                    onSelect={setSkillId}
                    onSubmit={(event) => submit(event, 'Skill granted', () => ({
                      kind: 'grant-skill',
                      playerId: targetPlayerId,
                      ranks: integerInput(
                        skillRanks,
                        'Skill ranks',
                        1,
                        selectedSkillMaximum(grantableSkills, skillId),
                      ),
                      skillId: integerInput(skillId, 'Skill id', 8, 79),
                    }))}
                    options={grantableSkills.map((skill) => ({
                      label: `${skill.name} · ${displayIdentity(skill.family)}`,
                      value: String(skill.id),
                    }))}
                    value={skillId}
                  />
                  <form className="cheat-menu-catalog-action" onSubmit={(event) => submit(event, 'Weld granted', () => ({
                    buildId: integerInput(weldId, 'Weld build id', 1000, 1009),
                    kind: 'grant-weld',
                    playerId: targetPlayerId,
                  }))}>
                    <label><span>WELD</span><select aria-label="WELD" onChange={(event) => setWeldId(event.currentTarget.value)} value={weldId}>
                      {activeCatalogs.welds.map((weld) => (
                        <option key={weld.id} value={weld.id}>{weld.name}</option>
                      ))}
                    </select></label>
                    <button disabled={actionBusy || !weldId} type="submit">GRANT WELD</button>
                  </form>
                  <form className="cheat-menu-catalog-action" onSubmit={(event) => submit(event, 'Bot summoned', () => ({
                    discipline: botDiscipline,
                    element: botElement,
                    kind: 'summon-bot',
                  }))}>
                    <label><span>BOT DISCIPLINE</span><select aria-label="BOT DISCIPLINE" onChange={(event) => setBotDiscipline(event.currentTarget.value as typeof botDiscipline)} value={botDiscipline}>
                      {CHEAT_MENU_BOT_DISCIPLINES.map((discipline) => (
                        <option key={discipline} value={discipline}>{discipline.toUpperCase()}</option>
                      ))}
                    </select></label>
                    <label><span>ELEMENT</span><select aria-label="ELEMENT" onChange={(event) => setBotElement(event.currentTarget.value as typeof botElement)} value={botElement}>
                      {CHEAT_MENU_BOT_ELEMENTS.map((element) => (
                        <option key={element} value={element}>{element.toUpperCase()}</option>
                      ))}
                    </select></label>
                    <button disabled={actionBusy || !botSummonAvailable} type="submit">SUMMON BOT</button>
                  </form>
                </div>
                {!botSummonAvailable ? <small>Bots require developer access in the shared Hub.</small> : null}
              </CheatGroup>
            ) : null}

            {catalogs === null ? <p className="cheat-menu-receipt" data-tone="working" role="status">Loading semantic catalogs…</p> : null}
            {catalogError ? <p className="cheat-menu-receipt" data-tone="error" role="alert">{catalogError}</p> : null}
            {actionReceipt ? <p className="cheat-menu-receipt" data-tone={actionReceipt.tone} role={actionReceipt.tone === 'error' ? 'alert' : 'status'}>{actionReceipt.message}</p> : null}
          </div>
        ) : (
          <div
            aria-labelledby="cheat-menu-console-tab"
            className="cheat-menu-console"
            id="cheat-menu-console"
            role="tabpanel"
          >
            <div className="cheat-menu-console-editor">
              <label htmlFor="cheat-menu-lua-editor">LUA</label>
              <textarea
                id="cheat-menu-lua-editor"
                maxLength={MAX_LUA_CONSOLE_CODE_LENGTH}
                onChange={(event) => {
                  setConsoleCode(event.currentTarget.value)
                  setHistoryCursor(null)
                }}
                onKeyDown={handleConsoleKey}
                ref={consoleEditorRef}
                spellCheck={false}
                value={consoleCode}
              />
              <footer>
                <span>Ctrl/Cmd+Enter runs · Alt+↑/↓ history · {consoleCode.length.toLocaleString()} / {MAX_LUA_CONSOLE_CODE_LENGTH.toLocaleString()}</span>
                <button disabled={consoleBusy || !consoleCode.trim()} onClick={() => { void executeConsole() }} type="button">
                  {consoleBusy ? 'RUNNING…' : 'RUN LUA'}
                </button>
              </footer>
            </div>
            <section aria-label="Lua console output" className="cheat-menu-console-output">
              <header><strong>OUTPUT</strong><button disabled={consoleEntries.length === 0} onClick={() => setConsoleEntries([])} type="button">CLEAR</button></header>
              {consoleEntries.length === 0 ? (
                <p>Lua print output, return values, and errors appear here.</p>
              ) : [...consoleEntries].reverse().map((entry) => (
                <article data-console-result={entry.error ? 'error' : 'ok'} key={entry.id}>
                  <pre className="cheat-menu-console-source">{entry.code}</pre>
                  {entry.output.map((line, index) => <pre className="cheat-menu-console-print" key={`${entry.id}-print-${index}`}>{line}</pre>)}
                  {entry.returned ? <pre className="cheat-menu-console-return">{entry.returned}</pre> : null}
                  {entry.error ? <pre className="cheat-menu-console-error">{entry.error}</pre> : null}
                </article>
              ))}
            </section>
          </div>
        )}
      </section>
    </div>
  )
}

function CheatGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="game-settings-group cheat-menu-group" aria-label={title}>
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  )
}

function ActionButton({
  disabled,
  label,
  onClick,
}: {
  disabled: boolean
  label: string
  onClick: () => void
}) {
  return <button className="cheat-menu-action" disabled={disabled} onClick={onClick} type="button">{label}</button>
}

function InlineAction({
  button,
  disabled,
  label,
  maximum,
  minimum,
  onChange,
  onSubmit,
  value,
}: {
  button: string
  disabled: boolean
  label: string
  maximum: number
  minimum: number
  onChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  value: string
}) {
  return (
    <form className="cheat-menu-inline-action" onSubmit={onSubmit}>
      <label><span>{label}</span><input aria-label={label} max={maximum} min={minimum} onChange={(event) => onChange(event.currentTarget.value)} type="number" value={value} /></label>
      <button disabled={disabled} type="submit">{button}</button>
    </form>
  )
}

function CatalogGrant({
  button,
  disabled,
  label,
  numberLabel,
  numberMaximum,
  numberValue,
  onNumberChange,
  onSelect,
  onSubmit,
  options,
  value,
}: {
  button: string
  disabled: boolean
  label: string
  numberLabel: string
  numberMaximum: number
  numberValue: string
  onNumberChange: (value: string) => void
  onSelect: (value: string) => void
  onSubmit: (event: FormEvent) => void
  options: readonly Readonly<{ label: string; value: string }>[]
  value: string
}) {
  return (
    <form className="cheat-menu-catalog-action" onSubmit={onSubmit}>
      <label><span>{label}</span><select aria-label={label} onChange={(event) => onSelect(event.currentTarget.value)} value={value}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select></label>
      <label className="cheat-menu-small-number"><span>{numberLabel}</span><input
        aria-label={numberLabel}
        max={numberMaximum}
        min={1}
        onChange={(event) => onNumberChange(event.currentTarget.value)}
        type="number"
        value={numberValue}
      /></label>
      <button disabled={disabled} type="submit">{button}</button>
    </form>
  )
}

function selectedSkillMaximum(
  skills: readonly Readonly<{ id: number; maximumRank: number }>[],
  skillId: string,
): number {
  return skills.find(({ id }) => String(id) === skillId)?.maximumRank ?? 1
}

function integerInput(value: string, label: string, minimum: number, maximum: number): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new RangeError(`${label} must be within ${minimum}..${maximum}.`)
  }
  return parsed
}

function displayIdentity(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The debug command failed.'
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}
