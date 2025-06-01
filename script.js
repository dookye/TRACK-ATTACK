// Spotify-Zugangsdaten
const clientId = "3f4b3acc3bad4e0d98e77409ffc62e48";
const redirectUri = "https://dookye.github.io/musik-raten/callback.html";
let accessToken = "";

// Spielvariablen
let selectedGenre = null;
let selectedMode = null;
let currentTrack = null;
let score = 0;
let previewAudio = null;
let guessCount = 0;
let maxGuesses = 5;

// Genre-Playlists
const playlists = {
  "Die größten Hits aller Zeiten": "2si7ChS6Y0hPBt4FsobXpg",
  "Pop Hits 2000–2025": "6mtYuOxzl58vSGnEDtZ9uB",
  "Punkrock 90 & 00": "39sVxPTg7BKwrf2MfgrtcD"
};

// DOM-Elemente
const genreContainer = document.getElementById("genre-container");
const modeContainer = document.getElementById("mode-container");
const startButton = document.getElementById("start-button");
const gameArea = document.getElementById("game-area");
const playButton = document.getElementById("play-button");
const repeatButton = document.getElementById("repeat-button");
const revealButton = document.getElementById("reveal-button");
const feedbackButtons = document.getElementById("feedback-buttons");
const correctButton = document.getElementById("correct-button");
const wrongButton = document.getElementById("wrong-button");
const scoreDisplay = document.getElementById("score-display");

// Genre-Auswahl
document.querySelectorAll(".genre-button").forEach(button => {
  button.addEventListener("click", () => {
    selectedGenre = button.dataset.genre;
    genreContainer.classList.add("hidden");
    modeContainer.classList.remove("hidden");
  });
});

// Modus-Auswahl
document.querySelectorAll(".mode-button").forEach(button => {
  button.addEventListener("click", () => {
    selectedMode = button.dataset.mode;
    modeContainer.classList.add("hidden");
    startButton.classList.remove("hidden");
  });
});

// Spiel starten
startButton.addEventListener("click", () => {
  startButton.classList.add("hidden");
  gameArea.classList.remove("hidden");
  score = 0;
  guessCount = 0;
  scoreDisplay.textContent = "Punkte: 0";
  fetchTrack();
});

// Track abspielen
playButton.addEventListener("click", () => {
  if (previewAudio) previewAudio.play();
});

// Wiederholen
repeatButton.addEventListener("click", () => {
  if (previewAudio) previewAudio.play();
});

// Auflösung anzeigen
revealButton.addEventListener("click", () => {
  feedbackButtons.classList.remove("hidden");
});

// Bewertung: richtig
correctButton.addEventListener("click", () => {
  score++;
  scoreDisplay.textContent = `Punkte: ${score}`;
  nextTrack();
});

// Bewertung: falsch
wrongButton.addEventListener("click", () => {
  nextTrack();
});

// Nächster Track
function nextTrack() {
  guessCount++;
  feedbackButtons.classList.add("hidden");
  if (guessCount < maxGuesses) {
    fetchTrack();
  } else {
    alert(`Spiel beendet! Du hast ${score} von ${maxGuesses} Punkten.`);
    location.reload(); // Seite neu laden zum Neustart
  }
}

// Spotify Track holen
function fetchTrack() {
  const playlistId = playlists[selectedGenre];
  const url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;

  fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
    .then(res => res.json())
    .then(data => {
      const tracks = data.items.filter(item => item.track.preview_url);
      const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
      currentTrack = randomTrack.track;
      previewAudio = new Audio(currentTrack.preview_url);
      previewAudio.currentTime = 0;
      previewAudio.play();

      // Bei CRACK nur 3 Sekunden hörbar
      if (selectedMode === "CRACK") {
        setTimeout(() => previewAudio.pause(), 3000);
      }
    })
    .catch(err => {
      console.error("Fehler beim Laden des Tracks:", err);
      alert("Fehler beim Laden des Songs. Bitte neu starten.");
    });
}

// Access Token aus URL extrahieren
function getAccessTokenFromURL() {
  const hash = window.location.hash;
  if (hash) {
    const params = new URLSearchParams(hash.substring(1));
    accessToken = params.get("access_token");
  }
}

// Initialisierung beim Laden
window.onload = () => {
  getAccessTokenFromURL();
  if (!accessToken) {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}&scope=user-read-private`;
    window.location.href = authUrl;
  }
};
