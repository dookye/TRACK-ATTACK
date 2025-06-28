// --- GLOBALE ZUSTANDSVARIABLEN ---
export let accessToken = '';
export let player = null;
export let currentPlaylistTracks = [];
export let activeDeviceId = null;
export let isPlayerReady = false; // Flag, wenn der SDK-Player verbunden ist
export let isSpotifySDKLoaded = false; // Flag, wenn das SDK geladen ist
export let fullscreenRequested = false; // Zur Steuerung des Fullscreen-States
export let logoClickListener = null; // Für den dynamischen Klick-Listener des Logos
export let currentGameState = 'loading'; // Zustände: 'loading', 'startScreen', 'diceSelect', 'playing', 'songPlaying', 'songPaused', 'genreSelect', 'resolutionPhase'
export let introAnimationPlayed = false; // Flag, ob die Logo-Intro-Animation schon einmal lief

// NEU für Spieler & Rundenmanagement
export let activePlayer = 1; // 1 für Spieler 1 (Blau), 2 für Spieler 2 (Pink) - Spieler 1 startet
export let playerScores = { 1: 0, 2: 0 }; // Punktstände der Spieler
export let currentRound = 0; // Aktuelle Runde, startet bei 0 und zählt hoch

// NEU für Würfel & Song-Parameter
export let currentDiceRoll = null; // Der vom Spieler gewählte Würfelwert für die aktuelle Runde
export let currentSongRepetitionsLeft = 0; // Verbleibende Wiederholungen für den aktuellen Song
export let currentMaxPointsForSong = 0; // Maximale Punkte für den aktuellen Song (passt sich mit Wiederholungen an)
export let currentPlayingTrack = null; // Speichert den aktuell abgespielten Track (für Auflösung)
export let currentPlayStartPosition = 0; // Speichert die Startposition des aktuellen Songs
export let isResolvingSong = false; // Flag für die Auflösungsphase

// Setter-Funktionen für den Zugriff von außen
export const setAccessToken = (token) => { accessToken = token; };
export const setPlayer = (p) => { player = p; };
export const setCurrentPlaylistTracks = (tracks) => { currentPlaylistTracks = tracks; };
export const setActiveDeviceId = (id) => { activeDeviceId = id; };
export const setIsPlayerReady = (status) => { isPlayerReady = status; };
export const setIsSpotifySDKLoaded = (status) => { isSpotifySDKLoaded = status; };
export const setFullscreenRequested = (status) => { fullscreenRequested = status; };
export const setLogoClickListener = (listener) => { logoClickListener = listener; };
export const setCurrentGameState = (state) => { currentGameState = state; };
export const setIntroAnimationPlayed = (played) => { introAnimationPlayed = played; };
export const setActivePlayer = (playerNum) => { activePlayer = playerNum; };
export const setPlayerScores = (scores) => { playerScores = { ...scores }; };
export const setCurrentRound = (round) => { currentRound = round; };
export const setCurrentDiceRoll = (roll) => { currentDiceRoll = roll; };
export const setCurrentSongRepetitionsLeft = (reps) => { currentSongRepetitionsLeft = reps; };
export const setCurrentMaxPointsForSong = (points) => { currentMaxPointsForSong = points; };
export const setCurrentPlayingTrack = (track) => { currentPlayingTrack = track; };
export const setCurrentPlayStartPosition = (pos) => { currentPlayStartPosition = pos; };
export const setIsResolvingSong = (status) => { isResolvingSong = status; };

// gameState.js
export const gameState = {
    // Player und Authentifizierung
    accessToken: null,
    player: null,
    activeDeviceId: null,
    isSpotifySDKLoaded: false, // Hier initialisieren
    isPlayerReady: false,       // Hier initialisieren

    // Spielstatus
    currentGameState: 'loading', // 'loading', 'startScreen', 'playing', 'diceRoll', 'resolution', 'scoreScreen'
    currentRound: 0,
    currentScore: 0,
    currentPlayer: 1, // Startet mit Spieler 1

    // Spielspezifische Daten
    currentPlaylistTracks: [],
    currentPlayingTrack: null,
    currentDiceRoll: null,
    currentSongRepetitionsLeft: 0,
    currentMaxPointsForSong: 0,
    currentPlayStartPosition: 0,
    isResolvingSong: false, // Flag, um anzuzeigen, ob gerade ein Song aufgelöst wird

    // UI-Status
    introAnimationPlayed: false,
    fullscreenRequested: false
};

// Setter-Funktionen
export function setAccessToken(token) { gameState.accessToken = token; }
export function setPlayer(p) { gameState.player = p; }
export function setActiveDeviceId(id) { gameState.activeDeviceId = id; }
export function setIsSpotifySDKLoaded(isLoaded) { gameState.isSpotifySDKLoaded = isLoaded; }
export function setIsPlayerReady(isReady) { gameState.isPlayerReady = isReady; }
export function setCurrentGameState(state) { gameState.currentGameState = state; }
export function setCurrentRound(round) { gameState.currentRound = round; }
export function setCurrentScore(score) { gameState.currentScore = score; }
export function setCurrentPlayer(player) { gameState.currentPlayer = player; }
export function setCurrentPlaylistTracks(tracks) { gameState.currentPlaylistTracks = tracks; }
export function setCurrentPlayingTrack(track) { gameState.currentPlayingTrack = track; }
export function setCurrentDiceRoll(roll) { gameState.currentDiceRoll = roll; }
export function setCurrentSongRepetitionsLeft(reps) { gameState.currentSongRepetitionsLeft = reps; }
export function setCurrentMaxPointsForSong(points) { gameState.currentMaxPointsForSong = points; }
export function setCurrentPlayStartPosition(pos) { gameState.currentPlayStartPosition = pos; }
export function setIsResolvingSong(isResolving) { gameState.isResolvingSong = isResolving; }
export function setIntroAnimationPlayed(played) { gameState.introAnimationPlayed = played; }
export function setFullscreenRequested(requested) { gameState.fullscreenRequested = requested; }

// Exporte die einzelnen Zustandselemente als Konstanten für direkten Zugriff
// Dies ermöglicht einen direkten Import wie `import { accessToken } from './gameState.js';`
// OHNE `gameState.accessToken` schreiben zu müssen.
export const {
    accessToken, player, activeDeviceId, isSpotifySDKLoaded, isPlayerReady,
    currentGameState, currentRound, currentScore, currentPlayer,
    currentPlaylistTracks, currentPlayingTrack, currentDiceRoll,
    currentSongRepetitionsLeft, currentMaxPointsForSong, currentPlayStartPosition,
    isResolvingSong, introAnimationPlayed, fullscreenRequested
} = gameState;

// Optional: Wenn du den Zugriff über window.gameState beibehalten möchtest,
// kannst du es hier globalisieren. Dies sollte aber eher vermieden werden,
// zugunsten expliziter Importe. Wenn du es globalisierst, muss es
// VOR jeder anderen Datei geladen werden, die darauf zugreift.
// window.gameState = gameState;
