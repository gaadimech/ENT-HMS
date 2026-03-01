import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patient_id = searchParams.get('patient_id');
  const date       = searchParams.get('date'); // YYYY-MM-DD

  let query = supabase
    .from('visits')
    .select('*')
    .order('visit_date', { ascending: false });

  if (patient_id) query = query.eq('patient_id', patient_id);
  if (date) {
    query = query
      .gte('visit_date', `${date}T00:00:00`)
      .lte('visit_date', `${date}T23:59:59`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ visits: data });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      patient_id,
      raw_clinical_notes,
      structured_data,
      next_visit_date,
      status = 'completed',
    } = body;

    if (!patient_id) {
      return NextResponse.json({ error: 'patient_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('visits')
      .insert({
        patient_id,
        raw_clinical_notes: raw_clinical_notes ?? null,
        structured_data:    structured_data    ?? null,
        next_visit_date:    next_visit_date    ?? null,
        status,
        visit_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ visit: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
