-- =============================================================================
-- Pragati ENT Hospital — Complete Database Setup
-- Copy this entire file into Supabase SQL Editor and Run.
-- Creates tables + seeds sample data in one go.
-- =============================================================================

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

CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_patient_date ON visits(patient_id, visit_date DESC);

-- =============================================================================
-- COMMUNICATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('whatsapp', 'call')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_communications_patient ON communications(patient_id);
CREATE INDEX IF NOT EXISTS idx_communications_timestamp ON communications(timestamp DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on patients" ON patients;
CREATE POLICY "Allow all on patients" ON patients FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on visits" ON visits;
CREATE POLICY "Allow all on visits" ON visits FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on communications" ON communications;
CREATE POLICY "Allow all on communications" ON communications FOR ALL USING (true) WITH CHECK (true);

-- =============================================================================
-- SEED DATA
-- =============================================================================

INSERT INTO patients (id, first_name, last_name, phone_number, date_of_birth, gender, created_at) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Rajesh', 'Kumar', '9876543210', '1985-03-15', 'Male', NOW() - INTERVAL '60 days'),
  ('11111111-1111-1111-1111-111111111102', 'Priya', 'Sharma', '9876543211', '1992-07-22', 'Female', NOW() - INTERVAL '45 days'),
  ('11111111-1111-1111-1111-111111111103', 'Amit', 'Verma', '9876543212', '1978-11-08', 'Male', NOW() - INTERVAL '30 days'),
  ('11111111-1111-1111-1111-111111111104', 'Sunita', 'Gupta', '9876543213', '1995-01-30', 'Female', NOW() - INTERVAL '20 days'),
  ('11111111-1111-1111-1111-111111111105', 'Vikram', 'Singh', '9876543214', '1982-09-12', 'Male', NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO visits (id, patient_id, visit_date, raw_clinical_notes, structured_data, status, next_visit_date) VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', NOW() - INTERVAL '5 days',
   '35 yo male, c/o bilateral ear blockage and mild hearing loss x 2 weeks.',
   '{"patientInfo":{"name":"Rajesh Kumar","age":"35 years","sex":"Male","preliminaryPresentation":"Bilateral ear blockage and mild hearing loss for 2 weeks"},"symptoms":["Bilateral ear blockage","Mild hearing loss"],"examinations":["Otoscopy - bilateral wax","Wax removal done"],"presentation":"Bilateral impacted cerumen with conductive hearing loss","medications":[{"medicineName":"Earex drops","dosage":"2-3 drops","frequency":"BD","duration":"3 days"}],"recommendation":"Avoid water in ears. Keep ears dry.","nextVisit":"After 3 days for PTA","investigations":["Pure Tone Audiometry"]}'::jsonb,
   'completed', (CURRENT_DATE + INTERVAL '3 days')::date),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', NOW() - INTERVAL '2 days',
   '28 yo F, allergic rhinitis. Nasal congestion, sneezing, watery eyes.',
   '{"patientInfo":{"name":"Priya Sharma","age":"28 years","sex":"Female","preliminaryPresentation":"Allergic rhinitis"},"symptoms":["Nasal congestion","Sneezing","Watery eyes"],"examinations":["Anterior rhinoscopy - pale turbinates"],"presentation":"Allergic rhinitis (AR)","medications":[{"medicineName":"Mometasone nasal spray","dosage":"2 puffs","frequency":"OD","duration":"2 weeks"},{"medicineName":"Levocetirizine","dosage":"10mg","frequency":"OD","duration":"1 week"}],"recommendation":"Avoid dust and allergens. Steam inhalation helpful.","nextVisit":"After 2 weeks","investigations":[]}'::jsonb,
   'completed', (CURRENT_DATE + INTERVAL '14 days')::date),
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111103', NOW(), NULL, NULL, 'waiting', NULL),
  ('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111104', NOW() - INTERVAL '2 hours',
   'Sore throat, odynophagia x 3 days. Viral URTI.',
   '{"patientInfo":{"name":"Sunita Gupta","age":"29 years","sex":"Female","preliminaryPresentation":"Sore throat and odynophagia for 3 days"},"symptoms":["Sore throat","Odynophagia"],"examinations":["Oropharynx - injected","No exudates"],"presentation":"Acute viral pharyngitis (URTI)","medications":[{"medicineName":"Paracetamol","dosage":"500mg","frequency":"SOS","duration":"3 days"},{"medicineName":"Chlorhexidine gargle","dosage":"10ml","frequency":"BD","duration":"5 days"}],"recommendation":"Warm fluids, rest. Avoid spicy food.","nextVisit":"As needed","investigations":[]}'::jsonb,
   'completed', NULL),
  ('22222222-2222-2222-2222-222222222205', '11111111-1111-1111-1111-111111111105', NOW() - INTERVAL '8 days',
   'CSOM left ear, ear discharge. Started antibiotic ear drops.',
   '{"patientInfo":{"name":"Vikram Singh","age":"42 years","sex":"Male","preliminaryPresentation":"Left ear discharge"},"symptoms":["Left ear discharge"],"examinations":["Otoscopy - left tympanic perforation","Mucoid discharge"],"presentation":"Chronic Suppurative Otitis Media (CSOM) - left ear","medications":[{"medicineName":"Ciprofloxacin ear drops","dosage":"3-4 drops","frequency":"TID","duration":"1 week"}],"recommendation":"Keep ear dry. No swimming.","nextVisit":"After 1 week","investigations":["Pure Tone Audiometry","Tympanogram"]}'::jsonb,
   'completed', (CURRENT_DATE + INTERVAL '2 days')::date)
ON CONFLICT (id) DO NOTHING;

INSERT INTO communications (patient_id, type, timestamp, notes) VALUES
  ('11111111-1111-1111-1111-111111111101', 'whatsapp', NOW() - INTERVAL '4 days', 'Appointment reminder sent'),
  ('11111111-1111-1111-1111-111111111101', 'call', NOW() - INTERVAL '3 days', 'Patient confirmed follow-up'),
  ('11111111-1111-1111-1111-111111111102', 'whatsapp', NOW() - INTERVAL '1 day', 'Prescription shared'),
  ('11111111-1111-1111-1111-111111111103', 'call', NOW() - INTERVAL '2 hours', 'Inquiry about today appointment');
