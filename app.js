// app.js

const clientId = "53257f6a1c144d3f929a60d691a0c6f6";
const redirectUri = "https://dookye.github.io/musik-raten/";
const scopes = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-modify-playback-state",
  "user-read-playback-state"
];

let codeVerifier;
let accessToken = null;
let player = null;

// 1. Start OAuth login with PKCE
async function redirectToSpotifyAuth() {
  codeVerifier = generateCodeVerifier(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  localStorage.setItem("code_verifier", codeVerifier);

  const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(
    scopes.join(" ")
  )}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge_method=S256&code_challenge=${codeChallenge}`;

  window.location = authUrl;
}

// 2. Exchange Authorization Code for Access Token
async function handleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (!code) return;

  codeVerifier = localStorage.getItem("code_verifier");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json();
  accessToken = data.access_token;
  localStorage.setItem("access_token", accessToken);

  history.replaceState({}, document.title, "/musik-raten/");
  onLoginSuccess();
}

// 3. Spotify Web Playback SDK ready
window.onSpotifyWebPlaybackSDKReady = () => {
  const token = getAccessToken();
  if (!token) {
    console.error("Kein Access Token, Player nicht initialisiert");
    return;
  }

  player = new Spotify.Player({
    name: "TRACK ATTACK PLAYER",
    getOAuthToken: cb => cb(token),
    volume: 0.8,
  });

  player.addListener("ready", ({ device_id }) => {
    console.log("Player ready with device ID", device_id);
    localStorage.setItem("device_id", device_id);
  });

  player.addListener("not_ready", ({ device_id }) => {
    console.warn("Player not ready", device_id);
  });

  player.addListener("initialization_error", ({ message }) => {
    console.error("Init error:", message);
  });

  player.addListener("authentication_error", ({ message }) => {
    console.error("Auth error:", message);
  });

  player.connect();
};

// 4. On login success, show game screen
function onLoginSuccess() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("game-mode-screen").style.display = "block";
}

// 5. Helper functions
function generateCodeVerifier(length) {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function getAccessToken() {
  if (accessToken) return accessToken;
  accessToken = localStorage.getItem("access_token");
  return accessToken;
}

// 6. Event listeners
window.addEventListener("DOMContentLoaded", () => {
  handleRedirect();

  const loginBtn = document.getElementById("spotify-login-btn");
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      redirectToSpotifyAuth();
    });
  }
});
