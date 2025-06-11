// --- KONSTANTEN ---
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6';
const REDIRECT_URI = 'https://dookye.github.io/musik-raten/';
// GEÄNDERT: Array von Playlist-IDs für mehr Vielfalt
const PLAYLIST_IDS = [
    '39sVxPTg7BKwrf2MfgrtcD', // Punk Rock (90's & 00's)
    '37i9dQZF1DXcBWIGoYBM5M', // Rock Party (Beispiel)
    '37i9dQZF1DWXR9CgZf9C7y'  // Alternative Rock (Beispiel)
];
const SCOPES = [
    'user-read-private',
    'user-read-email',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state'
];
// NEU: Wiedergabedauer in Millisekunden (7 Sekunden)
const PLAYBACK_DURATION = 7000; 

// --- SPOTIFY API ENDPUNKTE (DIES SIND DIE KORREKTEN, KEINE PLATZHALTER MEHR!) ---
const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'; // Direkter Autorisierungs-Endpunkt für den Browser-Redirect
const SPOTIFY_TOKEN_URL     = 'https://accounts.spotify.com/api/token'; // Direkter Token-Austausch-Endpunkt (Accounts Service)
const SPOTIFY_API_BASE_URL  = 'https://api.spotify.com/v1'; // Basis-URL für die Spotify Web API (Player, Playlists, etc.)

// --- UI-ELEMENTE ---
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const spotifyLoginButton = document.getElementById('spotify-login-button');
const startGameButton = document.getElementById('start-game-button');
const playbackStatus = document.getElementById('playback-status');
// NEU: Zusätzliche UI-Elemente
const resetButton = document.getElementById('reset-button');
const revealButton = document.getElementById('reveal-button');
const trackInfo = document.getElementById('track-info');
const trackArtist = document.getElementById('track-artist');
const trackTitle = document.getElementById('track-title');

// --- GLOBALE ZUSTANDSVARIABLEN ---
let accessToken = '';
let player = null;
let allAvailableTracks = []; // GEÄNDERT: Sammelt Tracks aus ALLEN ausgewählten Playlists
let activeDeviceId = null;
let isPlayerReady = false; // Flag, das auf true gesetzt wird, wenn der SDK-Player verbunden ist
let isSpotifySDKLoaded = false; // Flag, das gesetzt wird, wenn das SDK geladen ist
let currentTrack = null; // NEU: Speichert den aktuell ausgewählten Song

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
 * Leitet den Benutzer zum Spotify-Login weiter (PKCE Flow). (Unverändert)
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
 * Tauscht den Authorization Code gegen ein Access Token aus. (Unverändert)
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
 * Initialisiert und verbindet den Spotify Player. (Unverändert, aber nun mit Aktivierung der Buttons)
 * Wird aufgerufen, wenn sowohl das SDK geladen als auch der Access Token verfügbar ist.
 */
async function initializeSpotifyPlayer() {
    console.log('Versuche Spotify Player zu initialisieren...');

    if (!isSpotifySDKLoaded) {
        console.warn('initializeSpotifyPlayer aufgerufen, aber SDK noch nicht geladen.');
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
        showGameScreen();
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
        transferPlayback(device_id);
        showGameScreen(); // Jetzt ist der Player bereit, den Spiel-Screen zu zeigen
        // NEU: Buttons aktivieren, sobald der Player bereit ist
        startGameButton.disabled = false;
        resetButton.disabled = false;
        revealButton.disabled = false;
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.warn('Gerät-ID nicht bereit:', device_id);
        playbackStatus.textContent = 'Spotify Player ist nicht bereit. Ist Spotify im Browser offen?';
        isPlayerReady = false;
        // NEU: Buttons deaktivieren
        startGameButton.disabled = true;
        resetButton.disabled = true;
        revealButton.disabled = true;
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
        // console.log('Player State Changed:', state);
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
 * Globaler Callback für das Spotify Web Playback SDK. (Unverändert)
 * WIRD VOM SDK AUFGERUFEN, SOBALD ES GELADEN IST.
 */
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('Spotify Web Playback SDK ist bereit (onSpotifyWebPlaybackSDKReady wurde ausgelöst).');
    isSpotifySDKLoaded = true;

    if (accessToken) {
        initializeSpotifyPlayer();
    }
};

/**
 * Überträgt die Wiedergabe auf den neu erstellten Web Playback SDK Player. (Unverändert)
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
 * Holt die Tracks aller angegebenen Playlists. (Unverändert)
 */
async function getAllPlaylistsTracks() {
    if (allAvailableTracks.length > 0) {
        return allAvailableTracks;
    }

    let fetchedTracks = [];
    playbackStatus.textContent = 'Lade Playlists...';

    for (const playlistId of PLAYLIST_IDS) {
        console.log(`Lade Tracks aus Playlist ID: ${playlistId}`);
        let nextUrl = `${SPOTIFY_API_BASE_URL}/playlists/${playlistId}/tracks?limit=100`;
        try {
            while (nextUrl) {
                const response = await fetch(nextUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(`Fehler beim Laden der Tracks aus Playlist ${playlistId}: ${response.status} - ${errorData.error.message || response.statusText}`);
                }

                const data = await response.json();
                fetchedTracks = fetchedTracks.concat(data.items.filter(item => item.track && !item.track.is_local));
                nextUrl = data.next;
            }
        } catch (error) {
            console.error(`Fehler beim Laden der Tracks aus Playlist ${playlistId}:`, error);
            playbackStatus.textContent = `Fehler beim Laden einer Playlist: ${error.message}`;
        }
    }

    allAvailableTracks = fetchedTracks;
    console.log(`Insgesamt geladene Tracks aus allen Playlists: ${allAvailableTracks.length}`);
    if (allAvailableTracks.length === 0) {
        console.warn('Keine spielbaren Tracks in den ausgewählten Playlists gefunden.');
        playbackStatus.textContent = 'Achtung: Keine spielbaren Tracks in den Playlists gefunden. Stelle sicher, dass die Playlists Tracks enthält und in deinem Markt verfügbar sind.';
    }
    return allAvailableTracks;
}

/**
 * GEÄNDERT: Spielt einen 7-Sekunden-Ausschnitt des AKTUELLEN Songs an einer neuen zufälligen Position.
 * Wird vom "Erneut abspielen"-Button aufgerufen.
 */
async function playCurrentTrackFragment() {
    if (!isPlayerReady || !activeDeviceId) {
        playbackStatus.textContent = 'Spotify Player ist noch nicht bereit oder verbunden. Bitte warten...';
        console.warn('Play request blockiert: Player nicht bereit oder kein aktives Gerät gefunden.');
        return;
    }
    // Wenn noch kein Song ausgewählt wurde (z.B. beim allerersten Klick), wähle einen neuen.
    if (!currentTrack) {
        console.log("Noch kein Song ausgewählt. Rufe selectAndPlayNewSong() auf.");
        await selectAndPlayNewSong();
        return;
    }

    playbackStatus.textContent = 'Spiele Songausschnitt...';

    try {
        const trackDurationMs = currentTrack.track.duration_ms;
        // Sicherstellen, dass die Startposition nicht zu nah am Ende ist (mindestens PLAYBACK_DURATION Platz haben)
        const maxStartPositionMs = Math.max(0, trackDurationMs - PLAYBACK_DURATION); 
        const startPositionMs = Math.floor(Math.random() * maxStartPositionMs);

        console.log(`Versuche abzuspielen: ${currentTrack.track.name} (${currentTrack.track.uri})`);
        console.log(`Sende PUT an: ${SPOTIFY_API_BASE_URL}/me/player/play`);
        console.log(`Body der Anfrage:`, JSON.stringify({ uris: [currentTrack.track.uri], position_ms: startPositionMs }));

        await player.activateElement(); // Wichtig für Nutzerinteraktion

        const playResponse = await fetch(`${SPOTIFY_API_BASE_URL}/me/player/play?device_id=${activeDeviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                uris: [currentTrack.track.uri],
                position_ms: startPositionMs
            })
        });

        if (!playResponse.ok) {
            const errorData = await playResponse.json();
            console.error('Fehler-Response von /me/player/play:', errorData);
            throw new Error(`Fehler beim Starten der Wiedergabe: ${playResponse.status} - ${errorData.error.message || playResponse.statusText}`);
        }

        console.log('Songausschnitt gestartet über Web API.');

        // Song nach PLAYBACK_DURATION Sekunden stoppen
        setTimeout(() => {
            player.pause().then(() => {
                playbackStatus.textContent = 'Bereit für den nächsten Versuch oder die Auflösung.';
                console.log(`Song nach ${PLAYBACK_DURATION}ms gestoppt via SDK.`);
            }).catch(pauseError => {
                console.error('Fehler beim Pausieren des Songs via SDK:', pauseError);
                playbackStatus.textContent = `Fehler beim Stoppen: ${pauseError.message}`;
            });
        }, PLAYBACK_DURATION); // Verwendet die neue Konstante

    } catch (error) {
        console.error('Fehler beim Abspielen des zufälligen Songs:', error);
        playbackStatus.textContent = `Fehler beim Abspielen: ${error.message}`;
        if (error.message.includes("Premium account") || error.message.includes("Restricted device")) {
            alert('Für dieses Spiel ist ein Spotify Premium Account erforderlich oder dein Gerät ist nicht aktiv/verfügbar. Bitte überprüfe deine Spotify-Einstellungen.');
            showLoginScreen();
        }
    }
}

/**
 * NEU: Wählt einen komplett neuen Song aus und spielt den ersten Ausschnitt.
 * Wird vom "Nächster Song"-Button aufgerufen.
 */
async function selectAndPlayNewSong() {
    if (!isPlayerReady) {
        playbackStatus.textContent = 'Spotify Player ist noch nicht bereit. Bitte warten...';
        return;
    }

    playbackStatus.textContent = 'Wähle neuen Song...';
    // NEU: Verstecke die Song-Infos und setze den Text zurück
    trackInfo.classList.remove('visible');
    trackArtist.textContent = '...';
    trackTitle.textContent = '...';

    try {
        const tracks = await getAllPlaylistsTracks();
        if (tracks.length === 0) {
            playbackStatus.textContent = 'Keine Tracks in den Playlists gefunden oder geladen.';
            return;
        }

        // Wähle einen neuen zufälligen Track
        const randomTrackItem = tracks[Math.floor(Math.random() * tracks.length)];
        currentTrack = randomTrackItem; // Speichere den ausgewählten Track global

        console.log(`Neuer Song ausgewählt: ${currentTrack.track.name}`);

        // Spiele den ersten Ausschnitt des neuen Songs ab
        await playCurrentTrackFragment();

    } catch (error) {
        console.error('Fehler bei der Auswahl eines neuen Songs:', error);
        playbackStatus.textContent = `Fehler: ${error.message}`;
    }
}

/**
 * NEU: Zeigt die Informationen des aktuellen Songs an.
 * Wird vom "Auflösen"-Button aufgerufen.
 */
function revealCurrentTrack() {
    if (currentTrack) {
        trackArtist.textContent = currentTrack.track.artists.map(artist => artist.name).join(', ');
        trackTitle.textContent = currentTrack.track.name;
        trackInfo.classList.add('visible'); // Macht den Container sichtbar
        playbackStatus.textContent = 'Song aufgedeckt!';
    } else {
        playbackStatus.textContent = 'Es wurde noch kein Song abgespielt. Klicke "Nächster Song".';
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
    // NEU: Playlists laden, sobald der Game Screen sichtbar wird
    getAllPlaylistsTracks().then(() => {
        playbackStatus.textContent = 'Playlists geladen. Klicke auf "Nächster Song", um zu beginnen!';
        // Aktiviere die Buttons erst, wenn die Tracks geladen sind und der Player bereit ist
        if (isPlayerReady) {
            startGameButton.disabled = false;
            resetButton.disabled = false;
            revealButton.disabled = false;
        }
    });
}

// --- INITIALISIERUNG BEIM LADEN DER SEITE ---
document.addEventListener('DOMContentLoaded', async () => {
    // Event Listener für Spotify Login Button
    if (spotifyLoginButton) {
        spotifyLoginButton.addEventListener('click', redirectToSpotifyAuthorize);
    } else {
        console.error("Login-Button (ID: spotify-login-button) nicht im DOM gefunden.");
    }

    // NEU: Deaktiviere die Spiel-Buttons initial, bis der Player bereit ist
    if (startGameButton) startGameButton.disabled = true;
    if (resetButton) resetButton.disabled = true;
    if (revealButton) revealButton.disabled = true;

    // GEÄNDERT: Event Listener für die Spiel-Buttons
    if (startGameButton) {
        startGameButton.addEventListener('click', playCurrentTrackFragment); // Spielt den GLEICHEN Song erneut ab
    } else {
        console.error("Start Game-Button (ID: start-game-button) nicht im DOM gefunden.");
    }

    if (resetButton) {
        resetButton.addEventListener('click', selectAndPlayNewSong); // Wählt einen NEUEN Song aus
    } else {
        console.error("Reset-Button (ID: reset-button) nicht im DOM gefunden.");
    }

    if (revealButton) {
        revealButton.addEventListener('click', revealCurrentTrack); // Zeigt die Song-Details an
    } else {
        console.error("Reveal-Button (ID: reveal-button) nicht im DOM gefunden.");
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        console.log('Authorization Code erhalten, tausche ihn gegen Access Token.');
        await exchangeCodeForTokens(code); // Warten, bis der Token-Austausch abgeschlossen ist
        history.replaceState({}, document.title, REDIRECT_URI); // Saubere URL
        initializeSpotifyPlayer(); // Token wurde erhalten. Jetzt versuchen, den Player zu initialisieren
    } else if (localStorage.getItem('access_token') && localStorage.getItem('expires_in') > Date.now()) {
        console.log('Vorhandenen Access Token aus localStorage geladen.');
        accessToken = localStorage.getItem('access_token');
        initializeSpotifyPlayer(); // Token ist da. Jetzt versuchen, den Player zu initialisieren
    } else {
        console.log('Kein gültiger Access Token vorhanden. Zeige Login-Screen.');
        showLoginScreen();
    }
});

// window.onSpotifyWebPlaybackSDKReady wird ausgelöst, sobald das SDK-Skript geladen ist.
// Die eigentliche Player-Initialisierung ist jetzt in initializeSpotifyPlayer() gekapselt.
