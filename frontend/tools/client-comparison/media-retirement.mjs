// PixiJS owns detached Audio objects. The Rust observer still records their
// loaded state and exact pending Request at a document replacement. This proves
// request retirement only; it does not establish playback or audibility.
export function reviewPixiRetirements(errors, reports) {
  const expected = [], unexpected = []
  for (const error of errors) {
    const evidence = reports.flatMap(report => report.mediaFailures).find(row =>
      error.type === 'requestfailed' && error.requestId === row.failure.requestId
      && error.url === row.failure.url && error.method === 'GET'
      && error.resourceType === 'media' && error.failure?.errorText === 'net::ERR_ABORTED')
    const retired = evidence?.retirement
    const before = retired?.before
    const pending = retired?.pendingRequests.filter(request => request.requestId === error.requestId
      && request.url === error.url && request.method === 'GET' && request.resourceType === 'media')
    const owners = before?.channels.filter(channel => channel.url === error.url && channel.src === error.url)
    const owner = owners?.length === 1 ? owners[0] : null
    if (retired?.kind === 'document-replacement' && retired.completed && retired.pendingRequest
      && retired.beforeTargetId !== retired.afterTargetId && before?.documentId === retired.beforeTargetId
      && pending?.length === 1 && pending[0].before.documentId === before.documentId
      && [200, 206].includes(pending[0].status) && [200, 206].includes(evidence.status)
      && owner && owner.ready >= 2 && owner.network === 1 && owner.error === null
      && !owner.retired && !owner.connected && owner.loads === 1 && owner.preload === 'auto') {
      expected.push({ ...error, reason: 'Loaded detached PixiJS audio request retired with its observed document',
        beforeDocument: retired.beforeTargetId, afterDocument: retired.afterTargetId })
    } else unexpected.push(error)
  }
  return { expected, unexpected }
}
