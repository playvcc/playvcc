-- VCC FULL WEBSITE ADDON SQL
-- Run this after your original Supabase setup exists.
-- Do NOT run DO_NOT_RUN_RESET_SCHEMA.sql unless you want a reset.


-- ===================== SUPABASE_VCC_OPS_ADDON.sql =====================

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



-- ===================== SUPABASE_VCC_QUEUE_ADDON.sql =====================

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



-- ===================== SUPABASE_VCC_INTEGRATED_FIX.sql =====================


-- VCC Integrated Group Stage + Team Invites + Inbox + Match Chat
-- Safe add-on. Does not reset existing database.

create table if not exists tournament_groups (
    id uuid primary key default gen_random_uuid(),
    tournament_id uuid references tournaments(id) on delete cascade,
    group_name text not null,
    sort_order int default 0,
    created_at timestamptz default now()
);

create table if not exists tournament_group_teams (
    id uuid primary key default gen_random_uuid(),
    tournament_id uuid references tournaments(id) on delete cascade,
    group_id uuid references tournament_groups(id) on delete cascade,
    team_id uuid references teams(id) on delete cascade,
    seed int default 0,
    created_at timestamptz default now(),
    unique(group_id, team_id)
);

create table if not exists group_standings (
    id uuid primary key default gen_random_uuid(),
    tournament_id uuid references tournaments(id) on delete cascade,
    group_id uuid references tournament_groups(id) on delete cascade,
    team_id uuid references teams(id) on delete cascade,
    wins int default 0,
    losses int default 0,
    maps_won int default 0,
    maps_lost int default 0,
    rounds_won int default 0,
    rounds_lost int default 0,
    points int default 0,
    updated_at timestamptz default now(),
    unique(group_id, team_id)
);

create table if not exists player_messages (
    id uuid primary key default gen_random_uuid(),
    recipient_user_id uuid,
    recipient_email text,
    sender_user_id uuid,
    message_type text default 'message',
    title text not null,
    body text,
    related_team_id uuid,
    related_tournament_id uuid,
    related_match_id uuid,
    status text default 'unread',
    action_url text,
    created_at timestamptz default now()
);

create table if not exists team_invites (
    id uuid primary key default gen_random_uuid(),
    team_id uuid references teams(id) on delete cascade,
    invited_user_id uuid,
    invited_email text,
    invited_riot_id text,
    invited_by uuid,
    role text default 'player',
    status text default 'pending',
    message_id uuid references player_messages(id) on delete set null,
    created_at timestamptz default now()
);

create table if not exists match_room_chat (
    id uuid primary key default gen_random_uuid(),
    match_id uuid references matches(id) on delete cascade,
    user_id uuid,
    username text,
    message text not null,
    created_at timestamptz default now()
);

create table if not exists match_score_submissions (
    id uuid primary key default gen_random_uuid(),
    match_id uuid references matches(id) on delete cascade,
    team_id uuid,
    team_name text,
    score_team_a int,
    score_team_b int,
    proof_url text,
    submitted_by uuid,
    created_at timestamptz default now()
);

alter table tournaments add column if not exists tournament_category text default 'Qualifier';
alter table tournaments add column if not exists group_count int default 0;
alter table tournaments add column if not exists teams_per_group int default 0;
alter table tournaments add column if not exists advance_per_group int default 2;
alter table tournaments add column if not exists roster_lock_at timestamptz;

alter table matches add column if not exists group_id uuid references tournament_groups(id) on delete set null;
alter table matches add column if not exists round_name text;
alter table matches add column if not exists score_team_a int default 0;
alter table matches add column if not exists score_team_b int default 0;
alter table matches add column if not exists dispute_reason text;

alter table tournament_groups enable row level security;
alter table tournament_group_teams enable row level security;
alter table group_standings enable row level security;
alter table player_messages enable row level security;
alter table team_invites enable row level security;
alter table match_room_chat enable row level security;
alter table match_score_submissions enable row level security;

drop policy if exists tournament_groups_select_all on tournament_groups;
create policy tournament_groups_select_all on tournament_groups for select using (true);
drop policy if exists tournament_groups_insert_all on tournament_groups;
create policy tournament_groups_insert_all on tournament_groups for insert with check (true);
drop policy if exists tournament_groups_update_all on tournament_groups;
create policy tournament_groups_update_all on tournament_groups for update using (true);

drop policy if exists tournament_group_teams_select_all on tournament_group_teams;
create policy tournament_group_teams_select_all on tournament_group_teams for select using (true);
drop policy if exists tournament_group_teams_insert_all on tournament_group_teams;
create policy tournament_group_teams_insert_all on tournament_group_teams for insert with check (true);
drop policy if exists tournament_group_teams_update_all on tournament_group_teams;
create policy tournament_group_teams_update_all on tournament_group_teams for update using (true);

drop policy if exists group_standings_select_all on group_standings;
create policy group_standings_select_all on group_standings for select using (true);
drop policy if exists group_standings_insert_all on group_standings;
create policy group_standings_insert_all on group_standings for insert with check (true);
drop policy if exists group_standings_update_all on group_standings;
create policy group_standings_update_all on group_standings for update using (true);

drop policy if exists player_messages_select_own on player_messages;
create policy player_messages_select_own on player_messages
for select using (
    recipient_user_id = auth.uid()
    or sender_user_id = auth.uid()
    or recipient_email = auth.email()
    or recipient_user_id is null
);
drop policy if exists player_messages_insert_all on player_messages;
create policy player_messages_insert_all on player_messages for insert with check (true);
drop policy if exists player_messages_update_own on player_messages;
create policy player_messages_update_own on player_messages
for update using (
    recipient_user_id = auth.uid()
    or sender_user_id = auth.uid()
    or recipient_email = auth.email()
    or recipient_user_id is null
);

drop policy if exists team_invites_select_all on team_invites;
create policy team_invites_select_all on team_invites for select using (true);
drop policy if exists team_invites_insert_all on team_invites;
create policy team_invites_insert_all on team_invites for insert with check (true);
drop policy if exists team_invites_update_all on team_invites;
create policy team_invites_update_all on team_invites for update using (true);

drop policy if exists match_room_chat_select_all on match_room_chat;
create policy match_room_chat_select_all on match_room_chat for select using (true);
drop policy if exists match_room_chat_insert_logged_in on match_room_chat;
create policy match_room_chat_insert_logged_in on match_room_chat for insert with check (auth.uid() = user_id or user_id is null);

drop policy if exists match_score_submissions_select_all on match_score_submissions;
create policy match_score_submissions_select_all on match_score_submissions for select using (true);
drop policy if exists match_score_submissions_insert_all on match_score_submissions;
create policy match_score_submissions_insert_all on match_score_submissions for insert with check (true);



-- ===================== SUPABASE_VCC_ALERT_MESSAGE_ONE_TEAM.sql =====================


-- VCC Alert + Direct Message + One Team Per User Addon
-- Safe add-on. Does not reset existing database.

create table if not exists direct_messages (
    id uuid primary key default gen_random_uuid(),
    sender_user_id uuid,
    sender_email text,
    recipient_user_id uuid,
    recipient_email text,
    title text default 'VCC Message',
    body text not null,
    status text default 'unread',
    created_at timestamptz default now()
);

alter table direct_messages enable row level security;

drop policy if exists direct_messages_select_own on direct_messages;
create policy direct_messages_select_own on direct_messages
for select using (
    sender_user_id = auth.uid()
    or recipient_user_id = auth.uid()
    or sender_email = auth.email()
    or recipient_email = auth.email()
);

drop policy if exists direct_messages_insert_logged_in on direct_messages;
create policy direct_messages_insert_logged_in on direct_messages
for insert with check (true);

drop policy if exists direct_messages_update_own on direct_messages;
create policy direct_messages_update_own on direct_messages
for update using (
    sender_user_id = auth.uid()
    or recipient_user_id = auth.uid()
    or recipient_email = auth.email()
);

-- One team per creator/captain.
-- This assumes your teams table uses captain_id for the user who created/owns the team.
-- If your table uses owner_id instead, tell me and I will adjust this.
create unique index if not exists one_team_per_captain
on teams(captain_id)
where captain_id is not null;
