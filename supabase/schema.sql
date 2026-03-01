-- Pragati ENT Hospital - Prescription Maker
-- Complete database schema for Supabase
-- Run this in Supabase SQL Editor: Project Settings > SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- PATIENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other', 'Not specified')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for search by name/phone
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone_number);
CREATE INDEX IF NOT EXISTS idx_patients_created ON patients(created_at DESC);

-- =============================================================================
-- VISITS
-- =============================================================================
CREATE TABLE IF NOT EXISTS visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  visit_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_clinical_notes TEXT,
  structured_data JSONB,
  pdf_url TEXT,
  next_visit_date DATE,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (
    status IN ('waiting', 'in_progress', 'completed', 'cancelled')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_patient_date ON visits(patient_id, visit_date DESC);

-- =============================================================================
-- COMMUNICATIONS (WhatsApp/Call logs)
-- =============================================================================
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('whatsapp', 'call')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Index for patient lookup
CREATE INDEX IF NOT EXISTS idx_communications_patient ON communications(patient_id);
CREATE INDEX IF NOT EXISTS idx_communications_timestamp ON communications(timestamp DESC);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Allow anon key access for app usage (use stricter policies in production)
-- =============================================================================
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

-- Permit all operations for anon key (replace with auth-based policies in production)
DROP POLICY IF EXISTS "Allow all on patients" ON patients;
CREATE POLICY "Allow all on patients" ON patients
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on visits" ON visits;
CREATE POLICY "Allow all on visits" ON visits
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on communications" ON communications;
CREATE POLICY "Allow all on communications" ON communications
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE patients IS 'Patient registry - Pragati ENT Hospital';
COMMENT ON TABLE visits IS 'Visit/consultation records with AI-parsed prescription data';
COMMENT ON TABLE communications IS 'Log of WhatsApp and phone communications with patients';
