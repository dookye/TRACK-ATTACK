// --- ALLGEMEINE KONSTANTEN & VARIABLEN (Startbildschirm & UI) ---
const logo = document.getElementById('game-logo');
const logoContainer = document.getElementById('logo-container'); // NEU: Referenz zum Logo-Container
const loginArea = document.getElementById('login-area');
const spotifyLoginButton = document.getElementById('spotify-login-button');
const initialClickBlocker = document.getElementById('initial-click-blocker');
const orientationMessage = document.getElementById('orientation-message');
const fullscreenMessage = document.getElementById('fullscreen-message');
const gameContainer = document.querySelector('.game-container'); // Bleibt primärer Wrapper

// Spotify UI-Elemente, die existieren
const playbackStatus = document.getElementById('playback-status');

// --- SPOTIFY KONSTANTEN (KORREKTE URLS SIND HIER ENTHALTEN) ---
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6';
const REDIRECT_URI = 'https://dookye.github.io/musik-raten/'; // Deine GitHub Pages URL
const PLAYLIST_ID = '39sVxPTg7BKwrf2MfgrtcD'; // Punk Rock (90's & 00's)
const SCOPES = [
    'user-read-private',
    'user-read-email',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state'
];

// --- SPOTIFY API ENDPUNKTE (DIES SIND DIE KORREKTEN SPOTIFY-URLS!) ---
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
let fullscreenRequested = false; // Zur Steuerung des Fullscreen-States
let orientationChecked = false; // NEU: Flag, ob Orientierung schon geprüft wurde
let hasUserInteracted = false; // NEU: Flag, ob der User initial geklickt hat (für Fullscreen)


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
        showLoginScreen(); // Gehe zurück zum Login-Screen
        return false; // Signalisiere Fehler
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
        localStorage.removeItem('code_verifier'); // Code Verifier ist jetzt nicht mehr nötig
        return true; // Signalisiere Erfolg

    } catch (error) {
        console.error('exchangeCodeForTokens: Fehler beim Token-Austausch:', error);
        playbackStatus.textContent = 'Fehler beim Spotify Login. Bitte versuche es erneut.';
        alert('Fehler beim Spotify Login. Bitte versuche es erneut. Stelle sicher, dass du einen Premium Account hast.');
        showLoginScreen(); // Zurück zum Login-Screen
        return false; // Signalisiere Fehler
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
        // Wenn der Player schon bereit ist, können wir den nächsten UI-Schritt auslösen.
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
        transferPlayback(device_id); // Übertrage die Wiedergabe auf unseren Player
        console.log("Spotify Player ready! Du bist jetzt eingeloggt und der Player ist bereit.");
        handlePlayerReady(); // NEU: Trigger für den nächsten UI-Schritt
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

    // Wenn der Access Token bereits verfügbar ist, können wir den Player jetzt initialisieren
    if (accessToken) {
        console.log("window.onSpotifyWebPlaybackSDKReady: Access Token vorhanden, initialisiere Player.");
        initializeSpotifyPlayer();
    } else {
        console.log("window.onSpotifyWebPlaybackSDKReady: Kein Access Token vorhanden. Warte auf Login.");
        // Wenn kein Token da ist, aber das SDK geladen wurde (z.B. bei initialem Besuch),
        // stellen wir sicher, dass der Login-Bildschirm sichtbar ist.
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
                play: false // Wichtig: Nicht sofort abspielen, sondern nur die Wiedergabe übertragen
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
 * Holt die Tracks einer bestimmten Playlist. (Bleibt für später relevant)
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
// --- UI STEUERUNGSFUNKTIONEN ---

// NEU: Diese Funktion wird aufgerufen, wenn der Player erfolgreich initialisiert wurde
function handlePlayerReady() {
    console.log("handlePlayerReady: Spotify Player ist verbunden. Starte Orientierungs-/Fullscreen-Check.");
    loginArea.classList.add('hidden'); // Login-Bereich ausblenden
    // Jetzt den Orientierungs- und Fullscreen-Check starten
    checkOrientationAndFullscreen();
}

function showLoginScreen() {
    console.log("showLoginScreen: Zeige Login-Bereich.");
    logoContainer.classList.add('hidden'); // Logo ausblenden
    loginArea.classList.remove('hidden');
    // playbackStatus.textContent wird durch die Initialisierung oder Fehler gesetzt.
}

function showMessage(element) {
    element.classList.remove('hidden');
    element.classList.add('visible');
    element.style.pointerEvents = 'auto'; // Klicks auf die Nachricht erlauben
    initialClickBlocker.classList.remove('hidden'); // Blocker anzeigen, um Interaktion mit Hintergrund zu verhindern
}

function hideMessage(element) {
    element.classList.remove('visible');
    element.classList.add('hidden');
    element.style.pointerEvents = 'none'; // Klicks durch die Nachricht hindurchlassen
    initialClickBlocker.classList.add('hidden'); // Blocker ausblenden
}

// NEU: Hauptfunktion für Orientierung und Fullscreen, wird nach Player-Ready aufgerufen
function checkOrientationAndFullscreen() {
    console.log("checkOrientationAndFullscreen: Überprüfe Orientierung und Fullscreen.");
    fullscreenRequested = false; // Reset des Flags für neue Fullscreen-Aufforderung

    if (window.innerHeight > window.innerWidth) { // Hochformat (Portrait)
        console.log("checkOrientationAndFullscreen: Hochformat erkannt. Zeige Orientierungs-Meldung.");
        showMessage(orientationMessage);
        hideMessage(fullscreenMessage); // Sicherstellen, dass Fullscreen-Message versteckt ist
        orientationChecked = false; // Flag zurücksetzen, da Orientierung falsch
        document.removeEventListener('click', activateFullscreenAndRemoveListener); // Listener entfernen, falls er noch aktiv ist
    } else { // Querformat (Landscape)
        console.log("checkOrientationAndFullscreen: Querformat erkannt.");
        hideMessage(orientationMessage); // Orientierungs-Meldung ausblenden

        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
             console.log("checkOrientationAndFullscreen: Zeige Fullscreen-Aufforderung.");
             showMessage(fullscreenMessage);
             // Listener hinzufügen, wenn noch nicht im Vollbild.
             // { once: true } sorgt dafür, dass der Listener nach einmaligem Klick entfernt wird.
             document.addEventListener('click', activateFullscreenAndRemoveListener, { once: true });
        } else {
             console.log("checkOrientationAndFullscreen: Bereits im Vollbildmodus. Zeige Logo.");
             hideMessage(fullscreenMessage); // Fullscreen-Meldung ausblenden
             showLogoButton(); // Zeige das Logo
        }
        orientationChecked = true; // Orientierung ist jetzt korrekt
    }
}

// NEU: Funktion zum Anzeigen des Logo-Buttons
// Funktion zum Anzeigen des Logo-Buttons (TRACK ATTACK)
function showLogoButton() {
    console.log("showLogoButton: Zeige TRACK ATTACK Logo.");
    loginArea.classList.add('hidden'); // Login-Bereich ausblenden
    hideMessage(fullscreenMessage); // Stellen Sie sicher, dass die Fullscreen-Nachricht wirklich weg ist
    hideMessage(orientationMessage); // Und die Orientierungsnachricht auch

    logoContainer.classList.remove('hidden'); // logo-container sichtbar machen
    logoContainer.classList.add('visible'); // visible Klasse hinzufügen

    // Optional: Wenn das Logo noch nicht auf 'active-logo' war, hier setzen
    logo.classList.remove('inactive-logo');
    logo.classList.add('active-logo');
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

function activateFullscreenAndRemoveListener(event) {
    console.log("activateFullscreenAndRemoveListener: Vollbildmodus-Aktivierung durch Klick.");
    
    // Nur reagieren, wenn der Klick auf der Fullscreen-Nachricht selbst war,
    // um ungewollte Klicks (z.B. auf den Body) zu ignorieren.
    if (!fullscreenMessage.contains(event.target)) {
        console.log("activateFullscreenAndRemoveListener: Klick nicht auf Fullscreen-Nachricht, ignoriere.");
        // Wichtig: Da der Listener mit `{ once: true }` hinzugefügt wird,
        // muss er bei einem ignorierten Klick erneut hinzugefügt werden,
        // sonst kann der User später nicht mehr durch Klicken den Fullscreen triggern.
        document.addEventListener('click', activateFullscreenAndRemoveListener, { once: true });
        return;
    }

    if (!fullscreenRequested) {
        requestFullscreen();
        fullscreenRequested = true; // Setze Flag, um Mehrfachauslösung zu verhindern
        document.removeEventListener('click', activateFullscreenAndRemoveListener); // Entferne den Listener, da Klick erfolgreich war
        
        // Nach erfolgreicher Fullscreen-Anforderung das Logo anzeigen
        showLogoButton(); 
    }
}

// --- INITIALISIERUNG BEIM LADEN DER SEITE ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: Seite geladen.");

    // Spotify SDK Skript dynamisch laden (immer zuerst)
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js'; // KORREKTE URL BESTÄTIGT!
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
    loginArea.classList.remove('hidden'); // Sicherstellen, dass der Login-Bereich sichtbar ist
    logoContainer.classList.add('hidden'); // Sicherstellen, dass das Logo versteckt ist
    playbackStatus.textContent = ''; // Anfangs leer

    // Prüfe den Login-Status sofort (nachdem der HTML-Inhalt initial sichtbar ist)
    await checkSpotifyLoginStatus();

    // Event Listener für Orientierungsänderungen und Fenstergrößenänderungen
    window.addEventListener('resize', () => {
        // Nur prüfen, wenn der Player bereit ist (nach Login)
        if (isPlayerReady) {
            checkOrientationAndFullscreen();
        }
    });
    window.addEventListener('orientationchange', () => {
        // Nur prüfen, wenn der Player bereit ist (nach Login)
        if (isPlayerReady) {
            checkOrientationAndFullscreen();
        }
    });

    // Event Listener für den Bounce-Effekt beim Klick auf das Logo
    logo.addEventListener('click', () => {
        console.log("Logo geklickt.");
        if (logo.classList.contains('active-logo')) {
            logo.classList.remove('logo-bounce');
            void logo.offsetWidth; // Force reflow
            logo.classList.add('logo-bounce');
            console.log("Logo bouncet! (Aktiver Zustand)");
            // Hier könnte später der Spielstart erfolgen
            // if (isPlayerReady) { playRandomSongFromPlaylist(); }
        } else {
            console.log("Logo ist inaktiv, kein Bounce.");
        }
    });

    // Listener für das Beenden des Fullscreen-Modus
    document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        console.log("Fullscreen verlassen.");
        fullscreenRequested = false; // Zurücksetzen, damit es erneut angefordert werden kann
        // Wenn Fullscreen verlassen wird, prüfen wir wieder die Orientierung und zeigen ggf. die Aufforderung
        if (isPlayerReady) { // Nur wenn der Player bereits verbunden ist
            checkOrientationAndFullscreen(); // Dies wird die Fullscreen-Meldung wieder anzeigen
        } else {
            // Wenn der Player nicht bereit ist (z.B. nach einem Fehler), zurück zum Login-Screen
            showLoginScreen();
        }
    } else {
        console.log("Fullscreen aktiviert.");
        // Wenn Fullscreen aktiviert wird (z.B. durch user-interaktion), Logo anzeigen
        // showLogoButton(); // Dies sollte bereits in activateFullscreenAndRemoveListener aufgerufen werden
    }
});
});


// Funktion, die den Spotify Login-Status überprüft und den Player initialisiert
// Wird beim Laden der Seite und nach Redirects aufgerufen
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
