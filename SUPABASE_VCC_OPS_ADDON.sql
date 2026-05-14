-- =========================================================
-- VCC OFFICIAL OPS ADD-ON SQL
-- Run this AFTER your existing VCC Supabase schema.
-- Adds tournaments, categories, roster lock, match rooms, vetoes,
-- reports, disputes, chat, bracket advancement fields, and admin support.
-- Safe update style: no reset/drop tables.
-- =========================================================

create extension if not exists "uuid-ossp";

alter table profiles add column if not exists role text default 'player';
-- To make yourself admin after creating your account, run:
-- update profiles set role = 'owner' where email = 'YOUR_EMAIL_HERE';

create table if not exists tournaments (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  category text default 'Open Qualifier',
  division text default 'Open',
  status text default 'Upcoming',
  format text default 'Single Elimination',
  starts_at timestamptz,
  ends_at timestamptz,
  roster_lock_at timestamptz,
  description text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table tournaments add column if not exists category text default 'Open Qualifier';
alter table tournaments add column if not exists roster_lock_at timestamptz;

create table if not exists tournament_registrations (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid references tournaments(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  captain_id uuid references profiles(id) on delete set null,
  status text default 'pending',
  seed int,
  checked_in boolean default false,
  created_at timestamptz default now(),
  unique(tournament_id, team_id)
);

create table if not exists matches (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid references tournaments(id) on delete cascade,
  round_name text,
  round_number int default 1,
  match_number int,
  team_a_id uuid references teams(id) on delete set null,
  team_b_id uuid references teams(id) on delete set null,
  scheduled_at timestamptz,
  official_timezone text default 'America/Chicago',
  status text default 'scheduled',
  server_region text,
  selected_map text,
  team_a_score int,
  team_b_score int,
  winner_team_id uuid references teams(id) on delete set null,
  next_match_id uuid,
  next_slot text,
  created_at timestamptz default now()
);

alter table matches add column if not exists round_number int default 1;
alter table matches add column if not exists next_match_id uuid;
alter table matches add column if not exists next_slot text;

create table if not exists match_vetoes (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  action text not null,
  value text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists match_reports (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id) on delete cascade,
  reporting_team_id uuid references teams(id) on delete cascade,
  reporter_id uuid references profiles(id) on delete set null,
  team_a_score int not null,
  team_b_score int not null,
  proof_url text,
  status text default 'pending_confirmation',
  created_at timestamptz default now()
);

create table if not exists match_chat (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  message text not null,
  created_at timestamptz default now()
);

create table if not exists disputes (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  opened_by uuid references profiles(id) on delete set null,
  reason text not null,
  proof_url text,
  status text default 'open',
  admin_notes text,
  created_at timestamptz default now()
);

alter table tournaments enable row level security;
alter table tournament_registrations enable row level security;
alter table matches enable row level security;
alter table match_vetoes enable row level security;
alter table match_reports enable row level security;
alter table match_chat enable row level security;
alter table disputes enable row level security;

-- Public read policies

drop policy if exists tournaments_select_all on tournaments;
create policy tournaments_select_all on tournaments for select using (true);

drop policy if exists registrations_select_all on tournament_registrations;
create policy registrations_select_all on tournament_registrations for select using (true);

drop policy if exists matches_select_all on matches;
create policy matches_select_all on matches for select using (true);

drop policy if exists vetoes_select_all on match_vetoes;
create policy vetoes_select_all on match_vetoes for select using (true);

drop policy if exists reports_select_all on match_reports;
create policy reports_select_all on match_reports for select using (true);

drop policy if exists chat_select_all on match_chat;
create policy chat_select_all on match_chat for select using (true);

drop policy if exists disputes_select_all on disputes;
create policy disputes_select_all on disputes for select using (true);

-- Admin helper: owner/admin/moderator can manage tournaments and matches.

drop policy if exists tournaments_admin_all on tournaments;
create policy tournaments_admin_all on tournaments for all using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
) with check (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
);

drop policy if exists matches_admin_all on matches;
create policy matches_admin_all on matches for all using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
) with check (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
);

-- Captains can register their own team.

drop policy if exists registrations_insert_captain on tournament_registrations;
create policy registrations_insert_captain on tournament_registrations for insert with check (
  exists(select 1 from teams t where t.id = team_id and t.captain_id = auth.uid())
);

-- Captains can submit reports, vetoes, chat, and disputes for their own team.

drop policy if exists reports_insert_captain on match_reports;
create policy reports_insert_captain on match_reports for insert with check (
  exists(select 1 from teams t where t.id = reporting_team_id and t.captain_id = auth.uid())
);

drop policy if exists vetoes_insert_captain on match_vetoes;
create policy vetoes_insert_captain on match_vetoes for insert with check (
  exists(select 1 from teams t where t.id = team_id and t.captain_id = auth.uid())
);

drop policy if exists disputes_insert_captain on disputes;
create policy disputes_insert_captain on disputes for insert with check (
  exists(select 1 from teams t where t.id = team_id and t.captain_id = auth.uid())
);

drop policy if exists chat_insert_logged_in on match_chat;
create policy chat_insert_logged_in on match_chat for insert with check (auth.uid() = user_id);

-- =========================================================
-- VCC PRESEASON LEAGUE MODE + AUTO CONFIRMATION ADD-ON
-- Safe to run after the previous VCC ops SQL.
-- =========================================================

alter table tournaments add column if not exists total_weeks int default 5;
alter table tournaments add column if not exists current_week int default 0;
alter table tournaments add column if not exists pairing_mode text default 'bracket';

alter table matches add column if not exists week_number int;
alter table matches add column if not exists team_a_name text;
alter table matches add column if not exists team_b_name text;
alter table matches add column if not exists winner_team_name text;

alter table match_reports add column if not exists reporting_team_name text;
alter table match_reports add column if not exists auto_checked boolean default false;
alter table match_reports add column if not exists matched_report_id uuid;

create table if not exists preseason_standings (
  id uuid primary key default uuid_generate_v4(),
  tournament_id uuid references tournaments(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  team_name text,
  wins int default 0,
  losses int default 0,
  points_for int default 0,
  points_against int default 0,
  point_diff int default 0,
  updated_at timestamptz default now(),
  unique(tournament_id, team_id)
);

alter table preseason_standings enable row level security;

drop policy if exists preseason_standings_select_all on preseason_standings;
create policy preseason_standings_select_all on preseason_standings for select using (true);

drop policy if exists preseason_standings_admin_all on preseason_standings;
create policy preseason_standings_admin_all on preseason_standings for all using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
) with check (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
);
