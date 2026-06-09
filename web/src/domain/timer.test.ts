import { describe, it, expect } from 'vitest'
import { computeT, startedAtMs } from './timer'

const MIN = 60_000

describe('startedAtMs', () => {
  it('reads a Firestore Timestamp via toMillis()', () => {
    expect(startedAtMs({ toMillis: () => 1234 }, 9999)).toBe(1234)
  })
  it('passes a plain number through', () => {
    expect(startedAtMs(0, 9999)).toBe(0)
    expect(startedAtMs(5000, 9999)).toBe(5000)
  })
  it('falls back when startedAt is null/undefined', () => {
    expect(startedAtMs(null, 9999)).toBe(9999)
    expect(startedAtMs(undefined, 9999)).toBe(9999)
  })
})

describe('computeT', () => {
  const start = 1_000_000

  it('is N at the instant of session start', () => {
    expect(computeT(start, 30, start)).toBe(30)
  })

  it('counts down whole minutes remaining (ceil)', () => {
    expect(computeT(start, 30, start + 10 * MIN)).toBe(20)
    expect(computeT(start, 30, start + 10.5 * MIN)).toBe(20) // 19.5 -> ceil 20
  })

  it('never goes below 0', () => {
    expect(computeT(start, 30, start + 45 * MIN)).toBe(0)
  })

  it('honors an adjustable N', () => {
    expect(computeT(start, 10, start + 3 * MIN)).toBe(7)
  })
})
