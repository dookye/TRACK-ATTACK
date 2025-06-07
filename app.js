// app.js

// --- Globale Variable für Spotify Player & Status ---
let spotifyPlayer = null;
let deviceId = null;
let accessToken = null;

let currentMode = null; // Normalo, like a Pro, bin ich geil oder was!
let playDuration = 30; // Sekunden, wird mit Modus gesetzt
let currentGenre = null; // z.B. "Punk Rock"
let currentPlaylists = []; // Array mit Playlist-IDs

let currentTrack = null; // Aktueller Song (Spotify Track Objekt)
let playCount = 0; // wie oft "NOCHMAL HÖREN" gedrückt wurde max 4
let maxReplays = 4;

let teamScores = [0, 0];
let currentTeam = 0; // 0 = Team 1, 1 = Team 2
let roundsPlayed = 0;
let totalRounds = 20;

let isRevealed = false;

// --- Spotify Developer Daten ---
const clientId = "53257f6a1c144d3f929a60d691a0c6f6";
const redirectUri = "https://dookye.github.io/musik-raten/";
const scopes = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state",
].join(" ");

const playlistMap = {
  "Punk Rock (90's & 00')": ["39sVxPTg7BKwrf2MfgrtcD"],
  "Pop Hits 2000-2025": ["6mtYuOxzl58vSGnEDtZ9uB"],
  "Die größten Hits aller Zeiten": ["2si7ChS6Y0hPBt4FsobXpg"],
};

// --- Hilfsfunktion: PKCE Code Verifier und Challenge ---

function generateRandomString(length) {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return hash;
}

function base64UrlEncode(buffer) {
  let bytes = new Uint8Array(buffer);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(codeVerifier) {
  const hashed = await sha256(codeVerifier);
  return base64UrlEncode(hashed);
}

// --- OAuth PKCE Login ---

async function startLogin() {
  const codeVerifier = generateRandomString(128);
  localStorage.setItem("code_verifier", codeVerifier);

  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const state = generateRandomString(16);
  localStorage.setItem("oauth_state", state);

  const authUrl =
    "https://accounts.spotify.com/authorize" +
    "?response_type=code" +
    "&client_id=" +
    encodeURIComponent(clientId) +
    "&scope=" +
    encodeURIComponent(scopes) +
    "&redirect_uri=" +
    encodeURIComponent(redirectUri) +
    "&state=" +
    encodeURIComponent(state) +
    "&code_challenge_method=S256" +
    "&code_challenge=" +
    encodeURIComponent(codeChallenge);

  window.location = authUrl;
}

async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const storedState = localStorage.getItem("oauth_state");

  if (code && state === storedState) {
    // Code tauschen gegen Access Token
    const codeVerifier = localStorage.getItem("code_verifier");
    const body = new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const result = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (result.ok) {
      const data = await result.json();
      accessToken = data.access_token;
      localStorage.setItem("spotify_access_token", accessToken);

      // URL säubern, damit nicht jedes mal neu
      window.history.replaceState({}, document.title, redirectUri);

      // Start Player
      onLoginSuccess();
    } else {
      alert("Fehler beim Token-Austausch");
    }
  } else if (params.get("error")) {
    alert("Spotify Login Fehler: " + params.get("error"));
  }
}

function getAccessToken() {
  if (!accessToken) {
    accessToken = localStorage.getItem("spotify_access_token");
  }
  return accessToken;
}

// --- Spotify Web Playback SDK Setup ---

window.onSpotifyWebPlaybackSDKReady = () => {
  initSpotifyPlayer();
};

function initSpotifyPlayer() {
  if (!getAccessToken()) {
    console.log("Kein Access Token, Player nicht initialisiert");
    return;
  }

  spotifyPlayer = new Spotify.Player({
    name: "TRACK ATTACK Player",
    getOAuthToken: (cb) => {
      cb(getAccessToken());
    },
    volume: 0.8,
  });

  spotifyPlayer.addListener("ready", ({ device_id }) => {
    deviceId = device_id;
    console.log("Spotify Player ready mit Device ID:", deviceId);
  });

  spotifyPlayer.addListener("not_ready", ({ device_id }) => {
    console.log("Spotify Player nicht mehr verfügbar", device_id);
  });

  spotifyPlayer.addListener("player_state_changed", (state) => {
    if (!state) return;
    console.log("Player State geändert:", state);

    // Falls Song zu Ende: Button aktivieren etc.
    if (state.paused) {
      document.getElementById("play-button").disabled = false;
    }
  });

  spotifyPlayer.connect();
}

// --- UI Steuerung ---

document.addEventListener("DOMContentLoaded", async () => {
  const loginButton = document.getElementById("login-button");
  const welcomeScreen = document.getElementById("welcome-screen");
  const modeScreen = document.getElementById("mode-screen");
  const genreScreen = document.getElementById("genre-screen");
  const gameScreen = document.getElementById("game-screen");
  const endScreen = document.getElementById("end-screen");

  const playButton = document.getElementById("play-button");
  const replayButton = document.getElementById("replay-button");
  const revealButton = document.getElementById("reveal-button");
  const correctButton = document.getElementById("correct-button");
  const wrongButton = document.getElementById("wrong-button");
  const restartButton = document.getElementById("restart-button");

  const score1 = document.getElementById("score1");
  const score2 = document.getElementById("score2");

  const songInfo = document.getElementById("song-info");
  const gameMessage = document.getElementById("game-message");

  // Zunächst alle Screens außer welcome verbergen
  modeScreen.style.display = "none";
  genreScreen.style.display = "none";
  gameScreen.style.display = "none";
  endScreen.style.display = "none";

  // Wenn Token schon da ist => direkt Login Success
  await handleRedirect();
  if (getAccessToken()) {
    onLoginSuccess();
  }

  loginButton.addEventListener("click", () => {
    startLogin();
  });

  // Spielmodus Auswahl
  document.querySelectorAll(".mode-button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      currentMode = e.target.getAttribute("data-mode");
      if (currentMode === "Normalo") playDuration = 30;
      else if (currentMode === "like a Pro") playDuration = 10;
      else if (currentMode === "bin ich geil oder was!") playDuration = 2;

      modeScreen.style.display = "none";
      genreScreen.style.display = "block";
    });
  });

  // Genre Auswahl
  document.querySelectorAll(".genre-button").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      currentGenre = e.target.getAttribute("data-genre");
      currentPlaylists = playlistMap[currentGenre] || [];

      genreScreen.style.display = "none";
      gameScreen.style.display = "block";

      resetRound();

      updateScores();
      updateTeamIndicator();
      songInfo.textContent = "";
      gameMessage.textContent = `Team ${currentTeam + 1} ist dran! Genre: ${currentGenre}`;
    });
  });

  playButton.addEventListener("click", async () => {
    playButton.disabled = true;
    replayButton.disabled = false;
    revealButton.disabled = false;
    correctButton.disabled = true;
    wrongButton.disabled = true;

    playCount = 0;
    isRevealed = false;
    songInfo.textContent = "";
    gameMessage.textContent = "Song läuft...";

    await playRandomTrackFromGenre();
  });

  replayButton.addEventListener("click", async () => {
    if (playCount >= maxReplays) {
      replayButton.disabled = true;
      return;
    }
    playCount++;
    replayButton.disabled = playCount >= maxReplays;

    await replayCurrentTrack();
  });

  revealButton.addEventListener("click", () => {
    isRevealed = true;
    revealButton.disabled = true;
    correctButton.disabled = false;
    wrongButton.disabled = false;

    showCurrentTrackInfo();
  });

  correctButton.addEventListener("click", () => {
    teamScores[currentTeam]++;
    nextRound();
  });

  wrongButton.addEventListener("click", () => {
    nextRound();
  });

  restartButton.addEventListener("click", () => {
    // Zurück zum Startbildschirm
    teamScores = [0, 0];
    roundsPlayed = 0;
    currentTeam = 0;
    currentMode = null;
    currentGenre = null;
    playCount = 0;
    isRevealed = false;

    endScreen.style.display = "none";
    welcomeScreen.style.display = "block";
  });

  // --- Funktionen ---

  async function playRandomTrackFromGenre() {
    if (!deviceId) {
      alert("Spotify Player ist noch nicht bereit. Bitte warten...");
      playButton.disabled = false;
      return;
    }
    if (currentPlaylists.length === 0) {
      alert("Keine Playlists gefunden für das gewählte Genre.");
      return;
    }

    // Zufällig eine Playlist auswählen
    const playlistId =
      currentPlaylists[Math.floor(Math.random() * currentPlaylists.length)];

    // Playlist Tracks holen
    const res = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`,
      {
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
        },
      }
    );
    if (!res.ok) {
      alert("Fehler beim Abrufen der Playlist-Tracks");
      return;
    }
    const data = await res.json();
    const tracks = data.items.map((item) => item.track);

    // Zufällig Track auswählen
    currentTrack = tracks[Math.floor(Math.random() * tracks.length)];

    if (!currentTrack.preview_url && !currentTrack.uri) {
      alert("Track hat keine Abspielmöglichkeit, nochmal versuchen.");
      return;
    }

    // Playback starten
    await playTrack(currentTrack.uri);

    // Nach playDuration Sekunden Player stoppen (simulate)
    setTimeout(() => {
      spotifyPlayer.pause();
      gameMessage.textContent = "Zeit ist abgelaufen! Jetzt Song aufdecken!";
      revealButton.disabled = false;
      correctButton.disabled = false;
      wrongButton.disabled = false;
    }, playDuration * 1000);
  }

  async function playTrack(uri) {
    if (!deviceId) {
      alert("Spotify Player ist nicht bereit.");
      return;
    }
    const playBody = {
      uris: [uri],
      position_ms: 0,
    };

    await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
      {
        method: "PUT",
        body: JSON.stringify(playBody),
        headers: {
          Authorization: `Bearer ${getAccessToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
  }

  async function replayCurrentTrack() {
    if (!currentTrack) return;
    await playTrack(currentTrack.uri);
    gameMessage.textContent = `Song läuft nochmal... (${playCount}/${maxReplays})`;
  }

  function showCurrentTrackInfo() {
    if (!currentTrack) return;
    const artists = currentTrack.artists.map((a) => a.name).join(", ");
    songInfo.textContent = `Song: "${currentTrack.name}" von ${artists}`;
    gameMessage.textContent = `Team ${currentTeam + 1}, habt ihr richtig geraten?`;
  }

  function nextRound() {
    roundsPlayed++;
    currentTeam = 1 - currentTeam; // Team wechseln
    updateScores();

    if (roundsPlayed >= totalRounds) {
      // Spielende
      gameScreen.style.display = "none";
      endScreen.style.display = "block";

      let winnerText = "Unentschieden!";
      if (teamScores[0] > teamScores[1]) winnerText = "Team 1 gewinnt!";
      else if (teamScores[1] > teamScores[0]) winnerText = "Team 2 gewinnt!";

      document.getElementById("final-score").textContent =
        `Endstand: Team 1: ${teamScores[0]} – Team 2: ${teamScores[1]}. ${winnerText}`;

      return;
    }

    // Sonst neue Runde vorbereiten
    playCount = 0;
    isRevealed = false;
    songInfo.textContent = "";
    gameMessage.textContent = `Team ${currentTeam + 1} ist dran! Genre: ${currentGenre}`;

    revealButton.disabled = true;
    correctButton.disabled = true;
    wrongButton.disabled = true;
    playButton.disabled = false;
    replayButton.disabled = true;
  }

  function updateScores() {
    score1.textContent = teamScores[0];
    score2.textContent = teamScores[1];
  }

  function updateTeamIndicator() {
    gameMessage.textContent = `Team ${currentTeam + 1} ist dran! Genre: ${currentGenre}`;
  }

  function resetRound() {
    teamScores = [0, 0];
    roundsPlayed = 0;
    currentTeam = 0;
    playCount = 0;
    isRevealed = false;

    revealButton.disabled = true;
    correctButton.disabled = true;
    wrongButton.disabled = true;
    replayButton.disabled = true;
    playButton.disabled = false;
  }
});
