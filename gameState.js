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

// Setter-Funktionen (BEHALTEN UND NICHT LÖSCHEN!)
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
