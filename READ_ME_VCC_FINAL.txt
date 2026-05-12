VCC FINAL OFFICIAL WEBSITE PACKAGE

Included:
- Original VCC branding and pages preserved
- Uploaded VCC logo installed as assets/vcc-logo.png, assets/logo.png, and assets/favicon.png
- New Tournaments page
- New Matches page
- New Match Room page with countdown, map/server veto, match chat, and score submission
- New Admin Dashboard to add/edit tournaments, create matches, and approve/edit results
- Supabase add-on SQL for real backend tournament/match/admin tables

IMPORTANT ADMIN NOTE:
The current admin dashboard includes a local demo admin code: VCCADMIN
This is useful for testing on GitHub Pages, but it is not true security.
Before going fully public, connect the admin dashboard to Supabase role-based auth using SUPABASE_VCC_OPS_ADDON.sql.

Upload instructions:
1. Upload all files in this folder to GitHub Pages or Netlify.
2. Keep .nojekyll in the root for GitHub Pages.
3. Copy your Supabase URL and anon key into supabase-config.js.
4. Run supabase-update-safe.sql first if needed.
5. Run SUPABASE_VCC_OPS_ADDON.sql after your existing schema.
6. Make your own profile an owner in Supabase:
   update profiles set role = 'owner' where email = 'YOUR_EMAIL_HERE';

New pages:
- tournaments.html
- matches.html
- match-room.html
- admin.html

