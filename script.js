// --- ALLGEMEINE KONSTANTEN & VARIABLEN (Startbildschirm & UI) ---
const logo = document.getElementById('game-logo');
const logoContainer = document.getElementById('logo-container');
const loginArea = document.getElementById('login-area');
const spotifyLoginButton = document.getElementById('spotify-login-button');
const initialClickBlocker = document.getElementById('initial-click-blocker');
const orientationMessage = document.getElementById('orientation-message');
const fullscreenMessage = document.getElementById('fullscreen-message');
const gameContainer = document.querySelector('.game-container'); // Hier bleibt .game-container

// Spotify UI-Elemente
const playbackStatus = document.getElementById('playback-status');

// NEU: Würfel UI-Elemente
const diceContainer = document.getElementById('dice-container');
const diceAnimation = document.getElementById('dice-animation');
const diceButtonsContainer = document.getElementById('dice-buttons');
const diceButtons = document.querySelectorAll('.dice-button'); // Alle Würfel-Buttons


// --- SPOTIFY KONSTANTEN ---
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6';
const REDIRECT_URI = 'https://dookye.github.io/TRACK-ATTACK/'; // Deine GitHub Pages URL
const PLAYLIST_ID = '39sVxPTg7BKwrf2MfgrtcD'; // Punk Rock (90's & 00's)
const SCOPES = [
    'user-read-private',
    'user-read-email',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state'
];

// --- SPOTIFY API ENDPUNKTE (KORREKTE SPOTIFY-URLS!) ---
const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL     = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL  = 'https://api.spotify.com/v1';


// --- GLOBALE ZUSTANDSVARIABLEN ---
let accessToken = '';
let player = null;
let currentPlaylistTracks = [];
let activeDeviceId = null;
let isPlayerReady = false; // Flag, wenn der SDK-Player verbunden ist
let isSpotifySDKLoaded = false; // Flag, wenn das SDK geladen ist
let fullscreenRequested = false; // Zur Steuerung des Fullscreen-States
let logoClickListener = null; // Für den dynamischen Klick-Listener des Logos
let currentGameState = 'loading'; // Zustände: 'loading', 'startScreen', 'diceSelect', 'playing', 'songPlaying', 'songPaused', 'genreSelect', 'resolutionPhase'
let introAnimationPlayed = false; // Flag, ob die Logo-Intro-Animation schon einmal lief

// NEU für Spieler & Rundenmanagement
let activePlayer = 1; // 1 für Spieler 1 (Blau), 2 für Spieler 2 (Pink) - Spieler 1 startet
let playerScores = { 1: 0, 2: 0 }; // Punktstände der Spieler
let currentRound = 0; // Aktuelle Runde, startet bei 0 und zählt hoch
const MAX_ROUNDS_PER_PLAYER = 10; // Max. Runden pro Spieler
const TOTAL_GAME_ROUNDS = MAX_ROUNDS_PER_PLAYER * 2; // Gesamtrunden (20 Songs)

// NEU für Würfel & Song-Parameter
const DICE_PARAMETERS = {
    3: { maxPoints: 3, playDurationSec: 7, repetitions: 2 }, // 3 Hördurchgänge (1. Hören + 2 Wiederholungen)
    4: { maxPoints: 4, playDurationSec: 7, repetitions: 3 }, // 4 Hördurchgänge
    5: { maxPoints: 5, playDurationSec: 7, repetitions: 4 }, // 5 Hördurchgänge
    7: { maxPoints: 7, playDurationSec: 2, repetitions: 7 }  // 8 Hördurchgänge
};
let currentDiceRoll = null; // Der vom Spieler gewählte Würfelwert für die aktuelle Runde
let currentSongRepetitionsLeft = 0; // Verbleibende Wiederholungen für den aktuellen Song
let currentMaxPointsForSong = 0; // Maximale Punkte für den aktuellen Song (passt sich mit Wiederholungen an)
let currentPlayingTrack = null; // Speichert den aktuell abgespielten Track (für Auflösung)
let currentPlayStartPosition = 0; // Speichert die Startposition des aktuellen Songs
let isResolvingSong = false; // Flag für die Auflösungsphase


// --- PKCE HELFER-FUNKTIONEN ---
function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// --- SPOTIFY AUTH & PLAYER FUNKTIONEN ---

/**
 * Leitet den Benutzer zum Spotify-Login weiter (PKCE Flow).
 */
async function redirectToSpotifyAuthorize() {
    console.log("redirectToSpotifyAuthorize: Leite zu Spotify Authorize um.");
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    localStorage.setItem('code_verifier', codeVerifier);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
    });

    // Korrekte URL für Spotify Authorize
    window.location.href = `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Tauscht den Authorization Code gegen ein Access Token aus.
 * Wird nach dem Redirect von Spotify aufgerufen.
 * @param {string} code - Der Authorization Code von Spotify.
 */
async function exchangeCodeForTokens(code) {
    console.log("exchangeCodeForTokens: Starte Token-Austausch mit Spotify.");
    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) {
        console.error('exchangeCodeForTokens: Code Verifier nicht gefunden. Kann Token nicht austauschen.');
        playbackStatus.textContent = 'Fehler: Code Verifier fehlt. Bitte versuche den Login erneut.';
        alert('Fehler: Code Verifier nicht gefunden. Bitte versuche den Login erneut.');
        showLoginScreen();
        return false;
    }

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
    });

    try {
        const response = await fetch(SPOTIFY_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Fehler beim Token-Austausch: ${response.status} - ${errorData.error_description || response.statusText}`);
        }

        const data = await response.json();
        accessToken = data.access_token;
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('expires_in', Date.now() + data.expires_in * 1000); // Ablaufzeitpunkt speichern

        console.log('exchangeCodeForTokens: Access Token erfolgreich erhalten und gespeichert.');
        localStorage.removeItem('code_verifier');
        return true;

    } catch (error) {
        console.error('exchangeCodeForTokens: Fehler beim Token-Austausch:', error);
        playbackStatus.textContent = 'Fehler beim Spotify Login. Bitte versuche es erneut.';
        alert('Fehler beim Spotify Login. Bitte versuche es erneut. Stelle sicher, dass du einen Premium Account hast.');
        showLoginScreen();
        return false;
    }
}

/**
 * Initialisiert und verbindet den Spotify Player.
 */
async function initializeSpotifyPlayer() {
    console.log('initializeSpotifyPlayer: Versuche Spotify Player zu initialisieren...');

    if (!isSpotifySDKLoaded) {
        console.warn('initializeSpotifyPlayer: SDK noch nicht geladen. Warte auf window.onSpotifyWebPlaybackSDKReady.');
        return;
    }
    if (!accessToken || localStorage.getItem('expires_in') < Date.now()) {
        console.warn('initializeSpotifyPlayer: Access Token fehlt oder ist abgelaufen. Zeige Login-Screen.');
        playbackStatus.textContent = 'Fehler: Spotify Session abgelaufen oder nicht angemeldet. Bitte neu anmelden.';
        showLoginScreen();
        return;
    }

    if (player) {
        console.log('initializeSpotifyPlayer: Spotify Player bereits initialisiert. Nichts zu tun.');
        playbackStatus.textContent = 'Spotify Player verbunden!';
        handlePlayerReady();
        return;
    }

    if (typeof Spotify === 'undefined' || typeof Spotify.Player === 'undefined') {
        console.error('initializeSpotifyPlayer: Spotify Web Playback SDK (Spotify.Player) ist nicht verfügbar.');
        playbackStatus.textContent = 'Spotify SDK nicht geladen. Bitte überprüfe deine Internetverbindung.';
        return;
    }

    playbackStatus.textContent = 'Spotify Player wird verbunden...';
    player = new Spotify.Player({
        name: 'TRACK ATTACK Player',
        getOAuthToken: cb => { cb(accessToken); },
        volume: 0.5
    });

    player.addListener('ready', ({ device_id }) => {
        console.log('Player.ready: Spotify Player ist bereit auf Gerät-ID:', device_id);
        activeDeviceId = device_id;
        isPlayerReady = true;
        playbackStatus.textContent = 'Spotify Player verbunden!';
        transferPlayback(device_id);
        console.log("Spotify Player ready! Du bist jetzt eingeloggt und der Player ist bereit.");
        handlePlayerReady();
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.warn('Player.not_ready: Gerät-ID nicht bereit:', device_id);
        playbackStatus.textContent = 'Spotify Player ist nicht bereit. Ist Spotify im Browser offen?';
        isPlayerReady = false;
    });

    player.addListener('initialization_error', ({ message }) => {
        console.error('Player.initialization_error:', message);
        playbackStatus.textContent = `Fehler beim Initialisieren des Players: ${message}`;
        isPlayerReady = false;
        alert('Fehler beim Initialisieren des Spotify Players. Versuche es erneut.');
        showLoginScreen();
    });

    player.addListener('authentication_error', ({ message }) => {
        console.error('Player.authentication_error:', message);
        playbackStatus.textContent = 'Authentifizierungsfehler. Bitte logge dich erneut ein.';
        alert('Deine Spotify-Sitzung ist abgelaufen oder ungültig. Bitte logge dich erneut ein.');
        isPlayerReady = false;
        showLoginScreen();
    });

    player.addListener('account_error', ({ message }) => {
        console.error('Player.account_error:', message);
        playbackStatus.textContent = 'Account-Fehler. Hast du einen Spotify Premium Account?';
        alert('Es gab einen Fehler mit deinem Spotify Account. Für dieses Spiel ist ein Premium Account erforderlich.');
        isPlayerReady = false;
        showLoginScreen();
    });

    player.addListener('playback_error', ({ message }) => {
        console.error('Player.playback_error:', message);
        playbackStatus.textContent = `Wiedergabefehler: ${message}`;
    });

    player.addListener('player_state_changed', (state) => {
        if (!state) {
            return;
        }
    });

    player.connect().then(success => {
        if (success) {
            console.log('Player.connect: Der Web Playback SDK Player wurde erfolgreich verbunden (wartet auf "ready"-Status).');
        } else {
            console.warn('Player.connect: Verbindung zum Web Playback SDK Player fehlgeschlagen.');
            playbackStatus.textContent = 'Verbindung zum Spotify Player fehlgeschlagen.';
        }
    }).catch(err => {
        console.error('Player.connect Fehler:', err);
        playbackStatus.textContent = `Verbindung zum Player fehlgeschlagen: ${err.message}`;
    });
}

/**
 * Globaler Callback für das Spotify Web Playback SDK.
 * WIRD VOM SDK AUFGERUFEN, SOBALD ES GELADEN IST.
 */
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('window.onSpotifyWebPlaybackSDKReady: Spotify Web Playback SDK ist bereit.');
    isSpotifySDKLoaded = true;

    if (accessToken) {
        console.log("window.onSpotifyWebPlaybackSDKReady: Access Token vorhanden, initialisiere Player.");
        initializeSpotifyPlayer();
    } else {
        console.log("window.onSpotifyWebPlaybackSDKReady: Kein Access Token vorhanden. Warte auf Login.");
        showLoginScreen();
    }
};

/**
 * Überträgt die Wiedergabe auf den neu erstellten Web Playback SDK Player.
 * @param {string} deviceId - Die ID des Players, auf den übertragen werden soll.
 */
async function transferPlayback(deviceId) {
    console.log('transferPlayback: Versuche Wiedergabe auf Gerät', deviceId, 'zu übertragen.');
    try {
        const response = await fetch(`${SPOTIFY_API_BASE_URL}/me/player`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Fehler beim Übertragen der Wiedergabe: ${response.status} - ${errorData.error.message || response.statusText}`);
        }
        console.log('transferPlayback: Wiedergabe auf neuen Player übertragen.');

    } catch (error) {
        console.error('transferPlayback Fehler:', error);
        playbackStatus.textContent = `Fehler beim Aktivieren des Players: ${error.message}`;
    }
}

/**
 * Holt die Tracks einer bestimmten Playlist.
 */
async function getPlaylistTracks() {
    if (currentPlaylistTracks.length > 0) {
        return currentPlaylistTracks;
    }
    console.log('getPlaylistTracks: Lade Tracks aus Playlist...');
    try {
        let allTracks = [];
        let nextUrl = `${SPOTIFY_API_BASE_URL}/playlists/${PLAYLIST_ID}/tracks?limit=100`;

        while (nextUrl) {
            const response = await fetch(nextUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Fehler beim Laden der Playlist-Tracks: ${response.status} - ${errorData.error.message || response.statusText}`);
            }

            const data = await response.json();
            allTracks = allTracks.concat(data.items.filter(item => item.track && !item.track.is_local));
            nextUrl = data.next;
        }
        currentPlaylistTracks = allTracks;
        console.log(`getPlaylistTracks: Geladene Tracks aus Playlist: ${currentPlaylistTracks.length}`);
        if (currentPlaylistTracks.length === 0) {
            console.warn('getPlaylistTracks: Keine spielbaren Tracks in der Playlist gefunden.');
            playbackStatus.textContent = 'Achtung: Keine spielbaren Tracks in der Playlist gefunden. Stelle sicher, dass die Playlist Tracks enthält und in deinem Markt verfügbar sind.';
        }
        return currentPlaylistTracks;
    } catch (error) {
        console.error('getPlaylistTracks Fehler:', error);
        playbackStatus.textContent = `Fehler beim Laden der Playlist: ${error.message}`;
        return [];
    }
}

/**
 * Wählt einen zufälligen Song aus der globalen Playlist aus.
 * @returns {Object|null} Ein Track-Objekt von Spotify oder null bei Fehler.
 */
async function selectRandomSongForRound() {
    try {
        const tracks = await getPlaylistTracks(); // Stelle sicher, dass diese Funktion die Tracks liefert
        if (tracks.length === 0) {
            console.warn('Keine Tracks verfügbar für die Auswahl.');
            return null;
        }
        const randomTrackItem = tracks[Math.floor(Math.random() * tracks.length)];
        return randomTrackItem;
    } catch (error) {
        console.error("Fehler beim Auswählen eines zufälligen Songs:", error);
        return null;
    }
}

/**
 * Spielt den aktuellen Song basierend auf den Würfelparametern ab.
 * Startet an einer zufälligen Position und spielt für die definierte Dauer.
 */
async function playSongBasedOnDice() {
    if (!currentPlayingTrack) { // Wenn noch kein Song ausgewählt wurde (erster Durchgang)
        currentPlayingTrack = await selectRandomSongForRound(); // Holt einen neuen zufälligen Song
        if (!currentPlayingTrack) {
            playbackStatus.textContent = 'Fehler: Konnte keinen Song auswählen.';
            return;
        }
    }

    if (!isPlayerReady || !player || !activeDeviceId) {
        playbackStatus.textContent = 'Spotify Player ist noch nicht bereit oder verbunden. Bitte warten...';
        return;
    }

    playbackStatus.textContent = 'Spiele Song...';
    logo.classList.remove('active-logo');
    logo.classList.add('inactive-logo'); // Logo inaktiv machen, während Song läuft

    const trackUri = currentPlayingTrack.track.uri;
    const trackDurationMs = currentPlayingTrack.track.duration_ms;
    const playDurationMs = DICE_PARAMETERS[currentDiceRoll].playDurationSec * 1000;

    // Eine neue zufällige Startposition für jede Wiederholung
    const maxStartPositionMs = trackDurationMs - playDurationMs - 1000; // Mindestens 1 Sekunde Puffer am Ende
    currentPlayStartPosition = Math.floor(Math.random() * (maxStartPositionMs > 0 ? maxStartPositionMs : 0));
    if (currentPlayStartPosition < 0) currentPlayStartPosition = 0; // Sicherstellen, dass es nicht negativ wird


    console.log(`Spiele ${currentPlayingTrack.track.name} von ${currentPlayingTrack.track.artists[0].name} ` +
                `ab Position ${currentPlayStartPosition}ms für ${playDurationMs}ms.`);

    try {
        await player.activateElement();

        await fetch(`${SPOTIFY_API_BASE_URL}/me/player/play?device_id=${activeDeviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                uris: [trackUri],
                position_ms: currentPlayStartPosition
            })
        });

        currentSongRepetitionsLeft--; // Eine Wiederholung verbraucht
        currentMaxPointsForSong = Math.max(0, currentMaxPointsForSong - 1); // Punkte abziehen (Minimum 0)

        setTimeout(async () => {
            await player.pause();
            playbackStatus.textContent = `Song beendet. ${currentSongRepetitionsLeft + 1} Hördurchgänge verbleiben.`;
            currentGameState = 'playing'; // Zurück zum Zustand, wo man auf den Logo-Button klicken kann

            if (currentSongRepetitionsLeft < 0) { // Alle Versuche aufgebraucht (0 oder weniger, da es runterzählt)
                console.log("Alle Hördurchgänge verbraucht. Zeige Auflösen-Buttons.");
                startResolutionPhase(); // Leite zur Auflösungsphase über
            } else {
                setLogoAsPlayButton(true); // Logo wieder aktivieren für nächste Wiederholung
            }
        }, playDurationMs);

    } catch (error) {
        console.error('playSongBasedOnDice Fehler:', error);
        playbackStatus.textContent = `Fehler beim Abspielen: ${error.message}`;
        // Hier könntest du spezifischere Fehlermeldungen anzeigen, z.B. bei Premium-Fehlern
    }
}

// --- UI STEUERUNGSFUNKTIONEN ---

/**
 * Aktualisiert den Hintergrund des Spielcontainers basierend auf dem aktiven Spieler
 * und startet optional einen Callback nach Abschluss der Hintergrund-Transition.
 * @param {function} [callback] - Eine optionale Funktion, die nach der Hintergrund-Transition ausgeführt wird.
 */
function updatePlayerBackground(callback = null) {
    // ZUERST: Sicherstellen, dass jeder zuvor gesetzte Inline-Style entfernt wird
    gameContainer.style.backgroundColor = ''; // <-- NEU: Inline-Hintergrundfarbe entfernen!
    
    // Sicherstellen, dass alle spezifischen Hintergrundklassen entfernt werden, bevor eine neue hinzugefügt wird
    gameContainer.classList.remove('player1-active-bg', 'player2-active-bg', 'score-screen-bg');

    // NEU: Erzwinge einen Reflow (macht den Browser auf CSS-Änderung aufmerksam)
    // Dies ist ein alter Trick, um Browser zu zwingen, Styles neu zu berechnen.
    void gameContainer.offsetWidth;

    // Füge die Klasse für den aktiven Spieler hinzu
    if (activePlayer === 1) {
        gameContainer.classList.add('player1-active-bg');
    } else {
        gameContainer.classList.add('player2-active-bg');
    }
    console.log(`Hintergrund aktualisiert für Spieler ${activePlayer}`);

    const backgroundTransitionDurationMs = 2000;

    if (callback && typeof callback === 'function') {
        setTimeout(callback, backgroundTransitionDurationMs);
    }
}

/**
 * Wechselt den aktiven Spieler von 1 zu 2 oder umgekehrt.
 * Aktualisiert anschließend den Hintergrund und startet die nächste Phase.
 */
function switchPlayer() {
    activePlayer = (activePlayer === 1) ? 2 : 1;
    console.log(`Spieler gewechselt. Aktiver Spieler: ${activePlayer}`);
    currentRound++; // Runde erhöhen
    console.log(`Starte Runde ${Math.ceil(currentRound / 2)} für Spieler ${activePlayer}`);

    if (currentRound >= TOTAL_GAME_ROUNDS) {
        // Wenn max. Runden erreicht, direkt Spiel beenden
        endGame();
    } else {
        // Hier rufen wir updatePlayerBackground mit einem Callback auf
        // Die Würfelphase startet erst NACHDEM der Hintergrund gewechselt ist
        updatePlayerBackground(() => {
            startDiceRollPhase(); // Startet die Würfelphase nach dem Hintergrundübergang
        });
    }
}

/**
 * Startet die Würfel-Phase: Zeigt die Würfel-Animation an und danach die Auswahl-Buttons.
 */
function startDiceRollPhase() {
    console.log(`startDiceRollPhase: Spieler ${activePlayer} würfelt.`);
    hideAllGameUI(); // Stellt sicher, dass alles andere ausgeblendet ist

    // Logo-Button inaktiv machen
    setLogoAsPlayButton(false);

    playbackStatus.textContent = `Spieler ${activePlayer} würfelt...`;

    // Würfel-Container einblenden und Animation starten
    diceContainer.classList.remove('hidden');
    diceAnimation.classList.remove('hidden'); // GIF anzeigen
    diceButtonsContainer.classList.add('hidden'); // Buttons noch verstecken

    // Die Dauer der GIF-Animation anpassen (hier 2 Sekunden)
    const animationDurationMs = 2000;

    setTimeout(() => {
        console.log("Würfel-Animation beendet. Zeige Würfelwahl-Buttons.");
        diceAnimation.classList.add('hidden'); // GIF ausblenden
        diceButtonsContainer.classList.remove('hidden'); // Buttons einblenden
        playbackStatus.textContent = 'Wähle deinen Würfelwert!';
        currentGameState = 'diceSelect'; // Neuer Zustand: Warten auf Würfelwahl

        // Event-Listener für die Würfel-Buttons hinzufügen
        diceButtons.forEach(button => {
            button.addEventListener('pointerdown', handleDiceSelection, { once: true }); // { once: true } sorgt dafür, dass der Listener nach einmaliger Ausführung entfernt wird
        });

    }, animationDurationMs);
}

/**
 * Behandelt die Auswahl eines Würfel-Buttons durch den Spieler.
 * @param {Event} event - Das Klick-Event des Buttons.
 */
function handleDiceSelection(event) {
    event.preventDefault(); // Verhindert Standardverhalten (z.B. bei Touch)

    if (currentGameState !== 'diceSelect') {
        console.warn("handleDiceSelection: Nicht im 'diceSelect' Zustand, ignoriere Klick.");
        return;
    }

    // --- Bounce-Effekt für den geklickten Würfel-Button ---
    const clickedButton = event.currentTarget;
    clickedButton.classList.remove('logo-bounce');
    void clickedButton.offsetWidth; // Erzwingt Reflow
    clickedButton.classList.add('logo-bounce');
    // --- ENDE BOUNCE-EFFEKT ---
    
    // Entferne alle anderen Listener, falls doch nicht { once: true } verwendet wird
    diceButtons.forEach(button => {
        button.removeEventListener('pointerdown', handleDiceSelection);
    });

    const selectedDiceValue = parseInt(event.currentTarget.dataset.diceValue, 10);
    currentDiceRoll = selectedDiceValue;
    currentMaxPointsForSong = DICE_PARAMETERS[selectedDiceValue].maxPoints;
    currentSongRepetitionsLeft = DICE_PARAMETERS[selectedDiceValue].repetitions;

    console.log(`Würfel ${selectedDiceValue} gewählt. Max Punkte: ${currentMaxPointsForSong}, Wiederholungen: ${currentSongRepetitionsLeft}`);

    // Würfel-UI ausblenden
    diceContainer.classList.add('hidden');
    diceAnimation.classList.add('hidden');
    diceButtonsContainer.classList.add('hidden');

    // Weiter zur Genre-Auswahlphase
    startGenreSelectionPhase();
}

/**
 * Hilfsfunktion zum Ausblenden aller relevanten Game-UI-Elemente,
 * bevor eine neue Phase (z.B. Würfeln) beginnt.
 * Diese Funktion muss erweitert werden, sobald du mehr UI-Elemente hast.
 */
function hideAllGameUI() {
    console.log("Alle Game UI Elemente ausgeblendet.");
    // NEU: Dice Container ausblenden
    diceContainer.classList.add('hidden');
    diceAnimation.classList.add('hidden');
    diceButtonsContainer.classList.add('hidden');

    // Beispiel: Auflösen-Button, Richtig/Falsch-Buttons, Titel/Interpret-Anzeige
    // Diese Elemente werden später implementiert. Füge hier deren `classList.add('hidden');` hinzu.
}

// Platzhalter für die Genre-Auswahlphase (noch zu implementieren)
function startGenreSelectionPhase() {
    currentGameState = 'genreSelect';
    playbackStatus.textContent = `Wähle ein Genre für Spieler ${activePlayer}!`;
    console.log("Platzhalter: Starte Genre-Auswahlphase.");
    // Hier würde die UI für die Genre-Auswahl erscheinen
    // Für jetzt simulieren wir einfach einen direkten Übergang zum Song-Abspielen
    setTimeout(() => {
        console.log("Simuliere Genre-Auswahl. Bereite Song für Wiedergabe vor.");
        playbackStatus.textContent = 'Klicke auf das Logo zum Abspielen des Songs!';
        currentGameState = 'playing'; // Song ist bereit zum Abspielen
        setLogoAsPlayButton(true); // Logo wird wieder zum Play-Button
    }, 3000);
}

/**
 * Aktualisiert die Anzeige der Spielerpunkte.
 * Diese Funktion muss die HTML-Elemente ansprechen, die die Punkte anzeigen.
 * (Muss noch in HTML und hier implementiert werden)
 */
function updatePlayerScoresDisplay() {
    console.log(`Spielstand: Spieler 1: ${playerScores[1]}, Spieler 2: ${playerScores[2]}`);
    // Beispiel: Wenn du P-Tags mit IDs 'player1-score' und 'player2-score' hast:
    // document.getElementById('player1-score').textContent = `Spieler 1: ${playerScores[1]} Punkte`;
    // document.getElementById('player2-score').textContent = `Spieler 2: ${playerScores[2]} Punkte`;
    // FÜGE HIER DIE LOGIK HINZU, UM DEINE PUNKTANZEIGE ZU AKTUALISIEREN
}

/**
 * Startet die Auflösungsphase, in der der Songtitel und Interpret angezeigt werden.
 * Der Hintergrund wird NICHT hier auf den Score-Screen-Gradienten gewechselt,
 * sondern nur in `endGame()`.
 */
async function startResolutionPhase() {
    if (isResolvingSong) return; // Verhindert mehrfaches Aufrufen
    isResolvingSong = true;
    currentGameState = 'resolutionPhase';
    setLogoAsPlayButton(false); // Logo inaktiv, da jetzt Auflösung stattfindet
    console.log("Starte Auflösungsphase. Zeige Titel/Interpret und Richtig/Falsch-Buttons.");

    playbackStatus.textContent = `Auflösung: ${currentPlayingTrack.track.name} von ${currentPlayingTrack.track.artists.map(a => a.name).join(', ')}`;

    // Optional: Song auf halber Lautstärke abspielen lassen ab Sekunde 30
    if (player && currentPlayingTrack.track.duration_ms > 30000) {
        await player.setVolume(0.25); // Halbe Lautstärke für Auflösung
        await player.seek(30000); // Springt zu 30 Sekunden
        await player.resume();
        console.log("Song spielt auf halber Lautstärke ab Sekunde 30.");
    } else if (player) { // Wenn der Song kürzer ist, einfach ab Beginn spielen
        await player.setVolume(0.25);
        await player.seek(0);
        await player.resume();
        console.log("Song spielt auf halber Lautstärke ab Beginn.");
    }

    // ACHTUNG: Der Hintergrundwechsel zum Score-Screen-BG erfolgt HIER NICHT MEHR!
    // Er ist ausschließlich der `endGame()` Funktion vorbehalten.
    // gameContainer.classList.remove('player1-active-bg', 'player2-active-bg');
    // gameContainer.classList.add('score-screen-bg'); // DIESE ZEILE WIRD ENTFERNT

    // Hier würden die "Richtig" und "Falsch" Buttons erscheinen
    // und ihre Klicks würden dann z.B. eine Funktion handleGuess(isCorrect) aufrufen.
    // Für jetzt simulieren wir einfach einen direkten Übergang
    setTimeout(() => {
        console.log("Simuliere Richtig-Klick.");
        handleGuess(true); // Simuliere einen richtigen Tipp
    }, 5000); // 5 Sekunden für die Auflösung/Bewertung
}


/**
 * Behandelt die Logik, nachdem der Spieler geraten oder die Zeit abgelaufen ist.
 * Aktualisiert Punkte und wechselt den Spieler/beendet das Spiel.
 * @param {boolean} isCorrect - True, wenn der Spieler richtig geraten hat, False sonst.
 */
async function handleGuess(isCorrect) {
    console.log(`Spieler ${activePlayer} hat ${isCorrect ? 'richtig' : 'falsch'} geraten.`);
    isResolvingSong = false; // Auflösungsphase beendet

    if (player) {
        await player.pause(); // Song stoppen
        await player.setVolume(0.5); // Lautstärke zurücksetzen
    }

    if (isCorrect) {
        playerScores[activePlayer] += currentMaxPointsForSong;
        playbackStatus.textContent = `Richtig!`; // Nur "Richtig!" anzeigen
    } else {
        playbackStatus.textContent = `Falsch!`; // Nur "Falsch!" anzeigen
    }

    // UI-Elemente zurücksetzen/ausblenden, die zur Ratephase gehören
    // z.B. hideResolveButton(), hideGuessButtons() (noch zu implementieren)
    // songInfo.classList.add('hidden');

    // ACHTUNG: gameContainer.classList.remove('score-screen-bg'); WIRD HIER ENTFERNT!
    // Der Score-Screen-Hintergrund wird nur in endGame() gesetzt und im resetGame() entfernt.

    updatePlayerScoresDisplay(); // Aktualisiert die Punkteanzeige (muss existieren)

    currentPlayingTrack = null; // Für die nächste Runde zurücksetzen
    currentDiceRoll = null; // Würfel zurücksetzen
    currentMaxPointsForSong = 0; // Punkte zurücksetzen
    currentSongRepetitionsLeft = 0; // Wiederholungen zurücksetzen

    // Warte eine kurze Zeit, bevor das Spiel zum nächsten Spieler wechselt oder endet
    setTimeout(() => {
        // Prüfe hier zusätzlich, ob das Spiel beendet ist.
        // Die Spielendebedingung TOTAL_GAME_ROUNDS ist hier ausschlaggebend,
        // da Punkteziel nicht mehr sichtbar ist.
        if (currentRound >= TOTAL_GAME_ROUNDS || playerScores[1] >= 50 || playerScores[2] >= 50) { // Beispiel: Spielende bei 50 Punkten
            endGame();
        } else {
            // KEIN gameContainer.classList.remove('score-screen-bg'); HIER!
            switchPlayer(); // Nächsten Spieler dran
        }
    }, 2000); // 2 Sekunden warten, bevor der Spieler wechselt/Spiel endet
}

// Platzhalter-Funktion für das Spielende
function endGame() {
    console.log("Spiel beendet! Zeige Auswertungsscreen.");
    currentGameState = 'gameEnded';

    // *** HIER WIRD DER SCORE-SCREEN-BG HINZUGEFÜGT! ***
    gameContainer.classList.remove('player1-active-bg', 'player2-active-bg'); // Sicherstellen, dass andere BGs weg sind
    gameContainer.classList.add('score-screen-bg');
    console.log("Hintergrund auf Score-Screen für Spielende gesetzt.");

    // HIER DIE LOGIK FÜR DEN AUSWERTUNGSSCREEN MIT PUNKTEN
    playbackStatus.textContent = `Spiel beendet! Spieler 1: ${playerScores[1]} Punkte, Spieler 2: ${playerScores[2]} Punkte.`;

    // Reset game state for new game
    setTimeout(() => {
        resetGame(); // Spiel zurücksetzen
    }, 7000); // 7 Sekunden Auswertungsscreen
}

// Platzhalter-Funktion zum Zurücksetzen des Spiels
function resetGame() {
    console.log("Spiel wird zurückgesetzt.");
    activePlayer = 1;
    playerScores = { 1: 0, 2: 0 };
    currentRound = 0; // Wichtig: Runden zählen, um endGame zu triggern
    currentDiceRoll = null;
    currentPlayingTrack = null;
    introAnimationPlayed = false; // Animation wieder erlauben
    isResolvingSong = false;

    // UI auf Startzustand zurücksetzen
    showLoginScreen(); // Oder direkt zum Logo, wenn schon eingeloggt
    // Entferne ALLE Spieler-Hintergrund-Klassen UND den Score-Screen-Hintergrund beim Reset
    gameContainer.classList.remove('player1-active-bg', 'player2-active-bg', 'score-screen-bg');
    gameContainer.style.backgroundColor = 'black'; // Setze den Hintergrund auf schwarz zurück
    console.log("Spielhintergrund auf Schwarz zurückgesetzt (nach Reset).");

    if (isPlayerReady && !document.fullscreenElement) {
        checkOrientationAndFullscreen();
    } else if (isPlayerReady) {
        showLogoButton();
    }
}


/**
 * Wird aufgerufen, wenn der Spotify Player erfolgreich initialisiert wurde.
 * Leitet zur Orientierungs-/Fullscreen-Prüfung weiter.
 */
function handlePlayerReady() {
    console.log("handlePlayerReady: Spotify Player ist verbunden. Starte Orientierungs-/Fullscreen-Check.");
    loginArea.classList.add('hidden'); // Login-Bereich ausblenden

    checkOrientationAndFullscreen(); // Jetzt den Orientierungs- und Fullscreen-Check starten
}

/**
 * Zeigt den Login-Screen an.
 */
function showLoginScreen() {
    console.log("showLoginScreen: Zeige Login-Bereich.");
    logoContainer.classList.add('hidden', 'initial-hidden'); // Logo ausblenden und initial positionieren
    loginArea.classList.remove('hidden');
    // Stellen Sie sicher, dass der Hintergrund wieder schwarz ist, wenn zum Login gewechselt wird
    gameContainer.classList.remove('player1-active-bg', 'player2-active-bg', 'score-screen-bg');
    gameContainer.style.backgroundColor = 'black';
    console.log("Spielhintergrund auf Schwarz zurückgesetzt (Login Screen).");
    currentGameState = 'loading'; // Oder 'loginScreen'
}

/**
 * Zeigt eine Overlay-Nachricht an (z.B. Orientierung, Fullscreen).
 * @param {HTMLElement} element - Das anzuzeigende DOM-Element.
 */
function showMessage(element) {
    element.classList.remove('hidden');
    element.classList.add('visible');
    element.style.pointerEvents = 'auto'; // Klicks auf die Nachricht erlauben
    initialClickBlocker.classList.remove('hidden'); // Blocker anzeigen
}

/**
 * Versteckt eine Overlay-Nachricht.
 * @param {HTMLElement} element - Das zu versteckende DOM-Element.
 */
function hideMessage(element) {
    element.classList.remove('visible');
    element.classList.add('hidden');
    element.style.pointerEvents = 'none'; // Klicks durch die Nachricht hindurchlassen
    initialClickBlocker.classList.add('hidden'); // Blocker ausblenden
}

/**
 * Überprüft die Geräteorientierung und den Fullscreen-Status und zeigt entsprechende Meldungen an.
 */
function checkOrientationAndFullscreen() {
    console.log("checkOrientationAndFullscreen: Überprüfe Orientierung und Fullscreen.");
    fullscreenRequested = false; // Reset des Flags für neue Fullscreen-Aufforderung

    if (window.innerHeight > window.innerWidth) { // Hochformat (Portrait)
        console.log("checkOrientationAndFullscreen: Hochformat erkannt. Zeige Orientierungs-Meldung.");
        showMessage(orientationMessage);
        hideMessage(fullscreenMessage);
        // Listener entfernen, falls er noch aktiv ist, da Orientierung falsch
        document.removeEventListener('click', activateFullscreenAndRemoveListener);
    } else { // Querformat (Landscape)
        console.log("checkOrientationAndFullscreen: Querformat erkannt.");
        hideMessage(orientationMessage);

        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msRequestFullscreen) {
               console.log("checkOrientationAndFullscreen: Zeige Fullscreen-Aufforderung.");
               showMessage(fullscreenMessage);
               // Listener hinzufügen, wenn noch nicht im Vollbild. { once: true } entfernt ihn nach dem Klick.
               document.addEventListener('click', activateFullscreenAndRemoveListener, { once: true });
        } else {
               console.log("checkOrientationAndFullscreen: Bereits im Vollbildmodus. Zeige Logo.");
               hideMessage(fullscreenMessage);
               showLogoButton(); // Zeige das Logo mit Animation (oder ohne, je nach introAnimationPlayed)
        }
    }
}

/**
 * Fordert den Vollbildmodus an.
 */
function requestFullscreen() {
    console.log("requestFullscreen: Anforderung Vollbildmodus.");
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
    } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
    } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
    }
}

/**
 * Wird bei Klick auf die Fullscreen-Aufforderung aufgerufen.
 * Leitet die Fullscreen-Anforderung ein und zeigt danach das Logo.
 */
function activateFullscreenAndRemoveListener(event) {
    console.log("activateFullscreenAndRemoveListener: Vollbildmodus-Aktivierung durch Klick.");

    // Nur reagieren, wenn der Klick auf der Fullscreen-Nachricht selbst war.
    if (!fullscreenMessage.contains(event.target)) {
        console.log("activateFullscreenAndRemoveListener: Klick nicht auf Fullscreen-Nachricht, ignoriere.");
        // Da Listener mit { once: true } gesetzt ist, muss er bei ignoriertem Klick neu hinzugefügt werden.
        document.addEventListener('click', activateFullscreenAndRemoveListener, { once: true });
        return;
    }

    if (!fullscreenRequested) {
        requestFullscreen();
        fullscreenRequested = true;
        // Listener wird durch { once: true } automatisch entfernt

        // Nach erfolgreicher Fullscreen-Anforderung das Logo anzeigen
        showLogoButton();
    }
}

/**
 * Zeigt das TRACK ATTACK Logo mit der Reinfall-Animation.
 * Aktiviert den Klick-Listener nach Abschluss der Animation.
 */
function showLogoButton() {
    // Bedingung: Wenn die Intro-Animation schon einmal lief und wir nicht im Startbildschirm-Zustand sind (z.B. Spiel läuft)
    if (introAnimationPlayed && currentGameState !== 'startScreen') {
        console.log("showLogoButton: Intro-Animation wurde bereits abgespielt. Zeige Logo ohne Animation.");
        loginArea.classList.add('hidden'); // Login ausblenden
        logoContainer.classList.remove('hidden');
        logoContainer.classList.remove('initial-hidden');
        logoContainer.style.animation = ''; // Sicherstellen, dass keine Animation aktiv ist

        // WICHTIG: Hier Logo inaktiv machen, wenn das Spiel läuft und nicht gerade ein Song ansteht
        if (currentGameState === 'playing') { // 'playing' bedeutet, wir warten auf den ersten Song-Start nach Würfeln/Genre
             setLogoAsPlayButton(true); // Logo als Play-Button aktivieren (Bereit zum ersten Song-Play)
             playbackStatus.textContent = 'Klicke auf das Logo zum Abspielen des Songs!';
        } else if (currentGameState === 'songPlaying' || currentGameState === 'resolutionPhase') {
            setLogoAsPlayButton(false);
        } else { // Wenn der Zustand "playing" ist und wir zum Abspielen bereit sind
            setLogoAsPlayButton(true); // Logo als Play-Button aktivieren
        }
        return;
    }
    // Wenn die Animation schon lief, aber wir noch im Startscreen sind (z.B. nach Fullscreen-Wechsel vor Spielstart)
    else if (introAnimationPlayed && currentGameState === 'startScreen') {
        console.log("showLogoButton: Intro-Animation lief schon, zeige Logo für Spielstart (ohne Re-Animation).");
        loginArea.classList.add('hidden'); // Login ausblenden
        logoContainer.classList.remove('hidden');
        logoContainer.classList.remove('initial-hidden');
        logoContainer.style.animation = ''; // Sicherstellen, dass keine Animation aktiv ist

        // Setze den Klick-Listener für den Spielstart
        if (logoClickListener) {
            logo.removeEventListener('pointerdown', logoClickListener);
        }
        logoClickListener = function(event) {
            event.preventDefault(); // Verhindert Standardverhalten (z.g. bei Touch)
            console.log("Logo geklickt zum Spielstart (ohne Re-Animation)!");
            logo.classList.remove('logo-bounce');
            void logo.offsetWidth;
            logo.classList.add('logo-bounce');

            if (currentGameState === 'startScreen') {
                if (isPlayerReady) {
                    console.log("Spiel wird gestartet!");
                    playbackStatus.textContent = 'Bereit zum Abspielen!';
                    currentGameState = 'diceRoll'; // NEUER Zustand

                    // NEU: updatePlayerBackground mit Callback
                    updatePlayerBackground(() => {
                        startDiceRollPhase(); // Startet die Würfelphase nach dem Hintergrundübergang
                    });
                } else {
                    console.warn("Player ist noch nicht bereit, kann Spiel nicht starten.");
                    playbackStatus.textContent = 'Spotify Player ist noch nicht bereit. Bitte warten...';
                }
            }
        };
        logo.addEventListener('pointerdown', logoClickListener);
        currentGameState = 'startScreen';
        return; // Funktion hier beenden
    }


    // Dieser Teil wird nur ausgeführt, wenn die Intro-Animation noch NICHT lief
    console.log("showLogoButton: Starte Logo-Reinfall-Animation.");
    loginArea.classList.add('hidden');
    hideMessage(fullscreenMessage);
    hideMessage(orientationMessage);

    logoContainer.classList.remove('hidden');
    logoContainer.classList.remove('initial-hidden');

    // Hier die Geschwindigkeit anpassen, z.B. 1s
    logoContainer.style.animation = 'fall-in 0.9s ease-out forwards'; // Geschwindigkeit hier einstellen!

    logoContainer.addEventListener('animationend', function handler(event) {
        if (event.animationName === 'fall-in') {
            console.log("fall-in Animation beendet. Logo ist bereit für Klicks.");
            logoContainer.removeEventListener('animationend', handler); // Listener entfernen
            logoContainer.style.animation = ''; // Animation zurücksetzen, um Styling Konflikte zu vermeiden

            introAnimationPlayed = true; // Markiere, dass die Animation gelaufen ist

            // Jetzt den Klick-Listener für den Spielstart aktivieren
            if (logoClickListener) { // Alten Listener entfernen, falls vorhanden
                logo.removeEventListener('pointerdown', logoClickListener);
            }
            logoClickListener = function(event) {
                event.preventDefault(); // Verhindert Standardverhalten (z.B. bei Touch)
                console.log("Logo geklickt zum Spielstart!");
                // Füge den kleinen Bounce-Effekt bei jedem Klick hinzu
                logo.classList.remove('logo-bounce');
                void logo.offsetWidth; // Force reflow
                logo.classList.add('logo-bounce');

                if (currentGameState === 'startScreen') {
                    if (isPlayerReady) {
                        console.log("Spiel wird gestartet!");
                        playbackStatus.textContent = 'Bereit zum Abspielen!';
                        currentGameState = 'diceRoll'; // Zustandswechsel

                        // NEU: updatePlayerBackground mit Callback
                        updatePlayerBackground(() => {
                            startDiceRollPhase(); // Startet die Würfelphase nach dem Hintergrundübergang
                        });

                    } else {
                        console.warn("Player ist noch nicht bereit, kann Spiel nicht starten.");
                        playbackStatus.textContent = 'Spotify Player ist noch nicht bereit. Bitte warten...';
                    }
                }
                    // Hinzugefügte Logik für den späteren Song-Play/Repeat
                else if (currentGameState === 'playing' || currentGameState === 'songPaused') {
                    if (isPlayerReady && currentDiceRoll) {
                        if (currentSongRepetitionsLeft >= 0) {
                            playSongBasedOnDice();
                            setLogoAsPlayButton(false);
                            currentGameState = 'songPlaying';
                        } else {
                            console.log("Keine weiteren Hördurchgänge für diesen Song mehr.");
                            playbackStatus.textContent = 'Keine weiteren Versuche. Löse den Song auf!';
                            setLogoAsPlayButton(false);
                        }
                    }
                }
            };
            logo.addEventListener('pointerdown', logoClickListener);

            // Setze den initialen Spielzustand nach der Animation
            currentGameState = 'startScreen';
            logo.classList.add('active-logo'); // Sicherstellen, dass es am Start aktiv ist
        }
    });
}

/**
 * Konfiguriert den Logo-Button als Play/Pause-Button für das Spiel.
 * @param {boolean} activate - True, um den Button zu aktivieren, False, um ihn zu deaktivieren.
 */
function setLogoAsPlayButton(activate = true) {
    if (logoClickListener) {
        logo.removeEventListener('pointerdown', logoClickListener);
    }

    if (activate) {
        console.log("setLogoAsPlayButton: Logo wird zum aktiven Play-Button.");
        logo.classList.remove('inactive-logo');
        logo.classList.add('active-logo');
        logoClickListener = function(event) {
            event.preventDefault();
            console.log("Play/Repeat-Button (Logo) geklickt!");
            logo.classList.remove('logo-bounce');
            void logo.offsetWidth;
            logo.classList.add('logo-bounce');

            if (isPlayerReady && currentDiceRoll) {
                if (currentSongRepetitionsLeft >= 0) { // Ermöglicht das erste Hören und weitere
                    playSongBasedOnDice(); // Funktion für die Song-Wiedergabelogik
                    // Logo direkt nach Klick inaktiv machen, während der Song spielt
                    setLogoAsPlayButton(false);
                    currentGameState = 'songPlaying';
                } else {
                    console.log("Keine weiteren Hördurchgänge für diesen Song mehr.");
                    playbackStatus.textContent = 'Keine weiteren Versuche. Löse den Song auf!';
                    // Logo bleibt inaktiv, da jetzt aufgelöst wird
                    setLogoAsPlayButton(false);
                }
            } else {
                console.warn("Player ist nicht bereit oder kein Würfelwert gesetzt.");
                playbackStatus.textContent = 'System nicht bereit oder Würfel fehlt.';
            }
        };
        logo.addEventListener('pointerdown', logoClickListener);
    } else {
        console.log("setLogoAsPlayButton: Logo wird inaktiv.");
        logo.classList.remove('active-logo');
        logo.classList.add('inactive-logo');
        // Klick-Listener bleibt entfernt
    }
}


// --- Funktion, die den Spotify Login-Status überprüft und den Player initialisiert ---
// Dies muss vor dem DOMContentLoaded-Listener definiert sein!
async function checkSpotifyLoginStatus() {
    console.log("checkSpotifyLoginStatus: Überprüfe Spotify Login Status.");
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        console.log('checkSpotifyLoginStatus: Authorization Code erhalten, tausche ihn gegen Access Token.');
        const success = await exchangeCodeForTokens(code); // Warte auf Erfolg
        history.replaceState({}, document.title, REDIRECT_URI); // Code aus URL entfernen

        if (success && accessToken && isSpotifySDKLoaded) {
                console.log("checkSpotifyLoginStatus: Access Token und SDK bereit, initialisiere Player.");
                initializeSpotifyPlayer();
        } else if (success && accessToken) {
                console.log("checkSpotifyLoginStatus: Access Token vorhanden, aber SDK noch nicht geladen. Player-Initialisierung wartet auf SDK Ready.");
                // initializeSpotifyPlayer wird dann von window.onSpotifyWebPlaybackSDKReady() aufgerufen
        } else {
                console.log("checkSpotifyLoginStatus: Token-Austausch fehlgeschlagen oder kein Access Token.");
                showLoginScreen(); // Zeigt den Login-Screen mit Fehlermeldung
        }
    } else if (localStorage.getItem('access_token') && localStorage.getItem('expires_in') > Date.now()) {
        console.log('checkSpotifyLoginStatus: Vorhandenen Access Token aus localStorage geladen.');
        accessToken = localStorage.getItem('access_token');
        if (isSpotifySDKLoaded) {
            console.log("checkSpotifyLoginStatus: Vorhandener Token und SDK bereit, initialisiere Player.");
            initializeSpotifyPlayer();
        } else {
            console.log("checkSpotifyLoginStatus: Vorhandener Token, aber SDK noch nicht geladen. Player-Initialisierung wartet auf SDK Ready.");
        }
    } else {
        console.log('checkSpotifyLoginStatus: Kein gültiger Access Token vorhanden. Zeige Login-Screen.');
        playbackStatus.textContent = 'Bitte logge dich mit Spotify ein.';
        showLoginScreen(); // Sicherstellen, dass der Login-Screen aktiv ist
    }
}


// --- INITIALISIERUNG BEIM LADEN DER SEITE ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: Seite geladen.");

    // Füge diesen Listener hinzu, damit die 'logo-bounce' Klasse
    // nach jeder Klick-Animation automatisch entfernt wird.
    if (logo) {
        logo.addEventListener('animationend', (event) => {
            if (event.animationName === 'press-down-bounce') {
                logo.classList.remove('logo-bounce');
            }
        });
        console.log("DOMContentLoaded: Logo AnimationEnd Listener für Klick-Bounce hinzugefügt.");
    } else {
        console.error("DOMContentLoaded: Logo-Element (ID: game-logo) nicht gefunden, kann Klick-Bounce Listener nicht hinzufügen.");
    }

    // --- NEU: AnimationEnd-Listener für die Würfel-Buttons hinzufügen ---
    diceButtons.forEach(button => {
        button.addEventListener('animationend', (event) => {
            // Auch hier den korrekten Namen deiner @keyframes Animation prüfen!
            if (event.animationName === 'press-down-bounce') { // <--- HIER MUSS 'press-down-bounce' STEHEN
                event.target.classList.remove('logo-bounce');
            }
        });
    });
    console.log("DOMContentLoaded: Würfel-Buttons AnimationEnd Listener für Klick-Bounce hinzugefügt.");
    // --- ENDE NEU ---
    
    // Spotify SDK Skript dynamisch laden
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);
    console.log("DOMContentLoaded: Spotify SDK Skript geladen von " + script.src);

    // Initialisiere den Login-Button Listener
    if (spotifyLoginButton) {
        spotifyLoginButton.addEventListener('click', redirectToSpotifyAuthorize);
        console.log("DOMContentLoaded: Spotify Login Button Event Listener hinzugefügt.");
    } else {
        console.error("DOMContentLoaded: Login-Button (ID: spotify-login-button) nicht im DOM gefunden.");
    }

    // Beim Laden der Seite direkt den Spotify Login-Bereich anzeigen
    loginArea.classList.remove('hidden');
    logoContainer.classList.add('hidden', 'initial-hidden'); // Logo verstecken und initial positionieren
    playbackStatus.textContent = ''; // Anfangs leer

    // Prüfe den Login-Status sofort
    await checkSpotifyLoginStatus();

    // Event Listener für Orientierungsänderungen und Fenstergrößenänderungen
    window.addEventListener('resize', () => {
        if (isPlayerReady) { // Nur prüfen, wenn Player bereit ist (nach Login)
            checkOrientationAndFullscreen();
        }
    });
    window.addEventListener('orientationchange', () => {
        if (isPlayerReady) { // Nur prüfen, wenn Player bereit ist (nach Login)
            checkOrientationAndFullscreen();
        }
    });

    // Listener für das Beenden des Fullscreen-Modus
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            console.log("Fullscreen verlassen.");
            fullscreenRequested = false;
            if (isPlayerReady) {
                checkOrientationAndFullscreen();
            } else {
                showLoginScreen(); // Wenn Player nicht bereit, zurück zum Login
            }
        } else {
            console.log("Fullscreen aktiviert.");
            // Wenn Fullscreen aktiviert wird und wir im Startscreen sind, direkt Logo zeigen
            if (currentGameState === 'startScreen' || currentGameState === 'loading') { // Auch wenn noch 'loading'
                showLogoButton();
            }
        }
    });
});
