VCC PRESEASON LEAGUE MODE UPDATE

Added:
- Preseason League Mode format option in Admin Dashboard
- Premier-style weekly matchmaking generator
- Week 1 uses seed/team order
- Later weeks pair teams by similar records and try to avoid rematches
- Preseason standings are calculated from completed matches
- Both captains can submit scores in the Match Room
- If both captain score submissions match, the result auto-approves, updates the site, and advances the winner when bracket advancement exists
- If scores do not match, the match becomes Disputed for staff review
- Updated Supabase addon SQL fields for preseason weeks, standings, and auto-confirmed reports

Important:
- This package starts clean with no example tournaments or matches.
- Run SUPABASE_VCC_OPS_ADDON.sql if you are using Supabase.
- Do not run DO_NOT_RUN_RESET_SCHEMA.sql unless intentionally resetting your database.
