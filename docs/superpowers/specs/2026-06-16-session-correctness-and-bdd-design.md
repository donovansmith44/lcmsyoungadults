# Session Correctness, Continual Access & Comprehensive BDD — Design Spec

**Date:** 2026-06-16
**Status:** Approved for planning
**Context:** Follow-up to [`2026-06-08-personality-test-app-design.md`](2026-06-08-personality-test-app-design.md). The Personality Day event (2026-06-20) app works end-to-end; this spec fixes a mobile contrast bug, refines sharing/identity behavior, hardens the single-active-session invariant, seeds the auth emulator for local admin testing, and adds comprehensive BDD coverage (multi-actor, concurrency, admin auth, edge cases).

---

## 1. Goals

- Fix the unreadable "Personality Test" header on mobile.
- Make **sharing irreversible** once enabled, with the asymmetric toggle behavior the user specified.
- Confirm **same-device continual access** to results throughout the event day (no new identity mechanism).
- Harden the **one-active-session-at-a-time** invariant against concurrent admin starts.
- Seed the **auth emulator** so the user can sign in to `/admin` locally.
- Add **comprehensive BDD tests** (Given/When/Then via Playwright `test.step()`) covering the full flow, multi-actor concurrency, session lifecycle/isolation, admin auth, and edge cases.

## 2. Non-goals

- Cross-device result recovery (recovery codes, magic links) — explicitly **out** per the same-device decision. Clearing the browser or switching phones loses access; accepted for a one-day event.
- Gherkin `.feature` tooling — BDD is expressed with `test.step('Given/When/Then', …)` in plain Playwright, no new dependency.
- Changing the OEJTS item set — the test remains **32 questions**.
- Reworking grouping/freeze logic beyond what existing admin specs already cover.

## 3. Decisions (resolved during brainstorming)

| Topic | Decision |
|---|---|
| Re-access to results | **Same-device only** — localStorage + persistent anonymous Firebase session auto-loads saved state on revisit. The name+Begin form is for *new* takers only. |
| Sharing | **Irreversible.** Once a taker opts in, the toggle locks; un-sharing is blocked in UI **and** security rules. |
| Toggle asymmetry | Not sharing → no list, toggle **enabled** (to opt in). Sharing → list visible, toggle **disabled** (cannot opt out). |
| Question count | **32** (OEJTS standard). |
| BDD style | `test.step('Given …' / 'When …' / 'Then …')` in Playwright on the existing emulator harness. |
| Route | Add redirect `/personality` → `/personality-test`. |
| Admin email (emulator) | `donovan.smith44@gmail.com` seeded into the `admins` allowlist. |
| Late join (session-less) | A taker who began before any session existed (`sessionId == null`) **auto-joins silently** the moment a session becomes active, *if still mid-test*. If they already **finished** session-less, they get an opt-in **"Join this session"** button on the result screen. A `sessionId` is set **only** null→value; an already-bound session never changes (no hopping). |

## 4. Behavior changes & implementation impact

### 4.1 Header contrast fix
`src/routes/Landing.tsx:12` — the `<h1>Personality Test</h1>` sets no explicit `color` and is meant to inherit `--teal` from `body`, but on mobile dark-mode UA defaults it renders light/white over the pink background.
**Fix:** add `color: var(--teal)` (`#01404f`, identical to the Begin button) to the h1's inline style. Robust regardless of UA dark-mode behavior.

### 4.2 Sharing irreversibility (asymmetric toggle)
- **UI** (`src/routes/Result.tsx`): when `sharing === true`, render the toggle as disabled/locked with explanatory text ("Sharing is on — your result is visible to this session"); the participant list shows. When `sharing === false`, hide the list and show an **enabled** toggle that opts in. Opting in flips `sharing` to `true`, reveals the list, and locks the toggle.
- **Rules** (`firestore.rules`, `takers` update): add a clause so a taker update may not change `sharing` from `true` to `false`. Concretely, allow the update only if `resource.data.sharing == false || request.resource.data.sharing == true` (i.e. once `true`, it must stay `true`). Admin updates (group override) must not trip this; verify the admin path still passes.
- **Data layer** (`src/data/takers.ts` `setSharing`): guard against `false` when already shared, surfacing a clear error rather than a rules rejection.

### 4.3 Single-active-session hardening
`src/data/sessions.ts:33` `startSession` currently does a non-atomic check-then-create; concurrent calls can both create an `active` session.
**Fix (confirmed):** enforce uniqueness atomically with a **singleton pointer** — a well-known doc `sessions/_active` written inside a Firestore `runTransaction` that **fails if the pointer already exists**, and is **cleared on end/delete** so the next start succeeds. The data layer and rules together must guarantee **at most one `active` session** even under concurrent admin clicks. Sequential rejection (existing behavior) is preserved with a clear "already an active session" error.

### 4.4 Route alias
Add a redirect route `/personality` → `/personality-test` in `src/App.tsx` so the shorter URL resolves.

### 4.5 Auth emulator seeding
Add `web/scripts/seed-emulator.mjs` (runnable against the running emulator) that seeds:
- `admins/donovan.smith44@gmail.com` (allowlist entry; doc id is the lowercased email).
- Optionally a demo `active` session for hand-testing.

Document in `web/README.md`: start emulators, run the seed script, then sign in at `/admin` via the Google popup's "Add new account" → `donovan.smith44@gmail.com`. The emulator's fake account picker accepts any email; admin gating passes because the allowlist doc exists.

### 4.6 Orphaned-taker view ("your session has ended")
When a taker's bound session is **deleted or ended** out from under them, the result screen must not crash or show a stale/empty list. Instead, in place of the participant list, show a friendly **"Your session has ended"** message (the taker's own type/result and "read more" link still display). Detection: the taker's `sessionId` no longer resolves to an `active` session (doc missing, or `status !== 'active'`). This applies on both the live result screen (real-time listener observes the session disappear) and on a fresh revisit. `src/routes/Result.tsx` + the shared-list hook handle this state.

### 4.7 Joining a session late (session-less takers)
Today `sessionId` is captured at Begin and is immutable, so a taker who starts before any session exists is stranded session-less even if a session starts seconds later. New behavior so "people can do whatever they want":

- **Live signal:** takers subscribe to the singleton `meta/activeSession` pointer (§4.3) via a `useActiveSessionId()` hook to learn the currently-active session id in real time.
- **Auto-join (mid-test):** when a taker is `!completed`, `sessionId == null`, and an active session appears, the client silently binds them (`joinSession`) to that session. They continue testing and are grouped as a still-testing taker at the freeze (existing §8 behavior).
- **Opt-in join (finished):** a taker who *completed* while session-less sees a **"Join this session"** button on the result screen when a session is active; tapping it binds them, after which the normal sharing UI applies.
- **Invariant — bind once, never hop:** `joinSession` sets `sessionId` only when currently `null`, inside a transaction. Security rules permit a `takers` update to change `sessionId` only from `null` to a value (an already-set `sessionId` is immutable), preventing a taker from hopping between sessions.
- **Out of scope:** group assignment for a *finished* late-joiner who joins **after** the session already froze follows the existing §8 "after the freeze" rule and is not redesigned here.

## 5. Identity & continual access (confirmation of existing model)

No code change to identity. Restated for the test spec:
- Username = normalized (trimmed, lowercased) Firestore doc id in `takers`; uniqueness enforced by `create`-when-absent rules tied to anonymous `ownerUid`.
- Same device, same anonymous session → revisiting `/personality-test` auto-loads via localStorage: resume at first unanswered question, or jump straight to results if `completed`.
- A different device/UID entering an existing name is rejected → **"that name is already taken."**

## 6. BDD test plan

**Harness:** existing Playwright + Firestore/Auth emulator (`e2e/fixtures/`, `e2e/helpers/flows.ts`). Each test clears Firestore first. Multi-actor scenarios open **multiple `browser.newContext()`** instances so each actor has an independent anonymous UID; assertions verify live cross-context updates driven by Firestore real-time listeners. Admin scenarios use the existing `signInAdmin` OAuth-popup helper. Every scenario is written with `test.step('Given …')`, `test.step('When …')`, `test.step('Then …')`, `test.step('And …')`.

### 6.1 Taker flow & results — `e2e/share.spec.ts`, extend `smoke`/question specs
- **Share path:** Given a taker begins in an active session, When they answer all 32 and choose to share and submit, Then they see the session participant list And the sharing toggle is locked on (cannot opt out).
- **Private path:** Given a taker who chose not to share, Then no list is shown And the toggle is enabled; When they toggle sharing on, Then the list appears And the toggle locks.
- **Question count:** the flow presents exactly **32** questions.
- **Resume/continual access:** Given a taker mid-test on a device, When they reload, Then they resume at the first unanswered question; Given a completed taker, When they revisit, Then they land directly on results.
- **Empty username:** whitespace-only username is rejected, no taker created.
- **Case-insensitive identity:** `"Alice"` and `"alice"` resolve to the same taker.

### 6.2 Identity & uniqueness — extend `e2e/identity.spec.ts`
- **Name taken:** Given "alice" exists (one UID), When a second context begins "alice", Then it shows "that name is already taken."
- **Concurrent name race:** Given two contexts submit the same fresh name simultaneously, Then exactly one succeeds and the other gets the taken error.
- **Sharing irreversibility (rules):** Given a shared taker, When a `sharing: true→false` update is attempted, Then security rules reject it.

### 6.3 Session scoping & lifecycle — `e2e/session-scope.spec.ts`
- **Isolation:** Given sessions A and B each with sharers, Then an A-participant sees only A's sharers and never B's.
- **Lifecycle:** Given session A with sharers is deleted and session B is created with new sharers, Then B-participants cannot see A's results.
- **Session ended under a taker:** Given a taker on the result screen of session A (live), When the admin **ends or deletes** session A, Then the participant list is replaced by the **"Your session has ended"** message And the taker's own type/result still displays (no crash). Verified both live (real-time) and on a fresh revisit.
- **No active session:** Given no active session at Begin, Then the taker stays private with no list and cannot share.
- **Auto-join mid-test:** Given a taker who began with no active session and is still answering, When an admin starts a session, Then the taker is silently bound to it; When they finish and share, Then they appear in that session's list and roster.
- **Opt-in join after finishing:** Given a taker who finished while session-less, When a session is active, Then the result screen shows "Join this session"; When tapped, Then they bind and can share into it.
- **No hopping:** Given a taker already bound to session A, When a write attempts to change their `sessionId` to B, Then security rules reject it.

### 6.4 Concurrency / multi-actor — `e2e/concurrency.spec.ts`
- **Simultaneous takers:** Given multiple takers in one session testing at once, Then all complete And the shared list updates live as each opts in.
- **Asymmetric visibility under load:** Given concurrent takers where some share and some don't, Then only sharers appear in the list for everyone, consistently.

#### 6.4.1 Event-scale: 30+ devices, mixed activities — `e2e/scale.spec.ts`
Models the real event: a large crowd on **different devices** (independent anonymous UIDs) all doing **different things at once**. To stay fast and stable, use a **hybrid** harness: seed a "crowd" of ~30–40 takers directly via the emulator REST API (`seedTaker`) in assorted states, plus a handful (~4–6) of **live `browser.newContext()`** actors performing real interactions and assertions. The seeded crowd provides realistic list volume and contention; the live actors prove correctness from a real client's perspective.

- **Mixed-state crowd:** Given a session with ~30+ takers in mixed states — some mid-test, some completed+shared, some completed+private, some just-joined, some sitting on the result screen — Then each **live** actor sees a shared list containing **exactly** the completed+shared takers of **their** session (count and membership asserted), and never the private, mid-test, or other-session takers.
- **Live churn:** Given the 30+ crowd, When several actors opt in to share and others finish concurrently, Then every live actor's list converges to the correct membership via real-time listeners (no missing or duplicated rows, no cross-session leakage).
- **Two concurrent sessions at scale:** Given session A (~20 takers) and session B (~20 takers) running simultaneously, Then an A-actor and a B-actor each see only their own session's sharers, with zero overlap, under concurrent activity.
- **Name uniqueness under crowd load:** Given many concurrent joins, When two devices race the same fresh name, Then exactly one wins and the rest of the crowd is unaffected (no corrupted or duplicated `takers` docs).
- **Admin freeze during the storm:** Given the 30+ crowd mid-activity, When the admin triggers **reveal/freeze**, Then group assignment completes over the snapshot once And still-testing takers get their banner/assignment And the shared list remains correct for everyone afterward.

> Note: pure 30-way live browser contexts are flaky and slow; the spec mandates the seed-crowd + few-live-actors hybrid. If a future need for true N-device load testing arises, flag it — it belongs in a separate load harness, not the e2e suite.

### 6.5 Admin auth & session management — extend `e2e/admin.spec.ts`, `e2e/admin-auth.spec.ts`
- **Allowlisted admin:** can sign in and start a session.
- **Non-allowlisted Google user:** denied admin (UI gate + rules reject a session write).
- **Anonymous taker:** cannot write `sessions` (rules reject).
- **Concurrent start ×2:** Given two admin starts fire concurrently, Then at most one `active` session exists afterward (drives §4.3).
- **Sequential start blocked:** starting while one is active shows the "already active" error.
- **End → session-less:** after end, a new submission is `sessionId = null`.
- **Delete confirmation gate:** the delete modal requires typing **`DELETE`** exactly; a wrong/empty value does **not** delete (verify both the rejected and accepted paths).
- **Delete active vs ended:** deleting an **active** session clears the singleton pointer (a new session can then start); deleting an **ended/archived** session leaves no active pointer behind.
- **Roster correctness:** Given a mixed-state session, Then the admin roster shows **all** takers (username, type, Se rank, group, sharing on/off) — including private and mid-test ones — while takers themselves see only shared. Updates live as takers submit.
- **Group override persists:** Given an admin moves a taker between groups (`groupOverride = true`), When a recompute/rebalance runs, Then that taker is **not** moved.
- **Reveal-now / recompute:** admin can force `T = 0` early and rebalance latecomers, respecting overrides.
- **Rename / timer edit:** admin can rename a session and adjust `timerMinutes` before reveal; takers' live countdown reflects the change.
- **Archive:** an ended session can be archived (hidden from the main list, not deleted) and is not `active`.
- **Admin session-less safety:** with no active session, the admin UI offers "start" and does not error on an empty roster.
- Keep existing freeze-reveal, timer, and group-override specs.

### 6.6 Mobile a11y — extend `e2e/mobile.spec.ts`
- **Header contrast:** "Personality Test" h1 is `--teal` and passes WCAG AA contrast on a mobile viewport.
- Keep the existing question-text contrast check.

### 6.7 Routing — `e2e/routing.spec.ts`
Assert the app navigates as expected, not just that screens render in isolation.
- **Alias redirect:** visiting `/personality` lands on `/personality-test` (the §4.4 redirect).
- **Unknown route:** an unmatched path redirects to `/personality-test` (existing `*` catch-all).
- **Taker progression:** Given `/personality-test`, When a name is entered and Begin clicked, Then the question flow shows; When all 32 are answered and the sharing prompt resolved, Then the result screen shows — verify the in-app transitions (URL and/or rendered route state) at each step.
- **Admin gate:** visiting `/admin` while unauthenticated shows the sign-in gate, not the console; after admin sign-in the console renders; a non-allowlisted user is bounced from the console.
- **Deep-link revisit (continual access):** Given a completed taker on the same device, When they navigate to `/personality-test`, Then they land directly on their result (not the username form).

## 7. Implementation impact summary

| Area | File(s) | Change |
|---|---|---|
| Header | `src/routes/Landing.tsx` | explicit `color: var(--teal)` on h1 |
| Sharing UI | `src/routes/Result.tsx` | asymmetric, lockable toggle |
| Sharing rules | `firestore.rules` | block `sharing` `true→false` on taker update |
| Sharing data | `src/data/takers.ts` | guard `setSharing(false)` when already shared |
| Orphaned taker | `src/routes/Result.tsx` + shared-list hook | "Your session has ended" state when session no longer active |
| Single active | `src/data/sessions.ts` (+ rules) | singleton `sessions/_active` pointer in a transaction |
| Route | `src/App.tsx` | `/personality` → `/personality-test` redirect |
| Emulator seed | `web/scripts/seed-emulator.mjs`, `web/README.md` | admin allowlist + docs |
| BDD tests | `e2e/*.spec.ts`, helpers | scenarios in §6 |

## 8. Resolved decisions (previously open)

- **Orphaned taker:** shows an explicit **"Your session has ended"** message in place of the list; own result still displays (§4.6).
- **Single-active enforcement:** **singleton `sessions/_active` pointer** written/cleared inside a Firestore transaction (§4.3) — confirmed approach.
