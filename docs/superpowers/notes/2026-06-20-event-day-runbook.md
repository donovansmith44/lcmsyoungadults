# Event-Day Runbook — Personality Day (June 20, 2026)

Quick reference for whoever is running the LCMS Young Adults personality test. Keep this tab open.

- **Admin console:** https://lcms-young-adults.web.app/admin
- **Taker link (share this):** https://lcms-young-adults.web.app/personality-test

---

## 1. Before the Event (5–10 min ahead)

1. Open the admin console and **sign in with your allowlisted Google account** (top-right shows your email once you're in).
2. Glance at the session list. If any session shows **(active)**, **end it** before you start a new one — only one session can run at a time.
   - Click **End** on the stale session. Done.
3. Have the taker link or QR code ready to share with the room.

---

## 2. Starting the Session

1. In the **"Start a session"** card at the top:
   - Type a **Session name** (e.g. "Personality Day 2026").
   - Set the **Timer (minutes)** — 30 is a good default.
2. Click **Start session**.
   - The button is disabled if a session is already active — end any stale one first.
3. The new session appears in the list as **(active)** and the **Roster opens automatically** below it. You'll see participants populate in real time as they begin.

---

## 3. During the Test

**Hand out the link:** https://lcms-young-adults.web.app/personality-test

**What participants do:**
1. Enter a username and tap **Begin →**.
   - Names must be unique within the running session. If someone gets "That name's taken — choose another," they just pick something different.
   - A name from a past (ended) session is totally reusable — no conflict.
2. Answer **32 questions** (auto-advances after each answer).
   - If time runs out mid-test, they'll get a quick "share your result?" prompt, then continue from where they left off.
3. Choose whether to **share** their result with the session, then see their **4-letter type** on the result screen.
   - People who opted in can see each other's results in a shared list on that screen.

**What you see in the Roster:**

| Column | What it means |
|--------|---------------|
| User | Username they entered |
| Type | Their 4-letter type (shows *testing…* until complete) |
| Se | Se-rank (1 = strongest Se; used for group split) |
| Share | ✓ if they chose to share |
| Group | Scavenger Hunt or Games (shows — until revealed) |

The roster updates live. No refresh needed.

> **Heads-up:** Someone who entered their name *before* you started the session will auto-join it once it's active — their row will appear normally.

---

## 4. Revealing the Activity Groups

When you're ready to split everyone into groups (after most people have finished, or when the timer hits 0):

1. Click **Reveal now** on the active session card.
2. Watch for the **green confirmation banner** at the top: *"Revealed — N participants now see their activity group."*
   - If it says "Groups were already revealed," you already did this — no harm done.
3. Each participant's result screen flips from *"Check back in N minutes for your activity group"* to their group pill:
   - **"You're in the scavenger hunt group!"**
   - **"You're in the games group!"**

**How the split works:** Participants are ranked by how strongly their type uses Extraverted Sensing (Se-rank 1 = strongest). The top half goes to **Scavenger Hunt**, the bottom half to **Games**. Ties are broken by raw score, then ID — so it's fully deterministic.

### Latecomers finished after revealing?

Click **Recompute** (available any time) to re-run the split with everyone who has finished. The green banner will confirm how many were regrouped. Manually pinned participants (see below) are always respected.

### Manual overrides

Each row in the Roster has two small buttons: **→ Scavenger** and **→ Games**. Clicking one moves that person and **pins** them (shown with a 📌 in the Group column). A pinned assignment survives future Recomputes.

---

## 5. Wrapping Up

1. When the event is over, click **End** on the active session.
   - This freezes groups (if not already revealed) and marks the session ended.
   - Participants who shared will see *"Your session has ended."* on their screen.
2. Optionally click **Archive** afterward to tuck it out of the way.

---

## 6. Troubleshooting

| Problem | What's going on / what to do |
|---------|-------------------------------|
| "That name's taken" | Someone in the *current* session already used that name. Pick a different one. (Names from past sessions are fine to reuse.) |
| "End the active session before starting another" | There's already an active session. Find it in the list and click **End** first. |
| Participant started before the session began | No problem — they auto-join once the session is active. Their row appears in the roster normally. |
| Taker's screen says "Your session has ended" | The session was ended or deleted while they were on the result screen. Expected behavior. |
| Group didn't update after Reveal | Wait a second for Firestore to sync, then have them refresh. If still wrong, use **Recompute** and the manual override buttons as a last resort. |
| Roster is collapsed / not visible | Click the **▸** toggle next to "Roster" to expand it. |

---

*Built with love for LCMS Young Adults. Have a great Personality Day!*
