// VCC inbox + accept invite compatibility fix: writes user_id and player_id.

(function(){
  let supabase = null;
  let user = null;
  let messages = [];

  const statusBox = document.getElementById('inboxStatus');
  const inboxBox = document.getElementById('inboxBox');

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
        inboxBox.innerHTML = '<div class="vcc-card"><a class="btn" href="auth.html?mode=login">Sign In</a></div>';
        return;
      }

      const result = await supabase
        .from('player_messages')
        .select('*')
        .or(`recipient_user_id.eq.${user.id},recipient_email.eq.${user.email}`)
        .order('created_at', { ascending:false });

      if(result.error) throw result.error;

      messages = result.data || [];
      render();
      setStatus(`Loaded ${messages.length} messages.`);
    }catch(error){
      setStatus('Inbox error: ' + error.message);
    }
  }

  function render(){
    if(!messages.length){
      inboxBox.innerHTML = '<div class="vcc-card"><h2>No messages yet.</h2></div>';
      return;
    }

    inboxBox.innerHTML = messages.map(m => `
      <article class="vcc-card">
        <div class="vcc-panel-title">
          <h2>${safe(m.title || 'Message')}</h2>
          <span>${safe(m.status || 'unread')}</span>
        </div>
        <p>${safe(m.body || '')}</p>
        <p class="muted">From: ${safe(m.sender_email || m.sender_user_id || 'VCC')}</p>
        ${
          m.message_type === 'team_invite' && m.status !== 'accepted'
          ? `<button class="acceptInviteBtn green" data-id="${safe(m.id)}">Accept Invite</button>`
          : ''
        }
      </article>
    `).join('');

    document.querySelectorAll('.acceptInviteBtn').forEach(btn => {
      btn.addEventListener('click', () => acceptInvite(btn.dataset.id));
    });
  }

  async function acceptInvite(messageId){
    try{
      const msg = messages.find(m => m.id === messageId);
      if(!msg) return;

      if(!msg.related_team_id){
        setStatus('Invite has no team attached.');
        return;
      }

      setStatus('Accepting invite...');

      const membership = await supabase
        .from('team_memberships')
        .insert({
          team_id:msg.related_team_id,
          user_id:user.id,
          player_id:user.id,
          role:'player',
          status:'active'
        });

      if(membership.error) throw membership.error;

      const update = await supabase
        .from('player_messages')
        .update({ status:'accepted' })
        .eq('id', msg.id);

      if(update.error) throw update.error;

      await supabase
        .from('team_invites')
        .update({ status:'accepted' })
        .eq('message_id', msg.id);

      setStatus('Invite accepted. Team added to your account.');
      load();
    }catch(error){
      setStatus('Accept invite error: ' + error.message);
    }
  }

  document.getElementById('refreshInboxBtn').addEventListener('click', load);
  load();
})();
