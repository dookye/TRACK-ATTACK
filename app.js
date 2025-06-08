const clientId = '53257f6a1c144d3f929a60d691a0c6f6';
const redirectUri = 'https://dookye.github.io/musik-raten/';

let accessToken = null;
let player = null;
let deviceId = null;

let currentSong = null;
let currentGenre = null;
let currentMode = null;
let playCount = 0;

let teamScores = [0, 0];
let currentTeam = 0;
let roundsPlayed = 0;

const genres = {
  'Punk Rock (90\'s & 00\')': ['39sVxPTg7BKwrf2MfgrtcD'],
  'Pop Hits 2000-2025': ['6mtYuOxzl58vSGnEDtZ9uB'],
  'Die größten Hits aller Zeiten': ['2si7ChS6Y0hPBt4FsobXpg']
};

const modes = {
  'Normalo': 30,
  'like a Pro': 10,
  'bin ich geil oder was!': 2
};

// Hilfsfunktion zum Generieren von PKCE Code Challenge (vereinfacht)
async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i=0; i<length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function login() {
  const codeVerifier = generateRandomString(128);
  localStorage.setItem('code_verifier', codeVerifier);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const state = generateRandomString(16);
  const scope = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';

  const args = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scope,
    redirect_uri: redirectUri,
    state: state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });

  window.location = 'https://accounts.spotify.com/authorize?' + args;
}

async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const storedVerifier = localStorage.getItem('code_verifier');

  if (!code) return;

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    code_verifier: storedVerifier
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const data = await response.json();

  if (data.access_token) {
    accessToken = data.access_token;
    localStorage.removeItem('code_verifier');
    history.replaceState(null, null, redirectUri);
    showGameModeSelection();
    initPlayer();  // Player jetzt initialisieren
  } else {
    alert('Login fehlgeschlagen');
  }
}

window.onSpotifyWebPlaybackSDKReady = () => {
  if (!accessToken) {
    console.log('Kein Access Token, Player wird noch nicht initialisiert.');
    return;
  }

  player = new Spotify.Player({
    name: 'Track Attack Player',
    getOAuthToken: cb => { cb(accessToken); }
  });

  player.addListener('initialization_error', ({ message }) => { console.error(message); });
  player.addListener('authentication_error', ({ message }) => { 
    console.error(message); 
    alert('Spotify-Authentifizierungsfehler. Bitte neu einloggen.');
  });
  player.addListener('account_error', ({ message }) => { 
    console.error(message); 
    alert('Spotify Account-Fehler.');
  });
  player.addListener('playback_error', ({ message }) => { 
    console.error(message);
    alert('Playback-Fehler: ' + message);
  });

  player.addListener('player_state_changed', state => {
    // Hier kannst du UI-Updates machen bei Songwechsel etc.
    // console.log('Player state changed:', state);
  });

  player.addListener('ready', ({ device_id }) => {
    console.log('Spotify Player bereit mit Device ID', device_id);
    deviceId = device_id;
  });

  player.connect();
};

function initPlayer() {
  // Falls du noch extra Setup machen willst, hier rein.
  // Der Player wird im globalen onSpotifyWebPlaybackSDKReady initialisiert.
}

function playSong(uri, offsetSeconds, durationSeconds) {
  if (!deviceId) {
    alert('Player noch nicht bereit.');
    return;
  }

  fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    body: JSON.stringify({
      uris: [uri],
      position_ms: offsetSeconds * 1000
    }),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  }).then(() => {
    // Song startet, Timer für Stoppen nach durationSeconds:
    setTimeout(() => {
      player.pause();
    }, durationSeconds * 1000);
  }).catch(e => {
    console.error('Fehler beim Starten des Songs', e);
  });
}

// ... weitere Funktionen wie UI, Spielmechanik, Button-Events etc. unverändert.


function showLoginScreen() {
  document.getElementById('login-section').style.display = 'block';
  document.getElementById('mode-selection').style.display = 'none';
  document.getElementById('game-area').style.display = 'none';
}

window.onload = () => {
  handleRedirect();
  if (!accessToken) {
    showLoginScreen();
  } else {
    showGameModeSelection();
  }
};
