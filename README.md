# Roo Agent Office

A clean dark Next.js dashboard for monitoring OpenClaw AI agent token usage.

## Stack
- Next.js 14 (App Router, TypeScript)
- Tailwind CSS
- Recharts
- Firebase Firestore (modular SDK)

## Features
- Sidebar + topbar command center layout
- Token Stats tab with:
  - Time filters (`1H`, `6H`, `24H`, `7D`, `30D`)
  - KPI cards (Total, In, Out, Estimated Cost)
  - Area chart (In vs Out)
  - Model breakdown (4 fixed models)
  - Live activity feed (10 latest events)
- Firestore remote reader (`hooks/useTokenStats.ts`)
- Local gateway writer (`hooks/useTokenWriter.ts`) polling every 30s
- Mock data fallback when Firestore is empty

## Local Development
```bash
cd C:\Users\Roobo\.openclaw\workspace\agent-office
npm install
npm run dev
```
Open http://localhost:3000

### Environment
Create `.env.local`:
```env
NEXT_PUBLIC_GATEWAY_TOKEN=0f7016e02a90f2975492e02cf051c5c4f9d1e7ac6f43c011
```

## Build Check
```bash
npm run build
```

## Netlify Deploy Steps
1. Push this repo to GitHub.
2. In Netlify, create **New site from Git** and select the repo.
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
4. Add environment variable:
   - `NEXT_PUBLIC_GATEWAY_TOKEN` (optional for remote-only viewer; required if local writer is used in hosted env)
5. Deploy.

> For production-grade Next.js hosting, Vercel is the default best path. Netlify works with Next runtime support.

## Firestore Rules (starter)
Use rules appropriate to your security model. Minimal authenticated-write + authenticated-read baseline:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /token_snapshots/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

If you need open dashboard access temporarily, loosen read rules only with caution.

## Git Init + Push
```bash
git init
git remote add origin https://github.com/roocenter/Roo.git
git add .
git commit -m "initial: Roo Agent Office — Token Stats dashboard"
git branch -M main
git push -u origin main
```
