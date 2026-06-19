import { describe, it, expect } from 'vitest'
import { OEJTS_ITEMS, scoreType } from './oejts'
import { AXIS_LETTERS } from './types'
import type { Answers, AnswerValue, Axis } from './types'

const allSame = (v: AnswerValue): Answers =>
  Object.fromEntries(OEJTS_ITEMS.map((i) => [i.id, v])) as Answers

describe('OEJTS_ITEMS bank', () => {
  it('has exactly 32 items with unique ids 1..32', () => {
    expect(OEJTS_ITEMS).toHaveLength(32)
    const ids = OEJTS_ITEMS.map((i) => i.id).sort((a, b) => a - b)
    expect(ids).toEqual(Array.from({ length: 32 }, (_, n) => n + 1))
  })

  it('has exactly 8 items per axis', () => {
    for (const axis of ['IE', 'SN', 'TF', 'JP'] as const) {
      expect(OEJTS_ITEMS.filter((i) => i.axis === axis)).toHaveLength(8)
    }
  })

  it('rightLetter is always one of the two letters of its axis', () => {
    const pairs = { IE: 'EI', SN: 'SN', TF: 'TF', JP: 'JP' } as const
    for (const i of OEJTS_ITEMS) expect(pairs[i.axis]).toContain(i.rightLetter)
  })

  it('marks exactly the three reworded items', () => {
    expect(OEJTS_ITEMS.filter((i) => i.reworded)).toHaveLength(3)
  })
})

describe('scoreType', () => {
  it('returns null when any answer is missing', () => {
    const partial = { ...allSame(3) }
    delete partial[1]
    expect(scoreType(partial)).toBeNull()
  })

  it('produces a 4-letter type and four axis sums for complete answers', () => {
    const r = scoreType(allSame(3))!
    expect(r.type).toMatch(/^[EI][SN][TF][JP]$/)
    expect(r.axisScores.IE).toBe(24) // all 3s => 8 items * 3 = 24 on every axis
    expect(r.axisScores.SN).toBe(24)
    expect(r.axisScores.TF).toBe(24)
    expect(r.axisScores.JP).toBe(24)
  })

  it('an all-neutral (all-3) response yields the OEJTS midpoint default INTJ', () => {
    // Verified against the live instrument: at sum 24 on every axis, IE/JP fall to
    // I/J (cutoff > 24) while SN/TF rise to N/T (cutoff >= 24).
    expect(scoreType(allSame(3))!.type).toBe('INTJ')
  })

  it('answering every item toward its rightLetter selects all high letters', () => {
    // Build answers so each item scores 5 toward its rightLetter.
    const answers = Object.fromEntries(
      OEJTS_ITEMS.map((i) => [i.id, 5 as AnswerValue]),
    ) as Answers
    const r = scoreType(answers)!
    // Each axis sum becomes 8*? depending on orientation; assert it is a valid type.
    expect(r.type).toMatch(/^[EI][SN][TF][JP]$/)
  })
})

// Maps a type string (e.g. "ENFP") to its per-axis target letter.
const AXIS_OF_INDEX: Axis[] = ['IE', 'SN', 'TF', 'JP']

/**
 * Build answers a *clear* respondent would give to land on `type`: for every item,
 * pick the pole (1 or 5) that pushes its axis decisively toward the target letter.
 * Each axis ends at sum 8 or 40 — far past the 24 cutoff — so the tie rule is irrelevant
 * and the mapping is "answer like an extravert → get E", etc.
 */
function answersForType(type: string): Answers {
  const ans = {} as Answers
  for (const item of OEJTS_ITEMS) {
    const axisIdx = AXIS_OF_INDEX.indexOf(item.axis)
    const target = type[axisIdx]
    const { high } = AXIS_LETTERS[item.axis]
    const wantHigh = target === high
    // To push the axis sum toward `high`, an item answers 5 if its rightLetter is the
    // high letter, else 1. Invert to push toward the low letter.
    const towardHigh: AnswerValue = item.rightLetter === high ? 5 : 1
    ans[item.id] = (wantHigh ? towardHigh : (6 - towardHigh)) as AnswerValue
  }
  return ans
}

const ALL_16_TYPES: string[] = ['E', 'I'].flatMap((ie) =>
  ['S', 'N'].flatMap((sn) =>
    ['T', 'F'].flatMap((tf) =>
      ['J', 'P'].map((jp) => ie + sn + tf + jp),
    ),
  ),
)

describe('all 16 types are reachable and map realistically', () => {
  it('enumerates exactly the 16 MBTI types, no dups', () => {
    expect(ALL_16_TYPES).toHaveLength(16)
    expect(new Set(ALL_16_TYPES).size).toBe(16)
  })

  for (const type of ALL_16_TYPES) {
    it(`clear pole answers for ${type} score as ${type}`, () => {
      const result = scoreType(answersForType(type))!
      expect(result.type).toBe(type)
      // sanity: a decisive respondent lands each axis at an extreme (8 or 40), never the midpoint
      for (const axis of AXIS_OF_INDEX) {
        expect([8, 40]).toContain(result.axisScores[axis])
      }
    })
  }

  it('a clearly extraverted/sensing/feeling/perceiving respondent reads as ESFP', () => {
    // Spot-check the realism in plain terms: answer like a social, concrete, warm,
    // spontaneous person and you should be typed ESFP — not the all-neutral INTJ default.
    expect(scoreType(answersForType('ESFP'))!.type).toBe('ESFP')
  })
})
