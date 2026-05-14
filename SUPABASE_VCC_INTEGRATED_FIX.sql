
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
