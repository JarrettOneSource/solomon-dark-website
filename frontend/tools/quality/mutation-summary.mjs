export function summarizeMutations(files) {
  const counts = {}
  const equivalents = []
  let unresolved = false
  for (const [file, report] of Object.entries(files)) {
    for (const mutant of report.mutants) {
      counts[mutant.status] = (counts[mutant.status] ?? 0) + 1
      if (['Killed', 'Timeout', 'CompileError'].includes(mutant.status)) continue
      if (mutant.status === 'Ignored' && /^Equivalent: \S/.test(mutant.statusReason ?? '')) {
        equivalents.push({
          file, location: mutant.location, mutator: mutant.mutatorName, reason: mutant.statusReason,
        })
      } else {
        unresolved = true
      }
    }
  }
  const tested = (counts.Killed ?? 0) + (counts.Timeout ?? 0)
  return { counts, equivalents, passed: tested > 0 && !unresolved }
}
