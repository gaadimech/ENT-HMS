import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a medical data extraction assistant specializing in ENT (Ear, Nose, Throat) medicine. Your task is to extract structured information from unstructured clinical notes written by an ENT doctor and return a valid JSON object.

CRITICAL RULES:
1. Return ONLY a raw JSON object — no markdown, no code blocks, no backticks, no explanations. Your entire response must start with { and end with }.
2. Every required field must be present. Use "Not specified" for missing text fields and [] for missing arrays.
3. Infer reasonable values when context clearly implies them (e.g., "35-year-old male" → age: "35 years", sex: "Male").
4. For medications, extract every prescription detail mentioned. Infer standard dosages from context when clearly implied.
5. Symptoms are what the patient reports (subjective). Examinations are what the doctor finds or checks (objective).
6. Keep text values concise and clinically accurate.

Return this EXACT JSON structure (preserve all keys):
{
  "patientInfo": {
    "name": "Full patient name, or 'Not specified'",
    "age": "Age with unit, e.g., '35 years', or 'Not specified'",
    "sex": "Male, Female, Other, or Not specified",
    "preliminaryPresentation": "Brief chief complaint in 1-2 clinical sentences"
  },
  "symptoms": [
    "Each symptom as a separate string — what the patient complained of"
  ],
  "examinations": [
    "Each clinical finding or procedure as a separate string — what the doctor examined or found"
  ],
  "presentation": "Final clinical diagnosis or clinical impression. Be specific and use proper medical terminology.",
  "medications": [
    {
      "medicineName": "Generic or brand drug name",
      "dosage": "Dose per intake, e.g., '500mg', '5ml', '2 drops', or 'Not specified'",
      "frequency": "Frequency of intake, e.g., 'Twice daily', 'TID', 'BD', 'SOS', 'OD', or 'Not specified'",
      "duration": "Duration of course, e.g., '5 days', '1 week', 'Continue', or 'Not specified'"
    }
  ],
  "recommendation": "General advice: dietary restrictions, activity advice, home care instructions, follow-up warnings. If none mentioned, use 'Follow standard post-treatment care. Avoid self-medication.'",
  "nextVisit": "Follow-up date or interval (e.g., 'After 5 days', 'After 1 week', '12th Oct 2023', 'As needed'). If not mentioned, use 'As advised by doctor'.",
  "investigations": [
    "Each investigation or lab/imaging test ordered as a separate string (e.g., 'Pure Tone Audiometry', 'CT PNS', 'CBC', 'Nasal swab culture'). Use [] if none ordered."
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rawText } = body;

    if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide at least a brief clinical note (minimum 10 characters).' },
        { status: 400 }
      );
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extract structured prescription data from these ENT clinical notes:\n\n${rawText.trim()}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 2500,
    });

    const rawOutput = response.choices[0]?.message?.content?.trim();

    if (!rawOutput) {
      return NextResponse.json(
        { error: 'The AI did not return a response. Please try again.' },
        { status: 500 }
      );
    }

    // Strip markdown code fences if present (defensive — model sometimes wraps JSON)
    const cleaned = rawOutput
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    try {
      const prescription = JSON.parse(cleaned);

      // Basic structure validation
      if (!prescription.patientInfo || !prescription.medications) {
        throw new Error('Invalid structure');
      }

      return NextResponse.json({ prescription });
    } catch {
      // Last resort: try to extract JSON object from the string
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const prescription = JSON.parse(jsonMatch[0]);
          return NextResponse.json({ prescription });
        } catch {
          // fall through to error
        }
      }

      return NextResponse.json(
        {
          error:
            'Failed to parse the AI response as JSON. Please try rephrasing your notes with clearer medication details.',
          rawOutput: cleaned.slice(0, 500),
        },
        { status: 422 }
      );
    }
  } catch (error: unknown) {
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI API error: ${error.message}` },
        { status: error.status ?? 500 }
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: `Server error: ${message}` }, { status: 500 });
  }
}
