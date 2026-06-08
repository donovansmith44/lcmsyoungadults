# Test-Taker UI — bugs & design feedback (2026-06-08)

Captured from live review of the Plan-2 test-taker UI. Items are grouped as **bugs**
(wrong behavior) vs **design** (looks/UX). These drive a redesign pass + fixes.

## Bugs

1. **Refresh loses your place → dumps you back to the username/landing screen.**
   `username` lives only in React state (`TestApp`), so a page refresh resets it to
   `null` and the flow restarts at Landing. Expected: refreshing keeps you on the
   same screen — mid-test resumes at your current question; a finished taker resumes
   on their result. Fix: persist the username (e.g. `localStorage`) and rehydrate on
   load; the taker doc already holds answers/completion for the rest of the resume.

## Design — Result screen

2. **Type should be BIG, in brand teal.** Right now the type (e.g. `INTP`) is folded
   into the headline at ~1rem. It should be the hero of the screen: large Montserrat
   letters in `--teal (#01404f)`.
3. **The "…indicate that you are an" sentence is too small for no reason.** Give the
   result copy a readable size.
4. **"To read more, click here:" is redundant.** Replace the whole line with a single
   hyperlink reading **"Read more about {TYPE}"** — and drop the trailing "→".

## Design — Question screen

5. **"statement A ↔ statement B" doesn't fit on mobile** (and shows the poles twice).
   Reframe each item as a natural question, e.g. **"Are you more energetic or more
   mellow?"**, with the two poles as the ends of a single "lean" bar (5 points).
6. **Left/right ordering convention (number-line model).** Treat each trait pair as a
   signed number line: one pole is `−` (left), the other `+` (right). The pole named
   **first** in the question goes on the **left** side of the lean bar; the second pole
   goes right. (Open question to confirm with Donovan: map `−`/left to the OEJTS item's
   existing `left` pole = answer value 1, and `+`/right to `right` = value 5, so the
   convention is consistent and needs no per-item judgment. Note: the spoken example
   "energetic or mellow" had the order reversed from the "mellow is −" aside — resolving
   in favor of "first-in-question = left".)
7. **Auto-advance on answer, with a Back control** to revise the previous question.

## Design — whole flow

8. **Overall visual overhaul, landing → question → result**, following
   16personalities.com principles (clean single column, generous whitespace, large
   readable type, a soft color-coded scale, smooth auto-advance, mobile-first) — but
   in the LYA brochure identity: teal `#01404f`, pink `#fad5cd`, pink-deep `#f5bbb0`,
   cream `#fff8f2`, Montserrat (display/body) + Cormorant Garamond (italic accents),
   church logo. Brochure fonts/logo now vendored at `web/public/brand/`.

## Environment notes (not app bugs)

- Phone access over LAN is blocked by Windows Firewall (Wi-Fi profile = Public, no
  inbound allow rule for 5173/8080/9099). Needs an elevated allow rule or switching
  the profile to Private. App + emulators are already bound to `0.0.0.0`, and
  `firebase.ts` now derives the emulator host from `window.location.hostname` so LAN
  access works once the firewall is opened.
