Add/replace these files on GitHub:
1. scrims.html
2. vcc-queue.js
3. match-room.html
4. vcc-match-room.js

Optional SQL:
- SUPABASE_VCC_QUEUE_ADDON.sql
Run this only if you want Supabase tables ready for future realtime queue sync.

Adds:
- Scrim queue page
- Match found popup
- Accept/decline match
- Auto match room creation
- Map bans
- Server/region bans
- Match chat
- Score submissions
- Auto approve if both scores match
- Auto dispute if scores do not match

This GitHub Pages patch uses browser localStorage so it works immediately on the front end.
True live multi-user queue requires a Supabase Realtime upgrade later.
