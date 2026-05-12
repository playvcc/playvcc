
-- =========================================
-- VCC CLEAN RESET FINAL SCHEMA
-- Run this as ONE full query in Supabase SQL Editor.
-- This resets VCC tables only, not Supabase Auth users.
-- =========================================

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists accept_team_invite(uuid) cascade;
drop function if exists join_scrim_queue(uuid, text) cascade;

drop table if exists scrim_matches cascade;
drop table if exists scrim_queue cascade;
drop table if exists team_invites cascade;
drop table if exists team_memberships cascade;
drop table if exists teams cascade;
drop table if exists profiles cascade;

create extension if not exists "uuid-ossp";

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email_private text,
  riot_id text,
  discord text,
  platform text,
  role text,
  bio text,
  avatar_url text,
  looking_for_team boolean not null default true,
  created_at timestamptz default now()
);

create table teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  tag text not null,
  logo_url text not null,
  division text not null,
  status text not null default 'approved',
  captain_id uuid references profiles(id) on delete set null,
  captain_username text not null default '',
  wins int not null default 0,
  losses int not null default 0,
  maps_won int not null default 0,
  maps_lost int not null default 0,
  rounds_won int not null default 0,
  rounds_lost int not null default 0,
  pro_points int not null default 0,
  created_at timestamptz default now()
);

create table team_memberships (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  role_on_team text,
  status text not null default 'active',
  joined_at timestamptz default now(),
  left_at timestamptz
);

create unique index one_active_team_per_player
on team_memberships(player_id)
where status = 'active';

create table team_invites (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references profiles(id) on delete cascade,
  role_offered text,
  message text,
  status text not null default 'pending',
  created_at timestamptz default now()
);

create table scrim_queue (
  id uuid primary key default uuid_generate_v4(),
  team_id uuid not null references teams(id) on delete cascade,
  division text not null,
  status text not null default 'waiting',
  queued_at timestamptz default now()
);

create unique index one_waiting_scrim_per_team
on scrim_queue(team_id)
where status = 'waiting';

create table scrim_matches (
  id uuid primary key default uuid_generate_v4(),
  team_a_id uuid not null references teams(id) on delete cascade,
  team_b_id uuid not null references teams(id) on delete cascade,
  division text not null,
  status text not null default 'matched',
  created_at timestamptz default now()
);

-- Auto-create profile after signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired_username text;
begin
  desired_username := coalesce(
    new.raw_user_meta_data->>'username',
    split_part(new.email, '@', 1),
    'Player'
  );

  insert into public.profiles (
    id,
    username,
    email_private,
    looking_for_team
  )
  values (
    new.id,
    desired_username,
    new.email,
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function accept_team_invite(invite_id_input uuid)
returns text
language plpgsql
security definer
as $$
declare
  invite_row team_invites%rowtype;
  active_count int;
begin
  select * into invite_row
  from team_invites
  where id = invite_id_input
    and status = 'pending';

  if not found then
    raise exception 'Invite not found or already handled.';
  end if;

  if invite_row.player_id <> auth.uid() then
    raise exception 'You can only accept your own invite.';
  end if;

  select count(*) into active_count
  from team_memberships
  where player_id = auth.uid()
    and status = 'active';

  if active_count > 0 then
    raise exception 'You are already on an active team. Leave or be released before accepting another invite.';
  end if;

  insert into team_memberships(team_id, player_id, role_on_team, status)
  values(invite_row.team_id, invite_row.player_id, invite_row.role_offered, 'active');

  update team_invites
  set status = 'accepted'
  where id = invite_id_input;

  update profiles
  set looking_for_team = false
  where id = invite_row.player_id;

  return 'Invite accepted.';
end;
$$;

create or replace function join_scrim_queue(team_id_input uuid, division_input text)
returns text
language plpgsql
security definer
as $$
declare
  my_team teams%rowtype;
  opponent scrim_queue%rowtype;
begin
  select * into my_team from teams where id = team_id_input;

  if not found then
    raise exception 'Team not found.';
  end if;

  if my_team.captain_id <> auth.uid() then
    raise exception 'Only the captain can queue this team.';
  end if;

  select * into opponent
  from scrim_queue
  where status = 'waiting'
    and division = division_input
    and team_id <> team_id_input
  order by queued_at asc
  limit 1;

  if found then
    update scrim_queue
    set status = 'matched'
    where id = opponent.id;

    insert into scrim_matches(team_a_id, team_b_id, division, status)
    values(opponent.team_id, team_id_input, division_input, 'matched');

    return 'Scrim match found.';
  else
    insert into scrim_queue(team_id, division, status)
    values(team_id_input, division_input, 'waiting')
    on conflict do nothing;

    return 'No team found yet. You are now in the scrim queue.';
  end if;
end;
$$;

alter table profiles enable row level security;
alter table teams enable row level security;
alter table team_memberships enable row level security;
alter table team_invites enable row level security;
alter table scrim_queue enable row level security;
alter table scrim_matches enable row level security;

create policy profiles_select_all on profiles
for select using (true);

create policy profiles_insert_any_authenticated on profiles
for insert with check (auth.uid() is not null);

create policy profiles_update_self on profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

create policy teams_select_all on teams
for select using (true);

create policy teams_insert_captain on teams
for insert with check (auth.uid() = captain_id);

create policy teams_update_captain on teams
for update using (auth.uid() = captain_id)
with check (auth.uid() = captain_id);

create policy memberships_select_all on team_memberships
for select using (true);

create policy memberships_insert_authenticated on team_memberships
for insert with check (auth.uid() is not null);

create policy memberships_update_authenticated on team_memberships
for update using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy invites_select_all on team_invites
for select using (true);

create policy invites_insert_authenticated on team_invites
for insert with check (auth.uid() is not null);

create policy invites_update_authenticated on team_invites
for update using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy scrim_queue_select_all on scrim_queue
for select using (true);

create policy scrim_queue_insert_authenticated on scrim_queue
for insert with check (auth.uid() is not null);

create policy scrim_queue_update_authenticated on scrim_queue
for update using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy scrim_matches_select_all on scrim_matches
for select using (true);

create policy scrim_matches_insert_authenticated on scrim_matches
for insert with check (auth.uid() is not null);



-- =========================================
-- VCC FULL SCRIM SYSTEM UPGRADE
-- Run this after the clean schema or as part of it.
-- =========================================

alter table scrim_matches
add column if not exists team_a_ready boolean not null default false;

alter table scrim_matches
add column if not exists team_b_ready boolean not null default false;

alter table scrim_matches
add column if not exists lobby_code text;

alter table scrim_matches
add column if not exists team_a_score int;

alter table scrim_matches
add column if not exists team_b_score int;

alter table scrim_matches
add column if not exists reported_by uuid references profiles(id) on delete set null;

alter table scrim_matches
add column if not exists completed_at timestamptz;

create table if not exists scrim_messages (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null references scrim_matches(id) on delete cascade,
  sender_id uuid references profiles(id) on delete set null,
  message text not null,
  created_at timestamptz default now()
);

alter table scrim_messages enable row level security;

drop policy if exists scrim_messages_select_all on scrim_messages;
create policy scrim_messages_select_all
on scrim_messages
for select
using (true);

drop policy if exists scrim_messages_insert_authenticated on scrim_messages;
create policy scrim_messages_insert_authenticated
on scrim_messages
for insert
with check (auth.uid() is not null);

create or replace function set_scrim_ready(match_id_input uuid)
returns text
language plpgsql
security definer
as $$
declare
  match_row scrim_matches%rowtype;
  my_team_id uuid;
begin
  select * into match_row
  from scrim_matches
  where id = match_id_input;

  if not found then
    raise exception 'Scrim match not found.';
  end if;

  select id into my_team_id
  from teams
  where captain_id = auth.uid()
    and id in (match_row.team_a_id, match_row.team_b_id)
  limit 1;

  if my_team_id is null then
    raise exception 'Only one of the matched team captains can ready up.';
  end if;

  if my_team_id = match_row.team_a_id then
    update scrim_matches set team_a_ready = true where id = match_id_input;
  else
    update scrim_matches set team_b_ready = true where id = match_id_input;
  end if;

  update scrim_matches
  set status = case
    when team_a_ready = true and team_b_ready = true then 'ready'
    else status
  end
  where id = match_id_input;

  return 'Ready confirmed.';
end;
$$;

create or replace function update_scrim_lobby(match_id_input uuid, lobby_code_input text)
returns text
language plpgsql
security definer
as $$
declare
  match_row scrim_matches%rowtype;
  captain_count int;
begin
  select * into match_row
  from scrim_matches
  where id = match_id_input;

  if not found then
    raise exception 'Scrim match not found.';
  end if;

  select count(*) into captain_count
  from teams
  where captain_id = auth.uid()
    and id in (match_row.team_a_id, match_row.team_b_id);

  if captain_count = 0 then
    raise exception 'Only matched team captains can update lobby code.';
  end if;

  update scrim_matches
  set lobby_code = lobby_code_input
  where id = match_id_input;

  return 'Lobby code updated.';
end;
$$;

create or replace function report_scrim_score(match_id_input uuid, team_a_score_input int, team_b_score_input int)
returns text
language plpgsql
security definer
as $$
declare
  match_row scrim_matches%rowtype;
  captain_count int;
begin
  select * into match_row
  from scrim_matches
  where id = match_id_input;

  if not found then
    raise exception 'Scrim match not found.';
  end if;

  select count(*) into captain_count
  from teams
  where captain_id = auth.uid()
    and id in (match_row.team_a_id, match_row.team_b_id);

  if captain_count = 0 then
    raise exception 'Only matched team captains can report score.';
  end if;

  update scrim_matches
  set team_a_score = team_a_score_input,
      team_b_score = team_b_score_input,
      reported_by = auth.uid(),
      status = 'completed',
      completed_at = now()
  where id = match_id_input;

  return 'Scrim score reported.';
end;
$$;

-- Improve scrim queue function so both waiting rows are closed and match is created.
create or replace function join_scrim_queue(team_id_input uuid, division_input text)
returns text
language plpgsql
security definer
as $$
declare
  my_team teams%rowtype;
  opponent scrim_queue%rowtype;
begin
  select * into my_team from teams where id = team_id_input;

  if not found then
    raise exception 'Team not found.';
  end if;

  if my_team.captain_id <> auth.uid() then
    raise exception 'Only the captain can queue this team.';
  end if;

  select * into opponent
  from scrim_queue
  where status = 'waiting'
    and division = division_input
    and team_id <> team_id_input
  order by queued_at asc
  limit 1;

  if found then
    update scrim_queue
    set status = 'matched'
    where id = opponent.id;

    update scrim_queue
    set status = 'matched'
    where team_id = team_id_input
      and status = 'waiting';

    insert into scrim_matches(
      team_a_id,
      team_b_id,
      division,
      status,
      team_a_ready,
      team_b_ready
    )
    values(
      opponent.team_id,
      team_id_input,
      division_input,
      'matched',
      false,
      false
    );

    return 'Scrim match found.';
  else
    insert into scrim_queue(team_id, division, status)
    values(team_id_input, division_input, 'waiting')
    on conflict do nothing;

    return 'No team found yet. You are now in the scrim queue.';
  end if;
end;
$$;

drop policy if exists scrim_matches_insert_authenticated on scrim_matches;
create policy scrim_matches_insert_authenticated
on scrim_matches
for insert
with check (auth.uid() is not null);

drop policy if exists scrim_matches_update_authenticated on scrim_matches;
create policy scrim_matches_update_authenticated
on scrim_matches
for update
using (auth.uid() is not null)
with check (auth.uid() is not null);
