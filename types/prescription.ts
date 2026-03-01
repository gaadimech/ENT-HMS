export interface Medication {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface PatientInfo {
  name: string;
  age: string;
  sex: string;
  preliminaryPresentation: string;
}

export interface PrescriptionData {
  patientInfo: PatientInfo;
  symptoms: string[];
  examinations: string[];
  presentation: string;
  medications: Medication[];
  recommendation: string;
  nextVisit: string;
  investigations: string[];
}
