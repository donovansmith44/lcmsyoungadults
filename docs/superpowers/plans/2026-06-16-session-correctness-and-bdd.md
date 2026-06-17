# Session Correctness, Irreversible Sharing & Comprehensive BDD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the mobile header contrast, make result-sharing irreversible with an asymmetric toggle, show a friendly "session ended" state, harden the single-active-session invariant against concurrent admin starts, seed the auth emulator for local admin login, and add comprehensive BDD coverage (multi-actor, concurrency, session lifecycle, admin auth, routing, edge cases).

**Architecture:** Client-only Firebase app (no server). Behavior is enforced by Firestore security rules + a transactional singleton pointer doc `meta/activeSession`. UI is React; tests are split between emulator-backed Vitest data/rules tests (`src/data/*.test.ts`, run via `npm run test:rules`) and Playwright e2e specs (`e2e/*.spec.ts`, run via `npm run test:e2e`). BDD scenarios are expressed with `test.step('Given/When/Then …')`.

**Tech Stack:** Vite 8, React 19, TypeScript, Firebase 12 (Firestore + Auth), Vitest 4, Playwright 1.60, Firebase emulators (Firestore :8080, Auth :9099).

## Global Constraints

- All commands run from `web/` (the app root). Paths below are relative to `web/`.
- Brand teal is `var(--teal)` = `#01404f` (defined `src/ui/theme.css:27`). The header must match this exactly.
- Username normalization is `trim().toLowerCase()` (`src/data/takers.ts:6`); taker doc id = normalized username.
- The active-session singleton pointer lives at `meta/activeSession` with shape `{ sessionId: string | null }` — **a separate collection from `sessions`**, because `useSessions()` (`src/hooks/useSessions.ts`) reads the whole `sessions` collection and must not surface the pointer.
- Do **not** change the signature of `useSession(sessionId)` (it is mocked by value in `src/routes/TestApp.test.tsx:20`).
- Emulator-backed Vitest tests use `getTestEnv()` from `test/emulator` with `assertFails`/`assertSucceeds` and `env.withSecurityRulesDisabled` / `env.authenticatedContext(uid, {email})` (see `src/data/rules.test.ts`).
- e2e helpers live in `e2e/helpers/flows.ts` (`begin`, `answerAll`, `dismissSharing`, `signInAdmin`) and `e2e/fixtures/emulator.ts` (`clearFirestore`, `seedDoc`, `seedAdmin`, `seedSession`, `seedTaker`). Tests import `test`/`expect` from `e2e/fixtures/test`.
- The test is **32** OEJTS items (`OEJTS_ITEMS`); never hard-code a different count.
- **Shared-list selector convention:** the result header renders `{username}, your answers point to`, so the taker's own username always appears on the result screen even when no list shows. To assert the shared-list **region** present/absent, match the unique `SharedList` header text **`Shared in this session`** (`src/ui/SharedList.tsx:8`) — never the taker's own username. Asserting a *different* user's name in the list (e.g. another session member) is fine, since that name appears only in the list. Each row is `User: {username}` / `Test Result: {type}`.
- Commit after each task with the message shown. Run the relevant test command before committing.
- **Running tests (IMPORTANT — overrides any `npm run test:rules`/`test:e2e:ci` in task steps):** a Firestore+Auth emulator is already running on `localhost:8080`/`9099` and a Vite dev server (HMR) on `127.0.0.1:5173`. Run emulator-backed Vitest tests with `npx vitest run src/data/<file>.test.ts [-t "name"]` and e2e with `npx playwright test <spec> [-g "name"]`. Both reuse the running servers. Do **not** run `npm run test:rules` or `npm run test:e2e:ci` — they boot a second emulator and fail with port conflicts. (`npm run test:e2e -- <spec>` is equivalent to the `npx playwright` form and also fine.)

---

## File Structure

**Modify:**
- `src/routes/Landing.tsx` — add explicit teal color to the `<h1>`.
- `src/App.tsx` — add `/personality` → `/personality-test` redirect route.
- `src/data/takers.ts` — `setSharing` guard (no `true→false`).
- `src/data/sessions.ts` — transactional `startSession` + `endSession` clearing the `meta/activeSession` pointer.
- `src/data/adminOps.ts` — `deleteSession` clears the pointer (transaction).
- `src/routes/Result.tsx` — asymmetric lockable share toggle + "Your session has ended" state.
- `src/routes/TestApp.tsx` — compute `sessionEnded`, pass to `Result`; guard the toggle to opt-in only.
- `firestore.rules` — irreversible-sharing clause + `meta` collection rules.
- `e2e/fixtures/emulator.ts` — `updateSeededDoc`, `deleteSeededDoc`, and pointer seeding in `seedSession`.
- `src/data/takers.test.ts`, `src/data/sessions.test.ts`, `src/data/rules.test.ts` — new assertions.
- `e2e/identity.spec.ts`, `e2e/mobile.spec.ts`, `e2e/admin.spec.ts` — extend.

**Create:**
- `e2e/routing.spec.ts`, `e2e/share.spec.ts`, `e2e/session-scope.spec.ts`, `e2e/concurrency.spec.ts`, `e2e/scale.spec.ts`, `e2e/admin-auth.spec.ts`, `e2e/join.spec.ts`.
- `scripts/seed-emulator.mjs`.
- `src/hooks/useActiveSessionId.ts` — live subscription to the `meta/activeSession` pointer (Tasks 15-16).

**Late-join touch-points (Tasks 15-16):** `src/data/takers.ts` (`joinSession`), `firestore.rules` (`sessionId` null→value only), `src/routes/TestApp.tsx` (auto-join effect + `canJoin`), `src/routes/Result.tsx` ("Join this session" button).

---

## Task 1: Header contrast fix + mobile contrast test

**Files:**
- Modify: `src/routes/Landing.tsx:12`
- Test: `e2e/mobile.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the `<h1>` on `/personality-test` renders with `color: var(--teal)`.

- [ ] **Step 1: Write the failing test** — append to `e2e/mobile.spec.ts`:

```ts
test('landing header is brand teal, not a washed-out default (R10)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }) // iPhone 12-ish
  await page.goto('/personality-test')
  const h1 = page.getByRole('heading', { name: /personality test/i })
  await expect(h1).toBeVisible()
  const color = await h1.evaluate((el) => getComputedStyle(el).color)
  // var(--teal) #01404f === rgb(1, 64, 79)
  expect(color).toBe('rgb(1, 64, 79)')
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:e2e -- mobile.spec.ts -g "brand teal"`
Expected: FAIL — computed color is not `rgb(1, 64, 79)` (inherits a UA default).

- [ ] **Step 3: Add the explicit color** — in `src/routes/Landing.tsx:12`, add `color: 'var(--teal)'` to the h1 inline style:

```tsx
<h1 style={{ color: 'var(--teal)', fontWeight: 800, fontSize: '2.4rem', letterSpacing: '.02em', lineHeight: 1.05, margin: '.5rem 0 0' }}>Personality&nbsp;Test</h1>
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npm run test:e2e -- mobile.spec.ts -g "brand teal"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/Landing.tsx e2e/mobile.spec.ts
git commit -m "fix(ui): make landing header explicit teal for mobile contrast"
```

---

## Task 2: `/personality` route alias + routing spec

**Files:**
- Modify: `src/App.tsx:8-12`
- Create: `e2e/routing.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: visiting `/personality` lands on `/personality-test`.

- [ ] **Step 1: Write the failing test** — create `e2e/routing.spec.ts`:

```ts
import { test, expect } from './fixtures/test'
import { begin, answerAll, dismissSharing } from './helpers/flows'

test('Given /personality, When visited, Then it redirects to /personality-test', async ({ page }) => {
  await test.step('Given the alias path, When navigating', async () => {
    await page.goto('/personality')
  })
  await test.step('Then the URL resolves to the canonical test path', async () => {
    await expect(page).toHaveURL(/\/personality-test$/)
    await expect(page.getByRole('heading', { name: /personality test/i })).toBeVisible()
  })
})

test('Given an unknown path, Then it redirects to the test', async ({ page }) => {
  await page.goto('/nope/does-not-exist')
  await expect(page).toHaveURL(/\/personality-test$/)
})

test('Given the taker flow, Then it progresses landing → questions → result', async ({ page }) => {
  await test.step('Given /personality-test, When a name is entered and Begin clicked', async () => {
    await begin(page, 'route-rita')
  })
  await test.step('Then the question flow shows', async () => {
    await expect(page.getByText('1 / 32')).toBeVisible()
  })
  await test.step('When all 32 are answered and sharing dismissed, Then the result shows', async () => {
    await answerAll(page)
    await dismissSharing(page)
    await expect(page.getByText(/your answers point to/i)).toBeVisible()
  })
})
```

- [ ] **Step 2: Run it and watch the alias test fail**

Run: `npm run test:e2e -- routing.spec.ts`
Expected: the first test FAILS (no `/personality` route; the catch-all *does* already cover the unknown-path test, which may pass).

- [ ] **Step 3: Add the alias route** — in `src/App.tsx`, add a redirect before the catch-all:

```tsx
<Routes>
  <Route path="/personality-test" element={<TestApp />} />
  <Route path="/personality" element={<Navigate to="/personality-test" replace />} />
  <Route path="/admin" element={<AdminPage />} />
  <Route path="*" element={<Navigate to="/personality-test" replace />} />
</Routes>
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npm run test:e2e -- routing.spec.ts`
Expected: all three PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx e2e/routing.spec.ts
git commit -m "feat(routing): add /personality alias + routing BDD spec"
```

---

## Task 3: Irreversible sharing — data-layer guard

**Files:**
- Modify: `src/data/takers.ts:95-97`
- Test: `src/data/takers.test.ts`

**Interfaces:**
- Consumes: `getTaker(db, username)` (existing).
- Produces: `setSharing(db, username, sharing)` throws if asked to set `false` while the stored doc already has `sharing === true`. New error class `SharingLockedError extends Error`.

- [ ] **Step 1: Write the failing test** — append to `src/data/takers.test.ts` (match the file's existing `getTestEnv` + `withSecurityRulesDisabled` pattern):

```ts
it('setSharing cannot turn sharing back off once enabled', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await upsertTaker(db, 'lockme', { ownerUid: 'u1', sessionId: 's1' })
    await setSharing(db, 'lockme', true)
    await expect(setSharing(db, 'lockme', false)).rejects.toThrow(/can.?t.*stop sharing|locked/i)
    expect((await getTaker(db, 'lockme'))?.sharing).toBe(true)
  })
})
```

Ensure the imports at the top of `takers.test.ts` include `upsertTaker, setSharing, getTaker` from `./takers`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:rules -- takers.test.ts -t "turn sharing back off"`
Expected: FAIL — `setSharing(false)` currently succeeds and flips the flag.

- [ ] **Step 3: Implement the guard** — replace `setSharing` in `src/data/takers.ts`:

```ts
export class SharingLockedError extends Error {
  constructor() {
    super("Sharing is on and can't be turned off")
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
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npm run test:rules -- takers.test.ts -t "turn sharing back off"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/takers.ts src/data/takers.test.ts
git commit -m "feat(sharing): block setSharing(false) once shared (data layer)"
```

---

## Task 4: Irreversible sharing — security rules

**Files:**
- Modify: `firestore.rules:21-23`
- Test: `src/data/rules.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a `takers` update that changes `sharing` from `true` to `false` is rejected by rules; all other updates (incl. admin group override) still pass.

- [ ] **Step 1: Write the failing tests** — append to `src/data/rules.test.ts`:

```ts
it('a taker cannot turn sharing from true back to false', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'takers', 'shara'),
      { username: 'shara', ownerUid: 'uidA', completed: true, sharing: true, group: null })
  })
  const a = env.authenticatedContext('uidA', {}).firestore()
  await assertFails(setDoc(doc(a, 'takers', 'shara'),
    { username: 'shara', ownerUid: 'uidA', completed: true, sharing: false, group: null }))
})

it('a taker can turn sharing from false to true', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'takers', 'sharb'),
      { username: 'sharb', ownerUid: 'uidA', completed: true, sharing: false, group: null })
  })
  const a = env.authenticatedContext('uidA', {}).firestore()
  await assertSucceeds(setDoc(doc(a, 'takers', 'sharb'),
    { username: 'sharb', ownerUid: 'uidA', completed: true, sharing: true, group: null }))
})
```

- [ ] **Step 2: Run them and watch the first fail**

Run: `npm run test:rules -- rules.test.ts -t sharing`
Expected: "true back to false" FAILS (currently allowed); "false to true" passes.

- [ ] **Step 3: Add the rule clause** — in `firestore.rules`, extend the `takers` `update` rule so once-true stays true:

```
allow update: if signedIn()
  && (resource.data.ownerUid == request.auth.uid || isAdmin())
  && request.resource.data.ownerUid == resource.data.ownerUid
  && (resource.data.sharing != true || request.resource.data.sharing == true);
```

- [ ] **Step 4: Run them and watch both pass**

Run: `npm run test:rules -- rules.test.ts -t sharing`
Expected: both PASS. Also run the full rules file to ensure no regression: `npm run test:rules -- rules.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/data/rules.test.ts
git commit -m "feat(rules): forbid flipping taker sharing true->false"
```

---

## Task 5: Result — asymmetric lockable share toggle

**Files:**
- Modify: `src/routes/Result.tsx`, `src/routes/TestApp.tsx:215`
- Create: `e2e/share.spec.ts`

**Interfaces:**
- Consumes: `Result` props.
- Produces: `Result` renders the share checkbox `disabled` when `sharing === true`; the participant list shows only when `sharing === true`. The opt-in path calls `onToggleShare(true)`.

- [ ] **Step 1: Write the failing test** — create `e2e/share.spec.ts`:

```ts
import { test, expect } from './fixtures/test'
import { seedSession } from './fixtures/emulator'
import { begin, answerAll } from './helpers/flows'

test('Share path: list shown and toggle locked on', async ({ page }) => {
  await test.step('Given an active session and a taker who answers all 32', async () => {
    await seedSession('sx', { name: 'Day', timerMinutes: 30 })
    await begin(page, 'share-sara')
    await answerAll(page)
  })
  await test.step('When they choose to share', async () => {
    await page.getByRole('button', { name: /yes, share/i }).click()
  })
  await test.step('Then they see the participant list and cannot un-share', async () => {
    await expect(page.getByText(/your answers point to/i)).toBeVisible()
    await expect(page.getByText(/shared in this session/i)).toBeVisible() // shared-list region present
    await expect(page.getByRole('checkbox')).toBeDisabled()
  })
})

test('Private path: no list, toggle available; enabling it reveals list and locks', async ({ page }) => {
  await test.step('Given a taker who chooses not to share', async () => {
    await seedSession('sy', { name: 'Day', timerMinutes: 30 })
    await begin(page, 'priv-pat')
    await answerAll(page)
    await page.getByRole('button', { name: /no, keep private/i }).click()
  })
  await test.step('Then no list shows and the toggle is enabled', async () => {
    await expect(page.getByText(/your answers point to/i)).toBeVisible()
    await expect(page.getByText(/shared in this session/i)).toHaveCount(0)
    await expect(page.getByRole('checkbox')).toBeEnabled()
  })
  await test.step('When they toggle sharing on, Then the list appears and the toggle locks', async () => {
    await page.getByRole('checkbox').check()
    await expect(page.getByText(/shared in this session/i)).toBeVisible()
    await expect(page.getByRole('checkbox')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:e2e -- share.spec.ts`
Expected: FAIL — the toggle is never `disabled` (current checkbox is always enabled).

- [ ] **Step 3: Implement the asymmetric toggle** — replace the toggle + list block in `src/routes/Result.tsx` (lines 38-43). Add a `sessionEnded` prop to the interface (used in Task 6; default-safe here):

```tsx
interface Props {
  username: string
  type: string
  t: number
  group: Group | null
  sharing: boolean
  sessionEnded?: boolean
  entries: SharedEntry[]
  onToggleShare: (next: boolean) => void
  onStartOver: () => void
}

export function Result({ username, type, t, group, sharing, sessionEnded = false, entries, onToggleShare, onStartOver }: Props) {
```

Replace the `<label>…</label>` and `{sharing && <SharedList …>}` at the end of the centered column with:

```tsx
        <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '1.4rem', fontSize: '.9rem', cursor: sharing ? 'default' : 'pointer' }}>
          <input
            type="checkbox"
            checked={sharing}
            disabled={sharing || sessionEnded}
            onChange={(e) => onToggleShare(e.target.checked)}
          />
          {sharing ? 'Sharing on — your result is visible to this session' : 'Share my result with this session'}
        </label>

        {sharing && (sessionEnded
          ? <p style={{ marginTop: '1rem', opacity: 0.8 }}>Your session has ended.</p>
          : <SharedList entries={entries} />)}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npm run test:e2e -- share.spec.ts`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/Result.tsx e2e/share.spec.ts
git commit -m "feat(sharing): asymmetric lockable share toggle on result"
```

---

## Task 6: "Your session has ended" state

**Files:**
- Modify: `src/routes/TestApp.tsx`, `e2e/fixtures/emulator.ts`
- Test: `e2e/session-scope.spec.ts` (created here, extended in Task 11)

**Interfaces:**
- Consumes: `useSession` (unchanged signature), `taker`.
- Produces: `TestApp` passes `sessionEnded` to `Result`, true when the taker is completed and bound to a session that is no longer active (ended) or has been deleted. New emulator helpers `updateSeededDoc(path, fields)` and `deleteSeededDoc(path)`.

- [ ] **Step 1: Add emulator helpers** — append to `e2e/fixtures/emulator.ts`:

```ts
export async function updateSeededDoc(path: string, data: Record<string, unknown>) {
  const [coll, id] = path.split('/')
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  await fetch(`${FS}/${coll}/${id}?${mask}`, { method: 'PATCH', ...ADMIN, body: JSON.stringify({ fields: fields(data) }) })
}

export async function deleteSeededDoc(path: string) {
  const [coll, id] = path.split('/')
  await fetch(`${FS}/${coll}/${id}`, { method: 'DELETE', ...ADMIN })
}
```

- [ ] **Step 2: Write the failing test** — create `e2e/session-scope.spec.ts`:

```ts
import { test, expect } from './fixtures/test'
import { seedSession, updateSeededDoc, deleteSeededDoc } from './fixtures/emulator'
import { begin, answerAll } from './helpers/flows'

test('Session ended under a sharing taker shows "your session has ended"', async ({ page }) => {
  await test.step('Given a sharing taker on the result screen of an active session', async () => {
    await seedSession('se1', { name: 'Day', timerMinutes: 30 })
    await begin(page, 'ended-eli')
    await answerAll(page)
    await page.getByRole('button', { name: /yes, share/i }).click()
    await expect(page.getByText(/shared in this session/i)).toBeVisible() // list visible while active
  })
  await test.step('When the admin ends the session', async () => {
    await updateSeededDoc('sessions/se1', { status: 'ended', endedAt: new Date() })
  })
  await test.step('Then the list is replaced by the ended message and the result still shows', async () => {
    await expect(page.getByText(/your session has ended/i)).toBeVisible()
    await expect(page.getByText(/your answers point to/i)).toBeVisible()
  })
})

test('Session deleted under a sharing taker shows the ended message', async ({ page }) => {
  await seedSession('se2', { name: 'Day', timerMinutes: 30 })
  await begin(page, 'gone-gus')
  await answerAll(page)
  await page.getByRole('button', { name: /yes, share/i }).click()
  await expect(page.getByText(/shared in this session/i)).toBeVisible()
  await deleteSeededDoc('sessions/se2')
  await expect(page.getByText(/your session has ended/i)).toBeVisible()
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm run test:e2e -- session-scope.spec.ts`
Expected: FAIL — no "your session has ended" text appears.

- [ ] **Step 4: Wire `sessionEnded` in `TestApp`** — add a "was-loaded" ref so a momentary null (loading) is not mistaken for deletion. After the `takerSession` line (~`src/routes/TestApp.tsx:40`), add:

```tsx
  const sessionWasLoaded = useRef(false)
  useEffect(() => { if (takerSession) sessionWasLoaded.current = true }, [takerSession])
```

Add `useRef` to the React import on line 1: `import { useEffect, useMemo, useRef, useState } from 'react'`.

Then compute the flag (near the other derived flags, ~line 156):

```tsx
  const sessionDeleted = !!taker?.sessionId && sessionWasLoaded.current && takerSession == null
  const sessionEnded = !!taker?.completed && !!taker?.sessionId
    && (sessionDeleted || (takerSession != null && takerSession.status !== 'active'))
```

Pass it to `Result` and make the toggle opt-in-only (irreversible from the UI). Replace the `<Result … />` block (~lines 206-218):

```tsx
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
```

- [ ] **Step 5: Run it and watch it pass**

Run: `npm run test:e2e -- session-scope.spec.ts`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/TestApp.tsx e2e/fixtures/emulator.ts e2e/session-scope.spec.ts
git commit -m "feat(result): show 'your session has ended' when session ends/deletes"
```

---

## Task 7: Single-active session — transactional singleton pointer

**Files:**
- Modify: `src/data/sessions.ts`, `src/data/adminOps.ts`, `e2e/fixtures/emulator.ts`
- Test: `src/data/sessions.test.ts`

**Interfaces:**
- Consumes: `getActiveSession(db)` (existing).
- Produces: `startSession` is atomic via `meta/activeSession`; two concurrent calls yield exactly one session. `endSession`/`deleteSession` clear the pointer when it points at the ended/deleted session. `seedSession` also seeds the pointer for active sessions.

- [ ] **Step 1: Write the failing concurrency test** — append to `src/data/sessions.test.ts`:

```ts
it('two concurrent starts produce exactly one active session', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const results = await Promise.allSettled([
      startSession(db, { name: 'A', timerMinutes: 30, createdBy: 'd@x.org' }),
      startSession(db, { name: 'B', timerMinutes: 30, createdBy: 'd@x.org' }),
    ])
    const ok = results.filter((r) => r.status === 'fulfilled')
    expect(ok).toHaveLength(1)
    const active = await getActiveSession(db)
    expect(active).not.toBeNull()
    // only one session doc exists
    const { getDocs, collection } = await import('firebase/firestore')
    const snap = await getDocs(collection(db, 'sessions'))
    expect(snap.size).toBe(1)
  })
})

it('ending a session clears the active pointer so a new one can start', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    const id = await startSession(db, { name: 'A', timerMinutes: 30, createdBy: 'd@x.org' })
    await endSession(db, id)
    await expect(startSession(db, { name: 'B', timerMinutes: 30, createdBy: 'd@x.org' })).resolves.toBeTruthy()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:rules -- sessions.test.ts -t concurrent`
Expected: FAIL — current check-then-create can fulfil both starts, leaving 2 session docs.

- [ ] **Step 3: Make `startSession`/`endSession` transactional** — rewrite `src/data/sessions.ts`. Update imports to add `collection`→`doc` ref creation and `runTransaction`:

```ts
import {
  Firestore, collection, doc, updateDoc, getDocs, query, where, limit,
  serverTimestamp, runTransaction,
} from 'firebase/firestore'
```

Keep `SessionStatus`, `SessionDoc`, `StartSessionInput`, `getActiveSession`, `archiveSession`, `renameSession`, `setTimerMinutes` as-is. Add a pointer ref helper and replace `startSession`/`endSession`:

```ts
const activePointer = (db: Firestore) => doc(db, 'meta', 'activeSession')

export async function startSession(db: Firestore, input: StartSessionInput): Promise<string> {
  if (await getActiveSession(db)) throw new Error('There is already an active session')
  const ref = doc(collection(db, 'sessions'))
  await runTransaction(db, async (tx) => {
    const ptr = await tx.get(activePointer(db))
    if (ptr.exists() && ptr.data().sessionId) throw new Error('There is already an active session')
    tx.set(ref, {
      name: input.name,
      status: 'active' as SessionStatus,
      timerMinutes: input.timerMinutes,
      startedAt: serverTimestamp(),
      endedAt: null,
      groupsFrozenAt: null,
      createdBy: input.createdBy,
    })
    tx.set(activePointer(db), { sessionId: ref.id })
  })
  return ref.id
}

export async function endSession(db: Firestore, id: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const ptr = await tx.get(activePointer(db))
    tx.update(doc(db, 'sessions', id), { status: 'ended', endedAt: serverTimestamp() })
    if (ptr.exists() && ptr.data().sessionId === id) tx.set(activePointer(db), { sessionId: null })
  })
}
```

- [ ] **Step 4: Clear the pointer on delete** — rewrite `deleteSession` in `src/data/adminOps.ts` (replace the dynamic-import version):

```ts
import {
  Firestore, doc, updateDoc, collection, query, where, getDocs, serverTimestamp, runTransaction,
} from 'firebase/firestore'

export async function deleteSession(db: Firestore, id: string): Promise<void> {
  const pointerRef = doc(db, 'meta', 'activeSession')
  await runTransaction(db, async (tx) => {
    const ptr = await tx.get(pointerRef)
    tx.delete(doc(db, 'sessions', id))
    if (ptr.exists() && ptr.data().sessionId === id) tx.set(pointerRef, { sessionId: null })
  })
}
```

- [ ] **Step 5: Seed the pointer for active seeded sessions** — in `e2e/fixtures/emulator.ts`, update `seedSession` so seeding an active session also seeds the pointer:

```ts
export async function seedSession(id: string, opts: { name: string; timerMinutes: number; status?: string; startedAt?: Date }) {
  const status = opts.status ?? 'active'
  await seedDoc(`sessions/${id}`, {
    name: opts.name, timerMinutes: opts.timerMinutes, status,
    startedAt: opts.startedAt ?? new Date(), groupsFrozenAt: null, createdBy: 'seed',
  })
  if (status === 'active') await seedDoc(`meta/activeSession`, { sessionId: id })
}
```

- [ ] **Step 6: Run the data tests and watch them pass**

Run: `npm run test:rules -- sessions.test.ts`
Expected: all PASS (including the existing "refuses a second active session" and "ending then archiving" tests).

- [ ] **Step 7: Commit**

```bash
git add src/data/sessions.ts src/data/adminOps.ts e2e/fixtures/emulator.ts src/data/sessions.test.ts
git commit -m "feat(sessions): transactional singleton active-session pointer"
```

---

## Task 8: `meta` collection security rules

**Files:**
- Modify: `firestore.rules`
- Test: `src/data/rules.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `meta/*` is readable by any signed-in client and writable only by admins.

- [ ] **Step 1: Write the failing tests** — append to `src/data/rules.test.ts`:

```ts
it('meta/activeSession: signed-in can read, only admin can write', async () => {
  const env = await getTestEnv()
  const anon = env.authenticatedContext('anon1', {}).firestore()
  await assertSucceeds(getDoc(doc(anon, 'meta', 'activeSession')))
  await assertFails(setDoc(doc(anon, 'meta', 'activeSession'), { sessionId: 'x' }))
  const admin = env.authenticatedContext('a1', { email: 'admin@x.org' }).firestore()
  await assertSucceeds(setDoc(doc(admin, 'meta', 'activeSession'), { sessionId: 'x' }))
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:rules -- rules.test.ts -t "meta/activeSession"`
Expected: FAIL — with no `meta` match, both the anon read and admin write are denied.

- [ ] **Step 3: Add the `meta` rules** — inside `match /databases/{database}/documents {`, add alongside the other matches:

```
    // App singletons (e.g. the active-session pointer): readable by any signed-in
    // client; writable only by admins (mirrors sessions).
    match /meta/{doc} {
      allow read: if signedIn();
      allow write: if isAdmin();
    }
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npm run test:rules -- rules.test.ts -t "meta/activeSession"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/data/rules.test.ts
git commit -m "feat(rules): meta collection readable by signed-in, writable by admins"
```

---

## Task 9: Admin session-management e2e (concurrent start, blocked start, delete gate)

**Files:**
- Create: `e2e/admin-auth.spec.ts`

**Interfaces:**
- Consumes: `signInAdmin`, `seedAdmin`, `seedSession`.
- Produces: e2e coverage of admin auth gating + single-active behavior + delete confirmation.

- [ ] **Step 1: Write the tests** — create `e2e/admin-auth.spec.ts`:

```ts
import { test, expect } from './fixtures/test'
import { seedAdmin, seedSession } from './fixtures/emulator'
import { signInAdmin } from './helpers/flows'

test('Allowlisted admin can sign in and start a session', async ({ page }) => {
  await seedAdmin('donovan.smith44@gmail.com')
  await signInAdmin(page, 'donovan.smith44@gmail.com')
  await page.getByPlaceholder(/session name/i).fill('Day One')
  await page.getByRole('button', { name: /start session/i }).click()
  await expect(page.getByText(/Day One/).first()).toBeVisible()
})

test('Start is blocked while a session is already active', async ({ page }) => {
  await seedAdmin('donovan.smith44@gmail.com')
  await seedSession('act1', { name: 'Already Active', timerMinutes: 30 })
  await signInAdmin(page, 'donovan.smith44@gmail.com')
  await page.getByPlaceholder(/session name/i).fill('Second')
  await expect(page.getByRole('button', { name: /start session/i })).toBeDisabled()
  await expect(page.getByText(/end the active session before starting another/i)).toBeVisible()
})

test('Non-allowlisted Google user is denied the admin console', async ({ page }) => {
  // No seedAdmin for this email → not in allowlist.
  await page.goto('/admin')
  const popupPromise = page.waitForEvent('popup')
  await page.getByRole('button', { name: /sign in with google/i }).click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded')
  await popup.locator('.js-new-account').click()
  await popup.locator('#email-input').fill('stranger@gmail.com')
  await popup.locator('#display-name-input').fill('Stranger')
  await popup.locator('#sign-in').click()
  await expect(page.getByRole('heading', { name: /session admin/i })).toHaveCount(0)
})

test('Delete requires typing DELETE exactly', async ({ page }) => {
  await seedAdmin('donovan.smith44@gmail.com')
  await seedSession('del1', { name: 'To Delete', timerMinutes: 30, status: 'ended' })
  await signInAdmin(page, 'donovan.smith44@gmail.com')
  await page.getByRole('button', { name: /^delete$/i }).first().click()
  // wrong value does not delete
  const field = page.getByRole('textbox')
  await field.fill('nope')
  await page.getByRole('button', { name: /confirm|delete/i }).last().click()
  await expect(page.getByText(/To Delete/).first()).toBeVisible()
  // correct value deletes
  await field.fill('DELETE')
  await page.getByRole('button', { name: /confirm|delete/i }).last().click()
  await expect(page.getByText(/To Delete/)).toHaveCount(0)
})
```

> If `DeleteConfirm`'s field/labels differ, open `src/routes/admin/DeleteConfirm.tsx` and adjust the selectors to match its actual input placeholder and button text. Do not change the component to fit the test unless the component is wrong.

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -- admin-auth.spec.ts`
Expected: PASS (these assert already-built behavior + Task 7's pointer). Fix selectors if `DeleteConfirm` differs.

- [ ] **Step 3: Commit**

```bash
git add e2e/admin-auth.spec.ts
git commit -m "test(e2e): admin auth gating, blocked start, delete confirmation"
```

---

## Task 10: Auth emulator seed script + README

**Files:**
- Create: `scripts/seed-emulator.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: the running Firestore emulator REST API on `127.0.0.1:8080`, project `demo-lya`.
- Produces: `node scripts/seed-emulator.mjs` seeds `admins/donovan.smith44@gmail.com` and an active demo session.

- [ ] **Step 1: Write the script** — create `scripts/seed-emulator.mjs`:

```js
// Seed the LOCAL Firestore emulator for hand-testing: an admin allowlist entry
// and one active demo session. Run AFTER `npm run emulators` (or firebase emulators:start).
// Usage: node scripts/seed-emulator.mjs
const PROJECT = 'demo-lya'
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`
const ADMIN = { headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' } }
const ADMIN_EMAIL = 'donovan.smith44@gmail.com'

function fields(obj) {
  const f = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) f[k] = { nullValue: null }
    else if (typeof v === 'string') f[k] = { stringValue: v }
    else if (typeof v === 'number') f[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
    else if (typeof v === 'boolean') f[k] = { booleanValue: v }
    else if (v instanceof Date) f[k] = { timestampValue: v.toISOString() }
  }
  return f
}
async function put(path, data) {
  const [coll, id] = path.split('/')
  const res = await fetch(`${FS}/${coll}?documentId=${id}`, { method: 'POST', ...ADMIN, body: JSON.stringify({ fields: fields(data) }) })
  if (!res.ok && res.status !== 409) throw new Error(`seed ${path} failed: ${res.status} ${await res.text()}`)
}

const sessionId = 'demo-session'
await put(`admins/${ADMIN_EMAIL}`, { email: ADMIN_EMAIL })
await put(`sessions/${sessionId}`, { name: 'Demo Session', timerMinutes: 30, status: 'active', startedAt: new Date(), groupsFrozenAt: null, createdBy: 'seed' })
await put('meta/activeSession', { sessionId })
console.log(`Seeded admin ${ADMIN_EMAIL} + active session "${sessionId}".`)
console.log('Sign in at /admin via the Google popup → "Add new account" → ' + ADMIN_EMAIL)
```

- [ ] **Step 2: Run it against the emulator**

Run (with emulators running): `node scripts/seed-emulator.mjs`
Expected: prints "Seeded admin … + active session …". (If it errors with a connection refused, start emulators first.)

- [ ] **Step 3: Document it** — under the Develop section of `README.md` (or `web/README.md`), add:

```markdown
### Hand-testing with a local admin

```bash
cd web
npm run emulators              # in one terminal (Firestore :8080, Auth :9099)
npm run dev                    # in another (Vite)
node scripts/seed-emulator.mjs # seed admin allowlist + a demo active session
```

Open `/admin`, click **Sign in with Google**, then in the emulator popup choose **Add new account** and enter `donovan.smith44@gmail.com`. That email is in the seeded `admins` allowlist, so the console loads.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-emulator.mjs README.md
git commit -m "chore(dev): emulator seed script for local admin sign-in"
```

---

## Task 11: Session scoping & lifecycle BDD

**Files:**
- Modify: `e2e/session-scope.spec.ts` (append)

**Interfaces:**
- Consumes: `seedSession`, `seedTaker`, `updateSeededDoc`, `deleteSeededDoc`, `begin`, `answerAll`.
- Produces: isolation + multi-session lifecycle coverage.

- [ ] **Step 1: Write the tests** — append to `e2e/session-scope.spec.ts`:

```ts
import { seedTaker } from './fixtures/emulator'

test('A taker sees only their own session\'s sharers, never another session\'s', async ({ page }) => {
  await test.step('Given session A and session B each with a sharer', async () => {
    await seedSession('A', { name: 'A', timerMinutes: 30 })
    // B is seeded ended so two active sessions never coexist; visibility is by sessionId.
    await seedSession('B', { name: 'B', timerMinutes: 30, status: 'ended' })
    await seedTaker('alice-A', 'A', { type: 'INTJ' })
    await updateSeededDoc('takers/alice-A', { sharing: true })
    await seedTaker('bob-B', 'B', { type: 'ESFP' })
    await updateSeededDoc('takers/bob-B', { sharing: true })
  })
  await test.step('When a new taker joins (active) session A and shares', async () => {
    await begin(page, 'carol-A')
    await answerAll(page)
    await page.getByRole('button', { name: /yes, share/i }).click()
  })
  await test.step('Then they see A\'s sharer but never B\'s', async () => {
    await expect(page.getByText(/alice-A/i)).toBeVisible()
    await expect(page.getByText(/bob-B/i)).toHaveCount(0)
  })
})

test('Lifecycle: delete A, create B; B cannot see A', async ({ page, browser }) => {
  await test.step('Given session A with a sharer, then A is deleted', async () => {
    await seedSession('lifeA', { name: 'A', timerMinutes: 30 })
    await seedTaker('ann-A', 'lifeA', { type: 'INFP' })
    await updateSeededDoc('takers/ann-A', { sharing: true })
    await deleteSeededDoc('sessions/lifeA')
    await deleteSeededDoc('meta/activeSession')
  })
  await test.step('When session B opens and a taker shares', async () => {
    await seedSession('lifeB', { name: 'B', timerMinutes: 30 })
    await begin(page, 'ben-B')
    await answerAll(page)
    await page.getByRole('button', { name: /yes, share/i }).click()
  })
  await test.step('Then B\'s taker sees only B, never the deleted A\'s sharer', async () => {
    await expect(page.getByText(/shared in this session/i)).toBeVisible()
    await expect(page.getByText(/ann-A/i)).toHaveCount(0)
  })
})

test('No active session at Begin: taker stays private with no list', async ({ page }) => {
  // No seedSession → getActiveSession returns null → taker is session-less.
  await begin(page, 'lonely-lou')
  await answerAll(page)
  await page.getByRole('button', { name: /no, keep private/i }).click()
  await expect(page.getByText(/your answers point to/i)).toBeVisible()
  await expect(page.getByRole('checkbox')).toBeEnabled()
  await expect(page.getByText(/shared in this session/i)).toHaveCount(0) // no shared-list region
})
```

- [ ] **Step 2: Run the full session-scope spec**

Run: `npm run test:e2e -- session-scope.spec.ts`
Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/session-scope.spec.ts
git commit -m "test(e2e): session isolation + lifecycle BDD scenarios"
```

---

## Task 12: Concurrency BDD (simultaneous takers, live list)

**Files:**
- Create: `e2e/concurrency.spec.ts`

**Interfaces:**
- Consumes: `seedSession`, `begin`, `answerAll` across multiple `browser.newContext()`.
- Produces: live cross-context visibility coverage.

- [ ] **Step 1: Write the test** — create `e2e/concurrency.spec.ts`:

```ts
import { test, expect } from './fixtures/test'
import { clearFirestore, seedSession } from './fixtures/emulator'
import { begin, answerAll } from './helpers/flows'

test('Simultaneous takers: sharers see each other live; a private one is hidden', async ({ browser }) => {
  await clearFirestore()
  await seedSession('live', { name: 'Live', timerMinutes: 30 })

  const ctxs = await Promise.all([0, 1, 2].map(() => browser.newContext()))
  const [pA, pB, pC] = await Promise.all(ctxs.map((c) => c.newPage()))

  await test.step('Given three takers begin in the same session at once', async () => {
    await Promise.all([begin(pA, 'amy'), begin(pB, 'ben'), begin(pC, 'cat')])
    await Promise.all([answerAll(pA), answerAll(pB), answerAll(pC)])
  })
  await test.step('When amy and ben share but cat stays private', async () => {
    await pA.getByRole('button', { name: /yes, share/i }).click()
    await pB.getByRole('button', { name: /yes, share/i }).click()
    await pC.getByRole('button', { name: /no, keep private/i }).click()
  })
  await test.step('Then amy and ben see each other live; cat appears to nobody', async () => {
    await expect(pA.getByText(/ben/i)).toBeVisible()
    await expect(pB.getByText(/amy/i)).toBeVisible()
    await expect(pA.getByText(/\bcat\b/i)).toHaveCount(0)
    await expect(pB.getByText(/\bcat\b/i)).toHaveCount(0)
  })
  await Promise.all(ctxs.map((c) => c.close()))
})
```

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -- concurrency.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/concurrency.spec.ts
git commit -m "test(e2e): simultaneous takers see live session-scoped list"
```

---

## Task 13: Event-scale BDD (30+ devices, mixed states)

**Files:**
- Create: `e2e/scale.spec.ts`

**Interfaces:**
- Consumes: `seedSession`, `seedTaker`, `updateSeededDoc`, `begin`, `answerAll`.
- Produces: a hybrid seed-crowd + few-live-actors scale check.

- [ ] **Step 1: Write the test** — create `e2e/scale.spec.ts`:

```ts
import { test, expect } from './fixtures/test'
import { clearFirestore, seedSession, seedTaker, updateSeededDoc } from './fixtures/emulator'
import { begin, answerAll } from './helpers/flows'

test('30+ takers in mixed states: a live actor sees exactly the completed+shared of its session', async ({ browser }) => {
  await clearFirestore()
  await seedSession('big', { name: 'Big', timerMinutes: 30 })
  await seedSession('other', { name: 'Other', timerMinutes: 30, status: 'ended' })

  const sharedNames: string[] = []
  await test.step('Given a ~36-person crowd in assorted states', async () => {
    const jobs: Promise<unknown>[] = []
    for (let i = 0; i < 36; i++) {
      const name = `crowd-${i}`
      if (i % 3 === 0) {
        // completed + shared
        jobs.push(seedTaker(name, 'big', { type: 'INFJ' }).then(() => updateSeededDoc(`takers/${name}`, { sharing: true })))
        sharedNames.push(name)
      } else if (i % 3 === 1) {
        // completed + private
        jobs.push(seedTaker(name, 'big', { type: 'ESTP' }))
      } else {
        // still testing (not completed)
        jobs.push(seedTaker(name, 'big', { completed: false, type: 'INTP' }))
      }
    }
    // plus a few in the OTHER session, shared — must never appear
    jobs.push(seedTaker('other-1', 'other', { type: 'ENFP' }).then(() => updateSeededDoc('takers/other-1', { sharing: true })))
    await Promise.all(jobs)
  })

  await test.step('When a live actor joins the big session and shares', async () => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await begin(page, 'live-liz')
    await answerAll(page)
    await page.getByRole('button', { name: /yes, share/i }).click()

    await test.step('Then they see every shared crowd member, none of the private/testing, and nobody from the other session', async () => {
      for (const n of sharedNames) await expect(page.getByText(new RegExp(`\\b${n}\\b`))).toBeVisible()
      await expect(page.getByText(/\bcrowd-1\b/)).toHaveCount(0)   // private
      await expect(page.getByText(/\bcrowd-2\b/)).toHaveCount(0)   // still testing
      await expect(page.getByText(/other-1/)).toHaveCount(0)       // other session
    })
    await ctx.close()
  })
})
```

> Note: this is a correctness-at-scale check, not a load test. It seeds the crowd and drives one live actor. If true N-device load testing is ever needed, that belongs in a separate harness (flagged in the spec, §6.4.1).

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -- scale.spec.ts`
Expected: PASS. (Allow a generous timeout; `answerAll` is ~8s.)

- [ ] **Step 3: Commit**

```bash
git add e2e/scale.spec.ts
git commit -m "test(e2e): event-scale mixed-state session-scope correctness"
```

---

## Task 14: Identity edge cases — name-taken message & concurrent race

**Files:**
- Modify: `e2e/identity.spec.ts` (append)

**Interfaces:**
- Consumes: `begin`, `clearFirestore`, multiple contexts.
- Produces: explicit "name already taken" wording + concurrent-claim race coverage.

- [ ] **Step 1: Write the tests** — append to `e2e/identity.spec.ts`:

```ts
test('Given a taken name on another device, Then begin shows "taken" (E4-msg)', async ({ browser }) => {
  await clearFirestore()
  const c1 = await browser.newContext(); const p1 = await c1.newPage()
  await begin(p1, 'uniq-uma')
  await expect(p1.getByText('1 / 32')).toBeVisible()

  const c2 = await browser.newContext(); const p2 = await c2.newPage()
  await begin(p2, 'uniq-uma')
  await expect(p2.getByText(/taken/i)).toBeVisible()
  await c1.close(); await c2.close()
})

test('Given two devices racing the same fresh name, Then exactly one is admitted', async ({ browser }) => {
  await clearFirestore()
  const c1 = await browser.newContext(); const p1 = await c1.newPage()
  const c2 = await browser.newContext(); const p2 = await c2.newPage()
  await Promise.all([begin(p1, 'race-rae'), begin(p2, 'race-rae')])

  // One page shows the question flow; the other shows the taken error.
  const admitted = [p1, p2].map((p) => p.getByText('1 / 32'))
  const refused = [p1, p2].map((p) => p.getByText(/taken/i))
  const okCount = (await Promise.all(admitted.map((l) => l.count()))).reduce((a, b) => a + b, 0)
  const noCount = (await Promise.all(refused.map((l) => l.count()))).reduce((a, b) => a + b, 0)
  expect(okCount).toBe(1)
  expect(noCount).toBe(1)
  await c1.close(); await c2.close()
})
```

Confirm `clearFirestore` is imported at the top of `identity.spec.ts` (it already is).

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -- identity.spec.ts`
Expected: PASS. (The race relies on Firestore `create`-when-absent rules already enforced; if both occasionally pass locally due to timing, the doc-id uniqueness rule still guarantees one create — re-run to confirm determinism.)

- [ ] **Step 3: Commit**

```bash
git add e2e/identity.spec.ts
git commit -m "test(e2e): name-taken message + concurrent name-claim race"
```

---

## Task 15: Late join — `joinSession` data fn + sessionId-immutability rule

**Files:**
- Modify: `src/data/takers.ts`, `firestore.rules`
- Test: `src/data/takers.test.ts`, `src/data/rules.test.ts`

**Interfaces:**
- Consumes: `takerRef` (existing, module-private).
- Produces: `joinSession(db, username, sessionId)` binds `sessionId` only when currently `null` (transaction, idempotent no-op otherwise). Rules allow a `takers` update to set `sessionId` only `null→value`.

- [ ] **Step 1: Write the failing data test** — append to `src/data/takers.test.ts`:

```ts
it('joinSession binds a session-less taker, and never hops an already-bound one', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await upsertTaker(db, 'joiner', { ownerUid: 'u1', sessionId: null })
    await joinSession(db, 'joiner', 'S1')
    expect((await getTaker(db, 'joiner'))?.sessionId).toBe('S1')
    await joinSession(db, 'joiner', 'S2') // no-op: already bound
    expect((await getTaker(db, 'joiner'))?.sessionId).toBe('S1')
  })
})
```

Add `joinSession` to the `./takers` import in `takers.test.ts`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/data/takers.test.ts -t joinSession`
Expected: FAIL — `joinSession` is not exported.

- [ ] **Step 3: Implement `joinSession`** — in `src/data/takers.ts`, add `runTransaction` to the firebase import and add:

```ts
/** Binds a session-less taker to a session. No-op if already bound (sessions never hop). */
export async function joinSession(db: Firestore, username: string, sessionId: string): Promise<void> {
  const ref = takerRef(db, username)
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists() || snap.data().sessionId != null) return
    tx.update(ref, { sessionId, updatedAt: serverTimestamp() })
  })
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run src/data/takers.test.ts -t joinSession`
Expected: PASS.

- [ ] **Step 5: Write the failing rules tests** — append to `src/data/rules.test.ts`:

```ts
it('a taker may set sessionId from null to a value (join) but not change a set one (hop)', async () => {
  const env = await getTestEnv()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'takers', 'jna'),
      { username: 'jna', ownerUid: 'uidA', completed: false, sharing: false, sessionId: null, group: null })
    await setDoc(doc(ctx.firestore(), 'takers', 'jnb'),
      { username: 'jnb', ownerUid: 'uidA', completed: false, sharing: false, sessionId: 'A', group: null })
  })
  const a = env.authenticatedContext('uidA', {}).firestore()
  await assertSucceeds(setDoc(doc(a, 'takers', 'jna'),
    { username: 'jna', ownerUid: 'uidA', completed: false, sharing: false, sessionId: 'A', group: null }))
  await assertFails(setDoc(doc(a, 'takers', 'jnb'),
    { username: 'jnb', ownerUid: 'uidA', completed: false, sharing: false, sessionId: 'B', group: null }))
})
```

- [ ] **Step 6: Run it and watch the hop test fail**

Run: `npx vitest run src/data/rules.test.ts -t "join"`
Expected: FAIL — the hop (`A→B`) is currently allowed (rules don't lock `sessionId`).

- [ ] **Step 7: Add the rule clause** — extend the `takers` `update` rule in `firestore.rules` so `sessionId` only goes `null→value` (combine with the existing sharing clause from Task 4):

```
allow update: if signedIn()
  && (resource.data.ownerUid == request.auth.uid || isAdmin())
  && request.resource.data.ownerUid == resource.data.ownerUid
  && (resource.data.sharing != true || request.resource.data.sharing == true)
  && (resource.data.sessionId == null || request.resource.data.sessionId == resource.data.sessionId);
```

- [ ] **Step 8: Run the rules tests and watch them pass**

Run: `npx vitest run src/data/rules.test.ts`
Expected: PASS (join allowed, hop denied, all prior rules intact).

- [ ] **Step 9: Commit**

```bash
git add src/data/takers.ts firestore.rules src/data/takers.test.ts src/data/rules.test.ts
git commit -m "feat(sessions): joinSession + sessionId null->value-only rule (late join)"
```

---

## Task 16: Late join — hook, auto-join, and "Join this session" UI

**Files:**
- Create: `src/hooks/useActiveSessionId.ts`, `e2e/join.spec.ts`
- Modify: `src/routes/TestApp.tsx`, `src/routes/Result.tsx`

**Interfaces:**
- Consumes: `joinSession` (Task 15), `meta/activeSession` pointer.
- Produces: `useActiveSessionId(): string | null`. `TestApp` auto-joins a mid-test session-less taker and passes `canJoin`/`onJoin` to `Result`. `Result` shows a "Join this session" button when `canJoin`.

- [ ] **Step 1: Write the failing e2e** — create `e2e/join.spec.ts`:

```ts
import { test, expect } from './fixtures/test'
import { clearFirestore, seedSession } from './fixtures/emulator'
import { begin, answerAll } from './helpers/flows'

test('Auto-join: a mid-test session-less taker is bound when a session starts', async ({ page }) => {
  await clearFirestore() // no active session at Begin
  await test.step('Given a taker begins with no active session and answers one question', async () => {
    await begin(page, 'early-eve')
    await page.getByRole('radio').nth(2).click()
    await expect(page.getByText('2 / 32')).toBeVisible()
  })
  await test.step('When a session starts mid-test', async () => {
    await seedSession('mid', { name: 'Mid', timerMinutes: 30 })
  })
  await test.step('Then finishing and sharing puts them in that session\'s list', async () => {
    await answerAll(page) // answers remaining items
    await page.getByRole('button', { name: /yes, share/i }).click()
    await expect(page.getByText(/shared in this session/i)).toBeVisible() // bound + sharing => list region
  })
})

test('Opt-in join: a finished session-less taker can join a later session', async ({ page }) => {
  await clearFirestore()
  await test.step('Given a taker finishes with no active session (private)', async () => {
    await begin(page, 'done-dan')
    await answerAll(page)
    await page.getByRole('button', { name: /no, keep private/i }).click()
    await expect(page.getByText(/your answers point to/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /join this session/i })).toHaveCount(0)
  })
  await test.step('When a session starts, Then a Join button appears; tapping it lets them share', async () => {
    await seedSession('later', { name: 'Later', timerMinutes: 30 })
    await page.getByRole('button', { name: /join this session/i }).click()
    await page.getByRole('checkbox').click() // click, not check(): React-controlled checkbox backed by async Firestore
    await expect(page.getByText(/shared in this session/i)).toBeVisible()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx playwright test join.spec.ts`
Expected: FAIL — no auto-join, no "Join this session" button.

- [ ] **Step 3: Create the hook** — create `src/hooks/useActiveSessionId.ts`:

```ts
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

/** Live id of the currently-active session (from the meta/activeSession pointer), or null. */
export function useActiveSessionId(): string | null {
  const [id, setId] = useState<string | null>(null)
  useEffect(() => onSnapshot(doc(db, 'meta', 'activeSession'), (snap) => {
    setId(snap.exists() ? ((snap.data().sessionId as string | null) ?? null) : null)
  }), [])
  return id
}
```

- [ ] **Step 4: Wire auto-join + canJoin in `TestApp`** — add imports near the top of `src/routes/TestApp.tsx`:

```tsx
import { upsertTaker, recordAnswer, setSharing, joinSession, UsernameTakenError } from '../data/takers'
import { useActiveSessionId } from '../hooks/useActiveSessionId'
```

After the `useSession` line (~line 40) add the subscription:

```tsx
  const activeSessionId = useActiveSessionId()
```

Add the auto-join effect (near the other effects, after `onBegin`):

```tsx
  // Session-less taker still testing → silently join a session that becomes active.
  useEffect(() => {
    if (username && taker && !taker.completed && taker.sessionId == null && activeSessionId) {
      void joinSession(db, username, activeSessionId)
    }
  }, [username, taker, activeSessionId])
```

Compute `canJoin` (a completed, session-less taker with an active session available) and pass it plus `onJoin` to `Result` — update the `<Result … />` block from Task 6:

```tsx
  if (phase === 'result' && taker) {
    const canJoin = !!taker.completed && taker.sessionId == null && activeSessionId != null
    return (
      <Result
        username={taker.username}
        type={taker.type ?? ''}
        t={resultT}
        group={taker.group}
        sharing={taker.sharing}
        sessionEnded={sessionEnded}
        canJoin={canJoin}
        onJoin={() => { if (activeSessionId) void joinSession(db, username, activeSessionId) }}
        entries={entries}
        onToggleShare={(next) => { if (next) void setSharing(db, username, true) }}
        onStartOver={goLanding}
      />
    )
  }
```

- [ ] **Step 5: Add the Join button to `Result`** — extend the `Props` interface and render the button. In `src/routes/Result.tsx`, add to `Props`:

```tsx
  canJoin?: boolean
  onJoin?: () => void
```

Add `canJoin = false, onJoin` to the destructured params. Then, immediately **before** the `<label>` share toggle, render the join affordance and gate the toggle so a session-less finished taker joins before sharing:

```tsx
        {canJoin && (
          <button onClick={onJoin} style={{ marginTop: '1.2rem', background: 'var(--teal)', color: 'var(--cream)', border: 'none', borderRadius: 999, padding: '.6rem 1.2rem', fontWeight: 700, cursor: 'pointer' }}>
            Join this session →
          </button>
        )}

        {!canJoin && (
          <label style={{ display: 'flex', gap: '.5rem', alignItems: 'center', justifyContent: 'center', marginTop: '1.4rem', fontSize: '.9rem', cursor: sharing ? 'default' : 'pointer' }}>
            <input type="checkbox" checked={sharing} disabled={sharing || sessionEnded} onChange={(e) => onToggleShare(e.target.checked)} />
            {sharing ? 'Sharing on — your result is visible to this session' : 'Share my result with this session'}
          </label>
        )}
```

Keep the existing `{sharing && (sessionEnded ? … : <SharedList … />)}` block below unchanged.

- [ ] **Step 6: Run it and watch it pass**

Run: `npx playwright test join.spec.ts`
Expected: both PASS.

- [ ] **Step 7: Guard against regressions** — re-run the share + session-scope specs (they exercise the same `Result` block):

Run: `npx playwright test share.spec.ts session-scope.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useActiveSessionId.ts src/routes/TestApp.tsx src/routes/Result.tsx e2e/join.spec.ts
git commit -m "feat(join): auto-join mid-test + opt-in join on results for session-less takers"
```

---

## Final verification

- [ ] **Run the unit/domain suite:** `npm test` — Expected: PASS.
- [ ] **Run emulator-backed data/rules tests:** `npm run test:rules` — Expected: PASS.
- [ ] **Run the full e2e suite:** `npm run test:e2e:ci` — Expected: PASS (boots emulators + Playwright).
- [ ] **Lint:** `npm run lint` — Expected: clean.
- [ ] **Manual smoke:** start emulators + `npm run dev`, run `node scripts/seed-emulator.mjs`, open `/personality` on a phone over the LAN, confirm the teal header, take the test, share, see the list, and that the toggle locks.

---

## Self-Review (completed during planning)

- **Spec coverage:** Header §4.1→T1; irreversible sharing §4.2→T3/T4/T5; continual access §5 (no code, asserted in routing T2 deep-link + existing resume tests); orphaned taker §4.6→T6; single-active §4.3→T7/T8/T9; late join §4.7→T15/T16; route alias §4.4→T2; emulator seed §4.5→T10; BDD §6.1→T5/T2, §6.2→T3/T4/T14, §6.3→T6/T11/T16, §6.4/§6.4.1→T12/T13, §6.5→T9, §6.6→T1, §6.7→T2. All sections map to a task.
- **Type consistency:** `setSharing`/`SharingLockedError` (T3), `Result` `sessionEnded?: boolean` + `canJoin?`/`onJoin?` (T5/T6/T16), `meta/activeSession` `{ sessionId }` (T7/T8/T10/T15/T16), `joinSession(db, username, sessionId)` (T15/T16), `useActiveSessionId()` (T16), `updateSeededDoc`/`deleteSeededDoc` (T6, used T11/T13) are named consistently across tasks.
- **Ordering note:** T15/T16 depend on the `meta/activeSession` pointer + `meta` rules from T7/T8, which run earlier — safe.
- **No placeholders:** every code/test step carries full code; selector caveats (DeleteConfirm) point to the file to verify rather than leaving a TODO.
