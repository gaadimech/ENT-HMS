# Supabase Database Setup

## Quick Start — One Command

1. Open your [Supabase Dashboard](https://supabase.com/dashboard) → select **Pragati ENT Hospital** project.
2. Go to **SQL Editor** → **New query**.
3. Copy the full contents of **`setup.sql`** → Paste → **Run**.

That creates all tables and seeds sample data. Your HMS is ready.

## Alternative: Run Schema + Seed Separately

- `schema.sql` — tables, indexes, RLS
- `seed.sql` — sample patients, visits, communications

## Schema Overview

| Table            | Description                                      |
|------------------|--------------------------------------------------|
| `patients`       | Patient registry (name, phone, DOB, gender)      |
| `visits`         | Consultations with AI-parsed prescription data  |
| `communications` | Logs of WhatsApp and phone contacts              |

## Tables

### patients
- `id` (UUID, PK)
- `first_name`, `last_name`, `phone_number` (unique)
- `date_of_birth`, `gender`
- `created_at`

### visits
- `id` (UUID, PK)
- `patient_id` → patients(id)
- `visit_date`, `raw_clinical_notes`, `structured_data` (JSONB)
- `pdf_url`, `next_visit_date`
- `status`: `waiting` | `in_progress` | `completed` | `cancelled`
- `created_at`

### communications
- `id` (UUID, PK)
- `patient_id` → patients(id)
- `type`: `whatsapp` | `call`
- `timestamp`, `notes`

## Re-seeding

To re-run the seed (e.g. after schema changes):
- Either drop and recreate tables, or
- Delete only the seed rows (by known IDs) before running `seed.sql` again.
