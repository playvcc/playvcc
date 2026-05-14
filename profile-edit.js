
function getSB(){ return window.supabaseClient || window.supabase || window.sb || null; }

async function getUser(){
  const sb = getSB();
  if(!sb?.auth?.getUser) return null;
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}

async function ensureProfileRow(user){
  const sb = getSB();
  const { data, error } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if(error && error.code !== "PGRST116") throw error;
  if(data) return data;

  const row = { id:user.id, email:user.email, display_name:user.email?.split("@")[0] || "VCC Player" };
  const created = await sb.from("profiles").insert(row).select().single();
  if(created.error) throw created.error;
  return created.data;
}

async function uploadFile(bucket, path, file){
  const sb = getSB();
  const { error } = await sb.storage.from(bucket).upload(path, file, { upsert:true });
  if(error) throw error;
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

async function loadProfile(){
  const status = document.getElementById("profileStatus");
  try{
    const sb = getSB();
    const user = await getUser();
    if(!user){ status.textContent = "Log in to edit your profile."; return; }

    const profile = await ensureProfileRow(user);

    document.getElementById("displayName").value = profile.display_name || "";
    document.getElementById("riotId").value = profile.riot_id || "";
    document.getElementById("rank").value = profile.rank || "";
    document.getElementById("platform").value = profile.platform || "";
    document.getElementById("region").value = profile.region || "";
    document.getElementById("mainRole").value = profile.main_role || "";
    document.getElementById("mainAgents").value = profile.main_agents || "";
    document.getElementById("bio").value = profile.bio || "";

    if(profile.avatar_url) document.getElementById("profileAvatar").src = profile.avatar_url;

    document.getElementById("winsText").textContent = profile.wins || 0;
    document.getElementById("lossesText").textContent = profile.losses || 0;
    document.getElementById("pointsText").textContent = profile.pro_points || 0;
    document.getElementById("ratingText").textContent = profile.rating || 1000;

    const q = [];
    q.push("user=" + encodeURIComponent(user.id));
    if(user.email) q.push("email=" + encodeURIComponent(user.email));
    document.getElementById("messageBtn").href = "message-player.html?" + q.join("&");

    await loadProfileMessages(user);
    status.textContent = "Profile loaded.";
  }catch(err){
    status.textContent = "Profile load error: " + err.message;
  }
}

async function saveProfile(){
  const status = document.getElementById("profileStatus");
  try{
    const sb = getSB();
    const user = await getUser();
    if(!user){ status.textContent = "Log in first."; return; }

    const patch = {
      id:user.id,
      email:user.email,
      display_name:document.getElementById("displayName").value.trim(),
      riot_id:document.getElementById("riotId").value.trim(),
      rank:document.getElementById("rank").value.trim(),
      platform:document.getElementById("platform").value.trim(),
      region:document.getElementById("region").value.trim(),
      main_role:document.getElementById("mainRole").value.trim(),
      main_agents:document.getElementById("mainAgents").value.trim(),
      bio:document.getElementById("bio").value.trim(),
      updated_at:new Date().toISOString()
    };

    const { error } = await sb.from("profiles").upsert(patch);
    if(error) throw error;

    status.textContent = "Profile saved.";
  }catch(err){
    status.textContent = "Save error: " + err.message;
  }
}

async function uploadAvatar(){
  const status = document.getElementById("profileStatus");
  try{
    const user = await getUser();
    if(!user){ status.textContent = "Log in first."; return; }

    const file = document.getElementById("avatarFile").files[0];
    if(!file){ status.textContent = "Choose an image first."; return; }

    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const url = await uploadFile("profile-images", path, file);

    const sb = getSB();
    const { error } = await sb.from("profiles").upsert({
      id:user.id,
      email:user.email,
      avatar_url:url,
      updated_at:new Date().toISOString()
    });
    if(error) throw error;

    document.getElementById("profileAvatar").src = url;
    status.textContent = "Profile picture uploaded.";
  }catch(err){
    status.textContent = "Upload error: " + err.message;
  }
}

async function loadProfileMessages(user){
  const box = document.getElementById("profileMessages");
  const sb = getSB();
  try{
    const { data, error } = await sb.from("player_messages")
      .select("*")
      .or(`recipient_user_id.eq.${user.id},recipient_email.eq.${user.email}`)
      .order("created_at", { ascending:false })
      .limit(5);
    if(error) throw error;
    if(!data || !data.length){ box.textContent = "No messages yet."; return; }
    box.innerHTML = data.map(m => `<div><strong>${m.title || "Message"}</strong><br>${m.body || ""}<hr></div>`).join("");
  }catch(err){
    box.textContent = "Messages unavailable: " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("saveProfileBtn").addEventListener("click", saveProfile);
  document.getElementById("uploadAvatarBtn").addEventListener("click", uploadAvatar);
  loadProfile();
});
