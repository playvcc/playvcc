// VCC direct messaging fix

(function(){
  const statusBox = document.getElementById('messageStatus');

  function setStatus(msg){ statusBox.textContent = msg; }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  async function send(){
    try{
      const supabase = await getSupabase();
      const session = await supabase.auth.getSession();
      const user = session?.data?.session?.user || null;

      if(!user){
        setStatus('Log in first.');
        setTimeout(() => location.href = 'auth.html?mode=login', 800);
        return;
      }

      const params = new URLSearchParams(location.search);
      const recipientUserId = document.getElementById('recipientUserId').value.trim() || params.get('user') || null;
      const recipientEmail = document.getElementById('recipientEmail').value.trim() || params.get('email') || null;
      const title = document.getElementById('messageTitle').value.trim() || 'VCC Message';
      const body = document.getElementById('messageBody').value.trim();

      if(!recipientUserId && !recipientEmail){
        setStatus('Enter recipient profile/user ID or email.');
        return;
      }

      if(!body){
        setStatus('Enter a message.');
        return;
      }

      setStatus('Sending message...');

      const result = await supabase
        .from('player_messages')
        .insert({
          sender_user_id:user.id,
          sender_email:user.email || null,
          recipient_user_id:recipientUserId,
          recipient_email:recipientEmail,
          title,
          body,
          message_type:'direct_message',
          status:'unread'
        });

      if(result.error) throw result.error;

      setStatus('Message sent.');
    }catch(error){
      setStatus('Message error: ' + error.message);
    }
  }

  const params = new URLSearchParams(location.search);
  if(params.get('user')) document.getElementById('recipientUserId').value = params.get('user');
  if(params.get('email')) document.getElementById('recipientEmail').value = params.get('email');

  document.getElementById('sendMessageBtn').addEventListener('click', send);
})();
