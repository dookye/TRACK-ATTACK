// Deine neue Client-ID
const clientId = '53257f6a1c144d3f929a60d691a0c6f6';
// Redirect URI - muss exakt so auch im Spotify Developer Dashboard eingetragen sein
const redirectUri = 'https://dookye.github.io/musik-raten/callback.html';
// Playlist-ID "Punkrock 90 & 00"
const playlistId = '39sVxPTg7BKwrf2MfgrtcD';

let accessToken = null;
let player = null;
let deviceId = null;

const loginBtn = document.getElementById('login-btn');
const startBtn = document.getElementById('start-btn');
const status = document.getElementById('status');

function generateRandomInt(max) {
  return Math.floor(Math.random() * max);
}

// Hilfsfunktion: Zugriffstoken aus URL holen
function getAccessTokenFromUrl() {
  const params = new URLSearchParams(window.location.hash.replace('#', '?'));
  return params.get('access_token');
}

// Login Link bauen und Login Button anzeigen
function showLogin() {
  loginBtn.style.display = 'inline-block';
  status.textContent = 'Bitte bei Spotify einloggen, um das Spiel zu starten.';
  loginBtn.onclick = () => {
    const scopes = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
    window.location = authUrl;
  };
}

// Initialisierung Spotify Web Playback SDK
window.onSpotifyWebPlaybackSDKReady = () => {
  const token = accessToken;
  player = new Spotify.Player({
    name: 'Musikraten Test Player',
    getOAuthToken: cb => { cb(token); }
  });

  // Fehler-Handling
  player.addListener('initialization_error', ({ message }) => { status.textContent = 'Init Error: ' + message; });
  player.addListener('authentication_error', ({ message }) => { status.textContent = 'Auth Error: ' + message; });
  player.addListener('account_error', ({ message }) => { status.textContent = 'Account Error: ' + message; });
  player.addListener('playback_error', ({ message }) => { status.textContent = 'Playback Error: ' + message; });

  // Player-Status
  player.addListener('player_state_changed', state => {
    // Kann man hier nutzen, wenn nötig
  });

  // Gerät bereit
  player.addListener('ready', ({ device_id }) => {
    deviceId = device_id;
    status.textContent = 'Spotify Player ist bereit! Du kannst jetzt starten.';
    loginBtn.style.display = 'none';
    startBtn.style.display = 'inline-block';
  });

  player.connect();
};

// Song an zufälliger Stelle für 3 Sekunden spielen
async function playRandomSong() {
  if (!deviceId) {
    status.textContent = 'Spotify Player ist nicht bereit.';
    return;
  }

  try {
    // Playlist-Tracks holen
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    const tracks = data.items;
    if (!tracks.length) {
      status.textContent = 'Keine Songs in der Playlist gefunden.';
      return;
    }

    // Zufälligen Song auswählen
    const randomIndex = generateRandomInt(tracks.length);
    const track = tracks[randomIndex].track;

    // Song-Länge in ms
    const durationMs = track.duration_ms;
    // Zufällige Startposition, so dass mindestens 3 Sekunden übrig bleiben
    const maxStart = durationMs - 3000;
    const startPosition = maxStart > 0 ? generateRandomInt(maxStart) : 0;

    // Song starten
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

    status.textContent = 'Spiele...';
    // Nach 3 Sekunden stoppen
    setTimeout(() => {
      player.pause();
      status.textContent = 'Song wurde 3 Sekunden gespielt. Drücke Start für nächsten Song.';
    }, 3000);
  } catch (error) {
    status.textContent = 'Fehler beim Abspielen: ' + error.message;
  }
}

// Start-Button Klick
startBtn.addEventListener('click', () => {
  playRandomSong();
});

// Main Funktion zum Starten
function main() {
  accessToken = getAccessTokenFromUrl();

  if (!accessToken) {
    showLogin();
  } else {
    status.textContent = 'Spotify Player wird geladen...';
    // SDK laden (spotify-player.js von Spotify)  
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    document.body.appendChild(script);
  }
}

window.onload = main;