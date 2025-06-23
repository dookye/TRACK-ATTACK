// script.js (Teil 1/2)

// --- ALLGEMEINE KONSTANTEN & VARIABLEN ---
const gameContainer = document.querySelector('.game-container');
const loginArea = document.getElementById('login-area');
const spotifyLoginButton = document.getElementById('spotify-login-button');
const playbackStatus = document.getElementById('playback-status');
const logoContainer = document.getElementById('logo-container');
const logo = document.getElementById('game-logo');
const initialClickBlocker = document.getElementById('initial-click-blocker');
const orientationMessage = document.getElementById('orientation-message');
const fullscreenMessage = document.getElementById('fullscreen-message');
const enterFullscreenButton = document.getElementById('enter-fullscreen-button');

// Spotify API Credentials (Bitte hier Ihre echten Client ID und Redirect URI eintragen)
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6'; // ERSETZE DIES DURCH DEINE CLIENT ID
const REDIRECT_URI = 'https://dookye.github.io/TRACK-ATTACK/'; // Stelle sicher, dass dies in deinen Spotify App Einstellungen registriert ist

// Spotify API Endpunkte
const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const PLAYLISTS_URL = 'https://api.spotify.com/v1/me/playlists';
const PLAYER_URL = 'https://api.spotify.com/v1/me/player';

// Globale Zustandsvariablen
let accessToken = '';
let refreshToken = '';
let player = null;
let deviceId = '';
let isPlayerReady = false;
let currentGameState = 'loading'; // 'loading', 'loginScreen', 'startScreen', 'playing', 'songPlaying', 'songPaused', 'resolving'
let introAnimationPlayed = false; // Verfolgt, ob die Intro-Logo-Animation einmal gelaufen ist
let logoClickListener = null; // Speichert den aktuellen Event Listener für das Logo

// --- NEUE SPIEL-ZUSTANDSVARIABLEN ---
let currentPlayer = 'player1'; // 'player1' (Blau) oder 'player2' (Pink)
let player1Score = 0;
let player2Score = 0;
let roundCounter = 0; // Zählt die Runden (10 Durchgänge = 20 Songs, 1 Runde = 2 Songs)
let songsPlayedInRound = 0; // Zählt die Songs pro Runde (max. 2 pro Runde)
let isFullscreen = false; // Verfolgt den Fullscreen-Status
let isPortrait = false; // Verfolgt den Portrait-Modus


// --- AUTHENTIFIZIERUNG & TOKEN MANAGEMENT ---

/**
 * Holt den Access Token und Refresh Token aus der URL, nachdem Spotify zurückgeleitet hat.
 */
function getTokensFromUrl() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    accessToken = params.get('access_token');
    refreshToken = params.get('refresh_token');

    // Wenn Tokens in der URL sind, speichern und URL bereinigen
    if (accessToken) {
        localStorage.setItem('spotify_access_token', accessToken);
        localStorage.setItem('spotify_refresh_token', refreshToken);
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
    const scope = 'user-read-private user-read-email user-modify-playback-state user-read-playback-state user-read-currently-playing playlist-read-private';
    const authUrl = `${AUTHORIZE_URL}?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${REDIRECT_URI}&scope=${scope}`;
    window.location.href = authUrl;
}

/**
 * Aktualisiert den Access Token mithilfe des Refresh Tokens.
 */
async function refreshAccessToken() {
    const storedRefreshToken = localStorage.getItem('spotify_refresh_token');
    if (!storedRefreshToken) {
        console.warn('Kein Refresh Token gefunden, erneute Autorisierung erforderlich.');
        currentGameState = 'loginScreen';
        showLoginScreen();
        return;
    }

    try {
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + 'YOUR_CLIENT_SECRET') // Client Secret wird hier benötigt
            },
            body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: storedRefreshToken,
                client_id: CLIENT_ID // Client ID wird auch hier benötigt
            })
        });

        if (!response.ok) {
            if (response.status === 400) {
                console.error('Refresh Token ungültig oder abgelaufen. Erneute Anmeldung erforderlich.');
                currentGameState = 'loginScreen';
                showLoginScreen();
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        accessToken = data.access_token;
        localStorage.setItem('spotify_access_token', accessToken);
        localStorage.setItem('spotify_token_timestamp', Date.now());
        console.log('Access Token erfolgreich aktualisiert.');
        initSpotifyPlayer(); // Player erneut initialisieren, falls nötig
    } catch (error) {
        console.error('Fehler beim Aktualisieren des Access Tokens:', error);
        currentGameState = 'loginScreen';
        showLoginScreen();
    }
}

/**
 * Überprüft, ob der Access Token gültig ist, und aktualisiert ihn bei Bedarf.
 */
async function checkTokenValidity() {
    const storedAccessToken = localStorage.getItem('spotify_access_token');
    const tokenTimestamp = localStorage.getItem('spotify_token_timestamp');

    if (storedAccessToken && tokenTimestamp) {
        const expiresIn = 3600 * 1000; // Spotify Tokens sind normalerweise 1 Stunde gültig (in Millisekunden)
        const elapsed = Date.now() - parseInt(tokenTimestamp, 10);

        if (elapsed < expiresIn - 60000) { // Aktualisiere 1 Minute vor Ablauf
            accessToken = storedAccessToken;
            console.log('Access Token ist noch gültig.');
            return true;
        } else {
            console.log('Access Token ist abgelaufen oder kurz davor, versuche zu aktualisieren...');
            await refreshAccessToken();
            return accessToken ? true : false;
        }
    }
    return false;
}


// --- SPOTIFY PLAYER INITIALISIERUNG ---

/**
 * Initialisiert den Spotify Web Playback SDK Player.
 */
function initSpotifyPlayer() {
    window.onSpotifyWebPlaybackSDKReady = () => {
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
    };

    // Lädt das Spotify Web Playback SDK Skript
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-web-playback-sdk.js';
    document.body.appendChild(script);
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
        // Der Visibility-Wechsel passiert durch die CSS-Transition
    }
    
    // Anzeigen des TRACK ATTACK Logos
    showLogoButton(); // Diese Funktion sollte die Animation starten und das Logo sichtbar machen
}

// ... (Restlicher Code in Teil 2)
// script.js (Teil 2/2)

// ... (Fortsetzung von Teil 1) ...

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
    initialClickBlocker.classList.add('hidden'); // Initialen Blocker ausblenden, Login soll klickbar sein
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
            // Starte das Spiel
            startGame();
            // Optional: Logo visuell inaktiv schalten oder ausblenden für den nächsten Schritt
            logo.classList.add('inactive');
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
        // Setze das Logo direkt sichtbar und aktiv, wenn die Animation schon gelaufen ist
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
    // Für jetzt lassen wir es dabei, dass der Hintergrund wechselt.
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

// ... (Platzhalter für zukünftige Funktionen wie playRandomSong, showGenreSelection etc.) ...


// --- FULLSCREEN & ORIENTIERUNG MANAGEMENT ---

/**
 * Überprüft die Bildschirmausrichtung und zeigt ggf. eine Meldung an.
 */
function checkOrientation() {
    isPortrait = window.innerHeight > window.innerWidth;
    if (isPortrait) {
        orientationMessage.classList.add('visible');
        initialClickBlocker.classList.add('visible'); // Blocker aktivieren
    } else {
        orientationMessage.classList.remove('visible');
        // Blocker nur entfernen, wenn Fullscreen auch aktiv ist oder gar nicht benötigt wird
        if (isFullscreen) { // Wenn bereits Fullscreen, kann der Blocker weg
            initialClickBlocker.classList.remove('visible');
        } else { // Ansonsten Fullscreen-Nachricht anzeigen
             checkFullscreenStatus();
        }
    }
}

/**
 * Überprüft den Fullscreen-Status und zeigt ggf. eine Meldung an.
 */
function checkFullscreenStatus() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
        isFullscreen = false;
        if (!isPortrait) { // Nur anzeigen, wenn nicht im Portrait-Modus (da dort Orientierungsmeldung Priorität hat)
            fullscreenMessage.classList.add('visible');
            initialClickBlocker.classList.add('visible'); // Blocker aktivieren
        }
    } else {
        isFullscreen = true;
        fullscreenMessage.classList.remove('visible');
        if (!isPortrait) { // Blocker nur entfernen, wenn auch die Orientierung stimmt
            initialClickBlocker.classList.remove('visible');
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

// Event Listener für Fullscreen-Button
enterFullscreenButton.addEventListener('click', enterFullscreen);

// Event Listener für Fullscreen-Änderungen und Orientierung
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


// --- INITIALER START DER ANWENDUNG ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM geladen. Starte Initialisierung...");

    // Zeige zuerst den Initial Click Blocker, um unerwünschte Interaktionen zu verhindern
    initialClickBlocker.classList.add('visible');

    // Initialen Status prüfen
    checkOrientation();
    checkFullscreenStatus();

    // Wenn der Click Blocker noch da ist (wegen Orientierung oder Fullscreen),
    // darf die App noch nicht zum Login-Screen springen.
    // Der Login-Screen wird erst gezeigt, wenn der Blocker entfernt wird
    // (d.h., wenn Orientierung und Fullscreen passen).
    // Ansonsten zeigen wir direkt den Login-Screen, wenn alles andere OK ist.

    // Wenn der Blocker NICHT sichtbar ist (oder sobald er nicht mehr sichtbar ist),
    // fahren wir mit der Authentifizierung fort.
    // Dies ist etwas komplexer, da es vom Nutzer-Input abhängt.

    // Eine sicherere Methode: Wir starten immer mit dem Blocker und
    // blenden den Login oder das Spiel erst ein, wenn der Blocker verschwindet.
    // Der Blocker verschwindet, wenn checkOrientation/checkFullscreenStatus
    // ihn als 'hidden' markieren.

    // Wir rufen die Authentifizierung nur auf, wenn der Blocker entfernt wurde.
    // Dies kann durch einen Listener auf den Blocker oder durch eine direkte Prüfung geschehen.

    // Einfache Logik für den Start (muss nach dem Fullscreen/Orientierung aufgelöst sein):
    if (!orientationMessage.classList.contains('visible') && !fullscreenMessage.classList.contains('visible')) {
        initialClickBlocker.classList.remove('visible'); // Blocker entfernen, wenn keine Meldungen angezeigt werden
        await tryAuthenticateAndInit();
    } else {
        // Falls Meldungen aktiv sind, warten wir, bis der Blocker durch die User-Interaktion verschwindet.
        // Die Authentifizierung wird dann ausgelöst, sobald der Blocker in `hidden` Zustand wechselt.
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (initialClickBlocker.classList.contains('hidden') && currentGameState === 'loading') {
                        observer.disconnect(); // Beobachter stoppen
                        tryAuthenticateAndInit();
                    }
                }
            }
        });
        observer.observe(initialClickBlocker, { attributes: true });
    }
});

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
    } else if (await checkTokenValidity()) { // Versuche, Token aus localStorage zu verwenden/aktualisieren
        console.log("Token aus localStorage gültig oder erfolgreich aktualisiert.");
        initSpotifyPlayer();
    } else {
        // Wenn keine gültigen Tokens vorhanden, zeige Login-Bildschirm
        console.log("Keine gültigen Tokens. Zeige Login-Bildschirm.");
        showLoginScreen();
    }
}

// Event Listener für den Spotify Login Button
if (spotifyLoginButton) {
    spotifyLoginButton.addEventListener('click', authorizeSpotify);
}
