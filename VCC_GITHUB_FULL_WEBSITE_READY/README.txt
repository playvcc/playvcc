VCC SAFE UPDATE WEBSITE

IMPORTANT:
Do NOT run the old clean reset SQL after teams/profiles exist.
That old reset SQL deletes profiles and teams.

Use this ZIP for future website updates.

To update the site:
1. Upload this website folder to Netlify.
2. In Supabase, run supabase-update-safe.sql only if new database features were added.
3. Do NOT run any SQL that says:
   drop table if exists profiles
   drop table if exists teams

Files:
- supabase-update-safe.sql = safe update SQL that does not erase data
- supabase-schema.sql may be old/reset setup, only use it on a completely new empty project

Your teams and profiles are stored in Supabase, not in the website ZIP.
They only disappear when reset/drop SQL is run.


PROFESSIONAL NAV + PROFILE PICTURE UPDATE:
- Navigation redesigned and organized.
- Mobile menu added.
- Players can upload a profile picture from profile page.
- Player avatars show on Players page.
- Discord CTA added to home page.
- Run supabase-update-safe.sql to add avatar_url without deleting teams/profiles.


SiN ORGANIZER UPDATE:
- Discord button now says SiN Discord.
- Home page states VCC Discord is organized and operated by SiN — Strength in Numbers.
- Hero section includes Organized by SiN language.


ROSTER MANAGEMENT UPDATE:
- Added manage-team.html.
- Captains can move players to Main Roster.
- Captains can move players to Sub.
- Captains can remove/release players from active roster.
- Removed players are shown separately.
- Added Manage Team link to navigation.
- Run supabase-update-safe.sql to add/update policies without deleting data.
