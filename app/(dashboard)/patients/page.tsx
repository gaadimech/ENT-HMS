'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase/client';
import type { Patient, PatientGender } from '@/types/database';
import {
  Search, UserPlus, Phone, MessageCircle, ChevronRight,
  X, Loader2, Users, CalendarDays,
} from 'lucide-react';

// ── Add Patient Modal ─────────────────────────────────────────────────────────

interface AddPatientModalProps {
  onClose: () => void;
  onCreated: (p: Patient) => void;
}

const INPUT_CLS = 'w-full px-3 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400';
const LABEL_CLS = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1';

function AddPatientModal({ onClose, onCreated }: AddPatientModalProps) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', phone_number: '',
    date_of_birth: '', gender: '' as PatientGender | '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.phone_number.trim()) {
      setError('First name, last name, and phone number are required.');
      return;
    }
    if (!/^\d{10}$/.test(form.phone_number.trim())) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error: dbErr } = await supabase
        .from('patients')
        .insert({
          first_name:    form.first_name.trim(),
          last_name:     form.last_name.trim(),
          phone_number:  form.phone_number.trim(),
          date_of_birth: form.date_of_birth || null,
          gender:        (form.gender || null) as PatientGender | null,
        })
        .select()
        .single();

      if (dbErr) {
        if (dbErr.message.includes('unique')) {
          setError('A patient with this phone number already exists.');
        } else {
          setError(dbErr.message);
        }
        return;
      }
      onCreated(data as Patient);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Register New Patient</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>First Name *</label>
              <input className={INPUT_CLS} value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Priya" required />
            </div>
            <div>
              <label className={LABEL_CLS}>Last Name *</label>
              <input className={INPUT_CLS} value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Sharma" required />
            </div>
          </div>

          <div>
            <label className={LABEL_CLS}>Phone Number * (10 digits)</label>
            <input
              className={INPUT_CLS}
              value={form.phone_number}
              onChange={e => set('phone_number', e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="9876543210"
              inputMode="numeric"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLS}>Date of Birth</label>
              <input className={INPUT_CLS} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} max={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className={LABEL_CLS}>Gender</label>
              <select className={INPUT_CLS} value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="">— Select —</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Not specified">Not specified</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-medium">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-sm font-semibold rounded-xl transition-colors">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Register Patient'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Age helper ────────────────────────────────────────────────────────────────

function calcAge(dob: string | null): string {
  if (!dob) return '—';
  const diff = Date.now() - new Date(dob).getTime();
  const age  = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return `${age} yrs`;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const [patients,   setPatients]   = useState<Patient[]>([]);
  const [filtered,   setFiltered]   = useState<Patient[]>([]);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [showModal,  setShowModal]  = useState(false);

  async function fetchPatients() {
    setLoading(true);
    const { data, error: dbErr } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false });

    if (dbErr) {
      setError(dbErr.message);
    } else {
      setPatients(data as Patient[]);
      setFiltered(data as Patient[]);
    }
    setLoading(false);
  }

  useEffect(() => { fetchPatients(); }, []);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) { setFiltered(patients); return; }
    setFiltered(
      patients.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        p.phone_number.includes(q),
      ),
    );
  }, [search, patients]);

  function handleCreated(p: Patient) {
    setPatients(prev => [p, ...prev]);
    setShowModal(false);
  }

  return (
    <div className="p-6 space-y-6">

      {showModal && <AddPatientModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patients</h1>
          <p className="text-sm text-slate-500 mt-0.5">{patients.length} registered patient{patients.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <UserPlus className="w-4 h-4" /> Add Patient
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone number…"
          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-slate-100 bg-slate-50">
          {['Patient', 'Phone', 'Age', 'Gender', 'Actions'].map(h => (
            <span key={h} className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading patients…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-500">{search ? 'No patients match your search.' : 'No patients registered yet.'}</p>
            {!search && (
              <button onClick={() => setShowModal(true)} className="mt-3 text-sm text-blue-600 hover:underline font-medium">
                Register first patient →
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map(p => {
              const fullName = `${p.first_name} ${p.last_name}`;
              const waMsg = encodeURIComponent(
                `Hello ${p.first_name}, this is Pragati ENT Hospital. We'd like to remind you of your follow-up appointment. Please call us at 0141-2600326 to confirm. Thank you!`,
              );
              return (
                <div key={p.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-x-4 gap-y-1 items-center px-5 py-3.5 hover:bg-slate-50 transition-colors">
                  {/* Name */}
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-blue-700">{p.first_name[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{fullName}</p>
                      <p className="text-xs text-slate-400 md:hidden">{p.phone_number}</p>
                    </div>
                  </div>
                  {/* Phone */}
                  <p className="hidden md:block text-sm text-slate-600">{p.phone_number}</p>
                  {/* Age */}
                  <p className="hidden md:block text-sm text-slate-600">{calcAge(p.date_of_birth)}</p>
                  {/* Gender */}
                  <p className="hidden md:block text-sm text-slate-600">{p.gender ?? '—'}</p>
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:+91${p.phone_number}`}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Call"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                    <a
                      href={`https://wa.me/91${p.phone_number}?text=${waMsg}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                    <Link
                      href={`/patients/${p.id}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      Open <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer count */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500">Showing {filtered.length} of {patients.length} patients</span>
          </div>
        )}
      </div>
    </div>
  );
}
