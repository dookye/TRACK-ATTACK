// Platzhalter für vollständigen PKCE Authorization Code Flow
// Zugangsdaten (ersetze ggf. durch deine eigene Client-ID)
const client_id = '53257f6a1c144d3f929a60d691a0c6f6';
const redirect_uri = 'https://dookye.github.io/musik-raten/';

// PKCE Helper-Funktionen
function generateCodeVerifier(length = 128) {
  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec => ('0' + (dec % 36).toString(36)).slice(-1)).join('');
}

async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Initial Login
async function redirectToSpotifyLogin() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  localStorage.setItem('code_verifier', codeVerifier);

  const scope = 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state';
  const args = new URLSearchParams({
    response_type: 'code',
    client_id,
    scope,
    redirect_uri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  });

  window.location = 'https://accounts.spotify.com/authorize?' + args;
}

// Wenn wir mit Code zurückkommen → Token holen
async function handleRedirectCallback() {
  const code = new URLSearchParams(window.location.search).get('code');
  if (!code) return;

  const codeVerifier = localStorage.getItem('code_verifier');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri,
    client_id,
    code_verifier: codeVerifier
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = await response.json();
  localStorage.setItem('access_token', data.access_token);
  window.history.replaceState({}, document.title, '/'); // Clean URL
  location.reload();
}

// Main
document.getElementById('login-button').addEventListener('click', redirectToSpotifyLogin);
handleRedirectCallback();
