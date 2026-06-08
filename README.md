# LCMS Young Adults — Personality Day app

Firebase-backed personality test + session-admin app for LCMS Young Adults
"Personality Day" (2026-06-20).

- **App:** [`web/`](web/) — Vite + React + TypeScript, Firebase (Hosting + Firestore + Auth), Vitest.
- **Design spec:** [`docs/superpowers/specs/2026-06-08-personality-test-app-design.md`](docs/superpowers/specs/2026-06-08-personality-test-app-design.md)
- **Implementation plans:** [`docs/superpowers/plans/`](docs/superpowers/plans/) — foundation (done), test-taker UI, admin UI.

## Develop

```bash
cd web
npm install
npm test                 # domain unit tests (no emulator)
npm run test:rules       # emulator-backed data/rules tests (needs Java + firebase-tools)
npm run dev              # local dev server
npm run build            # production build
```

See `web/scripts/seed-admin.md` for seeding the first admin.
