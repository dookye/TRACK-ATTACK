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
const loginScreen = document.getElementById("login-screen");
const btnLogin = document.getElementById("btn-login");

const modeScreen = document.getElementById("mode-screen");
const modeButtons = modeScreen.querySelectorAll("#mode-buttons button");

const gameScreen = document.getElementById("game-screen");
const team1ScoreElem = document
