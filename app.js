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

// UI Elemente
const loginScreen = document.getElementById('login-screen');
const gameScreen = document.getElementById('game-screen');
const spotifyLoginButton = document.getElementById('spotify-login-button');
const startGameButton = document.getElementById('start-game-button');
const playbackStatus = document.getElementById('playback-status');
// const debugInfo = document.getElementById('debug-info'); // Für Debugging

let accessToken = '';
let player = null;
let currentPlaylistTracks = [];

// --- PKCE Helper Funktionen ---
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

// --- Spotify API & SDK Funktionen ---

/**
 * Leitet den Benutzer zum Spotify-Login weiter (PKCE Flow).
 */
async function redirectToSpotifyAuthorize() {
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    localStorage.setItem('code_verifier', codeVerifier); // Speichern für späteren Token-Austausch

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Tauscht den Authorization Code gegen ein Access Token aus.
 * Wird nach dem Redirect von Spotify aufgerufen.
 */
async function exchangeCodeForTokens(code) {
    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) {
        console.error('Code Verifier nicht gefunden.');
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
        // Optional: Speichern des refresh_token, um den Access Token zu erneuern
        // localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('access_token', data.access_token); // Temporär für Tests
        localStorage.setItem('expires_in', Date.now() + data.expires_in * 1000); // Ablaufzeitpunkt speichern

        console.log('Access Token erhalten:', accessToken);
        // debugInfo.textContent = `Access Token: ${accessToken.substring(0, 30)}...`;

        localStorage.removeItem('code_verifier'); // Code Verifier ist jetzt nicht mehr nötig
        initializeSpotifyPlayer();
        showGameScreen();

    } catch (error) {
        console.error('Fehler beim Token-Austausch:', error);
        alert('Fehler beim Spotify Login. Bitte versuche es erneut. Stelle sicher, dass du einen Premium Account hast.');
        showLoginScreen();
    }
}

/**
 * Initialisiert den Spotify Web Playback SDK Player.
 */
function initializeSpotifyPlayer() {
    window.onSpotifyWebPlaybackSDKReady = () => {
        if (!accessToken) {
            console.error('Kein Access Token vorhanden. Player kann nicht initialisiert werden.');
            return;
        }

        player = new Spotify.Player({
            name: 'TRACK ATTACK Player',
            getOAuthToken: cb => { cb(accessToken); },
            volume: 0.5
        });

        // Event Listener für den Player
        player.addListener('ready', ({ device_id }) => {
            console.log('Bereit auf Gerät-ID', device_id);
            // debugInfo.textContent += `\nPlayer ready, Device ID: ${device_id}`;
            transferPlayback(device_id); // Übertrage die Wiedergabe auf unseren Player
        });

        player.addListener('not_ready', ({ device_id }) => {
            console.warn('Gerät-ID nicht bereit', device_id);
            playbackStatus.textContent = 'Spotify Player ist nicht bereit. Ist Spotify im Browser offen?';
        });

        player.addListener('initialization_error', ({ message }) => {
            console.error('Initialisierungsfehler:', message);
            playbackStatus.textContent = `Fehler beim Initialisieren des Players: ${message}`;
        });

        player.addListener('authentication_error', ({ message }) => {
            console.error('Authentifizierungsfehler:', message);
            playbackStatus.textContent = 'Authentifizierungsfehler. Bitte logge dich erneut ein.';
            alert('Deine Spotify-Sitzung ist abgelaufen oder ungültig. Bitte logge dich erneut ein.');
            showLoginScreen();
        });

        player.addListener('account_error', ({ message }) => {
            console.error('Account-Fehler:', message);
            playbackStatus.textContent = 'Account-Fehler. Hast du einen Spotify Premium Account?';
            alert('Es gab einen Fehler mit deinem Spotify Account. Für dieses Spiel ist ein Premium Account erforderlich.');
            showLoginScreen();
        });

        player.addListener('playback_error', ({ message }) => {
            console.error('Wiedergabefehler:', message);
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
                console.log('Der Web Playback SDK Player wurde erfolgreich verbunden!');
                playbackStatus.textContent = 'Spotify Player verbunden!';
            } else {
                console.warn('Verbindung zum Web Playback SDK Player fehlgeschlagen.');
                playbackStatus.textContent = 'Verbindung zum Spotify Player fehlgeschlagen.';
            }
        });
    };
}

/**
 * Überträgt die Wiedergabe auf den neu erstellten Web Playback SDK Player.
 * Wichtig, damit der Player Audio abspielt.
 */
async function transferPlayback(deviceId) {
    try {
        const response = await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false // Nicht direkt abspielen, nur Gerät aktivieren
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
            allTracks = allTracks.concat(data.items.filter(item => item.track && item.track.preview_url)); // Nur Tracks mit Preview-URL
            nextUrl = data.next;
        }
        currentPlaylistTracks = allTracks;
        console.log(`Geladene Tracks aus Playlist: ${currentPlaylistTracks.length}`);
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
    if (!player) {
        playbackStatus.textContent = 'Spotify Player ist nicht bereit.';
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

        // Startposition: Zufällige Position innerhalb der ersten 80% des Songs, um das Ende nicht zu erwischen
        // Spotify SDK Playback Startposition ist in Millisekunden
        const maxStartPositionMs = Math.floor(trackDurationMs * 0.8);
        const startPositionMs = Math.floor(Math.random() * maxStartPositionMs);

        console.log(`Spiele Track: ${randomTrackItem.track.name} von ${randomTrackItem.track.artists[0].name}`);
        console.log(`Startposition: ${startPositionMs}ms`);

        // Aktiviere den Player auf dem Gerät, falls er nicht aktiv ist
        await player.activateElement(); // Wichtig für Browser-Interaktion

        player.playTrack({
            uri: trackUri,
            position_ms: startPositionMs
        }).then(() => {
            playbackStatus.textContent = 'Spiele Song...';
            console.log('Song gestartet.');

            // Stoppe nach 2 Sekunden
            setTimeout(() => {
                player.pause().then(() => {
                    playbackStatus.textContent = 'Song beendet.';
                    console.log('Song nach 2 Sekunden gestoppt.');
                });
            }, 2000);
        }).catch(error => {
            console.error('Fehler beim Abspielen des Tracks:', error);
            playbackStatus.textContent = `Fehler beim Abspielen: ${error.message}`;
        });

    } catch (error) {
        console.error('Fehler beim Abspielen des zufälligen Songs:', error);
        playbackStatus.textContent = `Fehler beim Abspielen: ${error.message}`;
    }
}

// --- UI Steuerungsfunktionen ---
function showLoginScreen() {
    loginScreen.classList.add('active');
    gameScreen.classList.remove('active');
}

function showGameScreen() {
    loginScreen.classList.remove('active');
    gameScreen.classList.add('active');
}

// --- Event Listener ---
spotifyLoginButton.addEventListener('click', redirectToSpotifyAuthorize);
startGameButton.addEventListener('click', playRandomSongFromPlaylist);

// --- Initialisierung beim Laden der Seite ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        // Wir kommen von Spotify zurück, tauschen den Code aus
        console.log('Authorization Code erhalten:', code);
        exchangeCodeForTokens(code);
        // Optional: Entferne den Code aus der URL, um sie sauber zu halten
        history.replaceState({}, document.title, REDIRECT_URI);
    } else if (localStorage.getItem('access_token') && localStorage.getItem('expires_in') > Date.now()) {
        // Bereits eingeloggt und Token gültig
        accessToken = localStorage.getItem('access_token');
        console.log('Vorhandenen Access Token verwendet.');
        initializeSpotifyPlayer();
        showGameScreen();
    } else {
        // Nicht eingeloggt oder Token abgelaufen
        showLoginScreen();
    }
});

// Wichtig: Der Web Playback SDK muss vollständig geladen sein,
// bevor wir player.connect() aufrufen.
// window.onSpotifyWebPlaybackSDKReady wird durch das <script> Tag im HTML global definiert.
