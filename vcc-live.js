
function getSupabaseClient(){ return window.supabaseClient || window.supabase || window.sb || null; }

const VCCLive = (() => {
  const sb = getSupabaseClient();

  async function getUser(){
    if(!sb || !sb.auth || !sb.auth.getUser) return null;
    const result = await sb.auth.getUser();
    return result.data && result.data.user ? result.data.user : null;
  }

  async function insert(table, row){
    if(!sb || !sb.from) throw new Error("Supabase is not connected. Check supabase-config.js.");
    const result = await sb.from(table).insert(row).select().single();
    if(result.error) throw result.error;
    return result.data;
  }

  async function updateEq(table, patch, col, val){
    const result = await sb.from(table).update(patch).eq(col, val).select();
    if(result.error) throw result.error;
    return result.data;
  }

  async function selectEq(table, cols, col, val){
    const result = await sb.from(table).select(cols).eq(col, val);
    if(result.error) throw result.error;
    return result.data || [];
  }

  async function createTournament(form){
    return insert("tournaments", {
      name: form.name,
      description: form.description || "",
      format: form.format,
      tournament_category: form.tournament_category,
      status: form.status || "upcoming",
      start_date: form.start_date || null,
      group_count: Number(form.group_count || 0),
      teams_per_group: Number(form.teams_per_group || 0),
      advance_per_group: Number(form.advance_per_group || 2),
      roster_lock_at: form.roster_lock_at || null
    });
  }

  async function createGroups(tournamentId, groupCount){
    const rows = [];
    for(let i = 0; i < Number(groupCount); i++){
      rows.push({ tournament_id: tournamentId, group_name: "Group " + String.fromCharCode(65 + i), sort_order: i + 1 });
    }
    const result = await sb.from("tournament_groups").insert(rows).select();
    if(result.error) throw result.error;
    return result.data || [];
  }

  async function assignTeamsToGroups(tournamentId, teamIds, groupCount){
    let groups = await selectEq("tournament_groups", "*", "tournament_id", tournamentId);
    if(!groups.length) groups = await createGroups(tournamentId, groupCount);
    groups.sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0));

    const rows = teamIds.map((teamId, i) => ({
      tournament_id: tournamentId,
      group_id: groups[i % groups.length].id,
      team_id: teamId,
      seed: i + 1
    }));

    const inserted = await sb.from("tournament_group_teams").insert(rows).select();
    if(inserted.error) throw inserted.error;

    const standings = rows.map(r => ({
      tournament_id: tournamentId,
      group_id: r.group_id,
      team_id: r.team_id,
      wins: 0, losses: 0, maps_won: 0, maps_lost: 0, rounds_won: 0, rounds_lost: 0, points: 0
    }));
    await sb.from("group_standings").insert(standings);

    return inserted.data || [];
  }

  async function generateGroupMatches(tournamentId){
    const groups = await selectEq("tournament_groups", "*", "tournament_id", tournamentId);
    const made = [];

    for(const group of groups){
      const rows = await selectEq("tournament_group_teams", "team_id", "group_id", group.id);
      const teams = rows.map(r => r.team_id);
      let round = 1;

      for(let i = 0; i < teams.length; i++){
        for(let j = i + 1; j < teams.length; j++){
          const match = await insert("matches", {
            tournament_id: tournamentId,
            group_id: group.id,
            team_a: teams[i],
            team_b: teams[j],
            round_name: group.group_name + " Round " + round,
            status: "scheduled"
          });
          made.push(match);
          round++;
        }
      }
    }
    return made;
  }

  async function sendTeamInvite(opts){
    const user = await getUser();
    const message = await insert("player_messages", {
      recipient_user_id: opts.invitedUserId || null,
      recipient_email: opts.invitedEmail || null,
      sender_user_id: user ? user.id : null,
      message_type: "team_invite",
      title: "VCC Team Invite",
      body: opts.body || "You have been invited to join a VCC team.",
      related_team_id: opts.teamId || null,
      status: "unread",
      action_url: "inbox.html"
    });

    const invite = await insert("team_invites", {
      team_id: opts.teamId || null,
      invited_user_id: opts.invitedUserId || null,
      invited_email: opts.invitedEmail || null,
      invited_riot_id: opts.invitedRiotId || null,
      invited_by: user ? user.id : null,
      role: opts.role || "player",
      status: "pending",
      message_id: message.id
    });

    return { message, invite };
  }

  async function loadInbox(){
    const user = await getUser();
    if(!user) throw new Error("You must be logged in to see inbox messages.");

    const result = await sb.from("player_messages")
      .select("*")
      .or("recipient_user_id.eq." + user.id + ",recipient_email.eq." + user.email)
      .order("created_at", { ascending:false });

    if(result.error) throw result.error;
    return result.data || [];
  }

  async function markMessageRead(id){ return updateEq("player_messages", { status:"read" }, "id", id); }

  async function sendMatchChat(matchId, username, message){
    const user = await getUser();
    return insert("match_room_chat", {
      match_id: matchId,
      user_id: user ? user.id : null,
      username: username || (user ? user.email : "Player"),
      message: message
    });
  }

  async function loadMatchChat(matchId){
    const result = await sb.from("match_room_chat").select("*").eq("match_id", matchId).order("created_at", { ascending:true });
    if(result.error) throw result.error;
    return result.data || [];
  }

  function subscribeMatchChat(matchId, cb){
    if(!sb || !sb.channel) return null;
    return sb.channel("match_room_chat_" + matchId)
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"match_room_chat", filter:"match_id=eq." + matchId }, () => cb())
      .subscribe();
  }

  async function submitMatchScore(opts){
    const user = await getUser();
    const sub = await insert("match_score_submissions", {
      match_id: opts.matchId,
      team_id: opts.teamId || null,
      team_name: opts.teamName,
      score_team_a: Number(opts.scoreA),
      score_team_b: Number(opts.scoreB),
      proof_url: opts.proofUrl || null,
      submitted_by: user ? user.id : null
    });

    const result = await sb.from("match_score_submissions").select("*").eq("match_id", opts.matchId).order("created_at", { ascending:true });
    if(result.error) throw result.error;

    const subs = result.data || [];
    if(subs.length >= 2){
      const last = subs.slice(-2);
      const same = Number(last[0].score_team_a) === Number(last[1].score_team_a) &&
                   Number(last[0].score_team_b) === Number(last[1].score_team_b);

      if(same){
        const mres = await sb.from("matches").select("*").eq("id", opts.matchId).limit(1);
        if(mres.error) throw mres.error;
        const match = mres.data && mres.data[0];
        const winner = Number(opts.scoreA) > Number(opts.scoreB) ? (match ? match.team_a : null) : (match ? match.team_b : null);
        await updateEq("matches", {
          status:"completed",
          score_team_a:Number(opts.scoreA),
          score_team_b:Number(opts.scoreB),
          winner_team:winner
        }, "id", opts.matchId);
        return { status:"approved", submission:sub };
      }

      await updateEq("matches", { status:"disputed", dispute_reason:"Captain score submissions did not match." }, "id", opts.matchId);
      return { status:"disputed", submission:sub };
    }

    return { status:"waiting_for_other_team", submission:sub };
  }

  return {
    getUser, createTournament, createGroups, assignTeamsToGroups, generateGroupMatches,
    sendTeamInvite, loadInbox, markMessageRead, sendMatchChat, loadMatchChat,
    subscribeMatchChat, submitMatchScore
  };
})();
window.VCCLive = VCCLive;
