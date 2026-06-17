const PROJECT = 'demo-lya'
const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`
const ADMIN = { headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' } }

export async function clearFirestore() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`,
    { method: 'DELETE', ...ADMIN })
}

function fields(obj: Record<string, unknown>) {
  const f: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) f[k] = { nullValue: null }
    else if (typeof v === 'string') f[k] = { stringValue: v }
    else if (typeof v === 'number') f[k] = Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }
    else if (typeof v === 'boolean') f[k] = { booleanValue: v }
    else if (v instanceof Date) f[k] = { timestampValue: v.toISOString() }
  }
  return f
}

export async function seedDoc(path: string, data: Record<string, unknown>) {
  const [coll, id] = path.split('/')
  await fetch(`${FS}/${coll}?documentId=${id}`, { method: 'POST', ...ADMIN, body: JSON.stringify({ fields: fields(data) }) })
}

export async function seedAdmin(email: string) {
  await seedDoc(`admins/${email.toLowerCase()}`, { email: email.toLowerCase() })
}

export async function seedSession(id: string, opts: { name: string; timerMinutes: number; status?: string; startedAt?: Date }) {
  await seedDoc(`sessions/${id}`, {
    name: opts.name, timerMinutes: opts.timerMinutes, status: opts.status ?? 'active',
    startedAt: opts.startedAt ?? new Date(), groupsFrozenAt: null, createdBy: 'seed',
  })
}

export async function updateSeededDoc(path: string, data: Record<string, unknown>) {
  const [coll, id] = path.split('/')
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&')
  await fetch(`${FS}/${coll}/${id}?${mask}`, { method: 'PATCH', ...ADMIN, body: JSON.stringify({ fields: fields(data) }) })
}

export async function deleteSeededDoc(path: string) {
  const [coll, id] = path.split('/')
  await fetch(`${FS}/${coll}/${id}`, { method: 'DELETE', ...ADMIN })
}

/**
 * Seed a completed taker directly in Firestore, bypassing the browser flow.
 * Useful when tests need a taker in a session roster without driving the full quiz UI.
 */
export async function seedTaker(
  username: string,
  sessionId: string,
  opts: { completed?: boolean; type?: string; seRank?: number; seStrength?: number } = {},
) {
  await seedDoc(`takers/${username}`, {
    username,
    ownerUid: `seed-uid-${username}`,
    // answers is a map; omitted here (seedDoc skips objects) — not needed for roster tests
    completed: opts.completed ?? true,
    type: opts.type ?? 'INFJ',
    seRank: opts.seRank ?? 3,
    seStrength: opts.seStrength ?? 0.5,
    sharing: false,
    sessionId,
    group: null,
    groupOverride: false,
  })
}
