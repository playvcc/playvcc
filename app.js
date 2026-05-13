
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function getUser(){ const {data}=await supabase.auth.getUser(); return data.user }
export async function requireUser(){ const user=await getUser(); if(!user){ location.href='auth.html'; return null } return user }
export function setStatus(msg){ const el=document.querySelector('#status'); if(el) el.textContent=msg }

export async function getProfile(userId){
  const {data,error}=await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if(error) throw error
  return data
}
export async function upsertProfile(profile){
  const {error}=await supabase.from('profiles').upsert(profile)
  if(error) throw error
}
export async function getTeams(){
  const {data,error}=await supabase
    .from('teams')
    .select('id,name,tag,logo_url,division,status,wins,losses,maps_won,maps_lost,rounds_won,rounds_lost,pro_points,captain_id,created_at,team_memberships(status,role_on_team,profiles(id,username,riot_id,role,platform))')
    .order('pro_points',{ascending:false})
  if(error) throw error
  return data||[]
}
export async function getPlayers(){
  const {data,error}=await supabase
    .from('profiles')
    .select('id,username,riot_id,role,platform,bio,avatar_url,looking_for_team,created_at,team_memberships(status,role_on_team,teams(name,division))')
    .order('username')
  if(error) throw error
  return data||[]
}
export async function getCurrentMembership(userId){
  const {data,error}=await supabase.from('team_memberships').select('*,teams(name,division)').eq('player_id',userId).eq('status','active').maybeSingle()
  if(error) throw error
  return data
}
export function subscribeToTable(table, callback){
  return supabase.channel(table+'_changes').on('postgres_changes',{event:'*',schema:'public',table},callback).subscribe()
}
