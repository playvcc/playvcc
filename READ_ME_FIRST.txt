
VCC Alert Sound + Message Button + One Team Limit Patch

REPLACE:
- create-team.html
- profile.html

ADD:
- vcc-message.js
- vcc-queue-alert.js
- message-player.html
- SUPABASE_VCC_ALERT_MESSAGE_ONE_TEAM.sql

OPTIONAL EDIT:
In scrims.html, add this line after vcc-queue.js:
<script src="vcc-queue-alert.js"></script>

RUN IN SUPABASE:
SUPABASE_VCC_ALERT_MESSAGE_ONE_TEAM.sql

WHAT THIS ADDS:
1. Alert sound when a scrim match is found
2. Message Player button on profile page
3. Direct message page
4. Message also creates inbox notification when player_messages table exists
5. One-team-per-user system
6. Database unique lock so the same captain_id cannot create more than one team

IMPORTANT:
- The one-team system assumes your teams table uses captain_id.
- If your teams table uses owner_id instead, ask for the owner_id version.
- Browser audio requires the user to click the page once before sound can play.
