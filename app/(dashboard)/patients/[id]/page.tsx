'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase/client';
import type { Patient, Visit, Communication } from '@/types/database';
import ConsultationPanel from '@/components/ConsultationPanel';
import {
  ArrowLeft, Phone, MessageCircle, Stethoscope, Clock,
  FileText, Calendar, CheckCircle2, XCircle, Loader2,
  UserPlus, ClipboardList, Activity, Edit2, Trash2,
  ChevronDown, ChevronRight, X,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcAge(dob: string | null): string {
  if (!dob) return 'Age unknown';
  const diff = Date.now() - new Date(dob).getTime();
  return `${Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))} years`;
}

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  waiting:     { dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700 border-amber-200',   label: 'Waiting' },
  in_progress: { dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700 border-blue-200',       label: 'In Progress' },
  completed:   { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700 border-green-200',    label: 'Completed' },
  cancelled:   { dot: 'bg-slate-400',  badge: 'bg-slate-100 text-slate-500 border-slate-200',    label: 'Cancelled' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.cancelled;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ── Log communication ─────────────────────────────────────────────────────────

async function logComm(patient_id: string, type: 'whatsapp' | 'call') {
  await fetch('/api/communications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id, type }),
  });
}

// ── Tab type ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'history' | 'consultation' | 'communications';

// ── Structured data display (Visit expand) ───────────────────────────────────

interface MedRow { medicineName?: string; name?: string; dosage?: string; frequency?: string; duration?: string; instructions?: string; }

function VisitDetail({ sd }: { sd: Record<string, unknown> }) {
  const meds = Array.isArray(sd.medications) ? (sd.medications as MedRow[]) : [];
  const symptoms = Array.isArray(sd.symptoms)
    ? (sd.symptoms as string[])
    : typeof sd.symptoms === 'string' ? [sd.symptoms] : [];
  const exams = Array.isArray(sd.examinations)
    ? (sd.examinations as string[])
    : typeof sd.examinations === 'string' ? [sd.examinations] : [];
  const advice = Array.isArray(sd.advice)
    ? (sd.advice as string[])
    : typeof sd.advice === 'string'
    ? [sd.advice]
    : sd.recommendation ? [sd.recommendation as string] : [];

  return (
    <div className="mt-3 space-y-3 pl-2 border-l-2 border-slate-100">
      {symptoms.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Symptoms</p>
          <ul className="text-xs text-slate-700 space-y-0.5">{symptoms.map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
      )}
      {exams.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Examinations</p>
          <ul className="text-xs text-slate-700 space-y-0.5">{exams.map((e, i) => <li key={i}>• {e}</li>)}</ul>
        </div>
      )}
      {typeof sd.presentation === 'string' && sd.presentation ? (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Diagnosis</p>
          <p className="text-xs text-slate-700">{sd.presentation}</p>
        </div>
      ) : null}
      {meds.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Medications ({meds.length})</p>
          <div className="space-y-1.5">
            {meds.map((m, i) => (
              <div key={i} className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-slate-800">{m.medicineName ?? m.name ?? '—'} {m.dosage && <span className="font-normal text-slate-500">· {m.dosage}</span>}</p>
                {(m.frequency || m.duration) && (
                  <p className="text-xs text-slate-500 mt-0.5">{[m.frequency, m.duration].filter(Boolean).join(' · ')}</p>
                )}
                {m.instructions && <p className="text-xs text-slate-400 mt-0.5 italic">{m.instructions}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {advice.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Advice</p>
          <ul className="text-xs text-slate-700 space-y-0.5">{advice.map((a, i) => <li key={i}>• {a}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [patient,         setPatient]        = useState<Patient | null>(null);
  const [visits,          setVisits]         = useState<Visit[]>([]);
  const [communications,  setComms]          = useState<Communication[]>([]);
  const [loading,         setLoading]        = useState(true);
  const [error,           setError]          = useState<string | null>(null);
  const [activeTab,       setActiveTab]      = useState<Tab>('overview');
  const [addingToQueue,   setAddingToQueue]  = useState(false);
  const [queueSuccess,    setQueueSuccess]   = useState(false);
  const [activeVisit,     setActiveVisit]    = useState<Visit | null>(null);

  // Visit expand
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);

  // Edit modal
  const [showEditModal,   setShowEditModal]  = useState(false);
  const [editForm,        setEditForm]       = useState({ first_name: '', last_name: '', phone_number: '', date_of_birth: '', gender: '' });
  const [editSaving,      setEditSaving]     = useState(false);
  const [editError,       setEditError]      = useState<string | null>(null);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting,          setDeleting]          = useState(false);

  // ── Data fetch ──────────────────────────────────────────────────────────────

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [patientRes, visitsRes, commsRes] = await Promise.all([
        supabase.from('patients').select('*').eq('id', id).single(),
        supabase.from('visits').select('*').eq('patient_id', id).order('visit_date', { ascending: false }),
        supabase.from('communications').select('*').eq('patient_id', id).order('timestamp', { ascending: false }),
      ]);

      if (patientRes.error) { setError('Patient not found.'); return; }
      const p = patientRes.data as Patient;
      setPatient(p);
      setEditForm({
        first_name:    p.first_name,
        last_name:     p.last_name,
        phone_number:  p.phone_number,
        date_of_birth: p.date_of_birth ?? '',
        gender:        p.gender ?? '',
      });

      const v = (visitsRes.data ?? []) as Visit[];
      setVisits(v);
      setComms((commsRes.data ?? []) as Communication[]);

      const todayStr = new Date().toISOString().split('T')[0];
      const today = v.find(
        visit => visit.visit_date.startsWith(todayStr) &&
          (visit.status === 'waiting' || visit.status === 'in_progress'),
      );
      setActiveVisit(today ?? null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [id]);

  // ── Queue ───────────────────────────────────────────────────────────────────

  async function handleAddToQueue() {
    if (!patient) return;
    setAddingToQueue(true);
    try {
      const { data } = await supabase
        .from('visits')
        .insert({ patient_id: patient.id, status: 'waiting', visit_date: new Date().toISOString() })
        .select()
        .single();
      if (data) {
        const v = data as Visit;
        setVisits(prev => [v, ...prev]);
        setActiveVisit(v);
        setQueueSuccess(true);
        setTimeout(() => setQueueSuccess(false), 3000);
      }
    } finally {
      setAddingToQueue(false);
    }
  }

  // ── Edit patient ────────────────────────────────────────────────────────────

  function openEditModal() {
    if (!patient) return;
    setEditError(null);
    setEditForm({
      first_name:    patient.first_name,
      last_name:     patient.last_name,
      phone_number:  patient.phone_number,
      date_of_birth: patient.date_of_birth ?? '',
      gender:        patient.gender ?? '',
    });
    setShowEditModal(true);
  }

  async function handleEditSave() {
    if (!patient) return;
    if (!editForm.first_name.trim() || !editForm.phone_number.trim()) {
      setEditError('First name and phone number are required.');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const { error: err } = await supabase
        .from('patients')
        .update({
          first_name:    editForm.first_name.trim(),
          last_name:     editForm.last_name.trim(),
          phone_number:  editForm.phone_number.trim(),
          date_of_birth: editForm.date_of_birth || null,
          gender:        editForm.gender || null,
        })
        .eq('id', patient.id);
      if (err) { setEditError('Failed to save changes.'); return; }
      setShowEditModal(false);
      fetchData();
    } finally {
      setEditSaving(false);
    }
  }

  // ── Delete patient ──────────────────────────────────────────────────────────

  async function handleDeletePatient() {
    if (!patient) return;
    setDeleting(true);
    try {
      await supabase.from('patients').delete().eq('id', patient.id);
      router.push('/patients');
    } finally {
      setDeleting(false);
    }
  }

  // ── Consultation callbacks ──────────────────────────────────────────────────

  function handleConsultationSaved() {
    setActiveVisit(null);
    fetchData();
    setActiveTab('history');
  }

  // ── Loading / Error ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-600 font-medium">{error ?? 'Patient not found'}</p>
        <Link href="/patients" className="mt-3 inline-block text-sm text-blue-600 hover:underline">← Back to Patients</Link>
      </div>
    );
  }

  const fullName  = `${patient.first_name} ${patient.last_name}`;
  const waMessage = encodeURIComponent(
    `Hello ${patient.first_name}, this is Pragati ENT Hospital. We'd like to remind you of your follow-up appointment. Please call us at 0141-2600326 to confirm your visit. Thank you!`,
  );
  const completedVisits = visits.filter(v => v.status === 'completed');
  const lastVisit       = completedVisits[0];

  return (
    <div className="p-6 space-y-6">

      {/* Back link */}
      <Link href="/patients" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Patients
      </Link>

      {/* ── Patient Header Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">

          {/* Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-sm shrink-0">
            <span className="text-2xl font-bold text-white">{patient.first_name[0]?.toUpperCase()}</span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{fullName}</h1>
              {activeVisit && <StatusBadge status={activeVisit.status} />}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
              <span>{patient.gender ?? 'Gender not set'}</span>
              <span className="text-slate-300">·</span>
              <span>{calcAge(patient.date_of_birth)}</span>
              {patient.date_of_birth && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>DOB: {new Date(patient.date_of_birth).toLocaleDateString('en-IN')}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-sm text-slate-600 font-medium">+91 {patient.phone_number}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Registered on {new Date(patient.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:items-end">
            {/* Edit + Delete */}
            <div className="flex gap-2">
              <button
                onClick={openEditModal}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-lg transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 text-sm font-medium rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>

            {/* Contact */}
            <div className="flex gap-2">
              <a
                href={`https://wa.me/91${patient.phone_number}?text=${waMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => logComm(patient.id, 'whatsapp')}
                className="flex items-center gap-2 px-3.5 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
              <a
                href={`tel:+91${patient.phone_number}`}
                onClick={() => logComm(patient.id, 'call')}
                className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
              >
                <Phone className="w-4 h-4" /> Call
              </a>
            </div>

            {/* Queue */}
            <div className="flex gap-2">
              {!activeVisit && (
                <button
                  onClick={handleAddToQueue}
                  disabled={addingToQueue}
                  className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium rounded-xl transition-colors"
                >
                  {addingToQueue
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</>
                    : <><UserPlus className="w-4 h-4" /> Add to Queue</>}
                </button>
              )}
              <button
                onClick={() => setActiveTab('consultation')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                <Stethoscope className="w-4 h-4" />
                {activeVisit ? 'Start Consultation' : 'New Consultation'}
              </button>
            </div>

            {queueSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-green-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Added to today&apos;s queue
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
        {([
          { id: 'overview'        as Tab, label: 'Overview',       icon: Activity },
          { id: 'history'         as Tab, label: 'Visit History',  icon: ClipboardList },
          { id: 'consultation'    as Tab, label: 'Consultation',   icon: Stethoscope },
          { id: 'communications'  as Tab, label: 'Communications', icon: MessageCircle },
        ]).map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tabId
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Visits',     value: visits.length,           icon: Calendar,     color: 'bg-blue-100 text-blue-600',   small: false },
            { label: 'Completed Visits', value: completedVisits.length,  icon: CheckCircle2, color: 'bg-green-100 text-green-600', small: false },
            {
              label: 'Last Visit',
              value: lastVisit
                ? new Date(lastVisit.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'No visits yet',
              icon: Clock,
              color: 'bg-slate-100 text-slate-600',
              small: true,
            },
          ].map(({ label, value, icon: Icon, color, small }) => (
            <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className={`font-bold text-slate-900 ${small ? 'text-base' : 'text-2xl'}`}>{value}</p>
                <p className="text-xs text-slate-500 font-medium">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Visit History ── */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Visit History</h2>
          </div>

          {visits.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No visits recorded yet.</p>
              <button onClick={() => setActiveTab('consultation')} className="mt-2 text-sm text-blue-600 hover:underline font-medium">
                Start first consultation →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {visits.map(visit => {
                const sd = visit.structured_data as Record<string, unknown> | null;
                const diagnosis = sd?.presentation as string | undefined;
                const medCount  = Array.isArray(sd?.medications) ? (sd.medications as unknown[]).length : 0;
                const isExpanded = expandedVisitId === visit.id;
                const hasDetail = sd && Object.keys(sd).length > 0;

                return (
                  <div key={visit.id} className="px-5 py-4 hover:bg-slate-50 transition-colors">
                    <div
                      className={`flex items-start gap-4 ${hasDetail ? 'cursor-pointer' : ''}`}
                      onClick={() => hasDetail && setExpandedVisitId(isExpanded ? null : visit.id)}
                    >
                      {/* Status icon */}
                      <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        visit.status === 'completed' ? 'bg-green-100' : 'bg-amber-100'
                      }`}>
                        {visit.status === 'completed'
                          ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                          : visit.status === 'cancelled'
                          ? <XCircle className="w-4 h-4 text-red-500" />
                          : <Clock className="w-4 h-4 text-amber-500" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">
                            {new Date(visit.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                          <span className="text-slate-300 text-xs">
                            {new Date(visit.visit_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <StatusBadge status={visit.status} />
                        </div>

                        {diagnosis && (
                          <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                            <span className="font-medium text-slate-700">Diagnosis: </span>{diagnosis}
                          </p>
                        )}

                        {medCount > 0 && (
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {medCount} medication{medCount !== 1 ? 's' : ''} prescribed
                          </p>
                        )}

                        {visit.next_visit_date && (
                          <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Follow-up: {new Date(visit.next_visit_date).toLocaleDateString('en-IN')}
                          </p>
                        )}
                      </div>

                      {hasDetail && (
                        <div className="shrink-0 text-slate-400 mt-1">
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />}
                        </div>
                      )}
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && sd && <VisitDetail sd={sd} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Consultation ── */}
      {activeTab === 'consultation' && (
        <div>
          {activeVisit && (
            <div className="mb-4 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-800">
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                This patient has an active <strong>{STATUS_STYLES[activeVisit.status]?.label}</strong> visit from{' '}
                {new Date(activeVisit.visit_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.
                {' '}Completing the consultation will update this visit record.
              </span>
            </div>
          )}
          <ConsultationPanel
            patientId={patient.id}
            visitId={activeVisit?.id}
            patientName={fullName}
            onSaved={handleConsultationSaved}
          />
        </div>
      )}

      {/* ── Tab: Communications ── */}
      {activeTab === 'communications' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Communication History</h2>
            <span className="text-xs text-slate-400">{communications.length} event{communications.length !== 1 ? 's' : ''}</span>
          </div>

          {communications.length === 0 ? (
            <div className="p-12 text-center">
              <MessageCircle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No communications logged yet.</p>
              <p className="text-xs text-slate-400 mt-1">WhatsApp and Call actions are logged automatically.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {communications.map(comm => (
                <div key={comm.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    comm.type === 'whatsapp' ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    {comm.type === 'whatsapp'
                      ? <MessageCircle className="w-4 h-4 text-green-600" />
                      : <Phone className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 capitalize">{comm.type}</p>
                    {comm.notes && <p className="text-xs text-slate-500 truncate">{comm.notes}</p>}
                  </div>
                  <p className="text-xs text-slate-400 shrink-0">
                    {new Date(comm.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{' '}
                    {new Date(comm.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Edit Patient Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Edit Patient</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {editError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{editError}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editForm.first_name}
                    onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Last Name</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editForm.last_name}
                    onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number *</label>
                <input
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editForm.phone_number}
                  onChange={e => setEditForm(f => ({ ...f, phone_number: e.target.value }))}
                  maxLength={10}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
                <input
                  type="date"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editForm.date_of_birth}
                  onChange={e => setEditForm(f => ({ ...f, date_of_birth: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Gender</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editForm.gender}
                  onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}
                >
                  <option value="">Not specified</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving}
                className="flex-1 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 mb-1">Delete Patient?</h2>
              <p className="text-sm text-slate-500">
                This will permanently delete <strong>{fullName}</strong> and all their visit records. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePatient}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
