const clientId = '3f4b3acc3bad4e0d98e77409ffc62e48'; 
const redirectUri = 'https://dookye.github.io/musik-raten/callback.html'; // Deine Callback URL
const scopes = 'streaming user-read-email user-read-private'; // ggf. anpassen

// Playlists nach Genre mit IDs (nur Beispiel-Playlist-IDs, kannst du ersetzen)
const playlists = {
  "Die größten Hits aller Zeiten": "2si7ChS6Y0hPBt4FsobXpg",
  "Pop hits 2000-2025": "6mtYuOxzl58vSGnEDtZ9uB",
  "Punkrock 90 & 00": "39sVxPTg7BKwrf2MfgrtcD"
};

// Globale Variablen
let accessToken = null;
let selectedGenre = null;
let selectedMode = null;
let currentSongs = [];
let currentSongIndex = 0;
let currentListenCount = 0;
let maxListenCount = 5;
let points = 0;

// Hilfsfunktion: URL-Hash parsen (für Token)
function getTokenFromUrl() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

// Spotify Login URL bauen
function getLoginUrl() {
  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scopes);
  url.searchParams.set('show_dialog', 'true');
  return url.toString();
}

// HTML-Elemente erzeugen/ersetzen
function showLogin() {
  document.getElementById('app').innerHTML = `
    <h1>Willkommen zum Musikraten!</h1>
    <button id="loginBtn">Mit Spotify einloggen</button>
  `;
  document.getElementById('loginBtn').onclick = () => {
    window.location.href = getLoginUrl();
  };
}

function showGenreSelection() {
  let options = Object.keys(playlists).map(genre => `<option value="${genre}">${genre}</option>`).join('');
  document.getElementById('app').innerHTML = `
    <h2>Wähle dein Genre</h2>
    <select id="genreSelect">${options}</select>
    <button id="nextBtn">Weiter</button>
  `;
  document.getElementById('nextBtn').onclick = () => {
    selectedGenre = document.getElementById('genreSelect').value;
    showModeSelection();
  };
}

function showModeSelection() {
  document.getElementById('app').innerHTML = `
    <h2>Wähle den Spielmodus</h2>
    <select id="modeSelect">
      <option value="normal">Normal (30 Sek.)</option>
      <option value="hard">Hart (10 Sek.)</option>
      <option value="crack">Crack (3 Sek.)</option>
    </select>
    <button id="startBtn">Spiel starten</button>
  `;
  document.getElementById('startBtn').onclick = () => {
    selectedMode = document.getElementById('modeSelect').value;
    maxListenCount = 5;
    points = 0;
    currentSongIndex = 0;
    startGame();
  };
}

async function startGame() {
  document.getElementById('app').innerHTML = `<h2>Lade Songs...</h2>`;
  currentSongs = await loadSongsFromPlaylist(playlists[selectedGenre]);
  if (currentSongs.length === 0) {
    alert('Keine Songs gefunden! Versuche ein anderes Genre.');
    showGenreSelection();
    return;
  }
  currentSongIndex = 0;
  points = 0;
  showGameScreen();
  playCurrentSong();
}

async function loadSongsFromPlaylist(playlistId) {
  // Spotify Web API: Playlists abrufen (nur 50 Tracks max)
  // Hinweis: Für einfache Demo ohne OAuth-Token-Refresh, wir machen nur einen Call
  try {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) throw new Error('Spotify API Fehler');
    const data = await response.json();
    // Array aus Songs (track Objekte)
    return data.items
      .filter(item => item.track && item.track.preview_url) // nur Songs mit Preview
      .map(item => ({
        artist: item.track.artists.map(a => a.name).join(', '),
        title: item.track.name,
        preview_url: item.track.preview_url,
        duration_ms: item.track.duration_ms
      }));
  } catch (e) {
    alert('Fehler beim Laden der Playlist: ' + e.message);
    return [];
  }
}

let audio = null;

function showGameScreen() {
  currentListenCount = 0;
  document.getElementById('app').innerHTML = `
    <h2>Genre: ${selectedGenre} | Modus: ${selectedMode.toUpperCase()}</h2>
    <div id="songInfo">Song ${currentSongIndex + 1} von ${currentSongs.length}</div>
    <button id="playBtn">Song abspielen</button>
    <button id="listenAgainBtn" disabled>Noch einmal hören (-1 Punkt)</button>
    <button id="revealBtn">Auflösen</button>
    <div id="answerButtons" style="margin-top:20px; display:none;">
      <button id="correctBtn" style="background-color:green; color:white;">Richtig</button>
      <button id="wrongBtn" style="background-color:red; color:white;">Falsch</button>
    </div>
    <div id="score">Punkte: ${points}</div>
    <button id="nextSongBtn" disabled>Nächster Song</button>
    <button id="endGameBtn">Spiel beenden</button>
  `;

  document.getElementById('playBtn').onclick = () => playCurrentSong();
  document.getElementById('listenAgainBtn').onclick = () => listenAgain();
  document.getElementById('revealBtn').onclick = () => revealAnswer();
  document.getElementById('correctBtn').onclick = () => answer(true);
  document.getElementById('wrongBtn').onclick = () => answer(false);
  document.getElementById('nextSongBtn').onclick = () => nextSong();
  document.getElementById('endGameBtn').onclick = () => {
    if(confirm('Spiel wirklich beenden?')) location.reload();
  };
}

function getPlayLength() {
  switch (selectedMode) {
    case 'normal': return 30;
    case 'hard': return 10;
    case 'crack': return 3;
    default: return 10;
  }
}

function playCurrentSong() {
  if (audio) {
    audio.pause();
    audio = null;
  }
  const song = currentSongs[currentSongIndex];
  currentListenCount++;
  if (currentListenCount > maxListenCount) currentListenCount = maxListenCount;
  
  // Berechnung: Bei erneutem Hören -1 Punkt Abzug (max 5x hören)
  // Punkte für direktes Erraten 5, danach jeweils 1 Punkt weniger
  
  // Song an zufälliger Stelle starten (außer beim ersten Hören)
  let startPos = 0;
  if(currentListenCount > 1){
    // zufällig irgendwo im Track, so dass noch genügend Zeit für playLength bleibt
    const playLengthSec = getPlayLength();
    const maxStart = (song.duration_ms / 1000) - playLengthSec;
    startPos = Math.floor(Math.random() * Math.max(0, maxStart)) * 1000; // in ms
  }

  audio = new Audio(song.preview_url);
  audio.currentTime = startPos / 1000;
  audio.play();

  // Stoppen nach gewählter Spielmodus-Länge (Sekunden)
  const playLength = getPlayLength();
  setTimeout(() => {
    if(audio) audio.pause();
    document.getElementById('listenAgainBtn').disabled = currentListenCount >= maxListenCount;
  }, playLength * 1000);

  // Nach dem ersten Abspielen aktivieren wir "Noch einmal hören"
  if (currentListenCount > 0) {
    document.getElementById('listenAgainBtn').disabled = currentListenCount >= maxListenCount;
  }

  // Buttons für Auflösung und Antwort verstecken, bis Auflösung gedrückt wird
  document.getElementById('answerButtons').style.display = 'none';
  document.getElementById('nextSongBtn').
