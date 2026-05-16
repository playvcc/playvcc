// VCC Match Room Auto-Close Patch
// Add after match-room.js:
// <script src="match-room-close-patch.js"></script>

(function(){
  const params = new URLSearchParams(location.search);
  const roomId = params.get('id');

  let supabase = null;
  let closeInterval = null;

  function status(msg){
    const box =
      document.getElementById('matchRoomStatus') ||
      document.getElementById('chatStatus') ||
      document.getElementById('scrimScoreStatus') ||
      document.querySelector('.log');

    if(box) box.textContent = msg;
  }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  async function checkClose(){
    try{
      if(!roomId) return;

      const result = await supabase
        .from('match_rooms')
        .select('id,status,close_after,room_deleted_at')
        .eq('id', roomId)
        .maybeSingle();

      if(result.error || !result.data) return;

      const room = result.data;

      if(room.status === 'closed' || room.room_deleted_at){
        status('Match room closed. Returning to scrims...');
        setTimeout(() => location.href = 'scrims.html', 700);
        return;
      }

      if(room.status === 'completed' && room.close_after){
        const closeAt = new Date(room.close_after).getTime();
        const remaining = Math.max(0, Math.ceil((closeAt - Date.now()) / 1000));

        status(`Match completed. Room closes in ${remaining} seconds.`);

        if(remaining <= 0){
          await supabase.rpc('cleanup_completed_match_rooms');
          location.href = 'scrims.html';
        }
      }
    }catch(error){
      console.error('Close patch error:', error);
    }
  }

  async function init(){
    try{
      supabase = await getSupabase();
      closeInterval = setInterval(checkClose, 3000);
      checkClose();
    }catch(error){
      console.error('Close patch setup error:', error);
    }
  }

  init();
})();
