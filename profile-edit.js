
// ======================================================
// VCC Profile Edit JS - Login Session Fixed
// This version properly detects Supabase logged-in users.
// ======================================================

function getSB(){
  return window.supabaseClient || window.supabase || window.sb || null;
}

async function waitForSupabase(maxWaitMs = 3000){
  const start = Date.now();

  while(Date.now() - start < maxWaitMs){
    const sb = getSB();
    if(sb && sb.auth) return sb;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return getSB();
}

async function getLoggedInUser(){
  const sb = await waitForSupabase();

  if(!sb || !sb.auth){
    throw new Error("Supabase is not loaded. Check supabase-config.js is included before profile-edit.js.");
  }

  // Supabase v2 session check
  if(sb.auth.getSession){
    const sessionResult = await sb.auth.getSession();

    if(sessionResult.error){
      throw sessionResult.error;
    }

    if(sessionResult.data && sessionResult.data.session && sessionResult.data.session.user){
      return sessionResult.data.session.user;
    }
  }

  // Supabase v2 user fallback
  if(sb.auth.getUser){
    const userResult = await sb.auth.getUser();

    if(userResult.error){
      throw userResult.error;
    }

    if(userResult.data && userResult.data.user){
      return userResult.data.user;
    }
  }

  return null;
}

async function ensureProfileRow(user){
  const sb = getSB();

  const result = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if(result.error && result.error.code !== "PGRST116"){
    throw result.error;
  }

  if(result.data){
    return result.data;
  }

  const row = {
    id: user.id,
    email: user.email,
    display_name: user.email ? user.email.split("@")[0] : "VCC Player",
    updated_at: new Date().toISOString()
  };

  const created = await sb
    .from("profiles")
    .insert(row)
    .select()
    .single();

  if(created.error){
    throw created.error;
  }

  return created.data;
}

async function uploadFile(bucket, path, file){
  const sb = getSB();

  const uploaded = await sb.storage
    .from(bucket)
    .upload(path, file, { upsert:true });

  if(uploaded.error){
    throw uploaded.error;
  }

  const publicUrl = sb.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl.data.publicUrl;
}

async function loadProfile(){
  const status = document.getElementById("profileStatus");

  try{
    const user = await getLoggedInUser();

    if(!user){
      status.innerHTML = `
        You are not logged in.<br>
        <a class="btn" href="auth.html">Go to Login</a>
      `;
      return;
    }

    const profile = await ensureProfileRow(user);

    document.getElementById("displayName").value = profile.display_name || "";
    document.getElementById("riotId").value = profile.riot_id || "";
    document.getElementById("rank").value = profile.rank || "";
    document.getElementById("platform").value = profile.platform || "";
    document.getElementById("region").value = profile.region || "";
    document.getElementById("mainRole").value = profile.main_role || "";
    document.getElementById("mainAgents").value = profile.main_agents || "";
    document.getElementById("bio").value = profile.bio || "";

    if(profile.avatar_url){
      document.getElementById("profileAvatar").src = profile.avatar_url;
    }

    document.getElementById("winsText").textContent = profile.wins || 0;
    document.getElementById("lossesText").textContent = profile.losses || 0;
    document.getElementById("pointsText").textContent = profile.pro_points || 0;
    document.getElementById("ratingText").textContent = profile.rating || 1000;

    const q = [];
    q.push("user=" + encodeURIComponent(user.id));

    if(user.email){
      q.push("email=" + encodeURIComponent(user.email));
    }

    const messageBtn = document.getElementById("messageBtn");
    if(messageBtn){
      messageBtn.href = "message-player.html?" + q.join("&");
    }

    await loadProfileMessages(user);

    status.textContent = "Logged in as " + (user.email || user.id);
  }catch(err){
    status.innerHTML = `
      Profile login/session error:<br>
      ${err.message}<br><br>
      Make sure you are using the deployed website URL, not opening the file directly.
    `;
  }
}

async function saveProfile(){
  const status = document.getElementById("profileStatus");

  try{
    const sb = getSB();
    const user = await getLoggedInUser();

    if(!user){
      status.innerHTML = `You must log in first. <a class="btn" href="auth.html">Login</a>`;
      return;
    }

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

    const result = await sb
      .from("profiles")
      .upsert(patch);

    if(result.error){
      throw result.error;
    }

    status.textContent = "Profile saved.";
  }catch(err){
    status.textContent = "Save error: " + err.message;
  }
}

async function uploadAvatar(){
  const status = document.getElementById("profileStatus");

  try{
    const sb = getSB();
    const user = await getLoggedInUser();

    if(!user){
      status.innerHTML = `You must log in first. <a class="btn" href="auth.html">Login</a>`;
      return;
    }

    const file = document.getElementById("avatarFile").files[0];

    if(!file){
      status.textContent = "Choose an image first.";
      return;
    }

    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    status.textContent = "Uploading profile picture...";

    const url = await uploadFile("profile-images", path, file);

    const result = await sb
      .from("profiles")
      .upsert({
        id:user.id,
        email:user.email,
        avatar_url:url,
        updated_at:new Date().toISOString()
      });

    if(result.error){
      throw result.error;
    }

    document.getElementById("profileAvatar").src = url;
    status.textContent = "Profile picture uploaded.";
  }catch(err){
    status.textContent = "Upload error: " + err.message;
  }
}

async function loadProfileMessages(user){
  const box = document.getElementById("profileMessages");
  const sb = getSB();

  if(!box || !sb || !sb.from){
    return;
  }

  try{
    const result = await sb
      .from("player_messages")
      .select("*")
      .or(`recipient_user_id.eq.${user.id},recipient_email.eq.${user.email}`)
      .order("created_at", { ascending:false })
      .limit(5);

    if(result.error){
      throw result.error;
    }

    if(!result.data || !result.data.length){
      box.textContent = "No messages yet.";
      return;
    }

    box.innerHTML = result.data.map(m => `
      <div>
        <strong>${m.title || "Message"}</strong><br>
        ${m.body || ""}
        <hr>
      </div>
    `).join("");
  }catch(err){
    box.textContent = "Messages unavailable: " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const saveBtn = document.getElementById("saveProfileBtn");
  const uploadBtn = document.getElementById("uploadAvatarBtn");
  const avatarInput = document.getElementById("avatarFile");

  if(saveBtn){
    saveBtn.addEventListener("click", saveProfile);
  }

  if(uploadBtn){
    uploadBtn.addEventListener("click", uploadAvatar);
  }

  if(avatarInput){
    avatarInput.addEventListener("change", () => {
      const file = avatarInput.files[0];
      if(file){
        document.getElementById("profileAvatar").src = URL.createObjectURL(file);
      }
    });
  }

  loadProfile();
});
