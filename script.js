// Deine Spotify-Daten
const clientId = "3f4b3acc3bad4e0d98e77409ffc62e48";
const redirectUri = "https://dookye.github.io/musik-raten/callback.html";
const scopes = [
  "user-read-private",
  "playlist-read-private",
  "playlist-read-collaborative"
];

let accessToken = null;
let selectedGenre = null;
let selectedMode = null;

// Genres mit Spotify-Playlist-URLs
const genres = {
  "Die größten Hits aller Zeiten": "https://open.spotify.com/playlist/2si7ChS6Y0hPBt4FsobXpg",
  "Pop Hits 2000–2025": "https://open.spotify.com/playlist/6mtYuOxzl58vSGnEDtZ9uB",
  "Punkrock 90 & 00": "https://open.spotify.com/playlist/39sVxPTg7BKwrf2MfgrtcD"
};

// Spielmodi in Sekunden
const modes = {
  "Normal (10 Sek)": 10,
  "Hart (5 Sek)": 5,
  "Crack (3 Sek)": 3
};

// Starte Spotify Login
function loginWithSpotify() {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(" "))}`;
  window.location.href = authUrl;
}

// Zeige Genre-Auswahl
function showGenreSelection() {
  const container = document.getElementById("main");
  container.innerHTML = `<h2>1. Genre wählen</h2>`;
  Object.keys(genres).forEach(genre => {
    const btn = document.createElement("button");
    btn.textContent = genre;
    btn.onclick = () => {
      selectedGenre = genre;
      showModeSelection();
    };
    container.appendChild(btn);
  });
}

// Zeige Spielmodus-Auswahl
function showModeSelection() {
  const container = document.getElementById("main");
  container.innerHTML = `<h2>2. Spielmodus wählen</h2>`;
  Object.keys(modes).forEach(mode => {
    const btn = document.createElement("button");
    btn.textContent = mode;
    btn.onclick = () => {
      selectedMode = mode;
      showStartButton();
    };
    container.appendChild(btn);
  });
}

// Zeige Start-Button
function showStartButton() {
  const container = document.getElementById("main");
  container.innerHTML = `
    <h2>Bereit?</h2>
    <p>Genre: <strong>${selectedGenre}</strong></p>
    <p>Modus: <strong>${selectedMode}</strong></p>
    <button onclick="startGame()">🎵 START 🎵</button>
  `;
}

// Starte Spiel (Platzhalter – Inhalte folgen)
function startGame() {
  const container = document.getElementById("main");
  container.innerHTML = `
    <h2>Song wird geladen...</h2>
    <p>(Hier wird das Abspielsystem eingebaut)</p>
  `;
  // Hier folgen dann: Audio, Punkteanzeige, Buttons usw.
}

// Wenn Token übergeben wurde (z.B. in callback.html), speichern
function setAccessTokenFromHash() {
  const hash = window.location.hash;
  if (hash) {
    const tokenMatch = hash.match(/access_token=([^&]*)/);
    if (tokenMatch) {
      accessToken = tokenMatch[1];
      localStorage.setItem("spotify_access_token", accessToken);
      window.location.href = "index.html"; // zurück zur Startseite
    }
  } else {
    // Falls Token gespeichert ist
    accessToken = localStorage.getItem("spotify_access_token");
    if (accessToken) {
      showGenreSelection();
    } else {
      document.getElementById("main").innerHTML = `
        <h2>🔐 Spotify Login benötigt</h2>
        <button onclick="loginWithSpotify()">Login mit Spotify</button>
      `;
    }
  }
}

// Initialisierung
window.onload = setAccessTokenFromHash;
