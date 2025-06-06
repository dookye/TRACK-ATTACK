// Spotify App-Konfiguration
const clientId = "3f4b3acc3bad4e0d98e77409ffc62e48";
const redirectUri = "https://dookye.github.io/musik-raten/callback.html";
const playlistId = "39sVxPTg7BKwrf2MfgrtcD";
const scopes = ["streaming", "user-read-email", "user-read-private"];

// Elemente
const startBtn = document.getElementById("start-btn");
const statusBox = document.getElementById("status");

// Spotify-Player-Objekt
let player;
let deviceId = null;

// Login-Flow
function authorize() {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${encodeURIComponent(scopes.join(" "))}&response_type=token`;
  window.location.href = authUrl;
}

// Zugriffstoken prüfen
const accessToken = localStorage.getItem("spotify_access_token");
if (!accessToken) {
  authorize(); // Weiterleitung zur Spotify-Anmeldung
} else {
  setupPlayer(); // Wenn Token da: Player einrichten
}

// Spotify Web Playback SDK laden
window.onSpotifyWebPlaybackSDKReady = () => {
  player = new Spotify.Player({
    name: "Musikraten Player",
    getOAuthToken: cb => {
      cb(localStorage.getItem("spotify_access_token"));
    },
    volume: 0.8,
  });

  player.addListener("ready", ({ device_id }) => {
    deviceId = device_id;
    statusBox.innerText = "Bereit zum Start 🎵";
    startBtn.disabled = false;
  });

  player.addListener("initialization_error", ({ message }) => {
    console.error(message);
  });

  player.addListener("authentication_error", ({ message }) => {
    console.error(message);
    localStorage.removeItem("spotify_access_token");
    authorize();
  });

  player.addListener("account_error", ({ message }) => {
    console.error(message);
  });

  player.connect();
};

// Player initialisieren
function setupPlayer() {
  const script = document.createElement("script");
  script.src = "https://sdk.scdn.co/spotify-player.js";
  document.head.appendChild(script);
}

// Start-Button-Logik
startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  statusBox.innerText = "Lade Song...";

  try {
    const tracks = await fetchPlaylistTracks(playlistId);
    if (tracks.length === 0) {
      statusBox.innerText = "Keine Songs gefunden!";
      startBtn.disabled = false;
      return;
    }

    const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
    const trackUri = randomTrack.track.uri;
    const durationMs = randomTrack.track.duration_ms;
    const maxStart = durationMs - 3000;
    const startPosition = Math.floor(Math.random() * (maxStart > 0 ? maxStart : 0));

    await playTrack(trackUri, startPosition);
    statusBox.innerText = "🎶 Rate den Song...";
    setTimeout(() => {
      player.pause();
      statusBox.innerText = "⏸️ Stopp – nächster Versuch?";
      startBtn.disabled = false;
    }, 3000);
  } catch (error) {
    console.error(error);
    statusBox.innerText = "Fehler beim Laden des Songs.";
    startBtn.disabled = false;
  }
});

// Playlist-Titel abrufen
async function fetchPlaylistTracks(playlistId) {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const data = await response.json();
  return data.items || [];
}

// Song abspielen
async function playTrack(uri, positionMs = 0) {
  await fetch("https://api.spotify.com/v1/me/player/play?device_id=" + deviceId, {
    method: "PUT",
    body: JSON.stringify({
      uris: [uri],
      position_ms: positionMs,
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
}