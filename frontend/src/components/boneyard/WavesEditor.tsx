// The wave ledger: author the survival schedule that publishes beside the
// plot as a data/wave.txt overlay. Edits stay local until "Keep the
// schedule" commits them to the doc as one undo step.

import { useMemo, useRef, useState } from 'react'
import type { WaveDef, WaveGroup } from '../../editor/waves'
import {
  WAVE_ENEMIES,
  WAVE_FLAGS,
  defaultWave,
  parseWaveText,
  serializeWaveText,
  validateWaves,
} from '../../editor/waves'

interface Props {
  waves: WaveDef[]
  onKeep: (waves: WaveDef[]) => void
  onClose: () => void
}

/** Short badge text for a flag token: FLAG_SHIELDSTRONG -> SHIELDSTRONG. */
function flagBadge(flag: string): string {
  return flag.replace(/^FLAG_/, '')
}

function FlagPicker({
  flags,
  onChange,
}: {
  flags: string[]
  onChange: (flags: string[]) => void
}) {
  const available = WAVE_FLAGS.filter((f) => !flags.includes(f))
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      {flags.map((flag) => (
        <button
          key={flag}
          type="button"
          title={`Remove ${flag}`}
          onClick={() => onChange(flags.filter((f) => f !== flag))}
          className="rounded border border-gold/25 bg-gold/10 px-1.5 py-0.5 font-mono text-[10px] text-gold hover:border-blood hover:text-blood"
        >
          {flagBadge(flag)} ✕
        </button>
      ))}
      <select
        className="input !w-auto !px-1.5 !py-0.5 font-mono !text-[10px]"
        value=""
        title="Add a modifier flag"
        onChange={(e) => {
          if (e.target.value) onChange([...flags, e.target.value])
        }}
      >
        <option value="">+ flag</option>
        {available.map((flag) => (
          <option key={flag} value={flag}>
            {flagBadge(flag)}
          </option>
        ))}
      </select>
    </div>
  )
}

function RangeFields({
  label,
  value,
  onChange,
}: {
  label: string
  value: [number, number]
  onChange: (value: [number, number]) => void
}) {
  const num = (raw: string, fallback: number) => {
    const v = Number(raw)
    return Number.isFinite(v) ? Math.max(0, Math.round(v)) : fallback
  }
  return (
    <label className="flex items-center gap-1.5">
      <span className="w-24 shrink-0 font-mono text-[10px] uppercase text-bone-dim/70">{label}</span>
      <input
        type="number"
        className="input !w-20 !px-2 !py-1 font-mono !text-xs"
        value={value[0]}
        min={0}
        onChange={(e) => onChange([num(e.target.value, value[0]), value[1]])}
      />
      <span className="text-bone-dim/50">–</span>
      <input
        type="number"
        className="input !w-20 !px-2 !py-1 font-mono !text-xs"
        value={value[1]}
        min={0}
        onChange={(e) => onChange([value[0], num(e.target.value, value[1])])}
      />
    </label>
  )
}

export default function WavesEditor({ waves: initial, onKeep, onClose }: Props) {
  const [waves, setWaves] = useState<WaveDef[]>(() => structuredClone(initial))
  const [showText, setShowText] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const problems = useMemo(() => validateWaves(waves), [waves])
  const preview = useMemo(() => (waves.length > 0 ? serializeWaveText(waves) : ''), [waves])

  const patchWave = (index: number, patch: Partial<WaveDef>) => {
    setWaves((all) => all.map((w, i) => (i === index ? { ...w, ...patch } : w)))
  }
  const patchGroup = (waveIndex: number, groupIndex: number, group: WaveGroup) => {
    setWaves((all) =>
      all.map((w, i) =>
        i === waveIndex
          ? { ...w, groups: w.groups.map((g, gi) => (gi === groupIndex ? group : g)) }
          : w,
      ),
    )
  }

  const importFile = async (file: File) => {
    try {
      const parsed = parseWaveText(await file.text())
      setWaves(parsed)
      setNotice(`Imported ${parsed.length} wave${parsed.length === 1 ? '' : 's'} from ${file.name}.`)
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'That file is not a wave schedule.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="panel panel-ornate flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden"
        role="dialog"
        aria-label="Edit the wave schedule"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gold/15 px-5 py-4">
          <div>
            <div className="kicker">The night's arithmetic</div>
            <h2 className="h-display mt-0.5 text-lg">Wave schedule</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-stone !px-2.5 !py-1.5 !text-[10px]"
              onClick={() => fileRef.current?.click()}
              title="Import an existing wave.txt"
            >
              Import wave.txt
            </button>
            <button
              type="button"
              className="btn btn-stone !px-2.5 !py-1.5 !text-[10px]"
              onClick={() => setShowText((v) => !v)}
              disabled={waves.length === 0}
            >
              {showText ? 'Hide file' : 'Preview file'}
            </button>
            <button type="button" className="text-bone-dim hover:text-blood" aria-label="Close" onClick={onClose}>
              ✕
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importFile(f)
              e.target.value = ''
            }}
          />
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {notice && <p className="text-fell text-xs text-gold/90">{notice}</p>}
          {waves.length === 0 && (
            <p className="text-fell text-xs leading-relaxed text-bone-dim/70">
              No schedule of your own yet: the plot plays the game's stock waves. Add a wave to
              take over the whole night — a custom schedule replaces data/wave.txt for everyone
              in the session, waves are numbered from 0, and NEXT decides what may come after
              each one.
            </p>
          )}

          {waves.map((wave, wi) => (
            <section key={wi} className="rounded border border-gold/15 bg-abyss/40 p-3">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="h-display text-sm">Wave {wi}</h3>
                <label className="ml-2 flex items-center gap-1.5 text-[11px] text-bone-dim">
                  <input
                    type="checkbox"
                    checked={wave.zombieWave ?? false}
                    onChange={(e) => patchWave(wi, { zombieWave: e.target.checked || undefined })}
                  />
                  Zombie wave
                </label>
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    className="btn btn-stone !px-2 !py-1 !text-[10px]"
                    title="Duplicate this wave"
                    onClick={() => setWaves((all) => [...all.slice(0, wi + 1), structuredClone(wave), ...all.slice(wi + 1)])}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="btn btn-stone !px-2 !py-1 !text-[10px] hover:!text-blood"
                    title="Remove this wave"
                    onClick={() => setWaves((all) => all.filter((_, i) => i !== wi))}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 lg:grid-cols-2">
                <label className="flex items-center gap-1.5">
                  <span className="w-24 shrink-0 font-mono text-[10px] uppercase text-bone-dim/70">Spawn</span>
                  <input
                    type="number"
                    className="input !w-20 !px-2 !py-1 font-mono !text-xs"
                    value={wave.spawn}
                    min={1}
                    title="Exact number of enemies the wave spawns"
                    onChange={(e) => patchWave(wi, { spawn: Math.round(Number(e.target.value)) || 0 })}
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="w-24 shrink-0 font-mono text-[10px] uppercase text-bone-dim/70">Max enemies</span>
                  <input
                    type="number"
                    className="input !w-20 !px-2 !py-1 font-mono !text-xs"
                    value={wave.maxEnemies}
                    min={1}
                    title="Population gate before the wave may advance"
                    onChange={(e) => patchWave(wi, { maxEnemies: Math.round(Number(e.target.value)) || 0 })}
                  />
                </label>
                <RangeFields
                  label="Spawn delay"
                  value={wave.spawnDelay}
                  onChange={(spawnDelay) => patchWave(wi, { spawnDelay })}
                />
                <RangeFields
                  label="Wave delay"
                  value={wave.waveDelay}
                  onChange={(waveDelay) => patchWave(wi, { waveDelay })}
                />
                <label className="flex items-center gap-1.5 lg:col-span-2">
                  <span className="w-24 shrink-0 font-mono text-[10px] uppercase text-bone-dim/70">Next waves</span>
                  <input
                    className="input !px-2 !py-1 font-mono !text-xs"
                    value={wave.next.join(',')}
                    placeholder="e.g. 1 or 2,3"
                    title="Comma-separated wave numbers that may follow this one (waves count from 0)"
                    onChange={(e) =>
                      patchWave(wi, {
                        next: e.target.value
                          .split(',')
                          .map((part) => part.trim())
                          .filter((part) => /^\d+$/.test(part))
                          .map(Number),
                      })
                    }
                  />
                </label>
              </div>

              <div className="mt-2.5 space-y-2">
                {wave.groups.map((group, gi) => (
                  <div key={gi} className="rounded border border-gold/10 bg-black/20 p-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-bone-dim/70">
                        Group {gi + 1}
                      </span>
                      <button
                        type="button"
                        className="font-mono text-[10px] uppercase text-bone-dim/70 hover:text-blood"
                        onClick={() => patchWave(wi, { groups: wave.groups.filter((_, i) => i !== gi) })}
                      >
                        remove group
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {group.entries.map((entry, ei) => (
                        <div key={ei} className="flex items-start gap-2">
                          <select
                            className="input !w-40 shrink-0 !px-2 !py-1 font-mono !text-xs"
                            value={entry.enemy}
                            onChange={(e) =>
                              patchGroup(wi, gi, {
                                entries: group.entries.map((en, i) =>
                                  i === ei ? { ...en, enemy: e.target.value } : en,
                                ),
                              })
                            }
                          >
                            {WAVE_ENEMIES.map((enemy) => (
                              <option key={enemy.token} value={enemy.token}>
                                {enemy.label}
                              </option>
                            ))}
                          </select>
                          <FlagPicker
                            flags={entry.flags}
                            onChange={(flags) =>
                              patchGroup(wi, gi, {
                                entries: group.entries.map((en, i) => (i === ei ? { ...en, flags } : en)),
                              })
                            }
                          />
                          <button
                            type="button"
                            className="mt-0.5 shrink-0 font-mono text-[10px] uppercase text-bone-dim/70 hover:text-blood"
                            title="Remove this enemy line"
                            onClick={() =>
                              patchGroup(wi, gi, { entries: group.entries.filter((_, i) => i !== ei) })
                            }
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="font-mono text-[10px] uppercase text-gold/80 hover:text-gold-bright"
                        onClick={() =>
                          patchGroup(wi, gi, {
                            entries: [...group.entries, { enemy: 'SKELETON', flags: [] }],
                          })
                        }
                      >
                        + enemy
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="font-mono text-[10px] uppercase text-gold/80 hover:text-gold-bright"
                  onClick={() =>
                    patchWave(wi, {
                      groups: [...wave.groups, { entries: [{ enemy: 'SKELETON', flags: [] }] }],
                    })
                  }
                >
                  + group
                </button>
              </div>
            </section>
          ))}

          <button
            type="button"
            className="btn btn-stone !px-3 !py-1.5 !text-[11px]"
            onClick={() => setWaves((all) => [...all, defaultWave(all.length, all.length)])}
          >
            + Add wave
          </button>

          {showText && waves.length > 0 && (
            <pre className="max-h-56 overflow-auto rounded border border-gold/10 bg-black/40 p-3 font-mono text-[11px] leading-snug text-bone-dim">
              {preview}
            </pre>
          )}

          {problems.length > 0 && (
            <div className="rounded border border-blood/40 bg-blood/10 p-3">
              {problems.map((problem, i) => (
                <p key={i} className="text-xs text-blood">
                  {problem}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gold/15 px-5 py-4">
          <p className="text-fell text-[11px] text-bone-dim/70">
            {waves.length === 0
              ? 'Keeping an empty schedule publishes the plot with the stock waves.'
              : `${waves.length} wave${waves.length === 1 ? '' : 's'} will publish as a data/wave.txt overlay.`}
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-stone" onClick={onClose}>
              Discard changes
            </button>
            <button
              type="button"
              className="btn btn-gold"
              disabled={problems.length > 0}
              title={problems.length > 0 ? 'Settle the ledger problems first.' : undefined}
              onClick={() => onKeep(waves)}
            >
              Keep the schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
