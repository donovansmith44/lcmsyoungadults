# Personality Test — open bugs & handoff (2026-06-08)

Written before a context clear. Covers the live-known **open** bugs, what's **recently
fixed** (verify), and **dev/env notes** so work can resume cold. App lives in this repo
(`lcmsyoungadults`) under `web/`.

---

## ✅ RESOLVED — 2026-06-08 round 2 (branch `feat/session-correctness-and-ui-testing`, TDD)

All round-2 reports below are **fixed and covered by automated tests** (unit + component +
emulator rules + Playwright E2E). Spec: `docs/superpowers/specs/2026-06-08-session-correctness-and-automated-ui-testing-design.md`;
plan: `docs/superpowers/plans/2026-06-08-session-correctness-and-automated-ui-testing.md`.

| Report | Fix | Proven by |
|--------|-----|-----------|
| #4 no "start over" from result | "Start over" → landing (`Result`/`TestApp`) | component + E2E **E3** |
| #5 retake | dropped (per decision); redo = new unique alias via start-over | E2E **E3** |
| usernames unique / browser-bound (#6) | `ownerUid` + create-once/owner-write rules; claim refused for a different browser | rules tests + E2E **E4** |
| #6 cross-device inheritance | identity = anonymous uid; same alias on a 2nd browser refused, no shared history | E2E **E4** |
| session binding correctness (#3) | session captured at **begin** (one-shot `getActiveSession` after auth), immutable; pre-session takers stay private | data tests + E2E **E5/E6** |
| non-finishers get group | reveal banner driven by taker's own session | E2E **E7** |
| taker session name + lockstep countdown | `Question` header from taker session via shared `computeT`/`startedAt` | component + E2E **E8** |
| admin time remaining | `SessionList` "N min left" | component + E2E **E8** |
| #7 admin writes do nothing | resolved by deterministic admin identity (sign out anon before Google popup); confirmed under real rules | E2E **E9/E10** |
| admin roster minimize/close | collapsible panel | component + E2E **E11** |
| admin group-override placement | labeled per-row buttons; pass doc id (`r.id`) | component + E2E **E12** |
| #8 mobile question unreadable | explicit brand teal `.q-text` + font fallback | E2E **E13** (computed color + 11.4:1 contrast) |
| #2 premature reveal (regression) | client never freezes; reveal on expiry/admin only | E2E **E14** |

**Tests (green):** 110 vitest (unit/component/emulator) + 14 Playwright E2E (desktop) + 1 mobile.
`tsc` clean; `npm run build` OK. Lint: 8 **pre-existing** errors only (subscription-hook
`set-state-in-effect` ×7 + one `freeze.test` `any`); this work added none.

**Run E2E:** emulators must be up, then `npm run test:e2e` (or `test:e2e:ci` which self-starts
them). Admin E2E drives the Auth-emulator Google popup via `signInAdmin` in `e2e/helpers/flows.ts`.

**Still pending:** production deploy (Donovan-only). Global username uniqueness is forever
unless `takers` is cleared between events (accepted trade-off — see spec §6).

---

## OPEN BUGS (historical round-2 detail — all now RESOLVED above)

### NEW REPORTS — 2026-06-08 (round 2, from on-device testing)

#### 4. No "start over / back to landing" from the results page
- **Symptom:** from the test **results** page there's no way to return to the landing page,
  so you can't redo a test under a different alias.
- **Where:** `routes/Result.tsx` has no exit control. `routes/TestApp.tsx` already has a
  `goLanding()` (clears `lya.personality.username` + resets state) wired to the **Question**
  screen's `onExit` ("↺ Start over"), but it is **not** passed to `Result`. Also the
  `taker?.completed && phase === 'test' → result` effect forces a completed taker back to the
  result screen.
- **Fix direction:** add a "Start over / New test" action on `Result` that calls
  `goLanding()`; make sure the completed-resume effect doesn't immediately bounce back to the
  result after leaving.

#### 5. Can't retake a test
- **Symptom:** once a taker has completed, there's no way to retake.
- **Where:** a completed taker always resumes to `result`; answers persist in
  `/takers/{username}`, so re-entering the same alias just reopens the old result.
- **Fix direction (product decision):** a "Retake" action that either resets the same taker
  doc (clear `answers`/`completed`/`type`/`group`/scores) or starts a fresh attempt. Decide
  how it interacts with aliases, sessions, and identity (#6) and the orphan/binding rules (#3).

#### 6. History is inherited across devices — sessions should be BROWSER-bound
- **Symptom:** opening the app on the desktop browser inherits the **phone's** test history.
- **Root cause:** taker identity is the **username** — docs live at `/takers/{username}` under
  the "username-only trust model" (`firestore.rules`). Any device that enters the same alias
  reads the same doc → shared history. `localStorage` only remembers the alias per browser; it
  does **not** isolate identity. So this is alias collision, not a sync bug.
- **Fix direction:** make identity **browser-bound** — derive a per-browser id (random local
  id, or the anonymous-auth `uid`) and key takers by it (or namespace the display name under
  it) so a new browser starts fresh even with the same display name. Touches `data/takers.ts`,
  `TestApp`, `firestore.rules`, the roster, and grouping. Significant — needs design first.

#### 7. Admin actions (Reveal now / Recompute / End / Delete) still do nothing
- **Symptom:** the admin action buttons have **no effect** on either in-progress (active) or
  ended sessions.
- **Relation:** this is open bug **#1** (admin-write auth). A working-tree fix shipped
  (deterministic admin identity — see FIXED #1 below) but is **unverified live / not deployed**,
  and the failure is still observed. Treat #1 as **NOT yet confirmed fixed**.
- **Investigate live:** confirm the signed-in identity carries `email` (admin header shows it;
  grep `firestore-debug.log` for `PERMISSION_DENIED` / "Property email is undefined"); confirm
  the error banner surfaces (`runAdmin` → `reportAdminError` → `AdminPage`); confirm the
  button `onClick` actually fires; confirm the Google sign-in **replaced** the anonymous
  session. If writes still go as anonymous, extend the fix (e.g., force a reload/re-auth after
  Google sign-in so `auth.currentUser` is unambiguous before any admin write).

#### 8. Mobile question font is unreadable — use the agreed blue text
- **Symptom:** on mobile the **question** text is unreadable. It should use the agreed
  blueish text from the brand color schema.
- **Where:** `routes/Question.tsx` `<h2>` has **no explicit `color`** (it inherits the body
  `color: var(--teal)`) and renders Montserrat at weight 600 via the **variable** font.
  `theme.css` palette: `--teal: #01404f` is the agreed blue.
- **Candidate causes:** low contrast against the pink→cream gradient on small screens; the
  variable font (`truetype-variations`) weight not applying on some mobile browsers (text
  renders too thin/heavy/wrong); or an inherited color being overridden.
- **Fix direction:** set the question text explicitly to `var(--teal)` with a mobile-legible
  weight/size, and verify the variable font loads on-device (or ship a static-weight
  fallback). Confirm on a real phone.

### 3. (Minor) Orphaned/incomplete takers
- `juan` taker: `completed=false`, `sessionId=null` — a started-but-unbound taker. Not
  harmful; note for roster/cleanup semantics. (sessionId binds only at `submitTest`, so any
  in-progress/off-session taker is sessionId-less and never appears in a session roster.)
- **Not a behavioral defect** — left open pending a product decision: bind `sessionId` at
  start vs. submit, hide/label orphans in the roster, or a cleanup tool. No fix shipped.

---

## FIXED 2026-06-08 (TDD; tests in repo — verify)

### 1. Admin writes silently fail — **RESOLVED & verified** (see RESOLVED round 2, #7)
> ✅ Confirmed under real Firestore rules by Playwright E2E (E9/E10): an allowlisted admin's
> Reveal/End/Recompute/override all succeed; no error banner. The deterministic-identity fix
> (sign out the anonymous session before the Google popup) was sufficient.
- **Root cause:** the browser shares one Firebase Auth between the anonymous taker flow and
  the Google admin sign-in; admin clicks could execute as the email-less anonymous user.
- **Fix:** (a) `signInWithGoogle` now signs out an existing **anonymous** session before the
  Google popup, so the admin identity replaces it cleanly (`auth/adminAuth.ts`;
  `auth/adminAuth.test.ts`). (b) `TestApp` no longer signs in anonymously on bare page load —
  `ensureAnonymous()` runs only inside the taker flow (when a username is entered/restored),
  and is awaited *before* the first taker-doc write (`routes/TestApp.tsx`; tests in
  `routes/TestApp.test.tsx`). This stops the stray anonymous identity that clobbered admin.
- **Verify:** sign in on `/admin`, click Reveal/End/Recompute; confirm writes carry `email`
  in `firestore-debug.log` (no more "Property email is undefined").

### 2. Premature group reveal — FIXED (client no longer freezes)
- **Root cause:** the client-side **freeze-fallback** in `TestApp` wrote `groupsFrozenAt`
  off the browser's local clock. Freezing is a sessions write (admin-only by the rules), so
  it only ever "succeeded" when the taker's browser was sharing the admin's Google auth
  (bug #1) — and then froze fresh sessions ~30s in (clock skew), revealing groups early.
- **Fix:** removed the client-side freeze-fallback entirely. Freezing is now owned solely by
  the admin "Reveal now"/"End" actions; the taker's reveal logic is read-only (timer expiry
  / admin reveal). Regression test: the client never calls `freezeSessionGroups` even when
  its local timer reads 0 (`routes/TestApp.test.tsx`).
- **Verify:** with the admin-auth fix in place, a fresh 30-min session shows a 30-min
  countdown end-to-end and only reveals on timer expiry or admin reveal.

---

## RECENTLY FIXED (shipped to `main`; verify after clearing context)
- Result countdown/reveal follows the **taker's own session**, not the globally-active one
  (`useSession` + `TestApp`; tests in `routes/TestApp.test.tsx`).
- Admin **"End" freezes-then-ends** (assigns groups) (`SessionList`; test).
- **`useSessions` lists every session** incl. `startedAt`-less ones — removed the
  `orderBy('startedAt')` that hid them (was the "already an active session when I don't see
  one" bug; tests in `hooks/useSessions.test.ts` + `data/sessionsList.test.ts`).
- Stuck **"Loading…"** → "Start a new test" escape when the stored taker doc is missing
  (`useTaker` loading flag + `TestApp`; test).
- **Buzzer share-prompt** ("share, then keep going") on timer expiry (`TestApp`; test).
- Multi-user sim test (distinct types + sharing visibility): `data/multiUser.test.ts`.
- Landing fonts restored to **locally-vendored** Montserrat/Cormorant (no CDN) —
  `ui/theme.css` `@font-face` from `/brand/fonts`.
- "↺ Start over" on the question screen; share-prompt italics removed; result type big/teal
  + single "Read more about {TYPE}" link; lean-bar question UI; resume-on-refresh.

---

## DEV / ENVIRONMENT NOTES
- **Run dev:** from `web/` — `npm run dev` (Vite :5173, HMR) + `firebase emulators:start
  --only firestore,auth --project demo-lya` (needs Java: portable JDK at
  `C:\Users\donov\jdk21\jdk-21.0.11+10` on PATH). Emulator UI at http://127.0.0.1:4000.
  `web/.env.local` has `VITE_USE_EMULATOR=1`, project `demo-lya`.
- **Emulator data is in-memory.** Running the `src/data` (emulator) tests calls
  `clearFirestore()` → **wipes the dev data**. After running them, re-seed via the emulator
  REST API with header `Authorization: Bearer owner` (bypasses rules): an active session doc
  + `admins/<lowercased-email>` docs. A stale active session left by a test run caused bug
  "already an active session" — always clear+reseed, don't reseed on top of leftovers.
- **Admin allowlist** seeded: `admins/donovan.smith44@gmail.com`,
  `admins/donovan@lcmsyoungadults.org`. Sign in on `/admin` via the auth-emulator Google
  popup using one of those emails.
- **Phone/LAN:** firewall rule "LYA dev ports" allows inbound TCP 5173/8080/9099 on
  LocalSubnet (created elevated). App on phone: http://192.168.1.53:5173 . `firebase.ts`
  derives the emulator host from `window.location.hostname` so LAN clients reach the emulator.
- **Tests (last green):** 60 non-emulator + 20 emulator. Non-emulator:
  `npx vitest run src/ui src/hooks src/routes src/domain`. Emulator: run `src/data` against a
  running emulator (or via `firebase emulators:exec ... --project demo-lya`).
- **All 3 build plans (foundation, test-taker UI, admin UI) are implemented.** Production
  DEPLOY (real Firebase config, enable Google+Anonymous auth, seed first admin, `firebase
  deploy`, custom domain) is still pending and Donovan-only.
