// DOM Elemente
const setupContainer = document.getElementById('setup-container');
const gameContainer = document.getElementById('game-container');
const gameOverContainer = document.getElementById('game-over-container');

const genreSelect = document.getElementById('genre-select');
const modeSelect = document.getElementById('mode-select');
const startGameButton = document.getElementById('start-game-button');

const currentPlayerDisplay = document.getElementById('current-player');
const scorePlayer1Display = document.getElementById('score-player1');
const scorePlayer2Display = document.getElementById('score-player2');
const currentRoundDisplay = document.getElementById('current-round');

const audioPlayer = document.getElementById('audio-player');
const replayButton = document.getElementById('replay-button');
const replaysLeftDisplay = document.getElementById('replays-left');
const guessCorrectButton = document.getElementById('guess-correct-button');
const guessIncorrectButton = document.getElementById('guess-incorrect-button');

const songRevealArea = document.getElementById('song-reveal-area');
const songTitleDisplay = document.getElementById('song-title');
const songArtistDisplay = document.getElementById('song-artist');
const albumCoverDisplay = document.getElementById('album-cover');
const nextSongButton = document.getElementById('next-song-button');

const finalScorePlayer1Display = document.getElementById('final-score-player1');
const finalScorePlayer2Display = document.getElementById('final-score-player2');
const playAgainButton = document.getElementById('play-again-button');

// Spielstatus
let gameState = {
    currentPlayer: 1,
    scores: { 1: 0, 2: 0 },
    currentRound: 0, // Zählt Song-Paare (10 Runden = 20 Songs)
    songsPlayedThisGame: 0, // Zählt individuelle Songs
    maxRounds: 10,
    selectedGenre: '',
    selectedMode: '',
    currentTrack: null,
    replaysLeft: 5,
    maxReplays: 5,
    currentPointsForSong: 5,
    playedTrackIds: new Set() // Um Song-Wiederholungen im selben Spiel zu vermeiden
};

// --- Spielablauf Funktionen ---
async function initGame() {
    if (!accessToken || !isTokenValid()) {
        alert("Bitte zuerst mit Spotify einloggen.");
        document.getElementById('login-container').classList.remove('hidden');
        setupContainer.classList.add('hidden');
        return;
    }
    gameState.selectedGenre = genreSelect.value;
    gameState.selectedMode = modeSelect.value;

    // Zeige Ladeanzeige (optional)
    startGameButton.disabled = true;
    startGameButton.textContent = "Lade Songs...";

    const tracksLoaded = await loadTracksForGenre(gameState.selectedGenre);
    if (!tracksLoaded || allTracksForGame.length < gameState.maxRounds * 2) {
        alert(`Nicht genügend Songs für ein volles Spiel im Genre "${gameState.selectedGenre}" gefunden (mind. ${gameState.maxRounds*2} benötigt). Bitte andere Playlists in spotify.js eintragen oder ein anderes Genre wählen.`);
        startGameButton.disabled = false;
        startGameButton.textContent = "Spiel starten";
        return;
    }
    startGameButton.disabled = false;
    startGameButton.textContent = "Spiel starten";

    resetGameState();
    setupContainer.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    gameOverContainer.classList.add('hidden');
    nextTurn();
}

function resetGameState() {
    gameState.currentPlayer = 1;
    gameState.scores = { 1: 0, 2: 0 };
    gameState.currentRound = 0;
    gameState.songsPlayedThisGame = 0;
    gameState.playedTrackIds.clear();
    updateScoreDisplay();
}

function nextTurn() {
    audioPlayer.pause();
    audioPlayer.src = ''; // Wichtig, um alten Song zu entladen

    songRevealArea.classList.add('hidden');
    nextSongButton.classList.add('hidden');
    enableGuessingButtons(false); // Erst nach dem Abspielen aktivieren

    if (gameState.songsPlayedThisGame % 2 === 0) { // Nach jedem zweiten Song (also für jeden Spieler einmal)
        gameState.currentRound++;
    }

    if (gameState.currentRound > gameState.maxRounds) {
        endGame();
        return;
    }

    gameState.currentPlayer = (gameState.songsPlayedThisGame % 2) + 1;
    gameState.songsPlayedThisGame++;

    updatePlayerAndRoundDisplay();

    gameState.currentTrack = getUniqueRandomTrack();
    if (!gameState.currentTrack) {
        alert("Keine einzigartigen Songs mehr verfügbar. Spiel endet.");
        endGame();
        return;
    }
    gameState.playedTrackIds.add(gameState.currentTrack.id); // Markiere als gespielt

    console.log("Nächster Song:", gameState.currentTrack.name, "Preview:", gameState.currentTrack.preview_url);

    gameState.replaysLeft = gameState.maxReplays;
    gameState.currentPointsForSong = 5;
    replaysLeftDisplay.textContent = gameState.replaysLeft;
    replayButton.disabled = false;

    playCurrentSongSnippet();
}

function getUniqueRandomTrack() {
    if (allTracksForGame.length === gameState.playedTrackIds.size) {
        return null; // Keine einzigartigen Tracks mehr
    }
    let track;
    let attempts = 0;
    const maxAttempts = allTracksForGame.length * 2; // Sicherheitsnetz gegen Endlosschleife
    do {
        track = getRandomTrack();
        attempts++;
    } while (track && gameState.playedTrackIds.has(track.id) && attempts < maxAttempts);

    if (attempts >= maxAttempts && track && gameState.playedTrackIds.has(track.id)) {
      console.warn("Konnte nach vielen Versuchen keinen einzigartigen Track finden. Möglicherweise sind alle schon gespielt.");
      return null;
    }
    return track;
}


function playCurrentSongSnippet() {
    if (!gameState.currentTrack) return;

    const track = gameState.currentTrack;
    // Wichtig: Die Spotify API gibt meist nur 'preview_url', die 30s vom Anfang sind.
    // Echte zufällige Startpunkte + kurze Dauer sind ohne Web Playback SDK schwer.
    // Simulation für "Pro" Modus (2 Sekunden):
    if (track.preview_url) {
        audioPlayer.src = track.preview_url;
        let randomStartTime = 0; // Standardmäßig vom Anfang des Previews

        // Für "Pro" Modus: Wenn wir den vollen Song hätten (nicht nur preview_url),
        // könnten wir hier eine zufällige Startzeit innerhalb des Songs wählen.
        // Da wir meist nur preview_url (30s) haben, ist ein zufälliger Start innerhalb dieser 30s
        // und dann nur 2s abspielen eine Option. Oder einfach die ersten 2s des Previews.
        // Für die Anforderung "zufällige Stelle":
        if (gameState.selectedMode === 'pro' && track.duration_ms) { // Falls wir die volle Dauer kennen (nicht immer bei Preview)
             // duration_ms ist für den vollen Song. preview_url ist nur 30s.
             // Wir nehmen an, preview_url ist immer 30s lang.
            const maxPreviewStartTime = 30 - 2; // 2s Snippet
            randomStartTime = Math.random() * maxPreviewStartTime;
        } else if (gameState.selectedMode === 'pro') {
            // Wenn nur Preview URL, nehmen wir an 30s. Spielen 2s von zufälligem Start im Preview.
            const maxPreviewStartTime = 28; // Max start for a 2s clip in a 30s preview
            randomStartTime = Math.floor(Math.random() * maxPreviewStartTime);
        }

        audioPlayer.currentTime = randomStartTime; // Setzt die Startzeit

        // Stoppe nach 2 Sekunden für "Pro" Modus
        const playDuration = (gameState.selectedMode === 'pro') ? 2000 : 5000; // 2s für Pro, sonst 5s (Beispiel)

        audioPlayer.play().then(() => {
            console.log(`Spiele Snippet von ${track.name} ab Sekunde ${randomStartTime.toFixed(2)} für ${playDuration/1000}s.`);
            enableGuessingButtons(true); // Buttons aktivieren, sobald Musik spielt
            setTimeout(() => {
                audioPlayer.pause();
                // Man könnte hier die Buttons auch wieder deaktivieren, bis "Nochmal hören" oder geraten wird
            }, playDuration);
        }).catch(error => {
            console.error("Fehler beim Abspielen:", error);
            // Fallback oder Fehlermeldung anzeigen
            alert("Song konnte nicht abgespielt werden. Versuche nächsten Song.");
            // Hier könnte man direkt zum nächsten Song springen oder dem User eine Option geben.
            // Fürs Erste einfach die Buttons trotzdem aktivieren, damit das Spiel weitergehen kann.
            enableGuessingButtons(true);
        });

    } else {
        console.warn("Keine preview_url für Track:", track.name);
        alert("Dieser Song hat keinen verfügbaren Audio-Schnipsel. Überspringe...");
        // Hier direkt zum nächsten Song/Turn springen oder eine bessere Fehlerbehandlung.
        // Wir simulieren einen "falschen" Rateversuch, um im Fluss zu bleiben.
        handleGuess(false); // Oder eine andere Logik
    }
}


function handleReplay() {
    if (gameState.replaysLeft > 0) {
        gameState.replaysLeft--;
        if (gameState.currentPointsForSong > 1) { // Punkte können nicht unter 1 fallen (oder 0, je nach Regel)
            gameState.currentPointsForSong--;
        }
        replaysLeftDisplay.textContent = gameState.replaysLeft;
        playCurrentSongSnippet();
        if (gameState.replaysLeft === 0) {
            replayButton.disabled = true;
        }
    }
}

function handleGuess(isCorrect) {
    audioPlayer.pause();
    enableGuessingButtons(false); // Buttons deaktivieren nach dem Raten
    replayButton.disabled = true; // Auch Replay deaktivieren

    if (isCorrect) {
        gameState.scores[gameState.currentPlayer] += gameState.currentPointsForSong;
        // Hier könnte man Feedback geben "Richtig! +X Punkte"
    } else {
        // Feedback "Leider falsch" oder einfach nur Song enthüllen
    }
    updateScoreDisplay();
    revealSong();
    nextSongButton.classList.remove('hidden'); // Button für nächsten Song anzeigen
}

function revealSong() {
    if (gameState.currentTrack) {
        songTitleDisplay.textContent = gameState.currentTrack.name;
        songArtistDisplay.textContent = gameState.currentTrack.artists.map(a => a.name).join(', ');
        albumCoverDisplay.src = gameState.currentTrack.album.images.length > 0 ? gameState.currentTrack.album.images[0].url : 'placeholder.png'; // Placeholder falls kein Bild
        songRevealArea.classList.remove('hidden');
    }
}

function updateScoreDisplay() {
    scorePlayer1Display.textContent = gameState.scores[1];
    scorePlayer2Display.textContent = gameState.scores[2];
}

function updatePlayerAndRoundDisplay() {
    currentPlayerDisplay.textContent = gameState.currentPlayer;
    currentRoundDisplay.textContent = gameState.currentRound > gameState.maxRounds ? gameState.maxRounds : gameState.currentRound;
}

function enableGuessingButtons(enable) {
    guessCorrectButton.disabled = !enable;
    guessIncorrectButton.disabled = !enable;
    // Replay Button nur aktivieren, wenn noch replays da sind und Buttons aktiv sind
    replayButton.disabled = !(enable && gameState.replaysLeft > 0);
}


function endGame() {
    gameContainer.classList.add('hidden');
    gameOverContainer.classList.remove('hidden');
    finalScorePlayer1Display.textContent = gameState.scores[1];
    finalScorePlayer2Display.textContent = gameState.scores[2];
    console.log("Spiel beendet. Endstand:", gameState.scores);
}

// Event Listener
startGameButton.addEventListener('click', initGame);
replayButton.addEventListener('click', handleReplay);
guessCorrectButton.addEventListener('click', () => handleGuess(true));
guessIncorrectButton.addEventListener('click', () => handleGuess(false));
nextSongButton.addEventListener('click', nextTurn);
playAgainButton.addEventListener('click', () => {
    // Zurück zum Setup, Token sollte noch gültig sein
    gameOverContainer.classList.add('hidden');
    setupContainer.classList.remove('hidden');
    // Wichtig: allTracksForGame nicht leeren, wenn Genre gleich bleibt
    // gameState wird in initGame() zurückgesetzt
});

// Initiale UI Anpassung (wird von auth.js überschrieben, wenn Token da ist)
document.addEventListener('DOMContentLoaded', () => {
    if (!accessToken || !isTokenValid()) {
        document.getElementById('login-container').classList.remove('hidden');
        setupContainer.classList.add('hidden');
    } else {
        document.getElementById('login-container').classList.add('hidden');
        setupContainer.classList.remove('hidden');
    }
    gameContainer.classList.add('hidden');
    gameOverContainer.classList.add('hidden');
});

