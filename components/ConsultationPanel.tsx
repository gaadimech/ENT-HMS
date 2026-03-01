'use client';

import { useState } from 'react';
import { generatePrescriptionPDF } from '@/lib/pdfGenerator';
import type { PrescriptionData, Medication } from '@/types/prescription';
import { CheckCircle, AlertCircle, ArrowLeft, Loader2, Zap, Download, Plus, X, Calendar } from 'lucide-react';

// ── Parse next visit free-text into a YYYY-MM-DD date ─────────────────────────

function parseNextVisitDate(text: string): string {
  if (!text?.trim()) return '';
  // "After X days"
  const daysMatch = text.match(/after\s+(\d+)\s+days?/i);
  if (daysMatch) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(daysMatch[1]));
    return d.toISOString().split('T')[0];
  }
  // "After X weeks"
  const weeksMatch = text.match(/after\s+(\d+)\s+weeks?/i);
  if (weeksMatch) {
    const d = new Date();
    d.setDate(d.getDate() + parseInt(weeksMatch[1]) * 7);
    return d.toISOString().split('T')[0];
  }
  // "After X months"
  const monthsMatch = text.match(/after\s+(\d+)\s+months?/i);
  if (monthsMatch) {
    const d = new Date();
    d.setMonth(d.getMonth() + parseInt(monthsMatch[1]));
    return d.toISOString().split('T')[0];
  }
  // Try direct date parse — strip ordinal suffixes first (1st, 2nd, 3rd, 4th → 1, 2, 3, 4)
  const cleaned = text.replace(/(\d+)(st|nd|rd|th)/gi, '$1');
  const parsed  = new Date(cleaned);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2020) {
    return parsed.toISOString().split('T')[0];
  }
  return '';
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_DRAFT: PrescriptionData = {
  patientInfo: { name: '', age: '', sex: '', preliminaryPresentation: '' },
  symptoms: [],
  examinations: [],
  presentation: '',
  medications: [],
  recommendation: '',
  nextVisit: '',
  investigations: [],
};

const EMPTY_MED: Medication = { medicineName: '', dosage: '', frequency: '', duration: '' };

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT = [
  'w-full px-3 py-2 text-sm text-slate-700 bg-white',
  'border border-slate-200 rounded-lg',
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
  'placeholder:text-slate-400 transition-all',
].join(' ');

const LABEL = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1';

// ── Sub-components (outside parent to prevent focus loss) ─────────────────────

function SectionCard({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className={`flex items-center gap-2.5 px-5 py-3 border-b border-slate-100 ${accent}`}>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0 rounded"
    >
      <X className="w-4 h-4" />
    </button>
  );
}

// ── Props & Types ─────────────────────────────────────────────────────────────

interface ConsultationPanelProps {
  patientId: string;
  visitId?: string;        // if set, we PATCH instead of POST
  patientName?: string;    // pre-fill the name field
  onSaved?: () => void;    // callback after successful save
}

type Phase = 'input' | 'review';
type Loading = 'idle' | 'parsing' | 'saving';

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ConsultationPanel({
  patientId,
  visitId,
  patientName = '',
  onSaved,
}: ConsultationPanelProps) {
  const [phase, setPhase]     = useState<Phase>('input');
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState<Loading>('idle');
  const [error, setError]     = useState<string | null>(null);
  const [draft, setDraft]     = useState<PrescriptionData>({
    ...EMPTY_DRAFT,
    patientInfo: { ...EMPTY_DRAFT.patientInfo, name: patientName },
  });
  const [savedVisitId,  setSavedVisitId]  = useState<string | null>(null);
  const [nextVisitDate, setNextVisitDate] = useState(''); // YYYY-MM-DD for DB
  const [newSymptom,    setNewSymptom]    = useState('');
  const [newExam,       setNewExam]       = useState('');
  const [newInvest,     setNewInvest]     = useState('');

  const busy = loading !== 'idle';

  // ── Draft helpers ──────────────────────────────────────────────────────────

  function setPatient(field: keyof PrescriptionData['patientInfo'], val: string) {
    setDraft(d => ({ ...d, patientInfo: { ...d.patientInfo, [field]: val } }));
  }
  function setStr(field: 'presentation' | 'recommendation' | 'nextVisit', val: string) {
    setDraft(d => ({ ...d, [field]: val }));
  }
  function setListItem(list: 'symptoms' | 'examinations' | 'investigations', idx: number, val: string) {
    setDraft(d => { const a = [...d[list]]; a[idx] = val; return { ...d, [list]: a }; });
  }
  function removeListItem(list: 'symptoms' | 'examinations' | 'investigations', idx: number) {
    setDraft(d => ({ ...d, [list]: d[list].filter((_, i) => i !== idx) }));
  }
  function pushListItem(list: 'symptoms' | 'examinations' | 'investigations', val: string) {
    if (!val.trim()) return;
    setDraft(d => ({ ...d, [list]: [...d[list], val.trim()] }));
  }
  function setMedField(idx: number, field: keyof Medication, val: string) {
    setDraft(d => { const m = [...d.medications]; m[idx] = { ...m[idx], [field]: val }; return { ...d, medications: m }; });
  }
  function removeMed(idx: number) {
    setDraft(d => ({ ...d, medications: d.medications.filter((_, i) => i !== idx) }));
  }
  function addMed() {
    setDraft(d => ({ ...d, medications: [...d.medications, { ...EMPTY_MED }] }));
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleParse() {
    if (!rawText.trim()) { setError('Please enter clinical notes first.'); return; }
    setError(null);
    setLoading('parsing');
    try {
      const res  = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to parse notes.');
      // Pre-set name from patient profile if AI didn't find one
      const parsed: PrescriptionData = json.prescription;
      if (!parsed.patientInfo.name && patientName) {
        parsed.patientInfo.name = patientName;
      }
      setDraft(parsed);
      setNextVisitDate(parseNextVisitDate(parsed.nextVisit));
      setNewSymptom(''); setNewExam(''); setNewInvest('');
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error.');
    } finally {
      setLoading('idle');
    }
  }

  async function handleSaveAndGeneratePDF() {
    setError(null);
    setLoading('saving');
    try {
      // 1. Save to database
      const endpoint = visitId ? `/api/visits/${visitId}` : '/api/visits';
      const method   = visitId ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id:          patientId,
          raw_clinical_notes:  rawText,
          structured_data:     draft,
          next_visit_date:     nextVisitDate || null,
          status:              'completed',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save consultation record.');

      setSavedVisitId(json.visit.id);

      // 2. Generate + download PDF
      await generatePrescriptionPDF(draft);

      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed — please try again.');
    } finally {
      setLoading('idle');
    }
  }

  function goBack() {
    setPhase('input');
    setError(null);
    setSavedVisitId(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (savedVisitId) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center space-y-3">
        <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
        <h3 className="text-lg font-semibold text-green-800">Consultation Saved</h3>
        <p className="text-sm text-green-700">
          The prescription has been saved to the patient record and the PDF has been downloaded.
        </p>
        <p className="text-xs text-green-600 font-mono bg-green-100 inline-block px-3 py-1 rounded-full">
          Visit ID: {savedVisitId}
        </p>
        <div className="pt-2">
          <button
            onClick={() => { setSavedVisitId(null); setPhase('input'); setRawText(''); setNextVisitDate(''); setDraft({ ...EMPTY_DRAFT, patientInfo: { ...EMPTY_DRAFT.patientInfo, name: patientName } }); }}
            className="px-4 py-2 text-sm font-medium text-green-700 border border-green-300 rounded-lg hover:bg-green-100 transition-colors"
          >
            Start Another Consultation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Step breadcrumb */}
      <div className="flex items-center gap-2 text-xs">
        <span className={`flex items-center gap-1 font-semibold ${phase === 'input' ? 'text-blue-600' : 'text-green-600'}`}>
          {phase === 'review' && <CheckCircle className="w-3 h-3" />}
          1. Enter Notes
        </span>
        <span className="text-slate-300">›</span>
        <span className={`font-semibold ${phase === 'review' ? 'text-blue-600' : 'text-slate-400'}`}>
          2. Review &amp; Edit
        </span>
        <span className="text-slate-300">›</span>
        <span className="text-slate-400">3. Save &amp; PDF</span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Error</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── PHASE 1 — INPUT ── */}
      {phase === 'input' && (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="consult-notes" className="text-sm font-semibold text-slate-700">
                Clinical Notes
                <span className="ml-2 text-xs font-normal text-slate-400">— brain-dump mode</span>
              </label>
              {rawText && (
                <button onClick={() => { setRawText(''); setError(null); }} className="text-xs text-slate-400 hover:text-slate-600 transition-colors" disabled={busy}>
                  Clear
                </button>
              )}
            </div>
            <textarea
              id="consult-notes"
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              disabled={busy}
              placeholder={`Dictate or type the patient's visit notes freely.\n\nInclude: symptoms · examination findings · diagnosis · medications · advice · follow-up date.`}
              className="w-full h-64 p-4 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 disabled:opacity-60 transition-all leading-relaxed"
            />
            <div className="mt-1.5 flex justify-end">
              <span className="text-xs text-slate-400">{rawText.length} chars</span>
            </div>
          </div>

          <button
            onClick={handleParse}
            disabled={busy || !rawText.trim()}
            className="w-full py-4 px-6 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold text-base rounded-2xl transition-all duration-200 shadow-sm flex items-center justify-center gap-3"
          >
            {loading === 'parsing' ? (
              <><Loader2 className="animate-spin w-5 h-5" /> Analyzing clinical notes…</>
            ) : (
              <><Zap className="w-5 h-5" /> Parse Notes &amp; Review Fields</>
            )}
          </button>
        </>
      )}

      {/* ── PHASE 2 — REVIEW & EDIT ── */}
      {phase === 'review' && (
        <div className="space-y-4">

          {/* Patient Details */}
          <SectionCard title="Patient Details" accent="bg-blue-50">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className={LABEL}>Full Name</label>
                <input className={INPUT} value={draft.patientInfo.name} onChange={e => setPatient('name', e.target.value)} placeholder="Patient full name" />
              </div>
              <div>
                <label className={LABEL}>Age</label>
                <input className={INPUT} value={draft.patientInfo.age} onChange={e => setPatient('age', e.target.value)} placeholder="e.g. 32 years" />
              </div>
              <div>
                <label className={LABEL}>Sex</label>
                <select className={INPUT} value={draft.patientInfo.sex} onChange={e => setPatient('sex', e.target.value)}>
                  <option value="">— Select —</option>
                  <option>Male</option><option>Female</option><option>Other</option><option>Not specified</option>
                </select>
              </div>
            </div>
            <div>
              <label className={LABEL}>Chief Complaint</label>
              <input className={INPUT} value={draft.patientInfo.preliminaryPresentation} onChange={e => setPatient('preliminaryPresentation', e.target.value)} placeholder="Brief chief complaint" />
            </div>
          </SectionCard>

          {/* Symptoms & Examinations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title="Symptoms" accent="bg-amber-50">
              <div className="space-y-2">
                {draft.symptoms.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className={INPUT} value={s} onChange={e => setListItem('symptoms', i, e.target.value)} />
                    <RemoveBtn onClick={() => removeListItem('symptoms', i)} />
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <input className={INPUT} value={newSymptom} onChange={e => setNewSymptom(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { pushListItem('symptoms', newSymptom); setNewSymptom(''); } }}
                    placeholder="Add symptom (Enter)" />
                  <button type="button" onClick={() => { pushListItem('symptoms', newSymptom); setNewSymptom(''); }}
                    className="px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors shrink-0">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Examinations" accent="bg-violet-50">
              <div className="space-y-2">
                {draft.examinations.map((ex, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className={INPUT} value={ex} onChange={e => setListItem('examinations', i, e.target.value)} />
                    <RemoveBtn onClick={() => removeListItem('examinations', i)} />
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <input className={INPUT} value={newExam} onChange={e => setNewExam(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { pushListItem('examinations', newExam); setNewExam(''); } }}
                    placeholder="Add examination (Enter)" />
                  <button type="button" onClick={() => { pushListItem('examinations', newExam); setNewExam(''); }}
                    className="px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors shrink-0">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* Diagnosis */}
          <SectionCard title="Diagnosis / Presentation" accent="bg-emerald-50">
            <textarea className={`${INPUT} h-20 resize-none`} value={draft.presentation} onChange={e => setStr('presentation', e.target.value)} placeholder="Final clinical diagnosis or impression" />
          </SectionCard>

          {/* Investigations */}
          <SectionCard title="Investigations Ordered" accent="bg-sky-50">
            <div className="space-y-2">
              {draft.investigations.map((inv, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className={INPUT} value={inv} onChange={e => setListItem('investigations', i, e.target.value)} />
                  <RemoveBtn onClick={() => removeListItem('investigations', i)} />
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <input className={INPUT} value={newInvest} onChange={e => setNewInvest(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { pushListItem('investigations', newInvest); setNewInvest(''); } }}
                  placeholder="Add investigation (Enter)" />
                <button type="button" onClick={() => { pushListItem('investigations', newInvest); setNewInvest(''); }}
                  className="px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Medications */}
          <SectionCard title="Prescribed Medications" accent="bg-rose-50">
            <div className="space-y-3">
              {draft.medications.length > 0 && (
                <div className="hidden sm:grid sm:grid-cols-[1fr_100px_120px_100px_28px] gap-2 px-1">
                  {['Medicine Name', 'Dosage', 'Frequency', 'Duration', ''].map((h, i) => (
                    <span key={i} className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</span>
                  ))}
                </div>
              )}
              {draft.medications.map((med, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_100px_120px_100px_28px] gap-2 items-center p-3 sm:p-0 bg-slate-50 sm:bg-transparent rounded-xl sm:rounded-none border sm:border-0 border-slate-200">
                  <input className={INPUT} value={med.medicineName} onChange={e => setMedField(i, 'medicineName', e.target.value)} placeholder="Medicine name" />
                  <input className={INPUT} value={med.dosage}       onChange={e => setMedField(i, 'dosage', e.target.value)}       placeholder="500mg" />
                  <input className={INPUT} value={med.frequency}    onChange={e => setMedField(i, 'frequency', e.target.value)}    placeholder="BD / TID" />
                  <input className={INPUT} value={med.duration}     onChange={e => setMedField(i, 'duration', e.target.value)}     placeholder="5 days" />
                  <div className="flex sm:justify-center"><RemoveBtn onClick={() => removeMed(i)} /></div>
                </div>
              ))}
              <button type="button" onClick={addMed} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors py-1">
                <Plus className="w-4 h-4" /> Add Medication
              </button>
            </div>
          </SectionCard>

          {/* Advice & Follow-up */}
          <SectionCard title="Advice &amp; Follow-up" accent="bg-teal-50">
            <div className="space-y-3">
              <div>
                <label className={LABEL}>Recommendation / Advice</label>
                <textarea className={`${INPUT} h-20 resize-none`} value={draft.recommendation} onChange={e => setStr('recommendation', e.target.value)} placeholder="General advice, dietary restrictions, home care instructions…" />
              </div>
              <div>
                <label className={LABEL}>Next Visit — AI text</label>
                <input className={INPUT} value={draft.nextVisit} onChange={e => { setStr('nextVisit', e.target.value); setNextVisitDate(parseNextVisitDate(e.target.value)); }} placeholder="e.g. After 7 days, 5th March 2026" />
              </div>
              <div>
                <label className={LABEL + ' flex items-center gap-1.5'}>
                  <Calendar className="w-3 h-3" />
                  Follow-up Date (saved to record)
                </label>
                <input
                  type="date"
                  className={INPUT}
                  value={nextVisitDate}
                  onChange={e => setNextVisitDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
                {nextVisitDate && (
                  <p className="text-xs text-green-600 mt-1">
                    Auto-parsed from notes · {new Date(nextVisitDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={goBack}
              className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={handleSaveAndGeneratePDF}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
            >
              {loading === 'saving' ? (
                <><Loader2 className="animate-spin w-4 h-4" /> Saving &amp; Generating PDF…</>
              ) : (
                <><Download className="w-4 h-4" /> Save to Record &amp; Generate PDF</>
              )}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
