// --- Globale Variablen ---
const CLIENT_ID = 'DEINE_CLIENT_ID'; // Spotify Client ID - HIER ERSETZEN!
const REDIRECT_URI = 'http://localhost:5500/'; // Deine Redirect URI - HIER ERSETZEN!
const SCOPES = ['user-read-private', 'user-read-email', 'user-modify-playback-state', 'user-read-playback-state', 'user-read-currently-playing'];
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const API_BASE_URL = 'https://api.spotify.com/v1';

let accessToken = '';
let currentDeviceId = '';
let player; // Spotify Web Playback SDK Player
let currentVolume = 0.5; // Startlautstärke

let currentPlayer = 1; // Startet mit Spieler 1
let player1Score = 0;
let player2Score = 0;

let currentTrack = null; // Speichert den aktuell gespielten Track
let currentCategory = ''; // Speichert die aktuelle Würfelkategorie (z.B. 'artist', 'song')
let currentDifficulty = ''; // Speichert die aktuelle Schwierigkeit (z.B. 'easy', 'medium', 'hard')
let currentGuessDuration = 0; // Speichert die Dauer, die gewürfelt wurde (in Sekunden)


// --- DOM-Elemente ---
const loginArea = document.getElementById('login-area');
const spotifyLoginButton = document.getElementById('spotify-login-button');
const playbackStatus = document.getElementById('playback-status');
const logoContainer = document.getElementById('logo-container');
const gameLogo = document.getElementById('game-logo');
const initialClickBlocker = document.getElementById('initial-click-blocker');
const orientationMessage = document.getElementById('orientation-message');
const fullscreenMessage = document.getElementById('fullscreen-message');

const scoreDisplay = document.getElementById('score-display');
const player1ScoreSpan = document.getElementById('player1-score');
const player2ScoreSpan = document.getElementById('player2-score');

const diceContainer = document.getElementById('dice-container');
const diceAnimation = document.getElementById('dice-animation');
const diceButtons = document.getElementById('dice-buttons');
const diceButtonsImgs = document.querySelectorAll('.dice-button');

const resolutionContainer = document.getElementById('resolution-container');
const songInfoDisplay = document.getElementById('song-info-display');
const correctButton = document.getElementById('correct-button');
const wrongButton = document.getElementById('wrong-button');


// --- Event Listener ---
spotifyLoginButton.addEventListener('click', handleSpotifyLogin);
// Der initialClickBlocker hat jetzt eine zentrale Rolle
initialClickBlocker.addEventListener('click', handleInitialClick);
correctButton.addEventListener('click', () => handleGuess(true));
wrongButton.addEventListener('click', () => handleGuess(false));

diceButtonsImgs.forEach(button => {
    button.addEventListener('click', handleDiceSelection);
});

// Vollbild und Orientierung prüfen bei Resize und Orientierungsänderung
window.addEventListener('resize', checkDisplayRequirements);
window.addEventListener('orientationchange', checkDisplayRequirements);


// --- Initialisierungsfunktionen ---

// 1. Seite laden -> Token prüfen und Blocker initialisieren
document.addEventListener('DOMContentLoaded', () => {
    // Stellen Sie sicher, dass der initialClickBlocker sichtbar ist
    initialClickBlocker.classList.remove('hidden');
    // Die Anzeigeanforderungen prüfen (Querformat, Vollbild)
    // Wenn nicht erfüllt, bleiben die Nachrichten und der Blocker sichtbar.
    // Wenn erfüllt, wird nur der Blocker sichtbar, der dann auf einen Klick wartet.
    checkDisplayRequirements();

    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    accessToken = urlParams.get('access_token');

    if (accessToken) {
        console.log('Access Token erhalten:', accessToken);
        history.replaceState(null, '', REDIRECT_URI); // URL aufräumen
        playbackStatus.textContent = 'Bereit zum Starten des Spiels. Bitte klicken Sie.';
        // Hier laden wir das SDK noch NICHT, sondern erst nach dem Initial Click,
        // um sicherzustellen, dass der AudioContext direkt aktiviert werden kann.
    } else {
        playbackStatus.textContent = 'Bitte melden Sie sich bei Spotify an, um zu beginnen.';
        loginArea.classList.remove('hidden'); // Login-Bereich anzeigen, wenn kein Token
    }
});

// --- Handler für den initialen Klick ---
// Dieser Klick ist entscheidend, um den AudioContext zu aktivieren und das Spiel zu starten.
function handleInitialClick() {
    console.log("Initial click detected.");

    // Prüfen, ob die Anforderungen (Querformat, Vollbild) erfüllt sind
    const isLandscape = window.innerWidth > window.innerHeight;
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

    if (!isLandscape) {
        // Wenn nicht im Querformat, nur Orientierungsnachricht anzeigen
        orientationMessage.classList.remove('hidden');
        fullscreenMessage.classList.add('hidden'); // Andere Nachrichten ausblenden
        return; // Den Blocker nicht ausblenden
    }

    if (!isFullscreen) {
        // Wenn nicht im Vollbild, Vollbild anfordern
        requestFullscreen();
        // Nachricht anzeigen und Blocker nicht ausblenden, bis Vollbild aktiv ist
        fullscreenMessage.classList.remove('hidden');
        orientationMessage.classList.add('hidden'); // Andere Nachrichten ausblenden
        return; // Den Blocker nicht ausblenden
    }

    // Wenn alle Bedingungen erfüllt sind (Querformat UND Vollbild UND Klick):
    initialClickBlocker.classList.add('hidden'); // Blocker entfernen
    orientationMessage.classList.add('hidden'); // Nachrichten ausblenden
    fullscreenMessage.classList.add('hidden');

    if (accessToken) {
        // Nur wenn ein Token vorhanden ist, Player initialisieren
        playbackStatus.textContent = 'Verbinde mit Spotify Player...';
        loginArea.classList.add('hidden'); // Login-Bereich ausblenden
        logoContainer.classList.remove('hidden', 'initial-hidden'); // Logo anzeigen
        scoreDisplay.classList.remove('hidden'); // Punkteanzeige anzeigen
        updatePlayerScoresDisplay(); // Punkteanzeige initialisieren
        loadSpotifySDK(); // Spotify SDK laden und Player initialisieren
    } else {
        // Wenn kein Token vorhanden ist, nur den Login-Bereich anzeigen
        loginArea.classList.remove('hidden');
    }
}


// --- Spotify Authentifizierung und SDK ---

function handleSpotifyLogin() {
    const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${SCOPES.join(' ')}&response_type=token&show_dialog=true`;
    window.location.href = authUrl;
}

function loadSpotifySDK() {
    console.log("Spotify SDK wird geladen...");
    if (window.Spotify) { // Prüfen, ob SDK bereits geladen ist
        initializeSpotifyPlayer();
        return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.type = 'text/javascript';
    script.async = true; // Asynchron laden
    document.head.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
        console.log("Spotify Web Playback SDK ist bereit.");
        initializeSpotifyPlayer();
    };
}

function initializeSpotifyPlayer() {
    // Vermeiden Sie mehrfache Initialisierung
    if (player) {
        console.log("Spotify Player ist bereits initialisiert.");
        return;
    }

    player = new Spotify.Player({
        name: 'TRACK ATTACK Player',
        getOAuthToken: cb => { cb(accessToken); },
        volume: currentVolume
    });

    // Ready
    player.addListener('ready', ({ device_id }) => {
        console.log('Bereit mit Device ID', device_id);
        currentDeviceId = device_id;
        playbackStatus.textContent = 'Verbunden mit Spotify!';
        transferPlaybackToDevice(device_id); // Wiedergabe auf dieses Gerät übertragen
        setTimeout(() => { // Kurze Verzögerung, damit Transfer abgeschlossen ist
            showDiceRoll(); // Würfelphase starten
        }, 500);

    });

    // Not Ready
    player.addListener('not_ready', ({ device_id }) => {
        console.log('Gerät ist offline', device_id);
        playbackStatus.textContent = 'Gerät ist offline. Bitte Spotify auf einem anderen Gerät starten.';
        loginArea.classList.remove('hidden'); // Optional: Login-Bereich wieder anzeigen
        logoContainer.classList.add('hidden');
        scoreDisplay.classList.add('hidden');
    });

    // Error Handling
    player.addListener('initialization_error', ({ message }) => { console.error('Initialisierungsfehler:', message); playbackStatus.textContent = `Fehler: ${message}`; });
    player.addListener('authentication_error', ({ message }) => { console.error('Authentifizierungsfehler:', message); playbackStatus.textContent = `Fehler: ${message}. Bitte erneut anmelden.`; });
    player.addListener('account_error', ({ message }) => { console.error('Kontofehler:', message); playbackStatus.textContent = `Fehler: ${message}`; });
    player.addListener('playback_error', ({ message }) => { console.error('Wiedergabefehler:', message); playbackStatus.textContent = `Wiedergabefehler: ${message}.`; });

    // Player State Changed (nützlich für Liedwechsel etc.)
    player.addListener('player_state_changed', state => {
        if (!state) return;
        currentTrack = state.track_window.current_track;
        // Optional: Hier könnten weitere UI-Updates basierend auf dem aktuellen Track erfolgen
    });

    // Connect the player!
    player.connect();
}

async function transferPlaybackToDevice(deviceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/me/player`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false // Nicht sofort abspielen
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Fehler beim Übertragen der Wiedergabe:', errorData);
            playbackStatus.textContent = `Fehler beim Übertragen: ${errorData.error.message}`;
            // Optional: Zurück zum Login oder Fehlerbildschirm
        } else {
            console.log('Wiedergabe auf neues Gerät übertragen.');
        }
    } catch (error) {
        console.error('Netzwerkfehler beim Übertragen der Wiedergabe:', error);
        playbackStatus.textContent = 'Netzwerkfehler beim Übertragen der Wiedergabe.';
        // Optional: Zurück zum Login oder Fehlerbildschirm
    }
}

// --- Spiel-Logik ---

function showDiceRoll() {
    hideAllGamePhases(); // Andere Phasen ausblenden
    diceContainer.classList.remove('hidden');
    diceAnimation.classList.remove('hidden');
    diceButtons.classList.add('hidden'); // Buttons zuerst ausblenden

    playbackStatus.textContent = `Spieler ${currentPlayer} ist an der Reihe. Wähle deinen Würfel!`;
    updatePlayerScoresDisplay(); // Punkteanzeige aktualisieren, um aktiven Spieler hervorzuheben

    // Nach 2 Sekunden die Animation ausblenden und die Buttons anzeigen
    setTimeout(() => {
        diceAnimation.classList.add('hidden');
        diceButtons.classList.remove('hidden');
    }, 2000); // Passt zur Dauer deiner w-ani.gif
}

function handleDiceSelection(event) {
    const diceValue = parseInt(event.target.dataset.diceValue);
    console.log(`Würfel gewählt: ${diceValue}`);

    diceContainer.classList.add('hidden'); // Würfelbereich ausblenden

    let category = '';
    let difficulty = '';
    let duration = 0; // Dauer in Sekunden

    switch (diceValue) {
        case 3:
            category = 'artist';
            difficulty = 'easy';
            duration = 10;
            break;
        case 4:
            category = 'song';
            difficulty = 'medium';
            duration = 15;
            break;
        case 5:
            category = 'genre';
            difficulty = 'hard';
            duration = 20;
            break;
        case 7: // Spezialwert für zufällige Auswahl
            const categories = ['artist', 'song', 'genre'];
            category = categories[Math.floor(Math.random() * categories.length)];
            const difficulties = ['easy', 'medium', 'hard'];
            difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
            duration = [10, 15, 20][Math.floor(Math.random() * 3)];
            break;
        default:
            console.error('Ungültiger Würfelwert');
            playbackStatus.textContent = 'Fehler beim Würfeln, bitte versuche es erneut.';
            showDiceRoll(); // Zurück zum Würfeln
            return;
    }

    currentCategory = category;
    currentDifficulty = difficulty;
    currentGuessDuration = duration; // In Sekunden
    console.log(`Kategorie: ${category}, Schwierigkeit: ${difficulty}, Dauer: ${duration}s`);
    playRandomTrack(category, difficulty, duration);
}

async function playRandomTrack(category, difficulty, duration) {
    playbackStatus.textContent = 'Suche Song...';
    try {
        const genres = ['pop', 'rock', 'hip-hop', 'electronic', 'rnb', 'indie', 'jazz', 'classical', 'metal', 'funk', 'soul', 'country', 'blues', 'reggae']; // Erweiterte Beispiel-Genres
        const randomGenre = genres[Math.floor(Math.random() * genres.length)];
        // Beliebtheit anpassen: Niedrigere Popularität = schwieriger zu erkennen
        const minPopularity = (difficulty === 'easy') ? 60 : (difficulty === 'medium') ? 40 : 20;
        const maxPopularity = (difficulty === 'easy') ? 100 : (difficulty === 'medium') ? 60 : 40;

        // Suche nach Tracks mit dem gewählten Genre
        // Die Spotify API unterstützt keine direkte Suche nach Popularität oder direkter Genrefilterung in 'search' außer in 'tag:genre'.
        // Hier wird ein Workaround genutzt, indem nach Genre im Query gesucht und dann clientseitig gefiltert wird.
        const searchResponse = await fetch(`${API_BASE_URL}/search?q=genre:"${randomGenre}"&type=track&limit=50`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!searchResponse.ok) throw new Error(`HTTP error! status: ${searchResponse.status}`);
        const searchData = await searchResponse.json();
        const tracks = searchData.tracks.items.filter(track =>
            track.preview_url && track.popularity >= minPopularity && track.popularity <= maxPopularity
        );

        if (tracks.length === 0) {
            playbackStatus.textContent = `Keine passenden Songs für Genre "${randomGenre}" und Schwierigkeit "${difficulty}" gefunden. Versuche es erneut.`;
            console.warn('Keine geeigneten Songs gefunden für:', randomGenre, difficulty);
            setTimeout(showDiceRoll, 2000); // Erneut würfeln lassen nach kurzer Pause
            return;
        }

        const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
        currentTrack = randomTrack;
        console.log('Spiele Track:', currentTrack.name, 'von', currentTrack.artists.map(a => a.name).join(', '));

        await player.play({
            uris: [currentTrack.uri],
            position_ms: 0,
            device_id: currentDeviceId
        });

        playbackStatus.textContent = `Spiele ${currentCategory}-Schnipsel (${difficulty}) für ${duration} Sekunden...`;

        // Spiele nur einen Teil des Songs für die geratene Dauer
        setTimeout(async () => {
            if (player) { // Sicherstellen, dass der Player noch existiert
                await player.pause();
                console.log('Song gestoppt nach', duration, 'Sekunden.');
                playbackStatus.textContent = 'Song gestoppt. Wer war dran?';
                showResolutionPhase(); // Zur Auflösungsphase wechseln
            }
        }, duration * 1000); // Konvertiere Sekunden in Millisekunden

    } catch (error) {
        console.error('Fehler beim Abspielen des Tracks:', error);
        playbackStatus.textContent = `Fehler beim Abspielen: ${error.message}. Stelle sicher, dass Spotify läuft.`;
        setTimeout(showDiceRoll, 3000); // Zurück zum Würfeln nach kurzer Fehleranzeige
    }
}

// --- Auflösungsphase ---
function showResolutionPhase() {
    hideAllGamePhases(); // Andere Phasen ausblenden
    resolutionContainer.classList.remove('hidden');

    let categoryText = '';
    if (currentCategory === 'artist') categoryText = 'Künstler';
    else if (currentCategory === 'song') categoryText = 'Song';
    else if (currentCategory === 'genre') categoryText = 'Genre';

    const songTitle = currentTrack ? currentTrack.name : 'Unbekannter Song';
    const artistName = currentTrack ? currentTrack.artists.map(a => a.name).join(', ') : 'Unbekannter Künstler';

    songInfoDisplay.innerHTML = `
        <p>Der Song war: <strong>${songTitle}</strong></p>
        <p>vom Künstler: <strong>${artistName}</strong></p>
        <p>Welcher ${categoryText} wurde von Spieler ${currentPlayer} gesucht?</p>
    `;
    playbackStatus.textContent = `Spieler ${currentPlayer}: War dein Tipp richtig?`;
}

function handleGuess(isCorrect) {
    let points = 0;
    let feedbackText = '';

    if (isCorrect) {
        if (currentDifficulty === 'easy') points = 1;
        else if (currentDifficulty === 'medium') points = 2;
        else if (currentDifficulty === 'hard') points = 3;

        feedbackText = `Spieler ${currentPlayer} hat richtig geraten! +${points} Punkte.`;
        if (currentPlayer === 1) {
            player1Score += points;
        } else {
            player2Score += points;
        }
    } else {
        feedbackText = `Spieler ${currentPlayer} hat falsch geraten. Keine Punkte.`;
    }

    playbackStatus.textContent = feedbackText;
    updatePlayerScoresDisplay();

    // Nach 3 Sekunden zur nächsten Runde wechseln
    setTimeout(() => {
        hideAllGamePhases(); // Auflösungsphase ausblenden
        switchPlayer();
        showDiceRoll(); // Nächste Runde starten
    }, 3000);
}


// --- Spieler- und Punkteverwaltung ---

function switchPlayer() {
    currentPlayer = (currentPlayer === 1) ? 2 : 1;
    console.log(`Nächster Spieler: Spieler ${currentPlayer}`);
    updatePlayerScoresDisplay(); // Punkteanzeige aktualisieren, um aktiven Spieler hervorzuheben
}

function updatePlayerScoresDisplay() {
    player1ScoreSpan.textContent = `Spieler 1: ${player1Score} Punkte`;
    player2ScoreSpan.textContent = `Spieler 2: ${player2Score} Punkte`;

    // Aktiven Spieler hervorheben
    if (currentPlayer === 1) {
        player1ScoreSpan.classList.add('player1-active-score');
        player2ScoreSpan.classList.remove('player2-active-score');
    } else {
        player2ScoreSpan.classList.add('player2-active-score');
        player1ScoreSpan.classList.remove('player1-active-score');
    }
}


// --- UI-Steuerung / Phasenmanagement ---

function hideAllGamePhases() {
    // loginArea bleibt sichtbar, wenn kein Token
    loginArea.classList.add('hidden'); // Wenn Spiel läuft, Login ausblenden
    logoContainer.classList.add('hidden');
    diceContainer.classList.add('hidden');
    resolutionContainer.classList.add('hidden');
    // playbackStatus bleibt meist sichtbar, daher nicht verstecken
}


// --- Geräte- und Vollbild-Handling ---

// Diese Funktion wird jetzt beim Laden und bei jedem Klick auf den Blocker aufgerufen
function checkDisplayRequirements() {
    const isLandscape = window.innerWidth > window.innerHeight;
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

    // Standardmäßig alle Nachrichten ausblenden, dann nur die relevanten anzeigen
    orientationMessage.classList.add('hidden');
    fullscreenMessage.classList.add('hidden');

    if (!isLandscape) {
        orientationMessage.classList.remove('hidden');
        initialClickBlocker.classList.remove('hidden'); // Blocker anzeigen, da Interaktion nötig
        return false; // Bedingungen nicht erfüllt
    }

    if (!isFullscreen) {
        fullscreenMessage.classList.remove('hidden');
        initialClickBlocker.classList.remove('hidden'); // Blocker anzeigen, da Interaktion nötig
        return false; // Bedingungen nicht erfüllt
    }

    // Wenn hier angekommen, sind Querformat und Vollbild erfüllt.
    // Der Blocker bleibt sichtbar, WENN kein AccessToken da ist oder der Player nicht bereit ist,
    // damit der Nutzer den Starttrigger setzen kann.
    if (!accessToken || !player) { // Prüfen, ob Spiel noch nicht gestartet ist
        initialClickBlocker.classList.remove('hidden');
    } else {
        // Spiel läuft, Blocker kann ausgeblendet werden
        initialClickBlocker.classList.add('hidden');
    }
    return true; // Bedingungen erfüllt
}


function requestFullscreen() {
    const element = document.documentElement; // Das gesamte HTML-Dokument

    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.mozRequestFullScreen) { /* Firefox */
        element.mozRequestFullScreen();
    } else if (element.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) { /* IE/Edge */
        element.msRequestFullscreen();
    }
    console.log("Vollbild angefordert.");
}

// Event Listener für Fullscreen-Änderungen, um checkDisplayRequirements aufzurufen
document.addEventListener('fullscreenchange', checkDisplayRequirements);
document.addEventListener('webkitfullscreenchange', checkDisplayRequirements);
document.addEventListener('mozfullscreenchange', checkDisplayRequirements);
document.addEventListener('MSFullscreenChange', checkDisplayRequirements);
