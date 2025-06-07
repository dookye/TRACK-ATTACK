// --- PKCE Authorization Code Flow Setup ---

const clientId = '53257f6a1c144d3f929a60d691a0c6f6';
const redirectUri = 'https://dookye.github.io/musik-raten/';
const scopes = [
  'user-read-private',
  'user-read-email',
  'streaming',
  'user-modify-playback-state'
].join(' ');

const authEndpoint = 'https://accounts.spotify.com/authorize';
const tokenEndpoint = 'https://accounts.spotify.com/api/token';

const loginButton = document.getElementById('login-button');
const loginError = document.getElementById('login-error');
const loginArea = document.getElementById('login-area');
const gameModeSelection = document.getElementById('game-mode-selection');
const startGameButton = document.getElementById('start-game-button');
const messageEl = document.getElementById('message');

let selectedPlaylistId = null;
let selectedGameMode = null;

// PKCE Helpers
function generateRandomString(len = 128) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  return Array.from({length:len}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
}

async function generateCodeChallenge(verifier) {
  const buffer = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Start Spotify Login
loginButton.addEventListener('click', async () => {
  loginError.style.display = 'none';
  try {
    const codeVerifier = generateRandomString();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    sessionStorage.setItem('code_verifier', codeVerifier);
    const state = generateRandomString(16);
    sessionStorage.setItem('pkce_state', state);

    const url = `${authEndpoint}?response_type=code`
      + `&client_id=${encodeURIComponent(clientId)}`
      + `&scope=${encodeURIComponent(scopes)}`
      + `&redirect_uri=${encodeURIComponent(redirectUri)}`
      + `&state=${encodeURIComponent(state)}`
      + `&code_challenge_method=S256`
      + `&code_challenge=${encodeURIComponent(codeChallenge)}`;

    window.location.href = url;
  } catch (e) {
    loginError.textContent = 'Fehler beim Login-Versuch';
    loginError.style.display = 'block';
  }
});

// After Spotify Redirect
async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  const state = params.get('state');

  if (error) {
    loginError.textContent = 'Spotify-Fehler: ' + error;
    loginError.style.display = 'block';
    return false;
  }
  if (!code) return false;

  if (state !== sessionStorage.getItem('pkce_state')) {
    loginError.textContent = 'Ungültiger State, Login abgebrochen.';
    loginError.style.display = 'block';
    return false;
  }
  sessionStorage.removeItem('pkce_state');

  const codeVerifier = sessionStorage.getItem('code_verifier');
  if (!codeVerifier) {
    loginError.textContent = 'Code-Verifier fehlt!';
    loginError.style.display = 'block';
    return false;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  try {
    const res = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded'},
      body: body.toString()
    });
    if (!res.ok) {
      const txt = await res.text();
      loginError.textContent = 'Token-Austausch fehlgeschlagen: ' + txt;
      loginError.style.display = 'block';
      return false;
    }
    const data = await res.json();
    sessionStorage.setItem('access_token', data.access_token);
    sessionStorage.setItem('token_expiry', (Date.now() + data.expires_in * 1000).toString());
    window.history.replaceState({}, document.title, redirectUri);
    onLoginSuccess(data.access_token);
    return true;
  } catch (e) {
    loginError.textContent = 'Login fehlgeschlagen.';
    loginError.style.display = 'block';
    console.error(e);
    return false;
  }
}

// Check Token
function isTokenValid() {
  const t = sessionStorage.getItem('access_token');
  const exp = sessionStorage.getItem('token_expiry');
  return t && exp && Date.now() < parseInt(exp);
}

// After successful login
function onLoginSuccess(token) {
  loginArea.style.display = 'none';
  gameModeSelection.style.display = 'block';
  messageEl.textContent = 'Erfolgreich eingeloggt – wähle Genre & Modus';
  setupSelection();
}

// Setup UI interactions
function setupSelection() {
  document.querySelectorAll('.genre-button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.genre-button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPlaylistId = btn.dataset.playlist;
      updateStartButton();
    });
  });
  document.querySelectorAll('.mode-button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-button').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedGameMode = btn.dataset.mode;
      updateStartButton();
    });
  });
  startGameButton.addEventListener('click', () => {
    startGame(selectedPlaylistId, selectedGameMode);
  });
}

function updateStartButton() {
  startGameButton.disabled = !(selectedPlaylistId && selectedGameMode);
}

// Placeholder for your game logic
function startGame(playlistId, mode) {
  messageEl.textContent = `Starte Spiel mit Playlist ${playlistId} und Modus ${mode}`;
  // Hier kommt deine bestehende Spielmechanik rein
}

// On load
window.addEventListener('load', async () => {
  if (await handleRedirect()) return;
  if (isTokenValid()) {
    onLoginSuccess(sessionStorage.getItem('access_token'));
  }
});
