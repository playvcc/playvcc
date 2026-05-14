
// ======================================================
// VCC Direct Message + One Team Guard Helpers
// ======================================================

function getVCCSB(){
  return window.supabaseClient || window.supabase || window.sb || null;
}

const VCCMessage = (() => {
  const sb = getVCCSB();

  async function getUser(){
    if(!sb || !sb.auth || !sb.auth.getUser) return null;
    const result = await sb.auth.getUser();
    return result.data && result.data.user ? result.data.user : null;
  }

  async function sendDirectMessage({recipientUserId, recipientEmail, title, body}){
    if(!sb || !sb.from) throw new Error("Supabase is not connected.");
    const user = await getUser();
    if(!user) throw new Error("You must be logged in to send a message.");

    const row = {
      sender_user_id: user.id,
      sender_email: user.email,
      recipient_user_id: recipientUserId || null,
      recipient_email: recipientEmail || null,
      title: title || "VCC Message",
      body,
      status: "unread"
    };

    const result = await sb.from("direct_messages").insert(row).select().single();
    if(result.error) throw result.error;

    // Also send to player_messages inbox if that table exists.
    try {
      await sb.from("player_messages").insert({
        recipient_user_id: recipientUserId || null,
        recipient_email: recipientEmail || null,
        sender_user_id: user.id,
        message_type: "direct_message",
        title: title || "VCC Message",
        body,
        status: "unread",
        action_url: "inbox.html"
      });
    } catch(e) {}

    return result.data;
  }

  async function userAlreadyHasTeam(){
    if(!sb || !sb.from) throw new Error("Supabase is not connected.");
    const user = await getUser();
    if(!user) return false;

    const result = await sb.from("teams").select("id,name").eq("captain_id", user.id).limit(1);
    if(result.error) throw result.error;
    return result.data && result.data.length ? result.data[0] : false;
  }

  return { getUser, sendDirectMessage, userAlreadyHasTeam };
})();

window.VCCMessage = VCCMessage;
