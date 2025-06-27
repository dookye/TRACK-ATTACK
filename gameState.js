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
