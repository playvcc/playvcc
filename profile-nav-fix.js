// VCC Profile Navigation Fix
// Keeps your profile layout, but adds a working site nav overlay.
// Add before </body> on profile.html:
// <script src="profile-nav-fix.js"></script>

(function(){
  function makeLink(href, label){
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    a.style.color = '#fff';
    a.style.textDecoration = 'none';
    a.style.fontWeight = '900';
    a.style.fontSize = '14px';
    a.style.padding = '10px 12px';
    a.style.border = '1px solid rgba(255,255,255,.14)';
    a.style.borderRadius = '10px';
    a.style.background = 'rgba(20,20,24,.92)';
    a.style.display = 'inline-flex';
    a.style.alignItems = 'center';
    a.style.justifyContent = 'center';
    a.style.minHeight = '38px';
    return a;
  }

  function addTopNav(){
    if(document.getElementById('vccProfileNavFix')) return;

    const nav = document.createElement('div');
    nav.id = 'vccProfileNavFix';

    nav.style.position = 'sticky';
    nav.style.top = '0';
    nav.style.zIndex = '99999';
    nav.style.display = 'flex';
    nav.style.flexWrap = 'wrap';
    nav.style.gap = '8px';
    nav.style.padding = '12px 18px';
    nav.style.background = 'rgba(3,3,5,.96)';
    nav.style.borderBottom = '1px solid rgba(255,255,255,.12)';
    nav.style.backdropFilter = 'blur(10px)';

    const links = [
      ['index.html', 'Home'],
      ['tournaments.html', 'Tournaments'],
      ['matches.html', 'Matches'],
      ['leaderboard.html', 'Leaderboard'],
      ['stats.html', 'Stats'],
      ['teams.html', 'Teams'],
      ['players.html', 'Players'],
      ['scrims.html', 'Scrims'],
      ['rules.html', 'Rules'],
      ['inbox.html', 'Inbox'],
      ['admin.html', 'Admin']
    ];

    links.forEach(([href,label]) => nav.appendChild(makeLink(href,label)));

    document.body.prepend(nav);
  }

  function fixExistingButtons(){
    document.querySelectorAll('a,button').forEach(el => {
      const text = (el.textContent || '').trim().toLowerCase();

      if(text === 'view teams'){
        el.onclick = () => location.href = 'teams.html';
      }

      if(text === 'open inbox'){
        el.onclick = () => location.href = 'inbox.html';
      }

      if(text === 'create team'){
        el.onclick = () => location.href = 'create-team.html';
      }

      if(text === 'manage team'){
        el.onclick = () => location.href = 'manage-team.html';
      }

      if(text === 'find scrim'){
        el.onclick = () => location.href = 'scrims.html';
      }

      if(text === 'message player'){
        el.onclick = () => location.href = 'message-player.html';
      }
    });
  }

  function addLeftIconTooltips(){
    const pageMap = [
      ['tournaments.html','Tournaments'],
      ['matches.html','Matches'],
      ['teams.html','Teams'],
      ['stats.html','Stats'],
      ['inbox.html','Inbox'],
      ['players.html','Players'],
      ['scrims.html','Scrims'],
      ['rules.html','Rules']
    ];

    const possibleIcons = document.querySelectorAll('.side-nav a, .sidebar a, aside a, [class*="side"] a');

    possibleIcons.forEach((a, index) => {
      if(!a.getAttribute('href') || a.getAttribute('href') === '#'){
        const map = pageMap[index % pageMap.length];
        a.href = map[0];
        a.title = map[1];
      }
    });
  }

  function init(){
    addTopNav();
    fixExistingButtons();
    addLeftIconTooltips();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
