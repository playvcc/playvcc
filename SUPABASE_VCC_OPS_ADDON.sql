-- VCC OFFICIAL OPS ADD-ON
-- Run this AFTER your existing VCC Supabase schema.
-- This adds tournament, match room, veto, score report, dispute, chat, and admin-role support.

create extension if not exists "uuid-ossp";

alter table profiles add column if not exists role text default 'player';
-- To make yourself admin after creating your account, run:
-- update profiles set role = 'owner' where email = 'YOUR_EMAIL_HERE';

create table if not exists tournaments (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  division text default 'Open',
  status text default 'registration_open',
  format text default 'open_qualifier',
  starts_at timestamptz,
  ends_at timestamptz,
  description text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

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
  created_at timestamptz default now()
);

create table if not exists match_vetoes (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  action text not null, -- map_ban, map_pick, server_ban, side_pick
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
  status text default 'pending_confirmation', -- pending_confirmation, verified, disputed, rejected
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

create policy if not exists tournaments_select_all on tournaments for select using (true);
create policy if not exists registrations_select_all on tournament_registrations for select using (true);
create policy if not exists matches_select_all on matches for select using (true);
create policy if not exists vetoes_select_all on match_vetoes for select using (true);
create policy if not exists reports_select_all on match_reports for select using (true);
create policy if not exists chat_select_all on match_chat for select using (true);
create policy if not exists disputes_select_all on disputes for select using (true);

-- Admin helper: owner/admin/moderator can manage tournaments and matches.
create policy if not exists tournaments_admin_all on tournaments for all using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
) with check (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
);

create policy if not exists matches_admin_all on matches for all using (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
) with check (
  exists(select 1 from profiles p where p.id = auth.uid() and p.role in ('owner','admin','moderator'))
);

-- Captains can register their own team.
create policy if not exists registrations_insert_captain on tournament_registrations for insert with check (
  exists(select 1 from teams t where t.id = team_id and t.captain_id = auth.uid())
);

-- Captains can submit reports, vetoes, chat, and disputes for their own team.
create policy if not exists reports_insert_captain on match_reports for insert with check (
  exists(select 1 from teams t where t.id = reporting_team_id and t.captain_id = auth.uid())
);

create policy if not exists vetoes_insert_captain on match_vetoes for insert with check (
  exists(select 1 from teams t where t.id = team_id and t.captain_id = auth.uid())
);

create policy if not exists disputes_insert_captain on disputes for insert with check (
  exists(select 1 from teams t where t.id = team_id and t.captain_id = auth.uid())
);

create policy if not exists chat_insert_logged_in on match_chat for insert with check (auth.uid() = user_id);
