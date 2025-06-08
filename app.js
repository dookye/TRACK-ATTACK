// Konfiguration für Spotify Authorization Code Flow mit PKCE
const clientId = "53257f6a1c144d3f929a60d691a0c6f6"; // Hier musst du deine Spotify Client ID einfügen
const redirectUri = window.location.origin + window.location.pathname; // Gleiche URL wie index.html
const scopes = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative"
];

// Hilfsfunktion zum Generieren eines zufälligen Strings (Code Verifier)
function generateCodeVerifier(length = 128) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// SHA256 Hash und Base64Url Kodierung für Code Challenge
async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// URL Parameter auslesen
function getUrlParameter(name) {
  name = name.replace(/[\[\]]/g, "\\$&");
  const regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)");
  const results = regex.exec(window.location.href);
  if (!results) return null;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}

// Speicher für PKCE Code Verifier in SessionStorage
const codeVerifierKey = "spotify_code_verifier";

async function redirectToSpotifyAuth() {
  const codeVerifier = generateCodeVerifier();
  sessionStorage.setItem(codeVerifierKey, codeVerifier);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.append("client_id", clientId);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("redirect_uri", redirectUri);
  authUrl.searchParams.append("scope", scopes.join(" "));
  authUrl.searchParams.append("code_challenge_method", "S256");
  authUrl.searchParams.append("code_challenge", codeChallenge);

  window.location.href = authUrl.toString();
}

// Token holen mit Authorization Code
async function fetchAccessToken(code) {
  const codeVerifier = sessionStorage.getItem(codeVerifierKey);
  if (!codeVerifier) {
    throw new Error("Code Verifier nicht gefunden.");
  }

  const body = new URLSearchParams();
  body.append("client_id", clientId);
  body.append("grant_type", "authorization_code");
  body.append("code", code);
  body.append("redirect_uri", redirectUri);
  body.append("code_verifier", codeVerifier);

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error("Token-Anfrage fehlgeschlagen.");
  }
  return response.json();
}

// Global Variables
let accessToken = null;
let player = null;
let deviceId = null;
let currentPlaylist = "37i9dQZF1DXcBWIGoYBM5M"; // Beispiel: Spotify Today's Top Hits Playlist
let tracks = [];
let currentTrackIndex = 0;
let score = 0;

const loginBtn = document.getElementById("login-btn");
const loginSection = document.getElementById("login-section");
const gameSection = document.getElementById("game-section");
const questionText = document.getElementById("question-text");
const answersDiv = document.getElementById("answers");
const nextBtn = document.getElementById("next-btn");
const scoreDiv = document.getElementById("score");

// Login Button Click
loginBtn.addEventListener("click", () => {
  redirectToSpotifyAuth();
});

// Nach Autorisierung: Token holen und Spieler initialisieren
async function handleAuth() {
  const code = getUrlParameter("code");
  if (!code) return;

  try {
    const tokenData = await fetchAccessToken(code);
    accessToken = tokenData.access_token;
    history.replaceState(null, "", redirectUri); // Code aus URL entfernen

    loginSection.style.display = "none";
    gameSection.style.display = "block";

    await initializePlayer();
    await loadPlaylistTracks();
    playTrack(currentTrackIndex);
  } catch (e) {
    alert("Fehler bei der Anmeldung: " + e.message);
  }
}

// Spotify Web Playback SDK laden und Player initialisieren
async function initializePlayer() {
  return new Promise((resolve, reject) => {
    if (!window.Spotify) {
      const script = document.createElement("script");
      script.src = "https://sdk.scdn.co/spotify-player.js";
      document.head.appendChild(script);
      script.onload = () => {
        window.onSpotifyWebPlaybackSDKReady = () => {
          createPlayer().then(resolve).catch(reject);
        };
      };
    } else {
      createPlayer().then(resolve).catch(reject);
    }
  });
}

async function createPlayer() {
  return new Promise((resolve, reject) => {
    player = new Spotify.Player({
      name: "Track Attack Player",
      getOAuthToken: cb => { cb(accessToken); },
      volume: 0.5
    });

    player.addListener("ready", ({ device_id }) => {
      deviceId = device_id;
      transferPlaybackHere().then(resolve);
    });

    player.addListener("not_ready", ({ device_id }) => {
      console.log("Device went offline", device_id);
    });

    player.addListener("player_state_changed", state => {
      if (!state) return;
      if (state.paused) return;
      // Automatisch zum nächsten Track wenn aktueller Track endet
      if (state.position >= state.duration - 500) {
        // Warte auf next-btn (Benutzeraktion)
      }
    });

    player.connect().catch(reject);
  });
}

// Übertragung der Wiedergabe auf Web Player
async function transferPlaybackHere() {
  await fetch("https://api.spotify.com/v1/me/player", {
    method: "PUT",
    body: JSON.stringify({
      device_ids: [deviceId],
      play: false
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    }
  });
}

// Playlist-Tracks laden
async function loadPlaylistTracks() {
  tracks = [];
  let url = `https://api.spotify.com/v1/playlists/${currentPlaylist}/tracks?limit=50`;

  while (url) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();

    tracks = tracks.concat(data.items.map(item => item.track));
    url = data.next;
  }
}

// Track abspielen und Frage stellen
async function playTrack(index) {
  if (index >= tracks.length) {
    questionText.textContent = "Spiel beendet! Deine Punkte: " + score;
    answersDiv.innerHTML = "";
    nextBtn.style.display = "none";
    player.pause();
    return;
  }

  const track = tracks[index];

  questionText.textContent = "Welcher Song wird hier gespielt?";
  answersDiv.innerHTML = "";
  nextBtn.style.display = "none";

  // Track starten
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    body: JSON.stringify({ uris: [track.uri] }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    }
  });

  // Antworten generieren (Songtitel + falsche Optionen)
  const options = [track.name];
  while (options.length < 4) {
    const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
    if (!options.includes(randomTrack.name)) {
      options.push(randomTrack.name);
    }
  }
  shuffleArray(options);

  // Buttons für Antworten
  options.forEach(option => {
    const btn = document.createElement("button");
    btn.classList.add("answer-btn");
    btn.textContent = option;
    btn.addEventListener("click", () => checkAnswer(btn, track.name));
    answersDiv.appendChild(btn);
  });
}

// Antwort prüfen
function checkAnswer(button, correctAnswer) {
  const buttons = answersDiv.querySelectorAll("button");
  buttons.forEach(btn => btn.disabled = true);

  if (button.textContent === correctAnswer) {
    button.classList.add("correct");
    score++;
    scoreDiv.textContent = "Punkte: " + score;
  } else {
    button.classList.add("wrong");
    // Korrekte Antwort markieren
    buttons.forEach(btn => {
      if (btn.textContent === correctAnswer) {
        btn.classList.add("correct");
      }
    });
  }

  nextBtn.style.display = "inline-block";
}

// Nächster Track
nextBtn.addEventListener("click", () => {
  currentTrackIndex++;
  playTrack(currentTrackIndex);
});

// Hilfsfunktion zum Mischen eines Arrays (Fisher-Yates)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Beim Laden prüfen, ob Code in URL steht
window.addEventListener("load", () => {
  handleAuth();
});
