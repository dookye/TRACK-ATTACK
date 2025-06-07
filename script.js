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
function getAccessTokenFromUrl() {
    const params = new URLSearchParams(window.location.hash.substring(1));
    const token = params.get('access_token');

    if (token) {
        // Token wurde erfolgreich aus der URL extrahiert
        window.history.replaceState({}, document.title, window.location.pathname); // Entfernt den Token aus der URL
        console.log("Access Token erhalten:", token);
        return token;
    }
    return null; // Kein Token gefunden
}

function redirectToAuthCodeFlow() {
    messageElement.textContent = 'Leite zur Spotify-Anmeldung weiter...';
    startButton.disabled = true; // Button deaktivieren, solange umgeleitet wird
    const scope = 'user-read-private user-read-email streaming user-modify-playback-state';
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    window.location.href = authUrl;
}

// --- Spotify Web Playback SDK Initialisierung ---
// Diese Funktion wird automatisch vom Spotify SDK aufgerufen, wenn es geladen ist.
window.onSpotifyWebPlaybackSDKReady = () => {
    // Versuche, einen Token aus der URL zu bekommen, falls wir gerade von Spotify zurückkommen
    const tokenFromUrl = getAccessTokenFromUrl();
    if (tokenFromUrl) {
        accessToken = tokenFromUrl;
        console.log("SDK Ready mit vorhandenem Access Token. Initialisiere Player.");
        initializeSpotifyPlayer();
    } else if (accessToken) {
        // Wenn ein Token bereits in 'accessToken' gesetzt ist (z.B. durch einen vorherigen Login),
        // aber nicht gerade aus der URL kam (da wir die URL bereinigt haben), dann nutze diesen.
        console.log("SDK Ready, Access Token bereits gesetzt. Initialisiere Player.");
        initializeSpotifyPlayer();
    } else {
        // Kein Token gefunden, weder in URL noch bereits gesetzt.
        messageElement.textContent = 'Bitte klicken Sie auf "Start", um sich bei Spotify anzumelden.';
        startButton.disabled = false;
        startButton.onclick = redirectToAuthCodeFlow;
        console.log("SDK Ready, kein Access Token gefunden. Warte auf Benutzer-Login.");
    }
};

function initializeSpotifyPlayer() {
    messageElement.textContent = 'Initialisiere Spotify Player...';
    startButton.disabled = true; // Deaktivieren, solange der Player initialisiert wird

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
        loadPlaylistTracks(); // Sobald der Player bereit ist, Playlist laden
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.log('Gerät mit ID ist offline', device_id);
        messageElement.textContent = 'Gerät ist offline. Bitte stellen Sie sicher, dass Spotify geöffnet ist und Sie Premium haben.';
        startButton.disabled = true;
    });

    player.addListener('initialization_error', ({ message }) => {
        console.error('Fehler bei der Initialisierung:', message);
        messageElement.textContent = `Fehler beim Initialisieren des Players: ${message}. Stellen Sie sicher, dass Sie Spotify Premium haben.`;
        startButton.disabled = true; // Im Fehlerfall den Button deaktivieren
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
        startButton.disabled = true; // Im Fehlerfall den Button deaktivieren
    });

    player.connect();
}


// --- Playlist Tracks abrufen ---
async function loadPlaylistTracks() {
    try {
        // Korrekte API-URL für Playlists (Tracks)
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
        // Filtern Sie Tracks, die spielbar sind. Manchmal sind preview_url=null Tracks spielbar,
        // aber es ist sicherer, auf 'is_playable' zu prüfen. Wenn is_playable nicht existiert
        // oder null ist, ist die Annahme, dass es abspielbar ist, für Testzwecke OK.
        tracks = data.items
            .filter(item => item.track && item.track.is_playable !== false) // Tracks, die explizit nicht spielbar sind, filtern
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
        startButton.disabled = false; // Erlaubt erneuten Versuch
        startButton.onclick = redirectToAuthCodeFlow; // Ggf. erneuten Login starten
        return;
    }

    startButton.disabled = true;
    messageElement.textContent = 'Spiele Song ab...';

    // Wenn ein Timeout läuft, löschen
    if (currentTrackTimeout) {
        clearTimeout(currentTrackTimeout);
    }

    let randomTrack;
    // Schleife, um sicherzustellen, dass nicht derselbe Song zweimal hintereinander kommt,
    // es sei denn, es gibt nur einen Song in der Playlist.
    if (tracks.length > 1) {
        do {
            randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
        } while (randomTrack.uri === currentTrackUri);
    } else {
        randomTrack = tracks[0]; // Wenn nur ein Song, spiel diesen
    }

    currentTrackUri = randomTrack.uri;

    // Zufällige Startposition (mindestens 1 Sekunde vor Ende des 3-Sekunden-Snippets)
    const playbackDuration = 3000; // 3 Sekunden
    const minTrackDurationNeeded = playbackDuration + 1000; // Track muss mindestens 4 Sekunden lang sein
    const maxStartTime = randomTrack.duration_ms - minTrackDurationNeeded;

    let startPosition = 0;
    if (maxStartTime > 0) { // Nur wenn der Track lang genug ist, um eine zufällige Position zu haben
        startPosition = Math.floor(Math.random() * maxStartTime);
    } else {
        // Track ist zu kurz für eine zufällige Startposition von 3 Sekunden + Puffer
        // Starte einfach am Anfang
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

        // Setup the timeout to pause the song after 3 seconds
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
                startButton.disabled = false; // Button wieder aktivieren, auch wenn Pause fehlschlägt
            }
        }, playbackDuration); // Nach 3 Sekunden pausieren

    } catch (error) {
        console.error('Fehler beim Abspielen des Songs:', error);
        messageElement.textContent = `Fehler beim Abspielen: ${error.message}. Stellen Sie sicher, dass Spotify läuft und Sie Premium haben.`;
        startButton.disabled = false; // Button wieder aktivieren, um einen erneuten Versuch zu ermöglichen
    }
}

// Initialer Aufruf bei Seitenladung, um den Access Token zu prüfen
// und den Start-Button entsprechend zu konfigurieren.
document.addEventListener('DOMContentLoaded', () => {
    // Versuche, einen Token aus der URL zu bekommen, falls wir gerade von Spotify zurückkommen
    const token = getAccessTokenFromUrl();
    if (token) {
        accessToken = token;
        // Wenn ein Token vorhanden ist, aber das SDK noch nicht bereit ist,
        // lassen wir window.onSpotifyWebPlaybackSDKReady die Initialisierung übernehmen.
        // Die Meldung wird dann vom SDK gesetzt.
        messageElement.textContent = 'Access Token erhalten. Warte auf Spotify SDK...';
        startButton.disabled = true; // Deaktivieren, bis das SDK bereit ist
    } else {
        // Wenn kein Token vorhanden ist, kann der Benutzer den Authentifizierungs-Flow starten.
        messageElement.textContent = 'Bitte klicken Sie auf "Start", um sich bei Spotify anzumelden.';
        startButton.disabled = false;
        startButton.onclick = redirectToAuthCodeFlow;
    }
});
