
// ======================================================
// VCC Admin Access Lock
// ======================================================

const VCC_ADMIN_CODE = "VCC-SiN-9Q7M-4K2X-8R5P-2026!";
const VCC_ADMIN_SESSION_KEY = "vcc_admin_verified";

(function(){

  function buildLockScreen(){
    document.body.innerHTML = `
      <div style="
        min-height:100vh;
        background:#050505;
        color:#fff;
        display:flex;
        align-items:center;
        justify-content:center;
        font-family:Arial;
        padding:20px;
      ">
        <div style="
          width:100%;
          max-width:460px;
          background:#111;
          border:1px solid #2d2d2d;
          border-radius:18px;
          padding:30px;
          box-shadow:0 20px 50px rgba(0,0,0,.45);
        ">
          <div style="
            color:#f5c542;
            font-weight:900;
            letter-spacing:.12em;
            margin-bottom:8px;
            text-transform:uppercase;
            font-size:13px;
          ">VCC Secure Admin</div>

          <h1 style="margin:0 0 12px;font-size:34px;">Admin Access Required</h1>

          <p style="color:#aaa;line-height:1.5;">
            Enter the VCC admin access code to continue.
          </p>

          <input
            id="vccAdminCodeInput"
            type="password"
            placeholder="Enter admin code"
            style="
              width:100%;
              box-sizing:border-box;
              margin-top:18px;
              padding:14px;
              border-radius:12px;
              border:1px solid #333;
              background:#070707;
              color:#fff;
              font-size:15px;
            "
          >

          <button
            id="vccAdminUnlockBtn"
            style="
              width:100%;
              margin-top:14px;
              padding:14px;
              border:0;
              border-radius:12px;
              background:#f5c542;
              color:#000;
              font-weight:900;
              cursor:pointer;
              font-size:15px;
            "
          >
            Unlock Admin Panel
          </button>

          <div
            id="vccAdminError"
            style="
              margin-top:14px;
              color:#ff5c5c;
              font-weight:700;
              display:none;
            "
          >
            Invalid admin code.
          </div>
        </div>
      </div>
    `;

    document.getElementById("vccAdminUnlockBtn").addEventListener("click", verifyCode);
    document.getElementById("vccAdminCodeInput").addEventListener("keydown", (e) => {
      if(e.key === "Enter") verifyCode();
    });
  }

  function verifyCode(){
    const input = document.getElementById("vccAdminCodeInput");
    const error = document.getElementById("vccAdminError");

    if(input.value === VCC_ADMIN_CODE){
      sessionStorage.setItem(VCC_ADMIN_SESSION_KEY, "true");
      location.reload();
      return;
    }

    error.style.display = "block";
    input.value = "";
    input.focus();
  }

  function hasAccess(){
    return sessionStorage.getItem(VCC_ADMIN_SESSION_KEY) === "true";
  }

  if(!hasAccess()){
    buildLockScreen();
  }

})();
