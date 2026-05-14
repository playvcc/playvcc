VCC FULL COMPLETE WEBSITE — ALL FEATURES INCLUDED

This is the full website package, not just a patch.

UPLOAD TO GITHUB:
Upload everything in this folder to your VCC GitHub Pages repo.

IMPORTANT:
Keep your Supabase project URL/key inside:
supabase-config.js

RUN IN SUPABASE:
Run:
SUPABASE_RUN_ALL_ADDONS.sql

Do NOT run:
DO_NOT_RUN_RESET_SCHEMA.sql
unless you intentionally want to reset your database.

FEATURES INCLUDED:
- Official VCC site pages
- VCC logo/assets
- SiN Discord button
- Admin dashboard
- Secure admin code system files
- Tournament creation/edit structure
- Tournament categories
- Preseason league mode
- Pro point qualifier support
- Group Stage and Group Stage + Playoffs setup
- Group A/B/C/D group creation
- Group team assignment tools
- Group round robin match generation
- Match rooms
- Match room chat
- Score submission system
- Auto-approve if both team scores match
- Dispute if scores do not match
- Scrim queue page
- Match found alert popup
- Match found alert sound
- Server/region ban support
- Map ban/veto support
- Team creation
- One-team-per-user protection
- Team management
- Invite player system
- Player inbox/message system
- Message player page
- Profile message button
- Leaderboards, teams, players, rules, auth pages

SCRIM ALERT SOUND:
Browser sound usually requires the user to click the page once before audio can play.

LIVE CHAT:
For instant chat updates, enable Supabase Realtime for:
match_room_chat

ONE TEAM LIMIT:
The one-team system assumes your teams table uses:
captain_id

If your database uses owner_id instead, the SQL must be adjusted.

AFTER UPLOAD:
Hard refresh the site:
Ctrl + F5
