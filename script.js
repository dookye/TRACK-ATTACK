const clientId = "3f4b3acc3bad4e0d98e77409ffc62e48";
const redirectUri = "https://dookye.github.io/musik-raten/";
const playlistId = "39sVxPTg7BKwrf2MfgrtcD"; // Punkrock 90 & 00

let accessToken = null;

// Vollbild-Hack für Mobile: Adressleiste verstecken
window.addEventListener("load", () => {
  setTimeout(() => {
    window.scrollTo(0, 1);
  }, 100);
});

document.addEventListener("DOMContentLoaded", () => {
  const statusDiv = document.getElementById("status");
  const startButton = document.getElementById("start-button");

  // Spotify-Login bei fehlendem Token
  const hash = window.location.hash;
  if (hash) {
    const params = new URLSearchParams(hash.substring(1));
    accessToken = params.get("access_token");
    window.history.replaceState({}, document.title, "/musik-raten/");
  }

  if (!accessToken) {
    redirectToSpotifyAuth();
    return;
  }

  statusDiv.textContent = "Bereit! Starte das Spiel.";
  startButton.disabled = false;

  startButton.addEventListener("click", playRandomSongSnippet);
});

// Spotify Login
function redirectToSpotifyAuth() {
  const scopes = "streaming user-read-email user-read-private";
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
  window.location.href = authUrl;
}

// Hauptlogik: Song zufällig abspielen
async function playRandomSongSnippet() {
  const statusDiv = document.getElementById("status");
  statusDiv.textContent = "Lade Song...";

  try {
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = await response.json();
    const tracks = data.items.filter(item => item.track && item.track.preview_url);
    if (tracks.length === 0) {
      statusDiv.textContent = "Keine Vorschau verfügbar.";
      return;
    }

    // Zufälliger Track
    const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
    const audio = new Audio(randomTrack.track.preview_url);

    // Zufälliger Startpunkt: max 27s wegen 3s Playzeit bei 30s preview
    const maxStart = 27;
    const start = Math.floor(Math.random() * maxStart);

    audio.currentTime = start;

    // Abspielen für 3 Sekunden
    audio.play();
    statusDiv.textContent = "🎵 Song wird