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

// --- SPOTIFY API ENDPUNKTE (KORRIGIERT!) ---
// Bitte stelle sicher, dass diese URLs korrekt sind!
const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL     = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL  = 'https://api.spotify.com/v1';

// --- GLOBALE ZUSTANDSVARIABLEN ---
let accessToken = '';
let player = null;
let currentPlaylistTracks = [];
let activeDeviceId = null;
let isPlayerReady = false; // Flag, das auf true gesetzt wird, wenn der SDK-Player verbunden ist
let isSpotifySDKLoaded = false; // Flag, das gesetzt wird, wenn das SDK geladen ist
let fullscreenRequested = false; // Aus der vorherigen Logik


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
    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) {
        console.error('Code Verifier nicht gefunden. Kann Token nicht austauschen.');
        alert('Fehler: Code Verifier nicht gefunden. Bitte versuche den Login erneut.');
        showLoginScreen(); // Zurück zum Login-Screen
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
        localStorage.setItem('expires_in', Date.now() + data.expires_in * 1000); // Ablaufzeitpunkt speichern

        console.log('Access Token erfolgreich erhalten und gespeichert.');
        localStorage.removeItem('code_verifier'); // Code Verifier ist jetzt nicht mehr nötig

    } catch (error) {
        console.error('Fehler beim Token-Austausch:', error);
        alert('Fehler beim Spotify Login. Bitte versuche es erneut. Stelle sicher, dass du einen Premium Account hast.');
        showLoginScreen(); // Zurück zum Login-Screen
    }
}

/**
 * Initialisiert und verbindet den Spotify Player.
 * Wird aufgerufen, wenn sowohl das SDK geladen als auch der Access Token verfügbar ist.
 */
async function initializeSpotifyPlayer() {
    console.log('Versuche Spotify Player zu initialisieren...');

    if (!isSpotifySDKLoaded) {
        console.warn('initializeSpotifyPlayer aufgerufen, aber SDK noch nicht geladen. Warte auf window.onSpotifyWebPlaybackSDKReady.');
        return;
    }
    if (!accessToken || localStorage.getItem('expires_in') < Date.now()) {
        console.warn('initializeSpotifyPlayer aufgerufen, aber Access Token fehlt oder ist abgelaufen. Zeige Login-Screen.');
        playbackStatus.textContent = 'Fehler: Spotify Session abgelaufen oder nicht angemeldet. Bitte neu anmelden.';
        showLoginScreen();
        return;
    }

    if (player) {
        console.log('Spotify Player bereits initialisiert.');
        playbackStatus.textContent = 'Spotify Player verbunden!'; // Update status even if already init
        return;
    }

    if (typeof Spotify === 'undefined' || typeof Spotify.Player === 'undefined') {
        console.error('Spotify Web Playback SDK (Spotify.Player) ist nicht verfügbar.');
        playbackStatus.textContent = 'Spotify SDK nicht geladen. Bitte überprüfe deine Internetverbindung.';
        return;
    }

    player = new Spotify.Player({
        name: 'TRACK ATTACK Player',
        getOAuthToken: cb => { cb(accessToken); },
        volume: 0.5
    });

    player.addListener('ready', ({ device_id }) => {
        console.log('Spotify Player ist bereit auf Gerät-ID:', device_id);
        activeDeviceId = device_id;
        isPlayerReady = true;
        playbackStatus.textContent = 'Spotify Player verbunden!';
        transferPlayback(device_id); // Übertrage die Wiedergabe auf unseren Player
        // Hier könntest du jetzt z.B. einen "Play"-Button (unser Logo?) aktivieren
        // oder zum nächsten Bildschirm wechseln.
        console.log("Spotify Player ready! You can now proceed to the game (or next step).");
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.warn('Gerät-ID nicht bereit:', device_id);
        playbackStatus.textContent = 'Spotify Player ist nicht bereit. Ist Spotify im Browser offen?';
        isPlayerReady = false;
    });

    player.addListener('initialization_error', ({ message }) => {
        console.error('Initialisierungsfehler des Spotify Players:', message);
        playbackStatus.textContent = `Fehler beim Initialisieren des Players: ${message}`;
        isPlayerReady = false;
        alert('Fehler beim Initialisieren des Spotify Players. Versuche es erneut.');
        showLoginScreen();
    });

    player.addListener('authentication_error', ({ message }) => {
        console.error('Authentifizierungsfehler des Spotify Players:', message);
        playbackStatus.textContent = 'Authentifizierungsfehler. Bitte logge dich erneut ein.';
        alert('Deine Spotify-Sitzung ist abgelaufen oder ungültig. Bitte logge dich erneut ein.');
        isPlayerReady = false;
        showLoginScreen();
    });

    player.addListener('account_error', ({ message }) => {
        console.error('Account-Fehler des Spotify Players:', message);
        playbackStatus.textContent = 'Account-Fehler. Hast du einen Spotify Premium Account?';
        alert('Es gab einen Fehler mit deinem Spotify Account. Für dieses Spiel ist ein Premium Account erforderlich.');
        isPlayerReady = false;
        showLoginScreen();
    });

    player.addListener('playback_error', ({ message }) => {
        console.error('Wiedergabefehler des Spotify Players:', message);
        playbackStatus.textContent = `Wiedergabefehler: ${message}`;
    });

    player.addListener('player_state_changed', (state) => {
        if (!state) {
            return;
        }
        // Hier könnten wir später den UI-Status aktualisieren, z.B. wenn ein Song endet.
    });

    player.connect().then(success => {
        if (success) {
            console.log('Der Web Playback SDK Player wurde erfolgreich verbunden (wartet auf "ready"-Status).');
        } else {
            console.warn('Verbindung zum Web Playback SDK Player fehlgeschlagen.');
            playbackStatus.textContent = 'Verbindung zum Spotify Player fehlgeschlagen.';
        }
    }).catch(err => {
        console.error('Fehler beim Verbinden des Players:', err);
        playbackStatus.textContent = `Verbindung zum Player fehlgeschlagen: ${err.message}`;
    });
}

/**
 * Globaler Callback für das Spotify Web Playback SDK.
 * WIRD VOM SDK AUFGERUFEN, SOBALD ES GELADEN IST.
 */
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('Spotify Web Playback SDK ist bereit (onSpotifyWebPlaybackSDKReady wurde ausgelöst).');
    isSpotifySDKLoaded = true; // Setze das Flag

    // Wenn der Access Token bereits verfügbar ist, können wir den Player jetzt initialisieren
    if (accessToken) {
        initializeSpotifyPlayer();
    }
};

/**
 * Überträgt die Wiedergabe auf den neu erstellten Web Playback SDK Player.
 * @param {string} deviceId - Die ID des Players, auf den übertragen werden soll.
 */
async function transferPlayback(deviceId) {
    try {
        const response = await fetch(`${SPOTIFY_API_BASE_URL}/me/player`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false // Wichtig: Nicht sofort abspielen, sondern nur die Wiedergabe übertragen
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Fehler beim Übertragen der Wiedergabe: ${response.status} - ${errorData.error.message || response.statusText}`);
        }
        console.log('Wiedergabe auf neuen Player übertragen.');

    } catch (error) {
        console.error('Fehler beim Übertragen der Wiedergabe:', error);
        playbackStatus.textContent = `Fehler beim Aktivieren des Players: ${error.message}`;
    }
}

/**
 * Holt die Tracks einer bestimmten Playlist.
 * Diese Funktion wird vorerst nicht direkt aufgerufen, ist aber für später wichtig.
 */
async function getPlaylistTracks() {
    if (currentPlaylistTracks.length > 0) {
        return currentPlaylistTracks; // Bereits geladen
    }
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
        console.log(`Geladene Tracks aus Playlist: ${currentPlaylistTracks.length}`);
        if (currentPlaylistTracks.length === 0) {
            console.warn('Keine spielbaren Tracks in der Playlist gefunden.');
            playbackStatus.textContent = 'Achtung: Keine spielbaren Tracks in der Playlist gefunden. Stelle sicher, dass die Playlist Tracks enthält und in deinem Markt verfügbar sind.';
        }
        return currentPlaylistTracks;
    } catch (error) {
        console.error('Fehler beim Laden der Playlist-Tracks:', error);
        playbackStatus.textContent = `Fehler beim Laden der Playlist: ${error.message}`;
        return [];
    }
}

/**
 * Spielt einen zufälligen Song aus der Playlist an einer zufälligen Position ab.
 * Diese Funktion wird vorerst nicht direkt aufgerufen.
 */
async function playRandomSongFromPlaylist() {
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

        console.log(`Versuche abzuspielen: ${randomTrackItem.track.name} (${trackUri})`);
        console.log(`Sende PUT an: ${SPOTIFY_API_BASE_URL}/me/player/play`);
        console.log(`Body der Anfrage:`, JSON.stringify({ uris: [trackUri], position_ms: startPositionMs }));

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
            console.error('Fehler-Response von /me/player/play:', errorData);
            throw new Error(`Fehler beim Starten der Wiedergabe: ${playResponse.status} - ${errorData.error.message || playResponse.statusText}`);
        }

        playbackStatus.textContent = 'Spiele Song...';
        console.log('Song gestartet über Web API.');

        setTimeout(() => {
            player.pause().then(() => {
                playbackStatus.textContent = 'Song beendet.';
                console.log('Song nach 2 Sekunden gestoppt via SDK.');
            }).catch(pauseError => {
                console.error('Fehler beim Pausieren des Songs via SDK:', pauseError);
                playbackStatus.textContent = `Fehler beim Stoppen: ${pauseError.message}`;
            });
        }, 2000);

    } catch (error) {
        console.error('Fehler beim Abspielen des zufälligen Songs:', error);
        playbackStatus.textContent = `Fehler beim Abspielen: ${error.message}`;
        if (error.message.includes("Premium account") || error.message.includes("Restricted device")) {
            alert('Für dieses Spiel ist ein Spotify Premium Account erforderlich oder dein Gerät ist nicht aktiv/verfügbar. Bitte überprüfe deine Spotify-Einstellungen.');
            showLoginScreen();
        }
    }
}


// --- UI STEUERUNGSFUNKTIONEN (Angepasst an neue Startbildschirm-Logik) ---

// Wird jetzt nur noch als Fallback oder bei Fehler aufgerufen, um den Login-Bereich anzuzeigen
function showLoginScreen() {
    hideGameContent(); // Alles andere vom Spiel ausblenden
    loginArea.classList.remove('hidden');
    loginArea.classList.add('visible');
}

// showGameScreen wird jetzt bedeuten: "Der Login-Bereich ist erfolgreich geladen und der Player bereit"
// Es zeigt den loginArea an, falls er aus irgendeinem Grund versteckt wurde.
function showGameScreen() {
    // Wenn der Spotify Player bereit ist, ist das unser "Spiel-Screen" für jetzt.
    // D.h. wir stellen sicher, dass der loginArea sichtbar ist und der Player Status aktualisiert wird.
    loginArea.classList.remove('hidden');
    loginArea.classList.add('visible');
    console.log("Spotify Player initialisiert und bereit. Login-Bereich bleibt sichtbar.");
    playbackStatus.textContent = 'Spotify Player bereit. Bitte logge dich ein.'; // Standard-Nachricht, wenn bereit aber noch nicht eingeloggt.
}


// Hilfsfunktionen zum Anzeigen/Verstecken von Nachrichten
function showMessage(element) {
    element.classList.remove('hidden');
    element.classList.add('visible');
}

function hideMessage(element) {
    element.classList.remove('visible');
    element.classList.add('hidden');
}

// Funktion zur Prüfung der Orientierung und Anzeige der entsprechenden Meldung
function checkOrientationAndProceed() {
    if (window.innerHeight > window.innerWidth) { // Hochformat (Portrait)
        hideGameContent();
        hideMessage(fullscreenMessage);
        showMessage(orientationMessage);
        initialClickBlocker.style.display = 'block';
        document.removeEventListener('click', activateFullscreenAndRemoveListener);
    } else { // Querformat (Landscape)
        hideMessage(orientationMessage);
        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
             showMessage(fullscreenMessage);
             if (!fullscreenRequested) {
                document.addEventListener('click', activateFullscreenAndRemoveListener);
             }
        } else {
             // Bereits im Vollbild oder schon einmal ausgelöst, direkt Game Content zeigen
             showGameContent();
        }
    }
}

// Funktionen zum Anzeigen/Verstecken des Hauptspielinhalts (Logo und Login-Bereich)
function showGameContent() {
    if (gameContainer.classList.contains('visible')) return;

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
    gameContainer.classList.remove('visible');
    gameContainer.classList.add('hidden');
    initialClickBlocker.style.display = 'block';
}

// Funktion zum Erzwingen des Vollbildmodus
function requestFullscreen() {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
    } else if (docEl.mozRequestFullScreen) { /* Firefox */
        docEl.mozRequestFullScreen();
    } else if (docEl.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) { /* IE/Edge */
        docEl.msRequestFullscreen();
    }
}

// Funktion, die den Vollbildmodus auslöst und den Listener entfernt
function activateFullscreenAndRemoveListener() {
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
    // Spotify SDK Skript dynamisch laden
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-web-playback-sdk.js';
    script.async = true;
    document.body.appendChild(script);

    // Event Listener für den Spotify Login Button
    if (spotifyLoginButton) {
        spotifyLoginButton.addEventListener('click', redirectToSpotifyAuthorize);
    } else {
        console.error("Login-Button (ID: spotify-login-button) nicht im DOM gefunden.");
    }

    // Initialisiere die UI-Kontrolle basierend auf der Orientierung
    checkOrientationAndProceed();
});

// Funktion, die den Spotify Login-Status überprüft und den Player initialisiert
// Wird aufgerufen, sobald der 'game-container' sichtbar ist (nach Fullscreen-Klick)
async function checkSpotifyLoginStatus() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        console.log('Authorization Code erhalten, tausche ihn gegen Access Token.');
        await exchangeCodeForTokens(code);
        history.replaceState({}, document.title, REDIRECT_URI);
        if (isSpotifySDKLoaded) {
             initializeSpotifyPlayer();
        }
    } else if (localStorage.getItem('access_token') && localStorage.getItem('expires_in') > Date.now()) {
        console.log('Vorhandenen Access Token aus localStorage geladen.');
        accessToken = localStorage.getItem('access_token');
        if (isSpotifySDKLoaded) {
            initializeSpotifyPlayer();
        }
    } else {
        console.log('Kein gültiger Access Token vorhanden. Zeige Login-Screen.');
        // Die showLoginScreen() Logik ist hier primär zur Fehlerbehandlung,
        // da der Login-Bereich normalerweise bereits durch showGameContent() sichtbar gemacht wird.
        // Falls du eine eigene "nicht eingeloggt"-Ansicht hast, könntest du diese hier aktivieren.
        playbackStatus.textContent = 'Bereit zum Login mit Spotify.';
    }
}


// Listener für Orientierungsänderungen und Fenstergrößenänderungen
window.addEventListener('resize', checkOrientationAndProceed);
window.addEventListener('orientationchange', checkOrientationAndProceed);

// Event Listener für den Bounce-Effekt beim Klick auf das Logo
// Das Logo soll hier als Platzhalter für einen späteren "Play"-Button dienen,
// aber für jetzt bouncet es nur, wenn es "aktiv" ist.
logo.addEventListener('click', () => {
    if (logo.classList.contains('active-logo')) {
        logo.classList.remove('logo-bounce');
        void logo.offsetWidth;
        logo.classList.add('logo-bounce');
        console.log("Logo bouncet! (Aktiver Zustand)");
        // Optional: Hier könnte später der Spielstart nach erfolgreichem Login erfolgen.
        // if (isPlayerReady) { playRandomSongFromPlaylist(); }
    } else {
        console.log("Logo ist inaktiv, kein Bounce.");
    }
});

// window.onSpotifyWebPlaybackSDKReady wird global vom SDK aufgerufen, wenn es geladen ist.
// Die Implementierung ist oben.
