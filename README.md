# Sekolah Karir — Standalone Career Product (Frontend)

A polished frontend-only implementation of the Sekolah Karir career product, covering:

- **Public CV / ATS Scanner** — analyze a CV without login
- **Public Side Hustle Arena** — weekly project program landing & showcase
- **Private Career App** (`/app/*`) — personal workspace, weekly project workflow, career report, portfolio, rewards

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Manrope font
- Lucide icons
- Hand-rolled SVG line chart (no chart library)
- No animation library — Tailwind transitions + CSS keyframes only

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Scripts

```bash
npm run dev        # local dev
npm run build      # production build
npm run start      # production server
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

## Frontend-Only Notes

This is a **frontend prototype**. There is no backend, database, or real authentication. Demo state is kept in `localStorage` only. All data is mocked under `src/data/mock/`. See the implementation report for the list of API contracts that will be needed when the backend is built.
