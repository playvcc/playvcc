// VCC Match Room Chat Fix
// Fixes: null value in column "message" of relation "match_room_chat"

(function(){
  let supabase = null;
  let user = null;
  let room = null;
  let myTeamIds = [];
  let isCaptain = false;

  const params = new URLSearchParams(location.search);
  const roomId = params.get('id');

  const chatBox =
    document.getElementById('chatBox') ||
    document.getElementById('chatMessages');

  const chatInput =
    document.getElementById('chatInput');

  const sendBtn =
    document.getElementById('sendChatBtn');

  const chatStatus =
    document.getElementById('chatStatus') ||
    document.getElementById('matchRoomStatus') ||
    document.querySelector('.log');

  function setStatus(message){
    if(chatStatus) chatStatus.textContent = message;
  }

  function safe(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    }[c]));
  }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  async function loadUser(){
    const session = await supabase.auth.getSession();
    user = session?.data?.session?.user || null;

    if(!user){
      location.href = 'auth.html?mode=login';
      return false;
    }

    return true;
  }

  async function loadRoom(){
    if(!roomId){
      throw new Error('Missing match room ID.');
    }

    const result = await supabase
      .from('match_rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    if(result.error) throw result.error;
    if(!result.data) throw new Error('Match room not found.');

    room = result.data;
  }

  async function verifyAccess(){
    const memberships = await supabase
      .from('team_memberships')
      .select('*, teams(*)')
      .or(`user_id.eq.${user.id},player_id.eq.${user.id}`)
      .eq('status','active');

    if(memberships.error) throw memberships.error;

    myTeamIds = (memberships.data || []).map(m => m.team_id);

    const allowed =
      myTeamIds.includes(room.team_a_id) ||
      myTeamIds.includes(room.team_b_id);

    if(!allowed){
      document.body.innerHTML = `
        <main class="vcc-page">
          <section class="vcc-card">
            <h1>Access Denied</h1>
            <p>Only the two teams in this match can view this room.</p>
            <a href="scrims.html" class="dark-btn">Back to Scrims</a>
          </section>
        </main>
      `;
      return false;
    }

    isCaptain = (memberships.data || []).some(m =>
      (m.role === 'captain' || m.teams?.captain_id === user.id) &&
      (m.team_id === room.team_a_id || m.team_id === room.team_b_id)
    );

    return true;
  }

  async function loadChat(){
    if(!chatBox) return;

    const result = await supabase
      .from('match_room_chat')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending:true });

    if(result.error){
      chatBox.innerHTML = `<div class="log">Chat load error: ${safe(result.error.message)}</div>`;
      return;
    }

    const messages = result.data || [];

    if(!messages.length){
      chatBox.innerHTML = 'No messages yet.';
      return;
    }

    chatBox.innerHTML = messages.map(m => {
      const text = m.message || m.body || '';
      const name = m.sender_name || m.sender_email || m.sender_user_id || m.sender_id || 'Player';
      const time = m.created_at ? new Date(m.created_at).toLocaleTimeString() : '';

      return `
        <div class="chat-message" style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">
          <strong>${safe(name)}</strong>
          <span style="float:right;opacity:.65">${safe(time)}</span>
          <p>${safe(text)}</p>
        </div>
      `;
    }).join('');

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function sendChat(){
    try{
      const text = chatInput?.value?.trim() || '';

      if(!text){
        setStatus('Type a message first.');
        return;
      }

      if(sendBtn) sendBtn.disabled = true;

      // IMPORTANT:
      // This sends BOTH message and body so it works with either old/new schema.
      const payload = {
        room_id:roomId,
        sender_user_id:user.id,
        sender_id:user.id,
        sender_email:user.email || null,
        sender_name:user.email || 'Player',
        message:text,
        body:text
      };

      const result = await supabase
        .from('match_room_chat')
        .insert(payload);

      if(result.error) throw result.error;

      chatInput.value = '';
      setStatus('Message sent.');
      await loadChat();

    }catch(error){
      setStatus('Send chat error: ' + error.message);
    }finally{
      if(sendBtn) sendBtn.disabled = false;
    }
  }

  async function subscribeChat(){
    supabase
      .channel('match-room-chat-' + roomId)
      .on(
        'postgres_changes',
        {
          event:'INSERT',
          schema:'public',
          table:'match_room_chat',
          filter:`room_id=eq.${roomId}`
        },
        () => loadChat()
      )
      .subscribe();
  }

  async function init(){
    try{
      supabase = await getSupabase();

      if(!await loadUser()) return;

      await loadRoom();

      if(!await verifyAccess()) return;

      await loadChat();
      await subscribeChat();

      sendBtn?.addEventListener('click', sendChat);

      chatInput?.addEventListener('keydown', e => {
        if(e.key === 'Enter'){
          e.preventDefault();
          sendChat();
        }
      });

      setStatus('Match chat connected.');

      // Backup refresh in case realtime is not enabled yet.
      setInterval(loadChat, 5000);

    }catch(error){
      setStatus('Match room error: ' + error.message);
    }
  }

  init();
})();
