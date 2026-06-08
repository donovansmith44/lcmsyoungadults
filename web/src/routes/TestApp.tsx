import { useEffect, useMemo, useState } from 'react'
import { db } from '../firebase'
import { ensureAnonymous } from '../auth/takerAuth'
import { OEJTS_ITEMS } from '../domain/oejts'
import { computeT } from '../domain/timer'
import { upsertTaker, recordAnswer, setSharing } from '../data/takers'
import { submitTest } from '../data/submit'
import { freezeSessionGroups } from '../data/freeze'
import { useActiveSession } from '../hooks/useActiveSession'
import { useTaker } from '../hooks/useTaker'
import { useSharedList } from '../hooks/useSharedList'
import { useNow } from '../hooks/useNow'
import { Landing } from './Landing'
import { Question } from './Question'
import { SharingPrompt } from './SharingPrompt'
import { Result } from './Result'
import { RevealBanner } from '../ui/RevealBanner'
import type { AnswerValue } from '../domain/types'
import type { SessionDoc } from '../data/sessions'

export function TestApp() {
  const [username, setUsername] = useState<string | null>(null)
  const [phase, setPhase] = useState<'landing' | 'test' | 'sharing' | 'result'>('landing')
  const { session } = useActiveSession()
  const taker = useTaker(username)
  const now = useNow(1000)

  useEffect(() => { ensureAnonymous() }, [])

  const firstUnanswered = useMemo(() => {
    if (!taker) return 0
    const idx = OEJTS_ITEMS.findIndex((i) => taker.answers?.[i.id] === undefined)
    return idx === -1 ? OEJTS_ITEMS.length : idx
  }, [taker])

  const onBegin = async (name: string) => {
    setUsername(name)
    await upsertTaker(db, name)
    setPhase('test')
  }

  // Resume completed takers straight to the result.
  useEffect(() => {
    if (taker?.completed && phase === 'test') setPhase('result')
  }, [taker?.completed, phase])

  const onAnswer = async (itemId: number, value: AnswerValue) => {
    if (!username) return
    await recordAnswer(db, username, itemId, value)
    if (firstUnanswered + 1 >= OEJTS_ITEMS.length) setPhase('sharing')
  }

  const onChooseShare = async (share: boolean) => {
    if (!username || !taker) return
    await setSharing(db, username, share)
    await submitTest(db, username, taker.answers as unknown as import('../domain/types').Answers, session?.id ?? null)
    setPhase('result')
  }

  // T countdown + freeze fallback
  const startMs = session ? sessionStartMs(session) : 0
  const t = session ? computeT(startMs, session.timerMinutes, now) : 0
  useEffect(() => {
    if (session && !session.groupsFrozenAt && t === 0 && session.status === 'active') {
      freezeSessionGroups(db, session.id).catch(() => {})
    }
  }, [session, t])

  const entries = useSharedList(taker?.sessionId ?? null)

  if (phase === 'landing' || !username) return <Landing onBegin={onBegin} />

  if (phase === 'test' && taker) {
    const idx = Math.min(firstUnanswered, OEJTS_ITEMS.length - 1)
    return (
      <>
        {taker.group && t === 0 && <RevealBanner group={taker.group} />}
        <Question
          index={idx}
          total={OEJTS_ITEMS.length}
          item={OEJTS_ITEMS[idx]}
          value={taker.answers?.[String(OEJTS_ITEMS[idx].id)]}
          onAnswer={onAnswer}
        />
      </>
    )
  }

  if (phase === 'sharing') return <SharingPrompt onChoose={onChooseShare} />

  if (phase === 'result' && taker) {
    return (
      <Result
        username={taker.username}
        type={taker.type ?? ''}
        t={t}
        group={taker.group}
        sharing={taker.sharing}
        entries={entries}
        onToggleShare={(next) => setSharing(db, username, next)}
      />
    )
  }
  return null
}

/** Firestore Timestamp -> ms. */
function sessionStartMs(session: SessionDoc): number {
  const s = session.startedAt as unknown as { toMillis?: () => number } | number | null
  if (s && typeof s === 'object' && 'toMillis' in s && s.toMillis) return s.toMillis()
  return typeof s === 'number' ? s : Date.now()
}
