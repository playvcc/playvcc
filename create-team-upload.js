
function getSB(){ return window.supabaseClient || window.supabase || window.sb || null; }

async function getUser(){
  const sb = getSB();
  if(!sb?.auth?.getUser) return null;
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}

async function userAlreadyHasTeam(user){
  const sb = getSB();
  const { data, error } = await sb.from("teams").select("id,name").eq("captain_id", user.id).limit(1);
  if(error) throw error;
  return data && data.length ? data[0] : null;
}

async function uploadTeamLogo(user, file){
  if(!file) return null;
  const sb = getSB();
  const ext = file.name.split(".").pop();
  const path = `${user.id}/team-logo-${Date.now()}.${ext}`;
  const { error } = await sb.storage.from("team-logos").upload(path, file, { upsert:true });
  if(error) throw error;
  const { data } = sb.storage.from("team-logos").getPublicUrl(path);
  return data.publicUrl;
}

async function checkExistingTeam(){
  const status = document.getElementById("teamStatus");
  try{
    const user = await getUser();
    if(!user){ status.textContent = "Log in to create a team."; return; }

    const existing = await userAlreadyHasTeam(user);
    if(existing){
      document.getElementById("createTeamBox").style.display = "none";
      document.getElementById("alreadyTeamBox").style.display = "block";
      document.getElementById("alreadyTeamText").textContent = "You already created: " + (existing.name || existing.id);
    }
  }catch(err){
    status.textContent = "Team check error: " + err.message;
  }
}

async function createTeam(){
  const status = document.getElementById("teamStatus");
  try{
    const sb = getSB();
    const user = await getUser();
    if(!user){ status.textContent = "You must be logged in to create a team."; return; }

    const existing = await userAlreadyHasTeam(user);
    if(existing){
      status.textContent = "You already have a team. You cannot create more than one.";
      return;
    }

    const teamName = document.getElementById("teamName").value.trim();
    if(!teamName){ status.textContent = "Enter a team name."; return; }

    const logoFile = document.getElementById("teamLogoFile").files[0];
    let logoUrl = null;
    if(logoFile){
      status.textContent = "Uploading logo...";
      logoUrl = await uploadTeamLogo(user, logoFile);
    }

    const row = {
      name:teamName,
      tag:document.getElementById("teamTag").value.trim(),
      logo_url:logoUrl,
      bio:document.getElementById("teamBio").value.trim(),
      captain_id:user.id,
      created_at:new Date().toISOString()
    };

    const { data, error } = await sb.from("teams").insert(row).select().single();
    if(error) throw error;

    status.textContent = "Team created. ID:\n" + data.id;
    setTimeout(() => location.href = "manage-team.html", 1200);
  }catch(err){
    status.textContent = "Create team failed: " + err.message;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("teamLogoFile");
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if(file) document.getElementById("teamLogoPreview").src = URL.createObjectURL(file);
  });
  document.getElementById("createTeamBtn").addEventListener("click", createTeam);
  checkExistingTeam();
});
