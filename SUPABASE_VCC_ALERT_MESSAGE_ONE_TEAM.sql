
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
