// --- ALLGEMEINE KONSTANTEN & VARIABLEN (Startbildschirm & UI) ---
const logo = document.getElementById('game-logo');
const loginArea = document.getElementById('login-area');
const spotifyLoginButton = document.getElementById('spotify-login-button');
const initialClickBlocker = document.getElementById('initial-click-blocker');
const orientationMessage = document.getElementById('orientation-message');
const fullscreenMessage = document.getElementById('fullscreen-message');
const gameContainer = document.querySelector('.game-container');

// Spotify UI-Elemente, die existieren
const playbackStatus = document.getElementById('playback-status');

// --- SPOTIFY KONSTANTEN ---
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6';
const REDIRECT_URI = 'https://dookye.github.io/musik-raten/';
const PLAYLIST_ID = '39sVxPTg7BKwrf2MfgrtcD'; // Punk Rock (90's & 00's)
const SCOPES = [
    'user-read-private',
    'user-read-email',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state'
];

// --- SPOTIFY API ENDPUNKTE (BITTE HIER DIE KORREKTEN SPOTIFY-URLS EINTRAGEN!) ---
// Beispiel:
// const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
// const SPOTIFY_TOKEN_URL     = 'https://accounts.spotify.com/api/token';
// const SPOTIFY_API_BASE_URL  = 'https://api.spotify.com/v1';

// AKTUELLE PLATZHALTER (DU MUSST SIE ERSETZEN!)
const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'; // ERSETZEN!
const SPOTIFY_TOKEN_URL     = 'https://accounts.spotify.com/api/token'; // ERSETZEN!
const SPOTIFY_API_BASE_URL  = 'https://api.spotify.com/v1'; // ERSETZEN!


// --- GLOBALE ZUSTANDSVARIABLEN ---
let accessToken = '';
let player = null;
let currentPlaylistTracks = [];
let activeDeviceId = null;
let isPlayerReady = false; // Flag, das auf true gesetzt wird, wenn der SDK-Player verbunden ist
let isSpotifySDKLoaded = false; // Flag, das gesetzt wird, wenn das SDK geladen ist
let fullscreenRequested = false; // Aus der vorherigen Logik
let isHandlingRedirect = false; // NEU: Flag, um Redirect-Verhalten zu steuern


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

// --- SPOTIFY AUTH & API FUNKTIONEN ---

/**
 * Leitet den Benutzer zum Spotify-Login weiter (PKCE Flow).
 */
async function redirectToSpotifyAuthorize() {
    isHandlingRedirect = true; // Setze Flag, um erneuten Fullscreen-Prompt zu vermeiden
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

    window.location.href = `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Tauscht den Authorization Code gegen ein Access Token aus.
 * Wird nach dem Redirect von Spotify aufgerufen.
 * @param {string} code - Der Authorization Code von Spotify.
 */
async function exchangeCodeForTokens(code) {
    console.log("exchangeCodeForTokens: Starte Token-Austausch.");
    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) {
        console.error('Code Verifier nicht gefunden. Kann Token nicht austauschen.');
        playbackStatus.textContent = 'Fehler: Code Verifier fehlt. Bitte versuche den Login erneut.';
        alert('Fehler: Code Verifier nicht gefunden. Bitte versuche den Login erneut.');
        showLoginScreen();
        return;
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
        localStorage.setItem('expires_in', Date.now() + data.expires_in * 1000);

        console.log('Access Token erfolgreich erhalten und gespeichert.');
        localStorage.removeItem('code_verifier');

    } catch (error) {
        console.error('Fehler beim Token-Austausch:', error);
        playbackStatus.textContent = 'Fehler beim Login. Bitte versuche es erneut.';
        alert('Fehler beim Spotify Login. Bitte versuche es erneut. Stelle sicher, dass du einen Premium Account hast.');
        showLoginScreen();
    }
}

/**
 * Initialisiert und verbindet den Spotify Player.
 * Wird aufgerufen, wenn sowohl das SDK geladen als auch der Access Token verfügbar ist.
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
        console.log('initializeSpotifyPlayer: Spotify Player bereits initialisiert.');
        playbackStatus.textContent = 'Spotify Player verbunden!';
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

    // Versuche den Player zu initialisieren, falls bereits ein Token vorhanden ist
    if (accessToken) {
        initializeSpotifyPlayer();
    } else {
        console.log("window.onSpotifyWebPlaybackSDKReady: Kein Access Token vorhanden, Player wartet auf Login.");
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
 * Spielt einen zufälligen Song aus der Playlist an einer zufälligen Position ab.
 * Diese Funktion wird vorerst nicht direkt aufgerufen, dient aber als Beispiel.
 */
async function playRandomSongFromPlaylist() {
    console.log('playRandomSongFromPlaylist: Versuch, Song abzuspielen.');
    if (!isPlayerReady || !player || !activeDeviceId) {
        playbackStatus.textContent = 'Spotify Player ist noch nicht bereit oder verbunden. Bitte warten...';
        console.warn('Play request blockiert: Player nicht bereit oder kein aktives Gerät gefunden.');
        return;
    }

    playbackStatus.textContent = 'Lade Song...';

    try {
        const tracks = await getPlaylistTracks();
        if (tracks.length === 0) {
            playbackStatus.textContent = 'Keine Tracks in der Playlist gefunden oder geladen.';
            return;
        }

        const randomTrackItem = tracks[Math.floor(Math.random() * tracks.length)];
        const trackUri = randomTrackItem.track.uri;
        const trackDurationMs = randomTrackItem.track.duration_ms;

        const maxStartPositionMs = Math.floor(trackDurationMs * 0.8);
        const startPositionMs = Math.floor(Math.random() * maxStartPositionMs);

        console.log(`playRandomSongFromPlaylist: Versuche abzuspielen: ${randomTrackItem.track.name} (${trackUri})`);

        await player.activateElement();

        const playResponse = await fetch(`${SPOTIFY_API_BASE_URL}/me/player/play`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                uris: [trackUri],
                position_ms: startPositionMs,
                device_id: activeDeviceId
            })
        });

        if (!playResponse.ok) {
            const errorData = await playResponse.json();
            console.error('playRandomSongFromPlaylist Fehler-Response von /me/player/play:', errorData);
            throw new Error(`Fehler beim Starten der Wiedergabe: ${playResponse.status} - ${errorData.error.message || playResponse.statusText}`);
        }

        playbackStatus.textContent = 'Spiele Song...';
        console.log('playRandomSongFromPlaylist: Song gestartet über Web API.');

        setTimeout(() => {
            player.pause().then(() => {
                playbackStatus.textContent = 'Song beendet.';
                console.log('playRandomSongFromPlaylist: Song nach 2 Sekunden gestoppt via SDK.');
            }).catch(pauseError => {
                console.error('playRandomSongFromPlaylist Fehler beim Pausieren des Songs via SDK:', pauseError);
                playbackStatus.textContent = `Fehler beim Stoppen: ${pauseError.message}`;
            });
        }, 2000);

    } catch (error) {
        console.error('playRandomSongFromPlaylist Fehler:', error);
        playbackStatus.textContent = `Fehler beim Abspielen: ${error.message}`;
        if (error.message.includes("Premium account") || error.message.includes("Restricted device")) {
            alert('Für dieses Spiel ist ein Spotify Premium Account erforderlich oder dein Gerät ist nicht aktiv/verfügbar. Bitte überprüfe deine Spotify-Einstellungen.');
            showLoginScreen();
        }
    }
}


// --- UI STEUERUNGSFUNKTIONEN ---

function showLoginScreen() {
    console.log("showLoginScreen: Zeige Login-Bereich.");
    hideGameContent();
    loginArea.classList.remove('hidden');
    loginArea.classList.add('visible');
    // Setze den Status, um zu signalisieren, dass ein Login nötig ist.
    playbackStatus.textContent = 'Bitte logge dich mit Spotify ein.';
}

function showGameScreen() {
    console.log("showGameScreen: Spotify Player ist bereit.");
    // In diesem Fall, wenn der Player bereit ist, soll der Login-Bereich weiterhin sichtbar sein.
    // Später würden wir hier zum eigentlichen Spiel-UI wechseln.
    loginArea.classList.remove('hidden');
    loginArea.classList.add('visible');
    // Hier kannst du eine Nachricht anzeigen, dass der Player bereit ist, z.B.
    if (isPlayerReady) {
        playbackStatus.textContent = 'Spotify Player verbunden und bereit!';
    } else {
        playbackStatus.textContent = 'Spotify Player wird verbunden...';
    }
}

function showMessage(element) {
    element.classList.remove('hidden');
    element.classList.add('visible');
    element.style.pointerEvents = 'auto'; // Klicks auf die Nachricht erlauben (für Fullscreen)
}

function hideMessage(element) {
    element.classList.remove('visible');
    element.classList.add('hidden');
    element.style.pointerEvents = 'none'; // Klicks durch die Nachricht hindurchlassen
}

function checkOrientationAndProceed() {
    console.log("checkOrientationAndProceed: Überprüfe Orientierung.");
    if (window.innerHeight > window.innerWidth) { // Hochformat (Portrait)
        console.log("checkOrientationAndProceed: Hochformat erkannt.");
        hideGameContent();
        hideMessage(fullscreenMessage);
        showMessage(orientationMessage);
        initialClickBlocker.style.display = 'block';
        document.removeEventListener('click', activateFullscreenAndRemoveListener);
    } else { // Querformat (Landscape)
        console.log("checkOrientationAndProceed: Querformat erkannt.");
        hideMessage(orientationMessage);
        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
             console.log("checkOrientationAndProceed: Zeige Fullscreen-Aufforderung.");
             showMessage(fullscreenMessage);
             // Wenn wir nicht gerade von einem Redirect kommen, Listener hinzufügen
             if (!isHandlingRedirect) {
                document.addEventListener('click', activateFullscreenAndRemoveListener);
             }
        } else {
             console.log("checkOrientationAndProceed: Bereits im Vollbild, zeige Game Content.");
             showGameContent(); // Zeigt den Hauptinhalt, inklusive Logo und Login-Bereich
             // Nach dem Vollbildmodus den Redirect-Status zurücksetzen
             isHandlingRedirect = false;
        }
    }
}

function showGameContent() {
    console.log("showGameContent: Zeige Hauptspielinhalt (Logo & Login-Bereich).");
    if (gameContainer.classList.contains('visible')) {
        console.log("showGameContent: Game Container bereits sichtbar, überspringe Animation.");
        // Wenn der Container schon sichtbar ist, nur den Spotify-Status prüfen
        checkSpotifyLoginStatus();
        return;
    }

    gameContainer.classList.remove('hidden');
    gameContainer.classList.add('visible');
    initialClickBlocker.style.display = 'none'; // Blocker entfernen

    setTimeout(() => {
        logo.classList.remove('active-logo'); // Abdunkeln des Logos
        logo.classList.add('inactive-logo');

        setTimeout(() => {
            loginArea.classList.remove('hidden');
            loginArea.classList.add('visible');
            checkSpotifyLoginStatus(); // Prüfe Login-Status, sobald der Bereich sichtbar ist
        }, 500);
    }, 1500);
}

function hideGameContent() {
    console.log("hideGameContent: Verstecke Hauptspielinhalt.");
    gameContainer.classList.remove('visible');
    gameContainer.classList.add('hidden');
    initialClickBlocker.style.display = 'block';
}

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

function activateFullscreenAndRemoveListener() {
    console.log("activateFullscreenAndRemoveListener: Vollbildmodus-Aktivierung.");
    if (!fullscreenRequested) {
        requestFullscreen();
        fullscreenRequested = true;
        document.removeEventListener('click', activateFullscreenAndRemoveListener);
        hideMessage(fullscreenMessage);
        showGameContent(); // Zeigt den Hauptinhalt, inklusive Logo und Login-Bereich
    }
}

// --- INITIALISIERUNG BEIM LADEN DER SEITE ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: Seite geladen.");

    // Spotify SDK Skript dynamisch laden
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-web-playback-sdk.js'; // KORRIGIERTE URL!
    script.async = true;
    document.body.appendChild(script);

    // Event Listener für den Spotify Login Button
    if (spotifyLoginButton) {
        spotifyLoginButton.addEventListener('click', redirectToSpotifyAuthorize);
        console.log("DOMContentLoaded: Spotify Login Button Event Listener hinzugefügt.");
    } else {
        console.error("DOMContentLoaded: Login-Button (ID: spotify-login-button) nicht im DOM gefunden.");
    }

    // Initialisiere die UI-Kontrolle basierend auf der Orientierung
    // Dies ist der Startpunkt nach DOMContentLoaded
    checkOrientationAndProceed();
});

// Funktion, die den Spotify Login-Status überprüft und den Player initialisiert
// Wird aufgerufen, sobald der 'game-container' sichtbar ist (nach Fullscreen-Klick)
async function checkSpotifyLoginStatus() {
    console.log("checkSpotifyLoginStatus: Überprüfe Spotify Login Status.");
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        console.log('checkSpotifyLoginStatus: Authorization Code erhalten, tausche ihn gegen Access Token.');
        await exchangeCodeForTokens(code);
        history.replaceState({}, document.title, REDIRECT_URI);
        // Nach erfolgreichem Token-Austausch und Entfernen des Codes aus der URL,
        // jetzt erst den Player initialisieren, wenn das SDK geladen ist.
        if (isSpotifySDKLoaded) {
             initializeSpotifyPlayer();
        } else {
            // Wenn SDK noch nicht geladen, initializeSpotifyPlayer wird über onSpotifyWebPlaybackSDKReady aufgerufen.
            console.log("checkSpotifyLoginStatus: SDK noch nicht geladen, Player-Initialisierung wartet auf SDK Ready.");
        }
    } else if (localStorage.getItem('access_token') && localStorage.getItem('expires_in') > Date.now()) {
        console.log('checkSpotifyLoginStatus: Vorhandenen Access Token aus localStorage geladen.');
        accessToken = localStorage.getItem('access_token');
        if (isSpotifySDKLoaded) {
            initializeSpotifyPlayer();
        } else {
            console.log("checkSpotifyLoginStatus: SDK noch nicht geladen, Player-Initialisierung wartet auf SDK Ready.");
        }
    } else {
        console.log('checkSpotifyLoginStatus: Kein gültiger Access Token vorhanden. Zeige Login-Screen.');
        playbackStatus.textContent = 'Bitte logge dich mit Spotify ein.'; // KEINE STARTNACHRICHT, sondern Aufforderung
    }
}


// Listener für Orientierungsänderungen und Fenstergrößenänderungen
window.addEventListener('resize', checkOrientationAndProceed);
window.addEventListener('orientationchange', checkOrientationAndProceed);

// Event Listener für den Bounce-Effekt beim Klick auf das Logo
logo.addEventListener('click', () => {
    console.log("Logo geklickt.");
    if (logo.classList.contains('active-logo')) {
        logo.classList.remove('logo-bounce');
        void logo.offsetWidth;
        logo.classList.add('logo-bounce');
        console.log("Logo bouncet! (Aktiver Zustand)");
        // Wenn das Logo bouncen darf und der Player bereit ist, könnte hier das Spiel starten.
        // if (isPlayerReady) { playRandomSongFromPlaylist(); }
    } else {
        console.log("Logo ist inaktiv, kein Bounce.");
    }
});

// window.onSpotifyWebPlaybackSDKReady wird global vom SDK aufgerufen, wenn es geladen ist.
