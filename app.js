// Einfacher Simulations-Code für Spotify Login und Spielablauf

// --- Globale Variablen ---
let isLoggedIn = false;
let selectedModeDuration = 30;
let activePlayer = 1;
let score = {1: 0, 2: 0};
let maxSongsPerPlayer = 10;
let songsLeft = maxSongsPerPlayer;
let maxRetries = 4;
let retriesLeft = maxRetries;
let currentPlaylist = '39sVxPTg7BKwrf2MfgrtcD';
let currentSong = null;
let currentStartTime = 0;

// Seiten IDs
const pages = ['welcome-screen', 'mode-selection', 'game-screen', 'end-screen'];

function showPage(pageId) {
  pages.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = (id === pageId) ? 'flex' : 'none';
  });
}

function updateScoreboard() {
  document.getElementById('score-player1').textContent = score[1];
  document.getElementById('score-player2').textContent = score[2];
  document.getElementById('active-player').textContent = activePlayer;
  document.getElementById('songs-left').textContent = songsLeft;
}

function simulateSpotifyLogin() {
  // Hier würdest du den echten Spotify Login integrieren
  // Für Demo einfach Login "erfolgreich"
  isLoggedIn = true;
  alert('Spotify Login erfolgreich!');
  showPage('mode-selection');
}

function resetGame() {
  score = {1: 0, 2: 0};
  activePlayer = 1;
  songsLeft = maxSongsPerPlayer;
  retriesLeft = maxRetries;
  currentSong = null;
  currentStartTime = 0;
  updateScoreboard();
  document.getElementById('song-info').textContent = '';
  document.getElementById('answer-buttons').classList.add('hidden');
  document.getElementById('start-btn').textContent = 'TRACK ATTACK START';
  document.getElementById('start-btn').disabled = false;
}

function pickRandomSong() {
  // Hier würdest du mit Spotify API echte Songs aus der Playlist holen
  // Für Demo: Fake Song-Objekt
  return {
    artist: 'Demo Artist',
    title: 'Demo Song',
    duration_ms: 180000, // 3 min
    spotify_url: 'https://open.spotify.com/track/xyz',
  };
}

function startPlayingSong() {
  if (!currentSong) {
    currentSong = pickRandomSong();
  }
  retriesLeft = maxRetries;

  // Zufälliger Start (im echten Code mit duration)
  currentStartTime = Math.floor(Math.random() * (currentSong.duration_ms - selectedModeDuration * 1000));

  document.getElementById('song-info').textContent = `Spiele Song für ${selectedModeDuration} Sekunden an zufälliger Stelle...`;
  document.getElementById('answer-buttons').classList.add('hidden');
  updateStartButton();
}

function updateStartButton() {
  if (retriesLeft === maxRetries) {
    document.getElementById('start-btn').textContent = 'TRACK ATTACK START';
  } else if (retriesLeft > 0) {
    document.getElementById('start-btn').textContent = `NOCHMAL HÖREN (${retriesLeft}x)`;
  } else {
    document.getElementById('start-btn').textContent = 'AUFLÖSEN';
  }
}

function onStartButtonClick() {
  if (retriesLeft === 0) {
    // Auflösen - Interpret und Titel zeigen
    document.getElementById('song-info').textContent = `Interpret: ${currentSong.artist} | Titel: ${currentSong.title}`;
    document.getElementById('answer-buttons').classList.remove('hidden');
    document.getElementById('start-btn').disabled = true;
  } else {
    // Song abspielen oder nochmal hören
    if (retriesLeft === maxRetries) {
      // Erstes Abspielen = volle Punkte möglich
    } else {
      // Pro nochmal hören 1 Punkt abziehen
      score[activePlayer] = Math.max(0, score[activePlayer] - 1);
      updateScoreboard();
    }
    retriesLeft--;
    startPlayingSong();
  }
}

function onCorrectClick() {
  // Punkte je nach verbleibenden retries (max 5, minus abgespielte nochmal-hören)
  const pointsEarned = 5 - (maxRetries - retriesLeft - 1);
  score[activePlayer] += pointsEarned;
  nextTurn();
}

function onWrongClick() {
  // Keine Punkte
  nextTurn();
}

function nextTurn() {
  // Reset für nächsten Song
  retriesLeft = maxRetries;
  currentSong = null;
  currentStartTime = 0;

  songsLeft--;
  if (songsLeft === 0) {
    // Spielende
    showFinalScore();
    return;
  }
  // Spieler wechseln
  activePlayer = activePlayer === 1 ? 2 : 1;

  updateScoreboard();
  document.getElementById('song-info').textContent = '';
  document.getElementById('answer-buttons').classList.add('hidden');
  document.getElementById('start-btn').textContent = 'TRACK ATTACK START';
  document.getElementById('start-btn').disabled = false;
}

function showFinalScore() {
  showPage('end-screen');
  const finalScore = `Spieler 1: ${score[1]} Punkte<br>Spieler 2: ${score[2]} Punkte`;
  document.getElementById('final-score').innerHTML = finalScore;
}

// --- Event-Handler ---

window.addEventListener('DOMContentLoaded', () => {
  showPage('welcome-screen');

  document.getElementById('login-btn').addEventListener('click', () => {
    simulateSpotifyLogin();
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      selectedModeDuration = Number(e.target.dataset.duration);
      showPage('game-screen');
      resetGame();
    });
  });

  document.querySelectorAll('.genre-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      currentPlaylist = e.target.dataset.playlist;
      alert(`Genre gewählt! Playlist-ID: ${currentPlaylist}`);
      // Optional: In echtem Code hier Playlist mit Spotify API laden
    });
  });

  document.getElementById('start-btn').addEventListener('click', () => {
    onStartButtonClick();
  });

  document.getElementById('btn-correct').addEventListener('click', () => {
    onCorrectClick();
  });

  document.getElementById('btn-wrong').addEventListener('click', () => {
    onWrongClick();
  });

  document.getElementById('play-again-btn').addEventListener('click', () => {
    showPage('mode-selection');
  });
});
