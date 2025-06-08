// TRACK ATTACK – app.js

const clientId = '53257f6a1c144d3f929a60d691a0c6f6 ';
const redirectUri = 'https://dookye.github.io/musik-raten/'; // Anpassen je nach Hosting
const scopes = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'streaming',
  'user-read-email',
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative'
];

let accessToken = '';
let player;

// Authorization Code Flow mit PKCE
async function generateCodeVerifier(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function redirectToSpotifyAuth(codeChallenge, codeVerifier) {
  localStorage.setItem('code_verifier', codeVerifier);
  const args = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes.join(' '),
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge
  });
  window.location = 'https://accounts.spotify.com/authorize?' + args;
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
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body
  });
  const data = await response.json();
  accessToken = data.access_token;
  localStorage.setItem('access_token', accessToken);
  document.getElementById('login-btn').style.display = 'none';
  document.getElementById('game-ui').style.display = 'block';
  setupPlayer();
}

function checkAuth() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  if (code) {
    fetchAccessToken(code);
  } else {
    const storedToken = localStorage.getItem('access_token');
    if (!storedToken) return;
    accessToken = storedToken;
    document.getElementById('login-btn').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    setupPlayer();
  }
}

async function setupPlayer() {
  window.onSpotifyWebPlaybackSDKReady = () => {
    player = new Spotify.Player({
      name: 'TRACK ATTACK PLAYER',
      getOAuthToken: cb => cb(accessToken),
      volume: 0.5
    });

    player.addListener('ready', ({ device_id }) => {
      console.log('Ready with Device ID', device_id);
      transferPlaybackHere(device_id);
    });

    player.addListener('initialization_error', ({ message }) => {
      console.error(message);
    });

    player.addListener('authentication_error', ({ message }) => {
      console.error(message);
    });

    player.addListener('account_error', ({ message }) => {
      console.error(message);
    });

    player.connect();
  };

  const script = document.createElement('script');
  script.src = 'https://sdk.scdn.co/spotify-player.js';
  document.body.appendChild(script);
}

function transferPlaybackHere(deviceId) {
  fetch('https://api.spotify.com/v1/me/player', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false
    })
  });
}

// Event Listener
window.addEventListener('load', checkAuth);

document.getElementById('login-btn').addEventListener('click', async () => {
  const codeVerifier = await generateCodeVerifier(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  redirectToSpotifyAuth(codeChallenge, codeVerifier);
});
