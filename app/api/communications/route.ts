import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patient_id, type, notes } = body;

    if (!patient_id || !type) {
      return NextResponse.json(
        { error: 'patient_id and type are required' },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from('communications')
      .insert({
        patient_id,
        type,
        notes: notes ?? null,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ communication: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
