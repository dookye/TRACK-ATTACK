// js/domElements.js

// Login Bereich
export const loginArea = document.getElementById('login-area');
export const spotifyLoginButton = document.getElementById('spotify-login-button');
export const playbackStatus = document.getElementById('playback-status');

// Nachrichten für Orientierung / Fullscreen
export const orientationMessage = document.getElementById('orientation-message');
export const fullscreenMessage = document.getElementById('fullscreen-message');
export const initialClickBlocker = document.getElementById('initial-click-blocker');

// Logo / Start-Bereich
export const logoContainer = document.getElementById('logo-container');
export const logo = document.getElementById('game-logo');
export const gameContainer = document.getElementById('game-container'); // Der Haupt-Container für das Spiel

// Spiel-Elemente (kommen später ins Spielgeschehen)
export const gameElementsContainer = document.getElementById('game-elements-container');
export const playerDisplay = document.getElementById('player-display');
export const roundDisplay = document.getElementById('round-display');
export const scoreDisplay = document.getElementById('score-display');

// Würfelbereich
export const diceArea = document.getElementById('dice-area');
export const diceAnimation = document.getElementById('dice-animation');
export const diceButtons = [
    document.getElementById('dice-button-3'),
    document.getElementById('dice-button-4'),
    document.getElementById('dice-button-5'),
    document.getElementById('dice-button-7')
];

// Auflösungs-Buttons
export const resolutionButtonsContainer = document.getElementById('resolution-buttons-container');
export const correctButton = document.getElementById('correct-button');
export const passButton = document.getElementById('pass-button');
export const skipButton = document.getElementById('skip-button');
