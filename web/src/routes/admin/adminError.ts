type Listener = (msg: string) => void
let listener: Listener | null = null

/** AdminPage subscribes to render a banner. Returns an unsubscribe. */
export function onAdminError(l: Listener): () => void {
  listener = l
  return () => { if (listener === l) listener = null }
}

export function reportAdminError(e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e)
  listener?.(msg)
  console.error('[admin]', e)
}

/** Wrap a fire-and-forget admin write so a failure is surfaced, not swallowed. */
export function runAdmin<T>(p: Promise<T>): Promise<T | void> {
  return p.catch(reportAdminError)
}
