# Spec — Session correctness, taker/admin UX, and comprehensive automated UI testing (2026-06-08)

App: `lcmsyoungadults/web` (React 19 + Vite + Firebase/Firestore). This spec defines (a) the
**target behaviors** that close the open bug sheet and the new requirements raised on
2026-06-08, and (b) the **automated testing system** that pins every one of those behaviors
down. It is the contract; the companion plan implements it test-first (red→green).

Source of truth for the bugs: `docs/superpowers/notes/2026-06-08-open-bugs-handoff.md`.

---

## 1. Goals & non-goals

**Goals**
- Make taker identity **browser-bound and usernames globally unique** — reusing an alias is
  impossible, and one browser can never inherit another's history.
- Make **session membership correct**: a taker belongs to the session that was active when
  they *began*, never one that starts mid-test; non-participants stay private.
- Surface the **right context to takers** (session name + a live, lockstep countdown) and to
  **admins** (session time remaining; a collapsible reveal/roster panel; clear override
  controls), and make admin writes actually work.
- Stand up a **layered automated test suite** (unit / data+rules / component / E2E) so every
  behavior here is asserted, including the cross-device, real-rules, and mobile cases the
  current mocked tests cannot reach.

**Non-goals**
- Retake-with-history. Dropped per decision 2026-06-08: the only "take again" path is **start
  over under a new, unique alias**.
- Production deploy (real Firebase project, custom domain) — remains Donovan-only, out of scope.
- Server-side scheduled freeze (Cloud Functions). Reveal stays admin-driven + timer-display.

---

## 2. Requirements (the testable contract)

Each requirement lists its **acceptance** (what a test must prove). IDs are referenced by the
plan and the scenario catalog (§5).

### R1 — Unique, browser-owned usernames
- The normalized (trimmed, lowercased) username is the unique taker key (`takers/{username}`).
- A taker doc carries **`ownerUid`** = the anonymous-auth `uid` of the browser that created it.
- **Begin flow:**
  - doc absent → create it, owned by the current uid;
  - doc exists & `ownerUid === myUid` → resume it;
  - doc exists & `ownerUid !== myUid` → **reject**: "That name's taken — choose another."
- `firestore.rules`: `create` only if the doc doesn't already exist **and**
  `request.resource.data.ownerUid == request.auth.uid`; `update`/`delete` only by the owner
  (admin may still update `group`/`groupOverride` — see R8).
- **Acceptance:** (rules) a second uid cannot create or write an existing username doc;
  (E2E) entering an in-use alias in a second browser context is refused with a visible message
  and shows **no** prior history.

### R2 — Start over / new test from results (closes #4)
- The result screen has a clearly-labeled **"Start over"** control that returns to the landing
  screen, clears the local username pointer, and lets the taker begin again under a new alias.
- The completed-resume effect must not bounce the user back to the result after they start over.
- **Acceptance:** (component + E2E) from a finished result, "Start over" → landing → begin with
  a different alias → fresh test.

### R3 — Correct session binding (supersedes #3; closes the mid-test recording bug)
- The session a taker belongs to is **captured at begin** (the active session at that instant)
  and stored on the taker doc as `sessionId`; it is **immutable** afterward.
- A taker who began with **no active session** has `sessionId = null` permanently. A session
  that starts later never captures them.
- `submitTest` binds using the taker's **own stored `sessionId`**, never the currently-active
  session.
- A `null`-session taker's result is **private**: it never appears in any roster or shared list
  (both query by `sessionId`), and is shown only to that taker.
- **Acceptance:** (data) begin with no active session → start a session → submit → taker's
  `sessionId` stays `null`; (data) begin during session A → submit → bound to A even if B is
  active by then; (E2E) a pre-session taker's result is visible to them but absent from the
  admin roster.

### R4 — Group placement for non-finishers
- At reveal/freeze, **every session participant** — including those who did not finish before
  the timer — is assigned a group (already handled by `freezeGroups` step 3) **and is shown the
  placement notification** in the taker UI.
- A non-participant (`sessionId = null`) is never grouped and sees only their own type.
- **Acceptance:** (domain — exists) incomplete participants get a group; (component + E2E) an
  unfinished participant sees the group notification once their session is frozen/ended/expired.

### R5 — Taker session context + lockstep countdown
- While taking the test the taker sees: (a) the **name** of the session they're in (matching
  the admin's session name), and (b) a **non-obtrusive but clearly-visible countdown** of time
  remaining.
- The countdown is computed from the **same** source the admin set (`session.startedAt` +
  `session.timerMinutes`) via `computeT`, so taker and admin are in lockstep.
- A taker with no session shows no countdown/name (just the test).
- **Acceptance:** (component) given a session doc, the question screen renders the session name
  and the `computeT`-derived minutes; (E2E) taker's displayed remaining minutes match the
  admin's for the same session within one tick.

### R6 — Admin sees session time remaining
- The admin session list shows time remaining for the active (timed, started) session, from the
  same `computeT` source.
- **Acceptance:** (component) the active session row shows the remaining minutes; (E2E) it
  counts down and reads the same value the taker sees.

### R7 — Admin reveal/roster panel can be minimized & closed
- The per-session reveal/roster display on the admin page is **collapsible** (minimize) and
  **dismissable** (close), without losing the underlying data subscription state semantics
  defined by selection.
- **Acceptance:** (component) toggling minimize hides/shows the roster body; close clears the
  panel; controls are reachable by accessible name.

### R8 — Group-override controls placement
- Manual per-taker group-override controls live in the roster, are intuitively placed next to
  each taker, and are clearly labeled.
- **Acceptance:** (component) each roster row exposes override controls by accessible name and
  invoking one calls the override op with the right `(username, group)`.

### R9 — Admin writes succeed (closes #7)
- Reveal now / Recompute / End / Delete succeed for an allowlisted admin; the error banner
  appears only on genuine failure.
- Root cause to be confirmed by an E2E reproduction against real rules before fixing; the fix
  must guarantee `auth.currentUser` is the email-bearing admin before any admin write (the
  deterministic-identity work from the prior fix, extended if the repro shows it insufficient —
  e.g., await auth settling / token refresh after Google sign-in).
- **Acceptance:** (E2E) signed-in admin clicks Reveal → session gains `groupsFrozenAt` and
  roster groups populate; End → status `ended`; Recompute → groups recomputed; a forced denial
  surfaces the banner.

### R10 — Mobile-readable question (closes #8)
- Question text is the brand teal (`--teal #01404f`) at a mobile-legible weight; the variable
  font is verified to load (or a static-weight fallback ships).
- **Acceptance:** (E2E mobile project) the `<h2>` computed color is the teal and contrast vs.
  its background meets WCAG AA (≥ 4.5:1); the text is visible at a mobile viewport.

### R11 — No premature reveal (regression for #2)
- A fresh timed session shows the countdown and never reveals the group early; reveal happens
  only on timer expiry or admin reveal.
- **Acceptance:** (E2E) start a 30-min session, finish quickly → result shows "check back",
  never the group, and the session's `groupsFrozenAt` stays unset until admin/expiry.

---

## 3. Design changes (implementation surface)

Kept intentionally close to existing structure; follows current patterns.

### 3.1 Identity & ownership (R1, R3)
- `data/takers.ts`:
  - `upsertTaker(db, username, { ownerUid, sessionId })` → on create, write `ownerUid` and the
    **joined** `sessionId` (active session at begin, or null). Claim check: if the doc exists
    and `ownerUid` differs, throw a typed `UsernameTakenError`.
  - `TakerDoc` gains `ownerUid: string`.
- `auth/takerAuth.ts`: expose the resolved `uid` (it already returns the `User`).
- `routes/TestApp.tsx`: `onBegin` awaits `ensureAnonymous()`, passes `uid` + the active
  session id into `upsertTaker`; surfaces `UsernameTakenError` as an inline landing message.
- `data/submit.ts`: drop the `activeSessionId` parameter; read the taker's stored `sessionId`
  and bind to that (immutability). Latecomer grouping keys off the taker's own session.
- `firestore.rules`: tighten `takers/{username}` to create-once + owner-write (+ admin group
  override). Add `ownerUid` invariants.

### 3.2 Taker context & countdown (R5, R4, R2)
- `routes/Question.tsx`: add a compact header showing session name + remaining minutes (props
  fed from `TestApp` using the taker's own session via `useSession`). Non-obtrusive placement
  (top bar near the progress row).
- `routes/Result.tsx`: add **"Start over"** control (calls `goLanding`). Surface the group
  notification for participants whose session has revealed even if they didn't finish (R4).
- `routes/TestApp.tsx`: feed session name + countdown to `Question`; guard completed-resume so
  "Start over" sticks.

### 3.3 Admin UX (R6, R7, R8, R9)
- `routes/admin/SessionList.tsx`: show remaining minutes for the active started session
  (`computeT` + a shared `useNow`).
- `routes/admin/AdminPage.tsx` / `Roster.tsx`: wrap the selected-session roster/reveal in a
  **collapsible, closable panel**; ensure override controls are per-row and labeled.
- Admin-write determinism (R9): confirmed via E2E repro first; fix in `auth/adminAuth.ts` /
  `useIsAdmin` as the repro dictates.

### 3.4 Styling (R10)
- `routes/Question.tsx` / `ui/theme.css`: explicit `color: var(--teal)` and legible weight for
  the question; verify variable-font load on mobile or add a static fallback `@font-face`.

---

## 4. Test architecture (the core deliverable)

A four-layer pyramid. Layers 1–3 exist and expand; layer 4 is new.

1. **Domain unit** — `vitest`, pure functions (`domain/*`). Fast, no I/O.
2. **Data + rules** — `vitest` + `@firebase/rules-unit-testing` against the Firestore emulator
   (`src/data/*`, `data/rules.test.ts`). Runs via `npm run test:rules`
   (`firebase emulators:exec ... "vitest run src/data"`). Proves ownership/binding/uniqueness
   rules (R1, R3) and grouping persistence (R4).
3. **Component** — `vitest` + React Testing Library in jsdom, Firebase/hooks mocked
   (`routes/*`, `ui/*`). Proves UI logic & wiring (R2, R5, R6, R7, R8) without a browser.
4. **End-to-end** — **`@playwright/test`** (NEW) driving real Chromium against
   `vite dev` + the Firebase emulator. Proves the things only a real browser + real rules can:
   cross-device isolation (R1/R3), admin writes under real rules (R9), mobile rendering/contrast
   (R10), lockstep timers (R5/R6), and the no-premature-reveal regression (R11).

### 4.1 Playwright setup
- Add dev deps: `@playwright/test`.
- `web/playwright.config.ts`:
  - `webServer`: start Vite (`npm run dev`) with `VITE_USE_EMULATOR=1`; `reuseExistingServer`
    locally.
  - `projects`: `desktop-chromium` (default viewport) and `mobile-chromium`
    (`devices['Pixel 7']`) — the mobile project carries R10.
  - `baseURL`, traces/screenshots on failure.
- **Emulator orchestration:** run the suite wrapped so the emulator is up:
  `npm run test:e2e` = `firebase emulators:exec --project demo-lya "playwright test"`.
- `web/e2e/` directory holds specs + fixtures.

### 4.2 Fixtures & helpers (`web/e2e/fixtures/`)
- `clearFirestore()` / `clearAuth()` — emulator REST (`DELETE .../emulator/v1/...`), run before
  each spec for isolation.
- `seedSession({ name, timerMinutes, status, startedAt })` and `seedAdmin(email)` — seed via the
  emulator REST API with `Authorization: Bearer owner` (bypasses rules), mirroring the dev
  reseed flow documented in the handoff.
- `newTaker(context)` — opens a fresh browser **context** (own storage/auth) so cross-device
  sims are real isolation; helper to begin a test with an alias.
- `signInAdmin(page, email)` — drives the **Auth-emulator** Google popup (the emulator renders
  an account picker / add-account form the test fills), with `admins/<email>` pre-seeded. No
  test-only production hooks.

### 4.3 CI
- `package.json` scripts: keep `test` (unit+component), `test:rules`; add `test:e2e` and a
  `test:all` aggregator.
- Optional GitHub Actions workflow (Node + Java for the emulator + Playwright browsers) — marked
  optional; the local `test:all` is the gate.

---

## 5. Scenario catalog (E2E → requirement map)

| # | Scenario | Project | Proves |
|---|----------|---------|--------|
| E1 | Taker happy path: begin → answer 32 → result | desktop | smoke, R2 base |
| E2 | Resume on refresh mid-test | desktop | resume |
| E3 | Start over from result → new alias → fresh test | desktop | R2 |
| E4 | Same alias in a 2nd context is refused, shows no history | desktop ×2 ctx | R1, R3 |
| E5 | Pre-session taker: begin (no session) → admin starts session → submit → not in roster, visible to taker | desktop ×2 ctx | R3 |
| E6 | Mid-session taker bound to the session active at begin, not a later one | desktop ×2 ctx | R3 |
| E7 | Unfinished participant gets group notification after reveal | desktop ×2 ctx | R4 |
| E8 | Taker sees session name + countdown; matches admin's remaining time | desktop ×2 ctx | R5, R6 |
| E9 | Admin Reveal/Recompute/End/Delete succeed under real rules | desktop | R9 |
| E10 | Admin error banner on a forced denial | desktop | R9 |
| E11 | Admin reveal/roster panel minimize & close | desktop | R7 |
| E12 | Admin per-row group override changes a taker's group | desktop | R8 |
| E13 | Mobile question text is teal + AA contrast + visible | mobile | R10 |
| E14 | Fresh 30-min session: result shows countdown, never early group | desktop | R11, R2 |

Component/data/rules tests cover the same R's at lower layers (faster feedback); E2E is the
end-to-end proof. Every R in §2 has at least one automated test.

---

## 6. Risks & decisions
- **Global username uniqueness** (R1) means an alias is single-use **forever** unless its taker
  doc is cleared between events. Accepted for now; cleanup between events can wipe `takers`
  (documented in the handoff dev notes). Per-session uniqueness is a future option if needed.
- **Admin popup automation** against the Auth emulator can be brittle across emulator versions;
  fixture isolates it behind `signInAdmin` so a change touches one place.
- **Emulator clock vs browser clock** affects countdown *display* only (no client writes after
  the freeze-fallback removal); E2E asserts taker/admin agreement, not absolute wall-clock.
- **R9 root cause** is confirmed by E2E repro before the fix is finalized; the fix may be larger
  than the prior deterministic-identity change if the repro shows auth still settles late.

---

## 7. Out-of-scope / explicitly dropped
- Retake history (R-dropped). Past-attempt browsing UI. Server-side scheduled reveal.
  Production deployment. Non-Firestore storage. Visual snapshot baselining beyond the R10
  contrast/visibility check (can be added later).
