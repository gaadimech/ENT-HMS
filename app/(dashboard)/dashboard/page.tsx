'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/utils/supabase/client';
import type { VisitWithPatient } from '@/types/database';
import {
  Users, CalendarDays, Clock, UserPlus, Stethoscope,
  Phone, ChevronRight, RefreshCw, CheckCircle2, XCircle,
} from 'lucide-react';

// ── Status badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  waiting:     'bg-amber-100 text-amber-700 border-amber-200',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200',
  completed:   'bg-green-100 text-green-700 border-green-200',
  cancelled:   'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_LABELS: Record<string, string> = {
  waiting:     'Waiting',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600'}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
        status === 'waiting'     ? 'bg-amber-500' :
        status === 'in_progress' ? 'bg-blue-500'  :
        status === 'completed'   ? 'bg-green-500' : 'bg-slate-400'
      }`} />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | null; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value ?? '—'}</p>
        <p className="text-xs text-slate-500 font-medium">{label}</p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [todayVisits,    setTodayVisits]    = useState<VisitWithPatient[]>([]);
  const [totalPatients,  setTotalPatients]  = useState<number | null>(null);
  const [todayCount,     setTodayCount]     = useState<number | null>(null);
  const [waitingCount,   setWaitingCount]   = useState<number | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState<string | null>(null);
  const [refreshing,     setRefreshing]     = useState(false);
  const [updatingVisit,  setUpdatingVisit]  = useState<string | null>(null);

  async function fetchData() {
    try {
      setError(null);
      const today      = new Date().toISOString().split('T')[0];
      const todayStart = `${today}T00:00:00`;
      const todayEnd   = `${today}T23:59:59`;

      const [patientsRes, todayVisitsRes, waitingRes] = await Promise.all([
        supabase.from('patients').select('id', { count: 'exact', head: true }),
        supabase
          .from('visits')
          .select('*, patients(id, first_name, last_name, phone_number)')
          .gte('visit_date', todayStart)
          .lte('visit_date', todayEnd)
          .order('visit_date', { ascending: true }),
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'waiting'),
      ]);

      setTotalPatients(patientsRes.count ?? 0);
      setTodayVisits((todayVisitsRes.data ?? []) as VisitWithPatient[]);
      setTodayCount((todayVisitsRes.data ?? []).length);
      setWaitingCount(waitingRes.count ?? 0);
    } catch {
      setError('Failed to load dashboard data. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { fetchData(); }, []);

  function refresh() {
    setRefreshing(true);
    fetchData();
  }

  async function handleStatusUpdate(visitId: string, newStatus: 'completed' | 'cancelled') {
    setUpdatingVisit(visitId);
    try {
      await fetch(`/api/visits/${visitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      setTodayVisits(prev =>
        prev.map(v => v.id === visitId ? { ...v, status: newStatus } : v),
      );
      if (newStatus === 'completed') {
        setWaitingCount(c => Math.max(0, (c ?? 1) - 1));
      }
    } finally {
      setUpdatingVisit(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors touch-manipulation"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/patients"
            className="flex items-center justify-center gap-2 flex-1 sm:flex-initial px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm touch-manipulation"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            Add Patient
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <p>{error}</p>
          <button
            onClick={() => { setLoading(true); fetchData(); }}
            className="mt-2 text-sm font-medium text-red-800 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Patients"  value={totalPatients} icon={Users}        color="bg-blue-600" />
        <StatCard label="Today's Visits"  value={todayCount}    icon={CalendarDays} color="bg-emerald-600" />
        <StatCard label="Currently Waiting" value={waitingCount} icon={Clock}       color="bg-amber-500" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/patients" className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-blue-300 hover:shadow-md transition-all group">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
            <UserPlus className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">Register New Patient</p>
            <p className="text-xs text-slate-500">Add a patient profile to the system</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
        </Link>

        <Link href="/patients" className="flex items-center gap-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-emerald-300 hover:shadow-md transition-all group">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
            <Stethoscope className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">New Consultation</p>
            <p className="text-xs text-slate-500">Select a patient to start AI-assisted EMR</p>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-colors" />
        </Link>
      </div>

      {/* Today's Queue */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">Today&apos;s Patient Queue</h2>
          <span className="text-xs text-slate-400">{todayCount ?? 0} visit{todayCount !== 1 ? 's' : ''} today</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Loading queue…</div>
        ) : todayVisits.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarDays className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No visits recorded today yet.</p>
            <p className="text-xs text-slate-400 mt-1">Add patients to the queue from their profile page.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {todayVisits.map(visit => {
              const p = visit.patients;
              const fullName = `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim();
              const visitTime = new Date(visit.visit_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={visit.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-slate-50 transition-colors touch-manipulation">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-blue-700">
                      {(p?.first_name?.[0] ?? '?').toUpperCase()}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{fullName || 'Unknown'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <p className="text-xs text-slate-500">{p?.phone_number ?? '—'}</p>
                    </div>
                  </div>
                  {/* Time */}
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">{visitTime}</p>
                    <div className="mt-1"><StatusBadge status={visit.status} /></div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(visit.status === 'waiting' || visit.status === 'in_progress') && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(visit.id, 'completed')}
                          disabled={updatingVisit === visit.id}
                          title="Mark complete"
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(visit.id, 'cancelled')}
                          disabled={updatingVisit === visit.id}
                          title="Cancel visit"
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {p?.id && (
                      <Link
                        href={`/patients/${p.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg transition-colors"
                      >
                        {visit.status === 'waiting' ? 'Start' : 'View'}
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
