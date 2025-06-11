// --- KONSTANTEN ---
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

// --- SPOTIFY API ENDPUNKTE (DIES SIND DIE KORREKTEN, KEINE PLATZHALTER MEHR!) ---
const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'; // Direkter Autorisierungs-Endpunkt für den Browser-Redirect
const SPOTIFY_TOKEN_URL     = 'https://accounts.spotify.com/api/token';  // **DIESE MUSS ES SEIN!** Direkter Token-Austausch-Endpunkt (Accounts Service)
const SPOTIFY_API_BASE_URL  = 'https://api.spotify.com/v1'; // Basis-URL für die Spotify Web API (Player, Playlists, etc.)
// ---https://support.spotify.com/de/article/cannot-remember-login/

// --- UI-ELEMENTE ---
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const spotifyLoginButton = document.getElementById('spotify-login-button');
const startGameButton = document.getElementById('start-game-button');
const playbackStatus = document.getElementById('playback-status');

// --- GLOBALE ZUSTANDSVARIABLEN ---
let accessToken = '';
let player = null;
let currentPlaylistTracks = [];
let activeDeviceId = null;
let isPlayerReady = false; // Flag, das auf true gesetzt wird, wenn der SDK-Player verbunden ist
let isSpotifySDKLoaded = false; // NEU: Flag, das gesetzt wird, wenn das SDK geladen ist

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
        localStorage.setItem('expires_in', Date.now() + data.expires_in * 1000); // Ablaufzeitpunkt speichern

        console.log('Access Token erfolgreich erhalten und gespeichert.');
        localStorage.removeItem('code_verifier'); // Code Verifier ist jetzt nicht mehr nötig

    } catch (error) {
        console.error('Fehler beim Token-Austausch:', error);
        alert('Fehler beim Spotify Login. Bitte versuche es erneut. Stelle sicher, dass du einen Premium Account hast.');
        showLoginScreen();
    }
}

/**
 * NEUE FUNKTION: Initialisiert und verbindet den Spotify Player.
 * Wird aufgerufen, wenn sowohl das SDK geladen als auch der Access Token verfügbar ist.
 */
async function initializeSpotifyPlayer() {
    console.log('Versuche Spotify Player zu initialisieren...');

    // Prüfe nochmals, ob alles bereit ist
    if (!isSpotifySDKLoaded) {
        console.warn('initializeSpotifyPlayer aufgerufen, aber SDK noch nicht geladen.');
        return; // Warte auf window.onSpotifyWebPlaybackSDKReady
    }
    if (!accessToken || localStorage.getItem('expires_in') < Date.now()) {
        console.warn('initializeSpotifyPlayer aufgerufen, aber Access Token fehlt oder ist abgelaufen. Zeige Login-Screen.');
        playbackStatus.textContent = 'Fehler: Spotify Session abgelaufen oder nicht angemeldet. Bitte neu anmelden.';
        showLoginScreen();
        return;
    }

    // Wenn der Player bereits initialisiert ist, nichts tun
    if (player) {
        console.log('Spotify Player bereits initialisiert.');
        showGameScreen(); // Zeige Game Screen, falls noch nicht geschehen
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
        showGameScreen(); // Jetzt ist der Player bereit, den Spiel-Screen zu zeigen
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
        showLoginScreen(); // Zurück zum Login
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
        // console.log('Player State Changed:', state);
        // Hier könnten wir später den UI-Status aktualisieren, z.B. wenn ein Song endet.
    });

    // Versuche, den Player zu verbinden
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

/**  ${SPOTIFY_API_BASE_URL}/me/player
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
                play: false
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

        await player.activateElement(); // Wichtig für Nutzerinteraktion

        const playResponse = await fetch(`${SPOTIFY_API_BASE_URL}/me/player/play`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                uris: [trackUri],
                position_ms: startPositionMs
            })
        });

        if (!playResponse.ok) {
            const errorData = await playResponse.json();
            console.error('Fehler-Response von /me/player/play:', errorData); // Logge die Fehlerdaten
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

// --- UI STEUERUNGSFUNKTIONEN ---
function showLoginScreen() {
    loginScreen.classList.add('active');
    gameScreen.classList.remove('active');
}

function showGameScreen() {
    loginScreen.classList.remove('active');
    gameScreen.classList.add('active');
}

// --- INITIALISIERUNG BEIM LADEN DER SEITE ---
document.addEventListener('DOMContentLoaded', async () => {
    // Event Listener für Buttons hinzufügen
    if (spotifyLoginButton) {
        spotifyLoginButton.addEventListener('click', redirectToSpotifyAuthorize);
    } else {
        console.error("Login-Button (ID: spotify-login-button) nicht im DOM gefunden.");
    }

    if (startGameButton) {
        startGameButton.addEventListener('click', playRandomSongFromPlaylist);
    } else {
        console.error("Start Game-Button (ID: start-game-button) nicht im DOM gefunden.");
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        console.log('Authorization Code erhalten, tausche ihn gegen Access Token.');
        await exchangeCodeForTokens(code); // Warten, bis der Token-Austausch abgeschlossen ist
        history.replaceState({}, document.title, REDIRECT_URI); // Saubere URL
        // Token wurde erhalten. Jetzt versuchen, den Player zu initialisieren
        initializeSpotifyPlayer();
    } else if (localStorage.getItem('access_token') && localStorage.getItem('expires_in') > Date.now()) {
        console.log('Vorhandenen Access Token aus localStorage geladen.');
        accessToken = localStorage.getItem('access_token');
        // Token ist da. Jetzt versuchen, den Player zu initialisieren
        initializeSpotifyPlayer();
    } else {
        console.log('Kein gültiger Access Token vorhanden. Zeige Login-Screen.');
        showLoginScreen();
    }
});

// window.onSpotifyWebPlaybackSDKReady wird ausgelöst, sobald das SDK-Skript geladen ist.
// Die eigentliche Player-Initialisierung ist jetzt in initializeSpotifyPlayer() gekap
