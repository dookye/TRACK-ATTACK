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

// --- SPOTIFY API & SDK FUNKTIONEN ---

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

    // Korrekte Spotify Authorize-URL
    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Tauscht den Authorization Code gegen ein Access Token aus.
 * Wird nach dem Redirect von Spotify aufgerufen.
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
        // Korrekte Spotify Token-URL
        const response = await fetch('https://accounts.spotify.com/api/token', {
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

        console.log('Access Token erfolgreich erhalten.');
        localStorage.removeItem('code_verifier'); // Code Verifier ist jetzt nicht mehr nötig

        // Nach Erhalt des Tokens: Jetzt kann der Spotify Player initialisiert werden
        // (dies wird durch window.onSpotifyWebPlaybackSDKReady ausgelöst, wenn das SDK geladen ist)
        // und dann der Bildschirm gewechselt, sobald der Player bereit ist.

    } catch (error) {
        console.error('Fehler beim Token-Austausch:', error);
        alert('Fehler beim Spotify Login. Bitte versuche es erneut. Stelle sicher, dass du einen Premium Account hast.');
        showLoginScreen();
    }
}

/**
 * Globaler Callback für das Spotify Web Playback SDK.
 * WIRD VOM SDK AUFGERUFEN, SOBALD ES GELADEN IST.
 */
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('Spotify Web Playback SDK ist bereit.');

    // Stelle sicher, dass der Access Token hier verfügbar ist
    if (!accessToken) {
        accessToken = localStorage.getItem('access_token');
        if (!accessToken) {
            console.warn('Access Token fehlt bei SDK-Bereitschaft. Kann Player nicht initialisieren.');
            playbackStatus.textContent = 'Fehler: Kein Spotify Access Token. Bitte neu anmelden.';
            showLoginScreen();
            return;
        }
        // Überprüfe, ob der Token abgelaufen ist
        if (localStorage.getItem('expires_in') < Date.now()) {
            console.warn('Access Token abgelaufen bei SDK-Bereitschaft. Bitte neu anmelden.');
            playbackStatus.textContent = 'Deine Spotify-Sitzung ist abgelaufen. Bitte neu anmelden.';
            showLoginScreen();
            return;
        }
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

        // WICHTIG: Screen-Wechsel hier, wenn der Player bereit ist
        showGameScreen();
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
            console.log('Der Web Playback SDK Player wurde erfolgreich verbunden (aber noch nicht "ready").');
        } else {
            console.warn('Verbindung zum Web Playback SDK Player fehlgeschlagen.');
            playbackStatus.textContent = 'Verbindung zum Spotify Player fehlgeschlagen.';
        }
    });
};

/**
 * Überträgt die Wiedergabe auf den neu erstellten Web Playback SDK Player.
 * Wichtig, damit der Player Audio abspielt.
 */
async function transferPlayback(deviceId) {
    try {
        // Korrekte Spotify Player API-URL für Geräteübertragung
        const response = await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false // Nur Gerät aktivieren, nicht sofort abspielen
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
        // Korrekte Spotify Playlist API-URL
        let nextUrl = `https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/tracks?limit=100`;

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

        // Startposition: Zufällige Position innerhalb der ersten 80% des Songs
        const maxStartPositionMs = Math.floor(trackDurationMs * 0.8);
        const startPositionMs = Math.floor(Math.random() * maxStartPositionMs);

        console.log(`Spiele Track: ${randomTrackItem.track.name} von ${randomTrackItem.track.artists[0].name}`);
        console.log(`Track URI: ${trackUri}`);
        console.log(`Startposition: ${startPositionMs}ms`);

        // WICHTIG: player.activateElement() für Nutzerinteraktion
        // Auf mobilen Browsern ist dies oft notwendig, um Audio abzuspielen
        await player.activateElement();

        // Starten der Wiedergabe über die Web API mit dem Track URI
        // Korrekte Spotify Player API-URL für Wiedergabe-Steuerung
        const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${activeDeviceId}`, {
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
            throw new Error(`Fehler beim Starten der Wiedergabe: ${playResponse.status} - ${errorData.error.message || playResponse.statusText}`);
        }

        playbackStatus.textContent = 'Spiele Song...';
        console.log('Song gestartet über Web API.');

        // Stoppe nach 2 Sekunden (via SDK pause)
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
        if (error.message.includes("Premium account") || error.message.includes("Player command failed: Restricted device")) {
            alert('Für dieses Spiel ist ein Spotify Premium Account erforderlich oder dein Gerät ist nicht aktiv. Bitte überprüfe deine Spotify-Einstellungen.');
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
document.addEventListener('DOMContentLoaded', () => {
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
        // Wir kommen von Spotify zurück, tauschen den Code aus
        console.log('Authorization Code erhalten, tausche ihn gegen Access Token.');
        exchangeCodeForTokens(code); // Holt den Token
        // Der Screen-Wechsel und Player-Initialisierung passiert,
        // sobald das SDK durch window.onSpotifyWebPlaybackSDKReady fertig ist und der Player ready meldet.
        history.replaceState({}, document.title, REDIRECT_URI); // Saubere URL
    } else if (localStorage.getItem('access_token') && localStorage.getItem('expires_in') > Date.now()) {
        // Bereits eingeloggt und Token gültig
        accessToken = localStorage.getItem('access_token');
        console.log('Vorhandenen Access Token aus localStorage geladen. Warte auf Spotify SDK.');
        // Player-Initialisierung und Screen-Wechsel warten auf SDK-Bereitschaft
        // showGameScreen(); // NICHT HIER, da der Player noch nicht bereit ist. Das übernimmt onSpotifyWebPlaybackSDKReady
    } else {
        // Nicht eingeloggt oder Token abgelaufen
        console.log('Kein gültiger Access Token vorhanden. Zeige Login-Screen.');
        showLoginScreen();
    }
});
