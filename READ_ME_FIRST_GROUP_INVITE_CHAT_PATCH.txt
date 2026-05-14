VCC Group Stage + Invite + Live Chat Patch

ADD / REPLACE THESE FILES:
1. SUPABASE_VCC_GROUP_INVITE_CHAT_ADDON.sql
2. vcc-live.js
3. group-stage-admin.html
4. team-invite.html
5. inbox.html
6. match-room.html

RUN THIS SQL IN SUPABASE:
SUPABASE_VCC_GROUP_INVITE_CHAT_ADDON.sql

WHAT THIS FIXES:
- Adds Group A/B/C/D tournament setup
- Assigns teams to groups
- Generates round robin matches inside each group
- Adds group standings tables
- Sends team invites into player inbox/message system
- Adds inbox page
- Replaces match room with Supabase-powered live chat
- Adds score confirmation
- Matching captain scores auto approve
- Mismatched scores create dispute
- Group standings update after approved group matches

FOR LIVE CHAT:
In Supabase, enable Realtime/Replication for:
match_room_chat
