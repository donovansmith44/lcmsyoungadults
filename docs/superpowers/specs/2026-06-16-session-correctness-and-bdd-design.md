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
**Fix:** make session creation enforce uniqueness atomically. Preferred approach: a **singleton pointer** — a well-known doc `sessions/_active` (or a `meta/activeSession` doc) written inside a Firestore `runTransaction` that fails if a pointer already exists; clearing it on end/delete. Alternative: a transaction that re-queries within the transaction. Whichever is chosen, the rules and data layer must guarantee **at most one `active` session** even under concurrent admin clicks. Sequential rejection (existing behavior) is preserved with a clear "already an active session" error.

### 4.4 Route alias
Add a redirect route `/personality` → `/personality-test` in `src/App.tsx` so the shorter URL resolves.

### 4.5 Auth emulator seeding
Add `web/scripts/seed-emulator.mjs` (runnable against the running emulator) that seeds:
- `admins/donovan.smith44@gmail.com` (allowlist entry; doc id is the lowercased email).
- Optionally a demo `active` session for hand-testing.

Document in `web/README.md`: start emulators, run the seed script, then sign in at `/admin` via the Google popup's "Add new account" → `donovan.smith44@gmail.com`. The emulator's fake account picker accepts any email; admin gating passes because the allowlist doc exists.

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
- **Lifecycle:** Given session A with sharers is deleted and session B is created with new sharers, Then B-participants cannot see A's results; And an A-participant's post-deletion view is verified (defined behavior: session-scoped list no longer resolves).
- **No active session:** Given no active session at Begin, Then the taker stays private with no list and cannot share.

### 6.4 Concurrency / multi-actor — `e2e/concurrency.spec.ts`
- **Simultaneous takers:** Given multiple takers in one session testing at once, Then all complete And the shared list updates live as each opts in.
- **Asymmetric visibility under load:** Given concurrent takers where some share and some don't, Then only sharers appear in the list for everyone, consistently.

### 6.5 Admin auth & session management — extend `e2e/admin.spec.ts`, `e2e/admin-auth.spec.ts`
- **Allowlisted admin:** can sign in and start a session.
- **Non-allowlisted Google user:** denied admin (UI gate + rules reject a session write).
- **Anonymous taker:** cannot write `sessions` (rules reject).
- **Concurrent start ×2:** Given two admin starts fire concurrently, Then at most one `active` session exists afterward (drives §4.3).
- **Sequential start blocked:** starting while one is active shows the "already active" error.
- **End → session-less:** after end, a new submission is `sessionId = null`.
- **Delete:** typing `DELETE` removes the session; roster/taker behavior verified.
- Keep existing freeze-reveal, timer, and group-override specs.

### 6.6 Mobile a11y — extend `e2e/mobile.spec.ts`
- **Header contrast:** "Personality Test" h1 is `--teal` and passes WCAG AA contrast on a mobile viewport.
- Keep the existing question-text contrast check.

## 7. Implementation impact summary

| Area | File(s) | Change |
|---|---|---|
| Header | `src/routes/Landing.tsx` | explicit `color: var(--teal)` on h1 |
| Sharing UI | `src/routes/Result.tsx` | asymmetric, lockable toggle |
| Sharing rules | `firestore.rules` | block `sharing` `true→false` on taker update |
| Sharing data | `src/data/takers.ts` | guard `setSharing(false)` when already shared |
| Single active | `src/data/sessions.ts` (+ rules) | transactional/singleton-pointer enforcement |
| Route | `src/App.tsx` | `/personality` → `/personality-test` redirect |
| Emulator seed | `web/scripts/seed-emulator.mjs`, `web/README.md` | admin allowlist + docs |
| BDD tests | `e2e/*.spec.ts`, helpers | scenarios in §6 |

## 8. Open assumptions

- Post-deletion view for an orphaned taker: their session-scoped shared list simply no longer resolves (no crash); their own type/result still displays. Confirm during implementation if a friendlier message is wanted.
- Single-active enforcement uses a singleton pointer doc unless implementation finds a cleaner transactional query; either satisfies the invariant.
