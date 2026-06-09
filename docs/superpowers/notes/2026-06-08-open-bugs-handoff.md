# Personality Test — open bugs & handoff (2026-06-08)

Written before a context clear. Covers the live-known **open** bugs, what's **recently
fixed** (verify), and **dev/env notes** so work can resume cold. App lives in this repo
(`lcmsyoungadults`) under `web/`.

---

## OPEN BUGS (need fixing)

### 1. Admin writes (Reveal now / Recompute / End / Start / Delete) silently fail
- **Symptom:** clicking admin-page action buttons "does nothing."
- **Evidence:** `web/firestore-debug.log` shows `PERMISSION_DENIED` with
  *"Property email is undefined"* (rules line 9) — i.e. the write reaches Firestore as an
  **anonymous identity with no `email` claim**, so `isAdmin()` denies it. (≈9 denials logged.)
- **Why:** the same browser runs BOTH the anonymous taker flow (`ensureAnonymous()` in
  `TestApp`) and the Google admin sign-in. On one origin they share a single Firebase Auth,
  so admin clicks can execute as the anonymous user.
- **Already shipped (partial):** error banner on failures + signed-in identity shown in the
  admin header (`AdminPage`), "Sign in with Google" offered from any guest/non-admin state
  (`AdminGate`), and an email-safe `isAdmin()` rule (`firestore.rules`). When the admin IS
  genuinely Google-authed, writes succeed (a session did get frozen — see bug #2).
- **To fix:** make the admin identity deterministic. Options: on `/admin` require an explicit
  Google sign-in that REPLACES any anonymous session (sign out anonymous first); don't call
  `ensureAnonymous()` until a taker actually starts a test (reduce clobbering); and make the
  error banner unmissable. Verify post-sign-in writes carry `email` via `firestore-debug.log`.

### 2. Result reveals the group immediately instead of counting down
- **Symptom:** set timer to 30 min, finish the test → result jumps straight to the group
  instead of "Check back in 30 minutes."
- **Evidence:** session `9dq4WOnswATZ2F9IKZWe` (timer 30, started 00:52:30Z) had
  `groupsFrozenAt` set at **00:53:02Z — ~32s later**. The result reveal condition in
  `TestApp` includes `takerSession.groupsFrozenAt != null`, so it reveals.
- **Root-cause candidates:**
  - (a) The admin "Reveal now" actually SUCCEEDED and froze the session (reveal is then
    technically correct but unintended). Tension with bug #1 — would mean the admin was
    authed at that click. Check whether the freeze came from the admin.
  - (b) The client **freeze-fallback** effect in `TestApp` mis-fired: it calls
    `freezeSessionGroups` when the active session's `computeT(...) === 0`. Investigate
    `sessionStartMs()` against a REAL Firestore `serverTimestamp` and browser-vs-emulator
    clock skew — a transient `t === 0` would auto-freeze a fresh 30-min session.
- **To fix:** determine the freeze source. Strongly consider REMOVING the client-side
  freeze-fallback entirely (let timer expiry + admin reveal drive it, ideally server-side),
  or hard-guard it. Confirm a fresh 30-min session shows a 30-min countdown end-to-end.

### 3. (Minor) Orphaned/incomplete takers
- `juan` taker: `completed=false`, `sessionId=null` — a started-but-unbound taker. Not
  harmful; note for roster/cleanup semantics.

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
