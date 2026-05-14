import { supabase, safe } from './app.js';

const inboxBox = document.getElementById('inboxBox');

async function getUser(){
  const session = await supabase.auth.getSession();
  return session?.data?.session?.user || null;
}

async function acceptInvite(message){
  try{
    if(!message.related_team_id){
      alert('No related team found for this invite.');
      return;
    }

    const user = await getUser();
    if(!user){
      alert('Log in first.');
      return;
    }

    const joined = await supabase.from('team_memberships').insert({
      team_id: message.related_team_id,
      user_id: user.id,
      role: 'player',
      status: 'active'
    });

    if(joined.error) throw joined.error;

    const updated = await supabase
      .from('player_messages')
      .update({ status: 'accepted' })
      .eq('id', message.id);

    if(updated.error) throw updated.error;

    loadInbox();
  }catch(error){
    alert(error.message);
  }
}

async function loadInbox(){
  try{
    const user = await getUser();

    if(!user){
      inboxBox.innerHTML = `
        <div class="card">
          <h2>Log in first</h2>
          <p class="muted">You need to log in to view your VCC inbox.</p>
          <a class="btn" href="auth.html">Login</a>
        </div>
      `;
      return;
    }

    const { data, error } = await supabase
      .from('player_messages')
      .select('*')
      .or(`recipient_user_id.eq.${user.id},recipient_email.eq.${user.email}`)
      .order('created_at', { ascending:false });

    if(error) throw error;

    if(!data || !data.length){
      inboxBox.innerHTML = `
        <div class="card">
          <h2>No messages yet</h2>
          <p class="muted">Team invites and notifications will show here.</p>
        </div>
      `;
      return;
    }

    inboxBox.innerHTML = data.map(m => `
      <article class="card">
        <span class="pill">${safe(m.status || 'unread')}</span>
        <h2>${safe(m.title || 'Message')}</h2>
        <p>${safe(m.body || '')}</p>

        ${
          m.message_type === 'team_invite' && m.status !== 'accepted'
          ? `<button class="acceptBtn" data-id="${safe(m.id)}">Accept Invite</button>`
          : ''
        }
      </article>
    `).join('');

    document.querySelectorAll('.acceptBtn').forEach(button => {
      button.addEventListener('click', () => {
        const message = data.find(m => m.id === button.dataset.id);
        acceptInvite(message);
      });
    });

  }catch(error){
    inboxBox.innerHTML = `
      <div class="card">
        <h2>Inbox Error</h2>
        <p class="muted">${safe(error.message)}</p>
      </div>
    `;
  }
}

loadInbox();
