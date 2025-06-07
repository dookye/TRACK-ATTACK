// TRACK ATTACK app.js

// --- Spotify Credentials & Config ---
const CLIENT_ID = "53257f6a1c144d3f929a60d691a0c6f6";
const REDIRECT_URI = "https://dookye.github.io/musik-raten/";
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "playlist-read-private"
];
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";

// --- State ---
let accessToken = null;
let player = null;
let deviceId = null;

let selectedMode = null; // Spielmodus (Sekunden)
let selectedPlaylistId = null;
let nochmalHörenLeft = 4;
let currentRound = 0;
const roundsPerTeam = 10;
let currentTeam = 0;
let scores = [0, 0];

let tracksCache = {};

let currentTrack = null;

// --- DOM Elemente ---
let loginScreen, btnLogin, modeScreen, modeButtons, gameScreen,
  genreButtons, gamePhaseText,
  playbackControls, btnTrackAttack, btnNochmalHoeren, btnAufloesen,
  answerControls, btnRichtig, btnFalsch,
  songInfo, artistNameElem, trackNameElem,
  team1ScoreElem, team2ScoreElem,
  endScreen, finalScoreElem, btnNochmalSpielen;

// --- Spotify Web Playback SDK READY Funktion (global!) ---
window.onSpotifyWebPlaybackSDKReady = () => {
  if (!accessToken) return;

  player = new Spotify.Player({
    name: 'TRACK ATTACK Player',
    getOAuthToken: cb => { cb(accessToken); },
    volume: 0.5
  });

  player.addListener('ready', ({ device_id }) => {
    deviceId = device_id;
    console.log('Spotify Player ready with Device ID', device_id);
  });

  player.addListener('not_ready', ({ device_id }) => {
    console.log('Spotify Player device went offline', device_id);
  });

  player.addListener('initialization_error', ({ message }) => { console.error(message); });
  player.addListener('authentication_error', ({ message }) => { console.error(message); alert("Authentifizierungsfehler! Bitte neu einloggen."); });
  player.addListener('account_error', ({ message }) => { console.error(message); alert("Account Problem: " + message); });
  player.addListener('playback_error', ({ message }) => { console.error(message); });

  player.connect();
};

// --- Nach DOM laden ---
document.addEventListener("DOMContentLoaded", () => {
  // DOM Referenzen
  loginScreen = document.getElementById("login-screen");
  btnLogin = document.getElementById("btn-login");
  modeScreen = document.getElementById("mode-screen");
  modeButtons = modeScreen.querySelectorAll("#mode-buttons button");
  gameScreen = document.getElementById("game-screen");
  genreButtons = document.querySelectorAll("#genre-buttons button");
  gamePhaseText = document.getElementById("game-phase-text");

  playbackControls = document.getElementById("playback-controls");
  btnTrackAttack = document.getElementById("btn-track-attack");
  btnNochmalHoeren = document.getElementById("btn-nochmal-hoeren");
  btnAufloesen = document.getElementById("btn-aufloesen");

  answerControls = document.getElementById("answer-controls");
  btnRichtig = document.getElementById("btn-richtig");
  btnFalsch = document.getElementById("btn-falsch");

  songInfo = document.getElementById("song-info");
  artistNameElem = document.getElementById("artist-name");
  trackNameElem = document.getElementById("track-name");

  team1ScoreElem = document.getElementById("team1-score");
  team2ScoreElem = document.getElementById("team2-score");

  endScreen = document.getElementById("end-screen");
  finalScoreElem = document.getElementById("final-score");
  btnNochmalSpielen = document.getElementById("btn-nochmal-spielen");

  // Event Listener
  btnLogin.addEventListener("click", spotifyLogin);

  modeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      selectedMode = parseInt(btn.dataset.mode);
      showScreen(gameScreen);
      showGenreSelection();
    });
  });

  genreButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const pls = JSON.parse(btn.dataset.playlists);
      startGame(pls[0]);
    });
  });

  btnTrackAttack.addEventListener("click", playNewTrack);
  btnNochmalHoeren.addEventListener("click", playCurrentTrackAgain);
  btnAufloesen.addEventListener("click", showTrackInfo);
  btnRichtig.addEventListener("click", () => answer(true));
  btnFalsch.addEventListener("click", () => answer(false));
  btnNochmalSpielen.addEventListener("click", resetGame);

  // Token aus URL prüfen
  checkForTokenInUrl();
});

// --- Funktionen ---

function showScreen(screen) {
  document.querySelectorAll("section.screen").forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

function spotifyLogin() {
  const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent("streaming user-read-email user-read-private playlist-read-private")}&response_type=token&show_dialog=true`;
  window.location.href = authUrl;
}

function checkForTokenInUrl() {
  const hash = window.location.hash;
  if (hash) {
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("access_token");
    if (token) {
      accessToken = token;
      sessionStorage.setItem("spotify_access_token", accessToken);
      window.history.replaceState({}, document.title, REDIRECT_URI);
      afterLogin();
    }
  } else {
    const saved = sessionStorage.getItem("spotify_access_token");
    if (saved) {
      accessToken = saved;
      afterLogin();
    } else {
      showScreen(loginScreen);
    }
  }
}

function afterLogin() {
  showScreen(modeScreen);
  setupSpotifyPlayer();
}

function setupSpotifyPlayer() {
  // Die SDK lädt sich selbst und ruft dann window.onSpotifyWebPlaybackSDKReady
  // Hier kein weiterer Code nötig
  // Aber Zugriff auf Token wird in window.onSpotifyWebPlaybackSDKReady benötigt
}

function showGenreSelection() {
  gamePhaseText.textContent = "Wähle dein Genre";
  document.getElementById("genre-buttons").classList.remove("hidden");
  playbackControls.classList.add("hidden");
  answerControls.classList.add("hidden");
  songInfo.classList.add("hidden");
  endScreen.classList.add("hidden");
  updateScores();
}

async function startGame(playlistId) {
  currentRound = 0;
  currentTeam = 0;
  scores = [0, 0];
  nochmalHörenLeft = 4;

  gamePhaseText.textContent = `Spiel läuft: ${playlistId}`;

  document.getElementById("genre-buttons").classList.add("hidden");
  playbackControls.classList.remove("hidden");
  answerControls.classList.add("hidden");
  songInfo.classList.add("hidden");
  endScreen.classList.add("hidden");

  if (!tracksCache[playlistId]) {
    tracksCache[playlistId] = await fetchPlaylistTracks(playlistId);
  }

  selectedPlaylistId = playlistId;

  updateScores();

  btnNochmalHoeren.disabled = true;
  btnAufloesen.disabled = true;
  btnRichtig.disabled = true;
  btnFalsch.disabled = true;

  btnNochmalHoeren.textContent = `NOCHMAL HÖREN (${nochmalHörenLeft})`;
  btnTrackAttack.disabled = false;
}

async function fetchPlaylistTracks(playlistId) {
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    alert("Fehler beim Laden der Playlist: " + res.statusText);
    return [];
  }
  const data = await res.json();
  return data.items
    .map(i => i.track)
    .filter(t => t && t.uri && !t.is_local);
}

function updateScores() {
  team1ScoreElem.textContent = `Team 1: ${scores[0]}`;
  team2ScoreElem.textContent = `Team 2: ${scores[1]}`;
}

async function playNewTrack() {
  if (!deviceId) {
    alert("Spotify Player noch nicht bereit. Bitte warten.");
    return;
  }
  if (!selectedPlaylistId) return;

  const tracks = tracksCache[selectedPlaylistId];
  if (!tracks || tracks.length === 0) {
    alert("Keine Songs in der Playlist.");
    return;
  }

  // Zufälliger Song aus Playlist
  const track = tracks[Math.floor(Math.random() * tracks.length)];
  currentTrack = track;

  // Zufällige Startposition (max 60 Sekunden)
  const startPosMs = Math.floor(Math.random() * 60000);

  nochmalHörenLeft = 4;
  btnNochmalHoeren.disabled = false;
  btnAufloesen.disabled = false;
  btnTrackAttack.disabled = true;

  btnNochmalHoeren.textContent = `NOCHMAL HÖREN (${nochmalHörenLeft})`;

  try {
    await playSpotifyTrack(track.uri, startPosMs);
    gamePhaseText.textContent = `Song läuft... (Team ${currentTeam + 1})`;
  } catch (e) {
    alert("Fehler beim Abspielen: " + e.message);
  }
}

async function playCurrentTrackAgain() {
  if (!deviceId || !currentTrack) return;

  if (nochmalHörenLeft <= 0) {
    btnNochmalHoeren.disabled = true;
    return;
  }

  nochmalHörenLeft--;
  btnNochmalHoeren.textContent = `NOCHMAL HÖREN (${nochmalHörenLeft})`;

  if (nochmalHörenLeft === 0) {
    btnNochmalHoeren.disabled = true;
  }

  try {
    await playSpotifyTrack(currentTrack.uri, 0);
  } catch (e) {
    alert("Fehler beim Abspielen: " + e.message);
  }
}

async function playSpotifyTrack(uri, positionMs) {
  const url = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
  const body = {
    uris: [uri],
    position_ms: positionMs
  };

  const res = await fetch(url, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error("Fehler beim Starten des Songs: " + res.statusText);
  }
}

function showTrackInfo() {
  if (!currentTrack) return;

  artistNameElem.textContent = currentTrack.artists.map(a => a.name).join(", ");
  trackNameElem.textContent = currentTrack.name;
  songInfo.classList.remove("hidden");

  answerControls.classList.remove("hidden");
  btnAufloesen.disabled = true;
  btnNochmalHoeren.disabled = true;
  btnTrackAttack.disabled = true;
  gamePhaseText.textContent = "Rate: Richtig oder Falsch?";
}

function answer(isCorrect) {
  if (isCorrect) {
    const points = 1 + nochmalHörenLeft; // Je weniger NOCHMAL HÖREN benutzt, desto mehr Punkte
    scores[currentTeam] += points;
    alert(`Richtig! +${points} Punkte für Team ${currentTeam + 1}`);
  } else {
    alert("Falsch!");
  }

  currentRound++;
  currentTeam = (currentTeam + 1) % 2;

  updateScores();

  if (currentRound >= roundsPerTeam) {
    endGame();
  } else {
    resetForNextRound();
  }
}

function resetForNextRound() {
  songInfo.classList.add("hidden");
  answerControls.classList.add("hidden");

  btnTrackAttack.disabled = false;
  btnAufloesen.disabled = true;
  btnNochmalHoeren.disabled = true;
  nochmalHörenLeft = 4;
  btnNochmalHoeren.textContent = `NOCHMAL HÖREN (${nochmalHörenLeft})`;

  gamePhaseText.textContent = `Nächster Zug: Team ${currentTeam + 1}`;
}

function endGame() {
  gameScreen.classList.remove("active");
  endScreen.classList.add("active");
  finalScoreElem.textContent = `Team 1: ${scores[0]} Punkte, Team 2: ${scores[1]} Punkte`;

  gamePhaseText.textContent = "Spiel beendet!";
}

function resetGame() {
  scores = [0, 0];
  currentRound = 0;
  currentTeam = 0;
  nochmalHörenLeft = 4;
  currentTrack = null;
  selectedPlaylistId = null;
  showScreen(modeScreen);
}
