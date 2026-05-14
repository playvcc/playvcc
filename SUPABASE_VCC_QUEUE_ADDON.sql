-- VCC Scrim Queue + Match Alert Addon
create table if not exists scrim_queue (id uuid primary key default gen_random_uuid(), team_id uuid, team_name text not null, captain_id uuid, captain_contact text, region text default 'East', format text default 'BO3', tier text default 'Open', rating int default 1000, status text default 'searching', created_at timestamptz default now());
create table if not exists scrim_matches (id uuid primary key default gen_random_uuid(), team_a_name text not null, team_b_name text not null, region text, format text, tier text, status text default 'ready', winner_name text, final_score text, created_at timestamptz default now());
create table if not exists scrim_match_accepts (id uuid primary key default gen_random_uuid(), match_id uuid references scrim_matches(id) on delete cascade, team_name text not null, accepted boolean default false, created_at timestamptz default now());
alter table scrim_queue enable row level security;
alter table scrim_matches enable row level security;
alter table scrim_match_accepts enable row level security;
drop policy if exists scrim_queue_select_all on scrim_queue; create policy scrim_queue_select_all on scrim_queue for select using (true);
drop policy if exists scrim_queue_insert_all on scrim_queue; create policy scrim_queue_insert_all on scrim_queue for insert with check (true);
drop policy if exists scrim_queue_update_all on scrim_queue; create policy scrim_queue_update_all on scrim_queue for update using (true);
drop policy if exists scrim_matches_select_all on scrim_matches; create policy scrim_matches_select_all on scrim_matches for select using (true);
drop policy if exists scrim_matches_insert_all on scrim_matches; create policy scrim_matches_insert_all on scrim_matches for insert with check (true);
drop policy if exists scrim_matches_update_all on scrim_matches; create policy scrim_matches_update_all on scrim_matches for update using (true);
drop policy if exists scrim_accepts_select_all on scrim_match_accepts; create policy scrim_accepts_select_all on scrim_match_accepts for select using (true);
drop policy if exists scrim_accepts_insert_all on scrim_match_accepts; create policy scrim_accepts_insert_all on scrim_match_accepts for insert with check (true);
drop policy if exists scrim_accepts_update_all on scrim_match_accepts; create policy scrim_accepts_update_all on scrim_match_accepts for update using (true);
