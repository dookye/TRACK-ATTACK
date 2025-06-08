// app.js

// Deine Spotify Developer ID (Client ID)
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6';
// Deine Redirect URI (Muss exakt so im Spotify Dashboard hinterlegt sein!)
const REDIRECT_URI = 'https://dookye.github.io/musik-raten/';
// Die Scopes, die wir benötigen
const SCOPES = 'user-read-private user-read-email playlist-read-private user-modify-playback-state user-read-playback-state';
const PLAYLIST_ID = '39sVxPTg7BKwrf2MfgrtcD'; // Punk Rock (90's & 00's)
const AUTH_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// DOM-Elemente
const authButton = document.getElementById('spotify-auth-button');
const playerStatus = document.getElementById('player-status');

// Variablen zur Speicherung der Token
let accessToken = null;
let refreshToken = null;
let tokenExpiresIn = 0; // In Sekunden

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
        // Aktualisiere den Button und Status nach erfolgreichem Login
        authButton.textContent = 'TRACK ATTACK starten!';
        authButton.onclick = playRandomTrackFromPlaylist; // Button-Funktion ändern
        playerStatus.textContent = "Du bist angemeldet! Klicke 'TRACK ATTACK starten!' um ein Lied zu spielen.";

    } catch (error) {
        console.error('Fehler beim Token-Austausch:', error);
        playerStatus.textContent = `Authentifizierungsfehler: ${error.message}`;
        // Fallback: Button auf Login zurücksetzen, falls etwas schief geht
        authButton.textContent = 'Spotify Login';
        authButton.onclick = handleSpotifyAuth;
    }
}

/**
 * Spielt einen zufälligen Track aus der vordefinierten Spotify-Playlist für 2 Sekunden ab.
 * Benötigt einen Premium-Account und einen aktiven Spotify-Client, um ganze Tracks abzuspielen.
 */
async function playRandomTrackFromPlaylist() {
    if (!accessToken) {
        playerStatus.textContent = "Bitte melde dich zuerst bei Spotify an.";
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

        console.log("Ausgewählter Track:", randomTrack.name, "von", randomTrack.artists.map(a => a.name).join(', '));
        console.log("Track URI:", trackUri);

        // 2. Verfügbare Geräte des Benutzers abrufen
        const devicesResponse = await fetch('https://api.spotify.com/v1/me/player/devices', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!devicesResponse.ok) {
            const errorData = await devicesResponse.json();
            // Spezifische Fehlerbehandlung für fehlenden Premium-Account
            if (devicesResponse.status === 403 && errorData.error.message === "Premium required") {
                playerStatus.textContent = "Dein Spotify-Account ist kein Premium-Account. Zum Abspielen von Liedern wird ein Premium-Account benötigt.";
                authButton.disabled = false;
                return;
            }
            throw new Error(`Fehler beim Abrufen der Geräte: ${devicesResponse.status} ${devicesResponse.statusText} - ${errorData.error.message || JSON.stringify(errorData)}`);
        }

        const devicesData = await devicesResponse.json();
        
        let deviceId = null;

        // Priorisiere ein aktives Gerät
        const activeDevice = devicesData.devices.find(device => device.is_active);
        if (activeDevice) {
            deviceId = activeDevice.id;
            console.log("Aktives Gerät gefunden:", activeDevice.name);
        } else if (devicesData.devices.length > 0) {
            // Wenn kein aktives Gerät, wähle das erste verfügbare Gerät, das nicht in einer privaten Sitzung ist (wenn möglich)
            const nonPrivateDevice = devicesData.devices.find(device => !device.is_private_session);
            if (nonPrivateDevice) {
                deviceId = nonPrivateDevice.id;
                console.warn("Kein aktives Gerät gefunden, verwende erstes verfügbares nicht-privates Gerät:", nonPrivateDevice.name);
            } else {
                deviceId = devicesData.devices[0].id; // Fallback zum ersten Gerät
                console.warn("Kein aktives oder nicht-privates Gerät gefunden, verwende erstes verfügbares Gerät:", devicesData.devices[0].name);
            }
        }

        if (!deviceId) {
            playerStatus.textContent = "Kein steuerbares Spotify-Gerät gefunden. Bitte öffne die Spotify-App (Desktop/Mobil) oder den Spotify Web-Player, melde dich an und versuche es erneut.";
            authButton.disabled = false;
            return;
        }

        // 3. Wiedergabe starten (an zufälliger Stelle für 2 Sekunden)
        // Die Playback API erlaubt es, die Wiedergabe auf einem Gerät zu starten.
        // Die 'position_ms' ist die Startposition im Song.
        const playResponse = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uris: [trackUri],
                // Starte an einer zufälligen Position im Song.
                // Stelle sicher, dass die Position mindestens 1ms ist und nicht über die Songlänge hinausgeht,
                // abzüglich der 2 Sekunden, die abgespielt werden sollen.
                position_ms: Math.floor(Math.random() * Math.max(1, (randomTrack.duration_ms || 30000) - 2000))
            })
        });

        if (!playResponse.ok) {
            const errorText = await playResponse.text();
            throw new Error(`Fehler beim Starten der Wiedergabe: ${playResponse.status} ${playResponse.statusText} - ${errorText}`);
        }

        playerStatus.textContent = `Spiele ${randomTrack.name}...`;

        // Nach 2 Sekunden pausieren
        setTimeout(async () => {
            await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            playerStatus.textContent = "Musik gespielt für 2 Sekunden. Rate den Song!";
            authButton.disabled = false;
            // Hier könntest du dann die Spielmechanik starten (Input-Feld, etc.)
        }, 2000); // 2 Sekunden Pause

    } catch (error) {
        console.error('Fehler beim Abspielen des Songs:', error);
        // Verbesserte Fehlermeldung für den Benutzer
        playerStatus.textContent = `Fehler beim Abspielen: ${error.message}. Dies erfordert einen Premium-Account und einen aktiven Spotify-Client (Desktop/Mobil/Web-Player), der geöffnet und angemeldet ist. Bitte starte Spotify und versuche es erneut.`;
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
            playerStatus.textContent = "Du bist bereits angemeldet! Klicke 'TRACK ATTACK starten!' um ein Lied zu spielen.";
        } else {
            // Kein gültiges Token gefunden, zeige den initialen Login-Button an
            authButton.textContent = 'Spotify Login';
            authButton.onclick = handleSpotifyAuth;
            playerStatus.textContent = "Bitte melde dich an, um zu spielen.";
        }
    }
});
