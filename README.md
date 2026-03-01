# ENT-HMS

**Pragati ENT Hospital Management System** — AI-assisted prescription maker and patient management for ENT clinics.

## Features

- **Dashboard** — Today's queue, stats, Complete/Cancel controls
- **Patient Management** — Register, search, edit, delete, view history
- **AI Prescription** — Paste clinical notes → GPT-4 parses → structured prescription → PDF export
- **Visit History** — Expandable visits with symptoms, examinations, medications, advice
- **Communications** — Log WhatsApp and phone contacts
- **Supabase** — Patients, visits, communications stored in PostgreSQL

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL)
- OpenAI (GPT-4o-mini)
- jsPDF (prescription PDF)

## Local Development

```bash
# Install
npm install

# Copy env template
cp .env.example .env.local

# Set variables in .env.local:
# - OPENAI_API_KEY
# - NEXT_PUBLIC_SUPABASE_URL
# - NEXT_PUBLIC_SUPABASE_ANON_KEY

# Run Supabase setup (in Supabase SQL Editor)
# Copy & run supabase/setup.sql

# Start dev server
npm run dev
```

## Deploy on Railway

1. **Push to GitHub** — Connect this repo to `gaadimech/ENT-HMS`
2. **New Project on Railway** — [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. **Select** `gaadimech/ENT-HMS`
4. **Add env vars** (Railway → Variables):
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **Deploy** — Railway auto-detects Next.js, builds with standalone output, and deploys

### Railway Config

- `railway.toml` — Start command for standalone Next.js
- `next.config.ts` — `output: "standalone"` for optimized builds

## Database Setup (Supabase)

Run `supabase/setup.sql` in Supabase SQL Editor to create tables and seed data.

## License

Private — Pragati ENT Hospital
