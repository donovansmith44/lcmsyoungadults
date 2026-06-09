/** Minutes remaining until reveal: T = max(0, ceil(N - minutesSinceStart)). */
export function computeT(startedAtMs: number, timerMinutes: number, nowMs: number): number {
  const elapsedMin = (nowMs - startedAtMs) / 60_000
  return Math.max(0, Math.ceil(timerMinutes - elapsedMin))
}

/**
 * Normalizes a session's `startedAt` to milliseconds. Accepts a Firestore Timestamp
 * (object with `toMillis()`), a plain number, or null/undefined → `fallbackMs`.
 * Shared by the taker and admin countdowns so both compute from one source (lockstep).
 */
export function startedAtMs(startedAt: unknown, fallbackMs: number): number {
  if (startedAt && typeof startedAt === 'object' && 'toMillis' in startedAt
      && typeof (startedAt as { toMillis?: unknown }).toMillis === 'function') {
    return (startedAt as { toMillis: () => number }).toMillis()
  }
  return typeof startedAt === 'number' ? startedAt : fallbackMs
}
