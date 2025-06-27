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
let currentGuessDuration = 0; // Speichert die Dauer, die gewürfelt wurde

// --- DOM-Elemente ---
const loginArea = document.getElementById('login-area');
const spotifyLoginButton = document.getElementById('spotify-login-button');
const playbackStatus = document.getElementById('playback-status');
const logoContainer = document.getElementById('logo-container');
const gameLogo = document.getElementById('game-logo');
const initialClickBlocker = document.getElementById('initial-click-blocker');
const orientationMessage = document.getElementById('orientation-message');
const fullscreenMessage = document.getElementById('fullscreen-message');

const scoreDisplay = document.getElementById('score-display'); // NEU
const player1ScoreSpan = document.getElementById('player1-score'); // NEU
const player2ScoreSpan = document.getElementById('player2-score'); // NEU

const diceContainer = document.getElementById('dice-container');
const diceAnimation = document.getElementById('dice-animation');
const diceButtons = document.getElementById('dice-buttons');
const diceButtonsImgs = document.querySelectorAll('.dice-button');

const resolutionContainer = document.getElementById('resolution-container'); // NEU
const songInfoDisplay = document.getElementById('song-info-display'); // NEU
const correctButton = document.getElementById('correct-button'); // NEU
const wrongButton = document.getElementById('wrong-button'); // NEU


// --- Event Listener ---
spotifyLoginButton.addEventListener('click', handleSpotifyLogin);
initialClickBlocker.addEventListener('click', handleInitialClick);
correctButton.addEventListener('click', () => handleGuess(true)); // NEU
wrongButton.addEventListener('click', () => handleGuess(false)); // NEU

diceButtonsImgs.forEach(button => {
    button.addEventListener('click', handleDiceSelection);
});

// Vollbild und Orientierung prüfen
window.addEventListener('resize', checkOrientationAndFullscreen);
window.addEventListener('orientationchange', checkOrientationAndFullscreen);


// --- Initialisierungsfunktionen ---

// 1. Seite laden -> Token prüfen
document.addEventListener('DOMContentLoaded', () => {
    // Initialen Klick-Blocker anzeigen, um Audio-Context zu aktivieren
    initialClickBlocker.classList.remove('hidden');

    checkOrientationAndFullscreen(); // Orientierung und Vollbild beim Laden prüfen
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    accessToken = urlParams.get('access_token');

    if (accessToken) {
        console.log('Access Token erhalten:', accessToken);
        history.replaceState(null, '', REDIRECT_URI); // Clean up URL
        playbackStatus.textContent = 'Verbinde mit Spotify Player...';
        // Spotify Web Playback SDK laden
        loadSpotifySDK();
    } else {
        playbackStatus.textContent = 'Bitte melde dich bei Spotify an.';
    }
});

// Handler für den initialen Klick
function handleInitialClick() {
    console.log("Initial click detected.");
    initialClickBlocker.classList.add('hidden'); // Blocker entfernen

    // Versuch, in den Vollbildmodus zu gehen, falls noch nicht geschehen
    if (!document.fullscreenElement) {
        requestFullscreen();
    }

    // Wenn ein Access Token vorhanden ist, aber der Player noch nicht bereit ist
    if (accessToken && !player) {
        // Hier sollte die Logik zum Laden des SDK oder Initialisieren des Players erfolgen,
        // falls es nicht bereits durch `DOMContentLoaded` ausgelöst wurde.
        // In diesem Setup sollte `loadSpotifySDK()` bereits durch `DOMContentLoaded` aufgerufen worden sein,
        // aber dieser Klick kann dazu beitragen, den AudioContext zu reaktivieren.
        playbackStatus.textContent = 'Verbinde mit Spotify Player...';
    }
}


// --- Spotify Authentifizierung und SDK ---

function handleSpotifyLogin() {
    const authUrl = `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${SCOPES.join(' ')}&response_type=token&show_dialog=true`;
    window.location.href = authUrl;
}

function loadSpotifySDK() {
    console.log("Spotify SDK wird geladen...");
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.type = 'text/javascript';
    document.head.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
        console.log("Spotify Web Playback SDK ist bereit.");
        initializeSpotifyPlayer();
    };
}

function initializeSpotifyPlayer() {
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
        logoContainer.classList.remove('hidden', 'initial-hidden'); // Logo anzeigen
        scoreDisplay.classList.remove('hidden'); // Punkteanzeige anzeigen
        updatePlayerScoresDisplay(); // Punkteanzeige initialisieren
        transferPlaybackToDevice(device_id); // Wiedergabe auf dieses Gerät übertragen
        showDiceRoll(); // Würfelphase starten
    });

    // Not Ready
    player.addListener('not_ready', ({ device_id }) => {
        console.log('Gerät ist offline', device_id);
        playbackStatus.textContent = 'Gerät ist offline. Bitte Spotify auf einem anderen Gerät starten.';
    });

    // Error Handling
    player.addListener('initialization_error', ({ message }) => { console.error('Initialisierungsfehler:', message); playbackStatus.textContent = `Fehler: ${message}`; });
    player.addListener('authentication_error', ({ message }) => { console.error('Authentifizierungsfehler:', message); playbackStatus.textContent = `Fehler: ${message}. Bitte erneut anmelden.`; });
    player.addListener('account_error', ({ message }) => { console.error('Kontofehler:', message); playbackStatus.textContent = `Fehler: ${message}`; });
    player.addListener('playback_error', ({ message }) => { console.error('Wiedergabefehler:', message); playbackStatus.textContent = `Wiedergabefehler: ${message}.`; });

    // Player State Changed (nützlich für Liedwechsel etc.)
    player.addListener('player_state_changed', state => {
        if (!state) {
            return;
        }
        // Hier könntest du auf Liedwechsel reagieren, wenn nötig
        // console.log('Player State Changed:', state);
        currentTrack = state.track_window.current_track;
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
        } else {
            console.log('Wiedergabe auf neues Gerät übertragen.');
        }
    } catch (error) {
        console.error('Fehler beim Übertragen der Wiedergabe:', error);
        playbackStatus.textContent = 'Netzwerkfehler beim Übertragen der Wiedergabe.';
    }
}

// --- Spiel-Logik ---

function showDiceRoll() {
    hideAllGamePhases(); // Andere Phasen ausblenden
    diceContainer.classList.remove('hidden');
    diceAnimation.classList.remove('hidden');
    diceButtons.classList.add('hidden'); // Buttons zuerst ausblenden

    // Nach 2 Sekunden die Animation ausblenden und die Buttons anzeigen
    setTimeout(() => {
        diceAnimation.classList.add('hidden');
        diceButtons.classList.remove('hidden');
        // Hier können wir auch den aktuellen Spieler hervorheben
        updatePlayerScoresDisplay();
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
        const genres = ['pop', 'rock', 'hip-hop', 'electronic', 'rnb', 'indie', 'jazz', 'classical', 'metal', 'funk']; // Beispiel-Genres
        const randomGenre = genres[Math.floor(Math.random() * genres.length)];
        const minPopularity = (difficulty === 'easy') ? 60 : (difficulty === 'medium') ? 40 : 20; // Beliebtheit anpassen
        const maxPopularity = (difficulty === 'easy') ? 100 : (difficulty === 'medium') ? 60 : 40;

        // Suche nach Tracks, die dem Genre und der Beliebtheit entsprechen
        const searchResponse = await fetch(`${API_BASE_URL}/search?q=genre:"${randomGenre}"&type=track&limit=50`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!searchResponse.ok) throw new Error(`HTTP error! status: ${searchResponse.status}`);
        const searchData = await searchResponse.json();
        const tracks = searchData.tracks.items.filter(track =>
            track.preview_url && track.popularity >= minPopularity && track.popularity <= maxPopularity
        );

        if (tracks.length === 0) {
            playbackStatus.textContent = 'Keine geeigneten Songs gefunden. Versuche es erneut.';
            console.warn('Keine geeigneten Songs gefunden für:', randomGenre, difficulty);
            showDiceRoll(); // Erneut würfeln lassen
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

        // Spiele nur einen Teil des Songs für die geratene Dauer
        setTimeout(async () => {
            await player.pause();
            console.log('Song gestoppt nach', duration, 'Sekunden.');
            playbackStatus.textContent = 'Song gestoppt. Wer war dran?';
            showResolutionPhase(); // Zur Auflösungsphase wechseln
        }, duration * 1000); // Konvertiere Sekunden in Millisekunden

        playbackStatus.textContent = `Spiele ${currentCategory}-Schnipsel (${difficulty}) für ${duration} Sekunden...`;

    } catch (error) {
        console.error('Fehler beim Abspielen des Tracks:', error);
        playbackStatus.textContent = `Fehler beim Abspielen: ${error.message}.`;
        showDiceRoll(); // Zurück zum Würfeln
    }
}

// --- Auflösungsphase ---
function showResolutionPhase() {
    hideAllGamePhases(); // Andere Phasen ausblenden
    resolutionContainer.classList.remove('hidden');

    let songInfoText = `Welcher ${currentCategory} ist das?`;
    if (currentDifficulty === 'easy') {
        songInfoText = `Leicht: Welcher ${currentCategory} ist das?`;
    } else if (currentDifficulty === 'medium') {
        songInfoText = `Mittel: Welcher ${currentCategory} ist das?`;
    } else if (currentDifficulty === 'hard') {
        songInfoText = `Schwer: Welcher ${currentCategory} ist das?`;
    }

    songInfoDisplay.textContent = songInfoText;
}

function handleGuess(isCorrect) {
    let points = 0;
    if (isCorrect) {
        // Punkte basierend auf Schwierigkeit vergeben
        if (currentDifficulty === 'easy') points = 1;
        else if (currentDifficulty === 'medium') points = 2;
        else if (currentDifficulty === 'hard') points = 3;

        // Wenn die Kategorie "Artist" ist und der Benutzer "richtig" klickt,
        // und es sich tatsächlich um den Künstler handelt.
        // Das Spiel hat keine direkte Möglichkeit, die tatsächliche Antwort des Benutzers zu überprüfen.
        // Wir gehen davon aus, dass der Benutzer nur auf "Richtig" klickt, wenn er tatsächlich richtig geraten hat.

        playbackStatus.textContent = `Spieler ${currentPlayer} hat richtig geraten! +${points} Punkte.`;
        if (currentPlayer === 1) {
            player1Score += points;
        } else {
            player2Score += points;
        }
    } else {
        playbackStatus.textContent = `Spieler ${currentPlayer} hat falsch geraten. Keine Punkte.`;
    }

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
    loginArea.classList.add('hidden');
    logoContainer.classList.add('hidden');
    diceContainer.classList.add('hidden');
    resolutionContainer.classList.add('hidden'); // Auch die neue Auflösungsphase ausblenden
    // playbackStatus bleibt meist sichtbar, daher nicht verstecken
}


// --- Geräte- und Vollbild-Handling ---

function checkOrientationAndFullscreen() {
    const isLandscape = window.innerWidth > window.innerHeight;
    const isFullscreen = document.fullscreenElement;

    // Orientierung prüfen
    if (!isLandscape) {
        orientationMessage.classList.remove('hidden');
        initialClickBlocker.classList.remove('hidden'); // Blocker anzeigen, wenn falsch ausgerichtet
    } else {
        orientationMessage.classList.add('hidden');
    }

    // Vollbild prüfen (nur anzeigen, wenn Landschaftsmodus aktiv ist)
    if (isLandscape && !isFullscreen) {
        fullscreenMessage.classList.remove('hidden');
        initialClickBlocker.classList.remove('hidden'); // Blocker anzeigen für Vollbild-Klick
    } else {
        fullscreenMessage.classList.add('hidden');
    }

    // Wenn beides in Ordnung ist, Blocker entfernen (falls nicht schon geschehen)
    if (isLandscape && isFullscreen) {
        initialClickBlocker.classList.add('hidden');
    }
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
