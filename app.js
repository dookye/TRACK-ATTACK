// app.js

const clientId = '53257f6a1c144d3f929a60d691a0c6f6';
const redirectUri = 'https://dookye.github.io/musik-raten/';
const playlistId = '39sVxPTg7BKwrf2MfgrtcD';

let accessToken = null;
let tracks = [];
let currentTrack = null;
let currentRound = 0;
const totalRounds = 10;
let score = 0;
let guessTimeout = null;

const startButton = document.getElementById('startButton');
const guessInput = document.getElementById('guessInput');
const statusDiv = document.getElementById('status');
const scoreDiv = document.getElementById('score');

// --- PKCE Hilfsfunktionen ---

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

// --- Spotify Auth & Token ---

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

// --- Spotify API Funktionen ---

async function getPlaylistTracks() {
  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error('Failed to fetch playlist tracks');
  const data = await response.json();
  return data.items.map(item => item.track);
}

async function getActiveDevice() {
  const deviceResponse = await fetch('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!deviceResponse.ok) throw new Error('Failed to fetch devices');
  const deviceData = await deviceResponse.json();
  return deviceData.devices.find(d => d.is_active);
}

async function playTrack(track, deviceId) {
  const maxStart = Math.max(0, track.duration_ms - 5000);
  const startMs = Math.floor(Math.random() * maxStart);

  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      uris: [track.uri],
      position_ms: startMs
    })
  });
}

async function pauseTrack(deviceId) {
  await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

// --- Spiel-Logik ---

function updateScoreDisplay() {
  scoreDiv.textContent = `Punkte: ${score} | Runde: ${currentRound} / ${totalRounds}`;
}

function updateStatus(message) {
  statusDiv.textContent = message;
}

function resetGame() {
  currentRound = 0;
  score = 0;
  tracks = [];
  currentTrack = null;
  guessInput.value = '';
  guessInput.disabled = true;
  updateScoreDisplay();
  updateStatus('Drücke TRACK ATTACK zum Starten');
  clearTimeout(guessTimeout);
}

async function startGame() {
  updateStatus('Lade Playlist...');
  try {
    tracks = await getPlaylistTracks();
    if (tracks.length === 0) {
      updateStatus('Playlist ist leer.');
      return;
    }
    currentRound = 0;
    score = 0;
    updateScoreDisplay();
    guessInput.disabled = false;
    await nextRound();
  } catch (error) {
    updateStatus('Fehler beim Laden der Playlist.');
    console.error(error);
  }
}

async function nextRound() {
  clearTimeout(guessTimeout);
  guessInput.value = '';
  if (currentRound >= totalRounds) {
    updateStatus(`Spiel beendet! Deine Punkte: ${score}`);
    guessInput.disabled = true;
    return;
  }
  currentRound++;
  updateScoreDisplay();

  // Zufälligen Track wählen, der noch nicht gespielt wurde
  if (tracks.length === 0) {
    updateStatus('Keine Tracks mehr.');
    guessInput.disabled = true;
    return;
  }
  currentTrack = tracks.splice(Math.floor(Math.random() * tracks.length), 1)[0];

  const activeDevice = await getActiveDevice();
  if (!activeDevice) {
    updateStatus('Starte in der Spotify-App einen Song, um ein Gerät zu aktivieren.');
    guessInput.disabled = true;
    return;
  }

  try {
    await playTrack(currentTrack, activeDevice.id);
    updateStatus(`Runde ${currentRound}: Hör gut zu und rate!`);
    // Timer für 10 Sekunden, dann nächste Runde
    guessTimeout = setTimeout(() => {
      updateStatus(`Zeit vorbei! Richtige Antwort: "${currentTrack.name}" von ${currentTrack.artists.map(a => a.name).join(', ')}`);
      nextRound();
    }, 10000);
  } catch (error) {
    updateStatus('Fehler beim Abspielen.');
    console.error(error);
  }
}

function checkGuess() {
  const guess = guessInput.value.trim().toLowerCase();
  if (!guess || !currentTrack) return;

  const trackName = currentTrack.name.toLowerCase();
  // Einfacher Check, ob der Trackname den Tipp enthält oder umgekehrt
  if (trackName.includes(guess) || guess.includes(trackName)) {
    score++;
    updateStatus('Richtig! +1 Punkt.');
    updateScoreDisplay();
    clearTimeout(guessTimeout);
    nextRound();
  } else {
    updateStatus('Falsch, probier es nochmal!');
  }
}

// --- Init & EventListener ---

async function init() {
  // Prüfen ob access_token in URL (Code Flow)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('code') && !localStorage.getItem('access_token')) {
    const code = urlParams.get('code');
    try {
      await fetchAccessToken(code);
      // URL ohne Code neu laden
      window.history.replaceState({}, document.title, redirectUri);
      accessToken = localStorage.getItem('access_token');
      updateStatus('Eingeloggt. Drücke TRACK ATTACK, um zu starten.');
    } catch (error) {
      updateStatus('Login fehlgeschlagen.');
      console.error(error);
    }
  } else {
    accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      updateStatus('Eingeloggt. Drücke TRACK ATTACK, um zu starten.');
    } else {
      updateStatus('Bitte zuerst einloggen.');
    }
  }
}

startButton.addEventListener('click', () => {
  if (!accessToken) {
    redirectToSpotifyAuth();
  } else {
    startGame();
  }
});

guessInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    checkGuess();
  }
});

window.addEventListener('load', () => {
  resetGame();
  init();
});
