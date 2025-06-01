// WICHTIG: Spotify-Zugangsdaten (ersetze ggf. durch Umgebungsvariablen oder sichere Methode)
const clientId = '3f4b3acc3bad4e0d98e77409ffc62e48';
const redirectUri = 'https://dookye.github.io/musik-raten/callback.html'; // Domain deiner GitHub Page

let accessToken = '';
let selectedGenre = '';
let selectedMode = '';
let currentPlaylist = '';
let currentTrack = null;
let playbackStartTime = 0;
let replayCount = 0;
let points = 0;
let round = 0;
const maxRounds = 20;

const genrePlaylists = {
  'hits': '2si7ChS6Y0hPBt4FsobXpg',
  'pop': '6mtYuOxzl58vSGnEDtZ9uB',
  'punk': '39sVxPTg7BKwrf2MfgrtcD'
};

const modeDurations = {
  'normal': 30,
  'hard': 10,
  'crack': 3
};

function getHashParams() {
  const hash = window.location.hash.substring(1);
  const params = {};
  const regex = /([^&;=]+)=?([^&;]*)/g;
  let match;
  while ((match = regex.exec(hash))) {
    params[match[1]] = decodeURIComponent(match[2]);
  }
  return params;
}

function authorizeSpotify() {
  const scope = 'streaming user-read-email user-read-private';
  const url = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
  window.location = url;
}

function handleLogin() {
  const params = getHashParams();
  if (params.access_token) {
    accessToken = params.access_token;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('genre-selection').classList.remove('hidden');
  } else {
    authorizeSpotify();
  }
}

function selectGenre(genre) {
  selectedGenre = genre;
  currentPlaylist = genrePlaylists[genre];
  document.getElementById('genre-selection').classList.add('hidden');
  document.getElementById('mode-selection').classList.remove('hidden');
}

function selectMode(mode) {
  selectedMode = mode;
  document.getElementById('mode-selection').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  startNewRound();
}

async function startNewRound() {
  replayCount = 0;
  round++;
  document.getElementById('round-counter').textContent = `Runde ${round} / ${maxRounds}`;

  if (round > maxRounds) {
    endGame();
    return;
  }

  const track = await getRandomTrackFromPlaylist(currentPlaylist);
  currentTrack = track;
  playPreview(track);
}

async function getRandomTrackFromPlaylist(playlistId) {
  const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, {
    headers: {
      Authorization: 'Bearer ' + accessToken
    }
  });
  const data = await response.json();
  const tracks = data.items.filter(item => item.track && item.track.preview_url);
  return tracks[Math.floor(Math.random() * tracks.length)].track;
}

function playPreview(track) {
  const audio = new Audio(track.preview_url);
  const duration = modeDurations[selectedMode];
  playbackStartTime = Math.floor(Math.random() * (30 - duration));
  audio.currentTime = playbackStartTime;
  audio.play();

  setTimeout(() => {
    audio.pause();
  }, duration * 1000);

  document.getElementById('replay-button').disabled = false;
  document.getElementById('reveal-button').disabled = false;
}

function replayTrack() {
  if (replayCount >= 5) return;
  replayCount++;
  playPreview(currentTrack);
}

function revealAnswer() {
  document.getElementById('answer').textContent = `${currentTrack.name} – ${currentTrack.artists[0].name}`;
  document.getElementById('answer-buttons').classList.remove('hidden');
  document.getElementById('replay-button').disabled = true;
  document.getElementById('reveal-button').disabled = true;
}

function markAnswer(correct) {
  const score = correct ? Math.max(0, 5 - replayCount) : 0;
  points += score;
  document.getElementById('points').textContent = `Punkte: ${points}`;
  document.getElementById('answer-buttons').classList.add('hidden');
  document.getElementById('answer').textContent = '';
  setTimeout(startNewRound, 1000);
}

function endGame() {
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('final-screen').classList.remove('hidden');
  document.getElementById('final-score').textContent = `Du hast ${points} Punkte erreicht!`;
}

function restartGame() {
  selectedGenre = '';
  selectedMode = '';
  currentPlaylist = '';
  currentTrack = null;
  playbackStartTime = 0;
  replayCount = 0;
  points = 0;
  round = 0;

  document.getElementById('final-screen').classList.add('hidden');
  document.getElementById('genre-selection').classList.remove('hidden');
  document.getElementById('points').textContent = 'Punkte: 0';
}

document.addEventListener('DOMContentLoaded', handleLogin);
