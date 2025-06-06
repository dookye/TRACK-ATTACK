const clientId = '53257f6a1c144d3f929a60d691a0c6f6';
const redirectUri = 'https://dookye.github.io/musik-raten/callback.html';
const playlistId = '39sVxPTg7BKwrf2MfgrtcD';

let accessToken = null;
let player = null;
let deviceId = null;

const loginBtn = document.getElementById('login-btn');
const startBtn = document.getElementById('start-btn');
const status = document.getElementById('status');
const trackInfo = document.getElementById('track-info');

function generateRandomInt(max) {
  return Math.floor(Math.random() * max);
}

function getAccessTokenFromUrl() {
  const params = new URLSearchParams(window.location.hash.replace('#', '?'));
  return params.get('access_token');
}

function showLogin() {
  loginBtn.style.display = 'inline-block';
  status.textContent = 'Bitte bei Spotify einloggen, um das Spiel zu starten.';
  loginBtn.onclick = () => {
    const scopes = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    window.location = authUrl;
  };
}

window.onSpotifyWebPlaybackSDKReady = () => {
  const token = accessToken;
  player = new Spotify.Player({
    name: 'Musikraten Test Player',
    getOAuthToken: cb => cb(token)
  });

  player.addListener('initialization_error', ({ message }) => {
    status.textContent = 'Init Error: ' + message;
  });
  player.addListener('authentication_error', ({ message }) => {
    status.textContent = 'Auth Error: ' + message;
  });
  player.addListener('account_error', ({ message }) => {
    status.textContent = 'Account Error: ' + message;
  });
  player.addListener('playback_error', ({ message }) => {
    status.textContent = 'Playback Error: ' + message;
  });

  player.addListener('ready', ({ device_id }) => {
    deviceId = device_id;
    status.textContent = 'Spotify Player ist bereit! Du kannst jetzt starten.';
    loginBtn.style.display = 'none';
    startBtn.style.display = 'inline-block';
  });

  player.connect();
};

async function playRandomSong() {
  if (!deviceId) {
    status.textContent = 'Spotify Player ist nicht bereit.';
    return;
  }

  try {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    const tracks = data.items;
    if (!tracks.length) {
      status.textContent = 'Keine Songs in der Playlist gefunden.';
      return;
    }

    const randomIndex = generateRandomInt(tracks.length);
    const track = tracks[randomIndex].track;

    const durationMs = track.duration_ms;
    const maxStart = durationMs - 3000;
    const startPosition = maxStart > 0 ? generateRandomInt(maxStart) : 0;

    // NICHT anzeigen – wird erst für die spätere "Auflösung" gebraucht
    trackInfo.textContent = `${track.name} – ${track.artists.map(a => a.name).join(', ')}`;
    document.getElementById('solution').style.display = 'none';

    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: 'PUT',
      body: JSON.stringify({
        uris: [track.uri],
        position_ms: startPosition
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      }
    });

    status.textContent = 'Spiele Song…';
    setTimeout(() => {
      player.pause();
      status.textContent = 'Song wurde 3 Sekunden gespielt. Drücke Start für nächsten Song.';
    }, 3000);
  } catch (error) {
    status.textContent = 'Fehler beim Abspielen: ' + error.message;
  }
}

startBtn.addEventListener('click', playRandomSong);

function main() {
  accessToken = localStorage.getItem('spotifyAccessToken');

  if (!accessToken) {
    showLogin();
  } else {
    status.textContent = 'Spotify Player wird geladen...';
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    document.body.appendChild(script);
  }
}

window.onload = main;