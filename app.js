// app.js

// Deine Spotify Developer ID (Client ID)
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6';
// Deine Redirect URI (Muss exakt so im Spotify Dashboard hinterlegt sein!)
const REDIRECT_URI = 'https://dookye.github.io/musik-raten/';
// Die Scopes, die wir benötigen (zusätzlich 'streaming' für das Web Playback SDK)
const SCOPES = 'user-read-private user-read-email playlist-read-private user-modify-playback-state user-read-playback-state streaming';
const PLAYLIST_ID = '39sVxPTg7BKwrf2MfgrtcD'; // Punk Rock (90's & 00's)
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// DOM-Elemente
const authButton = document.getElementById('spotify-auth-button');
const playerStatus = document.getElementById('player-status');

// Variablen zur Speicherung der Token und des Spotify-Players
let accessToken = null;
let refreshToken = null;
let tokenExpiresIn = 0; // In Sekunden
let player = null; // Spotify Web Playback SDK Player Objekt
let deviceId = null; // ID des Web Playback SDK Geräts

// --- PKCE Helferfunktionen ---
/**
 * Generiert einen zufälligen String für den code_verifier oder state.
 * @param {number} length - Die Länge des zu generierenden Strings.
 * @returns {string} Ein zufälliger String.
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
 * Codiert einen ArrayBuffer in das Base64Url-Format.
 * @param {ArrayBuffer} buffer - Der zu kodierende Buffer.
 * @returns {string} Der Base64Url-kodierte String.
 */
function base64urlencode(buffer) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Berechnet den SHA256-Hash eines gegebenen Strings.
 * @param {string} plain - Der zu hashende String.
 * @returns {Promise<ArrayBuffer>} Ein Promise, das den ArrayBuffer des gehashten Strings zurückgibt.
 */
async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
}

/**
 * Generiert den code_challenge aus einem code_verifier.
 * @param {string} verifier - Der code_verifier.
 * @returns {Promise<string>} Ein Promise, das den Base64Url-kodierten SHA256-Hash des verifiers zurückgibt.
 */
async function generateCodeChallenge(verifier) {
    const hashed = await sha256(verifier);
    return base64urlencode(hashed);
}

// --- Spotify Authentifizierung ---
/**
 * Startet den Spotify OAuth 2.0 Authorization Code Flow mit PKCE.
 * Leitet den Benutzer zur Spotify-Login-Seite weiter.
 */
async function handleSpotifyAuth() {
    // Generiere und speichere code_verifier und code_challenge
    const codeVerifier = generateRandomString(128);
    localStorage.setItem('code_verifier', codeVerifier); // Persistenter speichern
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Generiere und speichere den state-Parameter für CSRF-Schutz
    const state = generateRandomString(16);
    localStorage.setItem('spotify_auth_state', state); // Persistenter speichern

    // Erstelle die URL-Parameter für den Autorisierungs-Request
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        state: state,
        code_challenge_method: 'S256', // PKCE Methode
        code_challenge: codeChallenge
    });

    // Leite den Benutzer zu Spotify weiter
    window.location.href = `${AUTH_URL}?${params.toString()}`;
}

/**
 * Tauscht den erhaltenen Authorization Code gegen ein Access Token und Refresh Token.
 * @param {string} code - Der von Spotify erhaltene Authorization Code.
 */
async function exchangeCodeForToken(code) {
    const storedState = localStorage.getItem('spotify_auth_state');
    const storedCodeVerifier = localStorage.getItem('code_verifier');

    // Prüfe, ob state und code_verifier vorhanden sind
    if (!storedState || !storedCodeVerifier) {
        console.error("Fehler: Zustand oder Code Verifier nicht gefunden. Authentifizierung möglicherweise unsicher oder nicht abgeschlossen.");
        playerStatus.textContent = "Authentifizierungsfehler: Bitte versuche es erneut.";
        return;
    }

    // Entferne die gespeicherten Werte, da sie nun verwendet wurden
    localStorage.removeItem('spotify_auth_state');
    localStorage.removeItem('code_verifier');

    // Erstelle die Parameter für den Token-Austausch
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: storedCodeVerifier // Hier wird der Verifier gesendet
    });

    try {
        const response = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params.toString()
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Fehler beim Abrufen des Tokens: ${response.status} ${response.statusText} - ${errorData.error_description || JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        accessToken = data.access_token;
        refreshToken = data.refresh_token; // Speichern für spätere Nutzung (z.B. Token-Erneuerung)
        tokenExpiresIn = data.expires_in; // Ablaufzeit des Tokens

        // Speichern der Token im Local Storage für Persistenz
        localStorage.setItem('spotify_access_token', accessToken);
        localStorage.setItem('spotify_refresh_token', refreshToken);
        // Speichern der exakten Ablaufzeit (aktuelle Zeit + expires_in in ms)
        localStorage.setItem('spotify_token_expires_at', Date.now() + (tokenExpiresIn * 1000));

        console.log('Access Token erhalten:', accessToken);
        playerStatus.textContent = "Du bist angemeldet! Initialisiere den Spotify-Player...";

        // Initialisiere den Spotify Web Playback SDK Player nach erfolgreichem Token-Austausch
        initializeSpotifyPlayer();
        
        authButton.textContent = 'TRACK ATTACK starten!';
        authButton.onclick = playRandomTrackFromPlaylist; // Button-Funktion ändern

    } catch (error) {
        console.error('Fehler beim Token-Austausch:', error);
        playerStatus.textContent = `Authentifizierungsfehler: ${error.message}`;
        // Fallback: Button auf Login zurücksetzen, falls etwas schief geht
        authButton.textContent = 'Spotify Login';
        authButton.onclick = handleSpotifyAuth;
    }
}

/**
 * Initialisiert den Spotify Web Playback SDK Player.
 * Diese Funktion wird aufgerufen, wenn das SDK geladen ist und ein Access Token verfügbar ist.
 */
function initializeSpotifyPlayer() {
    if (!accessToken) {
        console.error("Kein Access Token verfügbar, Player kann nicht initialisiert werden.");
        playerStatus.textContent = "Fehler: Nicht angemeldet, um den Player zu initialisieren.";
        return;
    }

    if (player) {
        console.warn("Spotify Player ist bereits initialisiert.");
        return;
    }

    player = new Spotify.Player({
        name: 'TRACK ATTACK Web Player', // Name deines Players
        getOAuthToken: cb => { cb(accessToken); }, // Funktion, die das Access Token bereitstellt
        volume: 0.5 // Standardlautstärke
    });

    // Connect Listener
    player.addListener('ready', ({ device_id }) => {
        deviceId = device_id;
        console.log('Ready with Device ID', deviceId);
        playerStatus.textContent = "Spotify-Player bereit! Klicke 'TRACK ATTACK starten!' um ein Lied zu spielen.";
        // Automatisches Transferieren der Wiedergabe auf diesen neuen Player, wenn er bereit ist
        transferPlaybackToDevice(deviceId);
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
        playerStatus.textContent = "Spotify-Player nicht verfügbar. Stelle sicher, dass du Premium hast.";
        deviceId = null; // Gerät ist nicht mehr verfügbar
    });

    player.addListener('account_error', ({ message }) => {
        console.error('Account Error:', message);
        if (message.includes("Premium required")) {
            playerStatus.textContent = "Spotify Premium-Account benötigt, um Musik abzuspielen.";
        } else {
            playerStatus.textContent = `Spotify-Fehler: ${message}`;
        }
    });

    player.addListener('authentication_error', ({ message }) => {
        console.error('Authentication Error:', message);
        playerStatus.textContent = "Spotify-Authentifizierungsfehler. Bitte logge dich erneut ein.";
        // Token ist wahrscheinlich abgelaufen oder ungültig, erzwinge Re-Login
        accessToken = null;
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_token_expires_at');
        authButton.textContent = 'Spotify Login';
        authButton.onclick = handleSpotifyAuth;
    });

    player.addListener('playback_error', ({ message }) => {
        console.error('Playback Error:', message);
        playerStatus.textContent = `Wiedergabefehler: ${message}`;
    });

    // Verbinde den Player mit Spotify
    player.connect();
}

/**
 * Transferiert die Wiedergabe zum neu erstellten Web Playback SDK Gerät.
 * Dies ist wichtig, damit der Player auf unserer Seite die Kontrolle übernimmt.
 * @param {string} newDeviceId - Die Geräte-ID des Web Playback SDK Players.
 */
async function transferPlaybackToDevice(newDeviceId) {
    if (!accessToken) {
        console.error("Kein Access Token verfügbar, Wiedergabe kann nicht transferiert werden.");
        return;
    }

    try {
        const response = await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                device_ids: [newDeviceId],
                play: false // Nicht sofort abspielen, nur Gerät aktivieren
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Fehler beim Übertragen der Wiedergabe: ${response.status} ${response.statusText} - ${errorText}`);
        }
        console.log(`Wiedergabe erfolgreich auf Gerät ${newDeviceId} übertragen.`);
    } catch (error) {
        console.error('Fehler beim Transferieren der Wiedergabe:', error);
        playerStatus.textContent = `Fehler beim Aktivieren des Players: ${error.message}`;
    }
}


/**
 * Spielt einen zufälligen Track aus der vordefinierten Spotify-Playlist für 2 Sekunden ab.
 * Nutzt den integrierten Spotify Web Playback SDK Player.
 */
async function playRandomTrackFromPlaylist() {
    if (!accessToken || !player || !deviceId) {
        playerStatus.textContent = "Spotify-Player ist noch nicht bereit oder du bist nicht angemeldet. Bitte warte oder logge dich erneut ein.";
        console.error("Player nicht bereit oder Device ID fehlt.");
        return;
    }

    // Optional: Überprüfe die Gültigkeit des Tokens vor der Nutzung
    const tokenExpiresAt = localStorage.getItem('spotify_token_expires_at');
    if (tokenExpiresAt && Date.now() > parseInt(tokenExpiresAt, 10)) {
        playerStatus.textContent = "Dein Spotify-Login ist abgelaufen. Bitte melde dich erneut an.";
        authButton.textContent = 'Spotify Login';
        authButton.onclick = handleSpotifyAuth;
        accessToken = null; // Token ungültig machen
        return;
    }

    playerStatus.textContent = "Lade Playlist und spiele Lied...";
    authButton.disabled = true; // Button während des Ladens deaktivieren

    try {
        // 1. Tracks der spezifischen Playlist abrufen
        const playlistResponse = await fetch(`https://api.spotify.com/v1/playlists/${PLAYLIST_ID}/tracks?limit=100`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!playlistResponse.ok) {
            const errorData = await playlistResponse.json();
            throw new Error(`Fehler beim Laden der Playlist: ${playlistResponse.status} ${playlistResponse.statusText} - ${errorData.error.message || JSON.stringify(errorData)}`);
        }

        const playlistData = await playlistResponse.json();
        // Filtern nach validen Tracks, die nicht null sind
        const tracks = playlistData.items.filter(item => item.track);

        if (tracks.length === 0) {
            playerStatus.textContent = "Keine Tracks in der Playlist gefunden. Stelle sicher, dass die Playlist Lieder enthält.";
            authButton.disabled = false;
            return;
        }

        // Zufälligen Track auswählen
        const randomIndex = Math.floor(Math.random() * tracks.length);
        const randomTrack = tracks[randomIndex].track;
        const trackUri = randomTrack.uri; // z.B. "spotify:track:..."

        console.log("Ausgewählter Track (SDK):", randomTrack.name, "von", randomTrack.artists.map(a => a.name).join(', '));
        console.log("Track URI (SDK):", trackUri);

        // Zufällige Startposition im Track (innerhalb der ersten 30 Sekunden oder Songlänge-2s)
        const startPosition = Math.floor(Math.random() * Math.max(1, (randomTrack.duration_ms || 30000) - 2000));


        // Wiedergabe über den Web Playback SDK Player starten
        player.play({
            uris: [trackUri],
            position_ms: startPosition,
            deviceId: deviceId // Sicherstellen, dass es auf unserem SDK-Gerät abgespielt wird
        });

        playerStatus.textContent = `Spiele ${randomTrack.name}...`;

        // Nach 2 Sekunden pausieren
        setTimeout(async () => {
            player.pause();
            playerStatus.textContent = "Musik gespielt für 2 Sekunden. Rate den Song!";
            authButton.disabled = false;
            // Hier könntest du dann die Spielmechanik starten (Input-Feld, etc.)
        }, 2000); // 2 Sekunden Pause

    } catch (error) {
        console.error('Fehler beim Abspielen des Songs mit SDK:', error);
        // Verbesserte Fehlermeldung für den Benutzer
        playerStatus.textContent = `Fehler beim Abspielen: ${error.message}. Dies erfordert einen Premium-Account und den erfolgreichen Start des Spotify Web Players auf dieser Seite.`;
        authButton.disabled = false;
    }
}

// --- Initialisierung beim Laden der Seite ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const storedState = localStorage.getItem('spotify_auth_state');

    // Prüfen, ob wir nach einem Spotify-Login von der Redirect-URI zurückkommen
    if (code && state && state === storedState) {
        playerStatus.textContent = "Authentifiziere mit Spotify...";
        // Bereinige die URL, um den Code und State zu entfernen
        history.replaceState({}, document.title, REDIRECT_URI);
        exchangeCodeForToken(code);
    } else {
        // Seite wird normal geladen, prüfe auf bereits vorhandene gültige Token
        const storedAccessToken = localStorage.getItem('spotify_access_token');
        const storedTokenExpiresAt = localStorage.getItem('spotify_token_expires_at');

        if (storedAccessToken && storedTokenExpiresAt && Date.now() < parseInt(storedTokenExpiresAt, 10)) {
            // Gültiges Token gefunden, setze die Variablen und aktualisiere den Button
            accessToken = storedAccessToken;
            refreshToken = localStorage.getItem('spotify_refresh_token');
            authButton.textContent = 'TRACK ATTACK starten!';
            authButton.onclick = playRandomTrackFromPlaylist;
            playerStatus.textContent = "Du bist bereits angemeldet! Initialisiere den Spotify-Player...";
            // Initialisiere den Player sofort, wenn ein gültiges Token gefunden wird
            initializeSpotifyPlayer();
        } else {
            // Kein gültiges Token gefunden, zeige den initialen Login-Button an
            authButton.textContent = 'Spotify Login';
            authButton.onclick = handleSpotifyAuth;
            playerStatus.textContent = "Bitte melde dich an, um zu spielen.";
        }
    }
});

// Listener, der ausgelöst wird, sobald das Spotify Web Playback SDK geladen ist
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('Spotify Web Playback SDK ist bereit.');
    // Wenn bereits ein Access Token vorhanden ist (z.B. bei Reload), initialisiere den Player hier
    if (accessToken) {
        initializeSpotifyPlayer();
    }
};
