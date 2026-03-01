import { createClient } from '@supabase/supabase-js';

// Fall back to placeholders so createClient doesn't throw at module load time.
// Requests will fail gracefully (caught by each page's try-catch / setError).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseKey);
