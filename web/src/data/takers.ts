import {
  Firestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction,
} from 'firebase/firestore'
import type { AnswerValue, AxisScores, Group } from '../domain/types'

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export class UsernameTakenError extends Error {
  readonly username: string
  constructor(username: string) {
    super(`The name "${username}" is already taken`)
    this.name = 'UsernameTakenError'
    this.username = username
  }
}

export interface BeginTakerArgs { ownerUid: string; sessionId: string | null }

export interface TakerDoc {
  username: string
  ownerUid: string
  answers: Record<string, AnswerValue>
  completed: boolean
  type: string | null
  axisScores: AxisScores | null
  seRank: number | null
  seStrength: number | null
  sharing: boolean
  sessionId: string | null
  group: Group | null
  groupOverride: boolean
}

const takerRef = (db: Firestore, username: string) =>
  doc(db, 'takers', normalizeUsername(username))

/** Claims a username for this browser. Resumes if already owned; throws if owned elsewhere. */
export async function upsertTaker(db: Firestore, username: string, args: BeginTakerArgs): Promise<void> {
  const ref = takerRef(db, username)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    if (snap.data().ownerUid !== args.ownerUid) throw new UsernameTakenError(username)
    return // same browser re-claiming -> resume; joined session stays immutable
  }
  await setDoc(ref, {
    username: username.trim(),
    ownerUid: args.ownerUid,
    answers: {},
    completed: false,
    type: null,
    axisScores: null,
    seRank: null,
    seStrength: null,
    sharing: false,
    sessionId: args.sessionId,
    group: null,
    groupOverride: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } satisfies Record<string, unknown>)
}

export async function recordAnswer(
  db: Firestore, username: string, itemId: number, value: AnswerValue,
): Promise<void> {
  await updateDoc(takerRef(db, username), {
    [`answers.${itemId}`]: value,
    updatedAt: serverTimestamp(),
  })
}

export interface CompletePayload {
  type: string
  axisScores: AxisScores
  seRank: number
  seStrength: number
}

export async function completeTaker(
  db: Firestore, username: string, p: CompletePayload,
): Promise<void> {
  await updateDoc(takerRef(db, username), {
    completed: true,
    type: p.type,
    axisScores: p.axisScores,
    seRank: p.seRank,
    seStrength: p.seStrength,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export class SharingLockedError extends Error {
  constructor() {
    super("Can't stop sharing once it's on")
    this.name = 'SharingLockedError'
  }
}

export async function setSharing(db: Firestore, username: string, sharing: boolean): Promise<void> {
  if (sharing === false) {
    const snap = await getDoc(takerRef(db, username))
    if (snap.exists() && snap.data().sharing === true) throw new SharingLockedError()
  }
  await updateDoc(takerRef(db, username), { sharing, updatedAt: serverTimestamp() })
}

export async function getTaker(db: Firestore, username: string): Promise<TakerDoc | null> {
  const snap = await getDoc(takerRef(db, username))
  return snap.exists() ? (snap.data() as TakerDoc) : null
}

/** Binds a session-less taker to a session. No-op if already bound (sessions never hop). */
export async function joinSession(db: Firestore, username: string, sessionId: string): Promise<void> {
  const ref = takerRef(db, username)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists() || snap.data().sessionId != null) return
    tx.update(ref, { sessionId, updatedAt: serverTimestamp() })
  })
}
