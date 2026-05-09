GITHUB PAGES SETUP

Upload the CONTENTS of this ZIP directly to the root of your GitHub repository.

The root must show:
- index.html
- styles.css
- app.js
- assets folder

Do NOT upload the whole folder as one folder.

Correct:
repo root / index.html

Wrong:
repo root / vcc_github_pages_ready / index.html

GitHub Pages settings:
1. Repository > Settings
2. Pages
3. Source: Deploy from a branch
4. Branch: main
5. Folder: /root
6. Save

Free website URL:
If repo is VCC:
https://trozii.github.io/VCC/

If repo is playvcc:
https://trozii.github.io/playvcc/

For database updates:
Use supabase-update-safe.sql only.
Do NOT run reset SQL if you want to keep teams/profiles.
