# Domain & Path Resolution — Recovered Spec (LYA "Personality Day" app)

**Date:** 2026-06-16
**Status:** Reconstructed from prior transcripts + committed specs. Not user-confirmed.
**Confidence:** **Medium** (see Source note).

---

## Source note

Mined the following Claude Code transcripts and the committed design specs they produced:

| Source | Date | What it yielded on domain/path |
|---|---|---|
| `…\projects\C--Users-donov-Documents-lcmsyoungadults\ccc040e3-e468-4d2d-8c2e-511eb635ad31.jsonl` (2.9 MB, foundation session) | 2026-06-08 | Produced the **2026-06-08 design spec** below. No additional free-form user prose on domains beyond what the spec captures; the in-transcript hits for `domain`, `/personality`, `rewrite` were either (a) the spec/handoff docs themselves, (b) the SPA `**→/index.html` rewrite in `firebase.json`, or (c) noise (TDD's "validates email and domain", "delete and rewrite"). |
| `…\projects\C--Users-donov-Documents-lcmsyoungadults\55856d06-…88.jsonl` | 2026-06-10 | **Nothing** on domain/path. The two keyword hits were unrelated (a deep-research task about an air conditioner). |
| `…\projects\C--Users-donov-Documents-personality-router\70ad9cf3-…31.jsonl` | 2026-05-22 (Flask/FastAPI prototype) | **No user-side routing/domain discussion.** Despite the project name "personality-router," no user message in it discusses subdomains, reverse proxy, rewrites, multi-app routing, or path resolution. |

I deliberately did **not** read these multi-MB files wholesale; I used targeted ripgrep + narrow `sed`/JSON extraction around the strongest hits.

**Why "medium" not "high":** The domain/path **decisions are real and were captured in a committed, "Approved for planning" spec** — but I found **no verbatim user message** in the transcripts where the user types out the domain or path in their own words. The wording in the specs is the assistant's, synthesizing an approved design. So the *decisions* are well-grounded; the exact *phrasing* below is the spec author's, not a direct user quote, except where noted. There is also a **newer, more detailed treatment** in the committed `2026-06-16-production-hosting-design.md` (assistant-authored "design spec only — nothing implemented"), which supersedes the 2026-06-08 sketch on hosting specifics.

---

## Reconstructed domain + path-resolution spec

### A. Domain

- **Production domain:** `lcmsyoungadults.org` — the Lutheran Young Adults (LYA) website.
  - From the 2026-06-08 design spec §3 (Approved for planning):
    > "Custom domain `lcmsyoungadults.org` (test under a clean path, e.g. `/personality-test`)."
- **Subdomain:** *Not fixed by the user.* The 2026-06-08 spec assumed the test lives on the **apex** under a path. The later 2026-06-16 production-hosting spec (§7) **proposes** a subdomain as the nicer option but does not finalize it:
  > "Subdomain (recommended), e.g. `personality.lcmsyoungadults.org` or `app.lcmsyoungadults.org` … The full taker URL becomes e.g. `https://personality.lcmsyoungadults.org/personality-test`."
  - That same spec lists the default Firebase domains `https://lcms-young-adults.web.app` / `.firebaseapp.com` as the **zero-DNS fallback** for event day.
- **Project alias:** `web/.firebaserc` pins `lcms-young-adults` (hyphenated) as the Firebase project id — distinct from the emulator-only `demo-lya`.

### B. Path where the test lives

- **Canonical taker path:** **`/personality-test`** (2026-06-08 §3, §4, and implemented in `web/src/App.tsx`).
  - `web/src/App.tsx` routes (current code):
    - `/personality-test` → `<TestApp />`
    - `/admin` → `<AdminPage />`
    - `*` → redirect to `/personality-test`
  - 2026-06-08 §4 also defines `/personality-test/results` (returning view + shared list; "may be folded into the post-submit screen").
- **`/personality` alias:** referenced as an added alias in the session-correctness spec / production-hosting spec ("`/personality-test` (or `/personality`, the alias added in the session spec)"). The current `App.tsx` does **not** yet implement a `/personality` route — only the catch-all redirect to `/personality-test`. **(Gap — see below.)**
- **SPA deep-link resolution:** `web/firebase.json` declares a hosting rewrite `** → /index.html`, so any deep link (`/personality-test`, `/admin`) resolves to the SPA on either the `*.web.app` or custom domain (per production-hosting spec §7).

### C. How the path resolves / integrates with the marketing (main) website

This is the heart of the "path resolution" scheme the user articulated. The marketing site is a **separate, later sub-project**; the test ships **now** at a clean URL and is **linked in later** from the event page. From 2026-06-08:

- **Context (§ header):**
  > "Sub-project of the Lutheran Young Adults (LYA) website. … The marketing website (landing, About, Contact, events hierarchy) is a separate, later sub-project; **the test will be reachable at a clean URL now and linked from the Personality Day event page later.**"
- **Non-goal (§2):** "The marketing website and events hierarchy (separate spec)." — i.e., the events URL hierarchy is explicitly out of scope for the test app itself.
- **Integration plan (§12 "Later: marketing-site integration"):**
  > "When the marketing site is built, the Personality Day event page (`/events/2026/june/personality-day`) **links to `/personality-test` as a resource.** The design system established here is shared with that site."

So the agreed scheme is:

1. **Now:** the test app is deployed standalone at a clean path (`/personality-test`) under `lcmsyoungadults.org` (or the `*.web.app` fallback / a chosen subdomain).
2. **Later:** a separate marketing site owns the **events hierarchy** path `/events/2026/june/personality-day`. That event page does **not** embed or proxy the test — it simply **hyperlinks** to `/personality-test`.
3. **No reverse proxy / rewrite / redirect scheme between two apps was specified.** The only rewrite in play is the single-app SPA fallback in `firebase.json`. There is **no** evidence of a multi-app router, host-based routing, or proxy splitting `/events/*` vs `/personality-test` across backends. The integration is link-based, with a **shared design system** as the connective tissue.

### D. Auth / domain coupling (from production-hosting spec §5)

- Firebase auto-authorizes `lcms-young-adults.firebaseapp.com` / `.web.app`. **Any custom domain or subdomain must be manually added to Auth → Authorized domains**, or admin Google sign-in (`signInWithPopup`) breaks with `auth/unauthorized-domain`. Anonymous takers are unaffected.

---

## Progression / which is most recent

1. **2026-05-22 (personality-router prototype):** name suggests routing, but transcript holds **no** domain/path decisions to recover.
2. **2026-06-08 design spec (Approved for planning):** establishes the canonical decisions above — apex `lcmsyoungadults.org`, `/personality-test`, marketing-site link-in via `/events/2026/june/personality-day`. **This is the authoritative source for the integration scheme (§C).**
3. **2026-06-16 production-hosting design spec (draft, assistant-authored, nothing deployed):** **most recent** treatment of hosting/domain mechanics. It **refines** §A by proposing a **subdomain** (`personality.lcmsyoungadults.org`) and a `*.web.app` fallback, and adds the Auth-authorized-domain requirement. It does **not** contradict the §C link-based integration; it just doesn't re-derive it.

No hard conflicts — the newer spec extends rather than overturns the older one. The one drift is **subdomain vs apex** (06-08 assumed apex+path; 06-16 recommends a subdomain), left open in the newer spec's §11.

---

## Gaps / needs user confirmation

1. **Apex vs subdomain.** 06-08 assumed apex `lcmsyoungadults.org/personality-test`; 06-16 recommends `personality.lcmsyoungadults.org`. **User must choose** (drives DNS + Auth authorized domains + the QR/URL handed out). No verbatim user statement preferring one was found.
2. **`/personality` alias.** Specs reference it as "the alias added in the session spec," but `web/src/App.tsx` implements only `/personality-test` (+ catch-all redirect). Confirm whether `/personality` should be a real second route or just rely on the redirect.
3. **`/personality-test/results` route.** Specced in 06-08 §4 but flagged "may be folded into the post-submit screen." Confirm whether it remains a distinct path.
4. **Events-hierarchy path shape.** `/events/2026/june/personality-day` appears once (06-08 §12) as the future marketing-site link target. It is a **placeholder for a later, separate spec**, not a committed URL scheme. Confirm the events path convention when the marketing site is specced.
5. **No proxy/rewrite scheme between apps was ever specified.** If the user actually intended a single domain to *serve* both the marketing site and the test under one path namespace (vs. two separate deploys linked by a hyperlink), that was **not found in any transcript** — confirm the intent. Current evidence: link-based integration only.
6. **DNS ownership/timing** (from 06-16 §11): whoever controls `lcmsyoungadults.org` DNS must set records with SSL-provisioning lead time before the 2026-06-20 event; otherwise launch on `*.web.app`.

---

## Note on completeness

I did **not** invent a path-resolution scheme. Everything above traces to either (a) the committed 2026-06-08 design spec (§3/§4/§12 — the marketing-integration + `/personality-test` route the prompt anticipated), (b) the committed 2026-06-16 production-hosting spec, or (c) `web/src/App.tsx` / `web/firebase.json`. The transcripts themselves contained **no additional free-form user articulation** of domain/path beyond what those specs already capture.
