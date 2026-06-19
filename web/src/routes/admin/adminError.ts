export type NoticeLevel = 'error' | 'success'
type Listener = (msg: string, level: NoticeLevel) => void
let listener: Listener | null = null

/** AdminPage subscribes to render a banner. Returns an unsubscribe. */
export function onAdminNotice(l: Listener): () => void {
  listener = l
  return () => { if (listener === l) listener = null }
}

export function reportAdminError(e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e)
  listener?.(msg, 'error')
  console.error('[admin]', e)
}

export function reportAdminSuccess(msg: string): void {
  listener?.(msg, 'success')
}

/**
 * Wrap a fire-and-forget admin write so a failure is surfaced (not swallowed) AND a
 * success is confirmed. `success` may be a static string or a builder from the result,
 * so callers can report a count (e.g. how many participants were grouped).
 */
export function runAdmin<T>(p: Promise<T>, success?: string | ((result: T) => string)): Promise<T | void> {
  return p
    .then((result) => {
      if (success) reportAdminSuccess(typeof success === 'function' ? success(result) : success)
      return result
    })
    .catch(reportAdminError)
}
