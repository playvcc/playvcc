// VCC Manage Team: invite by email, display name, username, Riot ID, or UUID.

(function(){
  let user = null;
  let supabase = null;
  let captainTeams = [];

  const statusBox = document.getElementById('manageStatus');
  const teamSelect = document.getElementById('teamSelect');
  const membersBox = document.getElementById('membersBox');
  const teamLabel = document.getElementById('teamLabel');

  function setStatus(msg){
    if(statusBox) statusBox.textContent = msg;
  }

  function safe(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[c]));
  }

  function isUuid(value){
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  async function load(){
    try{
      supabase = await getSupabase();

      const session = await supabase.auth.getSession();
      user = session?.data?.session?.user || null;

      if(!user){
        setStatus('Log in first.');
        setTimeout(() => location.href = 'auth.html?mode=login', 800);
        return;
      }

      const result = await supabase
        .from('teams')
        .select('*')
        .eq('captain_id', user.id)
        .order('created_at', { ascending:false });

      if(result.error) throw result.error;

      captainTeams = result.data || [];

      if(!captainTeams.length){
        setStatus('You are not the captain of any team.');
        if(teamSelect) teamSelect.innerHTML = '<option>No captain teams found</option>';
        if(membersBox) membersBox.innerHTML = '<div class="log">Create a team first.</div>';
        return;
      }

      teamSelect.innerHTML = captainTeams
        .map(t => `<option value="${safe(t.id)}">${safe(t.name)} (${safe(t.division || 'open')})</option>`)
        .join('');

      setStatus('Captain teams loaded.');
      await loadMembers();

    }catch(error){
      setStatus('Manage team error: ' + error.message);
    }
  }

  async function loadMembers(){
    try{
      const teamId = teamSelect.value;
      const team = captainTeams.find(t => t.id === teamId);

      if(teamLabel) teamLabel.textContent = team ? team.name : 'Team';

      if(!membersBox) return;

      const result = await supabase
        .from('team_memberships')
        .select('*, profiles(*)')
        .eq('team_id', teamId)
        .eq('status', 'active')
        .order('created_at', { ascending:true });

      if(result.error) throw result.error;

      const members = result.data || [];

      if(!members.length){
        membersBox.innerHTML = '<div class="log">No members found.</div>';
        return;
      }

      membersBox.innerHTML = members.map(m => {
        const memberId = m.user_id || m.player_id;
        const name = m.profiles?.display_name || m.profiles?.username || m.profiles?.riot_id || memberId;
        const isCaptain = memberId === user.id || m.role === 'captain';

        return `
          <div class="vcc-card" style="margin-bottom:12px">
            <div class="identity-row">
              <span>${safe(name)}</span>
              <strong>${safe(m.role || 'player')}</strong>
            </div>

            <div class="grid">
              <select class="roleSelect" data-id="${safe(m.id)}" ${isCaptain ? 'disabled' : ''}>
                <option value="captain" ${m.role === 'captain' ? 'selected' : ''}>Captain</option>
                <option value="main" ${m.role === 'main' ? 'selected' : ''}>Main Roster</option>
                <option value="sub" ${m.role === 'sub' ? 'selected' : ''}>Substitute</option>
                <option value="player" ${(!m.role || m.role === 'player') ? 'selected' : ''}>Player</option>
              </select>

              <button class="saveRoleBtn" data-id="${safe(m.id)}" ${isCaptain ? 'disabled' : ''}>Save Roster Role</button>
              <button class="kickBtn secondary" data-id="${safe(m.id)}" data-name="${safe(name)}" ${isCaptain ? 'disabled' : ''}>Kick Member</button>
            </div>

            ${isCaptain ? '<p class="muted">Captain cannot be kicked from their own team.</p>' : ''}
          </div>
        `;
      }).join('');

      document.querySelectorAll('.saveRoleBtn').forEach(btn => {
        btn.addEventListener('click', () => saveRole(btn.dataset.id));
      });

      document.querySelectorAll('.kickBtn').forEach(btn => {
        btn.addEventListener('click', () => kickMember(btn.dataset.id, btn.dataset.name));
      });

    }catch(error){
      if(membersBox) membersBox.innerHTML = `<div class="log">Roster error: ${safe(error.message)}</div>`;
    }
  }

  async function saveRole(membershipId){
    try{
      const select = document.querySelector(`.roleSelect[data-id="${membershipId}"]`);
      const role = select.value;

      setStatus('Saving roster role...');

      const result = await supabase
        .from('team_memberships')
        .update({ role })
        .eq('id', membershipId);

      if(result.error) throw result.error;

      setStatus('Roster role updated.');
      await loadMembers();
    }catch(error){
      setStatus('Role update error: ' + error.message);
    }
  }

  async function kickMember(membershipId, name){
    try{
      if(!confirm(`Kick ${name} from the team?`)) return;

      setStatus('Kicking member...');

      let result = await supabase
        .from('team_memberships')
        .update({ status:'removed' })
        .eq('id', membershipId)
        .select();

      if(result.error) throw result.error;

      if(!result.data || !result.data.length){
        result = await supabase
          .from('team_memberships')
          .delete()
          .eq('id', membershipId)
          .select();

        if(result.error) throw result.error;
      }

      setStatus('Member removed from team.');
      await loadMembers();
    }catch(error){
      setStatus('Kick member error: ' + error.message);
    }
  }

  async function findPlayerBySearch(value){
    const search = value.trim();

    if(!search) return null;

    if(isUuid(search)){
      const byId = await supabase
        .from('profiles')
        .select('*')
        .eq('id', search)
        .maybeSingle();

      if(byId.error && byId.error.code !== 'PGRST116') throw byId.error;
      if(byId.data) return byId.data;
    }

    const exact = await supabase
      .from('profiles')
      .select('*')
      .or(`email.eq.${search},username.eq.${search},display_name.eq.${search},riot_id.eq.${search}`)
      .limit(2);

    if(exact.error) throw exact.error;

    if(exact.data && exact.data.length === 1) return exact.data[0];

    const partial = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${search}%,display_name.ilike.%${search}%,riot_id.ilike.%${search}%,email.ilike.%${search}%`)
      .limit(10);

    if(partial.error) throw partial.error;

    if(!partial.data || !partial.data.length) return null;

    if(partial.data.length > 1){
      const names = partial.data
        .map(p => `${p.display_name || p.username || p.email || p.id}${p.riot_id ? ' / ' + p.riot_id : ''}`)
        .join(', ');

      throw new Error(`Multiple players matched "${search}". Be more specific. Matches: ${names}`);
    }

    return partial.data[0];
  }

  async function sendInvite(){
    try{
      const teamId = teamSelect.value;
      const team = captainTeams.find(t => t.id === teamId);

      if(!team){
        setStatus('Select a team first.');
        return;
      }

      const emailInput = document.getElementById('inviteEmail');
      const userInput = document.getElementById('inviteUserId');

      const email = (emailInput?.value || '').trim();
      const searchValue = (userInput?.value || '').trim();

      if(!email && !searchValue){
        setStatus('Enter a player email, name, username, Riot ID, or profile/user ID.');
        return;
      }

      setStatus('Finding player...');

      let player = null;

      if(searchValue){
        player = await findPlayerBySearch(searchValue);
      }

      if(!player && email){
        player = await findPlayerBySearch(email);
      }

      let recipientUserId = player?.id || null;
      let recipientEmail = player?.email || email || null;

      if(!recipientUserId && !recipientEmail){
        setStatus('Player not found. Use their exact email, display name, username, Riot ID, or UUID.');
        return;
      }

      setStatus(`Sending invite${player ? ' to ' + (player.display_name || player.username || player.riot_id || player.email) : ''}...`);

      const msg = await supabase
        .from('player_messages')
        .insert({
          sender_user_id:user.id,
          sender_email:user.email || null,
          recipient_user_id:recipientUserId,
          recipient_email:recipientEmail,
          title:`Invite to ${team.name}`,
          body:`You have been invited to join ${team.name} on VCC.`,
          message_type:'team_invite',
          related_team_id:team.id,
          status:'unread'
        })
        .select()
        .single();

      if(msg.error) throw msg.error;

      await supabase.from('team_invites').insert({
        team_id:team.id,
        invited_user_id:recipientUserId,
        invited_email:recipientEmail,
        invited_by:user.id,
        role:'player',
        status:'pending',
        message_id:msg.data.id
      });

      setStatus('Invite sent to player inbox.');
      if(emailInput) emailInput.value = '';
      if(userInput) userInput.value = '';

    }catch(error){
      setStatus('Invite error: ' + error.message);
    }
  }

  teamSelect?.addEventListener('change', loadMembers);
  document.getElementById('sendInviteBtn')?.addEventListener('click', sendInvite);

  load();
})();
