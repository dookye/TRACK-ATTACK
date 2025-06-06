const clientId = '3f4b3acc3bad4e0d98e77409ffc62e48';
const redirectUri = window.location.origin + 'https://dookye.github.io/musik-raten/callback.html';
const loginBtn = document.getElementById('loginBtn');
const statusEl = document.getElementById('status');

const accessToken = localStorage.getItem('spotifyAccessToken');

if (!accessToken) {
  statusEl.innerText = 'Nicht eingeloggt.';
  loginBtn.style.display = 'inline-block';
} else {
  statusEl.innerText = 'Authentifiziere Spotify Player...';
  loginBtn.style.display = 'none';

  window.onSpotifyWebPlaybackSDKReady = () => {
    const player = new Spotify.Player({
      name: 'Musikraten Test Player',
      getOAuthToken: cb => cb(accessToken),
      volume: 0.5
    });

    // Player-Event: Ready
    player.addListener('ready', ({ device_id }) => {
      console.log('Bereit mit Device ID', device_id);
      statusEl.innerText = 'Spotify Player bereit!';
    });

    // Player-Event: Nicht bereit
    player.addListener('not_ready', ({ device_id }) => {
      console.log('Nicht bereit mit Device ID', device_id);
      statusEl.innerText = 'Player nicht bereit.';
    });

    // Fehlerbehandlung
    player.addListener('initialization_error', ({ message }) => {
      console.error(message);
      statusEl.innerText = 'Init-Fehler: ' + message;
    });

    player.addListener('authentication_error', ({ message }) => {
      console.error(message);
      statusEl.innerText = 'Auth-Fehler: ' + message;
      loginBtn.style.display = 'inline-block';
    });

    player.addListener('account_error', ({ message }) => {
      console.error(message);
      statusEl.innerText = 'Account-Fehler: ' + message;
    });

    player.connect();
  };
}

// Login-Button öffnet Spotify OAuth URL
loginBtn.onclick = () => {
  const scopes = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  window.location.href = authUrl;
};