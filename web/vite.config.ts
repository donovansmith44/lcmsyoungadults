/// <reference types="vitest/config" />
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Tests that talk to Firestore/Auth. They only pass under the emulator, which
// `npm run test:rules` provides via `firebase emulators:exec`. The Firebase CLI
// sets FIRESTORE_EMULATOR_HOST for the spawned process, so we use that (rather
// than a custom VAR=1 prefix, which doesn't work on Windows) to decide which
// set to run. Add any new emulator-dependent test here.
const EMULATOR_TESTS = [
  'src/data/**/*.test.ts',
  'src/hooks/useSessions.test.ts',
  'src/routes/admin/AdminGate.test.tsx',
  'src/routes/admin/SessionList.test.tsx',
]

const underEmulator = !!process.env.FIRESTORE_EMULATOR_HOST

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // Dummy Firebase config so `src/firebase.ts` can initializeApp/getAuth in
    // tests without a real .env (an empty apiKey throws auth/invalid-api-key).
    // VITE_USE_EMULATOR points the client at the local emulator that
    // `npm run test:rules` starts. Committed so a clean checkout / CI runs the
    // component tests identically — no machine-local .env required.
    env: {
      VITE_FB_API_KEY: 'demo-api-key',
      VITE_FB_AUTH_DOMAIN: 'demo-lya.firebaseapp.com',
      VITE_FB_PROJECT_ID: 'demo-lya',
      VITE_FB_APP_ID: 'demo-app-id',
      VITE_USE_EMULATOR: '1',
    },
    // Under the emulator (`npm run test:rules`) run ONLY the emulator tests;
    // otherwise (`npm test`) run everything EXCEPT them, so domain/unit tests
    // pass with no emulator — matching the README.
    include: underEmulator ? EMULATOR_TESTS : configDefaults.include,
    exclude: underEmulator
      ? configDefaults.exclude
      : [...configDefaults.exclude, ...EMULATOR_TESTS],
    // Run test files sequentially: the emulator-backed data tests share one
    // Firestore emulator, and each file's clearFirestore() in beforeEach would
    // otherwise wipe a concurrently-running file's data mid-test.
    fileParallelism: false,
  },
})
