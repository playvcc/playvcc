const VCC_PROFILE_KEY = "vcc_player_profile_v3";

const defaults = {
  displayName: "VCC PLAYER",
  riotId: "Not set",
  rank: "Unranked",
  platform: "Console",
  region: "NA",
  role: "Flex",
  agents: "Not set",
  bio: "Competitive console Valorant player competing in the VCC ecosystem.",
  avatar: ""
};

function loadProfile() {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(VCC_PROFILE_KEY) || "{}") };
  } catch {
    return { ...defaults };
  }
}

function saveProfile(data) {
  localStorage.setItem(VCC_PROFILE_KEY, JSON.stringify({ ...loadProfile(), ...data }));
}

function text(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value || "Not set";
}

function value(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val && val !== "Not set" ? val : "";
}

function img(id, src) {
  const el = document.getElementById(id);
  if (el && src) el.src = src;
}

function renderProfile() {
  const p = loadProfile();

  text("heroTitle", p.displayName || "VCC PLAYER");
  text("heroRank", p.rank || "Unranked");
  text("heroPlatform", p.platform || "Console");
  text("heroRegion", p.region || "NA");
  text("heroBio", p.bio || defaults.bio);
  text("riotDisplay", p.riotId);
  text("roleDisplay", p.role);
  text("agentsDisplay", p.agents);
  text("platformDisplay", p.platform);
  text("regionDisplay", p.region);
  img("profileAvatar", p.avatar);

  value("displayNameInput", p.displayName);
  value("riotInput", p.riotId);
  value("rankInput", p.rank);
  value("platformInput", p.platform);
  value("regionInput", p.region);
  value("roleInput", p.role);
  value("agentsInput", p.agents);
  value("bioInput", p.bio);
  img("editAvatarPreview", p.avatar);
}

function setupUpload() {
  const input = document.getElementById("profilePicInput");
  const btn = document.getElementById("uploadProfilePicBtn");
  const status = document.getElementById("uploadStatus");

  if (!input || !btn) return;

  btn.addEventListener("click", () => {
    const file = input.files?.[0];

    if (!file) {
      if (status) status.textContent = "Choose a picture first.";
      return;
    }

    if (!file.type.startsWith("image/")) {
      if (status) status.textContent = "Please upload an image file.";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      saveProfile({ avatar: reader.result });
      img("editAvatarPreview", reader.result);
      if (status) status.textContent = "Profile picture saved.";
    };
    reader.readAsDataURL(file);
  });
}

function setupForm() {
  const form = document.getElementById("profileForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    saveProfile({
      displayName: document.getElementById("displayNameInput")?.value.trim() || "VCC PLAYER",
      riotId: document.getElementById("riotInput")?.value.trim() || "Not set",
      rank: document.getElementById("rankInput")?.value.trim() || "Unranked",
      platform: document.getElementById("platformInput")?.value.trim() || "Console",
      region: document.getElementById("regionInput")?.value.trim() || "NA",
      role: document.getElementById("roleInput")?.value.trim() || "Flex",
      agents: document.getElementById("agentsInput")?.value.trim() || "Not set",
      bio: document.getElementById("bioInput")?.value.trim() || defaults.bio
    });

    window.location.href = "profile.html";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderProfile();
  setupUpload();
  setupForm();
});
