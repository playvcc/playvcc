// VCC MAIN APP
document.addEventListener("DOMContentLoaded", () => {
    console.log("VCC Loaded");

    window.unlockAdmin = function () {
        const code = prompt("Enter Admin Code");
        const ADMIN_CODE = "VCC2026Secure";

        if(code === ADMIN_CODE){
            sessionStorage.setItem("vcc_admin","true");
            alert("Admin Access Granted");
        } else {
            alert("Invalid Code");
        }
    };
});
