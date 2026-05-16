// VCC Tournament Match Room Auto-Close Patch
// Add after tournament-match.js:
// <script src="tournament-match-close-patch.js"></script>

(function(){
  const params = new URLSearchParams(location.search);
  const matchId = params.get('id');

  let supabase = null;

  function status(msg){
    const box =
      document.getElementById('scoreStatus') ||
      document.getElementById('matchInfo') ||
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
      if(!matchId) return;

      const result = await supabase
        .from('tournament_matches')
        .select('id,status,close_after,room_deleted_at')
        .eq('id', matchId)
        .maybeSingle();

      if(result.error || !result.data) return;

      const match = result.data;

      if(match.status === 'closed' || match.room_deleted_at){
        status('Match room closed. Returning to matches...');
        setTimeout(() => location.href = 'matches.html', 700);
        return;
      }

      if(match.status === 'completed' && match.close_after){
        const closeAt = new Date(match.close_after).getTime();
        const remaining = Math.max(0, Math.ceil((closeAt - Date.now()) / 1000));

        status(`Match completed. Room closes in ${remaining} seconds.`);

        if(remaining <= 0){
          await supabase.rpc('cleanup_completed_match_rooms');
          location.href = 'matches.html';
        }
      }
    }catch(error){
      console.error('Tournament close patch error:', error);
    }
  }

  async function init(){
    try{
      supabase = await getSupabase();
      setInterval(checkClose, 3000);
      checkClose();
    }catch(error){
      console.error('Tournament close patch setup error:', error);
    }
  }

  init();
})();
