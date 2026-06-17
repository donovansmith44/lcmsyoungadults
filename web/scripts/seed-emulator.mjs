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
