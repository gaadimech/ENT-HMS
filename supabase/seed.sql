-- Pragati ENT Hospital - Seed Data
-- Run AFTER schema.sql in Supabase SQL Editor

-- =============================================================================
-- SAMPLE PATIENTS
-- =============================================================================
INSERT INTO patients (id, first_name, last_name, phone_number, date_of_birth, gender, created_at) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Rajesh', 'Kumar', '9876543210', '1985-03-15', 'Male', NOW() - INTERVAL '60 days'),
  ('11111111-1111-1111-1111-111111111102', 'Priya', 'Sharma', '9876543211', '1992-07-22', 'Female', NOW() - INTERVAL '45 days'),
  ('11111111-1111-1111-1111-111111111103', 'Amit', 'Verma', '9876543212', '1978-11-08', 'Male', NOW() - INTERVAL '30 days'),
  ('11111111-1111-1111-1111-111111111104', 'Sunita', 'Gupta', '9876543213', '1995-01-30', 'Female', NOW() - INTERVAL '20 days'),
  ('11111111-1111-1111-1111-111111111105', 'Vikram', 'Singh', '9876543214', '1982-09-12', 'Male', NOW() - INTERVAL '10 days')
ON CONFLICT (id) DO NOTHING;

-- Use ON CONFLICT on phone_number if re-running (schema has UNIQUE on phone)
-- If you get unique violation, truncate tables first or use different phone numbers

-- =============================================================================
-- SAMPLE VISITS (linked to patients)
-- =============================================================================
INSERT INTO visits (
  id, patient_id, visit_date, raw_clinical_notes, structured_data, status, next_visit_date
) VALUES
  -- Rajesh Kumar - completed visit
  (
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111101',
    NOW() - INTERVAL '5 days',
    '35 yo male, c/o bilateral ear blockage and mild hearing loss x 2 weeks. Otoscopy: bilateral wax. Tuning fork: Weber lateralizing to left. PTA advised. Wax removal done. Advised Earex drops BD x 3 days.',
    '{
      "patientInfo": {
        "name": "Rajesh Kumar",
        "age": "35 years",
        "sex": "Male",
        "preliminaryPresentation": "Bilateral ear blockage and mild hearing loss for 2 weeks"
      },
      "symptoms": ["Bilateral ear blockage", "Mild hearing loss"],
      "examinations": ["Otoscopy - bilateral wax", "Tuning fork - Weber lateralizing to left", "Wax removal done"],
      "presentation": "Bilateral impacted cerumen with conductive hearing loss",
      "medications": [
        {"medicineName": "Earex drops", "dosage": "2-3 drops", "frequency": "BD", "duration": "3 days"}
      ],
      "recommendation": "Avoid water in ears. Keep ears dry. Do not insert anything in ear canal.",
      "nextVisit": "After 3 days for PTA",
      "investigations": ["Pure Tone Audiometry"]
    }'::jsonb,
    'completed',
    (CURRENT_DATE + INTERVAL '3 days')::date
  ),
  -- Priya Sharma - completed visit
  (
    '22222222-2222-2222-2222-222222222202',
    '11111111-1111-1111-1111-111111111102',
    NOW() - INTERVAL '2 days',
    '28 yo F, allergic rhinitis. Nasal congestion, sneezing, watery eyes. Anterior rhinoscopy: pale turbinates, clear discharge. Advised nasal steroid and antihistamine.',
    '{
      "patientInfo": {
        "name": "Priya Sharma",
        "age": "28 years",
        "sex": "Female",
        "preliminaryPresentation": "Allergic rhinitis - nasal congestion, sneezing, watery eyes"
      },
      "symptoms": ["Nasal congestion", "Sneezing", "Watery eyes"],
      "examinations": ["Anterior rhinoscopy - pale turbinates", "Clear nasal discharge"],
      "presentation": "Allergic rhinitis (AR)",
      "medications": [
        {"medicineName": "Mometasone nasal spray", "dosage": "2 puffs", "frequency": "OD", "duration": "2 weeks"},
        {"medicineName": "Levocetirizine", "dosage": "10mg", "frequency": "OD", "duration": "1 week"}
      ],
      "recommendation": "Avoid dust and allergens. Steam inhalation helpful. Saline nasal wash daily.",
      "nextVisit": "After 2 weeks",
      "investigations": []
    }'::jsonb,
    'completed',
    (CURRENT_DATE + INTERVAL '14 days')::date
  ),
  -- Amit Verma - today waiting
  (
    '22222222-2222-2222-2222-222222222203',
    '11111111-1111-1111-1111-111111111103',
    NOW(),
    NULL,
    NULL,
    'waiting',
    NULL
  ),
  -- Sunita Gupta - today in progress (completed - sample)
  (
    '22222222-2222-2222-2222-222222222204',
    '11111111-1111-1111-1111-111111111104',
    NOW() - INTERVAL '2 hours',
    'Sore throat, odynophagia x 3 days. Oropharynx injected. No exudates. Viral URTI.',
    '{
      "patientInfo": {"name": "Sunita Gupta", "age": "29 years", "sex": "Female", "preliminaryPresentation": "Sore throat and odynophagia for 3 days"},
      "symptoms": ["Sore throat", "Odynophagia"],
      "examinations": ["Oropharynx - injected", "No exudates"],
      "presentation": "Acute viral pharyngitis (URTI)",
      "medications": [
        {"medicineName": "Paracetamol", "dosage": "500mg", "frequency": "SOS", "duration": "3 days"},
        {"medicineName": "Chlorhexidine gargle", "dosage": "10ml", "frequency": "BD", "duration": "5 days"}
      ],
      "recommendation": "Warm fluids, rest. Avoid spicy food. Steam inhalation.",
      "nextVisit": "As needed",
      "investigations": []
    }'::jsonb,
    'completed',
    NULL
  ),
  -- Vikram Singh - previous visit
  (
    '22222222-2222-2222-2222-222222222205',
    '11111111-1111-1111-1111-111111111105',
    NOW() - INTERVAL '8 days',
    'CSOM left ear, ear discharge. Otoscopy: perforation, mucoid discharge. Started antibiotic ear drops.',
    '{
      "patientInfo": {"name": "Vikram Singh", "age": "42 years", "sex": "Male", "preliminaryPresentation": "Left ear discharge - chronic suppurative otitis media"},
      "symptoms": ["Left ear discharge"],
      "examinations": ["Otoscopy - left tympanic perforation", "Mucoid discharge"],
      "presentation": "Chronic Suppurative Otitis Media (CSOM) - left ear",
      "medications": [
        {"medicineName": "Ciprofloxacin ear drops", "dosage": "3-4 drops", "frequency": "TID", "duration": "1 week"}
      ],
      "recommendation": "Keep ear dry. No swimming. Avoid water entry. Cover ear during bath.",
      "nextVisit": "After 1 week",
      "investigations": ["Pure Tone Audiometry", "Tympanogram"]
    }'::jsonb,
    'completed',
    (CURRENT_DATE + INTERVAL '2 days')::date
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SAMPLE COMMUNICATIONS
-- =============================================================================
INSERT INTO communications (patient_id, type, timestamp, notes) VALUES
  ('11111111-1111-1111-1111-111111111101', 'whatsapp', NOW() - INTERVAL '4 days', 'Appointment reminder sent'),
  ('11111111-1111-1111-1111-111111111101', 'call', NOW() - INTERVAL '3 days', 'Patient confirmed follow-up'),
  ('11111111-1111-1111-1111-111111111102', 'whatsapp', NOW() - INTERVAL '1 day', 'Prescription shared'),
  ('11111111-1111-1111-1111-111111111103', 'call', NOW() - INTERVAL '2 hours', 'Inquiry about today appointment')
;
