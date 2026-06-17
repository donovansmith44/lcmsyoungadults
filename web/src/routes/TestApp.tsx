import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../firebase'
import { Button } from '../ui/Button'
import { ensureAnonymous } from '../auth/takerAuth'
import { OEJTS_ITEMS } from '../domain/oejts'
import { computeT, startedAtMs } from '../domain/timer'
import { upsertTaker, recordAnswer, setSharing, UsernameTakenError } from '../data/takers'
import { submitTest } from '../data/submit'
import { getActiveSession } from '../data/sessions'
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
  const [beginError, setBeginError] = useState<string | null>(null)
  const { taker, loading: takerLoading } = useTaker(username)
  // The session the taker actually belongs to (may differ from the active one once
  // they've finished and the admin has moved on / ended it).
  const takerSession = useSession(taker?.sessionId ?? null)
  const sessionWasLoaded = useRef(false)
  useEffect(() => { if (takerSession) sessionWasLoaded.current = true }, [takerSession])
  const now = useNow(1000)

  // Only authenticate when we're actually in the taker flow (a name has been entered
  // or restored). Signing in anonymously on a bare page load creates a stray identity
  // that shares the browser's single Firebase Auth and clobbers the admin sign-in.
  useEffect(() => { if (username) ensureAnonymous() }, [username])

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
    setBeginError(null)
    const user = await ensureAnonymous()
    // Authoritatively read the active session AFTER auth (the live subscription can't
    // load before the anonymous sign-in, so we must not rely on its state here). The
    // session captured here is the one the taker joins, and it is immutable thereafter.
    const active = await getActiveSession(db)
    try {
      await upsertTaker(db, name, { ownerUid: user.uid, sessionId: active?.id ?? null })
    } catch (e) {
      if (e instanceof UsernameTakenError) { setBeginError("That name's taken — choose another."); return }
      throw e
    }
    try { localStorage.setItem(STORAGE_KEY, name) } catch { /* ignore */ }
    setUsername(name); setIndex(0); setResumed(true); setTimeoutPrompted(false); setSharedChoiceMade(false); setPhase('test')
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
    await submitTest(db, username, answers)
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

  // Everything time-related is driven by the TAKER'S OWN session (subscribed once their
  // sessionId is known), never a globally-active session — the active-session listener
  // can't even load before anonymous auth, and the taker's reveal must follow the session
  // they actually joined. NOTE: the client must NOT write the frozen-groups flag; freezing
  // is an admin-only sessions write owned by "Reveal now"/"End".
  const takerActive = takerSession?.status === 'active'
  const takerSessionT = takerSession ? computeT(sessionStartMs(takerSession), takerSession.timerMinutes, now) : 0
  const t = takerActive ? takerSessionT : 0 // taker's own remaining minutes (drives the buzzer)

  // When the taker's own time runs out mid-test, prompt the sharing choice once, then continue.
  useEffect(() => {
    if (phase === 'test' && t === 0 && takerActive && taker && !taker.completed && !timeoutPrompted) {
      setTimeoutPrompted(true)
      setPhase('timeout-share')
    }
  }, [phase, t, takerActive, taker, timeoutPrompted])

  const liveSessionName = takerSession?.name ?? null
  const liveMinutesLeft = takerActive ? takerSessionT : null

  const sessionDeleted = !!taker?.sessionId && sessionWasLoaded.current && takerSession == null
  const sessionEnded = !!taker?.completed && !!taker?.sessionId
    && (sessionDeleted || (takerSession != null && takerSession.status !== 'active'))

  // Result reveals the group once the taker's session is frozen, ended, deleted, or its
  // timer has elapsed.
  const resultRevealed = !takerSession || !takerActive || takerSession.groupsFrozenAt != null || takerSessionT === 0
  const resultT = resultRevealed ? 0 : takerSessionT

  // Question-screen reveal banner, off the taker's own session (covers unfinished participants).
  const takerRevealed = !!takerSession && (!takerActive || takerSession.groupsFrozenAt != null || takerSessionT === 0)

  const entries = useSharedList(taker?.sessionId ?? null)

  if (phase === 'landing' || !username) return <Landing onBegin={onBegin} error={beginError} />

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
        {taker.group && takerRevealed && <RevealBanner group={taker.group} />}
        <Question
          index={idx}
          total={OEJTS_ITEMS.length}
          item={OEJTS_ITEMS[idx]}
          value={taker.answers?.[String(OEJTS_ITEMS[idx].id)]}
          onAnswer={onAnswer}
          onBack={() => setIndex(Math.max(0, idx - 1))}
          canBack={idx > 0}
          onExit={goLanding}
          sessionName={liveSessionName}
          minutesLeft={liveMinutesLeft}
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
        sessionEnded={sessionEnded}
        entries={entries}
        onToggleShare={(next) => { if (next) void setSharing(db, username, true) }}
        onStartOver={goLanding}
      />
    )
  }
  return null
}

/** Firestore Timestamp -> ms (shared normalizer; falls back to wall-clock now). */
function sessionStartMs(session: SessionDoc): number {
  return startedAtMs(session.startedAt, Date.now())
}
