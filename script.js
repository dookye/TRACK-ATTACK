// Konfiguration
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6';
const REDIRECT_URI = 'https://dookye.github.io/TRACK-ATTACK/';
const SCOPES = 'streaming user-read-email user-read-private';

// HTML-Elemente
const loginScreen = document.getElementById('login-screen');
const rotateDeviceScreen = document.getElementById('rotate-device-screen');
const fullscreenScreen = document.getElementById('fullscreen-screen');
const gameScreen = document.getElementById('game-screen');
const spotifyLoginButton = document.getElementById('spotify-login-button');

// Zustandsvariablen
let accessToken = null;
let spotifySDKInitialized = false;
let isLandscape = false;
let isFullscreen = false;
let greetingAnimationShown = sessionStorage.getItem('greetingAnimationShown') === 'true';

// --- Hilfsfunktionen für die Bildschirmanzeige ---
function showScreen(screenElement) {
    // Zuerst alle Screens ausblenden, dann den gewünschten einblenden
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    screenElement.classList.add('active');
}

// --- OAuth PKCE Flow Funktionen ---

// Generiert einen zufälligen String für code_verifier
function generateRandomString(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Codiert den String für code_challenge
async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

// Speichert den Code-Verifier und leitet zur Spotify-Autorisierung weiter
spotifyLoginButton.addEventListener('click', async () => {
    const codeVerifier = generateRandomString(128);
    sessionStorage.setItem('code_verifier', codeVerifier);

    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const authUrl = new URL('https://accounts.spotify.com/authorize');
    const params = {
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
    };
    authUrl.search = new URLSearchParams(params).toString();
    window.location.href = authUrl.toString();
});

// Verarbeitet den Callback nach der Spotify-Anmeldung
async function handleSpotifyCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        const codeVerifier = sessionStorage.getItem('code_verifier');

        const tokenUrl = 'https://accounts.spotify.com/api/token';
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            code_verifier: codeVerifier,
        });

        try {
            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: body.toString(),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            accessToken = data.access_token;
            console.log('Access Token:', accessToken); // Zu Debugging-Zwecken

            // Access Token speichern (z.B. in sessionStorage, für kurze Lebensdauer)
            sessionStorage.setItem('spotify_access_token', accessToken);

            // Optional: Entferne den Code und Zustand aus der URL
            window.history.replaceState({}, document.title, REDIRECT_URI);

            // Initialisiere Spotify SDK und starte den Flow
            initializeSpotifySDK();
            startDeviceOrientationCheck();

        } catch (error) {
            console.error('Error fetching access token:', error);
            // Fehlerbehandlung: Zurück zur Login-Seite oder Fehlermeldung anzeigen
            showScreen(loginScreen);
        }
    } else {
        // Wenn kein Code in der URL ist, aber wir auf der Redirect URI sind, zurück zum Login
        if (window.location.href.startsWith(REDIRECT_URI) && !accessToken) {
            showScreen(loginScreen);
        }
    }
}

// --- Spotify Web Playback SDK Initialisierung ---
function initializeSpotifySDK() {
    if (spotifySDKInitialized) return;

    window.onSpotifyWebPlaybackSDKReady = () => {
        const player = new Spotify.Player({
            name: 'TRACK ATTACK Player',
            getOAuthToken: cb => { cb(accessToken); },
            volume: 0.5
        });

        // Ready
        player.addListener('ready', ({ device_id }) => {
            console.log('Ready with Device ID', device_id);
            // Hier könnten wir das Gerät aktivieren, wenn nötig
        });

        // Not Ready
        player.addListener('not_ready', ({ device_id }) => {
            console.log('Device ID has gone offline', device_id);
            // Fehlerbehandlung, z.B. Re-Login erforderlich
        });

        player.addListener('initialization_error', ({ message }) => {
            console.error('Initialization Error', message);
            // Benutzer informieren, dass Premium-Konto erforderlich ist
            alert('Spotify Web Playback SDK konnte nicht initialisiert werden. Bitte stelle sicher, dass du ein Spotify Premium-Konto hast.');
            showScreen(loginScreen); // Zurück zum Login
        });

        player.addListener('authentication_error', ({ message }) => {
            console.error('Authentication Error', message);
            // Token ist abgelaufen oder ungültig, Re-Login erforderlich
            alert('Deine Spotify-Sitzung ist abgelaufen. Bitte melde dich erneut an.');
            showScreen(loginScreen); // Zurück zum Login
        });

        player.addListener('account_error', ({ message }) => {
            console.error('Account Error', message);
            // Kein Premium-Konto
            alert('Um TRACK ATTACK zu spielen, benötigst du ein Spotify Premium-Konto.');
            showScreen(loginScreen); // Zurück zum Login
        });

        player.connect();
        spotifySDKInitialized = true;
    };

    // Skript für Spotify Web Playback SDK dynamisch laden
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    document.head.appendChild(script);
}

// --- Geräteausrichtungsprüfung ---
function checkDeviceOrientation() {
    isLandscape = (window.innerWidth > window.innerHeight);

    if (!spotifySDKInitialized) return; // Warten, bis SDK initialisiert ist

    if (!isLandscape) {
        showScreen(rotateDeviceScreen);
    } else {
        // Wenn bereits Fullscreen, dann nicht den Fullscreen-Screen zeigen
        if (!document.fullscreenElement) {
            showScreen(fullscreenScreen);
        } else {
            // Wenn alles passt (Landscape und Fullscreen aktiv)
            if (greetingAnimationShown) {
                showScreen(gameScreen);
            } else {
                // Begrüßungsanimation abspielen (wird in Phase 2 detaillierter)
                console.log('Begrüßungsanimation wird abgespielt (Platzhalter)');
                sessionStorage.setItem('greetingAnimationShown', 'true');
                greetingAnimationShown = true;
                showScreen(gameScreen); // Für jetzt direkt zum Game Screen
            }
        }
    }
}

function startDeviceOrientationCheck() {
    window.addEventListener('resize', checkDeviceOrientation);
    checkDeviceOrientation(); // Initialer Check
}

// --- Vollbildmodus ---
fullscreenScreen.addEventListener('click', () => {
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) { /* Firefox */
        document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
        document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) { /* IE/Edge */
        document.documentElement.msRequestFullscreen();
    }
});

// Überwachung des Fullscreen-Status
document.addEventListener('fullscreenchange', () => {
    isFullscreen = document.fullscreenElement !== null;
    if (!isFullscreen && isLandscape) { // Wenn Fullscreen verlassen wird UND wir im Landscape sind
        showScreen(fullscreenScreen);
    } else if (isFullscreen && isLandscape) {
        // Wenn alles passt (Landscape und Fullscreen aktiv)
        if (greetingAnimationShown) {
            showScreen(gameScreen);
        } else {
            // Begrüßungsanimation abspielen (wird in Phase 2 detaillierter)
            console.log('Begrüßungsanimation wird abgespielt (Platzhalter)');
            sessionStorage.setItem('greetingAnimationShown', 'true');
            greetingAnimationShown = true;
            showScreen(gameScreen); // Für jetzt direkt zum Game Screen
        }
    }
    // Wenn Fullscreen verlassen wird und wir im Portrait sind, übernimmt der Rotation-Screen
});
document.addEventListener('mozfullscreenchange', () => {
    isFullscreen = document.mozFullScreenElement !== null;
    if (!isFullscreen && isLandscape) { showScreen(fullscreenScreen); } else if (isFullscreen && isLandscape) {
        if (greetingAnimationShown) { showScreen(gameScreen); } else {
            console.log('Begrüßungsanimation wird abgespielt (Platzhalter)');
            sessionStorage.setItem('greetingAnimationShown', 'true');
            greetingAnimationShown = true;
            showScreen(gameScreen);
        }
    }
});
document.addEventListener('webkitfullscreenchange', () => {
    isFullscreen = document.webkitFullscreenElement !== null;
    if (!isFullscreen && isLandscape) { showScreen(fullscreenScreen); } else if (isFullscreen && isLandscape) {
        if (greetingAnimationShown) { showScreen(gameScreen); } else {
            console.log('Begrüßungsanimation wird abgespielt (Platzhalter)');
            sessionStorage.setItem('greetingAnimationShown', 'true');
            greetingAnimationShown = true;
            showScreen(gameScreen);
        }
    }
});
document.addEventListener('msfullscreenchange', () => {
    isFullscreen = document.msFullscreenElement !== null;
    if (!isFullscreen && isLandscape) { showScreen(fullscreenScreen); } else if (isFullscreen && isLandscape) {
        if (greetingAnimationShown) { showScreen(gameScreen); } else {
            console.log('Begrüßungsanimation wird abgespielt (Platzhalter)');
            sessionStorage.setItem('greetingAnimationShown', 'true');
            greetingAnimationShown = true;
            showScreen(gameScreen);
        }
    }
});


// --- Initialisierung beim Laden der Seite ---
document.addEventListener('DOMContentLoaded', () => {
    // Versuche, Access Token aus sessionStorage zu laden
    accessToken = sessionStorage.getItem('spotify_access_token');

    // Wenn Access Token vorhanden, versuche SDK zu initialisieren und Orientation Check zu starten
    if (accessToken) {
        initializeSpotifySDK();
        startDeviceOrientationCheck();
    } else {
        // Wenn kein Access Token und kein Code in der URL, zeige Login-Screen
        // Das bedeutet, der Benutzer ist entweder neu oder das Token ist abgelaufen/nicht vorhanden.
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (!code) {
            showScreen(loginScreen);
        }
    }

    // Handle Callback für Spotify OAuth
    handleSpotifyCallback();
});
