import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/utils/supabase/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { raw_clinical_notes, structured_data, next_visit_date, status } = body;

    const { data, error } = await supabase
      .from('visits')
      .update({
        ...(raw_clinical_notes !== undefined && { raw_clinical_notes }),
        ...(structured_data    !== undefined && { structured_data }),
        ...(next_visit_date    !== undefined && { next_visit_date }),
        ...(status             !== undefined && { status }),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ visit: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ visit: data });
}
