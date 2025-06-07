// --- PKCE Helferfunktionen ---
function generateCodeVerifier(length = 128) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let codeVerifier = '';
  for (let i = 0; i < length; i++) {
    codeVerifier += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return codeVerifier;
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

// --- Konfiguration ---
const clientId = '53257f6a1c144d3f929a60d691a0c6f6';
const redirectUri = 'https://dookye.github.io/musik-raten/';
const scopes = 'user-read-private user-read-email streaming user-modify-playback-state';
const authEndpoint = 'https://accounts.spotify.com/authorize';
const tokenEndpoint = 'https://accounts.spotify.com/api/token';

// --- Login Button ---
const loginButton = document.getElementById('login-button');

loginButton.addEventListener('click', async () => {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Speichere den codeVerifier im sessionStorage (für den Token-Request später)
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

  window.location = url;
});

// --- Hilfsfunktion für State ---
function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// --- Nach Redirect: Code aus URL holen und Token anfordern ---
async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const storedState = sessionStorage.getItem('pkce_state');
  if (!code) return false; // Kein Code in URL, nichts zu tun
  if (state !== storedState) {
    alert('Ungültiger State-Wert, Login abgebrochen!');
    return false;
  }

  sessionStorage.removeItem('pkce_state');

  const codeVerifier = sessionStorage.getItem('code_verifier');
  if (!codeVerifier) {
    alert('Code Verifier nicht gefunden!');
    return false;
  }

  // Token anfordern
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
      body: body.toString()
    });

    if (!response.ok) {
      alert('Fehler beim Token-Austausch');
      console.error(await response.text());
      return false;
    }

    const data = await response.json();
    // Access Token speichern (lokal/session)
    sessionStorage.setItem('access_token', data.access_token);
    sessionStorage.setItem('refresh_token', data.refresh_token);
    sessionStorage.setItem('token_expiry', (Date.now() + data.expires_in * 1000).toString());

    // URL bereinigen, Code & State entfernen
    window.history.replaceState({}, document.title, redirectUri);

    // Hier kannst du jetzt deine App starten
    onLoginSuccess(data.access_token);

    return true;

  } catch (error) {
    console.error('Token request failed:', error);
    alert('Token-Anforderung fehlgeschlagen');
    return false;
  }
}

// --- Beispiel-Funktion, wenn Login erfolgreich ---
function onLoginSuccess(accessToken) {
  console.log('Spotify Access Token erhalten:', accessToken);
  // TODO: Deine bestehende Logik starten, z.B. UI updaten
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('game-mode-screen').style.display = 'block';
  // Weitere Initialisierung...
}

// --- Prüfen ob wir gerade von Spotify mit Code zurückgekommen sind ---
window.addEventListener('load', async () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has('code')) {
    await handleRedirect();
  } else {
    // Prüfe ob Token schon vorhanden und gültig
    const token = sessionStorage.getItem('access_token');
    const expiry = sessionStorage.getItem('token_expiry');
    if (token && expiry && Date.now() < parseInt(expiry)) {
      onLoginSuccess(token);
    } else {
      // Zeige Login-Screen
      document.getElementById('login-screen').style.display = 'block';
      document.getElementById('game-mode-screen').style.display = 'none';
    }
  }
});
