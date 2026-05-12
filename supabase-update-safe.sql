
-- =========================================
-- VCC SAFE UPDATE ONLY
-- This file NEVER deletes teams, profiles, users, invites, or scrims.
-- Safe to run after the site already has data.
-- =========================================

create extension if not exists "uuid-ossp";

-- PROFILES SAFE COLUMNS
alter table profiles add column if not exists username text;
alter table profiles add column if not exists email_private text;
alter table profiles add column if not exists riot_id text;
alter table profiles add column if not exists discord text;
alter table profiles add column if not exists platform text;
alter table profiles add column if not exists role text;
alter table profiles add column if not exists bio text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists looking_for_team boolean not null default true;
alter table profiles add column if not exists created_at timestamptz default now();

-- TEAMS SAFE COLUMNS
alter table teams add column if not exists tag text default '';
alter table teams add column if not exists logo_url text;
alter table teams add column if not exists division text default 'VCC Contenders';
alter table teams add column if not exists status text not null default 'approved';
alter table teams add column if not exists captain_id uuid references profiles(id) on delete set null;
alter table teams add column if not exists captain_username text not null default '';
alter table teams add column if not exists wins int not null default 0;
alter table teams add column if not exists losses int not null default 0;
alter table teams add column if not exists maps_won int not null default 0;
alter table teams add column if not exists maps_lost int not null default 0;
alter table teams add column if not exists rounds_won int not null default 0;
alter table teams add column if not exists rounds_lost int not null default 0;
alter table teams add column if not exists pro_points int not null default 0;
alter table teams add column if not exists created_at timestamptz default now();

-- TABLES SAFE CREATE ONLY
create table if not exists team_memberships (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  player_id uuid references profiles(id) on delete cascade,
  role_on_team text,
  status text not null default 'active',
  joined_at timestamptz default now(),
  left_at timestamptz
);

create unique index if not exists one_active_team_per_player
on team_memberships(player_id)
where status = 'active';

create table if not exists team_invites (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  player_id uuid references profiles(id) on delete cascade,
  role_offered text,
  message text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create table if not exists scrim_queue (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid references teams(id) on delete cascade,
  division text not null default 'Open Scrim',
  status text not null default 'waiting',
  queued_at timestamptz default now()
);

create unique index if not exists one_waiting_scrim_per_team
on scrim_queue(team_id)
where status = 'waiting';

create table if not exists scrim_matches (
  id uuid primary key default uuid_generate_v4(),
  team_a_id uuid references teams(id) on delete cascade,
  team_b_id uuid references teams(id) on delete cascade,
  division text not null default 'Open Scrim',
  status text not null default 'matched',
  created_at timestamptz default now()
);

alter table scrim_matches add column if not exists team_a_ready boolean not null default false;
alter table scrim_matches add column if not exists team_b_ready boolean not null default false;
alter table scrim_matches add column if not exists lobby_code text;
alter table scrim_matches add column if not exists team_a_score int;
alter table scrim_matches add column if not exists team_b_score int;
alter table scrim_matches add column if not exists reported_by uuid references profiles(id) on delete set null;
alter table scrim_matches add column if not exists completed_at timestamptz;

create table if not exists scrim_messages (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references scrim_matches(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  message text not null,
  created_at timestamptz default now()
);

-- RLS ENABLE ONLY
alter table profiles enable row level security;
alter table teams enable row level security;
alter table team_memberships enable row level security;
alter table team_invites enable row level security;
alter table scrim_queue enable row level security;
alter table scrim_matches enable row level security;
alter table scrim_messages enable row level security;

-- SAFE POLICIES
drop policy if exists profiles_select_all on profiles;
create policy profiles_select_all on profiles for select using (true);

drop policy if exists profiles_insert_any_authenticated on profiles;
create policy profiles_insert_any_authenticated on profiles for insert with check (auth.uid() is not null);

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists teams_select_all on teams;
create policy teams_select_all on teams for select using (true);

drop policy if exists teams_insert_captain on teams;
create policy teams_insert_captain on teams for insert with check (auth.uid() = captain_id);

drop policy if exists teams_update_captain on teams;
create policy teams_update_captain on teams for update using (auth.uid() = captain_id) with check (auth.uid() = captain_id);

drop policy if exists memberships_select_all on team_memberships;
create policy memberships_select_all on team_memberships for select using (true);

drop policy if exists memberships_insert_authenticated on team_memberships;
create policy memberships_insert_authenticated on team_memberships for insert with check (auth.uid() is not null);

drop policy if exists memberships_update_authenticated on team_memberships;
create policy memberships_update_authenticated on team_memberships for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists invites_select_all on team_invites;
create policy invites_select_all on team_invites for select using (true);

drop policy if exists invites_insert_authenticated on team_invites;
create policy invites_insert_authenticated on team_invites for insert with check (auth.uid() is not null);

drop policy if exists invites_update_authenticated on team_invites;
create policy invites_update_authenticated on team_invites for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists scrim_queue_select_all on scrim_queue;
create policy scrim_queue_select_all on scrim_queue for select using (true);

drop policy if exists scrim_queue_insert_authenticated on scrim_queue;
create policy scrim_queue_insert_authenticated on scrim_queue for insert with check (auth.uid() is not null);

drop policy if exists scrim_queue_update_authenticated on scrim_queue;
create policy scrim_queue_update_authenticated on scrim_queue for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists scrim_matches_select_all on scrim_matches;
create policy scrim_matches_select_all on scrim_matches for select using (true);

drop policy if exists scrim_matches_update_authenticated on scrim_matches;
create policy scrim_matches_update_authenticated on scrim_matches for update using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists scrim_messages_select_all on scrim_messages;
create policy scrim_messages_select_all on scrim_messages for select using (true);

drop policy if exists scrim_messages_insert_authenticated on scrim_messages;
create policy scrim_messages_insert_authenticated on scrim_messages for insert with check (auth.uid() is not null);


-- =========================================
-- PROFILE PICTURE STORAGE SAFE UPDATE
-- Does NOT delete data.
-- =========================================

alter table profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', true)
on conflict (id) do update set public = true;

drop policy if exists "profile_pictures_public_read" on storage.objects;
create policy "profile_pictures_public_read"
on storage.objects
for select
using (bucket_id = 'profile-pictures');

drop policy if exists "profile_pictures_authenticated_upload" on storage.objects;
create policy "profile_pictures_authenticated_upload"
on storage.objects
for insert
with check (
  bucket_id = 'profile-pictures'
  and auth.uid() is not null
);

drop policy if exists "profile_pictures_authenticated_update" on storage.objects;
create policy "profile_pictures_authenticated_update"
on storage.objects
for update
using (
  bucket_id = 'profile-pictures'
  and auth.uid() is not null
)
with check (
  bucket_id = 'profile-pictures'
  and auth.uid() is not null
);
