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
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

// --- State Variables ---
let accessToken = null;
let refreshToken = null;
let player = null;
let deviceId = null;
let expiresAt = 0;

let playlists = {
  "39sVxPTg7BKwrf2MfgrtcD": null, // Punk Rock (90's & 00')
  "6mtYuOxzl58vSGnEDtZ9uB": null, // Pop Hits 2000-2025
  "2si7ChS6Y0hPBt4FsobXpg": null,  // Die größten Hits aller Zeiten
};

let selectedMode = null; // seconds (30, 10, 2)
let currentTeam = 0;
let scores = [0, 0];
let currentTrack = null;
let nochmalHörenLeft = 4;
let roundsPerTeam = 10;
let currentRound = 0;
let tracksCache = {}; // playlistId => array of tracks

// --- UI Elements ---
let loginScreen, btnLogin, modeScreen, modeButtons, gameScreen,
    team1ScoreElem, team2ScoreElem,
    genreButtons, gamePhaseText,
    playbackControls, btnTrackAttack, btnNochmalHoeren, btnAufloesen,
    answerControls, btnRichtig, btnFalsch,
    songInfo, artistNameElem, trackNameElem,
    endScreen, finalScoreElem, btnNochmalSpielen;

document.addEventListener("DOMContentLoaded", () => {
  // jetzt DOM-Elemente referenzieren
  loginScreen = document.getElementById("login-screen");
  btnLogin = document.getElementById("btn-login");
  modeScreen = document.getElementById("mode-screen");
  modeButtons = modeScreen.querySelectorAll("#mode-buttons button");
  gameScreen = document.getElementById("game-screen");
  team1ScoreElem = document.getElementById("team1-score");
  team2ScoreElem = document.getElementById("team2-score");
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

  endScreen = document.getElementById("end-screen");
  finalScoreElem = document.getElementById("final-score");
  btnNochmalSpielen = document.getElementById("btn-nochmal-spielen");

  // Event Listeners
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

  // Prüfen ob wir mit access_token zurückkommen
  checkForTokenInUrl();
});

// --- Helper: Show one screen, hide alle anderen ---
function showScreen(screen) {
  document.querySelectorAll("section.screen").forEach(s => s.classList.remove("active"));
  screen.classList.add("active");
}

// --- Spotify Login ---
function spotifyLogin() {
  // PKCE oder Implicit Flow - hier simpler Implicit Flow
  const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(" "))}&response_type=token&show_dialog=true`;
  window.location = authUrl;
}

function checkForTokenInUrl() {
  const hash = window.location.hash;
  if (hash) {
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("access_token");
    if (token) {
      accessToken = token;
      // Token in Session speichern
      sessionStorage.setItem("spotify_access_token", accessToken);
      window.history.replaceState({}, document.title, REDIRECT_URI); // clean URL
      afterLogin();
    }
  } else {
    // Versuch, Token aus Session zu lesen
    const saved = sessionStorage.getItem("spotify_access_token");
    if (saved) {
      accessToken = saved;
      afterLogin();
    }
  }
}

function afterLogin() {
  showScreen(modeScreen);
  setupSpotifyPlayer();
}

// --- Spotify Web Playback SDK Setup ---
window.onSpotifyWebPlaybackSDKReady = () => {
  if (!accessToken) return; // erst nach Login

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
}

// --- Spiel-Logik ---

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

  // Tracks laden (cachen)
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
  // Filter nur Tracks mit Preview URL oder Spotify URI
  return data.items
    .map(i => i.track)
    .filter(t => t && t.uri && !t.is_local);
}

function updateScores() {
  team1ScoreElem.textContent = `Team 1: ${scores[0]}`;
  team2ScoreElem.textContent = `Team 2: ${scores[1]}`;
}

async function playNewTrack() {
  if (!selectedPlaylistId) return;

  currentRound++;
  nochmalHörenLeft = 4;

  if (currentRound > roundsPerTeam * 2) {
    gameOver();
    return;
  }

  // Track wählen, random aus Playlist
  let playlistTracks = tracksCache[selectedPlaylistId];
  if (!playlistTracks || playlistTracks.length === 0) {
    alert("Keine Tracks gefunden.");
    return;
  }
  currentTrack = playlistTracks[Math.floor(Math.random() * playlistTracks.length)];

  btnTrackAttack.disabled = true;
  btnNochmalHoeren.disabled = false;
  btnAufloesen.disabled = false;
  btnRichtig.disabled = true;
  btnFalsch.disabled = true;
  btnNochmalHoeren.textContent = `NOCHMAL HÖREN (${nochmalHörenLeft})`;

  songInfo.classList.add("hidden");
  answerControls.classList.add("hidden");

  await playSpotifyTrack(currentTrack.uri, selectedMode);

  gamePhaseText.textContent = `Runde ${currentRound} | Team ${currentTeam + 1} dran`;
}

async function playCurrentTrackAgain() {
  if (nochmalHörenLeft <= 0) return;

  nochmalHörenLeft--;
  btnNochmalHoeren.textContent = `NOCHMAL HÖREN (${nochmalHörenLeft})`;

  btnRichtig.disabled = true;
  btnFalsch.disabled = true;

  await playSpotifyTrack(currentTrack.uri, selectedMode);
}

async function play
