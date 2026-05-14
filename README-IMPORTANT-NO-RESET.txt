IMPORTANT

Do NOT run DO_NOT_RUN_RESET_SCHEMA.sql unless you intentionally want to wipe the VCC database.

For normal updates, run ONLY:
supabase-update-safe.sql

This safe SQL does not contain:
drop table profiles
drop table teams
drop table team_memberships
drop table team_invites
drop table scrim_queue
drop table scrim_matches

If your data was already reset, Supabase Auth users may still exist, but profiles/teams may need to be recreated unless you have a Supabase backup.
