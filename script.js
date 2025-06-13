// --- ALLGEMEINE KONSTANTEN & VARIABLEN (Startbildschirm & UI) ---
const logo = document.getElementById('game-logo');
const logoContainer = document.getElementById('logo-container');
const loginArea = document.getElementById('login-area');
const spotifyLoginButton = document.getElementById('spotify-login-button');
const initialClickBlocker = document.getElementById('initial-click-blocker');
const orientationMessage = document.getElementById('orientation-message');
const fullscreenMessage = document.getElementById('fullscreen-message');
const gameContainer = document.querySelector('.game-container');

// Spotify UI-Elemente
const playbackStatus = document.getElementById('playback-status');

// --- SPOTIFY KONSTANTEN ---
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6';
const REDIRECT_URI = 'https://dookye.github.io/musik-raten/'; // Deine GitHub Pages URL
const PLAYLIST_ID = '39sVxPTg7BKwrf2MfgrtcD'; // Punk Rock (90's & 00's)
const SCOPES = [
    'user-read-private',
    'user-read-email',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state'
];

// --- SPOTIFY API ENDPUNKTE (KORREKTE SPOTIFY-URLS!) ---
const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL     = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE_URL  = 'https://api.spotify.com/v1';


// --- GLOBALE ZUSTANDSVARIABLEN ---
let accessToken = '';
let player = null;
let currentPlaylistTracks = [];
let activeDeviceId = null;
let isPlayerReady = false; // Flag, wenn der SDK-Player verbunden ist
let isSpotifySDKLoaded = false; // Flag, wenn das SDK geladen ist
let fullscreenRequested = false; // Zur Steuerung des Fullscreen-States
let logoClickListener = null; // Für den dynamischen Klick-Listener des Logos
let currentGameState = 'loading'; // Zustände: 'loading', 'startScreen', 'playing', 'songPlaying', 'songPaused'
// Globale Variable, um zu speichern, ob die Logo-Intro-Animation schon einmal lief
let introAnimationPlayed = false;
let logoClickListener = null; // Für den dynamischen Klick-Listener des Logos



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

// --- SPOTIFY AUTH & PLAYER FUNKTIONEN ---

/**
 * Leitet den Benutzer zum Spotify-Login weiter (PKCE Flow).
 */
async function redirectToSpotifyAuthorize() {
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
 */
async function exchangeCodeForTokens(code) {
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
        accessToken = data.access_token;
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
 * Initialisiert und verbindet den Spotify Player.
 */
async function initializeSpotifyPlayer() {
    console.log('initializeSpotifyPlayer: Versuche Spotify Player zu initialisieren...');

    if (!isSpotifySDKLoaded) {
        console.warn('initializeSpotifyPlayer: SDK noch nicht geladen. Warte auf window.onSpotifyWebPlaybackSDKReady.');
        return;
    }
    if (!accessToken || localStorage.getItem('expires_in') < Date.now()) {
        console.warn('initializeSpotifyPlayer: Access Token fehlt oder ist abgelaufen. Zeige Login-Screen.');
        playbackStatus.textContent = 'Fehler: Spotify Session abgelaufen oder nicht angemeldet. Bitte neu anmelden.';
        showLoginScreen();
        return;
    }

    if (player) {
        console.log('initializeSpotifyPlayer: Spotify Player bereits initialisiert. Nichts zu tun.');
        playbackStatus.textContent = 'Spotify Player verbunden!';
        handlePlayerReady();
        return;
    }

    if (typeof Spotify === 'undefined' || typeof Spotify.Player === 'undefined') {
        console.error('initializeSpotifyPlayer: Spotify Web Playback SDK (Spotify.Player) ist nicht verfügbar.');
        playbackStatus.textContent = 'Spotify SDK nicht geladen. Bitte überprüfe deine Internetverbindung.';
        return;
    }

    playbackStatus.textContent = 'Spotify Player wird verbunden...';
    player = new Spotify.Player({
        name: 'TRACK ATTACK Player',
        getOAuthToken: cb => { cb(accessToken); },
        volume: 0.5
    });

    player.addListener('ready', ({ device_id }) => {
        console.log('Player.ready: Spotify Player ist bereit auf Gerät-ID:', device_id);
        activeDeviceId = device_id;
        isPlayerReady = true;
        playbackStatus.textContent = 'Spotify Player verbunden!';
        transferPlayback(device_id);
        console.log("Spotify Player ready! Du bist jetzt eingeloggt und der Player ist bereit.");
        handlePlayerReady();
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.warn('Player.not_ready: Gerät-ID nicht bereit:', device_id);
        playbackStatus.textContent = 'Spotify Player ist nicht bereit. Ist Spotify im Browser offen?';
        isPlayerReady = false;
    });

    player.addListener('initialization_error', ({ message }) => {
        console.error('Player.initialization_error:', message);
        playbackStatus.textContent = `Fehler beim Initialisieren des Players: ${message}`;
        isPlayerReady = false;
        alert('Fehler beim Initialisieren des Spotify Players. Versuche es erneut.');
        showLoginScreen();
    });

    player.addListener('authentication_error', ({ message }) => {
        console.error('Player.authentication_error:', message);
        playbackStatus.textContent = 'Authentifizierungsfehler. Bitte logge dich erneut ein.';
        alert('Deine Spotify-Sitzung ist abgelaufen oder ungültig. Bitte logge dich erneut ein.');
        isPlayerReady = false;
        showLoginScreen();
    });

    player.addListener('account_error', ({ message }) => {
        console.error('Player.account_error:', message);
        playbackStatus.textContent = 'Account-Fehler. Hast du einen Spotify Premium Account?';
        alert('Es gab einen Fehler mit deinem Spotify Account. Für dieses Spiel ist ein Premium Account erforderlich.');
        isPlayerReady = false;
        showLoginScreen();
    });

    player.addListener('playback_error', ({ message }) => {
        console.error('Player.playback_error:', message);
        playbackStatus.textContent = `Wiedergabefehler: ${message}`;
    });

    player.addListener('player_state_changed', (state) => {
        if (!state) {
            return;
        }
    });

    player.connect().then(success => {
        if (success) {
            console.log('Player.connect: Der Web Playback SDK Player wurde erfolgreich verbunden (wartet auf "ready"-Status).');
        } else {
            console.warn('Player.connect: Verbindung zum Web Playback SDK Player fehlgeschlagen.');
            playbackStatus.textContent = 'Verbindung zum Spotify Player fehlgeschlagen.';
        }
    }).catch(err => {
        console.error('Player.connect Fehler:', err);
        playbackStatus.textContent = `Verbindung zum Player fehlgeschlagen: ${err.message}`;
    });
}

/**
 * Globaler Callback für das Spotify Web Playback SDK.
 * WIRD VOM SDK AUFGERUFEN, SOBALD ES GELADEN IST.
 */
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('window.onSpotifyWebPlaybackSDKReady: Spotify Web Playback SDK ist bereit.');
    isSpotifySDKLoaded = true;

    if (accessToken) {
        console.log("window.onSpotifyWebPlaybackSDKReady: Access Token vorhanden, initialisiere Player.");
        initializeSpotifyPlayer();
    } else {
        console.log("window.onSpotifyWebPlaybackSDKReady: Kein Access Token vorhanden. Warte auf Login.");
        showLoginScreen();
    }
};

/**
 * Überträgt die Wiedergabe auf den neu erstellten Web Playback SDK Player.
 * @param {string} deviceId - Die ID des Players, auf den übertragen werden soll.
 */
async function transferPlayback(deviceId) {
    console.log('transferPlayback: Versuche Wiedergabe auf Gerät', deviceId, 'zu übertragen.');
    try {
        const response = await fetch(`${SPOTIFY_API_BASE_URL}/me/player`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Fehler beim Übertragen der Wiedergabe: ${response.status} - ${errorData.error.message || response.statusText}`);
        }
        console.log('transferPlayback: Wiedergabe auf neuen Player übertragen.');

    } catch (error) {
        console.error('transferPlayback Fehler:', error);
        playbackStatus.textContent = `Fehler beim Aktivieren des Players: ${error.message}`;
    }
}

/**
 * Holt die Tracks einer bestimmten Playlist.
 */
async function getPlaylistTracks() {
    if (currentPlaylistTracks.length > 0) {
        return currentPlaylistTracks;
    }
    console.log('getPlaylistTracks: Lade Tracks aus Playlist...');
    try {
        let allTracks = [];
        let nextUrl = `${SPOTIFY_API_BASE_URL}/playlists/${PLAYLIST_ID}/tracks?limit=100`;

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
        console.log(`getPlaylistTracks: Geladene Tracks aus Playlist: ${currentPlaylistTracks.length}`);
        if (currentPlaylistTracks.length === 0) {
            console.warn('getPlaylistTracks: Keine spielbaren Tracks in der Playlist gefunden.');
            playbackStatus.textContent = 'Achtung: Keine spielbaren Tracks in der Playlist gefunden. Stelle sicher, dass die Playlist Tracks enthält und in deinem Markt verfügbar sind.';
        }
        return currentPlaylistTracks;
    } catch (error) {
        console.error('getPlaylistTracks Fehler:', error);
        playbackStatus.textContent = `Fehler beim Laden der Playlist: ${error.message}`;
        return [];
    }
}

/**
 * Spielt einen zufälligen Song aus der Playlist an einer zufälligen Position ab.
 */
async function playRandomSongFromPlaylist() {
    console.log('playRandomSongFromPlaylist: Versuch, Song abzuspielen.');
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

        const maxStartPositionMs = Math.floor(trackDurationMs * 0.8);
        const startPositionMs = Math.floor(Math.random() * maxStartPositionMs);

        console.log(`playRandomSongFromPlaylist: Versuche abzuspielen: ${randomTrackItem.track.name} (${trackUri})`);

        await player.activateElement(); // Wichtig für Autoplay in manchen Browsern

        const playResponse = await fetch(`${SPOTIFY_API_BASE_URL}/me/player/play`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                uris: [trackUri],
                position_ms: startPositionMs,
                device_id: activeDeviceId
            })
        });

        if (!playResponse.ok) {
            const errorData = await playResponse.json();
            console.error('playRandomSongFromPlaylist Fehler-Response von /me/player/play:', errorData);
            throw new Error(`Fehler beim Starten der Wiedergabe: ${playResponse.status} - ${errorData.error.message || playResponse.statusText}`);
        }

        playbackStatus.textContent = 'Spiele Song...';
        console.log('playRandomSongFromPlaylist: Song gestartet über Web API.');

        // Beispiel: Song nach 2 Sekunden stoppen
        setTimeout(() => {
            player.pause().then(() => {
                playbackStatus.textContent = 'Song beendet.';
                console.log('playRandomSongFromPlaylist: Song nach 2 Sekunden gestoppt via SDK.');
                currentGameState = 'playing'; // Zurück zum Zustand, wo man Play drücken kann
            }).catch(pauseError => {
                console.error('playRandomSongFromPlaylist Fehler beim Pausieren des Songs via SDK:', pauseError);
                playbackStatus.textContent = `Fehler beim Stoppen: ${pauseError.message}`;
            });
        }, 2000);

    } catch (error) {
        console.error('playRandomSongFromPlaylist Fehler:', error);
        playbackStatus.textContent = `Fehler beim Abspielen: ${error.message}`;
        if (error.message.includes("Premium account") || error.message.includes("Restricted device")) {
            alert('Für dieses Spiel ist ein Spotify Premium Account erforderlich oder dein Gerät ist nicht aktiv/verfügbar. Bitte überprüfe deine Spotify-Einstellungen.');
            showLoginScreen();
        }
    }
}


// --- UI STEUERUNGSFUNKTIONEN ---

/**
 * Wird aufgerufen, wenn der Spotify Player erfolgreich initialisiert wurde.
 * Leitet zur Orientierungs-/Fullscreen-Prüfung weiter.
 */
function handlePlayerReady() {
    console.log("handlePlayerReady: Spotify Player ist verbunden. Starte Orientierungs-/Fullscreen-Check.");
    loginArea.classList.add('hidden'); // Login-Bereich ausblenden
    checkOrientationAndFullscreen(); // Jetzt den Orientierungs- und Fullscreen-Check starten
}

/**
 * Zeigt den Login-Screen an.
 */
function showLoginScreen() {
    console.log("showLoginScreen: Zeige Login-Bereich.");
    logoContainer.classList.add('hidden', 'initial-hidden'); // Logo ausblenden und initial positionieren
    loginArea.classList.remove('hidden');
    currentGameState = 'loading'; // Oder 'loginScreen'
}

/**
 * Zeigt eine Overlay-Nachricht an (z.B. Orientierung, Fullscreen).
 * @param {HTMLElement} element - Das anzuzeigende DOM-Element.
 */
function showMessage(element) {
    element.classList.remove('hidden');
    element.classList.add('visible');
    element.style.pointerEvents = 'auto'; // Klicks auf die Nachricht erlauben
    initialClickBlocker.classList.remove('hidden'); // Blocker anzeigen
}

/**
 * Versteckt eine Overlay-Nachricht.
 * @param {HTMLElement} element - Das zu versteckende DOM-Element.
 */
function hideMessage(element) {
    element.classList.remove('visible');
    element.classList.add('hidden');
    element.style.pointerEvents = 'none'; // Klicks durch die Nachricht hindurchlassen
    initialClickBlocker.classList.add('hidden'); // Blocker ausblenden
}

/**
 * Überprüft die Geräteorientierung und den Fullscreen-Status und zeigt entsprechende Meldungen an.
 */
function checkOrientationAndFullscreen() {
    console.log("checkOrientationAndFullscreen: Überprüfe Orientierung und Fullscreen.");
    fullscreenRequested = false; // Reset des Flags für neue Fullscreen-Aufforderung

    if (window.innerHeight > window.innerWidth) { // Hochformat (Portrait)
        console.log("checkOrientationAndFullscreen: Hochformat erkannt. Zeige Orientierungs-Meldung.");
        showMessage(orientationMessage);
        hideMessage(fullscreenMessage);
        // Listener entfernen, falls er noch aktiv ist, da Orientierung falsch
        document.removeEventListener('click', activateFullscreenAndRemoveListener);
    } else { // Querformat (Landscape)
        console.log("checkOrientationAndFullscreen: Querformat erkannt.");
        hideMessage(orientationMessage);

        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
             console.log("checkOrientationAndFullscreen: Zeige Fullscreen-Aufforderung.");
             showMessage(fullscreenMessage);
             // Listener hinzufügen, wenn noch nicht im Vollbild. { once: true } entfernt ihn nach dem Klick.
             document.addEventListener('click', activateFullscreenAndRemoveListener, { once: true });
        } else {
             console.log("checkOrientationAndFullscreen: Bereits im Vollbildmodus. Zeige Logo.");
             hideMessage(fullscreenMessage);
             showLogoButton(); // Zeige das Logo mit Animation
        }
    }
}

/**
 * Fordert den Vollbildmodus an.
 */
function requestFullscreen() {
    console.log("requestFullscreen: Anforderung Vollbildmodus.");
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
    } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
    } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
    }
}

/**
 * Wird bei Klick auf die Fullscreen-Aufforderung aufgerufen.
 * Leitet die Fullscreen-Anforderung ein und zeigt danach das Logo.
 */
function activateFullscreenAndRemoveListener(event) {
    console.log("activateFullscreenAndRemoveListener: Vollbildmodus-Aktivierung durch Klick.");
    
    // Nur reagieren, wenn der Klick auf der Fullscreen-Nachricht selbst war.
    if (!fullscreenMessage.contains(event.target)) {
        console.log("activateFullscreenAndRemoveListener: Klick nicht auf Fullscreen-Nachricht, ignoriere.");
        // Da Listener mit { once: true } gesetzt ist, muss er bei ignoriertem Klick neu hinzugefügt werden.
        document.addEventListener('click', activateFullscreenAndRemoveListener, { once: true });
        return;
    }

    if (!fullscreenRequested) {
        requestFullscreen();
        fullscreenRequested = true;
        // Listener wird durch { once: true } automatisch entfernt
        
        // Nach erfolgreicher Fullscreen-Anforderung das Logo anzeigen
        showLogoButton(); 
    }
}

/**
 * Zeigt das TRACK ATTACK Logo mit der Reinfall-Animation.
 * Aktiviert den Klick-Listener nach Abschluss der Animation.
 */
function showLogoButton() {
    // Bedingung HINZUGEFÜGT: Wenn die Intro-Animation schon einmal lief
    if (introAnimationPlayed && currentGameState !== 'startScreen') {
        console.log("showLogoButton: Intro-Animation wurde bereits abgespielt. Zeige Logo ohne Animation.");
        logoContainer.classList.remove('hidden');
        logoContainer.classList.remove('initial-hidden');
        logoContainer.style.animation = ''; // Sicherstellen, dass keine Animation aktiv ist

        // Direkt den Klick-Listener für den Play-Button aktivieren (da Spiel läuft)
        if (currentGameState === 'playing' || currentGameState === 'songPlaying' || currentGameState === 'songPaused') {
             setLogoAsPlayButton();
        } else { // Ansonsten, wenn wir im Startscreen sind, aber die Animation schon lief
             // Das Logo ist sichtbar und klickbar für den Start
             if (logoClickListener) { // Alten Listener entfernen, falls vorhanden
                logo.removeEventListener('click', logoClickListener);
            }
            logoClickListener = function() {
                console.log("Logo geklickt zum Spielstart (ohne Re-Animation)!");
                // Füge den kleinen Bounce-Effekt bei jedem Klick hinzu
                logo.classList.remove('logo-bounce');
                void logo.offsetWidth; // Force reflow
                logo.classList.add('logo-bounce');

                if (currentGameState === 'startScreen') {
                    if (isPlayerReady) {
                        console.log("Spiel wird gestartet!");
                        playbackStatus.textContent = 'Bereit zum Abspielen!';
                        currentGameState = 'playing'; // Zustandswechsel
                        setLogoAsPlayButton(); // Logo wird zum Play-Button
                    } else {
                        console.warn("Player ist noch nicht bereit, kann Spiel nicht starten.");
                        playbackStatus.textContent = 'Spotify Player ist noch nicht bereit. Bitte warten...';
                    }
                }
            };
            logo.addEventListener('click', logoClickListener);
            currentGameState = 'startScreen';
        }
        return; // Funktion hier beenden
    }

    // Dieser Teil wird nur ausgeführt, wenn die Intro-Animation noch NICHT lief
    console.log("showLogoButton: Starte Logo-Reinfall-Animation.");
    loginArea.classList.add('hidden');
    hideMessage(fullscreenMessage);
    hideMessage(orientationMessage);

    logoContainer.classList.remove('hidden');
    logoContainer.classList.remove('initial-hidden');

    // Hier die Geschwindigkeit anpassen, z.B. 1s
    logoContainer.style.animation = 'fall-in 1s ease-out forwards'; // Geschwindigkeit hier einstellen!

    logoContainer.addEventListener('animationend', function handler(event) {
        if (event.animationName === 'fall-in') {
            console.log("fall-in Animation beendet. Logo ist bereit für Klicks.");
            logoContainer.removeEventListener('animationend', handler);
            logoContainer.style.animation = '';
            
            introAnimationPlayed = true; // Markiere, dass die Animation gelaufen ist

            if (logoClickListener) {
                logo.removeEventListener('click', logoClickListener);
            }
            logoClickListener = function() {
                console.log("Logo geklickt zum Spielstart!");
                logo.classList.remove('logo-bounce');
                void logo.offsetWidth;
                logo.classList.add('logo-bounce');

                if (currentGameState === 'startScreen') {
                    if (isPlayerReady) {
                        console.log("Spiel wird gestartet!");
                        playbackStatus.textContent = 'Bereit zum Abspielen!';
                        currentGameState = 'playing';
                        setLogoAsPlayButton();
                    } else {
                        console.warn("Player ist noch nicht bereit, kann Spiel nicht starten.");
                        playbackStatus.textContent = 'Spotify Player ist noch nicht bereit. Bitte warten...';
                    }
                }
            };
            logo.addEventListener('click', logoClickListener);
            
            currentGameState = 'startScreen';
        }
    });
}

/**
 * Konfiguriert den Logo-Button als Play/Pause-Button für das Spiel.
 */
function setLogoAsPlayButton() {
    console.log("setLogoAsPlayButton: Logo wird zum Play/Pause-Button.");
    // Entferne den "Spiel starten"-Listener
    if (logoClickListener) {
        logo.removeEventListener('click', logoClickListener);
    }

    // Setze den neuen Listener für die Play/Pause-Funktion
    logoClickListener = function() {
        console.log("Play/Pause-Button (Logo) geklickt!");
        // Füge den Bounce-Effekt hinzu
        logo.classList.remove('logo-bounce');
        void logo.offsetWidth; // Force reflow
        logo.classList.add('logo-bounce');

        if (isPlayerReady) {
            if (currentGameState === 'playing' || currentGameState === 'songPaused') {
                console.log("Spiele/Resumiere nächsten Song.");
                playRandomSongFromPlaylist();
                currentGameState = 'songPlaying';
            } else if (currentGameState === 'songPlaying') {
                if (player) {
                    player.pause().then(() => {
                        console.log("Song pausiert.");
                        playbackStatus.textContent = 'Song pausiert.';
                        currentGameState = 'songPaused';
                    }).catch(err => console.error("Fehler beim Pausieren:", err));
                }
            }
        } else {
            console.warn("Player ist nicht bereit für Wiedergabe.");
            playbackStatus.textContent = 'Spotify Player ist nicht bereit für Wiedergabe.';
        }
    };
    logo.addEventListener('click', logoClickListener);
}


// --- Funktion, die den Spotify Login-Status überprüft und den Player initialisiert ---
// Dies muss vor dem DOMContentLoaded-Listener definiert sein!
async function checkSpotifyLoginStatus() {
    console.log("checkSpotifyLoginStatus: Überprüfe Spotify Login Status.");
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        console.log('checkSpotifyLoginStatus: Authorization Code erhalten, tausche ihn gegen Access Token.');
        const success = await exchangeCodeForTokens(code); // Warte auf Erfolg
        history.replaceState({}, document.title, REDIRECT_URI); // Code aus URL entfernen
        
        if (success && accessToken && isSpotifySDKLoaded) {
             console.log("checkSpotifyLoginStatus: Access Token und SDK bereit, initialisiere Player.");
             initializeSpotifyPlayer();
        } else if (success && accessToken) {
             console.log("checkSpotifyLoginStatus: Access Token vorhanden, aber SDK noch nicht geladen. Player-Initialisierung wartet auf SDK Ready.");
             // initializeSpotifyPlayer wird dann von window.onSpotifyWebPlaybackSDKReady() aufgerufen
        } else {
             console.log("checkSpotifyLoginStatus: Token-Austausch fehlgeschlagen oder kein Access Token.");
             showLoginScreen(); // Zeigt den Login-Screen mit Fehlermeldung
        }
    } else if (localStorage.getItem('access_token') && localStorage.getItem('expires_in') > Date.now()) {
        console.log('checkSpotifyLoginStatus: Vorhandenen Access Token aus localStorage geladen.');
        accessToken = localStorage.getItem('access_token');
        if (isSpotifySDKLoaded) {
            console.log("checkSpotifyLoginStatus: Vorhandener Token und SDK bereit, initialisiere Player.");
            initializeSpotifyPlayer();
        } else {
            console.log("checkSpotifyLoginStatus: Vorhandener Token, aber SDK noch nicht geladen. Player-Initialisierung wartet auf SDK Ready.");
        }
    } else {
        console.log('checkSpotifyLoginStatus: Kein gültiger Access Token vorhanden. Zeige Login-Screen.');
        playbackStatus.textContent = 'Bitte logge dich mit Spotify ein.';
        showLoginScreen(); // Sicherstellen, dass der Login-Screen aktiv ist
    }
}


// --- INITIALISIERUNG BEIM LADEN DER SEITE ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: Seite geladen.");

    // Spotify SDK Skript dynamisch laden
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js'; // KORREKTE URL!
    script.async = true;
    document.body.appendChild(script);
    console.log("DOMContentLoaded: Spotify SDK Skript geladen von " + script.src);

    // Initialisiere den Login-Button Listener
    if (spotifyLoginButton) {
        spotifyLoginButton.addEventListener('click', redirectToSpotifyAuthorize);
        console.log("DOMContentLoaded: Spotify Login Button Event Listener hinzugefügt.");
    } else {
        console.error("DOMContentLoaded: Login-Button (ID: spotify-login-button) nicht im DOM gefunden.");
    }

    // Beim Laden der Seite direkt den Spotify Login-Bereich anzeigen
    loginArea.classList.remove('hidden');
    logoContainer.classList.add('hidden', 'initial-hidden'); // Logo verstecken und initial positionieren
    playbackStatus.textContent = ''; // Anfangs leer

    // Prüfe den Login-Status sofort (MUSS NACH DEFINITION VON checkSpotifyLoginStatus SEIN!)
    await checkSpotifyLoginStatus();

    // Event Listener für Orientierungsänderungen und Fenstergrößenänderungen
    window.addEventListener('resize', () => {
        if (isPlayerReady) {
            checkOrientationAndFullscreen();
        }
    });
    window.addEventListener('orientationchange', () => {
        if (isPlayerReady) {
            checkOrientationAndFullscreen();
        }
    });
    
    // Listener für das Beenden des Fullscreen-Modus
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            console.log("Fullscreen verlassen.");
            fullscreenRequested = false; 
            if (isPlayerReady) { 
                checkOrientationAndFullscreen(); 
            } else {
                showLoginScreen();
            }
        } else {
            console.log("Fullscreen aktiviert.");
        }
    });
});
