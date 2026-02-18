# Ramtax Mission Control (v1)

Private internal web app for Ramtax Mission Control.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Scripts

- `npm run lint`
- `npm run typecheck`
- `npm run test` (placeholder for PR #1)

## Environment variables

Copy `.env.example` to `.env.local` and fill values.

> Do not commit secrets.

## Deployment

- Vercel Preview deploys per PR
- Vercel Production deploys on merge to `main`
