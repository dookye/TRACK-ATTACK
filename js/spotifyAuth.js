// js/spotifyAuth.js

import { CLIENT_ID, REDIRECT_URI, SCOPES, SPOTIFY_AUTHORIZE_URL, SPOTIFY_TOKEN_URL } from './constants.js';
import { setAccessToken, setIsSpotifySDKLoaded, setPlayer, setActiveDeviceId, accessToken, isSpotifySDKLoaded, isPlayerReady } from './gameState.js';
import { generateCodeChallenge, generateRandomString } from './utils.js';
import { showLoginScreen, playbackStatus } from './domElements.js';

// Wichtig: handlePlayerReady wird von main.js exportiert und hier importiert.
// Dadurch vermeiden wir Zirkelabhängigkeiten zwischen spotifyPlayer.js und main.js.
import { handlePlayerReady } from './main.js';

/**
 * Leitet den Benutzer zum Spotify-Login weiter (PKCE Flow).
 * Speichert den code_verifier im localStorage.
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
        // alert('Fehler: Code Verifier nicht gefunden. Bitte versuche den Login erneut.'); // Optional für Debugging
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
        setAccessToken(data.access_token); // Setzt das Token im gameState
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
 *
 * Sobald das SDK geladen ist, wird setIsSpotifySDKLoaded auf true gesetzt.
 * Wenn bereits ein Access Token vorhanden ist, wird der Spotify Player initialisiert.
 * Andernfalls wird der Login-Screen angezeigt.
 */
window.onSpotifyWebPlaybackSDKReady = async () => {
    console.log('window.onSpotifyWebPlaybackSDKReady: Spotify Web Playback SDK ist bereit.');
    setIsSpotifySDKLoaded(true); // Aktualisiert den Zustand

    // Dynamischer Import des spotifyPlayer-Moduls, um Zirkelabhängigkeiten zu vermeiden
    // (spotifyPlayer importiert gameState, gameState wird hier in auth verwendet etc.)
    const { initializeSpotifyPlayer } = await import('./spotifyPlayer.js');

    if (accessToken) { // Greift auf den direkt importierten accessToken aus gameState zu
        console.log("window.onSpotifyWebPlaybackSDKReady: Access Token vorhanden, initialisiere Player.");
        initializeSpotifyPlayer();
    } else {
        console.log("window.onSpotifyWebPlaybackSDKReady: Kein Access Token vorhanden. Zeige Login-Screen.");
        showLoginScreen();
    }
};


/**
 * Überprüft den Spotify Login-Status beim Laden der Seite.
 * Handhabt den Redirect-Code und lädt vorhandene Tokens.
 * Initialisiert den Spotify Player, wenn alles bereit ist.
 */
export async function checkSpotifyLoginStatus() {
    console.log("checkSpotifyLoginStatus: Überprüfe Spotify Login Status.");
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        // Fall 1: Wir kommen von Spotify mit einem Authorization Code zurück
        console.log('checkSpotifyLoginStatus: Authorization Code erhalten, tausche ihn gegen Access Token.');
        const success = await exchangeCodeForTokens(code); // Warten, bis Token-Austausch abgeschlossen ist
        history.replaceState({}, document.title, REDIRECT_URI); // Code aus URL entfernen, um saubere URL zu haben

        if (success) {
            // Nachdem der Token erfolgreich ausgetauscht wurde, prüfen wir, ob das SDK bereits geladen ist.
            // Die initializeSpotifyPlayer() wird entweder direkt hier aufgerufen ODER
            // sie wird von window.onSpotifyWebPlaybackSDKReady aufgerufen, sobald das SDK fertig ist.
            if (isSpotifySDKLoaded) {
                 console.log("checkSpotifyLoginStatus: Token vorhanden und SDK geladen. Initialisiere Player.");
                 const { initializeSpotifyPlayer } = await import('./spotifyPlayer.js');
                 initializeSpotifyPlayer();
            } else {
                console.log("checkSpotifyLoginStatus: Token vorhanden, warte auf Spotify SDK Ready.");
                // Player-Initialisierung wird durch window.onSpotifyWebPlaybackSDKReady getriggert
            }
        } else {
            console.log("checkSpotifyLoginStatus: Token-Austausch fehlgeschlagen. Zeige Login-Screen.");
            showLoginScreen();
        }
    } else if (localStorage.getItem('access_token') && localStorage.getItem('expires_in') > Date.now()) {
        // Fall 2: Gültiger Access Token im localStorage vorhanden
        console.log('checkSpotifyLoginStatus: Vorhandenen Access Token aus localStorage geladen.');
        setAccessToken(localStorage.getItem('access_token')); // Token im gameState setzen

        if (isSpotifySDKLoaded) {
            console.log("checkSpotifyLoginStatus: Vorhandener Token und SDK geladen. Initialisiere Player.");
            const { initializeSpotifyPlayer } = await import('./spotifyPlayer.js');
            initializeSpotifyPlayer();
        } else {
            console.log("checkSpotifyLoginStatus: Vorhandener Token, warte auf Spotify SDK Ready.");
            // Player-Initialisierung wird durch window.onSpotifyWebPlaybackSDKReady getriggert
        }
    } else {
        // Fall 3: Kein Code und kein gültiger Token -> Zeige Login-Screen
        console.log('checkSpotifyLoginStatus: Kein gültiger Access Token vorhanden. Zeige Login-Screen.');
        playbackStatus.textContent = 'Bitte logge dich mit Spotify ein.';
        showLoginScreen();
    }
}
