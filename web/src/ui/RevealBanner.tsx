import type { Group } from '../domain/types'

const LABEL: Record<Group, string> = { scavenger: 'Scavenger Hunt', games: 'Games' }

/** Persistent top banner shown to a mid-test taker once their group is set. */
export function RevealBanner({ group }: { group: Group }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--teal)', color: 'var(--cream)', padding: '.6rem .8rem', textAlign: 'center', fontWeight: 600, fontSize: '.85rem' }}>
      ⏱ Time's up — you're in the <span style={{ color: 'var(--pink)' }}>{LABEL[group]}</span> group. Finish your test for your full result.
    </div>
  )
}
