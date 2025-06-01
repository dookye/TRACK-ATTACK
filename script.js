const clientId = "3f4b3acc3bad4e0d98e77409ffc62e48";
const redirectUri = "https://dookye.github.io/musik-raten/callback.html";
const token = localStorage.getItem("spotify_access_token");
let token = localStorage.getItem("spotify_access_token");
let playlistId = null;
let mode = null;
let trackList = [];
let currentTrack = null;
let currentPoints = 5;
let totalPoints = 0;
let repeatCount = 0;

function loginWithSpotify() {
  const clientId = "3f4b3acc3bad4e0d98e77409ffc62e48";
  const redirectUri = "https://dookye.github.io/musik-raten/callback.html";
  const scopes = "playlist-read-private";

  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;

  window.location.href = authUrl;
}

function authorizeSpotify() {
  const scopes = "playlist-read-private";
  const url = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}`;
  window.location.href = url;
}

if (!token) {
  document.getElementById("app").innerHTML = "<p>Fehler: Kein Zugriffstoken erhalten.</p>";
  // Optional: automatisch Login starten
  // loginWithSpotify();
}

if (!token) {
  authorizeSpotify();
}

// Element-Zuweisungen
const genreSelection = document.getElementById("genre-selection");
const modeSelection = document.getElementById("mode-selection");
const gameUI = document.getElementById("game-ui");
const startButton = document.getElementById("start-button");
const controls = document.getElementById("controls");
const playBtn = document.getElementById("play-preview");
const repeatBtn = document.getElementById("repeat-preview");
const showSolutionBtn = document.getElementById("show-solution");
const solutionBtns = document.getElementById("solution-buttons");
const correctBtn = document.getElementById("correct");
const wrongBtn = document.getElementById("wrong");
const pointsDisplay = document.getElementById("points");

// Genre-Auswahl
genreSelection.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", () => {
    playlistId = btn.dataset.playlist;
    genreSelection.classList.add("hidden");
    modeSelection.classList.remove("hidden");
  });
});

// Modus-Auswahl
modeSelection.querySelectorAll("button").forEach(btn => {
  btn.addEventListener("click", () => {
    mode = btn.dataset.mode;
    modeSelection.classList.add("hidden");
    gameUI.classList.remove("hidden");
  });
});

// Start
startButton.addEventListener("click", async () => {
  controls.classList.remove("hidden");
  await loadPlaylistTracks();
  nextTrack();
});

// Lade Tracks
async function loadPlaylistTracks() {
  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, {
    headers: { Authorization: "Bearer " + token }
  });
  const data = await res.json();
  trackList = data.items.map(item => item.track).filter(track => track.preview_url);
}

// Nächster Track
function nextTrack() {
  repeatCount = 0;
  currentPoints = 5;
  solutionBtns.classList.add("hidden");
  currentTrack = trackList[Math.floor(Math.random() * trackList.length)];
  playPreview();
}

// Preview abspielen
function playPreview() {
  const audio = new Audio(currentTrack.preview_url);
  const durations = { normal: 30, hard: 10, crack: 3 };
  const duration = durations[mode] * 1000;

  audio.play();
  setTimeout(() => audio.pause(), duration);
}

// Wiederholen
repeatBtn.addEventListener("click", () => {
  repeatCount++;
  if (repeatCount <= 4) {
    currentPoints = Math.max(1, currentPoints - 1);
    playPreview();
  } else {
    solutionBtns.classList.remove("hidden");
  }
});

// Auflösen
showSolutionBtn.addEventListener("click", () => {
  solutionBtns.classList.remove("hidden");
});

// Richtig/Falsch
correctBtn.addEventListener("click", () => {
  totalPoints += currentPoints;
  updatePoints();
  nextTrack();
});

wrongBtn.addEventListener("click", () => {
  updatePoints();
  nextTrack();
});

function updatePoints() {
  pointsDisplay.textContent = `Punkte: ${totalPoints}`;
}
