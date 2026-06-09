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
    else if (typeof v === 'number') f[k] = { integerValue: String(v) }
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
