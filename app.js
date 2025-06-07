// app.js

const clientId = "3f4b3acc3bad4e0d98e77409ffc62e48";
const redirectUri = window.location.origin + window.location.pathname;
const scopes = ["user-read-private", "user-read-email", "streaming", "user-modify-playback-state"];

let accessToken = null;
let selectedGenre = null;
let selectedMode = null;
let currentPlayer = 1;
let scores = { 1: 0, 2: 0 };
let currentTrack = null;
let playCount = 0;
let songDuration = 30;
let currentSongIndex = 0;

const genrePlaylists = {
  punk: "39sVxPTg7BKwrf2MfgrtcD",
  pop: "6mtYuOxzl58vSGnEDtZ9uB",
  hits: "2si7ChS6Y0hPBt4FsobXpg"
};

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.getElementById(id).style.display = 'flex';
}

function getHashParams() {
  const hash = window.location.hash.substring(1);
  const params = {};
  hash.split('&').forEach(param => {
    const [key, value] = param.split('=');
    params[key] = decodeURIComponent(value);
  });
  return params;
}

function login() {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scopes.join(" "))}&response_type=token&show_dialog=true`;
  window.location = authUrl;
}

function chooseMode(mode) {
  selectedMode = mode;
  songDuration = mode === 'normal' ? 30000 : mode === 'pro' ? 10000 : 2000;
  showPage('genre-selection');
}

function chooseGenre(genre) {
  selectedGenre = genre;
  showPage('game-screen');
  updateScoreDisplay();
  startRound();
}

function updateScoreDisplay() {
  document.getElementById('scoreboard').innerHTML =
    `Spieler 1: ${scores[1]} Punkte<br>Spieler 2: ${scores[2]} Punkte<br>Am Zug: Spieler ${currentPlayer}`;
}

async function fetchPlaylistTracks(playlistId) {
  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json();
  return data.items.map(item => item.track);
}

let playlistTracks = [];

async function startRound() {
  playlistTracks = await fetchPlaylistTracks(genrePlaylists[selectedGenre]);
  playNextSong();
}

function playNextSong() {
  if (currentSongIndex >= 20) {
    showPage('end-screen');
    document.getElementById('final-scores').innerText = `Spiel beendet!\nSpieler 1: ${scores[1]} Punkte\nSpieler 2: ${scores[2]} Punkte`;
    return;
  }
  currentTrack = playlistTracks[Math.floor(Math.random() * playlistTracks.length)];
  const previewUrl = currentTrack.preview_url;
  if (!previewUrl) {
    return playNextSong();
  }
  playCount = 0;
  playClip(previewUrl);
  document.getElementById('play-button').style.display = 'none';
  document.getElementById('replay-button').style.display = 'inline-block';
  document.getElementById('replay-button').innerText = `Nochmal hören (4)`;
  document.getElementById('reveal-button').style.display = 'inline-block';
}

function playClip(url) {
  const audio = new Audio(url);
  audio.currentTime = Math.floor(Math.random() * 15);
  audio.play();
  setTimeout(() => {
    audio.pause();
  }, songDuration);
}

function replayClip() {
  if (playCount >= 4) return;
  playCount++;
  const remaining = 4 - playCount;
  document.getElementById('replay-button').innerText = `Nochmal hören (${remaining})`;
  playClip(currentTrack.preview_url);
}

function revealAnswer() {
  document.getElementById('song-info').innerText = `${currentTrack.artists[0].name} – ${currentTrack.name}`;
  document.getElementById('correct-button').style.display = 'inline-block';
  document.getElementById('wrong-button').style.display = 'inline-block';
}

function handleAnswer(correct) {
  if (correct) {
    const points = 5 - playCount;
    scores[currentPlayer] += points;
  }
  currentPlayer = currentPlayer === 1 ? 2 : 1;
  currentSongIndex++;
  updateScoreDisplay();
  resetUIForNextSong();
  playNextSong();
}

function resetUIForNextSong() {
  document.getElementById('song-info').innerText = '';
  document.getElementById('correct-button').style.display = 'none';
  document.getElementById('wrong-button').style.display = 'none';
}

function restartGame() {
  scores = { 1: 0, 2: 0 };
  currentPlayer = 1;
  currentSongIndex = 0;
  updateScoreDisplay();
  showPage('mode-selection');
}

// Startup
window.onload = () => {
  const params = getHashParams();
  accessToken = params.access_token;
  if (accessToken) {
    showPage('mode-selection');
  } else {
    showPage('login-screen');
  }

  document.getElementById('login-button').addEventListener('click', login);
  document.getElementById('mode-normal').addEventListener('click', () => chooseMode('normal'));
  document.getElementById('mode-pro').addEventListener('click', () => chooseMode('pro'));
  document.getElementById('mode-crack').addEventListener('click', () => chooseMode('crack'));

  document.getElementById('genre-punk').addEventListener('click', () => chooseGenre('punk'));
  document.getElementById('genre-pop').addEventListener('click', () => chooseGenre('pop'));
  document.getElementById('genre-hits').addEventListener('click', () => chooseGenre('hits'));

  document.getElementById('replay-button').addEventListener('click', replayClip);
  document.getElementById('reveal-button').addEventListener('click', revealAnswer);
  document.getElementById('correct-button').addEventListener('click', () => handleAnswer(true));
  document.getElementById('wrong-button').addEventListener('click', () => handleAnswer(false));
  document.getElementById('restart-button').addEventListener('click', restartGame);
};
