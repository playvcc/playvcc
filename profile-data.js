// VCC profile save/load + profile picture upload fix.
// This uses localStorage so it works on GitHub Pages without a backend.
// If you use Supabase later, this file can be swapped to save to your database/storage.

const VCC_PROFILE_KEY = "vcc_player_profile_v2";

const defaultProfile = {
  name: "Trozii",
  riotId: "SiN Trozii#NA2",
  rank: "Not set",
  platform: "PS5",
  region: "Central",
  role: "Flex / IGL",
  agents: "Yoru, Viper, Omen, KJ, Vyse, Sova, Skye",
  gender: "Male",
  bio: "Not set",
  avatar: ""
};

function getProfile() {
  try {
    return { ...defaultProfile, ...JSON.parse(localStorage.getItem(VCC_PROFILE_KEY) || "{}") };
  } catch {
    return { ...defaultProfile };
  }
}

function saveProfile(profile) {
  localStorage.setItem(VCC_PROFILE_KEY, JSON.stringify({ ...getProfile(), ...profile }));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "Not set";
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value && value !== "Not set" ? value : "";
}

function setImage(id, src) {
  const el = document.getElementById(id);
  if (!el) return;
  if (src) el.src = src;
}

function loadPublicProfile() {
  const profile = getProfile();

  setText("displayName", profile.name);
  setText("heroName", (profile.name || "PLAYER").toUpperCase());
  setText("displayRiotId", profile.riotId);
  setText("displayRank", profile.rank);
  setText("displayPlatform", profile.platform);
  setText("displayRegion", profile.region);
  setText("displayRole", profile.role);
  setText("displayAgents", profile.agents);
  setText("displayGender", profile.gender);

  setText("identityRiotId", profile.riotId);
  setText("identityRole", profile.role);
  setText("identityAgents", profile.agents);
  setText("identityBio", profile.bio);

  setImage("profileAvatar", profile.avatar);
}

function loadEditProfile() {
  const profile = getProfile();

  setValue("profileName", profile.name);
  setValue("riotId", profile.riotId);
  setValue("rank", profile.rank);
  setValue("platform", profile.platform);
  setValue("region", profile.region);
  setValue("mainRole", profile.role);
  setValue("mainAgents", profile.agents);
  setValue("gender", profile.gender);
  setValue("profileBio", profile.bio);

  setImage("editAvatarPreview", profile.avatar);
}

function initProfilePictureUpload() {
  const input = document.getElementById("profilePicInput");
  const button = document.getElementById("uploadProfilePicBtn");
  const preview = document.getElementById("editAvatarPreview");
  const status = document.getElementById("uploadStatus");

  if (!input || !button) return;

  button.addEventListener("click", () => {
    const file = input.files && input.files[0];

    if (!file) {
      if (status) status.textContent = "Choose an image first.";
      return;
    }

    if (!file.type.startsWith("image/")) {
      if (status) status.textContent = "Please choose an image file.";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const imageData = reader.result;
      saveProfile({ avatar: imageData });

      if (preview) preview.src = imageData;
      if (status) status.textContent = "Profile picture uploaded. Press Save Profile or go back to Profile.";
    };

    reader.onerror = () => {
      if (status) status.textContent = "Upload failed. Try another image.";
    };

    reader.readAsDataURL(file);
  });
}

function initProfileForm() {
  const form = document.getElementById("profileForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    saveProfile({
      name: document.getElementById("profileName")?.value.trim() || defaultProfile.name,
      riotId: document.getElementById("riotId")?.value.trim() || "Not set",
      rank: document.getElementById("rank")?.value.trim() || "Not set",
      platform: document.getElementById("platform")?.value.trim() || "Not set",
      region: document.getElementById("region")?.value.trim() || "Not set",
      role: document.getElementById("mainRole")?.value.trim() || "Not set",
      agents: document.getElementById("mainAgents")?.value.trim() || "Not set",
      gender: document.getElementById("gender")?.value || "Not set",
      bio: document.getElementById("profileBio")?.value.trim() || "Not set"
    });

    window.location.href = "profile.html";
  });
}

function initSignOut() {
  const btn = document.getElementById("signOutBtn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      if (window.supabaseClient?.auth?.signOut) {
        await window.supabaseClient.auth.signOut();
      }
    } catch {}

    sessionStorage.clear();
    window.location.href = "index.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadPublicProfile();
  loadEditProfile();
  initProfilePictureUpload();
  initProfileForm();
  initSignOut();
});
