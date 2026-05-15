import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export async function currentUser(){const {data}=await supabase.auth.getSession();return data?.session?.user||null}
export function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
export function subscribe(table,cb){return supabase.channel(table).on('postgres_changes',{event:'*',schema:'public',table},cb).subscribe()}
