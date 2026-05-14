
// ======================================================
// VCC Scrim Queue Alert Sound Patch
// Add this after vcc-queue.js on scrims.html
// ======================================================

(function(){
  let audioReady = false;
  let ctx = null;

  function initAudio(){
    if(audioReady) return;
    try{
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioReady = true;
    }catch(e){}
  }

  function beep(freq, duration, delay){
    if(!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration + 0.02);
  }

  window.playVCCMatchFoundSound = function(){
    initAudio();
    if(!ctx) return;
    if(ctx.state === "suspended") ctx.resume();
    beep(880, 0.18, 0);
    beep(1175, 0.18, 0.22);
    beep(1568, 0.28, 0.44);
  };

  // User must click once before browser allows sound.
  document.addEventListener("click", initAudio, { once:false });

  const oldShow = window.showMatchAlert;
  if(typeof oldShow === "function"){
    window.showMatchAlert = function(offer){
      oldShow(offer);
      window.playVCCMatchFoundSound();
    };
  }

  // Also observe the popup class in case the original function is scoped and not global.
  document.addEventListener("DOMContentLoaded", () => {
    const alertBox = document.getElementById("matchAlert");
    if(!alertBox) return;

    let wasShown = alertBox.classList.contains("show");
    const obs = new MutationObserver(() => {
      const isShown = alertBox.classList.contains("show");
      if(isShown && !wasShown) window.playVCCMatchFoundSound();
      wasShown = isShown;
    });

    obs.observe(alertBox, { attributes:true, attributeFilter:["class"] });
  });
})();
