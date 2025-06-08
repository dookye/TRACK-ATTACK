// --- Grundlegende Daten und Spotify Konfiguration ---
const clientId = '53257f6a1c144d3f929a60d691a0c6f6';
const redirectUri = 'https://dookye.github.io/musik-raten/'; // Muss exakt mit deiner registrierten Redirect URI übereinstimmen
let accessToken = null;
let spotifyPlayer = null;
let currentTrack = null;
const playbackDuration = 10000; // 10 Sekunden Wiedergabezeit
const playlistId = '39sVxPTg7BKwrf2MfgrtcD'; // Punk Rock (90's & 00')

// --- DOM Elemente ---
const welcomeScreen = document.getElementById('welcome-screen');
const playerTestScreen = document.getElementById('player-test-screen');
const loginButton = document.getElementById('login-button');
const playSongButton = document.getElementById('play-song-button');
const songInfoDiv = document.getElementById('song-info');
const songArtistSpan = document.getElementById('song-artist');
const songTitleSpan = document.getElementById('song-title');

// --- Spotify PKCE Login Flow Funktionen (aus deinem Anhang übernommen und korrigiert) ---

/**
 * Generiert eine zufällige Zeichenkette der angegebenen Länge.
 * Wird für den Code Verifier im PKCE-Flow verwendet.
 * @param {number} length Die Länge der zu generierenden Zeichenkette.
 * @returns {string} Die zufällig generierte Zeichenkette.
 */
function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Erstellt einen SHA256-Hash einer Zeichenkette und encodiert ihn Base64URL.
 * Wird für den Code Challenge im PKCE-Flow verwendet.
 * @param {string} plain Die unverschlüsselte Zeichenkette.
 * @returns {Promise<string>} Ein Promise, das den Base64URL-encodierten Hash zurückgibt.
 */
async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Leitet den Benutzer zur Spotify-Autorisierungsseite um, um den PKCE-Flow zu starten.
 */
async function redirectToSpotifyAuth() {
    const codeVerifier = generateRandomString(128); // Standardlänge für PKCE
    const codeChallenge = await sha256(codeVerifier);

    localStorage.setItem('code_verifier', codeVerifier); // Speichern für späteren Token-Austausch

    const args = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        // Erforderliche Scopes für den Web Playback SDK Player und den Zugriff auf Playlists
        scope: 'user-read-playback-state user-modify-playback-state streaming user-read-email user-read-private playlist-read-private playlist-read-collaborative',
        redirect_uri: redirectUri,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    });

    window.location = 'https://accounts.spotify.com/authorize?' + args.toString();
}

/**
 * Holt den Access Token von Spotify, nachdem der Benutzer die Autorisierung erteilt hat.
 * @param {string} code Der Autorisierungscode von Spotify.
 */
async function fetchAccessToken(code) {
    const codeVerifier = localStorage.getItem('code_verifier');

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier
    });

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Fehler beim Abrufen des Access Tokens:', errorData);
            alert('Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.');
            showScreen(welcomeScreen); // Bei Fehler zurück zum Login-Bildschirm
            return;
        }

        const data = await response.json();
        accessToken = data.access_token;
        // Speichern von Access Token, Refresh Token und Ablaufzeit
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', data.refresh_token);
        localStorage.setItem('expires_in', Date.now() + data.expires_in * 1000);
        console.log('Access Token erhalten:', accessToken);

        // Die Initialisierung des Spotify Players erfolgt über window.onSpotifyWebPlaybackSDKReady
        // sobald das SDK vollständig geladen ist.
    } catch (error) {
        console.error('Netzwerkfehler beim Abrufen des Access Tokens:', error);
        alert('Ein Netzwerkfehler ist bei der Anmeldung aufgetreten. Bitte versuchen Sie es erneut.');
        showScreen(welcomeScreen);
    }
}

/**
 * Aktualisiert den Access Token mithilfe des Refresh Tokens.
 * @returns {Promise<boolean>} True, wenn der Token erfolgreich aktualisiert wurde, sonst False.
 */
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
        console.warn('Kein Refresh Token verfügbar.');
        return false;
    }

    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId
    });

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        if (!response.ok) {
            console.error('Fehler beim Auffrischen des Access Tokens:', await response.json());
            // Bei Fehler (z.B. ungültiger Refresh Token) den Benutzer erneut anmelden lassen
            accessToken = null;
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('expires_in');
            showScreen(welcomeScreen);
            return false;
        }

        const data = await response.json();
        accessToken = data.access_token;
        localStorage.setItem('access_token', accessToken);
        // Aktualisiere auch den Refresh Token, falls ein neuer gesendet wird
        if (data.refresh_token) {
            localStorage.setItem('refresh_token', data.refresh_token);
        }
        localStorage.setItem('expires_in', Date.now() + data.expires_in * 1000);
        console.log('Access Token erfolgreich aufgefrischt.');
        return true;
    } catch (error) {
        console.error('Netzwerkfehler beim Auffrischen des Access Tokens:', error);
        alert('Ein Netzwerkfehler ist beim Aktualisieren der Anmeldung aufgetreten. Bitte melden Sie sich erneut an.');
        showScreen(welcomeScreen);
        return false;
    }
}
// --- Spotify Web Playback SDK Initialisierung ---
/**
 * Diese Funktion wird vom Spotify SDK aufgerufen, sobald es vollständig geladen und bereit ist.
 * Hier initialisieren wir unseren Spotify Player.
 */
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log("Spotify Web Playback SDK ist bereit!");
    initSpotifyPlayer();
};

/**
 * Initialisiert den Spotify Web Playback SDK Player.
 * Stellt sicher, dass das SDK geladen und ein Access Token vorhanden ist.
 */
async function initSpotifyPlayer() {
    // Überprüfen, ob das Spotify-Objekt tatsächlich definiert ist und ein Access Token vorliegt
    if (typeof Spotify === 'undefined' || !accessToken) {
        console.warn("Spotify SDK nicht geladen oder Access Token fehlt. Kann Player nicht initialisieren.");
        // Ggf. Benutzer informieren, dass ein Login notwendig ist
        if (!accessToken) {
             showScreen(welcomeScreen);
        }
        return;
    }

    // Prüfen, ob der Token bald abläuft und ggf. auffrischen
    const expiresIn = localStorage.getItem('expires_in');
    if (expiresIn && Date.now() >= parseInt(expiresIn) - (60 * 1000)) { // 1 Minute vor Ablauf
        console.log('Access Token läuft bald ab, versuche Refresh vor Player-Initialisierung.');
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            console.error("Token-Refresh fehlgeschlagen, kann Player nicht initialisieren.");
            return;
        }
    }

    // Wenn der Player bereits existiert, trennen und neu verbinden, um Duplikate zu vermeiden
    if (spotifyPlayer) {
        console.log("Vorhandenen Spotify Player trennen...");
        spotifyPlayer.disconnect();
    }

    spotifyPlayer = new Spotify.Player({
        name: 'Spotify Player Test', // Name, der in der Spotify App angezeigt wird
        getOAuthToken: cb => { cb(accessToken); }, // Callback für den Access Token
        volume: 0.5 // Standardlautstärke
    });

    // Event Listener für den Player
    spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        transferPlaybackToDevice(device_id); // Wiedergabe auf dieses Gerät übertragen
        showScreen(playerTestScreen); // Wechsel zum Test-Bildschirm, wenn Player bereit ist
    });

    spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
    });

    spotifyPlayer.addListener('initialization_error', ({ message }) => { console.error('Initialization Error:', message); });
    spotifyPlayer.addListener('authentication_error', async ({ message }) => {
        console.error('Authentication Error:', message);
        // Bei Authentifizierungsfehler versuchen, Token aufzufrischen
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            console.log("Token erneuert, Player neu initialisieren...");
            initSpotifyPlayer(); // Erneute Initialisierung nach erfolgreichem Refresh
        } else {
            alert('Ihre Spotify-Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.');
            showScreen(welcomeScreen);
        }
    });
    spotifyPlayer.addListener('account_error', ({ message }) => {
        console.error('Account Error (Premium-Konto erforderlich):', message);
        alert('Für die Wiedergabe wird ein aktiver Spotify Premium-Account benötigt.');
    });
    spotifyPlayer.addListener('playback_error', ({ message }) => {
        console.error('Playback Error:', message);
        alert('Fehler bei der Wiedergabe. Stellen Sie sicher, dass Spotify geöffnet ist und kein anderes Gerät aktiv ist.');
    });

    // Mit dem Player verbinden
    console.log("Verbinde Spotify Player...");
    spotifyPlayer.connect();
}

/**
 * Überträgt die Spotify-Wiedergabe auf das Web Playback SDK Gerät.
 * @param {string} deviceId Die Geräte-ID des Web Playback SDK Players.
 */
async function transferPlaybackToDevice(deviceId) {
    if (!accessToken) return;

    try {
        const response = await fetch('https://api.spotify.com/v1/me/player', { // Korrekte Spotify API Endpunkt
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false // Nicht automatisch abspielen, nur Gerät aktivieren
            })
        });

        if (response.ok) {
            console.log('Playback transferred to new device:', deviceId);
        } else {
            const errorData = await response.json();
            console.error('Fehler beim Übertragen der Wiedergabe auf Gerät (API Response):', errorData);
            alert('Achtung: Der Spotify Player konnte nicht automatisch aktiviert werden. Bitte stellen Sie sicher, dass Ihr Spotify Premium-Konto aktiv ist und Spotify (App oder Web) im Hintergrund läuft, damit das Web Playback SDK funktioniert.');
        }

    } catch (error) {
        console.error('Fehler beim Übertragen der Wiedergabe auf Gerät (Catch Block):', error);
        alert('Ein unerwarteter Fehler ist beim Aktivieren des Spotify Players aufgetreten. Bitte versuchen Sie es erneut.');
    }
}

// --- UI Management ---
/**
 * Zeigt den angegebenen Bildschirm an und versteckt alle anderen.
 * @param {HTMLElement} screenToShow Das HTML-Element des anzuzeigenden Bildschirms.
 */
function showScreen(screenToShow) {
    const screens = [welcomeScreen, playerTestScreen];
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    screenToShow.classList.add('active');
}

// --- Spotify Song Logik ---

/**
 * Holt die Tracks einer bestimmten Spotify-Playlist.
 * @param {string} pId Die ID der Playlist.
 * @returns {Promise<Array>} Ein Array von Track-Objekten.
 */
async function fetchPlaylistTracks(pId) {
    if (!accessToken) {
        console.error('Access Token nicht verfügbar.');
        return [];
    }
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${pId}/tracks?market=DE&limit=50`, { // Korrekter Spotify API Endpunkt
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            if (response.status === 401) {
                console.warn('Token abgelaufen oder ungültig beim Abrufen von Tracks. Versuche Refresh.');
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    return fetchPlaylistTracks(pId); // Erneuter Versuch nach erfolgreichem Refresh
                }
            }
            const errorData = await response.json();
            throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.error ? errorData.error.message : 'Unknown Error'}`);
        }
        const data = await response.json();
        // Filtern, um nur Tracks mit gültiger URI zu erhalten, die für die Wiedergabe über das SDK erforderlich sind
        return data.items.filter(item => item.track && item.track.uri && item.track.is_playable).map(item => item.track);
    } catch (error) {
        console.error('Fehler beim Abrufen der Playlist-Tracks:', error);
        alert(`Fehler beim Laden der Playlist-Tracks: ${error.message}.`);
        return [];
    }
}

/**
 * Spielt einen zufälligen Song aus der vordefinierten Playlist an einer zufälligen Position für 10 Sekunden ab.
 */
async function playRandomSong() {
    if (!spotifyPlayer || !accessToken) {
        alert('Spotify Player ist nicht bereit oder Sie sind nicht angemeldet. Bitte versuchen Sie, die Seite neu zu laden oder sich erneut anzumelden.');
        return;
    }

    const deviceId = spotifyPlayer._options.id;
    if (!deviceId) {
        alert('Spotify Player-Gerät nicht gefunden. Stellen Sie sicher, dass Spotify geöffnet ist und Ihr Premium-Konto aktiv ist.');
        console.error('Spotify Player-Gerät ID nicht verfügbar.');
        return;
    }

    const allTracks = await fetchPlaylistTracks(playlistId);

    if (allTracks.length === 0) {
        alert('Keine Songs in der Playlist gefunden oder Fehler beim Laden der Playlist. Versuchen Sie es später erneut.');
        return;
    }

    const randomTrackIndex = Math.floor(Math.random() * allTracks.length);
    currentTrack = allTracks[randomTrackIndex];

    if (!currentTrack || !currentTrack.uri) {
        console.error("Ausgewählter Track hat keine URI:", currentTrack);
        alert("Fehler: Konnte keinen spielbaren Song finden. Versuchen Sie es erneut.");
        return;
    }

    let startMs = 0;
    if (currentTrack.duration_ms) {
        // Start an zufälliger Stelle, aber mindestens so lang wie die Spieldauer vor dem Ende
        const minDurationRemaining = playbackDuration + 2000; // Etwas Puffer
        if (currentTrack.duration_ms > minDurationRemaining) {
            startMs = Math.floor(Math.random() * (currentTrack.duration_ms - minDurationRemaining));
        } else {
            // Wenn der Song kürzer als die gewünschte Abspieldauer ist, von Anfang an spielen
            startMs = 0;
        }
        if (startMs < 0) startMs = 0; // Sicherstellen, dass startMs nicht negativ ist
    }

    try {
        // Wiedergabe über das Spotify Web Playback SDK
        await spotifyPlayer.play({
            uris: [currentTrack.uri],
            position_ms: startMs,
            device_id: deviceId
        });
        console.log(`Playing: ${currentTrack.name} by ${currentTrack.artists[0].name} from ${startMs}ms`);

        revealSongInfo(); // Song-Informationen sofort anzeigen

        // Timer zum Stoppen der Wiedergabe nach 'playbackDuration'
        setTimeout(async () => {
            if (spotifyPlayer) {
                await spotifyPlayer.pause();
                console.log('Playback paused.');
            }
        }, playbackDuration);

    } catch (error) {
        console.error("Fehler beim Abspielen des Songs:", error);
        alert("Fehler beim Abspielen des Songs. Stellen Sie sicher, dass Ihr Spotify Premium-Konto aktiv ist und Spotify geöffnet ist.");
    }
}

/**
 * Zeigt die Informationen des aktuell spielenden Songs an.
 */
function revealSongInfo() {
    if (currentTrack) {
        songArtistSpan.textContent = currentTrack.artists.map(artist => artist.name).join(', ');
        songTitleSpan.textContent = currentTrack.name;
        songInfoDiv.classList.remove('hidden');
    }
}


// --- Event Listeners ---
loginButton.addEventListener('click', redirectToSpotifyAuth);
playSongButton.addEventListener('click', playRandomSong);

// --- Initialisierung beim Laden der Seite ---
document.addEventListener('DOMContentLoaded', async () => {
    // Spotify SDK Script dynamisch laden
    const spotifySdkScript = document.createElement('script');
    spotifySdkScript.src = 'https://sdk.scdn.co/spotify-player.js';
    spotifySdkScript.async = true;
    spotifySdkScript.defer = true;
    document.head.appendChild(spotifySdkScript);

    // Versuche, Access Token aus dem localStorage zu laden
    accessToken = localStorage.getItem('access_token');
    const expiresIn = localStorage.getItem('expires_in');
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        // Wenn ein Autorisierungscode in der URL ist (Rückkehr von Spotify Login)
        console.log('Autorisierungscode in URL gefunden. Fordere Access Token an...');
        await fetchAccessToken(code);
        // URL von den Parametern bereinigen, um erneute Code-Verwendung zu vermeiden
        history.replaceState(null, null, redirectUri);
        // Der Bildschirmwechsel passiert, wenn der Player bereit ist (siehe spotifyPlayer.addListener('ready'))
    } else if (accessToken && expiresIn && Date.now() < parseInt(expiresIn) - (5 * 60 * 1000)) { // Token ist noch mind. 5 Minuten gültig
        console.log('Gültiger Access Token aus localStorage geladen.');
        // Player wird durch onSpotifyWebPlaybackSDKReady initialisiert
    } else if (accessToken && expiresIn && Date.now() >= parseInt(expiresIn) - (5 * 60 * 1000)) { // Token ist bald abgelaufen, versuchen zu aktualisieren
        console.log('Access Token läuft bald ab, versuche Refresh.');
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            console.log('Token erfolgreich aufgefrischt.');
            // Player wird durch onSpotifyWebPlaybackSDKReady initialisiert
        } else {
            console.log('Token Refresh fehlgeschlagen, zurück zum Login.');
            showScreen(welcomeScreen);
        }
    } else {
        // Kein Token oder abgelaufen, zeige Login-Bildschirm
        console.log('Kein gültiger Access Token. Zeige Begrüßungsbildschirm.');
        showScreen(welcomeScreen);
    }
});
