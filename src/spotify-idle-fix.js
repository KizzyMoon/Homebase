(function () {
  const style = document.createElement('style');
  style.textContent = `
    .music-card.spotify-idle .progress > span { width: 0 !important; transition: none !important; }
    .music-card.spotify-idle .controls { opacity: .45; pointer-events: none; }
    .music-card.spotify-idle .timecodes { opacity: .7; }
  `;
  document.head.appendChild(style);

  function spotifyConnected() {
    try {
      const access = localStorage.getItem('spotify.accessToken');
      const refresh = localStorage.getItem('spotify.refreshToken');
      return Boolean(access || refresh);
    } catch {
      return false;
    }
  }

  function applyIdleState() {
    const card = document.querySelector('.music-card');
    if (!card) return;

    const title = card.querySelector('.song-info strong');
    const subtitle = card.querySelector('.song-info span');
    if (!title || !subtitle) return;

    const idle = title.textContent.trim() === 'Nothing playing';
    card.classList.toggle('spotify-idle', idle);
    if (!idle) return;

    subtitle.textContent = spotifyConnected()
      ? 'Spotify connected · nothing playing'
      : 'Connect Spotify from Music';

    const times = card.querySelectorAll('.timecodes span');
    if (times[0]) times[0].textContent = '0:00';
    if (times[1]) times[1].textContent = '0:00';
  }

  const observer = new MutationObserver(() => requestAnimationFrame(applyIdleState));
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });

  window.addEventListener('DOMContentLoaded', applyIdleState);
  window.addEventListener('storage', (event) => {
    if (event.key && event.key.startsWith('spotify.')) applyIdleState();
  });
  setInterval(applyIdleState, 1000);
  requestAnimationFrame(applyIdleState);
})();