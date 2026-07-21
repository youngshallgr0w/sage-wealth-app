/* ══════════════════════════════════════════════
   SAGE WEALTH — supabase-init.js
   ══════════════════════════════════════════════ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://qvtpzeidbdxobwkbewqp.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xJSaJlUbe7QEa9CKb8ecxA_HeAiPZFf';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
