// --- Spotify PKCE Authorization Code Flow Setup ---

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

// --- PKCE Helper Functions ---
function generateRandomString(length = 128) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(array) {
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// --- Login Button Click ---
loginButton.addEventListener('click', async () => {
  loginError.style.display = 'none';
  try {
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    sessionStorage.setItem('code_verifier', codeVerifier);

    const state = generateRandomString(16);
    sessionStorage.setItem('pkce_state', state);

    const url =
      `${authEndpoint}?response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${encodeURIComponent(state)}` +
      `&code_challenge_method=S256` +
      `&code_challenge=${encodeURIComponent(codeChallenge)}`;

    window.location.href = url;
  } catch (e) {
    loginError.textContent = 'Fehler beim Start des Logins.';
    loginError.style.display = 'block';
  }
});

// --- After Redirect: Handle Authorization Code and Request Token ---
async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');

  if (error) {
    loginError.textContent = `Spotify Login Fehler: ${error}`;
    loginError.style.display = 'block';
    return false;
  }

  if (!code) {
    return false; // Kein Code in URL
  }

  const storedState = sessionStorage.getItem('pkce_state');
  if (state !== storedState) {
    loginError.textContent = 'Ungültiger State - Login abgebrochen!';
    loginError.style.display = 'block';
    return false;
  }
  sessionStorage.removeItem('pkce_state');

  const codeVerifier = sessionStorage.getItem('code_verifier');
  if (!codeVerifier) {
    loginError.textContent = 'Code Verifier nicht gefunden!';
    loginError.style.display = 'block';
    return false;
  }

  // Request Access Token
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      loginError.textContent = 'Token-Anforderung fehlgeschlagen: ' + text;
      loginError.style.display = 'block';
      return false;
    }

    const data = await response.json();
    sessionStorage.setItem('access_token', data.access_token);
    sessionStorage.setItem('refresh_token', data.refresh_token);
    sessionStorage.setItem('token_expiry', (Date.now() + data.expires_in * 1000).toString());

    // URL bereinigen, Code und State entfernen
    window.history.replaceState({}, document.title, redirectUri);

    // Starte Spiel
    onLoginSuccess(data.access_token);

    return true;
  } catch (err) {
    loginError.textContent = 'Token-Anforderung fehlgeschlagen.';
    loginError.style.display = 'block';
    console.error(err);
    return false;
  }
}

// --- Check if token is valid ---
function isTokenValid() {
  const token = sessionStorage.getItem('access_token');
  const expiry = sessionStorage.getItem('token_expiry');
  if (!token || !expiry) return false;
  return Date.now() < parseInt(expiry);
}

// --- On successful login ---
function onLoginSuccess(accessToken) {
  loginArea.style.display = 'none';
  gameModeSelection.style.display = 'block';
  messageEl.textContent = 'Erfolgreich eingeloggt. Wähle Genre und Spielmodus.';
  setupGameSelection();
}

// --- Setup game mode and genre button logic ---
function setupGameSelection() {
  const genreButtons = document.querySelectorAll('.genre-button');
  const modeButtons = document.querySelectorAll('.mode-button');

  genreButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      genreButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedPlaylistId = btn.getAttribute('data-playlist');
      checkStartReady();
    });
  });

  modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modeButtons.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedGameMode = btn.getAttribute('data-mode');
      checkStartReady();
    });
  });

  startGameButton.addEventListener('click', () => {
    if (selectedPlaylistId && selectedGameMode) {
      startGame(selectedPlaylistId, selectedGameMode);
    }
  });
}

function checkStartReady() {
  if (selectedPlaylistId &&
