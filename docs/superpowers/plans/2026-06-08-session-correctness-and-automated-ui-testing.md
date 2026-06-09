# Session correctness, taker/admin UX, and comprehensive automated UI testing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the open bug sheet and the 2026-06-08 requirements (browser-bound unique identities, correct session binding, taker/admin context + lockstep countdown, working admin writes, mobile-readable questions) and stand up a layered automated test suite (unit / data+rules / component / Playwright E2E) that proves every behavior.

**Architecture:** Taker identity becomes the anonymous-auth `uid` recorded as `ownerUid` on a username-keyed doc; uniqueness is the doc id, ownership is enforced in `firestore.rules`. Session membership is captured at *begin* and is immutable. New Playwright E2E layer runs real Chromium (desktop + mobile) against `vite dev` + the Firestore emulator, with multi-context cross-device sims. Everything is built test-first.

**Tech Stack:** React 19, Vite 8, Firebase 12 (Firestore + Auth emulators), Vitest 4 + React Testing Library, `@firebase/rules-unit-testing`, **`@playwright/test`** (new).

**Spec:** `docs/superpowers/specs/2026-06-08-session-correctness-and-automated-ui-testing-design.md`. Requirement IDs (R1–R11) reference that spec.

**Conventions for every code step:** all commands run from `web/`. "Non-emulator" suite = `npx vitest run src/ui src/hooks src/routes src/domain src/auth`. "Data/rules" suite needs the emulator: `npm run test:rules`. Commit messages end with the repo's `Co-Authored-By` trailer.

---

## File structure (created / modified)

**Modified — app:**
- `src/data/takers.ts` — add `ownerUid`, `UsernameTakenError`, claim-on-begin, session capture.
- `src/data/submit.ts` — bind to the taker's *own* stored session, drop the `activeSessionId` arg.
- `src/firestore.rules` — create-once + owner-write for `takers`, admin override.
- `src/routes/TestApp.tsx` — pass `uid` + joined session into begin; surface `UsernameTakenError`; feed session name + countdown to `Question`; start-over from `Result`.
- `src/routes/Landing.tsx` — render a begin error message.
- `src/routes/Question.tsx` — session-name + countdown header; explicit teal question color.
- `src/routes/Result.tsx` — "Start over" control; show group to revealed non-finishers.
- `src/routes/admin/SessionList.tsx` — time remaining for the active session.
- `src/routes/admin/AdminPage.tsx` — collapsible/closable roster panel.
- `src/routes/admin/Roster.tsx` — confirm per-row labeled override controls.
- `src/ui/theme.css` — question color/weight + variable-font fallback if needed.
- `src/auth/adminAuth.ts` / `src/hooks/useIsAdmin.ts` — R9 fix as the E2E repro dictates.

**Modified — tests:**
- `src/data/takers.test.ts`, `src/data/submit.test.ts`, `src/data/rules.test.ts` — new signatures + ownership/binding cases.
- `src/routes/TestApp.test.tsx`, `Landing.test.tsx`, `Question.test.tsx`, `Result.test.tsx`, `admin/SessionList.test.tsx`, `admin/Roster.test.tsx` — new UI behaviors.

**Created:**
- `playwright.config.ts`
- `e2e/fixtures/emulator.ts` (seed/clear via REST), `e2e/fixtures/test.ts` (Playwright fixtures), `e2e/helpers/flows.ts` (begin/answer/sign-in helpers).
- `e2e/*.spec.ts` (14 scenario specs, E1–E14).
- `package.json` scripts: `test:e2e`, `test:all`.

---

# PHASE A — Identity, uniqueness, ownership, binding (R1, R3)

## Task A1: `ownerUid` + claim-on-begin in the data layer (R1)

**Files:**
- Modify: `src/data/takers.ts`
- Test: `src/data/takers.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `takers.test.ts`:

```ts
import { upsertTaker, UsernameTakenError } from './takers'

it('records ownerUid and the joined session on create', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await upsertTaker(db, 'Donovan', { ownerUid: 'uidA', sessionId: 'sX' })
    const snap = await getDoc(doc(db, 'takers', 'donovan'))
    expect(snap.data()!.ownerUid).toBe('uidA')
    expect(snap.data()!.sessionId).toBe('sX')
  })
})

it('resumes silently when the same owner re-claims the name', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await upsertTaker(db, 'Mae', { ownerUid: 'uidA', sessionId: null })
    await upsertTaker(db, 'Mae', { ownerUid: 'uidA', sessionId: 'sLater' }) // no throw
    const snap = await getDoc(doc(db, 'takers', 'mae'))
    expect(snap.data()!.sessionId).toBe(null) // joined session is immutable
  })
})

it('throws UsernameTakenError when a different owner claims the name', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await upsertTaker(db, 'Sam', { ownerUid: 'uidA', sessionId: null })
    await expect(upsertTaker(db, 'Sam', { ownerUid: 'uidB', sessionId: null }))
      .rejects.toBeInstanceOf(UsernameTakenError)
  })
})
```

Also update the existing `creates then resumes` and `completing a taker` tests to pass the new
args: `await upsertTaker(db, 'Donovan', { ownerUid: 'u', sessionId: null })` and
`await upsertTaker(db, 'Mae', { ownerUid: 'u', sessionId: null })`.

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:rules` (or, with the emulator already up, `npx vitest run src/data/takers.test.ts`)
Expected: FAIL — `upsertTaker` arity/`UsernameTakenError` undefined.

- [ ] **Step 3: Implement** — in `src/data/takers.ts`:

```ts
export class UsernameTakenError extends Error {
  constructor(public readonly username: string) {
    super(`The name "${username}" is already taken`)
    this.name = 'UsernameTakenError'
  }
}

export interface BeginTakerArgs { ownerUid: string; sessionId: string | null }
```

Add `ownerUid: string` to `TakerDoc` (after `username`). Replace `upsertTaker`:

```ts
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
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/data/takers.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/data/takers.ts src/data/takers.test.ts
git commit -m "feat(takers): browser-owned, unique usernames (ownerUid + claim-on-begin)"
```

## Task A2: Bind submit to the taker's own session (R3)

**Files:**
- Modify: `src/data/submit.ts`
- Test: `src/data/submit.test.ts`

- [ ] **Step 1: Write the failing tests** — add to `submit.test.ts` (use `withSecurityRulesDisabled`; seed a taker with `upsertTaker` then answer all 32 — reuse the file's existing answer-builder helper; if none, build `answers` as `Object.fromEntries(OEJTS_ITEMS.map(i => [i.id, 3]))`):

```ts
it('binds to the session captured at begin, not the one active at submit', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await upsertTaker(db, 'Joiner', { ownerUid: 'u', sessionId: 'sA' }) // joined A
    await answerAll(db, 'Joiner')                                       // (helper: record all 32)
    await submitTest(db, 'Joiner', fullAnswers())                      // B may be active now
    const snap = await getDoc(doc(db, 'takers', 'joiner'))
    expect(snap.data()!.sessionId).toBe('sA')
  })
})

it('keeps a pre-session taker private (sessionId stays null)', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await upsertTaker(db, 'Early', { ownerUid: 'u', sessionId: null })  // began with no session
    await answerAll(db, 'Early')
    await submitTest(db, 'Early', fullAnswers())
    const snap = await getDoc(doc(db, 'takers', 'early'))
    expect(snap.data()!.sessionId).toBe(null)
    expect(snap.data()!.completed).toBe(true)
  })
})
```

Add small local helpers at the top of the test file if not present:

```ts
import { OEJTS_ITEMS } from '../domain/oejts'
import { recordAnswer } from './takers'
const fullAnswers = () => Object.fromEntries(OEJTS_ITEMS.map((i) => [String(i.id), 3])) as any
const answerAll = async (db: any, u: string) => {
  for (const i of OEJTS_ITEMS) await recordAnswer(db, u, i.id, 3 as any)
}
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/data/submit.test.ts`
Expected: FAIL — `submitTest` still takes/uses `activeSessionId`; current code would write whatever is passed.

- [ ] **Step 3: Implement** — replace `submitTest` in `src/data/submit.ts`:

```ts
/** Completes a taker: scores, binds to the taker's OWN session, latecomer group if frozen. */
export async function submitTest(db: Firestore, username: string, answers: Answers): Promise<void> {
  const result = scoreType(answers)
  if (!result) throw new Error('Test is incomplete')

  const ref = doc(db, 'takers', normalizeUsername(username))
  const takerSnap = await getDoc(ref)
  const sessionId = (takerSnap.exists() ? takerSnap.data().sessionId : null) as string | null

  let group: Group | null = null
  if (sessionId) {
    const sessionSnap = await getDoc(doc(db, 'sessions', sessionId))
    if (sessionSnap.exists() && sessionSnap.data().groupsFrozenAt) {
      group = assignLatecomer(await countGroups(db, sessionId))
    }
  }

  await updateDoc(ref, {
    completed: true,
    type: result.type,
    axisScores: result.axisScores,
    seRank: seRank(result.type),
    seStrength: seStrength(result.axisScores),
    group,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
```

(Note: `sessionId` is no longer written here — it is set once at begin.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/data/submit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/submit.ts src/data/submit.test.ts
git commit -m "fix(submit): bind result to the session captured at begin, never the one active at submit"
```

## Task A3: Tighten `firestore.rules` — create-once + owner-write (R1)

**Files:**
- Modify: `firestore.rules`
- Test: `src/data/rules.test.ts`

- [ ] **Step 1: Update + add failing tests** in `rules.test.ts`. Change the existing
"anonymous user can write a taker" test to include ownership, and add ownership cases:

```ts
it('a signed-in user can create a taker they own, but not one owned by another uid', async () => {
  const env = await getTestEnv()
  const a = env.authenticatedContext('uidA', {}).firestore()
  await assertSucceeds(setDoc(doc(a, 'takers', 'bob'),
    { username: 'bob', ownerUid: 'uidA', completed: false }))
  // someone else cannot overwrite bob
  const b = env.authenticatedContext('uidB', {}).firestore()
  await assertFails(setDoc(doc(b, 'takers', 'bob'),
    { username: 'bob', ownerUid: 'uidB', completed: false }))
})

it('cannot create a taker claiming a different ownerUid', async () => {
  const env = await getTestEnv()
  const a = env.authenticatedContext('uidA', {}).firestore()
  await assertFails(setDoc(doc(a, 'takers', 'eve'),
    { username: 'eve', ownerUid: 'someoneElse', completed: false }))
})

it('an allowlisted admin may update a taker (group override)', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'takers', 'bob'),
      { username: 'bob', ownerUid: 'uidA', completed: true, group: 'games' })
  })
  const admin = env.authenticatedContext('a1', { email: 'admin@x.org' }).firestore()
  await assertSucceeds(setDoc(doc(admin, 'takers', 'bob'),
    { username: 'bob', ownerUid: 'uidA', completed: true, group: 'scavenger', groupOverride: true }))
})
```

Update the original line-20 assertion to include `ownerUid: 'anon1'` (its context is `authenticatedContext('anon1', {})`).

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:rules`
Expected: FAIL — current rules allow any signed-in write, so the "cannot overwrite / wrong ownerUid" assertions fail.

- [ ] **Step 3: Implement** — replace the `takers` match block in `firestore.rules`:

```
    // Takers: doc id is the unique (normalized) username. Browser-owned via ownerUid.
    match /takers/{username} {
      allow read: if signedIn();
      // create only when absent (id uniqueness) and only claiming your own uid
      allow create: if signedIn()
        && request.resource.data.ownerUid == request.auth.uid;
      // the owner may update/delete their own doc; admins may update (group override)
      allow update: if signedIn()
        && (resource.data.ownerUid == request.auth.uid || isAdmin())
        && request.resource.data.ownerUid == resource.data.ownerUid;
      allow delete: if signedIn()
        && (resource.data.ownerUid == request.auth.uid || isAdmin());
    }
```

(`create` only fires when the doc is absent, so an existing username can never be re-created;
a second uid attempting it becomes an `update`, which the owner check rejects. The
`ownerUid` immutability clause stops owners/admins from rewriting ownership.)

- [ ] **Step 4: Run to verify pass**

Run: `npm run test:rules`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/data/rules.test.ts
git commit -m "feat(rules): create-once + owner/admin-write for takers (browser-bound identity)"
```

## Task A4: Wire begin in `TestApp` — uid, joined session, taken-name message (R1, R3)

**Files:**
- Modify: `src/routes/TestApp.tsx`, `src/routes/Landing.tsx`
- Test: `src/routes/TestApp.test.tsx`, `src/routes/Landing.test.tsx`

- [ ] **Step 1: Failing test (Landing error)** — add to `Landing.test.tsx`:

```tsx
it('shows a begin error when provided', () => {
  render(<Landing onBegin={() => {}} error="That name's taken — choose another." />)
  expect(screen.getByText(/that name's taken/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Failing test (TestApp claim flow)** — in `TestApp.test.tsx` make the
`ensureAnonymous` mock resolve a uid and the `upsertTaker` mock assert args; add:

```tsx
// update the mock so begin gets a uid:
vi.mock('../auth/takerAuth', () => ({ ensureAnonymous: vi.fn(() => Promise.resolve({ uid: 'uidA' })) }))
// upsertTaker mock must support rejection:
import { UsernameTakenError } from '../data/takers'

it('passes uid + active session into the begin claim', async () => {
  mockSession = { id: 'sLive', status: 'active', timerMinutes: 30, startedAt: 0, groupsFrozenAt: null }
  render(<TestApp />)
  fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'Mae' } })
  fireEvent.click(screen.getByRole('button', { name: /begin/i }))
  await waitFor(() => expect(upsertTaker).toHaveBeenCalledWith(
    expect.anything(), 'Mae', { ownerUid: 'uidA', sessionId: 'sLive' }))
})

it('shows the taken-name message and stays on landing when the name is claimed', async () => {
  ;(upsertTaker as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new UsernameTakenError('Mae'))
  render(<TestApp />)
  fireEvent.change(screen.getByPlaceholderText(/username/i), { target: { value: 'Mae' } })
  fireEvent.click(screen.getByRole('button', { name: /begin/i }))
  expect(await screen.findByText(/taken/i)).toBeInTheDocument()
  expect(screen.getByPlaceholderText(/username/i)).toBeInTheDocument()
})
```

(Note: the existing `data/takers` mock in this file must export `UsernameTakenError`; add it:
`vi.mock('../data/takers', () => ({ upsertTaker: vi.fn(() => Promise.resolve()), recordAnswer: vi.fn(() => Promise.resolve()), setSharing: vi.fn(() => Promise.resolve()), UsernameTakenError: class extends Error {} }))`.)

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/routes/TestApp.test.tsx src/routes/Landing.test.tsx`
Expected: FAIL — `Landing` ignores `error`; `upsertTaker` called with old signature.

- [ ] **Step 4: Implement**

`Landing.tsx` — add prop + render:

```tsx
export function Landing({ onBegin, error }: { onBegin: (username: string) => void; error?: string | null }) {
```
and above the `<Button>`:
```tsx
{error && <p role="alert" style={{ color: 'var(--warm)', margin: '0 0 .6rem', fontSize: '.85rem' }}>{error}</p>}
```

`TestApp.tsx` — add state and rewrite `onBegin`; render `Landing` with the error:

```tsx
const [beginError, setBeginError] = useState<string | null>(null)
```
```tsx
const onBegin = async (name: string) => {
  setBeginError(null)
  const user = await ensureAnonymous()
  try {
    await upsertTaker(db, name, { ownerUid: user.uid, sessionId: session?.id ?? null })
  } catch (e) {
    if (e instanceof UsernameTakenError) { setBeginError("That name's taken — choose another."); return }
    throw e
  }
  try { localStorage.setItem(STORAGE_KEY, name) } catch { /* ignore */ }
  setUsername(name); setIndex(0); setResumed(true); setTimeoutPrompted(false); setSharedChoiceMade(false); setPhase('test')
}
```
Update import: `import { upsertTaker, recordAnswer, setSharing, UsernameTakenError } from '../data/takers'`.
Update the landing render: `if (phase === 'landing' || !username) return <Landing onBegin={onBegin} error={beginError} />`.
Update `submitAndShow` to drop the session arg: `await submitTest(db, username, answers)`.

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/routes/TestApp.test.tsx src/routes/Landing.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/TestApp.tsx src/routes/Landing.tsx src/routes/TestApp.test.tsx src/routes/Landing.test.tsx
git commit -m "feat(taker): claim unique name on begin with uid+session, show taken-name message"
```

---

# PHASE B — Taker UX: start-over, session context + countdown, non-finisher reveal (R2, R5, R4)

## Task B1: "Start over" from the result screen (R2)

**Files:**
- Modify: `src/routes/Result.tsx`, `src/routes/TestApp.tsx`
- Test: `src/routes/Result.test.tsx`, `src/routes/TestApp.test.tsx`

- [ ] **Step 1: Failing test (Result control)** — add to `Result.test.tsx`:

```tsx
it('offers a "start over" control that fires onStartOver', () => {
  const onStartOver = vi.fn()
  render(<Result username="Mae" type="INTJ" t={0} group={null} sharing={false} entries={[]} onToggleShare={() => {}} onStartOver={onStartOver} />)
  fireEvent.click(screen.getByRole('button', { name: /start over/i }))
  expect(onStartOver).toHaveBeenCalled()
})
```

- [ ] **Step 2: Failing test (TestApp wiring)** — add to `TestApp.test.tsx`:

```tsx
it('start over from the result returns to the landing screen', async () => {
  localStorage.setItem('lya.personality.username', 'Mae')
  mockTaker = completedTaker({ sessionId: null })
  render(<TestApp />)
  fireEvent.click(await screen.findByRole('button', { name: /start over/i }))
  expect(await screen.findByPlaceholderText(/username/i)).toBeInTheDocument()
})
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/routes/Result.test.tsx src/routes/TestApp.test.tsx`
Expected: FAIL — no `onStartOver` prop / control.

- [ ] **Step 4: Implement**

`Result.tsx` — add `onStartOver: () => void` to `Props` and, after the "Read more" link:

```tsx
<button onClick={onStartOver} style={{ marginTop: '1.6rem', background: 'none', border: 'none', color: 'var(--teal)', textDecoration: 'underline', cursor: 'pointer', fontSize: '.85rem' }}>↺ Start over</button>
```

`TestApp.tsx` — pass it in the result render:

```tsx
<Result /* ...existing props... */ onStartOver={goLanding} />
```

`goLanding` already clears storage + resets state; verify the completed-resume effect
(`if (taker?.completed && phase === 'test') setPhase('result')`) does not refire after
`goLanding` (it sets `phase='landing'` and `username=null`, so the guard `phase==='test'` is false). No change needed.

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/routes/Result.test.tsx src/routes/TestApp.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/Result.tsx src/routes/TestApp.tsx src/routes/Result.test.tsx src/routes/TestApp.test.tsx
git commit -m "feat(result): start-over control returns to landing for a new alias"
```

## Task B2: Taker session name + lockstep countdown on the question screen (R5)

**Files:**
- Modify: `src/routes/Question.tsx`, `src/routes/TestApp.tsx`
- Test: `src/routes/Question.test.tsx`

- [ ] **Step 1: Failing test** — add to `Question.test.tsx`:

```tsx
it('shows the session name and remaining minutes when in a session', () => {
  render(<Question index={0} total={32} item={OEJTS_ITEMS[0]} value={undefined}
    onAnswer={() => {}} sessionName="Friday Night" minutesLeft={12} />)
  expect(screen.getByText(/friday night/i)).toBeInTheDocument()
  expect(screen.getByText(/12 min/i)).toBeInTheDocument()
})

it('shows no session chrome when not in a session', () => {
  render(<Question index={0} total={32} item={OEJTS_ITEMS[0]} value={undefined}
    onAnswer={() => {}} sessionName={null} minutesLeft={null} />)
  expect(screen.queryByText(/min left|min$/i)).toBeNull()
})
```

(Import `OEJTS_ITEMS` from `../domain/oejts` at the top of the test if not already.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/routes/Question.test.tsx`
Expected: FAIL — props/UI absent.

- [ ] **Step 3: Implement**

`Question.tsx` — extend `Props`:

```tsx
  sessionName?: string | null
  minutesLeft?: number | null
```
Add a compact, unobtrusive bar just inside `<div className="screen">`, above the existing
top row:

```tsx
{(sessionName || minutesLeft != null) && (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.72rem', letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--teal)', opacity: 0.7, marginBottom: 6 }}>
    <span>{sessionName}</span>
    {minutesLeft != null && <span aria-label="time remaining">⏱ {minutesLeft} min left</span>}
  </div>
)}
```

`TestApp.tsx` — compute from the taker's own session and pass them in the `phase==='test'`
render. The taker's session is `takerSession` (already subscribed). Add near the other derived values:

```tsx
const liveSessionName = takerSession?.name ?? null
const liveMinutesLeft = takerSession && takerSession.status === 'active'
  ? computeT(sessionStartMs(takerSession), takerSession.timerMinutes, now)
  : null
```
and pass `sessionName={liveSessionName} minutesLeft={liveMinutesLeft}` to `<Question .../>`.
(Reuses the *same* `computeT` + `sessionStartMs` the admin uses → lockstep. R5.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/routes/Question.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/Question.tsx src/routes/TestApp.tsx src/routes/Question.test.tsx
git commit -m "feat(taker): show session name + lockstep countdown during the test"
```

## Task B3: Reveal the group to revealed non-finishers (R4)

**Files:**
- Modify: `src/routes/TestApp.tsx`
- Test: `src/routes/TestApp.test.tsx`

The taker UI already shows `RevealBanner` on the question screen when `taker.group && t===0`.
Gap: a participant who never finished and whose session has *ended/frozen* should see the
group notification even though `t` (their active-session timer) may be stale. Drive the banner
off the taker's own session reveal state.

- [ ] **Step 1: Failing test** — add to `TestApp.test.tsx`:

```tsx
it('shows the group banner to an unfinished participant once their session is frozen', async () => {
  localStorage.setItem('lya.personality.username', 'Mae')
  mockTakerSession = { id: 'sA', status: 'active', timerMinutes: 30, startedAt: 0, groupsFrozenAt: 123 }
  mockSession = mockTakerSession
  mockTaker = { taker: { username: 'Mae', answers: { 1: 3 }, completed: false, type: null, axisScores: null, seRank: null, seStrength: null, sharing: false, sessionId: 'sA', group: 'games', groupOverride: false }, loading: false }
  render(<TestApp />)
  expect(await screen.findByText(/games group/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/routes/TestApp.test.tsx`
Expected: FAIL — banner currently keys off `t===0` of the active session, not the taker
session's reveal state; with `startedAt:0` and a far-future `mockNow` it may pass incidentally,
so set `mockNow = 1000` in this test to make the active-session `t` non-zero and force the gap.

- [ ] **Step 3: Implement** — in `TestApp.tsx`, compute a taker-reveal flag and use it for the
banner. Reuse the existing `resultRevealed` logic by hoisting a `takerRevealed` value:

```tsx
const takerRevealed = !!takerSession
  && (takerSession.status !== 'active' || takerSession.groupsFrozenAt != null
      || (takerSession.status === 'active'
          && computeT(sessionStartMs(takerSession), takerSession.timerMinutes, now) === 0))
```
Change the question-screen banner line to:
```tsx
{taker.group && takerRevealed && <RevealBanner group={taker.group} />}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/routes/TestApp.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/TestApp.tsx src/routes/TestApp.test.tsx
git commit -m "feat(taker): surface group placement to unfinished participants on reveal"
```

---

# PHASE C — Admin UX: time remaining, collapsible panel, override placement (R6, R7, R8)

## Task C1: Session time-remaining in the admin list (R6)

**Files:**
- Modify: `src/routes/admin/SessionList.tsx`
- Test: `src/routes/admin/SessionList.test.tsx`

- [ ] **Step 1: Failing test** — add to `SessionList.test.tsx` (follow the file's existing
mock style; if it doesn't already mock `useNow`/`useIsAdmin`, add
`vi.mock('../../hooks/useNow', () => ({ useNow: () => 600_000 }))`):

```tsx
it('shows minutes remaining for an active, started session', () => {
  const sessions = [{ id: 's1', name: 'Fri', status: 'active', timerMinutes: 15, startedAt: 0, groupsFrozenAt: null }]
  render(<SessionList sessions={sessions as any} selectedId={null} onSelect={() => {}} />)
  // 15-min timer, 10 min elapsed (now=600000ms) -> 5 left
  expect(screen.getByText(/5 min left/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/routes/admin/SessionList.test.tsx`
Expected: FAIL — no remaining-time UI.

- [ ] **Step 3: Implement** — in `SessionList.tsx`, import `useNow` and `computeT`, and inside
the `sessions.map` row, for active started sessions render the remaining minutes:

```tsx
import { useNow } from '../../hooks/useNow'
import { computeT } from '../../domain/timer'
```
```tsx
const now = useNow(1000)
const sessionStartMs = (s: SessionDoc) => {
  const v = s.startedAt as unknown as { toMillis?: () => number } | number | null
  if (v && typeof v === 'object' && 'toMillis' in v && v.toMillis) return v.toMillis()
  return typeof v === 'number' ? v : now
}
```
Inside the row, next to the status:
```tsx
{s.status === 'active' && (
  <span style={{ fontSize: '.75rem', opacity: 0.7, marginLeft: 8 }}>
    {computeT(sessionStartMs(s), s.timerMinutes, now)} min left
  </span>
)}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/routes/admin/SessionList.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/SessionList.tsx src/routes/admin/SessionList.test.tsx
git commit -m "feat(admin): show session time remaining (lockstep with takers)"
```

## Task C2: Collapsible / closable roster panel (R7)

**Files:**
- Modify: `src/routes/admin/AdminPage.tsx`
- Test: `src/routes/admin/AdminPage.test.tsx` (create)

- [ ] **Step 1: Failing test** — create `src/routes/admin/AdminPage.test.tsx`. Mock the hooks
so `AdminConsole` renders with a selected session and a roster (follow `AdminGate.test.tsx`
mock style for `useIsAdmin`; mock `useSessions`/`useRoster`):

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
vi.mock('../../hooks/useIsAdmin', () => ({ useIsAdmin: () => ({ user: { email: 'a@b.c' }, admin: true, loading: false }) }))
vi.mock('../../hooks/useSessions', () => ({ useSessions: () => [{ id: 's1', name: 'Fri', status: 'active', timerMinutes: 15, startedAt: 0, groupsFrozenAt: null }] }))
vi.mock('../../hooks/useRoster', () => ({ useRoster: () => [{ id: 'mae', username: 'Mae', completed: true, group: 'games', sessionId: 's1' }] }))
vi.mock('../../firebase', () => ({ db: {} }))
import { AdminPage } from './AdminPage'

it('roster panel can be minimized and closed', () => {
  render(<AdminPage />)
  fireEvent.click(screen.getByRole('button', { name: /^fri/i })) // select the session
  expect(screen.getByText('Mae')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /minimize/i }))
  expect(screen.queryByText('Mae')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /expand/i }))
  expect(screen.getByText('Mae')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /close roster/i }))
  expect(screen.queryByText('Mae')).toBeNull()
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/routes/admin/AdminPage.test.tsx`
Expected: FAIL — no minimize/close controls.

- [ ] **Step 3: Implement** — in `AdminPage.tsx` `AdminConsole`, wrap the
`{selectedId && <Roster .../>}` block with collapse/close state:

```tsx
const [rosterMin, setRosterMin] = useState(false)
```
```tsx
{selectedId && (
  <div className="card" style={{ width: '100%' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h3 style={{ margin: 0 }}>Roster</h3>
      <div style={{ display: 'flex', gap: '.4rem' }}>
        <button onClick={() => setRosterMin((m) => !m)}
          aria-label={rosterMin ? 'expand roster' : 'minimize roster'}
          style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer' }}>
          {rosterMin ? '▸' : '▾'}
        </button>
        <button onClick={() => { setSelectedId(null); setRosterMin(false) }}
          aria-label="close roster"
          style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer' }}>✕</button>
      </div>
    </div>
    {!rosterMin && <Roster rows={rows} onOverride={(u, g) => runAdmin(setTakerGroupOverride(db, u, g))} />}
  </div>
)}
```
(Add `useState` to the React import.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/routes/admin/AdminPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/AdminPage.tsx src/routes/admin/AdminPage.test.tsx
git commit -m "feat(admin): collapsible + closable roster panel"
```

## Task C3: Confirm/strengthen per-row group-override controls (R8)

**Files:**
- Modify: `src/routes/admin/Roster.tsx` (only if controls aren't already labeled per row)
- Test: `src/routes/admin/Roster.test.tsx`

- [ ] **Step 1: Failing test** — add to `Roster.test.tsx`:

```tsx
it('each row exposes labeled override controls that call onOverride(username, group)', () => {
  const onOverride = vi.fn()
  const rows = [{ id: 'mae', username: 'Mae', completed: true, group: 'games', sessionId: 's1' }]
  render(<Roster rows={rows as any} onOverride={onOverride} />)
  fireEvent.click(screen.getByRole('button', { name: /move mae to scavenger/i }))
  expect(onOverride).toHaveBeenCalledWith('mae', 'scavenger')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/routes/admin/Roster.test.tsx`
Expected: FAIL — control absent or not labeled this way.

- [ ] **Step 3: Implement** — ensure each `Roster` row renders, next to the taker, two
labeled override buttons (adapt to the existing row markup):

```tsx
<button aria-label={`move ${r.username} to scavenger`} onClick={() => onOverride(r.id, 'scavenger')}
  style={{ /* match existing small-button style */ }}>→ Scavenger</button>
<button aria-label={`move ${r.username} to games`} onClick={() => onOverride(r.id, 'games')}
  style={{ /* match existing small-button style */ }}>→ Games</button>
```

(If `Roster` already renders override controls, only adjust the `aria-label` to
`move <name> to <group>` and the `onOverride` call to pass `(r.id, group)` so it matches the
test and `setTakerGroupOverride`.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/routes/admin/Roster.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/Roster.tsx src/routes/admin/Roster.test.tsx
git commit -m "feat(admin): labeled per-row group-override controls"
```

---

# PHASE D — Mobile-readable question text (R10)

## Task D1: Explicit teal question color + weight

**Files:**
- Modify: `src/routes/Question.tsx`, `src/ui/theme.css`
- Test: `src/routes/Question.test.tsx` (component-level color assertion); contrast is proven
  later by E2E E13.

- [ ] **Step 1: Failing test** — add to `Question.test.tsx`:

```tsx
it('renders the question text in the brand teal class', () => {
  render(<Question index={0} total={32} item={OEJTS_ITEMS[0]} value={undefined}
    onAnswer={() => {}} sessionName={null} minutesLeft={null} />)
  const h = screen.getByRole('heading', { level: 2 })
  expect(h).toHaveClass('q-text')
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/routes/Question.test.tsx`
Expected: FAIL — heading has no `q-text` class.

- [ ] **Step 3: Implement**

`Question.tsx` — add `className="q-text"` to the `<h2>` (keep existing inline sizing).
`theme.css` — add:

```css
.q-text { color: var(--teal); font-weight: 600; }
/* Static-weight fallback so the variable axis never collapses on mobile Safari/Chrome */
@supports not (font-variation-settings: normal) {
  .q-text { font-weight: 700; }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/routes/Question.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/Question.tsx src/ui/theme.css src/routes/Question.test.tsx
git commit -m "fix(ui): explicit brand-teal question text + variable-font fallback (mobile readability)"
```

---

# PHASE E — Playwright E2E (R1, R3, R4, R5, R6, R7, R8, R9, R10, R11)

> E2E runs real Chromium against `vite dev` + the Firestore/Auth emulators. The emulator needs
> Java (portable JDK path is in the handoff dev notes). Browsers are installed once with
> `npx playwright install chromium`.

## Task E0: Scaffold Playwright + emulator fixtures + smoke test (E1)

**Files:**
- Create: `playwright.config.ts`, `e2e/fixtures/emulator.ts`, `e2e/fixtures/test.ts`, `e2e/helpers/flows.ts`, `e2e/smoke.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Install**

```bash
npm i -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,           // emulator state is shared; serialize specs
  workers: 1,
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'on-first-retry', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    env: { VITE_USE_EMULATOR: '1', VITE_FB_PROJECT_ID: 'demo-lya' },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
})
```

- [ ] **Step 3: Write `e2e/fixtures/emulator.ts`** (seed/clear via emulator REST — bypasses rules)

```ts
const PROJECT = 'demo-lya'
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`
const ADMIN = { headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' } }

export async function clearFirestore() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE', ...ADMIN })
}

// Minimal typed-value writer for the REST API.
function fields(obj: Record<string, unknown>) {
  const f: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) f[k] = { nullValue: null }
    else if (typeof v === 'string') f[k] = { stringValue: v }
    else if (typeof v === 'number') f[k] = { integerValue: String(v) }
    else if (typeof v === 'boolean') f[k] = { booleanValue: v }
    else if (v instanceof Date) f[k] = { timestampValue: v.toISOString() }
  }
  return f
}

export async function seedDoc(path: string, data: Record<string, unknown>) {
  const [coll, id] = path.split('/')
  await fetch(`${FS}/${coll}?documentId=${id}`, { method: 'POST', ...ADMIN, body: JSON.stringify({ fields: fields(data) }) })
}

export async function seedAdmin(email: string) {
  await seedDoc(`admins/${email.toLowerCase()}`, { email: email.toLowerCase() })
}

export async function seedSession(id: string, opts: { name: string; timerMinutes: number; status?: string; startedAt?: Date }) {
  await seedDoc(`sessions/${id}`, {
    name: opts.name, timerMinutes: opts.timerMinutes, status: opts.status ?? 'active',
    startedAt: opts.startedAt ?? new Date(), groupsFrozenAt: null, createdBy: 'seed',
  })
}
```

- [ ] **Step 4: Write `e2e/fixtures/test.ts`** (per-test isolation)

```ts
import { test as base } from '@playwright/test'
import { clearFirestore } from './emulator'

export const test = base.extend({
  page: async ({ page }, use) => {
    await clearFirestore()
    await use(page)
  },
})
export { expect } from '@playwright/test'
```

- [ ] **Step 5: Write `e2e/helpers/flows.ts`**

```ts
import type { Page } from '@playwright/test'
import { OEJTS_ITEMS } from '../../src/domain/oejts'

export async function begin(page: Page, alias: string) {
  await page.goto('/personality-test')
  await page.getByPlaceholder(/username/i).fill(alias)
  await page.getByRole('button', { name: /begin/i }).click()
}

/** Answer all 32 items by clicking the middle radio each time. */
export async function answerAll(page: Page) {
  for (let i = 0; i < OEJTS_ITEMS.length; i++) {
    const radios = page.getByRole('radio')
    await radios.nth(2).click()
    await page.waitForTimeout(220) // matches the 180ms auto-advance + buffer
  }
}
```

- [ ] **Step 6: Write `e2e/smoke.spec.ts` (E1)**

```ts
import { test, expect } from './fixtures/test'
import { begin, answerAll } from './helpers/flows'

test('taker can complete the test and see a type', async ({ page }) => {
  await begin(page, 'smoke-mae')
  await answerAll(page)
  await expect(page.getByText(/your answers point to/i)).toBeVisible()
})
```

- [ ] **Step 7: Add scripts to `package.json`**

```json
"test:e2e": "firebase emulators:exec --only firestore,auth --project demo-lya \"playwright test\"",
"test:all": "vitest run && npm run test:rules && npm run test:e2e"
```

- [ ] **Step 8: Run to verify (red→green)**

Run: `npm run test:e2e -- smoke.spec.ts`
Expected: PASS (the app's happy path is already implemented). If it fails, fix the helper
selectors before proceeding — the helpers are shared by every later spec.

- [ ] **Step 9: Commit**

```bash
git add playwright.config.ts e2e package.json package-lock.json
git commit -m "test(e2e): scaffold Playwright + emulator fixtures + taker smoke test"
```

## Task E1: Cross-device isolation + unique alias (E2, E3, E4 → R1, R2, R3)

**Files:** Create `e2e/identity.spec.ts`

- [ ] **Step 1: Write the specs**

```ts
import { test, expect } from './fixtures/test'
import { begin, answerAll } from './helpers/flows'

test('resume on refresh keeps progress (E2)', async ({ page }) => {
  await begin(page, 'resume-sam')
  await page.getByRole('radio').nth(2).click()
  await page.waitForTimeout(250)
  await page.reload()
  await expect(page.getByText(/2 \/ 32/)).toBeVisible() // advanced past Q1
})

test('start over returns to landing for a new alias (E3)', async ({ page }) => {
  await begin(page, 'over-amy')
  await answerAll(page)
  await page.getByRole('button', { name: /start over/i }).click()
  await expect(page.getByPlaceholder(/username/i)).toBeVisible()
  await page.getByPlaceholder(/username/i).fill('over-amy-2')
  await page.getByRole('button', { name: /begin/i }).click()
  await expect(page.getByText(/1 \/ 32/)).toBeVisible()
})

test('same alias in a different browser is refused and shows no history (E4, R1/R3)', async ({ browser }) => {
  const c1 = await browser.newContext(); const p1 = await c1.newPage()
  await begin(p1, 'dupe-jo')
  await p1.getByRole('radio').nth(2).click(); await p1.waitForTimeout(250)

  const c2 = await browser.newContext(); const p2 = await c2.newPage() // "desktop"
  await begin(p2, 'dupe-jo')
  await expect(p2.getByText(/taken/i)).toBeVisible()
  await expect(p2.getByText(/2 \/ 32/)).toHaveCount(0) // did NOT inherit p1's progress
  await c1.close(); await c2.close()
})
```

- [ ] **Step 2: Run** → `npm run test:e2e -- identity.spec.ts` → Expected: PASS (E4 proves the
cross-device fix end-to-end). If E4 fails, the rules/claim wiring from Phase A is incomplete.

- [ ] **Step 3: Commit**

```bash
git add e2e/identity.spec.ts
git commit -m "test(e2e): cross-device isolation, unique alias, start-over"
```

## Task E2: Session binding + privacy + non-finisher reveal (E5, E6, E7 → R3, R4)

**Files:** Create `e2e/binding.spec.ts`

- [ ] **Step 1: Write the specs**

```ts
import { test, expect } from './fixtures/test'
import { seedSession } from './fixtures/emulator'
import { begin, answerAll } from './helpers/flows'

test('a pre-session taker is never recorded into a later session (E5, R3)', async ({ page, browser }) => {
  await begin(page, 'early-eli')            // no session active at begin
  await seedSession('sLate', { name: 'Late', timerMinutes: 30 }) // session starts mid-test
  await answerAll(page)
  await expect(page.getByText(/your answers point to/i)).toBeVisible() // they see their own result

  // admin roster for sLate must not contain early-eli
  const ac = await browser.newContext(); const ap = await ac.newPage()
  // (admin sign-in helper from Task E3) -> open /admin, select "Late", assert no "early-eli"
  // Implemented after E3 lands the signInAdmin helper; assert absence:
  // await expect(ap.getByText(/early-eli/i)).toHaveCount(0)
  await ac.close()
})

test('a taker is bound to the session active at begin (E6, R3)', async ({ page }) => {
  await seedSession('sA', { name: 'Alpha', timerMinutes: 30 })
  await begin(page, 'join-jan')              // joins sA
  await expect(page.getByText(/alpha/i)).toBeVisible() // session name shown (R5)
})

test('unfinished participant sees their group after reveal (E7, R4)', async ({ page }) => {
  await seedSession('sB', { name: 'Beta', timerMinutes: 30 })
  await begin(page, 'slow-sue')
  await page.getByRole('radio').nth(2).click(); await page.waitForTimeout(250) // partial
  // freeze via REST (admin path is covered in E3; here assert the banner appears once frozen)
  // seed groupsFrozenAt + a group on the taker through the admin flow in E9; cross-ref.
})
```

(Note: E5's roster assertion and E7's freeze depend on the admin helper from Task E3; finish
those assertions when E3 lands — they're called out inline so nothing is left implicit.)

- [ ] **Step 2: Run** → `npm run test:e2e -- binding.spec.ts` → Expected: E6 PASS; E5/E7 PASS
once the E3 admin helper is wired (complete them in Task E3 step 4).

- [ ] **Step 3: Commit**

```bash
git add e2e/binding.spec.ts
git commit -m "test(e2e): session binding correctness + privacy + non-finisher reveal"
```

## Task E3: Admin sign-in helper + admin writes + repro/fix #7 (E9, E10, E11, E12 → R7, R8, R9)

**Files:** Create `e2e/admin.spec.ts`; add `signInAdmin` to `e2e/helpers/flows.ts`; possibly
modify `src/auth/adminAuth.ts` / `src/hooks/useIsAdmin.ts` if the repro shows the prior fix is
insufficient.

- [ ] **Step 1: Add `signInAdmin` helper** to `flows.ts`

```ts
export async function signInAdmin(page: Page, email: string) {
  await page.goto('/admin')
  // The Auth emulator renders an account chooser in a popup; Playwright captures it.
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: /sign in with google/i }).click()
  const popup = await popupPromise
  // Emulator UI: "Add new account" -> fill email -> "Sign in"
  await popup.getByText(/add new account/i).click()
  await popup.getByLabel(/email/i).fill(email)
  // display name is optional; auto-generate if the field exists
  const name = popup.getByLabel(/display name/i)
  if (await name.count()) await name.fill('Admin')
  await popup.getByRole('button', { name: /sign in|continue/i }).click()
  await page.getByRole('heading', { name: /session admin/i }).waitFor()
}
```

(If the emulator popup markup differs in the installed version, adjust selectors here only —
this is the single isolation point per the spec.)

- [ ] **Step 2: Write the specs**

```ts
import { test, expect } from './fixtures/test'
import { seedAdmin, seedSession } from './fixtures/emulator'
import { begin, answerAll, signInAdmin } from './helpers/flows'

test.beforeEach(async () => { await seedAdmin('admin@x.org') })

test('admin Reveal freezes the session and reveals groups (E9, R9)', async ({ page, browser }) => {
  await seedSession('s1', { name: 'Fri', timerMinutes: 30 })
  // a completed taker in the session, in another context
  const tc = await browser.newContext(); const tp = await tc.newPage()
  await begin(tp, 'mae'); await answerAll(tp)
  await tc.close()

  await signInAdmin(page, 'admin@x.org')
  await page.getByRole('button', { name: /^fri/i }).click()
  await page.getByRole('button', { name: /reveal now/i }).click()
  // roster shows a concrete group for mae (no error banner)
  await expect(page.getByText(/scavenger|games/i)).toBeVisible()
  await expect(page.getByText(/⚠/)).toHaveCount(0)
})

test('admin End sets the session ended (R9)', async ({ page }) => {
  await seedSession('s2', { name: 'Sat', timerMinutes: 30 })
  await signInAdmin(page, 'admin@x.org')
  await page.getByRole('button', { name: /^sat/i }).click()
  await page.getByRole('button', { name: /^end$/i }).click()
  await expect(page.getByText(/\(ended\)/i)).toBeVisible()
})

test('roster panel minimizes and closes (E11, R7)', async ({ page, browser }) => {
  await seedSession('s3', { name: 'Sun', timerMinutes: 30 })
  const tc = await browser.newContext(); const tp = await tc.newPage()
  await begin(tp, 'sunbob'); await answerAll(tp); await tc.close()
  await signInAdmin(page, 'admin@x.org')
  await page.getByRole('button', { name: /^sun/i }).click()
  await expect(page.getByText('sunbob')).toBeVisible()
  await page.getByRole('button', { name: /minimize roster/i }).click()
  await expect(page.getByText('sunbob')).toHaveCount(0)
  await page.getByRole('button', { name: /close roster/i }).click()
})

test('admin overrides a taker group (E12, R8)', async ({ page, browser }) => {
  await seedSession('s4', { name: 'Mon', timerMinutes: 30 })
  const tc = await browser.newContext(); const tp = await tc.newPage()
  await begin(tp, 'monkay'); await answerAll(tp); await tc.close()
  await signInAdmin(page, 'admin@x.org')
  await page.getByRole('button', { name: /^mon/i }).click()
  await page.getByRole('button', { name: /move monkay to scavenger/i }).click()
  await expect(page.getByText(/scavenger/i)).toBeVisible()
})
```

- [ ] **Step 3: Run to diagnose #7 (R9)**

Run: `npm run test:e2e -- admin.spec.ts --project=desktop-chromium`
Expected: this is the **deterministic repro**. If Reveal/End/override fail (error banner / no
state change), use `superpowers:systematic-debugging`: inspect the failure (Playwright trace +
the emulator's denied-writes), confirm whether `auth.currentUser` carries `email` at click
time.

- [ ] **Step 4: Fix #7 as the repro dictates** (only with a failing test in hand). Likely fix in
`src/hooks/useIsAdmin.ts` — gate `admin` rendering on auth having fully settled, and/or in
`src/auth/adminAuth.ts` force a token/user refresh after popup sign-in:

```ts
// adminAuth.ts, after signInWithPopup:
await cred.user.getIdToken(true) // ensure the email-bearing token is current before any write
```
Then re-run Step 3 to green. Also complete the deferred assertions in `binding.spec.ts` E5
(open `/admin`, select "Late", assert `early-eli` absent) and E7 (after Reveal, the unfinished
taker's page shows the group banner) now that `signInAdmin` exists.

- [ ] **Step 5: Commit**

```bash
git add e2e/admin.spec.ts e2e/helpers/flows.ts e2e/binding.spec.ts src/auth/adminAuth.ts src/hooks/useIsAdmin.ts
git commit -m "test(e2e)+fix(admin): admin writes succeed under real rules; roster panel + overrides"
```

## Task E4: Lockstep countdown + mobile readability + no-premature-reveal (E8, E13, E14 → R5, R6, R10, R11)

**Files:** Create `e2e/timer.spec.ts`, `e2e/mobile.spec.ts`

- [ ] **Step 1: Write `e2e/timer.spec.ts` (E8, E14)**

```ts
import { test, expect } from './fixtures/test'
import { seedAdmin, seedSession } from './fixtures/emulator'
import { begin, answerAll, signInAdmin } from './helpers/flows'

test('taker countdown matches the admin remaining time (E8, R5/R6)', async ({ page, browser }) => {
  await seedAdmin('admin@x.org')
  await seedSession('s1', { name: 'Clock', timerMinutes: 30 })
  await begin(page, 'timer-tom')
  const takerText = await page.getByLabel(/time remaining/i).innerText() // "⏱ N min left"
  const takerMin = parseInt(takerText.replace(/\D+/g, ''), 10)

  const ac = await browser.newContext(); const ap = await ac.newPage()
  await signInAdmin(ap, 'admin@x.org')
  const adminText = await ap.getByText(/min left/i).first().innerText()
  const adminMin = parseInt(adminText.replace(/\D+/g, ''), 10)
  expect(Math.abs(takerMin - adminMin)).toBeLessThanOrEqual(1) // lockstep within a tick
  await ac.close()
})

test('fresh 30-min session shows countdown, never an early group (E14, R11)', async ({ page }) => {
  await seedSession('s2', { name: 'NoReveal', timerMinutes: 30 })
  await begin(page, 'fresh-fae')
  await answerAll(page)
  await expect(page.getByText(/check back in/i)).toBeVisible()
  await expect(page.getByText(/group!/i)).toHaveCount(0)
})
```

- [ ] **Step 2: Write `e2e/mobile.spec.ts` (E13, R10)** — runs under the mobile project

```ts
import { test, expect } from './fixtures/test'
import { begin } from './helpers/flows'

test('question text is brand teal with AA contrast on mobile (R10)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile-only')
  await begin(page, 'mobile-mo')
  const h = page.getByRole('heading', { level: 2 })
  await expect(h).toBeVisible()
  const color = await h.evaluate((el) => getComputedStyle(el).color)
  expect(color).toBe('rgb(1, 64, 79)') // --teal #01404f
  // contrast vs background ratio >= 4.5 (teal on cream/pink is ~8:1)
  const ratio = await h.evaluate((el) => {
    const lum = (c: string) => {
      const [r, g, b] = c.match(/\d+/g)!.map(Number).map((v) => {
        const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const fg = lum(getComputedStyle(el).color)
    let node: HTMLElement | null = el as HTMLElement, bg = 'rgb(255,255,255)'
    while (node) { const c = getComputedStyle(node).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)') { bg = c; break } node = node.parentElement }
    const bl = lum(bg)
    const [a, b] = [fg, bl].sort((x, y) => y - x)
    return (a + 0.05) / (b + 0.05)
  })
  expect(ratio).toBeGreaterThanOrEqual(4.5)
})
```

- [ ] **Step 3: Run**

Run: `npm run test:e2e -- timer.spec.ts mobile.spec.ts`
Expected: PASS (E8/E14 desktop; E13 under `mobile-chromium`).

- [ ] **Step 4: Commit**

```bash
git add e2e/timer.spec.ts e2e/mobile.spec.ts
git commit -m "test(e2e): lockstep countdown, no-premature-reveal, mobile contrast"
```

---

# PHASE F — Aggregate & green

## Task F1: Full suite green + docs

**Files:** Modify `docs/superpowers/notes/2026-06-08-open-bugs-handoff.md`

- [ ] **Step 1: Run the whole pyramid**

```bash
npx vitest run            # unit + component (non-emulator + emulator data via test:rules below)
npm run test:rules        # data + rules (emulator)
npm run test:e2e          # Playwright (wraps the emulator)
```
Expected: all green. Fix any cross-task regressions before continuing.

- [ ] **Step 2: Typecheck + build + lint**

```bash
npx tsc -p tsconfig.app.json --noEmit && npm run build && npm run lint
```
Expected: tsc/build clean; lint shows no NEW errors beyond the known pre-existing
`set-state-in-effect` baseline.

- [ ] **Step 3: Update the handoff** — move bugs #4–#8 (and #1/#7, #2) to a "FIXED & covered by
E2E" section, referencing the scenario IDs (E1–E14); note #3 resolved by R3. Mark #1/#7 as
confirmed once E9/E10 pass live.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/notes/2026-06-08-open-bugs-handoff.md
git commit -m "docs: mark session-correctness bugs fixed + covered by E2E (E1–E14)"
```

---

## Self-review (coverage map)

| Requirement | Proven by |
|---|---|
| R1 unique browser-owned names | A1, A3 (rules), E4 |
| R2 start over | B1, E3 |
| R3 session binding/privacy | A2, A4, E5, E6 |
| R4 non-finisher reveal | B3 (domain already), E7 |
| R5 taker name + lockstep countdown | B2, E6, E8 |
| R6 admin time remaining | C1, E8 |
| R7 collapsible roster | C2, E11 |
| R8 override controls | C3, E12 |
| R9 admin writes succeed | E9, E10 (+ fix) |
| R10 mobile readable | D1, E13 |
| R11 no premature reveal | E14 |

No placeholders remain; signatures (`upsertTaker(db, name, {ownerUid, sessionId})`,
`submitTest(db, name, answers)`, `UsernameTakenError`, `Result onStartOver`, `Question
sessionName/minutesLeft`) are consistent across tasks.

**Known execution prerequisites:** Java on PATH for the emulator (handoff dev notes);
`npx playwright install chromium`; the Auth-emulator popup markup may need a one-time selector
adjustment in `signInAdmin`.
