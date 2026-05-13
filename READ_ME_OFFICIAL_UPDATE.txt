VCC OFFICIAL UPDATE

What was changed:
- Updated every SiN Discord button/link to: https://discord.gg/qCDzKjKZ2v
- Removed default example tournaments and example matches. The site now starts clean.
- Added admin tournament customization: name, category, status, format, start time, roster lock time, description, and seed/team list.
- Added tournament categories: Open Qualifier, Weekly Cup, Major, LCQ, Championship Finals, Academy Circuit, and Champions Circuit.
- Added automatic bracket generation from seeded teams.
- Added balanced first-round matchups: highest seed vs lowest seed, second highest vs second lowest, etc.
- Added winner advancement: when admin saves a result, the winner moves into the next bracket match automatically.
- Added clean match-room support for map bans, server/region decisions, match chat, score submission, proof URL, and admin approval.

Important:
- Admin code remains: VCC2026
- Backup admin code remains: SINVCC
- Run SUPABASE_VCC_OPS_ADDON.sql in Supabase if you want the updated database fields.
- Do NOT run DO_NOT_RUN_RESET_SCHEMA.sql unless you are intentionally resetting the entire database.

If you already uploaded the old website:
- Best method: replace all existing GitHub/Netlify files with everything inside this zip.
- Minimum required files to update: admin.html, tournaments.html, matches.html, match-room.html, vcc-ops.js, styles.css, SUPABASE_VCC_OPS_ADDON.sql, and any HTML file with the old Discord link.
