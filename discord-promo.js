// VCC Discord Button / Promo Fix
// Put this before </body> on pages where you want the Discord button:
// <script src="discord-promo.js"></script>

// CHANGE THIS to your real SiN Discord invite link.
const VCC_DISCORD_INVITE = 'PASTE_YOUR_SIN_DISCORD_INVITE_LINK_HERE';

(function(){
  function inviteReady(){
    return VCC_DISCORD_INVITE && !VCC_DISCORD_INVITE.includes('PASTE_');
  }

  function goDiscord(event){
    event.preventDefault();

    if(!inviteReady()){
      alert('Discord invite link is not set yet. Open discord-promo.js and replace PASTE_YOUR_SIN_DISCORD_INVITE_LINK_HERE.');
      return;
    }

    window.open(VCC_DISCORD_INVITE, '_blank');
  }

  function makeDiscordBtn(extraClass=''){
    const a = document.createElement('a');
    a.href = inviteReady() ? VCC_DISCORD_INVITE : '#';
    a.textContent = 'Join VCC Discord';
    a.className = `btn discord-btn ${extraClass}`.trim();
    a.style.background = '#5865F2';
    a.style.color = '#fff';
    a.style.fontWeight = '900';
    a.style.border = '1px solid rgba(255,255,255,.18)';
    a.style.boxShadow = '0 12px 30px rgba(88,101,242,.25)';
    a.addEventListener('click', goDiscord);
    return a;
  }

  function addNavButton(){
    const nav = document.querySelector('.main-nav') || document.querySelector('nav');

    if(!nav || document.getElementById('vccDiscordNavBtn')) return;

    const btn = makeDiscordBtn();
    btn.id = 'vccDiscordNavBtn';
    btn.style.marginLeft = '8px';
    nav.appendChild(btn);
  }

  function addHomeHeroButton(){
    const isHome =
      location.pathname.endsWith('/') ||
      location.pathname.endsWith('/index.html') ||
      location.pathname.endsWith('/playvcc/');

    if(!isHome || document.getElementById('vccDiscordHeroBtn')) return;

    const heroActions =
      document.querySelector('.hero-actions') ||
      document.querySelector('.home-actions') ||
      document.querySelector('.cta-row') ||
      document.querySelector('.vcc-hero .actions') ||
      document.querySelector('.player-hero .hero-actions');

    if(heroActions){
      const btn = makeDiscordBtn();
      btn.id = 'vccDiscordHeroBtn';
      heroActions.appendChild(btn);
      return;
    }

    const main = document.querySelector('main') || document.body;
    const promo = document.createElement('section');
    promo.id = 'vccDiscordPromoCard';
    promo.className = 'vcc-card';
    promo.style.margin = '18px auto';
    promo.style.maxWidth = '1100px';
    promo.innerHTML = `
      <div class="vcc-panel-title">
        <h2>Join the VCC Discord</h2>
        <span>Community Hub</span>
      </div>
      <p>Join the Discord for scrims, team invites, tournament updates, match disputes, announcements, and support.</p>
    `;
    promo.appendChild(makeDiscordBtn());
    main.prepend(promo);
  }

  function fixExistingDiscordLinks(){
    document.querySelectorAll('a,button').forEach(el => {
      const text = (el.textContent || '').trim().toLowerCase();

      if(text.includes('discord') || text.includes('sin discord')){
        if(el.tagName.toLowerCase() === 'a'){
          el.href = inviteReady() ? VCC_DISCORD_INVITE : '#';
          el.target = '_blank';
        }

        el.addEventListener('click', goDiscord);
      }
    });
  }

  addNavButton();
  addHomeHeroButton();
  fixExistingDiscordLinks();
})();
