// app.js

const clientId = '53257f6a1c144d3f929a60d691a0c6f6';
const redirectUri = 'https://dookye.github.io/musik-raten/';
const playlistId = '39sVxPTg7BKwrf2MfgrtcD';
let accessToken = null;

// --- Hilfsfunktionen für PKCE ---

function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// --- Spotify Login ---

async function redirectToSpotifyAuth() {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await sha256(codeVerifier);
  localStorage.setItem('code_verifier', codeVerifier);

  const args = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'user-read-playback-state user-modify-playback-state streaming',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });

  window.location = 'https://accounts.spotify.com/authorize?' + args.toString();
}

async function fetchAccessToken(code) {
  const codeVerifier = localStorage.getItem('code_verifier');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error('Failed to fetch access token');
  }

  const data = await response.json();
  accessToken = data.access_token;
  localStorage.setItem('access_token', accessToken);
}

// --- Spotify Gameplay-Logik ---

async function getPlaylistTracks() {
  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error('Failed to fetch playlist tracks');
  const data = await response.json();
  return data.items.map(item => item.track);
}

async function playRandomTrack() {
  const tracks = await getPlaylistTracks();
  if (tracks.length === 0) {
    alert('Playlist ist leer.');
    return;
  }
  const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];

  // Geräte abfragen
  const deviceResponse = await fetch('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!deviceResponse.ok) throw new Error('Failed to fetch devices');
  const deviceData = await deviceResponse.json();
  const activeDevice = deviceData.devices.find(d => d.is_active);

  if (!activeDevice) {
    alert('Bitte starte zuerst in der Spotify-App die Wiedergabe, um ein aktives Gerät zu aktivieren.');
    return;
  }

  // Startposition zufällig wählen, max Trackdauer - 5 Sekunden
  const maxStart = Math.max(0, randomTrack.duration_ms - 5000);
  const startMs = Math.floor(Math.random() * maxStart);

  // Track abspielen
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${activeDevice.id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      uris: [randomTrack.uri],
      position_ms: startMs
    })
  });

  // Nach 3 Sekunden pausieren
  setTimeout(async () => {
    await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${activeDevice.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` }
    });
  }, 3000);
}

// --- Hauptfunktion für den Start-Button ---

async function onStartButtonClick() {
  try {
    if (!accessToken) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('code')) {
        const code = urlParams.get('code');
        await fetchAccessToken(code);
        // URL säubern, damit der Code nicht nochmal verwendet wird
        history.replaceState(null, null, redirectUri);
      } else {
        await redirectToSpotifyAuth();
        return; // nach Redirect nicht weiter ausführen
      }
    }
    await playRandomTrack();
  } catch (error) {
    alert('Fehler: ' + error.message);
    console.error(error);
  }
}

// --- Initialisierung ---

document.getElementById('startButton').addEventListener('click', onStartButtonClick);

// Versuche Access Token aus localStorage zu laden (wenn schon vorhanden)
accessToken = localStorage.getItem('access_token');
