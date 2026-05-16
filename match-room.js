// VCC Match Room Realtime Chat Fix
// Replaces old match-room.js

let supabase = null;
let currentUser = null;
let currentRoom = null;
let subscription = null;

const messagesBox = document.getElementById('chatMessages');
const input = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendChatBtn');
const statusBox = document.getElementById('matchRoomStatus');

function setStatus(msg){
  if(statusBox) statusBox.textContent = msg;
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

function getRoomId(){
  return new URLSearchParams(location.search).get('id');
}

async function loadUser(){
  const session = await supabase.auth.getSession();
  currentUser = session?.data?.session?.user || null;

  if(!currentUser){
    location.href = 'auth.html?mode=login';
    return false;
  }

  return true;
}

async function loadRoom(){
  const roomId = getRoomId();

  const result = await supabase
    .from('match_rooms')
    .select('*')
    .eq('id', roomId)
    .maybeSingle();

  if(result.error) throw result.error;

  currentRoom = result.data;

  if(!currentRoom){
    throw new Error('Match room not found.');
  }
}

async function verifyAccess(){
  const memberships = await supabase
    .from('team_memberships')
    .select('*')
    .or(`user_id.eq.${currentUser.id},player_id.eq.${currentUser.id}`)
    .eq('status','active');

  const teams = (memberships.data || []).map(x => x.team_id);

  if(
    !teams.includes(currentRoom.team_a_id) &&
    !teams.includes(currentRoom.team_b_id)
  ){
    document.body.innerHTML = `
      <main class="vcc-page">
        <section class="vcc-card">
          <h1>Access Denied</h1>
          <p>Only the 2 teams in this match can access this room.</p>
        </section>
      </main>
    `;
    return false;
  }

  return true;
}

function renderMessages(messages){
  if(!messagesBox) return;

  if(!messages.length){
    messagesBox.innerHTML = '<div class="log">No messages yet.</div>';
    return;
  }

  messagesBox.innerHTML = messages.map(msg => `
    <article class="chat-message">
      <div class="chat-header">
        <strong>${safe(msg.sender_name || 'Player')}</strong>
        <span>${new Date(msg.created_at).toLocaleTimeString()}</span>
      </div>

      <div class="chat-body">
        ${safe(msg.message)}
      </div>
    </article>
  `).join('');

  messagesBox.scrollTop = messagesBox.scrollHeight;
}

async function loadMessages(){
  const result = await supabase
    .from('match_chat_messages')
    .select('*')
    .eq('room_id', currentRoom.id)
    .order('created_at', { ascending:true });

  if(result.error){
    setStatus('Load chat error: ' + result.error.message);
    return;
  }

  renderMessages(result.data || []);
}

async function sendMessage(){
  try{
    const text = input.value.trim();

    if(!text) return;

    sendBtn.disabled = true;

    const result = await supabase
      .from('match_chat_messages')
      .insert({
        room_id:currentRoom.id,
        sender_id:currentUser.id,
        sender_name:currentUser.email || 'Player',
        message:text
      });

    if(result.error) throw result.error;

    input.value = '';
  }catch(error){
    setStatus('Send message error: ' + error.message);
  }finally{
    sendBtn.disabled = false;
  }
}

function subscribeRealtime(){
  if(subscription){
    supabase.removeChannel(subscription);
  }

  subscription = supabase
    .channel('match-chat-' + currentRoom.id)
    .on(
      'postgres_changes',
      {
        event:'INSERT',
        schema:'public',
        table:'match_chat_messages',
        filter:`room_id=eq.${currentRoom.id}`
      },
      async () => {
        await loadMessages();
      }
    )
    .subscribe((status) => {
      setStatus('Chat status: ' + status);
    });
}

async function init(){
  try{
    supabase = await getSupabase();

    const ok = await loadUser();
    if(!ok) return;

    await loadRoom();

    const allowed = await verifyAccess();
    if(!allowed) return;

    await loadMessages();

    subscribeRealtime();

    setStatus('Match chat connected.');

    sendBtn?.addEventListener('click', sendMessage);

    input?.addEventListener('keydown', e => {
      if(e.key === 'Enter'){
        sendMessage();
      }
    });

  }catch(error){
    setStatus('Match room error: ' + error.message);
  }
}

init();
