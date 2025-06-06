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
function getAccessToken() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const token = params.get('access_token');

    if (token) {
        accessToken = token;
        // Speichern Sie den Token, um ihn nicht bei jedem Neuladen abrufen zu müssen (für diese Testversion optional, aber gut zu wissen)
        // localStorage.setItem('spotify_access_token', token);
        // localStorage.setItem('spotify_token_expires_in', Date.now() + params.get('expires_in') * 1000);
        window.history.replaceState({}, document.title, window.location.pathname); // Entfernt den Token aus der URL
        console.log("Access Token erhalten:", accessToken);
        return true;
    }
    return false;
}

function redirectToAuthCodeFlow() {
    const scope = 'user-read-private user-read-email streaming user-modify-playback-state';
    const authUrl = `https://accounts.spotify.com/authorize?response_type=token&client_id=${clientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = authUrl;
}

// --- Spotify Web Playback SDK Initialisierung ---
window.onSpotifyWebPlaybackSDKReady = () => {
    if (!getAccessToken()) {
        messageElement.textContent = 'Bitte klicken Sie auf "Start", um sich bei Spotify anzumelden.';
        startButton.disabled = false; // Start-Button aktivieren, um den Auth-Flow zu starten
        startButton.onclick = redirectToAuthCodeFlow;
        return;
    }

    messageElement.textContent = 'Initialisiere Spotify Player...';
    startButton.disabled = true;

    player = new Spotify.Player({
        name: 'Musik-Raten Web Player',
        getOAuthToken: cb => { cb(accessToken); },
        volume: 0.5
    });

    // Ereignis-Listener
    player.addListener('ready', ({ device_id }) => {
        deviceId = device_id;
        console.log('Bereit auf Gerät mit ID', deviceId);
        messageElement.textContent = 'Player bereit. Lade Playlist...';
        loadPlaylistTracks();
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.log('Gerät mit ID ist offline', device_id);
        messageElement.textContent = 'Gerät ist offline. Bitte stellen Sie sicher, dass Spotify geöffnet ist.';
        startButton.disabled = true;
    });

    player.addListener('initialization_error', ({ message }) => {
        console.error('Fehler bei der Initialisierung:', message);
        messageElement.textContent = `Fehler beim Initialisieren des Players: ${message}. Stellen Sie sicher, dass Sie Premium haben.`;
        startButton.disabled = true;
    });

    player.addListener('authentication_error', ({ message }) => {
        console.error('Authentifizierungsfehler:', message);
        messageElement.textContent = `Authentifizierungsfehler: ${message}. Bitte versuchen Sie es erneut.`;
        startButton.disabled = false; // Ermöglicht erneute Anmeldung
        startButton.onclick = redirectToAuthCodeFlow; // Setzt den Klick-Handler zurück
    });

    player.addListener('account_error', ({ message }) => {
        console.error('Account-Fehler:', message);
        messageElement.textContent = `Account-Fehler: ${message}. Benötigt Spotify Premium.`;
        startButton.disabled = true;
    });

    player.connect();
};

// --- Playlist Tracks abrufen ---
async function loadPlaylistTracks() {
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`, { // Max 100 Tracks pro Request
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
        tracks = data.items
            .filter(item => item.track && item.track.preview_url === null) // Nur Tracks ohne Preview-URL, da wir das volle Lied nutzen
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
        messageElement.textContent = 'Player nicht bereit oder keine Tracks geladen.';
        return;
    }

    startButton.disabled = true;
    messageElement.textContent = 'Spiele Song ab...';

    // Wenn ein Timeout läuft, löschen
    if (currentTrackTimeout) {
        clearTimeout(currentTrackTimeout);
    }

    let randomTrack;
    do {
        randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
    } while (randomTrack.uri === currentTrackUri && tracks.length > 1); // Sicherstellen, dass ein anderer Song gespielt wird, wenn möglich

    currentTrackUri = randomTrack.uri;

    // Zufällige Startposition (mindestens 1 Sekunde vor Ende des 3-Sekunden-Snippets)
    const playbackDuration = 3000; // 3 Sekunden
    const maxStartTime = randomTrack.duration_ms - playbackDuration - 1000; // max 1 Sekunde vor Ende
    const startPosition = Math.max(0, Math.floor(Math.random() * maxStartTime));

    console.log(`Spiele: ${randomTrack.uri} ab ${startPosition}ms`);

    try {
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
        }, playbackDuration); // Nach 3 Sekunden pausieren

    } catch (error) {
        console.error('Fehler beim Abspielen des Songs:', error);
        messageElement.textContent = `Fehler beim Abspielen: ${error.message}`;
        startButton.disabled = false;
    }
}

// Initialer Check, ob Access Token vorhanden ist
// (Dies wird ausgeführt, wenn die Seite geladen wird oder nach der Umleitung von Spotify)
if (getAccessToken()) {
    // Wenn Token vorhanden, wird onSpotifyWebPlaybackSDKReady den Player initialisieren und die Playlist laden.
    messageElement.textContent = 'Access Token erhalten. Warte auf Spotify SDK...';
    startButton.disabled = true;
} else {
    // Wenn kein Token vorhanden ist, wird der Benutzer aufgefordert, sich anzumelden, sobald der Button geklickt wird.
    messageElement.textContent = 'Bitte klicken Sie auf "Start", um sich bei Spotify anzumelden.';
    startButton.disabled = false;
    startButton.onclick = redirectToAuthCodeFlow;
}

