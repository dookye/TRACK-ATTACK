// spotifyAuth.js
import { CLIENT_ID, REDIRECT_URI, SCOPES, SPOTIFY_AUTHORIZE_URL, SPOTIFY_TOKEN_URL } from './constants.js';
// Importiere die benötigten Variablen direkt aus gameState.js
import { setAccessToken, setIsSpotifySDKLoaded, setIsPlayerReady, setPlayer, setActiveDeviceId, accessToken, isSpotifySDKLoaded } from './gameState.js'; // <-- isSpotifySDKLoaded hier hinzugefügt
import { generateCodeChallenge, generateRandomString } from './utils.js';
import { initializeSpotifyPlayer } from './spotifyPlayer.js';
import { showLoginScreen } from './uiManager.js';
import { playbackStatus } from './domElements.js';
import { handlePlayerReady } from './main.js';

/**
 * Leitet den Benutzer zum Spotify-Login weiter (PKCE Flow).
 */
export async function redirectToSpotifyAuthorize() {
    console.log("redirectToSpotifyAuthorize: Leite zu Spotify Authorize um.");
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
 * @returns {Promise<boolean>} True, wenn erfolgreich, False sonst.
 */
export async function exchangeCodeForTokens(code) {
    console.log("exchangeCodeForTokens: Starte Token-Austausch mit Spotify.");
    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) {
        console.error('exchangeCodeForTokens: Code Verifier nicht gefunden. Kann Token nicht austauschen.');
        playbackStatus.textContent = 'Fehler: Code Verifier fehlt. Bitte versuche den Login erneut.';
        alert('Fehler: Code Verifier nicht gefunden. Bitte versuche den Login erneut.');
        showLoginScreen();
        return false;
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
        setAccessToken(data.access_token);
        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('expires_in', Date.now() + data.expires_in * 1000); // Ablaufzeitpunkt speichern

        console.log('exchangeCodeForTokens: Access Token erfolgreich erhalten und gespeichert.');
        localStorage.removeItem('code_verifier');
        return true;

    } catch (error) {
        console.error('exchangeCodeForTokens: Fehler beim Token-Austausch:', error);
        playbackStatus.textContent = 'Fehler beim Spotify Login. Bitte versuche es erneut.';
        alert('Fehler beim Spotify Login. Bitte versuche es erneut. Stelle sicher, dass du einen Premium Account hast.');
        showLoginScreen();
        return false;
    }
}

/**
 * Globaler Callback für das Spotify Web Playback SDK.
 * WIRD VOM SDK AUFGERUFEN, SOBALD ES GELADEN IST.
 * Muss global am Window-Objekt sein, damit das SDK es finden kann.
 */
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('window.onSpotifyWebPlaybackSDKReady: Spotify Web Playback SDK ist bereit.');
    setIsSpotifySDKLoaded(true);

    if (accessToken) {
        console.log("window.onSpotifyWebPlaybackSDKReady: Access Token vorhanden, initialisiere Player.");
        initializeSpotifyPlayer();
    } else {
        console.log("window.onSpotifyWebPlaybackSDKReady: Kein Access Token vorhanden. Warte auf Login.");
        showLoginScreen();
    }
};

/**
 * Überprüft den Spotify Login-Status und initialisiert den Player.
 */
export async function checkSpotifyLoginStatus() {
    console.log("checkSpotifyLoginStatus: Überprüfe Spotify Login Status.");
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        console.log('checkSpotifyLoginStatus: Authorization Code erhalten, tausche ihn gegen Access Token.');
        const success = await exchangeCodeForTokens(code); // Warte auf Erfolg
        history.replaceState({}, document.title, REDIRECT_URI); // Code aus URL entfernen

        // Korrektur hier: Prüfe direkt die importierte Variable isSpotifySDKLoaded
        if (success && isSpotifySDKLoaded) { // <-- HIER die Änderung
            console.log("checkSpotifyLoginStatus: Access Token und SDK bereit, initialisiere Player.");
            initializeSpotifyPlayer();
        } else if (success) {
            console.log("checkSpotifyLoginStatus: Access Token vorhanden, aber SDK noch nicht geladen. Player-Initialisierung wartet auf SDK Ready.");
        } else {
            console.log("checkSpotifyLoginStatus: Token-Austausch fehlgeschlagen oder kein Access Token.");
            showLoginScreen();
        }
    } else if (localStorage.getItem('access_token') && localStorage.getItem('expires_in') > Date.now()) {
        console.log('checkSpotifyLoginStatus: Vorhandenen Access Token aus localStorage geladen.');
        setAccessToken(localStorage.getItem('access_token'));
        // Korrektur hier: Prüfe direkt die importierte Variable isSpotifySDKLoaded
        if (isSpotifySDKLoaded) { // <-- HIER die Änderung
            console.log("checkSpotifyLoginStatus: Vorhandener Token und SDK bereit, initialisiere Player.");
            initializeSpotifyPlayer();
        } else {
            console.log("checkSpotifyLoginStatus: Vorhandener Token, aber SDK noch nicht geladen. Player-Initialisierung wartet auf SDK Ready.");
        }
    } else {
        console.log('checkSpotifyLoginStatus: Kein gültiger Access Token vorhanden. Zeige Login-Screen.');
        playbackStatus.textContent = 'Bitte logge dich mit Spotify ein.';
        showLoginScreen();
    }
}
