// script.js

// --- ALLGEMEINE KONSTANTEN & GLOBALE VARIABLEN (NICHT DOM-Elemente) ---

// Spotify API Credentials (Jetzt mit deinen Daten)
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6';
const REDIRECT_URI = 'https://dookye.github.io/TRACK-ATTACK'; // Deine GitHub Pages URL

// Spotify API Endpunkte (Diese sind statisch)
const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'; // Korrigierte URL
const TOKEN_URL = 'https://accounts.spotify.com/api/token';     // Korrigierte URL
const PLAYLISTS_URL = 'https://api.spotify.com/v1/me/playlists';
const PLAYER_URL = 'https://api.spotify.com/v1/me/player';

// Globale Zustandsvariablen für Spotify und Spielablauf
let accessToken = '';
let refreshToken = '';
let player = null;
let deviceId = '';
let isPlayerReady = false;
let currentGameState = 'loading'; // 'loading', 'loginScreen', 'startScreen', 'playing', 'songPlaying', 'songPaused', 'resolving'
let introAnimationPlayed = false; // Verfolgt, ob die Intro-Logo-Animation einmal gelaufen ist
let logoClickListener = null;     // Speichert den aktuellen Event Listener für das Logo

// Spiel-Zustandsvariablen
let currentPlayer = 'player1'; // 'player1' (Blau) oder 'player2' (Pink)
let player1Score = 0;
let player2Score = 0;
let roundCounter = 0;          // Zählt die Runden (10 Durchgänge = 20 Songs, 1 Runde = 2 Songs)
let songsPlayedInRound = 0;    // Zählt die Songs pro Runde (max. 2 pro Runde)
let isFullscreen = false;      // Verfolgt den Fullscreen-Status
let isPortrait = false;        // Verfolgt den Portrait-Modus


// --- DOM-ELEMENT REFERENZEN (Werden im DOMContentLoaded Block initialisiert) ---
// Diese Variablen werden hier nur deklariert, aber noch nicht initialisiert.
// Ihre Zuweisung erfolgt später, sobald das HTML-Dokument vollständig geladen ist.
let gameContainer;
let loginArea;
let spotifyLoginButton;
let playbackStatus;
let logoContainer;
let logo;
let initialClickBlocker;
let orientationMessage;
let fullscreenMessage;
let enterFullscreenButton;


// --- AUTHENTIFIZIERUNG & TOKEN MANAGEMENT ---

/**
 * Holt den Access Token und Refresh Token aus der URL, nachdem Spotify zurückgeleitet hat.
 * @returns {boolean} True, wenn Tokens gefunden und gespeichert wurden, sonst False.
 */
function getTokensFromUrl() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    accessToken = params.get('access_token');
    refreshToken = params.get('refresh_token');

    if (accessToken) {
        localStorage.setItem('spotify_access_token', accessToken);
        // Da wir das CLIENT_SECRET nicht verwenden, speichern wir den refresh_token nicht mehr persistent.
        // Andernfalls müsste sich der Nutzer nach 1h neu anmelden.
        // localStorage.setItem('spotify_refresh_token', refreshToken); 
        localStorage.setItem('spotify_token_timestamp', Date.now()); // Speichert den Zeitpunkt des Erhalts
        window.history.pushState({}, document.title, window.location.pathname); // Bereinigt die URL
        return true;
    }
    return false;
}

/**
 * Leitet den Nutzer zur Spotify Autorisierung weiter.
 */
function authorizeSpotify() {
    // Die Scopes definieren, welche Berechtigungen deine App benötigt.
    const scope = 'user-read-private user-read-email user-modify-playback-state user-read-playback-state user-read-currently-playing playlist-read-private';
    const authUrl = `${AUTHORIZE_URL}?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${REDIRECT_URI}&scope=${scope}`;
    window.location.href = authUrl;
}

/**
 * Aktualisiert den Access Token mithilfe des Refresh Tokens.
 * HINWEIS: Diese Funktion wird ohne ein Backend NICHT funktionieren,
 * da das CLIENT_SECRET erforderlich ist. Der Benutzer muss sich neu anmelden.
 */
async function refreshAccessToken() {
    // Da wir das CLIENT_SECRET nicht im Frontend exponieren,
    // kann diese Funktion den Token nicht aktualisieren.
    // Wir leiten den Benutzer stattdessen zum Login-Bildschirm zurück.
    console.warn('refreshAccessToken: Token-Aktualisierung im Frontend ohne CLIENT_SECRET nicht möglich. Benutzer muss sich neu anmelden.');
    currentGameState = 'loginScreen';
    showLoginScreen();
    return false; // Zeigt an, dass die Aktualisierung fehlgeschlagen ist
}

/**
 * Überprüft, ob der Access Token gültig ist.
 * Da wir den Token nicht aktualisieren können, wird der Token als ungültig betrachtet,
 * sobald er abgelaufen ist.
 * @returns {boolean} True, wenn ein gültiger Token verfügbar ist, sonst False.
 */
async function checkTokenValidity() {
    const storedAccessToken = localStorage.getItem('spotify_access_token');
    const tokenTimestamp = localStorage.getItem('spotify_token_timestamp');

    if (storedAccessToken && tokenTimestamp) {
        const expiresIn = 3600 * 1000; // Spotify Tokens sind normalerweise 1 Stunde gültig (in Millisekunden)
        const elapsed = Date.now() - parseInt(tokenTimestamp, 10);

        if (elapsed < expiresIn - 10000) { // Betrachte es als gültig, bis kurz vor Ablauf (10s Puffer)
            accessToken = storedAccessToken;
            console.log('Access Token ist noch gültig.');
            return true;
        } else {
            console.log('Access Token ist abgelaufen oder kurz davor. Erneute Anmeldung erforderlich.');
            // Token ist abgelaufen, setzen wir ihn zurück und fordern neuen Login an
            accessToken = '';
            localStorage.removeItem('spotify_access_token');
            localStorage.removeItem('spotify_token_timestamp');
            return false;
        }
    }
    return false;
}


// --- SPOTIFY PLAYER INITIALISIERUNG ---

/**
 * Initialisiert den Spotify Web Playback SDK Player.
 */
function initSpotifyPlayer() {
    // Überprüfe, ob das SDK bereits geladen ist
    if (window.Spotify && window.Spotify.Player) {
        setupSpotifyPlayer();
    } else {
        // Lädt das Spotify Web Playback SDK Skript dynamisch
        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-web-playback-sdk.js';
        script.onload = setupSpotifyPlayer; // Rufe setupSpotifyPlayer auf, wenn Skript geladen ist
        document.body.appendChild(script);
    }
}

/**
 * Konfiguriert den Spotify Player, nachdem das SDK geladen wurde.
 */
function setupSpotifyPlayer() {
    player = new Spotify.Player({
        name: 'TRACK ATTACK Player',
        getOAuthToken: cb => { cb(accessToken); },
        volume: 0.5
    });

    // Event Listener für den Player
    player.addListener('ready', ({ device_id }) => {
        deviceId = device_id;
        console.log('Gerät bereit mit ID', deviceId);
        handlePlayerReady(); // Player ist bereit, Spiel kann starten
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.log('Gerät getrennt', device_id);
        playbackStatus.textContent = 'Spotify Player nicht bereit. Bitte überprüfen Sie Ihre Verbindung.';
        isPlayerReady = false;
    });

    player.addListener('initialization_error', ({ message }) => { console.error('Initialisierungsfehler:', message); });
    player.addListener('authentication_error', ({ message }) => { console.error('Authentifizierungsfehler:', message); currentGameState = 'loginScreen'; showLoginScreen(); });
    player.addListener('account_error', ({ message }) => { console.error('Konto-Fehler:', message); });
    player.addListener('playback_error', ({ message }) => { console.error('Wiedergabefehler:', message); });

    player.connect();
}

/**
 * Wird aufgerufen, sobald der Spotify Player bereit ist.
 */
async function handlePlayerReady() {
    console.log("Spotify Player ist bereit!");
    isPlayerReady = true;
    playbackStatus.textContent = 'Bereit zum Spielstart!';

    // Login-Bereich ausblenden
    if (loginArea) {
        loginArea.classList.add('hidden'); // Führt die CSS-Transition aus
    }
    
    // Anzeigen des TRACK ATTACK Logos
    showLogoButton(); // Diese Funktion sollte die Animation starten und das Logo sichtbar machen
}


// --- UI STEUERUNGSFUNKTIONEN ---

/**
 * Zeigt den Login-Bildschirm an.
 */
function showLoginScreen() {
    console.log("Zeige Login-Bildschirm.");
    currentGameState = 'loginScreen';
    loginArea.classList.remove('hidden'); // Macht den Login-Bereich sichtbar
    gameContainer.classList.remove('player-blue-active', 'player-pink-active'); // Hintergrund neutralisieren
    logoContainer.classList.add('hidden'); // Logo ausblenden, falls sichtbar
    // Der initialClickBlocker sollte hier bereits hidden sein, falls er zuvor sichtbar war.
    // Wir wollen hier keine Blockade, damit der Login-Button klickbar ist.
    initialClickBlocker.classList.add('hidden');
    initialClickBlocker.classList.remove('visible');
}

/**
 * Zeigt das TRACK ATTACK Logo mit der Reinfall-Animation.
 * Aktiviert den Klick-Listener nach Abschluss der Animation.
 */
function showLogoButton() {
    console.log("showLogoButton aufgerufen.");
    currentGameState = 'startScreen';
    loginArea.classList.add('hidden'); // Sicherstellen, dass der Login-Bereich ausgeblendet ist
    logoContainer.classList.remove('hidden'); // Logo-Container sichtbar machen

    // Entferne alte Listener, um Doppelungen zu vermeiden
    if (logoClickListener) {
        logo.removeEventListener('click', logoClickListener);
        logo.removeEventListener('pointerdown', logoClickListener); // Für Touch-Geräte
    }

    logoClickListener = function() {
        if (currentGameState === 'startScreen' && isPlayerReady) {
            console.log("Logo geklickt - Spiel wird gestartet!");
            startGame();
            logo.classList.add('inactive'); // Logo visuell inaktiv schalten
            // Entferne den Listener, da der erste Klick das Spiel startet
            logo.removeEventListener('click', logoClickListener);
            logo.removeEventListener('pointerdown', logoClickListener);
        } else if (!isPlayerReady) {
            playbackStatus.textContent = 'Spotify Player lädt noch...';
        }
    };

    logo.addEventListener('click', logoClickListener);
    logo.addEventListener('pointerdown', logoClickListener); // Für Touch-Geräte

    if (!introAnimationPlayed) {
        console.log("showLogoButton: Starte Intro-Animation für das Logo.");
        logoContainer.classList.remove('initial-hidden'); // Entfernt die versteckte Startposition
        logoContainer.style.animation = 'fall-in 2s forwards'; // Startet die Fall-Animation

        // Setze introAnimationPlayed auf true, sobald die Animation beendet ist
        logoContainer.addEventListener('animationend', () => {
            introAnimationPlayed = true;
            logoContainer.style.animation = 'none'; // Entferne die Animationseigenschaft, damit sie nicht erneut triggert
            console.log("Intro-Animation beendet. Logo ist klickbar.");
        }, { once: true }); // Listener nur einmal ausführen

    } else {
        console.log("showLogoButton: Intro-Animation lief schon, zeige Logo für Spielstart (ohne Re-Animation).");
        logoContainer.style.animation = 'none';
        logoContainer.classList.remove('initial-hidden');
        logoContainer.style.opacity = '1';
        logo.classList.remove('inactive'); // Sicherstellen, dass es aktiv aussieht
    }
}

/**
 * Startet den Hauptspielfluss nach dem ersten Klick auf das Logo.
 */
function startGame() {
    console.log("startGame: Spiel startet jetzt!");
    currentGameState = 'playing'; // Der Hauptspielfluss beginnt
    logo.classList.add('inactive'); // Logo wird inaktiv, da es nicht mehr für den Startklick ist
    
    // Hintergrund auf Blau für Spieler 1 setzen
    switchPlayer('player1'); // Ruft switchPlayer auf, um den Hintergrund zu setzen
    // Hier würden die Würfel-Animationen oder andere Startschritte folgen
}


// --- SPIELLOGIK ---

/**
 * Wechselt den aktiven Spieler und aktualisiert den Hintergrund.
 * @param {string} [initialPlayer] - Optional, um den ersten Spieler explizit zu setzen ('player1' oder 'player2').
 */
function switchPlayer(initialPlayer = null) {
    console.log(`switchPlayer: Aufgerufen. Aktueller Spieler (vorher): ${currentPlayer}`);
    
    // Entferne alte Spieler-Hintergrundklassen vom gameContainer
    gameContainer.classList.remove('player-blue-active', 'player-pink-active');

    if (initialPlayer) {
        currentPlayer = initialPlayer;
    } else {
        // Spielerwechsel Logik
        if (currentPlayer === 'player1') {
            currentPlayer = 'player2';
        } else {
            currentPlayer = 'player1';
        }
    }

    // Füge die neue Spieler-Hintergrundklasse hinzu
    if (currentPlayer === 'player1') {
        gameContainer.classList.add('player-blue-active');
        console.log("switchPlayer: Hintergrund wechselt zu Blau (Player 1).");
    } else {
        gameContainer.classList.add('player-pink-active');
        console.log("switchPlayer: Hintergrund wechselt zu Pink (Player 2).");
    }

    // Erhöhen Sie den Runden- oder Songzähler hier
    // Nur erhöhen, wenn es KEIN initialer Aufruf zum Spielstart ist
    if (!initialPlayer) { 
        songsPlayedInRound++;
        if (songsPlayedInRound >= 2) { // Nach 2 Songs ist eine volle Runde vorbei (Player1 und Player2)
            roundCounter++;
            songsPlayedInRound = 0;
            console.log(`switchPlayer: Runde ${roundCounter} beendet.`);
            // Hier können wir später den Spielende-Check einfügen (nach 10 Runden)
        }
    }

    console.log(`switchPlayer: Neuer Spieler: ${currentPlayer}, Runden: ${roundCounter}, Songs in Runde: ${songsPlayedInRound}`);
}

// --- FULLSCREEN & ORIENTIERUNG MANAGEMENT ---

/**
 * Überprüft die Bildschirmausrichtung und zeigt ggf. eine Meldung an.
 */
function checkOrientation() {
    isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait) {
        orientationMessage.classList.add('visible');
        initialClickBlocker.classList.add('visible'); // Blocker aktivieren
        initialClickBlocker.classList.remove('hidden');
    } else {
        orientationMessage.classList.remove('visible');
        // Blocker nur entfernen, wenn Fullscreen auch aktiv ist oder gar nicht benötigt wird
        if (isFullscreen) {
            initialClickBlocker.classList.remove('visible');
            initialClickBlocker.classList.add('hidden'); // Sicherstellen, dass er wirklich hidden ist
        } else {
             checkFullscreenStatus(); // Prüft und zeigt ggf. Fullscreen-Meldung an
        }
    }
}

/**
 * Überprüft den Fullscreen-Status und zeigt ggf. eine Meldung an.
 */
function checkFullscreenStatus() {
    // Prüfe, ob wir uns im Fullscreen-Modus befinden
    const isCurrentlyFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;

    if (!isCurrentlyFullscreen) {
        isFullscreen = false;
        // Nur Fullscreen-Meldung anzeigen, wenn nicht im Portrait-Modus (da dort Orientierungsmeldung Priorität hat)
        if (!isPortrait) {
            fullscreenMessage.classList.add('visible');
            initialClickBlocker.classList.add('visible'); // Blocker aktivieren
            initialClickBlocker.classList.remove('hidden');
        }
    } else {
        isFullscreen = true;
        fullscreenMessage.classList.remove('visible');
        // Blocker nur entfernen, wenn auch die Orientierung stimmt
        if (!isPortrait) {
            initialClickBlocker.classList.remove('visible');
            initialClickBlocker.classList.add('hidden'); // Sicherstellen, dass er wirklich hidden ist
        }
    }
}

/**
 * Fordert den Fullscreen-Modus an.
 */
function enterFullscreen() {
    const docElem = document.documentElement;
    if (docElem.requestFullscreen) {
        docElem.requestFullscreen();
    } else if (docElem.webkitRequestFullscreen) { /* Safari */
        docElem.webkitRequestFullscreen();
    } else if (docElem.msRequestFullscreen) { /* IE11 */
        docElem.msRequestFullscreen();
    }
}


/**
 * Versucht, den Benutzer zu authentifizieren und den Spotify-Player zu initialisieren.
 */
async function tryAuthenticateAndInit() {
    console.log("tryAuthenticateAndInit: Starte Authentifizierungsprozess.");
    currentGameState = 'loading';
    playbackStatus.textContent = 'Lade Spotify...';

    // Versuche, Tokens aus der URL zu holen (nach Callback)
    if (getTokensFromUrl()) {
        console.log("Tokens aus URL erhalten.");
        initSpotifyPlayer();
    } else if (await checkTokenValidity()) { // Versuche, Token aus localStorage zu verwenden/zu prüfen
        console.log("Token aus localStorage gültig.");
        initSpotifyPlayer();
    } else {
        // Wenn keine gültigen Tokens vorhanden, zeige Login-Bildschirm
        console.log("Keine gültigen Tokens. Zeige Login-Bildschirm.");
        showLoginScreen();
    }
}


// --- INITIALER START DER ANWENDUNG (DOMContentLoaded Event Listener) ---
// Dieser Event Listener stellt sicher, dass das Skript erst ausgeführt wird,
// wenn das gesamte HTML-Dokument geladen und geparst wurde.
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM geladen. Starte Initialisierung...");

    // 1. DOM-Elemente initialisieren:
    // Diese Zuweisungen müssen HIER erfolgen, da die Elemente im HTML
    // erst jetzt garantiert verfügbar sind.
    gameContainer = document.querySelector('.game-container');
    loginArea = document.getElementById('login-area');
    spotifyLoginButton = document.getElementById('spotify-login-button');
    playbackStatus = document.getElementById('playback-status');
    logoContainer = document.getElementById('logo-container');
    logo = document.getElementById('game-logo');
    initialClickBlocker = document.getElementById('initial-click-blocker');
    orientationMessage = document.getElementById('orientation-message');
    fullscreenMessage = document.getElementById('fullscreen-message');
    enterFullscreenButton = document.getElementById('enter-fullscreen-button');

    // 2. Event Listener für Buttons hinzufügen:
    // Diese müssen HIER hinzugefügt werden, nachdem die Buttons existieren.
    if (spotifyLoginButton) {
        spotifyLoginButton.addEventListener('click', authorizeSpotify);
    } else {
        console.error("Fehler: Spotify Login Button konnte nicht gefunden werden! Überprüfe die ID in index.html.");
    }

    if (enterFullscreenButton) {
        enterFullscreenButton.addEventListener('click', enterFullscreen);
    } else {
        console.error("Fehler: Fullscreen Button konnte nicht gefunden werden! Überprüfe die ID in index.html.");
    }
    
    // Event Listener für Fullscreen-Änderungen und Orientierung (immer aktiv)
    document.addEventListener('fullscreenchange', checkFullscreenStatus);
    document.addEventListener('webkitfullscreenchange', checkFullscreenStatus); // Safari
    document.addEventListener('mozfullscreenchange', checkFullscreenStatus); // Firefox
    document.addEventListener('MSFullscreenChange', checkFullscreenStatus); // IE11
    window.addEventListener('orientationchange', checkOrientation);
    window.addEventListener('resize', () => {
        // Wenn die Größe geändert wird (z.B. Tastatur auf Handy öffnet sich),
        // prüfen wir beides kurz nach, da sich der Viewport ändern kann.
        checkOrientation();
        checkFullscreenStatus();
    });

    // 3. Initialen Status prüfen und Authentifizierung starten:
    // Dies ist die Startlogik der App.
    checkOrientation();
    checkFullscreenStatus(); // Prüft Fullscreen und setzt initialClickBlocker

    // Die Authentifizierung wird nur gestartet, wenn der Blocker entfernt wurde.
    // Dies kann durch einen Observer geschehen, wenn die Meldungen aktiv sind.
    if (!orientationMessage.classList.contains('visible') && !fullscreenMessage.classList.contains('visible')) {
        // Wenn keine Meldungen sichtbar sind, Blocker entfernen und sofort authentifizieren
        initialClickBlocker.classList.remove('visible');
        initialClickBlocker.classList.add('hidden'); // Sicherstellen, dass er wirklich versteckt ist
        await tryAuthenticateAndInit();
    } else {
        // Wenn Meldungen aktiv sind, warten wir, bis der Blocker durch User-Interaktion verschwindet.
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    // Sobald initialClickBlocker die Klasse 'hidden' hat und wir noch im 'loading'-Zustand sind
                    if (initialClickBlocker.classList.contains('hidden') && currentGameState === 'loading') {
                        observer.disconnect(); // Beobachter stoppen, um unnötige Aufrufe zu vermeiden
                        tryAuthenticateAndInit(); // Authentifizierung starten
                    }
                }
            }
        });
        // Beobachte Änderungen der 'class' Eigenschaft auf dem initialClickBlocker
        observer.observe(initialClickBlocker, { attributes: true });
    }
});
