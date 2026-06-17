import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // The taker flow answers 32 items by clicking through an auto-advancing question screen
  // against the Firestore emulator; under load a click can occasionally land mid-advance and
  // re-answer an item, leaving the run a question short of the sharing prompt. Assertions stay
  // strict — retries absorb that environmental timing rather than masking real failures (a
  // genuinely broken behavior fails all attempts).
  retries: 2,
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'on-first-retry', screenshot: 'only-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
    env: { VITE_USE_EMULATOR: '1', VITE_FB_PROJECT_ID: 'demo-lya' },
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
})
