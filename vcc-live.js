// VCC Live Systems: Group Stage, Invites, Messages, Chat
const VCC = (() => {
  const sb = window.supabaseClient || window.supabase || null;
  const uid = (p="id") => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;

  async function getCurrentUser(){
    if(!sb?.auth?.getUser) return null;
    const { data } = await sb.auth.getUser();
    return data?.user || null;
  }

  async function insert(table,row){
    if(!sb?.from) throw new Error("Supabase is not connected. Check supabase-config.js");
    const {data,error}=await sb.from(table).insert(row).select().single();
    if(error) throw error;
    return data;
  }

  async function update(table,patch,col,val){
    const {data,error}=await sb.from(table).update(patch).eq(col,val).select();
    if(error) throw error;
    return data;
  }

  async function createGroups(tournamentId, groupCount=4){
    const rows=[];
    for(let i=0;i<groupCount;i++){
      rows.push({tournament_id:tournamentId, group_name:`Group ${String.fromCharCode(65+i)}`, sort_order:i+1});
    }
    const {data,error}=await sb.from("tournament_groups").insert(rows).select();
    if(error) throw error;
    return data;
  }

  async function assignTeamsToGroups(tournamentId, teamIds, groupCount=4){
    let {data:groups,error:gerr}=await sb.from("tournament_groups").select("*").eq("tournament_id", tournamentId).order("sort_order");
    if(gerr) throw gerr;
    if(!groups || !groups.length) groups = await createGroups(tournamentId, groupCount);

    const rows = teamIds.map((teamId,i)=>({
      tournament_id:tournamentId,
      group_id:groups[i % groups.length].id,
      team_id:teamId,
      seed:i+1
    }));

    const {data,error}=await sb.from("tournament_group_teams").insert(rows).select();
    if(error) throw error;

    const standings = rows.map(r=>({
      tournament_id:tournamentId, group_id:r.group_id, team_id:r.team_id,
      wins:0, losses:0, maps_won:0, maps_lost:0, rounds_won:0, rounds_lost:0, points:0
    }));
    await sb.from("group_standings").insert(standings);
    return data;
  }

  async function generateGroupRoundRobin(tournamentId){
    const {data:groups,error}=await sb.from("tournament_groups").select("*").eq("tournament_id", tournamentId).order("sort_order");
    if(error) throw error;
    const made=[];
    for(const group of groups || []){
      const {data:rows,error:rerr}=await sb.from("tournament_group_teams").select("team_id").eq("group_id", group.id);
      if(rerr) throw rerr;
      const teams=(rows||[]).map(r=>r.team_id);
      let round=1;
      for(let i=0;i<teams.length;i++){
        for(let j=i+1;j<teams.length;j++){
          const match={tournament_id:tournamentId, group_id:group.id, team_a:teams[i], team_b:teams[j], status:"scheduled", round_name:`${group.group_name} Round ${round}`};
          const saved=await insert("matches", match);
          made.push(saved);
          round++;
        }
      }
    }
    return made;
  }

  async function sendTeamInvite({teamId, invitedUserId, invitedEmail, invitedRiotId, role="player", title, body}){
    const user=await getCurrentUser();
    const msg=await insert("player_messages", {
      recipient_user_id: invitedUserId || null,
      recipient_email: invitedEmail || null,
      sender_user_id: user?.id || null,
      message_type:"team_invite",
      title:title || "VCC Team Invite",
      body:body || "You have been invited to join a VCC team.",
      related_team_id: teamId || null,
      status:"unread",
      action_url:"inbox.html"
    });
    const invite=await insert("team_invites", {
      team_id:teamId || null, invited_user_id: invitedUserId || null, invited_email: invitedEmail || null,
      invited_riot_id: invitedRiotId || null, invited_by:user?.id || null, role, status:"pending", message_id:msg.id
    });
    return {message:msg, invite};
  }

  async function loadInbox(){
    const user=await getCurrentUser();
    if(!user) return [];
    const {data,error}=await sb.from("player_messages").select("*")
      .or(`recipient_user_id.eq.${user.id},recipient_email.eq.${user.email}`)
      .order("created_at", {ascending:false});
    if(error) throw error;
    return data || [];
  }

  async function markMessageRead(id){ return update("player_messages", {status:"read"}, "id", id); }

  async function sendMatchChat(matchId, username, message){
    const user=await getCurrentUser();
    return insert("match_room_chat", {match_id:matchId, user_id:user?.id || null, username:username || user?.email || "Player", message});
  }

  async function loadMatchChat(matchId){
    const {data,error}=await sb.from("match_room_chat").select("*").eq("match_id", matchId).order("created_at", {ascending:true});
    if(error) throw error;
    return data || [];
  }

  function subscribeMatchChat(matchId,onMessage){
    if(!sb?.channel) return null;
    return sb.channel(`match_room_chat_${matchId}`)
      .on("postgres_changes", {event:"INSERT", schema:"public", table:"match_room_chat", filter:`match_id=eq.${matchId}`}, p=>onMessage(p.new))
      .subscribe();
  }

  async function updateGroupStandings(match){
    if(!match?.group_id || !match?.team_a || !match?.team_b) return;
    const aWon = Number(match.score_team_a) > Number(match.score_team_b);
    const winner = aWon ? match.team_a : match.team_b;
    const loser = aWon ? match.team_b : match.team_a;
    const {data:rows,error}=await sb.from("group_standings").select("*").eq("group_id", match.group_id);
    if(error) throw error;
    const win=rows.find(r=>r.team_id===winner);
    const lose=rows.find(r=>r.team_id===loser);
    const maxMaps=Math.max(Number(match.score_team_a), Number(match.score_team_b));
    const minMaps=Math.min(Number(match.score_team_a), Number(match.score_team_b));
    if(win) await update("group_standings", {wins:win.wins+1, maps_won:win.maps_won+maxMaps, maps_lost:win.maps_lost+minMaps, points:win.points+3, updated_at:new Date().toISOString()}, "id", win.id);
    if(lose) await update("group_standings", {losses:lose.losses+1, maps_won:lose.maps_won+minMaps, maps_lost:lose.maps_lost+maxMaps, updated_at:new Date().toISOString()}, "id", lose.id);
  }

  async function submitMatchScore({matchId, teamId, teamName, scoreA, scoreB, proofUrl}){
    const user=await getCurrentUser();
    const sub=await insert("match_score_submissions", {
      match_id:matchId, team_id:teamId || null, team_name:teamName,
      score_team_a:Number(scoreA), score_team_b:Number(scoreB), proof_url:proofUrl || null, submitted_by:user?.id || null
    });
    const {data:subs,error}=await sb.from("match_score_submissions").select("*").eq("match_id", matchId).order("created_at", {ascending:true});
    if(error) throw error;
    if((subs || []).length >= 2){
      const last=subs.slice(-2);
      if(Number(last[0].score_team_a)===Number(last[1].score_team_a) && Number(last[0].score_team_b)===Number(last[1].score_team_b)){
        const {data:matches,error:merr}=await sb.from("matches").select("*").eq("id", matchId).limit(1);
        if(merr) throw merr;
        const match=matches?.[0];
        const winner = Number(scoreA) > Number(scoreB) ? match?.team_a : match?.team_b;
        await update("matches", {status:"completed", score_team_a:Number(scoreA), score_team_b:Number(scoreB), winner_team:winner}, "id", matchId);
        if(match) await updateGroupStandings({...match, score_team_a:Number(scoreA), score_team_b:Number(scoreB)});
        return {status:"approved", submission:sub};
      }
      await update("matches", {status:"disputed", dispute_reason:"Captain score submissions did not match."}, "id", matchId);
      return {status:"disputed", submission:sub};
    }
    return {status:"waiting_for_other_team", submission:sub};
  }

  return {createGroups, assignTeamsToGroups, generateGroupRoundRobin, sendTeamInvite, loadInbox, markMessageRead, sendMatchChat, loadMatchChat, subscribeMatchChat, submitMatchScore, getCurrentUser};
})();
window.VCC = VCC;
