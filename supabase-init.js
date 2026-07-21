/* ══════════════════════════════════════════════
   SAGE WEALTH — supabase-init.js
   ══════════════════════════════════════════════ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://icppowtkvcmfiwmodsff.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Lmz5J5Pt464tDqNZubcnDw_aLK_K3E4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
