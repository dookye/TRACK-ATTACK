// TOP LEVEL DOM-ELEMENTE
const appContainer = document.getElementById('app-container');
const loginScreen = document.getElementById('login-screen');
const fullscreenScreen = document.getElementById('fullscreen-screen');
const gameScreen = document.getElementById('game-screen');
const scoreScreen = document.getElementById('score-screen');
const rotateDeviceOverlay = document.getElementById('rotate-device-overlay');

// Login Screen Elemente
const loginButton = document.getElementById('login-button');
const loginLogo = document.getElementById('login-logo'); // Für die Einblendanimation

// Game Screen Elemente
const logoButton = document.getElementById('logo-button'); // Das mittige Logo
const diceContainer = document.getElementById('dice-container');
const wRandomButton = document.getElementById('w-random-button'); // Der W-Random Button
const diceAnimation = document.getElementById('dice-animation');
const diceSelection = document.getElementById('dice-selection');
const diceOptions = document.querySelectorAll('.dice-option'); // Das sind jetzt nur noch die Würfel 1-7 (ohne W-Random)
const diceValueDisplay = document.getElementById('dice-value-display'); // Für die Anzeige des W-Random Werts

const genreContainer = document.getElementById('genre-container');
const genreButtons = document.querySelectorAll('.genre-button');

const revealButton = document.getElementById('reveal-button');
const revealContainer = document.getElementById('reveal-container');
const albumCover = document.getElementById('album-cover');
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const correctButton = document.getElementById('correct-button');
const wrongButton = document.getElementById('wrong-button');

const countdownDisplay = document.getElementById('countdown-display');
const speedRoundTextDisplay = document.getElementById('speed-round-text-display');

// Score Screen Elemente
const player1ScoreDisplay = document.getElementById('player1-score-display');
const player2ScoreDisplay = document.getElementById('player2-score-display');

// SPIELZUSTAND
let currentPlayer = 1;
let player1Score = 0;
let player2Score = 0;
let currentTrack = null;
let currentPlaybackInterval = null;
let currentArtistId = null;
let playedTracks = new Set(); // Speichert IDs der bereits gespielten Tracks
let isSpeedRound = false;
let speedRoundCountdown = null; // Variable für den Countdown-Timer
let countdownValue = 3; // Startwert für den Countdown
let isAnimatingScore = false; // Flag, um Mehrfach-Animationen zu verhindern
let isRollingDice = false; // Verhindert Klicks während des Würfelns/W-Random
let diceSelected = false; // Verhindert doppelte Würfelwahl nach W-Random

// SPIEL-KONSTANTEN
const genrePlaylists = {
    pop: '37i9dQZF1DXcBWIGoYBM5M', // Pop Hits 2000-2025
    alltime: '37i9dQZF1DXcBWIGoYBM5M', // Die größten Hits aller Zeiten
    deutsch: '37i9dQZF1DXcBWIGoYBM5M', // deutsche Größen von früher bis heute
    party: '37i9dQZF1DXcBWIGoYBM5M', // Partyhits
    // Füge hier weitere Playlist-IDs hinzu, wenn du sie brauchst und sie in Spotify vorhanden sind
};

const popInDuration = 1000; // Dauer der Punkte-Einblendanimation in ms (1 Sekunde)
const flyAnimationDuration = 400; // Dauer der Punkte-Wegfliegen-Animation in ms (0.4 Sekunden)
const diceValueDisplayDuration = 200; // Dauer, für die jede Zahl beim W-Random angezeigt wird (in ms)
const wRandomRolls = 15; // Anzahl der Zufallszahlen, die vor der finalen W-Random-Zahl angezeigt werden

// HILFSFUNKTIONEN
const delay = ms => new Promise(res => setTimeout(res, ms));

function hideElement(element) {
    element.classList.add('hidden');
}

function showElement(element) {
    element.classList.remove('hidden');
}

function updatePlayerScoreDisplay() {
    player1ScoreDisplay.textContent = player1Score;
    player2ScoreDisplay.textContent = player2ToDisplay();
}

// Ersetzt -1 durch 0 für die Anzeige von Player 2 im Speed Round Modus, da -1 bedeutet,
// dass dieser Spieler im Speed Round noch nicht dran war.
function player2ToDisplay() {
    return isSpeedRound && player2Score === -1 ? 0 : player2Score;
}

// Deaktiviert/Aktiviert die Interaktion mit den Würfeln und dem W-Random Button
function setDiceInteraction(active) {
    if (active) {
        diceOptions.forEach(dice => dice.classList.remove('disabled-visual'));
        wRandomButton.classList.remove('disabled-visual');
        isRollingDice = false; // Erlaubt Klicks wieder
    } else {
        diceOptions.forEach(dice => dice.classList.add('disabled-visual'));
        wRandomButton.classList.add('disabled-visual');
        isRollingDice = true; // Verhindert Klicks
    }
}

// Deaktiviert/Aktiviert die Interaktion mit den Genre-Buttons
function setGenreInteraction(active) {
    if (active) {
        genreButtons.forEach(button => {
            button.classList.remove('no-interaction');
            button.removeAttribute('disabled'); // Stellt sicher, dass sie nicht disabled sind
        });
    } else {
        genreButtons.forEach(button => {
            button.classList.add('no-interaction');
            button.setAttribute('disabled', 'true'); // Deaktiviert den Button
        });
    }
}

// START DES SPIELS / INITIALISIERUNG
document.addEventListener('DOMContentLoaded', () => {
    checkOrientation(); // Überprüfe die Ausrichtung beim Laden
    window.addEventListener('orientationchange', checkOrientation);
    window.addEventListener('resize', checkOrientation); // Auch bei Größenänderung prüfen
});

function checkOrientation() {
    if (window.innerHeight > window.innerWidth) {
        // Hochformat
        showElement(rotateDeviceOverlay);
        hideElement(appContainer);
    } else {
        // Querformat
        hideElement(rotateDeviceOverlay);
        showElement(appContainer);
        // Stelle sicher, dass der Login-Screen sichtbar ist, wenn keine Session aktiv ist
        if (!getAccessToken()) {
            showElement(loginScreen);
        } else {
            // Wenn bereits eingeloggt, zeige direkt den Fullscreen-Screen oder Game-Screen
            // (je nachdem, wo das Spiel starten soll nach dem Login)
            showElement(fullscreenScreen);
            hideElement(loginScreen);
        }
    }
}

// --- LOGIN-SCREEN LOGIK ---
loginButton.addEventListener('click', () => {
    redirectToSpotifyAuth();
});

// Fullscreen-Screen: Klick zum Starten des Spiels
fullscreenScreen.addEventListener('click', () => {
    document.documentElement.requestFullscreen().then(() => {
        hideElement(fullscreenScreen);
        startGame();
    }).catch(err => {
        console.error("Fullscreen request failed:", err);
        // Fallback: Wenn Fullscreen nicht erlaubt/möglich ist, starte das Spiel trotzdem
        hideElement(fullscreenScreen);
        startGame();
    });
});

// Handle the Spotify redirect
window.addEventListener('load', () => {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = params.get('access_token');
    const expiresIn = params.get('expires_in');

    if (accessToken && expiresIn) {
        localStorage.setItem('spotify_access_token', accessToken);
        localStorage.setItem('spotify_token_expires_in', Date.now() + expiresIn * 1000);
        window.history.pushState({}, document.title, window.location.pathname); // Clean up URL
        // If logged in, go to fullscreen screen first or directly to game
        hideElement(loginScreen);
        showElement(fullscreenScreen); // Zeige den Fullscreen Screen nach erfolgreichem Login
    } else if (!getAccessToken()) {
        showElement(loginScreen); // Zeige Login, wenn kein Token vorhanden ist
    }
});

function redirectToSpotifyAuth() {
    const clientId = '53257f6a1c144d3f929a60d691a0c6f6'; // !!!!!!!!!!! ERSETZE DURCH DEINE CLIENT ID !!!!!!!!!!!
    const redirectUri = "https://dookye.github.io/TRACK-ATTACK/";
    const scopes = 'user-read-private user-read-email user-modify-playback-state user-read-playback-state user-read-currently-playing streaming';
    window.location = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}&scope=${scopes}&show_dialog=true`;
}

function getAccessToken() {
    const token = localStorage.getItem('spotify_access_token');
    const expiry = localStorage.getItem('spotify_token_expires_in');
    if (token && expiry && Date.now() < expiry) {
        return token;
    }
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expires_in');
    return null;
}

// --- SPIELLOGIK ---
async function startGame() {
    hideElement(loginScreen);
    hideElement(fullscreenScreen);
    showElement(gameScreen);

    // Initialisiere Player Scores
    player1Score = 0;
    player2Score = 0;
    updatePlayerScoreDisplay(); // Setzt die Anzeige auf 0:0

    await showLogoAndStartDicePhase();
}

async function showLogoAndStartDicePhase() {
    showElement(logoButton);
    logoButton.classList.add('initial-fly-in');
    setDiceInteraction(false); // Würfel und W-Random Button zunächst deaktivieren

    // Warte, bis die Animation des Logos abgeschlossen ist (1. Phase)
    // Die Animation ist 0.6s fly-in + 0.3s bounce-end = 0.9s
    await delay(900);

    // Entferne die Animationsklassen, um beim nächsten Mal korrekt zu starten
    logoButton.classList.remove('initial-fly-in', 'bounce', 'bounce-end');

    // Mache das Logo interaktiv (kann angeklickt werden)
    logoButton.classList.remove('inactive');

    // Blende das Logo nach einer Weile aus und zeige die Würfel
    await delay(1500); // Warte 1.5 Sekunden, bevor das Logo ausgeblendet wird
    hideElement(logoButton);
    logoButton.classList.add('inactive'); // Deaktiviere das Logo wieder

    startDicePhase();
}

async function startDicePhase() {
    // Verstecke alle Elemente, die nicht zur Würfelphase gehören
    hideElement(genreContainer);
    hideElement(revealContainer);
    hideElement(revealButton);
    hideElement(countdownDisplay);
    hideElement(speedRoundTextDisplay);
    hideElement(diceAnimation);
    hideElement(diceValueDisplay);

    // Zeige den Würfel-Container und die Würfel-Auswahl
    showElement(diceContainer);
    showElement(diceSelection);

    // Aktiviere die Würfel für den aktuellen Spieler
    setDiceInteraction(true);
    diceSelected = false; // Setze den Flag zurück
    currentPlayer = 1; // Sicherstellen, dass Spieler 1 beginnt
    setPlayerBackground(); // Aktualisiere den Hintergrund
}

// Hintergrundfarbe basierend auf dem aktuellen Spieler setzen
function setPlayerBackground() {
    if (currentPlayer === 1) {
        appContainer.style.backgroundColor = 'var(--player1-color)';
    } else {
        appContainer.style.backgroundColor = 'var(--player2-color)';
    }
}

// --- WÜRFEL LOGIK ---

// Event Listener für die "normalen" Würfel (1-7)
diceOptions.forEach(dice => {
    dice.addEventListener('click', async () => {
        if (isRollingDice || diceSelected) return; // Verhindert Klicks während Animation oder wenn bereits gewählt

        setDiceInteraction(false); // Alle Würfel sofort deaktivieren
        diceSelected = true; // Markiert, dass ein Würfel gewählt wurde

        const selectedValue = parseInt(dice.dataset.value);
        await selectDice(selectedValue);
    });
});

// Event Listener für den W-Random Button
wRandomButton.addEventListener('click', async () => {
    if (isRollingDice || diceSelected) return; // Verhindert Klicks während Animation oder wenn bereits gewählt

    setDiceInteraction(false); // Alle Würfel (und der W-Random Button selbst) sofort deaktivieren
    diceSelected = true; // Markiert, dass ein Würfel gewählt wurde

    await handleWRandomClick();
});


async function selectDice(value) {
    hideElement(diceSelection);
    showElement(diceAnimation);
    // Hier kannst du eine Würfel-Roll-Animation abspielen, falls vorhanden
    await delay(1000); // Simuliere Würfel-Roll-Dauer

    hideElement(diceAnimation);

    // Finde den gewählten Würfel im DOM und hebe ihn kurz hervor
    const selectedDiceElement = document.querySelector(`.dice-option[data-value="${value}"]`);
    if (selectedDiceElement) {
        selectedDiceElement.classList.add('selected-dice-highlight');
        await delay(1500); // Dauer der finalDiceHighlight Animation
        selectedDiceElement.classList.remove('selected-dice-highlight');
    }

    // Setze Hintergrundfarbe für Spieler 1 oder 2
    setPlayerBackground();

    // W-Random-Button muss hier nicht gesondert behandelt werden, da er schon deaktiviert ist.
    // Wenn 7 gewürfelt wurde, startet die Speed-Round
    if (value === 7) {
        isSpeedRound = true;
        player2Score = -1; // Setzt Spieler 2 auf "nicht am Zug" im Speed-Round-Modus
        updatePlayerScoreDisplay(); // Aktualisiert die Anzeige auf 0 für Spieler 2
        await startSpeedRound();
    } else {
        isSpeedRound = false;
        player2Score = 0; // Setzt Spieler 2 zurück auf 0, falls Speed Round beendet
        updatePlayerScoreDisplay(); // Aktualisiert die Anzeige

        // Zeige Genre-Buttons an
        showElement(genreContainer);
        setGenreInteraction(true); // Aktiviere Genre-Buttons
    }
}

async function handleWRandomClick() {
    hideElement(diceSelection); // Verstecke die Würfelauswahl
    showElement(diceAnimation); // Zeige die Würfel-Animation

    // Animation der Zahlen auf dice-value-display
    for (let i = 0; i < wRandomRolls; i++) {
        const tempValue = Math.floor(Math.random() * 6) + 1; // Zufallszahl von 1 bis 6
        diceValueDisplay.textContent = tempValue;
        diceValueDisplay.style.opacity = '1';
        diceValueDisplay.style.transform = 'translate(-50%, -50%) scale(1.2)';
        showElement(diceValueDisplay);

        // Blinken eines Genre-Buttons, wenn eine 6 gewürfelt wird
        if (tempValue === 6) {
            const randomIndex = Math.floor(Math.random() * genreButtons.length);
            const randomGenreButton = genreButtons[randomIndex];
            randomGenreButton.classList.add('random-blink');
            await delay(diceValueDisplayDuration / 2); // Kurze Verzögerung für den Blink-Effekt
            randomGenreButton.classList.remove('random-blink');
        }
        await delay(diceValueDisplayDuration);
        diceValueDisplay.style.opacity = '0'; // Ausblenden der Zahl
        diceValueDisplay.style.transform = 'translate(-50%, -50%) scale(0.8)';
    }

    // Bestimme den finalen W-Random Wert (Zufallszahl zwischen 1 und 5, oder 7)
    const wRandomValues = [1, 2, 3, 4, 5, 7];
    const finalWRandomValue = wRandomValues[Math.floor(Math.random() * wRandomValues.length)];

    // Zeige den finalen Wert an
    diceValueDisplay.textContent = finalWRandomValue;
    diceValueDisplay.style.opacity = '1';
    diceValueDisplay.style.transform = 'translate(-50%, -50%) scale(1.5)'; // Etwas größerer Pop-Effekt für den Endwert
    await delay(1000); // Längere Anzeige des Endwerts
    hideElement(diceValueDisplay); // Blende den Endwert aus

    hideElement(diceAnimation); // Blende die Würfel-Animation aus

    // Finde den entsprechenden Würfel für das Highlight
    const selectedDiceElement = document.querySelector(`.dice-option[data-value="${finalWRandomValue}"]`);
    if (selectedDiceElement) {
        selectedDiceElement.classList.add('selected-dice-highlight');
        await delay(1500); // Dauer der finalDiceHighlight Animation
        selectedDiceElement.classList.remove('selected-dice-highlight');
    }

    // Setze Hintergrundfarbe
    setPlayerBackground();

    // Starte entweder Speed-Round oder Genre-Phase
    if (finalWRandomValue === 7) {
        isSpeedRound = true;
        player2Score = -1;
        updatePlayerScoreDisplay();
        await startSpeedRound();
    } else {
        isSpeedRound = false;
        player2Score = 0;
        updatePlayerScoreDisplay();
        showElement(genreContainer);
        setGenreInteraction(true);
    }
    diceSelected = false; // Setze den Flag zurück, um das nächste Würfeln zu ermöglichen
}


// --- GENRE-AUSWAHL LOGIK ---
genreButtons.forEach(button => {
    button.addEventListener('click', async () => {
        if (isAnimatingScore) return; // Verhindert Klicks während Punkte-Animation
        setGenreInteraction(false); // Deaktiviere Genre-Buttons während der Auswahl
        hideElement(genreContainer); // Verstecke Genre-Buttons

        const genre = button.dataset.genre;
        await playRandomTrack(genre);
    });
});

// --- TRACK LOGIK ---
async function playRandomTrack(genre) {
    const accessToken = getAccessToken();
    if (!accessToken) {
        alert('Nicht bei Spotify angemeldet oder Token abgelaufen.');
        redirectToSpotifyAuth();
        return;
    }

    const playlistId = genrePlaylists[genre];
    if (!playlistId) {
        alert('Genre-Playlist nicht gefunden!');
        setGenreInteraction(true); // Reaktivieren bei Fehler
        showElement(genreContainer); // Zeige Genre-Buttons wieder
        return;
    }

    try {
        // Shuffle-Wartezeit, um doppelte Wiedergabe zu verhindern
        await delay(500); // Kleine Verzögerung, um Wiedergabestatus zu aktualisieren

        const tracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!tracksResponse.ok) throw new Error(`Spotify API error: ${tracksResponse.statusText}`);
        const tracksData = await tracksResponse.json();
        const tracks = tracksData.items
            .filter(item => item.track && item.track.preview_url && !playedTracks.has(item.track.id))
            .map(item => item.track);

        if (tracks.length === 0) {
            alert('Keine neuen Tracks in dieser Playlist mit Vorschau-URL verfügbar!');
            // Optional: playedTracks zurücksetzen oder andere Playlist wählen
            playedTracks.clear(); // Set zurücksetzen, um von vorne zu beginnen
            // Dann erneut versuchen oder zum Genre-Screen zurückkehren
            showElement(genreContainer);
            setGenreInteraction(true);
            return;
        }

        currentTrack = tracks[Math.floor(Math.random() * tracks.length)];
        playedTracks.add(currentTrack.id); // Track als gespielt markieren

        // Lade den Track auf das aktive Gerät
        await fetch(`https://api.spotify.com/v1/me/player/play`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: [currentTrack.uri],
                position_ms: 0 // Startet den Track von Anfang an
            })
        });

        // Warten, bis der Track wirklich spielt, bevor der Countdown beginnt
        // (Spotify API kann etwas langsam sein)
        await delay(500); // Gib Spotify etwas Zeit zum Starten
        const playbackState = await fetch(`https://api.spotify.com/v1/me/player/currently-playing`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const playbackData = await playbackState.json();
        if (!playbackData || !playbackData.is_playing || playbackData.item.id !== currentTrack.id) {
            // Wenn der Track nicht spielt oder es der falsche Track ist, warte länger oder versuche erneut
            console.warn("Track did not start playing immediately, waiting longer...");
            await delay(1000); // Längere Wartezeit
        }

        currentArtistId = currentTrack.artists[0].id;
        showElement(revealButton); // Zeige den Auflösen-Button an
        // Der Countdown wird nur in der Speed-Round gestartet
        if (isSpeedRound) {
            startCountdown();
        }

    } catch (error) {
        console.error('Error playing track:', error);
        alert('Fehler beim Abspielen des Tracks. Bitte versuchen Sie es erneut oder prüfen Sie Ihre Spotify-Anmeldung.');
        // Setze den Zustand zurück, damit der Spieler neu wählen kann
        setGenreInteraction(true);
        showElement(genreContainer);
    }
}

async function startCountdown() {
    countdownValue = 3; // Reset für jeden Countdown
    showElement(countdownDisplay);
    hideElement(speedRoundTextDisplay); // Verstecke SPEED-ROUND Text während des Countdowns

    function updateCountdown() {
        countdownDisplay.textContent = countdownValue;
        countdownDisplay.classList.add('countdown-animated');
        setTimeout(() => countdownDisplay.classList.remove('countdown-animated'), 900); // Animation ist 1s
    }

    updateCountdown();
    countdownValue--;

    speedRoundCountdown = setInterval(() => {
        if (countdownValue >= 0) {
            updateCountdown();
            countdownValue--;
        } else {
            clearInterval(speedRoundCountdown);
            speedRoundCountdown = null;
            hideElement(countdownDisplay);
            // Wenn der Countdown abgelaufen ist, und der Spieler noch nicht geantwortet hat
            if (revealButton.classList.contains('hidden') === false) { // Wenn Reveal Button noch aktiv ist
                handleWrongAnswer(false); // Automatisch als falsch werten
            }
        }
    }, 1000);
}


// --- AUFLÖSEN & FEEDBACK LOGIK ---
revealButton.addEventListener('click', async () => {
    if (currentTrack) {
        // Stoppe die Musik
        await stopPlayback();
        hideElement(revealButton); // Verstecke den Auflösen-Button
        hideElement(countdownDisplay); // Verstecke Countdown, falls er noch läuft
        if (speedRoundCountdown) {
            clearInterval(speedRoundCountdown);
            speedRoundCountdown = null;
        }

        // Zeige Track-Info und Feedback-Buttons
        albumCover.src = currentTrack.album.images[0].url;
        trackTitle.textContent = currentTrack.name;
        trackArtist.textContent = currentTrack.artists.map(artist => artist.name).join(', ');
        showElement(revealContainer);
    }
});

correctButton.addEventListener('click', () => handleCorrectAnswer());
wrongButton.addEventListener('click', () => handleWrongAnswer(true)); // Parameter true bedeutet "manuell falsch"

async function stopPlayback() {
    const accessToken = getAccessToken();
    if (!accessToken) return;

    try {
        await fetch(`https://api.spotify.com/v1/me/player/pause`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (currentPlaybackInterval) {
            clearInterval(currentPlaybackInterval);
            currentPlaybackInterval = null;
        }
    } catch (error) {
        console.error('Error pausing playback:', error);
    }
}

async function handleCorrectAnswer() {
    if (isAnimatingScore) return;
    isAnimatingScore = true;
    hideElement(revealContainer);

    let points = isSpeedRound ? 2 : 1; // 2 Punkte in Speed Round, sonst 1

    let pointsDisplay = document.createElement('div');
    pointsDisplay.textContent = `+${points}`;
    pointsDisplay.style.position = 'absolute';
    pointsDisplay.style.zIndex = '2000'; // Über allem anderen
    pointsDisplay.style.color = 'white';
    pointsDisplay.style.fontSize = '8em'; // Große Schrift
    pointsDisplay.style.fontWeight = 'bold';
    pointsDisplay.style.textShadow = '0 0 20px rgba(255,255,255,0.7)';
    pointsDisplay.classList.add('points-pop-in'); // Animation Klasse

    // Positionierung in der Mitte des Bildschirms
    pointsDisplay.style.top = '50%';
    pointsDisplay.style.left = '50%';
    pointsDisplay.style.transform = 'translate(-50%, -50%)';

    gameScreen.appendChild(pointsDisplay);

    await delay(popInDuration); // Warte, bis die Einblendanimation abgeschlossen ist

    // Aktualisiere den Score des aktuellen Spielers
    if (currentPlayer === 1) {
        player1Score += points;
        pointsDisplay.classList.remove('points-pop-in');
        pointsDisplay.classList.add('fly-to-corner-player1');
    } else {
        player2Score += points;
        pointsDisplay.classList.remove('points-pop-in');
        pointsDisplay.classList.add('fly-to-corner-player2');
    }

    await delay(flyAnimationDuration); // Warte, bis die Wegfliegen-Animation abgeschlossen ist

    updatePlayerScoreDisplay(); // Aktualisiere die Anzeige, nachdem die Punkte "angekommen" sind

    // Entferne das Punkte-Display nach der Animation
    if (pointsDisplay.parentNode) {
        pointsDisplay.parentNode.removeChild(pointsDisplay);
    }

    isAnimatingScore = false;
    await nextTurn();
}

async function handleWrongAnswer(manual = true) {
    if (isAnimatingScore) return;
    isAnimatingScore = true;
    hideElement(revealContainer);

    let pointsDisplay = document.createElement('div');
    pointsDisplay.textContent = `-0`;
    pointsDisplay.style.position = 'absolute';
    pointsDisplay.style.zIndex = '2000';
    pointsDisplay.style.color = 'red'; // Rot für "falsch"
    pointsDisplay.style.fontSize = '8em';
    pointsDisplay.style.fontWeight = 'bold';
    pointsDisplay.style.textShadow = '0 0 20px rgba(255,0,0,0.7)';
    pointsDisplay.classList.add('points-pop-in');

    pointsDisplay.style.top = '50%';
    pointsDisplay.style.left = '50%';
    pointsDisplay.style.transform = 'translate(-50%, -50%)';

    gameScreen.appendChild(pointsDisplay);

    await delay(popInDuration);

    // Die Punkte fliegen zum aktuellen Spieler, obwohl es 0 Punkte sind, um den Übergang zu zeigen
    if (currentPlayer === 1) {
        pointsDisplay.classList.remove('points-pop-in');
        pointsDisplay.classList.add('fly-to-corner-player1');
    } else {
        pointsDisplay.classList.remove('points-pop-in');
        pointsDisplay.classList.add('fly-to-corner-player2');
    }

    await delay(flyAnimationDuration);
    updatePlayerScoreDisplay();

    if (pointsDisplay.parentNode) {
        pointsDisplay.parentNode.removeChild(pointsDisplay);
    }

    isAnimatingScore = false;
    await nextTurn();
}

// --- ZUGWECHSEL & RUNDENENDE ---
async function nextTurn() {
    // Wenn Speed-Round aktiv ist und Spieler 2 noch nicht an der Reihe war
    if (isSpeedRound && currentPlayer === 1 && player2Score === -1) {
        currentPlayer = 2; // Spieler 2 ist an der Reihe für die Speed-Round
        setPlayerBackground();
        await startSpeedRound(); // Starte die Speed-Round erneut für Spieler 2
        return;
    }

    // Wechsel zum nächsten Spieler
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    setPlayerBackground();

    // Wenn Speed-Round beendet ist (nachdem beide Spieler dran waren oder nicht gewürfelt wurde)
    if (isSpeedRound && currentPlayer === 1) { // Speed-Round ist vorbei, wenn Spieler 1 wieder dran ist
        isSpeedRound = false;
        player2Score = 0; // Setze Spieler 2 Score zurück
        updatePlayerScoreDisplay();
        await delay(1000); // Kurze Pause nach Speed-Round
    }

    // Starte neue Würfelphase
    await startDicePhase();
}

// --- SPEED-ROUND LOGIK ---
async function startSpeedRound() {
    hideElement(diceContainer); // Verstecke Würfel
    hideElement(genreContainer); // Verstecke Genre-Buttons
    hideElement(revealButton); // Verstecke Auflösen-Button

    // Zeige SPEED-ROUND Text
    showElement(speedRoundTextDisplay);
    speedRoundTextDisplay.classList.remove('hidden'); // Stellen sicher, dass es sichtbar ist
    speedRoundTextDisplay.classList.add('zoom-fade-in'); // Füge Animation hinzu

    await delay(4000); // Warte auf die Dauer der zoom-fade-in Animation (4s)

    speedRoundTextDisplay.classList.remove('zoom-fade-in');
    hideElement(speedRoundTextDisplay); // Verstecke den Text nach der Animation

    // Starte die Genre-Auswahl für die Speed-Round
    showElement(genreContainer);
    setGenreInteraction(true);
}

// --- ZUSÄTZLICHE EVENT LISTENER (falls nicht schon integriert) ---
// Beispiel: Zurücksetzen des Spiels, wenn das Logo nach dem Spielende geklickt wird
logoButton.addEventListener('click', async () => {
    if (logoButton.classList.contains('inactive')) { // Nur wenn das Spiel im Endzustand ist
        // Hier könntest du eine Logik einfügen, um zum Startbildschirm zurückzukehren
        // oder das Spiel komplett neu zu starten.
        // Aktuell ist es so, dass das Logo am Startbildschirm sichtbar wird
        // und dann die Würfelphase beginnt.
        // Wenn du es als "Restart"-Button nach einem vollständigen Spielende nutzen willst:
        // window.location.reload(); // Zum kompletten Neuladen
        // Oder eine eigene resetGame() Funktion, die alle Variablen zurücksetzt
        resetGame(); // Ruft die resetGame Funktion auf
        showElement(logoButton); // Zeigt das Logo
        logoButton.classList.add('initial-fly-in'); // Startet die Animation
        await delay(900); // Warte auf Animation
        logoButton.classList.remove('initial-fly-in');
        hideElement(logoButton);
        startDicePhase();
    }
});

function resetGame() {
    // Setze alle Spielzustände zurück
    currentPlayer = 1;
    player1Score = 0;
    player2Score = 0;
    currentTrack = null;
    if (currentPlaybackInterval) {
        clearInterval(currentPlaybackInterval);
        currentPlaybackInterval = null;
    }
    currentArtistId = null;
    playedTracks.clear();
    isSpeedRound = false;
    if (speedRoundCountdown) {
        clearInterval(speedRoundCountdown);
        speedRoundCountdown = null;
    }
    countdownValue = 3;
    isAnimatingScore = false;
    isRollingDice = false;
    diceSelected = false;

    // Setze DOM-Elemente zurück
    updatePlayerScoreDisplay();
    hideElement(gameScreen);
    hideElement(scoreScreen);
    hideElement(diceContainer);
    hideElement(genreContainer);
    hideElement(revealContainer);
    hideElement(revealButton);
    hideElement(countdownDisplay);
    hideElement(speedRoundTextDisplay);
    hideElement(diceAnimation);
    hideElement(diceValueDisplay);
    hideElement(logoButton); // Verstecke das Logo initial

    setDiceInteraction(true); // Alle Würfel aktivieren
    setGenreInteraction(true); // Alle Genre-Buttons aktivieren
    showElement(loginScreen); // Zurück zum Login-Screen
    // Oder, wenn du direkt ins Spiel willst:
    // startGame();
}
