// --- ALLGEMEINE KONSTANTEN & VARIABLEN (Startbildschirm & UI) ---
export const logo = document.getElementById('game-logo');
export const logoContainer = document.getElementById('logo-container');
export const loginArea = document.getElementById('login-area');
export const spotifyLoginButton = document.getElementById('spotify-login-button');
export const initialClickBlocker = document.getElementById('initial-click-blocker');
export const orientationMessage = document.getElementById('orientation-message');
export const fullscreenMessage = document.getElementById('fullscreen-message');
export const gameContainer = document.querySelector('.game-container'); // Hier bleibt .game-container

// Spotify UI-Elemente
export const playbackStatus = document.getElementById('playback-status');

// NEU: Würfel UI-Elemente
export const diceContainer = document.getElementById('dice-container');
export const diceAnimation = document.getElementById('dice-animation');
export const diceButtonsContainer = document.getElementById('dice-buttons');
export const diceButtons = document.querySelectorAll('.dice-button'); // Alle Würfel-Buttons
