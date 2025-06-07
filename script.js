const clientId = '53257f6a1c144d3f929a60d691a0c6f6'; // Ihre Spotify Developer ID
const redirectUri = 'https://dookye.github.io/musik-raten/'; // Ihre GitHub Pages URL
const playlistId = '39sVxPTg7BKwrf2MfgrtcD'; // Ihre Spotify Playlist ID (nur die ID, nicht die ganze URL)

let accessToken = '';
let player = null;
let deviceId = '';
let tracks = [];
let currentTrackUri = null;
let currentTrackTimeout = null;

const startButton = document.getElementById('startButton');
const messageElement = document.getElementById('message');

// --- Authentifizierung ---
// Diese Funktion extrahiert den Access Token aus der URL nach dem Redirect von Spotify.
function getAccessTokenFromUrl() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const token = params.get('access_token');
    if (token) {
        // Token aus der URL entfernen, um eine saubere URL zu haben
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log("Access Token aus URL erhalten:", token);
        return token;
    }
    return null;
}

// Leitet den Benutzer zur Spotify-Anmeldung weiter
function redirectToAuthCodeFlow() {
    messageElement.textContent = 'Leite zur Spotify-Anmeldung weiter...';
    startButton.disabled = true;
    // Der 'response_type=token' ist entscheidend für den Implicit Grant Flow
    const scope = 'user-read-private user-read-email streaming user-modify-playback-state';
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
}

// --- Spotify Web Playback SDK Initialisierung ---
// Diese Funktion wird AUTOMATISCH vom Spotify SDK aufgerufen,
// sobald es vollständig geladen und initialisiert ist.
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log("Spotify Web Playback SDK ist bereit!");

    // Versuche, den Access Token zu erhalten, entweder aus der URL (nach Redirect)
    // oder von einer zuvor gespeicherten Session (für diese Testversion nicht implementiert,
    // aber könnte über localStorage gehen).
    const tokenFromUrl = getAccessTokenFromUrl();

    if (tokenFromUrl) {
        accessToken = tokenFromUrl;
        console.log("Access Token erfolgreich vom Redirect erhalten. Initialisiere Player...");
        initializeSpotifyPlayer();
    } else if (accessToken) { // Dies sollte nur passieren, wenn ein Token bereits aus einem anderen Grund gesetzt wäre.
                               // Für den initialen Flow nach Redirect ist tokenFromUrl der Hauptweg.
        console.log("Access Token bereits gesetzt. Initialisiere Player...");
        initializeSpotifyPlayer();
    } else {
        // Kein Access Token gefunden. Der Benutzer muss sich anmelden.
        messageElement.textContent = 'Bitte klicken Sie auf "Start", um sich bei Spotify anzumelden.';
        startButton.disabled = false;
        startButton.onclick = redirectToAuthCodeFlow;
        console.log("Kein Access Token gefunden. Warte auf Benutzer-Login.");
    }
};

// Initialisiert den Spotify Player
function initializeSpotifyPlayer() {
    messageElement.textContent = 'Initialisiere Spotify Player... (Dies kann einen Moment dauern)';
    startButton.disabled = true;

    player = new Spotify.Player({
        name: 'Musik-Raten Web Player',
        getOAuthToken: cb => { cb(accessToken); }, // Übergebe den erhaltenen Access Token
        volume: 0.5
    });

    // --- Ereignis-Listener für den Player ---
    player.addListener('ready', ({ device_id }) => {
        deviceId = device_id;
        console.log('Bereit auf Gerät mit ID', deviceId);
        messageElement.textContent = 'Player bereit. Lade Playlist...';
        loadPlaylistTracks(); // Sobald der Player bereit ist, Playlist laden
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.log('Gerät mit ID ist offline', device_id);
        messageElement.textContent = 'Gerät ist offline. Bitte stellen Sie sicher, dass Spotify geöffnet ist und Sie Premium haben.';
        startButton.disabled = true;
    });

    player.addListener('initialization_error', ({ message }) => {
        console.error('Fehler bei der Initialisierung des Players:', message);
        messageElement.textContent = `Fehler beim Initialisieren des Players: ${message}. Stellen Sie sicher, dass Sie Spotify Premium haben.`;
        startButton.disabled = true;
    });

    player.addListener('authentication_error', ({ message }) => {
        console.error('Authentifizierungsfehler:', message);
        messageElement.textContent = `Authentifizierungsfehler: ${message}. Bitte klicken Sie auf "Start" und versuchen Sie es erneut.`;
        startButton.disabled = false; // Ermöglicht erneute Anmeldung
        startButton.onclick = redirectToAuthCodeFlow; // Setzt den Klick-Handler zurück
        accessToken = ''; // Access Token löschen, da er ungültig ist
    });

    player.addListener('account_error', ({ message }) => {
        console.error('Account-Fehler:', message);
        messageElement.textContent = `Account-Fehler: ${message}. Benötigt Spotify Premium.`;
        startButton.disabled = true;
    });

    player.connect(); // Versuche, den Player zu verbinden
}

// --- Playlist Tracks abrufen ---
async function loadPlaylistTracks() {
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                console.error('AccessToken abgelaufen oder ungültig. Erneute Authentifizierung erforderlich.');
                messageElement.textContent = 'Session abgelaufen. Bitte klicken Sie auf "Start", um sich erneut anzumelden.';
                startButton.disabled = false;
                startButton.onclick = redirectToAuthCodeFlow;
                return;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        // Filtern Sie Tracks, die spielbar sind.
        tracks = data.items
            .filter(item => item.track && item.track.is_playable !== false)
            .map(item => ({
                uri: item.track.uri,
                duration_ms: item.track.duration_ms
            }));

        if (tracks.length === 0) {
            messageElement.textContent = 'Keine spielbaren Tracks in der Playlist gefunden. Stellen Sie sicher, dass die Tracks nicht ausgegraut sind oder DRM-Einschränkungen haben.';
            startButton.disabled = true;
            return;
        }

        console.log('Tracks geladen:', tracks.length);
        messageElement.textContent = 'Bereit! Klicken Sie auf Start.';
        startButton.disabled = false;
        startButton.onclick = playRandomSong; // Setzt den Klick-Handler auf die Spiellogik
    } catch (error) {
        console.error('Fehler beim Laden der Playlist-Tracks:', error);
        messageElement.textContent = `Fehler beim Laden der Playlist: ${error.message}`;
        startButton.disabled = true;
    }
}

// --- Spiellogik ---
async function playRandomSong() {
    if (!player || !deviceId || !accessToken || tracks.length === 0) {
        messageElement.textContent = 'Player nicht bereit oder keine Tracks geladen. Bitte versuchen Sie neu zu laden oder melden Sie sich erneut an.';
        startButton.disabled = false;
        startButton.onclick = redirectToAuthCodeFlow;
        return;
    }

    startButton.disabled = true;
    messageElement.textContent = 'Spiele Song ab...';

    if (currentTrackTimeout) {
        clearTimeout(currentTrackTimeout);
    }

    let randomTrack;
    if (tracks.length > 1) {
        do {
            randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
        } while (randomTrack.uri === currentTrackUri);
    } else {
        randomTrack = tracks[0];
    }

    currentTrackUri = randomTrack.uri;

    const playbackDuration = 3000;
    const minTrackDurationNeeded = playbackDuration + 1000;
    const maxStartTime = randomTrack.duration_ms - minTrackDurationNeeded;

    let startPosition = 0;
    if (maxStartTime > 0) {
        startPosition = Math.floor(Math.random() * maxStartTime);
    } else {
        startPosition = 0;
        console.warn(`Track ${randomTrack.uri} ist zu kurz (${randomTrack.duration_ms}ms) für 3s Snippet + Puffer. Startet bei 0ms.`);
        if (randomTrack.duration_ms < playbackDuration) {
             console.warn(`Track ${randomTrack.uri} ist kürzer als die gewünschte Abspieldauer von ${playbackDuration}ms.`);
        }
    }

    console.log(`Spiele: ${randomTrack.uri} ab ${startPosition}ms`);

    try {
        // Transfer playback to our device and start playing
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                uris: [randomTrack.uri],
                position_ms: startPosition
            })
        });

        currentTrackTimeout = setTimeout(async () => {
            try {
                await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`
                    }
                });
                console.log('Song pausiert.');
                messageElement.textContent = 'Song beendet. Klicke erneut auf Start für den nächsten Song.';
                startButton.disabled = false;
            } catch (pauseError) {
                console.error('Fehler beim Pausieren des Songs:', pauseError);
                messageElement.textContent = 'Fehler beim Pausieren des Songs.';
                startButton.disabled = false;
            }
        }, playbackDuration);

    } catch (error) {
        console.error('Fehler beim Abspielen des Songs:', error);
        messageElement.textContent = `Fehler beim Abspielen: ${error.message}. Stellen Sie sicher, dass Spotify läuft und Sie Premium haben.`;
        startButton.disabled = false;
    }
}

// Wichtig: Der initiale Aufruf von getAccessTokenFromUrl() und die Konfiguration des Buttons
// müssen JETZT direkt aufgerufen werden, damit der Benutzer sofort klicken kann.
// window.onSpotifyWebPlaybackSDKReady wird dann die eigentliche Player-Initialisierung übernehmen.
document.addEventListener('DOMContentLoaded', () => {
    // Prüfe sofort, ob ein Token in der URL ist (nach Redirect).
    // Wenn ja, setze ihn global. Die SDK-Initialisierung wird ihn dann verwenden.
    const initialToken = getAccessTokenFromUrl();
    if (initialToken) {
        accessToken = initialToken;
        messageElement.textContent = 'Access Token erhalten. Warte auf Spotify SDK...';
        startButton.disabled = true; // Deaktivieren, bis das SDK bereit ist
        console.log("Initialer DOMContentLoaded: Access Token gefunden. Warte auf SDK Ready.");
    } else {
        // Wenn kein Token vorhanden ist, kann der Benutzer den Authentifizierungs-Flow starten.
        messageElement.textContent = 'Bitte klicken Sie auf "Start", um sich bei Spotify anzumelden.';
        startButton.disabled = false;
        startButton.onclick = redirectToAuthCodeFlow;
        console.log("Initialer DOMContentLoaded: Kein Access Token gefunden. Button für Login aktiv.");
    }
    // Der Rest der Logik (player creation, event listeners) erfolgt in onSpotifyWebPlaybackSDKReady
    // oder nach dem Laden der Playlist.
});
