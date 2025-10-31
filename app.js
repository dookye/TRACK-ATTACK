const clientId = '53257f6a1c144d3f929a60d691a0c6f6';
const redirectUri = 'https://dookye.github.io/TRACK-ATTACK/';
const playlistId = '6Aq2xcWvFXBoExv64eGm5o';
let accessToken = '';
let selectedTrackUri = '';
let deviceId = '';
let player;

// PKCE Helper
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}
async function sha256(baseString) {
  const encoder = new TextEncoder();
  const data = encoder.encode(baseString);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Login Button
document.getElementById('loginButton').addEventListener('click', async () => {
  console.log('Login Button geklickt');
  const codeVerifier = generateRandomString(128);
  localStorage.setItem('code_verifier', codeVerifier);
  const codeChallenge = await sha256(codeVerifier);

  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=streaming%20user-read-email%20user-read-private%20user-modify-playback-state&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge_method=S256&code_challenge=${codeChallenge}`;
  window.location = authUrl;
});

// Token holen nach Redirect
async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return;

  const codeVerifier = localStorage.getItem('code_verifier');
  const body = new URLSearchParams();
  body.append('client_id', clientId);
  body.append('grant_type', 'authorization_code');
  body.append('code', code);
  body.append('redirect_uri', redirectUri);
  body.append('code_verifier', codeVerifier);

  console.log('Code erhalten, Token anfordern...');
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: body
  });
  const data = await resp.json();
  accessToken = data.access_token;
  console.log('Access Token erhalten:', accessToken ? 'JA' : 'NEIN');

  if (accessToken) {
    document.getElementById('loginDiv').style.display = 'none';
    document.getElementById('appDiv').style.display = 'block';
    document.getElementById('startPlayerButton').disabled = false;
  }
}
handleRedirect();

// SDK laden
const script = document.createElement('script');
script.src = "https://sdk.scdn.co/spotify-player.js";
document.body.appendChild(script);

// Player initialisieren nach User-Klick
document.getElementById('startPlayerButton').addEventListener('click', () => {
  if (!accessToken) {
    console.log('Kein Token vorhanden!');
    return;
  }
  console.log('Player Start Button geklickt, Player initialisieren...');
  player = new Spotify.Player({
    name: 'TRACK-ATTACK Player',
    getOAuthToken: cb => { cb(accessToken); },
    volume: 0.8
  });

  player.addListener('initialization_error', ({message}) => { console.error('Init Error:', message); });
  player.addListener('authentication_error', ({message}) => { console.error('Auth Error:', message); });
  player.addListener('account_error', ({message}) => { console.error('Account Error:', message); });
  player.addListener('playback_error', ({message}) => { console.error('Playback Error:', message); });

  player.addListener('ready', ({device_id}) => {
    deviceId = device_id;
    console.log('Player ready! Device ID:', deviceId);
    document.getElementById('selectButton').disabled = false;
  });

  player.connect().then(success => {
    console.log('Player connect result:', success);
  });
});

// Song auswählen
document.getElementById('selectButton').addEventListener('click', async () => {
  if (!deviceId) { console.log('Kein Device ID'); return; }
  console.log('Playlist laden...');
  const resp = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, { headers: { Authorization: 'Bearer ' + accessToken } });
  const data = await resp.json();
  const tracks = data.items.map(item => item.track);
  const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
  selectedTrackUri = randomTrack.uri;
  console.log('Song ausgewählt:', randomTrack.name);
  document.getElementById('songInfo').innerText = `Ausgewählt: ${randomTrack.name} - ${randomTrack.artists.map(a => a.name).join(', ')}`;
  document.getElementById('playButton').disabled = false;
});

// Song 10 Sekunden abspielen
document.getElementById('playButton').addEventListener('click', async () => {
  if (!selectedTrackUri || !deviceId) { console.log('Kein Song oder Device ID'); return; }

  console.log('Play Button geklickt, Song abspielen...');
  document.getElementById('playButton').disabled = true;
  document.getElementById('selectButton').disabled = true;

  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [selectedTrackUri] })
  });

  let remaining = 10;
  const countdownEl = document.getElementById('countdown');
  const progressEl = document.getElementById('progress');
  countdownEl.innerText = `Verbleibende Zeit: ${remaining}s`;
  progressEl.style.width = '0%';

  const interval = setInterval(() => {
    remaining--;
    countdownEl.innerText = `Verbleibende Zeit: ${remaining}s`;
    progressEl.style.width = `${(10 - remaining)/10*100}%`;
    if (remaining <= 0) {
      clearInterval(interval);
      fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, { method: 'PUT', headers: { Authorization: 'Bearer ' + accessToken } });
      console.log('Song pausiert nach 10 Sekunden');
      countdownEl.innerText = 'Abspielzeit beendet';
      progressEl.style.width = '100%';
      document.getElementById('playButton').disabled = false;
      document.getElementById('selectButton').disabled = false;
    }
  }, 1000);
});
