// app.js
let accessToken = null;
let player = null;
let currentTrack = null;
let currentDeviceId = null;
let selectedPlaylistId = null;
let previewDuration = 30;
let currentTeam = 1;
let scores = { 1: 0, 2: 0 };
let replayCount = 0;

// Screens
const screens = {
  welcome: document.getElementById('welcome-screen'),
  mode: document.getElementById('mode-screen'),
  genre: document.getElementById('genre-screen'),
  game: document.getElementById('game-screen'),
  end: document.getElementById('end-screen')
};

// Buttons
const loginButton = document.getElementById('login-button');
const playButton = document.getElementById('play-button');
const replayButton = document.getElementById('replay-button');
const revealButton = document.getElementById('reveal-button');
const correctButton = document.getElementById('correct-button');
const wrongButton = document.getElementById('wrong-button');
const restartButton = document.getElementById('restart-button');

// Others
const score1 = document.getElementById('score1');
const score2 = document.getElementById('score2');
const finalScore1 = document.getElementById('final-score1');
const finalScore2 = document.getElementById('final-score2');
const songInfo = document.getElementById('song-info');
const gameMessage = document.getElementById('game-message');

// Step 1: Auth
loginButton.addEventListener('click', () => {
  const clientId = 'e8597a264caa4c7a93c36f917d1211d5';
  const redirectUri = window.location.origin + window.location.pathname;
  const codeVerifier = generateRandomString(64);

  generateCodeChallenge(codeVerifier).then(codeChallenge => {
    localStorage.setItem('verifier', codeVerifier);
    const args = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state',
      redirect_uri: redirectUri,
      code_challenge_method: 'S256',
      code_challenge: codeChallenge
    });

    window.location = `https://accounts.spotify.com/authorize?${args.toString()}`;
  });
});

async function handleRedirect() {
  const code = new URLSearchParams(window.location.search).get('code');
  if (!code) return;

  const codeVerifier = localStorage.getItem('verifier');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: window.location.origin + window.location.pathname,
    client_id: 'e8597a264caa4c7a93c36f917d1211d5',
    code_verifier: codeVerifier
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  const data = await response.json();
  accessToken = data.access_token;
  localStorage.setItem('access_token', accessToken);

  window.history.replaceState({}, document.title, '/');
  nextScreen('mode');
}

handleRedirect();

// Step 2: Spielmodus wählen
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    previewDuration = parseInt(btn.dataset.seconds);
    nextScreen('genre');
  });
});

// Step 3: Genre/Playlist wählen
document.querySelectorAll('.genre-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedPlaylistId = btn.dataset.playlist;
    nextScreen('game');
    connectToSpotify();
  });
});

// Spotify Web Playback SDK
window.onSpotifyWebPlaybackSDKReady = () => {
  player = new Spotify.Player({
    name: 'TRACK ATTACK Player',
    getOAuthToken: cb => cb(accessToken),
    volume: 0.8
  });

  player.addListener('ready', ({ device_id }) => {
    currentDeviceId = device_id;
    console.log('Ready with Device ID', device_id);
  });

  player.connect();
};

// Spielsteuerung
playButton.addEventListener('click', startTrack);
replayButton.addEventListener('click', () => {
  if (replayCount > 0) {
    playPreview(currentTrack.preview_url);
    replayCount--;
    replayButton.textContent = `NOCHMAL HÖREN (${replayCount})`;
    if (replayCount === 0) replayButton.disabled = true;
  }
});

revealButton.addEventListener('click', () => {
  if (currentTrack) {
    songInfo.classList.remove('hidden');
    songInfo.innerHTML = `${currentTrack.name} – ${currentTrack.artists.map(a => a.name).join(', ')}`;
    correctButton.disabled = false;
    wrongButton.disabled = false;
  }
});

correctButton.addEventListener('click', () => {
  scores[currentTeam]++;
  updateScores();
  nextTurn();
});

wrongButton.addEventListener('click', () => {
  nextTurn();
});

restartButton.addEventListener('click', () => {
  scores = { 1: 0, 2: 0 };
  currentTeam = 1;
  updateScores();
  songInfo.textContent = '';
  nextScreen('mode');
});

// Funktionen
function nextScreen(screen) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[screen].classList.add('active');
}

function updateScores() {
  score1.textContent = scores[1];
  score2.textContent = scores[2];
  finalScore1.textContent = scores[1];
  finalScore2.textContent = scores[2];
}

async function startTrack() {
  songInfo.classList.add('hidden');
  replayCount = 4;
  replayButton.disabled = false;
  replayButton.textContent = `NOCHMAL HÖREN (${replayCount})`;
  correctButton.disabled = true;
  wrongButton.disabled = true;
  revealButton.disabled = false;

  const track = await getRandomTrackFromPlaylist();
  currentTrack = track;
  playPreview(track.preview_url);
}

function playPreview(previewUrl) {
  const audio = new Audio(previewUrl);
  audio.play();
  setTimeout(() => {
    audio.pause();
  }, previewDuration * 1000);
}

function nextTurn() {
  currentTeam = currentTeam === 1 ? 2 : 1;
  gameMessage.textContent = `Team ${currentTeam} – TRACK ATTACK!`;
  songInfo.classList.add('hidden');
  replayButton.disabled = true;
  revealButton.disabled = true;
  correctButton.disabled = true;
  wrongButton.disabled = true;
  currentTrack = null;
}

// Helper: Playlist abrufen
async function getRandomTrackFromPlaylist() {
  const response = await fetch(`https://api.spotify.com/v1/playlists/${selectedPlaylistId}/tracks?limit=100`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const data = await response.json();
  const validTracks = data.items
    .map(item => item.track)
    .filter(track => track.preview_url);

  const randomIndex = Math.floor(Math.random() * validTracks.length);
  return validTracks[randomIndex];
}

// Helper: Code Challenge
function generateRandomString(length) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
