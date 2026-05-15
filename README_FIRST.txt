VCC FULL WORKING SITE BUILD

This is a fresh full site build, not the barebones emergency version.

UPLOAD:
1. Delete the broken GitHub repo files.
2. Upload the CONTENTS of this zip to the repo root.
3. Do not upload the folder itself.
4. Edit supabase-config.js and add your Supabase URL + anon key.
5. Commit.

SUPABASE:
Run SUPABASE_FULL_SETUP.sql in Supabase SQL Editor.

ADMIN:
After creating your account, copy your Auth UUID and run:

insert into admins (user_id, email)
values ('YOUR_AUTH_UUID','YOUR_EMAIL')
on conflict (user_id) do update set email = excluded.email;

VERIFY:
Every .html file starts with <!DOCTYPE html>.
Every JS file is separate.
No raw JS should appear on pages.
