// js/gameState.js

export const gameState = {
    // Player und Authentifizierung
    accessToken: null,
    player: null,
    activeDeviceId: null,
    isSpotifySDKLoaded: false,
    isPlayerReady: false,

    // Spielstatus
    currentGameState: 'loading', // 'loading', 'startScreen', 'playing', 'diceRoll', 'resolution', 'scoreScreen'
    currentRound: 0,
    playerScores: [0, 0], // Array für Punktzahlen von Spieler 1 und Spieler 2 (Index 0 für Spieler 1, Index 1 für Spieler 2)
    currentPlayer: 1, // Startet mit Spieler 1 (kann 1 oder 2 sein)

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

// Setter-Funktionen, um den Zustand sicher zu aktualisieren
export function setAccessToken(token) { gameState.accessToken = token; }
export function setPlayer(p) { gameState.player = p; }
export function setActiveDeviceId(id) { gameState.activeDeviceId = id; }
export function setIsSpotifySDKLoaded(isLoaded) { gameState.isSpotifySDKLoaded = isLoaded; }
export function setIsPlayerReady(isReady) { gameState.isPlayerReady = isReady; }
export function setCurrentGameState(state) { gameState.currentGameState = state; }
export function setCurrentRound(round) { gameState.currentRound = round; }
export function setPlayerScore(playerIndex, score) {
    if (playerIndex >= 0 && playerIndex < gameState.playerScores.length) {
        gameState.playerScores[playerIndex] = score;
    } else {
        console.error("Ungültiger Spielerindex für setPlayerScore:", playerIndex);
    }
}
export function incrementPlayerScore(playerIndex, points) {
    if (playerIndex >= 0 && playerIndex < gameState.playerScores.length) {
        gameState.playerScores[playerIndex] += points;
    } else {
        console.error("Ungültiger Spielerindex für incrementPlayerScore:", playerIndex);
    }
}
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

// Exportieren der einzelnen Zustandselemente als Konstanten für direkten LESE-Zugriff
// Dies macht den Code in anderen Modulen sauberer (z.B. `import { accessToken }` statt `import { gameState }` und dann `gameState.accessToken`)
export const {
    accessToken, player, activeDeviceId, isSpotifySDKLoaded, isPlayerReady,
    currentGameState, currentRound, playerScores, currentPlayer,
    currentPlaylistTracks, currentPlayingTrack, currentDiceRoll,
    currentSongRepetitionsLeft, currentMaxPointsForSong, currentPlayStartPosition,
    isResolvingSong, introAnimationPlayed, fullscreenRequested
} = gameState;
