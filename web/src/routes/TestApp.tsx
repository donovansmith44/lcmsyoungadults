import { useEffect, useMemo, useState } from 'react'
import { db } from '../firebase'
import { Button } from '../ui/Button'
import { ensureAnonymous } from '../auth/takerAuth'
import { OEJTS_ITEMS } from '../domain/oejts'
import { computeT } from '../domain/timer'
import { upsertTaker, recordAnswer, setSharing } from '../data/takers'
import { submitTest } from '../data/submit'
import { freezeSessionGroups } from '../data/freeze'
import { useActiveSession } from '../hooks/useActiveSession'
import { useSession } from '../hooks/useSession'
import { useTaker } from '../hooks/useTaker'
import { useSharedList } from '../hooks/useSharedList'
import { useNow } from '../hooks/useNow'
import { Landing } from './Landing'
import { Question } from './Question'
import { SharingPrompt } from './SharingPrompt'
import { Result } from './Result'
import { RevealBanner } from '../ui/RevealBanner'
import type { AnswerValue, Answers } from '../domain/types'
import type { SessionDoc } from '../data/sessions'

const STORAGE_KEY = 'lya.personality.username'
function storedUsername(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

type Phase = 'landing' | 'test' | 'sharing' | 'timeout-share' | 'result'

export function TestApp() {
  const [username, setUsername] = useState<string | null>(() => storedUsername())
  const [phase, setPhase] = useState<Phase>(() => (storedUsername() ? 'test' : 'landing'))
  const [index, setIndex] = useState(0)
  const [resumed, setResumed] = useState(false)
  const [timeoutPrompted, setTimeoutPrompted] = useState(false)
  const [sharedChoiceMade, setSharedChoiceMade] = useState(false)
  const { session } = useActiveSession()
  const { taker, loading: takerLoading } = useTaker(username)
  // The session the taker actually belongs to (may differ from the active one once
  // they've finished and the admin has moved on / ended it).
  const takerSession = useSession(taker?.sessionId ?? null)
  const now = useNow(1000)

  useEffect(() => { ensureAnonymous() }, [])

  const firstUnanswered = useMemo(() => {
    if (!taker) return 0
    const idx = OEJTS_ITEMS.findIndex((i) => taker.answers?.[String(i.id)] === undefined)
    return idx === -1 ? OEJTS_ITEMS.length : idx
  }, [taker])

  // On first taker load (e.g. a refresh resume), jump to the first unanswered item.
  useEffect(() => {
    if (taker && !resumed) {
      setIndex(Math.min(firstUnanswered, OEJTS_ITEMS.length - 1))
      setResumed(true)
    }
  }, [taker, resumed, firstUnanswered])

  const onBegin = async (name: string) => {
    try { localStorage.setItem(STORAGE_KEY, name) } catch { /* ignore */ }
    // Create the doc BEFORE subscribing, so the first snapshot already exists
    // (no "couldn't find your test" flash).
    await upsertTaker(db, name)
    setUsername(name)
    setIndex(0)
    setResumed(true)
    setTimeoutPrompted(false)
    setSharedChoiceMade(false)
    setPhase('test')
  }

  // Abandon the current attempt and return to the username landing.
  const goLanding = () => {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    setUsername(null)
    setIndex(0)
    setResumed(false)
    setTimeoutPrompted(false)
    setSharedChoiceMade(false)
    setPhase('landing')
  }

  // A completed taker (e.g. refresh after finishing) resumes on the result.
  useEffect(() => {
    if (taker?.completed && phase === 'test') setPhase('result')
  }, [taker?.completed, phase])

  const submitAndShow = async (answers: Answers) => {
    if (!username) return
    await submitTest(db, username, answers, session?.id ?? null)
    setPhase('result')
  }

  const onAnswer = async (itemId: number, value: AnswerValue) => {
    if (!username) return
    await recordAnswer(db, username, itemId, value)
    // brief pause so the selection registers visually, then auto-advance
    setTimeout(() => {
      if (index + 1 >= OEJTS_ITEMS.length) {
        if (sharedChoiceMade) {
          // Sharing was already chosen at the buzzer — submit straight to the result.
          const answers = { ...(taker?.answers ?? {}), [itemId]: value } as unknown as Answers
          void submitAndShow(answers)
        } else {
          setPhase('sharing')
        }
      } else {
        setIndex(index + 1)
      }
    }, 180)
  }

  // Completion share prompt (finished all 32 without having been asked at the buzzer).
  const onChooseShare = async (share: boolean) => {
    if (!username || !taker) return
    await setSharing(db, username, share)
    await submitAndShow(taker.answers as unknown as Answers)
  }

  // Buzzer share prompt (timer expired mid-test): record the choice, then keep going.
  const onTimeoutShare = async (share: boolean) => {
    if (username) await setSharing(db, username, share)
    setSharedChoiceMade(true)
    setPhase('test')
  }

  const startMs = session ? sessionStartMs(session) : 0
  const t = session ? computeT(startMs, session.timerMinutes, now) : 0

  // Freeze fallback when the timer hits 0.
  useEffect(() => {
    if (session && !session.groupsFrozenAt && t === 0 && session.status === 'active') {
      freezeSessionGroups(db, session.id).catch(() => {})
    }
  }, [session, t])

  // When time runs out mid-test, prompt the sharing choice once, then continue.
  useEffect(() => {
    if (phase === 'test' && t === 0 && session?.status === 'active' && taker && !taker.completed && !timeoutPrompted) {
      setTimeoutPrompted(true)
      setPhase('timeout-share')
    }
  }, [phase, t, session?.status, taker, timeoutPrompted])

  // Result countdown/reveal is driven by the TAKER'S session, not whatever is active
  // now. It's revealed (T=0 → show the group) once that session is frozen, ended,
  // deleted, or its timer has elapsed.
  const takerSessionT = takerSession ? computeT(sessionStartMs(takerSession), takerSession.timerMinutes, now) : 0
  const resultRevealed = !takerSession
    || takerSession.status !== 'active'
    || takerSession.groupsFrozenAt != null
    || takerSessionT === 0
  const resultT = resultRevealed ? 0 : takerSessionT

  const entries = useSharedList(taker?.sessionId ?? null)

  if (phase === 'landing' || !username) return <Landing onBegin={onBegin} />

  if (phase === 'timeout-share') {
    return <SharingPrompt message="Time's up! Want to share your result with others in this session once it's ready?" onChoose={onTimeoutShare} />
  }

  if (phase === 'test') {
    if (takerLoading) {
      return <div className="screen"><div className="screen-center serif" style={{ opacity: 0.6 }}>Loading…</div></div>
    }
    if (!taker) {
      // Stored username with no taker doc (e.g. stale/cleared data) — offer a fresh start
      // instead of hanging on the loading screen.
      return (
        <div className="screen"><div className="screen-center">
          <p style={{ maxWidth: '26ch' }}>We couldn't find a test in progress for “{username}”.</p>
          <Button onClick={goLanding} style={{ marginTop: '.4rem' }}>Start a new test</Button>
        </div></div>
      )
    }
    const idx = Math.min(index, OEJTS_ITEMS.length - 1)
    return (
      <>
        {taker.group && t === 0 && <RevealBanner group={taker.group} />}
        <Question
          index={idx}
          total={OEJTS_ITEMS.length}
          item={OEJTS_ITEMS[idx]}
          value={taker.answers?.[String(OEJTS_ITEMS[idx].id)]}
          onAnswer={onAnswer}
          onBack={() => setIndex(Math.max(0, idx - 1))}
          canBack={idx > 0}
          onExit={goLanding}
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
        t={resultT}
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
