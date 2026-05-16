// VCC Manage Team: roster role controls + kick member

(function(){
  let user = null;
  let supabase = null;
  let captainTeams = [];

  const statusBox = document.getElementById('manageStatus');
  const teamSelect = document.getElementById('teamSelect');
  const membersBox = document.getElementById('membersBox');
  const teamLabel = document.getElementById('teamLabel');

  function setStatus(msg){ statusBox.textContent = msg; }

  function safe(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[c]));
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
        teamSelect.innerHTML = '<option>No captain teams found</option>';
        membersBox.innerHTML = '<div class="log">Create a team first.</div>';
        return;
      }

      teamSelect.innerHTML = captainTeams.map(t => `<option value="${safe(t.id)}">${safe(t.name)} (${safe(t.division || 'open')})</option>`).join('');
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
      teamLabel.textContent = team ? team.name : 'Team';

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
        const name = m.profiles?.display_name || m.profiles?.username || memberId;
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
      membersBox.innerHTML = `<div class="log">Roster error: ${safe(error.message)}</div>`;
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

  async function sendInvite(){
    try{
      const teamId = teamSelect.value;
      const team = captainTeams.find(t => t.id === teamId);
      if(!team){
        setStatus('Select a team first.');
        return;
      }

      const email = document.getElementById('inviteEmail').value.trim();
      const userId = document.getElementById('inviteUserId').value.trim();

      if(!email && !userId){
        setStatus('Enter a player email or profile/user ID.');
        return;
      }

      setStatus('Sending invite message...');

      const msg = await supabase
        .from('player_messages')
        .insert({
          sender_user_id:user.id,
          sender_email:user.email || null,
          recipient_user_id:userId || null,
          recipient_email:email || null,
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
        invited_user_id:userId || null,
        invited_email:email || null,
        invited_by:user.id,
        role:'player',
        status:'pending',
        message_id:msg.data.id
      });

      setStatus('Invite sent to player inbox.');
    }catch(error){
      setStatus('Invite error: ' + error.message);
    }
  }

  teamSelect.addEventListener('change', loadMembers);
  document.getElementById('sendInviteBtn').addEventListener('click', sendInvite);

  load();
})();
