export type PatientGender = 'Male' | 'Female' | 'Other' | 'Not specified';
export type VisitStatus = 'waiting' | 'in_progress' | 'completed' | 'cancelled';
export type CommunicationType = 'whatsapp' | 'call';

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  date_of_birth: string | null;
  gender: PatientGender | null;
  created_at: string;
}

export interface Visit {
  id: string;
  patient_id: string;
  visit_date: string;
  raw_clinical_notes: string | null;
  structured_data: Record<string, unknown> | null;
  pdf_url: string | null;
  next_visit_date: string | null;
  status: VisitStatus;
  created_at: string;
}

export interface VisitWithPatient extends Visit {
  patients: Pick<Patient, 'id' | 'first_name' | 'last_name' | 'phone_number'>;
}

export interface Communication {
  id: string;
  patient_id: string;
  type: CommunicationType;
  timestamp: string;
  notes: string | null;
}
