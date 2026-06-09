import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // Unit/component/data tests live under src/. The e2e/ Playwright specs run via
    // `npm run test:e2e`, not vitest — exclude them so vitest doesn't try to load them.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    // domain tests need no DOM; emulator tests are opt-in via filename.
    // Run test files sequentially: the emulator-backed data tests share one
    // Firestore emulator, and each file's clearFirestore() in beforeEach would
    // otherwise wipe a concurrently-running file's data mid-test.
    fileParallelism: false,
  },
})
