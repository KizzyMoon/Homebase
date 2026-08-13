(() => {
  const CONTROL_SCOPE = 'user-read-currently-playing user-read-playback-state user-modify-playback-state';

  function getSpotifyConfig() {
    try {
      return JSON.parse(localStorage.getItem('homebase.spotifyConfig') || '{}');
    } catch {
      return {};
    }
  }

  function base64UrlEncode(bytes) {
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  async function sha256(text) {
    return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  }

  function randomVerifier() {
    const bytes = new Uint8Array(64);
    crypto.getRandomValues(bytes);
    return base64UrlEncode(bytes);
  }

  function spotifyRedirectUri() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  async function startSpotifyLogin() {
    const { clientId } = getSpotifyConfig();
    if (!clientId) return;

    const verifier = randomVerifier();
    const challenge = base64UrlEncode(await sha256(verifier));
    const state = crypto.randomUUID();

    sessionStorage.setItem('spotify.pkce.verifier', verifier);
    sessionStorage.setItem('spotify.pkce.state', state);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: spotifyRedirectUri(),
      scope: CONTROL_SCOPE,
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params}`;
  }

  function token() {
    return localStorage.getItem('spotify.accessToken') || '';
  }

  async function spotifyCommand(method, endpoint) {
    const accessToken = token();
    if (!accessToken) return false;

    const response = await fetch(`https://api.spotify.com/v1/me/player/${endpoint}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (response.status === 403) {
      const alreadyPrompted = sessionStorage.getItem('spotify.controlScopePrompted');
      if (!alreadyPrompted) {
        sessionStorage.setItem('spotify.controlScopePrompted', '1');
        await startSpotifyLogin();
      }
      return false;
    }

    return response.ok || response.status === 204;
  }

  function getControlAction(button) {
    const svg = button?.querySelector('svg');
    if (!svg) return null;
    const lucide = svg.getAttribute('data-lucide') || '';
    const cls = svg.getAttribute('class') || '';
    const html = svg.outerHTML.toLowerCase();
    const marker = `${lucide} ${cls} ${html}`;

    if (marker.includes('skip-back')) return 'previous';
    if (marker.includes('skip-forward')) return 'next';
    if (marker.includes('pause')) return 'pause';
    if (marker.includes('play')) return 'play';
    return null;
  }

  document.addEventListener('click', async (event) => {
    const connectButton = event.target.closest('button');
    if (connectButton && /connect spotify/i.test(connectButton.textContent || '')) {
      const { clientId } = getSpotifyConfig();
      if (clientId) {
        event.preventDefault();
        event.stopImmediatePropagation();
        await startSpotifyLogin();
      }
      return;
    }

    const button = event.target.closest('.now-playing-card button');
    if (!button) return;

    const action = getControlAction(button);
    if (!action) return;

    if (action === 'previous') await spotifyCommand('POST', 'previous');
    if (action === 'next') await spotifyCommand('POST', 'next');
    if (action === 'pause') await spotifyCommand('PUT', 'pause');
    if (action === 'play') await spotifyCommand('PUT', 'play');
  }, true);
})();
