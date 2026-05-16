// VCC Match Room chat fix

(function(){
  const params = new URLSearchParams(location.search);
  const roomId = params.get('id');

  let supabase = null;
  let user = null;
  let chatPoll = null;

  const roomTitle = document.getElementById('roomTitle');
  const roomStatus = document.getElementById('roomStatus');
  const roomInfo = document.getElementById('roomInfo');
  const chatBox = document.getElementById('chatBox');
  const chatStatus = document.getElementById('chatStatus');

  function setChatStatus(msg){ chatStatus.textContent = msg; }

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

  async function loadRoom(){
    if(!roomId){
      roomInfo.textContent = 'No room ID in URL.';
      return;
    }

    const result = await supabase
      .from('match_rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    if(result.error) throw result.error;
    if(!result.data){
      roomInfo.textContent = 'Room not found.';
      return;
    }

    const r = result.data;
    roomTitle.textContent = `Scrim Room`;
    roomStatus.textContent = r.status || 'open';
    roomInfo.textContent =
      `Room ID: ${r.id}\nTeam A: ${r.team_a_id}\nTeam B: ${r.team_b_id}\nRegion: ${r.region || 'NA'}\nType: ${r.scrim_type || 'BO1'}`;
  }

  async function loadChat(){
    if(!roomId) return;

    const result = await supabase
      .from('match_room_chat')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending:true });

    if(result.error){
      chatBox.textContent = 'Chat load error: ' + result.error.message;
      return;
    }

    const messages = result.data || [];

    chatBox.innerHTML = messages.length ? messages.map(m => `
      <div style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">
        <strong>${safe(m.sender_email || m.sender_user_id || 'Player')}</strong>
        <p>${safe(m.body || '')}</p>
      </div>
    `).join('') : 'No messages yet.';

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function sendChat(){
    try{
      const body = document.getElementById('chatInput').value.trim();

      if(!body){
        setChatStatus('Type a message first.');
        return;
      }

      if(!user){
        setChatStatus('Log in first.');
        return;
      }

      const result = await supabase
        .from('match_room_chat')
        .insert({
          room_id:roomId,
          sender_user_id:user.id,
          sender_email:user.email || null,
          body
        });

      if(result.error) throw result.error;

      document.getElementById('chatInput').value = '';
      setChatStatus('Message sent.');
      await loadChat();
    }catch(error){
      setChatStatus('Send chat error: ' + error.message);
    }
  }

  async function init(){
    try{
      supabase = await getSupabase();

      const session = await supabase.auth.getSession();
      user = session?.data?.session?.user || null;

      if(!user){
        setChatStatus('Log in first.');
        setTimeout(() => location.href = 'auth.html?mode=login', 800);
        return;
      }

      await loadRoom();
      await loadChat();

      document.getElementById('sendChatBtn').addEventListener('click', sendChat);
      document.getElementById('chatInput').addEventListener('keydown', e => {
        if(e.key === 'Enter') sendChat();
      });

      chatPoll = setInterval(loadChat, 3000);
    }catch(error){
      roomInfo.textContent = 'Room error: ' + error.message;
    }
  }

  init();
})();
