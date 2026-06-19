import { describe, it, beforeEach, afterAll } from 'vitest'
import { getTestEnv } from '../../test/emulator'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'

describe('security rules (emulator)', () => {
  beforeEach(async () => {
    const env = await getTestEnv()
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'admins', 'admin@x.org'), { email: 'admin@x.org' })
    })
  })
  afterAll(async () => { await (await getTestEnv()).cleanup() })

  it('anonymous user can write a taker but not a session', async () => {
    const env = await getTestEnv()
    const anon = env.authenticatedContext('anon1', {}) // no email = not admin
    const db = anon.firestore()
    await assertSucceeds(setDoc(doc(db, 'takers', 'bob'), { username: 'bob', ownerUid: 'anon1', completed: false }))
    await assertFails(setDoc(doc(db, 'sessions', 's1'), { name: 'x', status: 'active' }))
  })

  it('a signed-in user can create a taker they own; a stale name is reclaimable (no active session)', async () => {
    const env = await getTestEnv()
    const a = env.authenticatedContext('uidA', {}).firestore()
    await assertSucceeds(setDoc(doc(a, 'takers', 'bob'),
      { username: 'bob', ownerUid: 'uidA', completed: false }))
    // Name uniqueness is now scoped to the active session: with none running, another
    // browser may take over the (stale) name. (See the reclaim tests below for the
    // active-session case where this is denied.)
    const b = env.authenticatedContext('uidB', {}).firestore()
    await assertSucceeds(setDoc(doc(b, 'takers', 'bob'),
      { username: 'bob', ownerUid: 'uidB', completed: false }))
  })

  it('cannot create a taker claiming a different ownerUid', async () => {
    const env = await getTestEnv()
    const a = env.authenticatedContext('uidA', {}).firestore()
    await assertFails(setDoc(doc(a, 'takers', 'eve'),
      { username: 'eve', ownerUid: 'someoneElse', completed: false }))
  })

  it('the owner can update their own taker', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'takers', 'ann'),
        { username: 'ann', ownerUid: 'uidA', completed: false, group: null })
    })
    const a = env.authenticatedContext('uidA', {}).firestore()
    await assertSucceeds(setDoc(doc(a, 'takers', 'ann'),
      { username: 'ann', ownerUid: 'uidA', completed: true, group: null }))
  })

  it('an allowlisted admin may update a taker (group override)', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'takers', 'bob'),
        { username: 'bob', ownerUid: 'uidA', completed: true, group: 'games' })
    })
    const admin = env.authenticatedContext('a1', { email: 'admin@x.org' }).firestore()
    await assertSucceeds(setDoc(doc(admin, 'takers', 'bob'),
      { username: 'bob', ownerUid: 'uidA', completed: true, group: 'scavenger', groupOverride: true }))
  })

  it('non-admin signed-in user cannot write admins', async () => {
    const env = await getTestEnv()
    const u = env.authenticatedContext('u2', { email: 'random@x.org' })
    await assertFails(setDoc(doc(u.firestore(), 'admins', 'evil@x.org'), { email: 'evil@x.org' }))
  })

  it('allowlisted admin can write a session and admins', async () => {
    const env = await getTestEnv()
    const admin = env.authenticatedContext('a1', { email: 'admin@x.org' })
    const db = admin.firestore()
    await assertSucceeds(setDoc(doc(db, 'sessions', 's1'), { name: 'x', status: 'active' }))
    await assertSucceeds(setDoc(doc(db, 'admins', 'new@x.org'), { email: 'new@x.org' }))
  })

  it('unauthenticated client is denied everywhere', async () => {
    const env = await getTestEnv()
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'takers', 'bob')))
  })

  it('a taker cannot turn sharing from true back to false', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'takers', 'shara'),
        { username: 'shara', ownerUid: 'uidA', completed: true, sharing: true, group: null })
    })
    const a = env.authenticatedContext('uidA', {}).firestore()
    await assertFails(setDoc(doc(a, 'takers', 'shara'),
      { username: 'shara', ownerUid: 'uidA', completed: true, sharing: false, group: null }))
  })

  it('a taker can turn sharing from false to true', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'takers', 'sharb'),
        { username: 'sharb', ownerUid: 'uidA', completed: true, sharing: false, group: null })
    })
    const a = env.authenticatedContext('uidA', {}).firestore()
    await assertSucceeds(setDoc(doc(a, 'takers', 'sharb'),
      { username: 'sharb', ownerUid: 'uidA', completed: true, sharing: true, group: null }))
  })

  it('meta/activeSession: signed-in can read, only admin can write', async () => {
    const env = await getTestEnv()
    const anon = env.authenticatedContext('anon1', {}).firestore()
    await assertSucceeds(getDoc(doc(anon, 'meta', 'activeSession')))
    await assertFails(setDoc(doc(anon, 'meta', 'activeSession'), { sessionId: 'x' }))
    const admin = env.authenticatedContext('a1', { email: 'admin@x.org' }).firestore()
    await assertSucceeds(setDoc(doc(admin, 'meta', 'activeSession'), { sessionId: 'x' }))
  })

  it('a taker may set sessionId from null to a value (join) but not change a set one (hop)', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'takers', 'jna'),
        { username: 'jna', ownerUid: 'uidA', completed: false, sharing: false, sessionId: null, group: null })
      await setDoc(doc(ctx.firestore(), 'takers', 'jnb'),
        { username: 'jnb', ownerUid: 'uidA', completed: false, sharing: false, sessionId: 'A', group: null })
    })
    const a = env.authenticatedContext('uidA', {}).firestore()
    await assertSucceeds(setDoc(doc(a, 'takers', 'jna'),
      { username: 'jna', ownerUid: 'uidA', completed: false, sharing: false, sessionId: 'A', group: null }))
    await assertFails(setDoc(doc(a, 'takers', 'jnb'),
      { username: 'jnb', ownerUid: 'uidA', completed: false, sharing: false, sessionId: 'B', group: null }))
  })

  it('a name held by a taker in the ACTIVE session cannot be reclaimed by another uid', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'meta', 'activeSession'), { sessionId: 'S' })
      await setDoc(doc(ctx.firestore(), 'takers', 'alice'),
        { username: 'alice', ownerUid: 'uidA', completed: false, sharing: false, sessionId: 'S', group: null })
    })
    const b = env.authenticatedContext('uidB', {}).firestore()
    await assertFails(setDoc(doc(b, 'takers', 'alice'),
      { username: 'alice', ownerUid: 'uidB', completed: false, sharing: false, sessionId: 'S', group: null }))
  })

  it('a name from a NON-active session can be reclaimed by another uid', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'meta', 'activeSession'), { sessionId: 'Snew' })
      await setDoc(doc(ctx.firestore(), 'takers', 'bob'),
        { username: 'bob', ownerUid: 'uidA', completed: true, sharing: false, sessionId: 'Sold', group: null })
    })
    const b = env.authenticatedContext('uidB', {}).firestore()
    await assertSucceeds(setDoc(doc(b, 'takers', 'bob'),
      { username: 'bob', ownerUid: 'uidB', completed: false, sharing: false, sessionId: 'Snew', group: null }))
  })

  it('a session-less name can be reclaimed when no session is active', async () => {
    const env = await getTestEnv()
    await env.withSecurityRulesDisabled(async (ctx) => {
      // no meta/activeSession doc at all
      await setDoc(doc(ctx.firestore(), 'takers', 'cara'),
        { username: 'cara', ownerUid: 'uidA', completed: false, sharing: false, sessionId: null, group: null })
    })
    const b = env.authenticatedContext('uidB', {}).firestore()
    await assertSucceeds(setDoc(doc(b, 'takers', 'cara'),
      { username: 'cara', ownerUid: 'uidB', completed: false, sharing: false, sessionId: null, group: null }))
  })
})
