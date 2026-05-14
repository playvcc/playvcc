<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Create Team — VCC</title><link rel="stylesheet" href="styles.css">
<link rel="icon" type="image/png" href="assets/favicon.png"></head><body>

<header class="site-header">
  <div class="nav-wrap professional-nav">
    <a class="brand" href="index.html">
      <img src="assets/vcc-logo.png" alt="VCC logo">
      <span>
        <strong>VCC</strong>
        <small>Valorant Console Circuit</small>
      </span>
    </a>

    <button class="mobile-menu-btn" onclick="document.body.classList.toggle('nav-open')">☰</button>

    <nav class="main-nav">
      <a href="index.html">Home</a>
      <a href="leaderboard.html">Leaderboard</a>
      <a href="teams.html">Teams</a>
      <a href="players.html">Players</a>
      <a href="scrims.html">Scrims</a>
      <a href="rules.html">Rules</a>
      <a href="profile.html">Profile</a>
      <a href="create-team.html">Create Team</a>
      <a href="manage-team.html">Manage Team</a>
      <a href="inbox.html">Invites</a>
      <a class="discord-nav" href="https://discord.gg/RsMdZ2nHnx" target="_blank">SiN Discord</a>
    </nav>
  </div>
</header>


<main class="page">
  <h1>Create Team</h1>
  <div id="status" class="status">Loading...</div>

  <section class="form">
    <h2>Create Team</h2>
    <div class="grid two">
      <label>Team Name<input id="teamName"></label>
      <label>Team Tag<input id="teamTag"></label>
    </div>
    
<label>Team Logo <span class="small">(required)</span>
<input id="teamLogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">
</label>

<div style="margin-top:12px">
  <img id="logoPreview" src="" alt="Logo preview" style="display:none;width:120px;height:120px;object-fit:contain;background:#111827;padding:10px;border-radius:16px;border:1px solid #1f2937;">
</div>

<label>Division
      <select id="division">
        <option>VCC Elite</option>
        <option>VCC Contenders</option>
        <option>WCC — Women’s Console Circuit</option>
      </select>
    </label>
    <button class="btn primary" id="createBtn">Create Team</button>
  </section>

  <section class="form" style="margin-top:20px">
    <h2>Send Invite</h2>
    <p class="small">Invite players by username. Emails are never displayed.</p>
    <label>Your Team<select id="teamSelect"></select></label>
    <div class="grid two">
      <label>Player Username<input id="inviteUsername"></label>
      <label>Role Offered<input id="inviteRole"></label>
    </div>
    <label>Message<textarea id="inviteMessage" rows="3"></textarea></label>
    <button class="btn primary" id="inviteBtn">Send Invite</button>
  </section>
</main>

<script type="module">
import { requireUser, supabase, setStatus } from './app.js'

const user = await requireUser()

async function getCaptainUsername() {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw error

  if (profile && profile.username) return profile.username

  const fallback =
    user.user_metadata?.username ||
    user.email?.split('@')[0] ||
    'Captain'

  await supabase.from('profiles').upsert({
    id: user.id,
    username: fallback,
    email_private: user.email,
    looking_for_team: false
  })

  return fallback
}

async function loadCaptainTeams() {
  const { data, error } = await supabase
    .from('teams')
    .select('id,name')
    .eq('captain_id', user.id)

  if (error) {
    setStatus(error.message)
    return
  }

  teamSelect.innerHTML = (data || [])
    .map(t => `<option value="${t.id}">${t.name}</option>`)
    .join('') || '<option value="">No team yet</option>'
}


window.teamLogoData = null

document.getElementById('teamLogoFile').addEventListener('change', async (e) => {
  const file = e.target.files[0]

  if (!file) return

  if (file.size > 5 * 1024 * 1024) {
    setStatus('Logo must be under 5MB.')
    return
  }

  const reader = new FileReader()

  reader.onload = () => {
    window.teamLogoData = reader.result

    const preview = document.getElementById('logoPreview')
    preview.src = reader.result
    preview.style.display = 'block'

    setStatus('Logo uploaded.')
  }

  reader.readAsDataURL(file)
})


createBtn.onclick = async () => {
  try {
    if (!teamName.value.trim() || !teamTag.value.trim() || !window.teamLogoData) {
      setStatus('Team name, tag, and team logo are required.')
      return
    }

    setStatus('Creating team...')

    const captainUsername = await getCaptainUsername()

    const { data: team, error } = await supabase
      .from('teams')
      .insert({
        name: teamName.value.trim(),
        tag: teamTag.value.trim(),
        logo_url: window.teamLogoData,
        division: division.value,
        status: 'approved',
        captain_id: user.id,
        captain_username: captainUsername,
        wins: 0,
        losses: 0,
        maps_won: 0,
        maps_lost: 0,
        rounds_won: 0,
        rounds_lost: 0,
        pro_points: 0
      })
      .select()
      .single()

    if (error) {
      setStatus(error.message)
      return
    }

    const { error: membershipError } = await supabase
      .from('team_memberships')
      .insert({
        team_id: team.id,
        player_id: user.id,
        role_on_team: 'Captain / Main Roster',
        status: 'active'
      })

    if (membershipError) {
      setStatus(membershipError.message)
      return
    }

    await supabase
      .from('profiles')
      .update({ looking_for_team: false })
      .eq('id', user.id)

    setStatus('Team created and roster updated.')
    await loadCaptainTeams()
  } catch (err) {
    setStatus(err.message || String(err))
  }
}

inviteBtn.onclick = async () => {
  try {
    const username = inviteUsername.value.trim()

    if (!username) {
      setStatus('Enter a player username.')
      return
    }

    if (!teamSelect.value) {
      setStatus('Create a team first.')
      return
    }

    const { data: player, error: playerError } = await supabase
      .from('profiles')
      .select('id,username')
      .ilike('username', username)
      .maybeSingle()

    if (playerError) {
      setStatus(playerError.message)
      return
    }

    if (!player) {
      setStatus('No player found with that username.')
      return
    }

    const { error } = await supabase
      .from('team_invites')
      .insert({
        team_id: teamSelect.value,
        player_id: player.id,
        role_offered: inviteRole.value.trim(),
        message: inviteMessage.value.trim()
      })

    setStatus(error ? error.message : 'Invite sent to ' + player.username)
  } catch (err) {
    setStatus(err.message || String(err))
  }
}

setStatus('Ready.')
loadCaptainTeams()
</script>
</body></html>