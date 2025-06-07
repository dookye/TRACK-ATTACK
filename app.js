// --- Konstanten & Variablen --- //

const clientId = '53257f6a1c144d3f929a60d691a0c6f6';
const redirectUri = 'https://dookye.github.io/musik-raten/';
const scopes = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state'
];
const playlistMap = {
  // Genre -> Array von Playlists (ID strings)
  "Punk Rock (90's & 00')": ['39sVxPTg7BKwrf2MfgrtcD'],
  "Pop Hits 2000-2025": ['6mtYuOxzl58vSGnEDtZ9uB'],
  "Die größten Hits aller Zeiten": ['2si7ChS6Y0hPBt4FsobXpg']
};

let accessToken = null;
let player = null;
let deviceId = null;

let codeVerifier = null;

// Spielvariablen
let chosenMode = null;
let chosenModeTime = 30000; // Default 30s
let currentPlayer = 1;
let scores = [0, 0];
let currentRound = 0;
const maxRoundsPerPlayer = 10;
let currentGenre = null;
let currentPlaylistTracks = [];
let currentTrack = null;
let currentTrackDurationMs = 0;

let againCount = 4; // Anzahl "Nochmal hören"
let timer = null;
let timeoutId = null;

// --- Hilfsfunktionen --- //

// PKCE Helfer
function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for(let i=0; i<length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

function base64UrlEncode(buffer) {
  let str = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(buffer[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Auth URL bauen und redirect
async function startAuth() {
  codeVerifier = generateRandomString(128);
  localStorage.setItem('code_verifier', codeVerifier);

  const hashed = await sha256(codeVerifier);
  const codeChallenge = base64UrlEncode(hashed);

  const authUrl =
    'https://accounts.spotify.com/authorize' +
    '?response_type=code' +
    '&client_id=' + encodeURIComponent(clientId) +
    '&scope=' + encodeURIComponent(scopes.join(' ')) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&code_challenge_method=S256' +
    '&code_challenge=' + encodeURIComponent(codeChallenge);

  window.location = authUrl;
}

// Code aus URL holen
function getCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

// Access Token holen
async function fetchAccessToken(code) {
  const verifier = localStorage.getItem('code_verifier');
  const body = new URLSearchParams();
  body.append('client_id', clientId);
  body.append('grant_type', 'authorization_code');
  body.append('code', code);
  body.append('redirect_uri', redirectUri);
  body.append('code_verifier', verifier);

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: body.toString()
  });
  const data = await response.json();
  if (data.access_token) {
    return data.access_token;
  } else {
    throw new Error('Access Token konnte nicht geholt werden');
  }
}

// Spotify API call helper
async function spotifyApi(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Authorization': 'Bearer ' + accessToken
    }
  };
  if (body) {
    options.body = JSON.stringify(body);
    options.headers['Content-Type'] = 'application/json';
  }
  const response = await fetch('https://api.spotify.com/v1' + endpoint, options);
  if (response.status === 401) {
    alert('Token expired or invalid. Please reload and login again.');
    throw new Error('Unauthorized');
  }
  return response.json();
}

// Player initialisieren
function initPlayer() {
  window.onSpotifyWebPlaybackSDKReady = () => {
    player = new Spotify.Player({
      name: 'Track Attack Player',
      getOAuthToken: cb => { cb(accessToken); }
    });

    // Fehler-Handling
    player.addListener('initialization_error', ({message}) => { console.error(message); });
    player.addListener('authentication_error', ({message}) => { console.error(message); alert('Authentication Error'); });
    player.addListener('account_error', ({message}) => { console.error(message); alert('Account Error'); });
    player.addListener('playback_error', ({message}) => { console.error(message); alert('Playback Error'); });

    // Playback Status
    player.addListener('player_state_changed', state => {
      // Hier könnte man UI aktualisieren
    });

    // Gerät bereit
    player.addListener('ready', ({device_id}) => {
      console.log('Ready with Device ID', device_id);
      deviceId = device_id;
    });

    player.connect();
  };
}

// --- UI Helfer ---

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// --- Spiel-Logik ---

// Modi Buttons
function setupModeButtons() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      chosenModeTime = parseInt(btn.dataset.time);
      chosenMode = btn.textContent.trim();
      showScreen('genre-screen');
      updateScoreboard();
      updatePlayerTurn();
    });
  });
}

// Genre Buttons laden & Event
function setupGenreButtons() {
  document.querySelectorAll('.genre-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentGenre = btn.textContent.trim();
      showGameControls(true);
      await loadPlaylistTracks();
      resetRound();
    });
  });
}

// Show/Hide game controls
function showGameControls(show) {
  const gc = document.querySelector('.game-controls');
  if(show) {
    gc.style.display = 'flex';
  } else {
    gc.style.display = 'none';
  }
}

// Lade alle Tracks der ausgewählten Playlist (first 100 Tracks)
async function loadPlaylistTracks() {
  currentPlaylistTracks = [];
  currentTrack = null;
  againCount = 4;

  // Hole Playlist-ID aus Map
  const playlists = playlistMap[currentGenre];
  if (!playlists || playlists.length === 0) {
    alert('Keine Playlists für dieses Genre gefunden.');
    return;
  }

  // Einfach die erste Playlist benutzen
  const playlistId = playlists[0];

  let tracks = [];
  let offset = 0;
  let limit = 50;
  let total = 0;

  do {
    const res = await spotifyApi(`/playlists/${playlistId}/tracks?offset=${offset}&limit=${limit}`);
    tracks = tracks.concat(res.items);
    total = res.total;
    offset += limit;
  } while (offset < total && offset < 100); // max 100 Tracks laden

  // Filter auf Tracks mit preview_url oder Spotify-URI
  currentPlaylistTracks = tracks
    .filter(item => item.track && item.track.uri)
    .map(item => item.track);

  console.log(`Loaded ${currentPlaylistTracks.length} tracks from playlist ${playlistId}`);
}

// Reset Runde vorbereiten
function resetRound() {
  currentTrack = null;
  againCount = 4;
  updateAgainButton();
  clearSongInfo();
  setGameButtonsDisabled(true);
}

// Startet neue Runde mit Track
async function startRound() {
  if (currentPlaylistTracks.length === 0) {
    alert('Keine Tracks geladen.');
    return;
  }

  // Zufälliger Track
  const randomIndex = Math.floor(Math.random() * currentPlaylistTracks.length);
  currentTrack = currentPlaylistTracks[randomIndex];

  // Länge in ms (falls nicht vorhanden, Default 30s)
  currentTrackDurationMs = currentTrack.duration_ms || 30000;

  // Startzeitpunkt zufällig wählen (max Start = Dauer - 10s)
  let maxStartMs = currentTrackDurationMs - 10000;
  if(maxStartMs < 0) maxStartMs = 0;
  const startPositionMs = Math.floor(Math.random() * maxStartMs);

  // Track spielen (auf dem Web Playback SDK Device)
  await playTrack(currentTrack.uri, startPositionMs);

  // Reset UI
  againCount = 4;
  updateAgainButton();
  clearSongInfo();

  setGameButtonsDisabled(false, false, false, false, false);

  // Timer Start für Modus
  startTimer(chosenModeTime);
}

// Play Track via Spotify API Web Playback SDK
async function playTrack(uri, positionMs) {
  if (!deviceId) {
    alert('Spotify Player noch nicht bereit.');
    return;
  }
  // Transfer Playback auf unseren Player
  await fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    body: JSON.stringify({
      device_ids: [deviceId],
      play: true
    }),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken
    }
  });

  // Start Play auf Track mit Position
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({
      uris: [uri],
      position_ms: positionMs
    }),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken
    }
  });
}

// Timer-Funktion
function startTimer(ms) {
  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    // Automatisch "Auflösen"
    onReveal();
  }, ms);
}

// Stop Timer
function stopTimer() {
  clearTimeout(timeoutId);
}

// UI Updates für Buttons
function setGameButtonsDisabled(trackAttack, again, reveal, right, wrong) {
  document.getElementById('track-attack-btn').disabled = trackAttack;
  document.getElementById('again-btn').disabled = again;
  document.getElementById('reveal-btn').disabled = reveal;
  document.getElementById('right-btn').disabled = right;
  document.getElementById('wrong-btn').disabled = wrong;
}

// "Nochmal hören" Button aktualisieren
function updateAgainButton() {
  const btn = document.getElementById('again-btn');
  btn.disabled = againCount <= 0;
  btn.textContent = `NOCHMAL HÖREN (${againCount})`;
}

// Songinfo anzeigen (Titel & Künstler)
function showSongInfo() {
  const infoDiv = document.getElementById('song-info');
  infoDiv.textContent = `${currentTrack.name} — ${currentTrack.artists.map(a => a.name).join(', ')}`;
}

// Songinfo löschen
function clearSongInfo() {
  const infoDiv = document.getElementById('song-info');
  infoDiv.textContent = '';
}

// Scoreboard aktualisieren
function updateScoreboard() {
  document.getElementById('score-team1').textContent = scores[0];
  document.getElementById('score-team2').textContent = scores[1];
}

// Aktueller Spieler anzeigen
function updatePlayerTurn() {
  document.getElementById('player-turn').textContent = currentPlayer;
}

// Wechsel Spieler & Runde erhöhen
function nextPlayer() {
  currentRound++;
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  updatePlayerTurn();
}

// Runden Limit prüfen & evtl. Spiel beenden
function checkEndGame() {
  if (currentRound >= maxRoundsPerPlayer * 2) {
    showScreen('end-screen');
    document.getElementById('final-score-team1').textContent = scores[0];
    document.getElementById('final-score-team2').textContent = scores[1];
    return true;
  }
  return false;
}

// --- Event Handler ---

async function onTrackAttack() {
  stopTimer();
  await startRound();
  setGameButtonsDisabled(true, false, false, false, false);
}

function onAgain() {
  if (againCount > 0) {
    againCount--;
    updateAgainButton();
    // Track nochmal abspielen von zufälliger Position (um es nicht zu einfach zu machen)
    const maxStartMs = currentTrackDurationMs - 10000 > 0 ? currentTrackDurationMs - 10000 : 0;
    const startPositionMs = Math.floor(Math.random() * maxStartMs);
    playTrack(currentTrack.uri, startPositionMs);
  }
}

function onReveal() {
  stopTimer();
  showSongInfo();
  setGameButtonsDisabled(true, true, true, false, false);
  // Richtige / Falsche Buttons aktivieren
  document.getElementById('right-btn').disabled = false;
  document.getElementById('wrong-btn').disabled = false;
}

function onRight() {
  scores[currentPlayer -1]++;
  updateScoreboard();
  proceedNextRound();
}

function onWrong() {
  proceedNextRound();
}

function proceedNextRound() {
  if(checkEndGame()) return;
  nextPlayer();
  resetRound();
  setGameButtonsDisabled(false, true, true, true, true);
}

// --- Login & Init ---

async function handleAuth() {
  const code = getCodeFromUrl();

  if (!code && !accessToken) {
    // Noch nicht angemeldet
    return;
  }

  if (code && !accessToken) {
    try {
      accessToken = await fetchAccessToken(code);
      window.history.replaceState({}, document.title, redirectUri);
      localStorage.removeItem('code_verifier');
      initPlayer();
      showScreen('mode-screen');
    } catch(e) {
      alert('Fehler beim Login: ' + e.message);
    }
  }
}

// --- Setup Event Listeners ---

function setupEventListeners() {
  document.getElementById('login-button').addEventListener('click', () => {
    startAuth();
  });

  setupModeButtons();
  setupGenreButtons();

  document.getElementById('track-attack-btn').addEventListener('click', onTrackAttack);
  document.getElementById('again-btn').addEventListener('click', onAgain);
  document.getElementById('reveal-btn').addEventListener('click', onReveal);
  document.getElementById('right-btn').addEventListener('click', onRight);
  document.getElementById('wrong-btn').addEventListener('click', onWrong);
  document.getElementById('restart-btn').addEventListener('click', () => {
    scores = [0, 0];
    currentRound = 0;
    currentPlayer = 1;
    updateScoreboard();
    updatePlayerTurn();
    showScreen('mode-screen');
  });
}

// --- Main Init ---

window.onload = async () => {
  await handleAuth();
  setupEventListeners();
};
