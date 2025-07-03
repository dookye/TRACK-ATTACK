// Globale Variablen und Konstanten
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6';
const REDIRECT_URI = 'https://dookye.github.io/TRACK-ATTACK/'; // Muss in Spotify Dashboard registriert sein
const SCOPES = 'streaming user-read-email user-read-private';

// UI-Elemente
const loginScreen = document.getElementById('login-screen');
const loginButton = document.getElementById('login-button');
const orientationOverlay = document.getElementById('orientation-overlay');
const fullscreenScreen = document.getElementById('fullscreen-screen');
const introAnimationContainer = document.getElementById('intro-animation-container');
const introLogo = document.getElementById('intro-logo');
const gameScreens = document.getElementById('game-screens');
const logoButton = document.getElementById('logo-button');
const diceScreen = document.getElementById('dice-screen');
const diceAnimation = document.getElementById('dice-animation');
const diceButtonsContainer = document.getElementById('dice-buttons');
const diceButtons = document.querySelectorAll('.dice-button');
const genreScreen = document.getElementById('genre-screen');
const genreButtonsContainer = document.getElementById('genre-buttons');
const genreButtons = document.querySelectorAll('.genre-button');
const guessScreen = document.getElementById('guess-screen');
const songInfo = document.querySelector('.song-info');
const albumCover = document.getElementById('album-cover');
const songTitle = document.getElementById('song-title');
const songArtist = document.getElementById('song-artist');
const resolveButton = document.getElementById('resolve-button');
const correctButton = document.getElementById('correct-button');
const wrongButton = document.getElementById('wrong-button');
const speedRoundOverlay = document.getElementById('speed-round-overlay');
const speedRoundCountdown = document.getElementById('speed-round-countdown');
const scoreScreen = document.getElementById('score-screen');
const player1FinalScore = document.getElementById('player1-final-score');
const player2FinalScore = document.getElementById('player2-final-score');

// Spielzustand
let accessToken = '';
let refreshToken = '';
let player = null; // Spotify Web Playback SDK Player-Instanz
let deviceId = null; // Geräte-ID des Spotify Players
let currentTrackUri = '';
let currentTrackDuration = 0;
let currentTrackPosition = 0;
let currentDiceValue = 0;
let currentGameDuration = 0; // Dauer des Songausschnitts
let currentMaxPoints = 0;
let currentListenAttempts = 0;
let attemptsMadeThisRound = 0;
let currentPlayer = 1; // 1 oder 2
let currentRound = 1; // Gesamtrunden (1-20)
let player1Score = 0;
let player2Score = 0;
let isGameStarted = false;
let isIntroAnimationPlayed = sessionStorage.getItem('introAnimationPlayed') === 'true'; // Speichert, ob Animation bereits lief
let isSpeedRoundActive = false;
let speedRoundTimer = null;
let speedRoundCountdownInterval = null;
let player1SpeedRound = Math.floor(Math.random() * 10) + 1; // Zufällige Speed-Runde für Spieler 1 (1-10)
let player2SpeedRound = Math.floor(Math.random() * 10) + 1; // Zufällige Speed-Runde für Spieler 2 (1-10)
let selectedGenrePlaylists = []; // Die Spotify Playlist IDs für das aktuell gewählte Genre

// Spotify Playlist IDs nach Genre
const genrePlaylists = {
    'punk-rock': ['39sVxPTg7BKwrf2MfgrtcD', '7ITmaFa2rOhXAmKmUUCG9E'],
    'pop-hits': ['6mtYuOxzl58vSGnEDtZ9uB', '34NbomaTu7YuOYnky8nLXL'],
    'all-time-hits': ['2si7ChS6Y0hPBt4FsobXpg', '2y09fNnXHvoqc1WGHvbhkZ'],
    'disney-songs': ['3Bilb56eeS7db5f3DTEwMR', '2bhbwexk7c6yJrEB4CtuY8']
};

// --- Hilfsfunktionen ---

/**
 * Erzeugt einen zufälligen String für PKCE (Code Verifier).
 * @param {number} length - Länge des Strings.
 * @returns {string} Zufälliger String.
 */
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Erzeugt den SHA256 Hash für PKCE (Code Challenge).
 * @param {string} plain - Der zu hashende String.
 * @returns {Promise<string>} Base64url-kodierter SHA256 Hash.
 */
async function generateCodeChallenge(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

/**
 * Zeigt einen bestimmten Bildschirm an und verbirgt andere.
 * @param {HTMLElement} screenToShow - Der anzuzeigende Bildschirm.
 */
function showScreen(screenToShow) {
    const allScreens = [loginScreen, orientationOverlay, fullscreenScreen, introAnimationContainer, gameScreens, scoreScreen];
    allScreens.forEach(screen => screen.classList.add('hidden'));

    // Spezielle Handhabung für gameScreens, da es ein Container für mehrere Sektionen ist
    if (screenToShow === gameScreens) {
        gameScreens.classList.remove('hidden');
        // Verstecke alle Untersektionen von gameScreens, es sei denn, sie werden explizit aktiviert
        document.querySelectorAll('.game-section').forEach(section => section.classList.add('hidden'));
    } else {
        screenToShow.classList.remove('hidden');
    }
}

/**
 * Zeigt ein Overlay an oder verbirgt es.
 * @param {HTMLElement} overlayElement - Das Overlay-Element.
 * @param {boolean} show - True zum Anzeigen, False zum Verbergen.
 */
function toggleOverlay(overlayElement, show) {
    if (show) {
        overlayElement.classList.remove('hidden');
    } else {
        overlayElement.classList.add('hidden');
    }
}

/**
 * Wechselt die Hintergrundfarbe des Bodys.
 * @param {string} color - Die Zielfarbe (z.B. '#00BFFF' für Blau, '#FF1493' für Pink, '#000' für Schwarz).
 */
function changeBackgroundColor(color) {
    document.body.style.backgroundColor = color;
}

/**
 * Berechnet die Punkte basierend auf dem Würfelwert und den Versuchen.
 * @param {number} diceValue - Der Wert des gewählten Würfels.
 * @param {number} attemptsMade - Die Anzahl der genutzten Hörversuche.
 * @returns {number} Die berechneten Punkte.
 */
function calculatePoints(diceValue, attemptsMade) {
    const points = diceValue - (attemptsMade - 1);
    return Math.max(1, points); // Mindestpunktzahl ist 1
}

/**
 * Setzt den Spielzustand für eine neue Runde zurück.
 */
function resetRoundState() {
    attemptsMadeThisRound = 0;
    currentDiceValue = 0;
    currentGameDuration = 0;
    currentMaxPoints = 0;
    currentListenAttempts = 0;
    isSpeedRoundActive = false;
    clearTimeout(speedRoundTimer);
    clearInterval(speedRoundCountdownInterval);

    // Verstecke alle Rate-Bildschirm-Elemente
    songInfo.classList.add('hidden');
    albumCover.src = '';
    songTitle.textContent = '';
    songArtist.textContent = '';
    resolveButton.classList.add('hidden');
    correctButton.classList.add('hidden');
    wrongButton.classList.add('hidden');

    // Aktiviere den Logo-Button wieder für die nächste Runde
    logoButton.classList.remove('inactive');
}

/**
 * Aktualisiert den Spieler- und Rundenstatus und wechselt den Hintergrund.
 */
function updateGameProgressAndSwitchPlayer() {
    resetRoundState(); // Setzt den Zustand der Runde zurück

    // Erhöhe die Runde
    currentRound++;

    // Überprüfe, ob das Spiel beendet ist
    if (currentRound > 20) { // 10 Runden pro Spieler = 20 Songs insgesamt
        endGame();
        return;
    }

    // Spielerwechsel
    currentPlayer = (currentPlayer === 1) ? 2 : 1;
    const targetColor = (currentPlayer === 1) ? '#00BFFF' : '#FF1493'; // Blau für Spieler 1, Pink für Spieler 2
    changeBackgroundColor(targetColor);

    // Gehe zum Würfel-Bildschirm für den nächsten Spieler
    showGameSection(diceScreen);
}

/**
 * Zeigt eine bestimmte Sektion innerhalb des Game-Containers an.
 * @param {HTMLElement} sectionToShow - Die anzuzeigende Sektion.
 */
function showGameSection(sectionToShow) {
    document.querySelectorAll('.game-section').forEach(section => {
        section.classList.remove('active');
    });
    sectionToShow.classList.add('active');
}

// --- Spotify API & SDK Logik ---

/**
 * Startet den Spotify OAuth 2.0 PKCE Flow.
 */
async function startSpotifyAuth() {
    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    localStorage.setItem('code_verifier', codeVerifier); // Speichere den Verifier für den späteren Token-Austausch

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
}

/**
 * Tauscht den Autorisierungscode gegen ein Access Token.
 * @param {string} code - Der Autorisierungscode von Spotify.
 * @returns {Promise<void>}
 */
async function exchangeCodeForToken(code) {
    const codeVerifier = localStorage.getItem('code_verifier');

    try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: REDIRECT_URI,
                code_verifier: codeVerifier,
            }).toString(),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Fehler beim Token-Austausch:', errorData);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        accessToken = data.access_token;
        refreshToken = data.refresh_token;
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        localStorage.removeItem('code_verifier'); // Verifier wird nicht mehr benötigt

        console.log('Access Token erhalten:', accessToken);
        initializeSpotifySdk(); // SDK nach erfolgreichem Login initialisieren
    } catch (error) {
        console.error('Fehler beim Token-Austausch:', error);
        alert('Fehler beim Spotify-Login. Bitte versuche es erneut.');
        showScreen(loginScreen); // Zurück zum Login-Bildschirm
    }
}

/**
 * Initialisiert das Spotify Web Playback SDK.
 */
function initializeSpotifySdk() {
    if (player) {
        player.disconnect(); // Trenne den alten Player, falls vorhanden
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
        player = new Spotify.Player({
            name: 'TRACK ATTACK Player',
            getOAuthToken: cb => { cb(accessToken); },
            volume: 0.5
        });

        // Event Listener für den Player
        player.addListener('ready', ({ device_id }) => {
            deviceId = device_id;
            console.log('Bereit mit Geräte-ID', deviceId);
            // Übertrage die Wiedergabe auf dieses Gerät
            transferPlaybackToDevice(deviceId);
            checkOrientationAndFullscreen(); // Nach SDK-Bereitschaft Ausrichtung und Vollbild prüfen
        });

        player.addListener('not_ready', ({ device_id }) => {
            console.log('Gerät ist nicht bereit', device_id);
            alert('Dein Spotify-Gerät ist nicht bereit. Bitte stelle sicher, dass Spotify geöffnet ist.');
            showScreen(loginScreen); // Zurück zum Login-Bildschirm
        });

        player.addListener('initialization_error', ({ message }) => {
            console.error('Initialisierungsfehler:', message);
            alert('Fehler bei der Initialisierung des Spotify Players. Stelle sicher, dass du Spotify Premium hast.');
            showScreen(loginScreen);
        });

        player.addListener('authentication_error', ({ message }) => {
            console.error('Authentifizierungsfehler:', message);
            alert('Authentifizierungsfehler bei Spotify. Bitte melde dich erneut an.');
            startSpotifyAuth(); // Erneute Authentifizierung
        });

        player.addListener('account_error', ({ message }) => {
            console.error('Account-Fehler:', message);
            alert('Dein Spotify-Account hat Probleme. Stelle sicher, dass du Spotify Premium hast.');
            showScreen(loginScreen);
        });

        player.connect();
    };
}

/**
 * Überträgt die Wiedergabe auf das Web Playback SDK Gerät.
 * @param {string} deviceId - Die Geräte-ID.
 */
async function transferPlaybackToDevice(deviceId) {
    try {
        const response = await fetch('https://api.spotify.com/v1/me/player', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false // Nicht sofort abspielen
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Fehler beim Übertragen der Wiedergabe:', errorData);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        console.log('Wiedergabe auf Web Playback SDK Gerät übertragen.');
    } catch (error) {
        console.error('Fehler beim Übertragen der Wiedergabe:', error);
        alert('Konnte die Wiedergabe nicht auf das Gerät übertragen. Bitte versuche es erneut.');
    }
}

/**
 * Holt eine zufällige Playlist-ID aus den ausgewählten Genres.
 * @returns {string} Eine zufällige Playlist-ID.
 */
function getRandomPlaylistId() {
    const randomPlaylistIndex = Math.floor(Math.random() * selectedGenrePlaylists.length);
    return selectedGenrePlaylists[randomPlaylistIndex];
}

/**
 * Holt eine zufällige Track-URI und Startposition aus einer Playlist.
 * @param {string} playlistId - Die ID der Spotify Playlist.
 * @returns {Promise<{trackUri: string, startPositionMs: number, durationMs: number, albumCoverUrl: string, title: string, artist: string}>} Track-Informationen.
 */
async function getRandomTrackFromPlaylist(playlistId) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Fehler beim Abrufen der Playlist-Tracks:', errorData);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const tracks = data.items.filter(item => item.track && item.track.preview_url); // Nur Tracks mit Preview-URL

        if (tracks.length === 0) {
            alert('Keine spielbaren Tracks in dieser Playlist gefunden. Bitte wähle ein anderes Genre.');
            throw new Error('No playable tracks found in playlist.');
        }

        const randomTrackIndex = Math.floor(Math.random() * tracks.length);
        const track = tracks[randomTrackIndex].track;

        const trackUri = track.uri;
        const durationMs = track.duration_ms;
        const albumCoverUrl = track.album.images.length > 0 ? track.album.images[0].url : 'https://placehold.co/150x150/000/FFF?text=No+Cover';
        const title = track.name;
        const artist = track.artists.map(a => a.name).join(', ');

        // Zufällige Startposition: Nicht ganz am Ende, um genug Spielzeit zu haben
        const maxStartPosition = durationMs - currentGameDuration - 1000; // 1 Sekunde Puffer
        const startPositionMs = Math.floor(Math.random() * Math.max(0, maxStartPosition));

        currentTrackUri = trackUri;
        currentTrackDuration = durationMs;
        currentTrackPosition = startPositionMs;

        return { trackUri, startPositionMs, durationMs, albumCoverUrl, title, artist };

    } catch (error) {
        console.error('Fehler beim Laden des zufälligen Tracks:', error);
        alert('Konnte keinen Song laden. Bitte versuche es erneut oder wähle ein anderes Genre.');
        // Zurück zum Genre-Bildschirm
        showGameSection(genreScreen);
        throw error; // Re-throw, um die Kette zu unterbrechen
    }
}

/**
 * Spielt den ausgewählten Songausschnitt ab.
 */
async function playSongSnippet() {
    if (!player || !deviceId || !currentTrackUri) {
        console.error('Player nicht bereit oder kein Track ausgewählt.');
        alert('Spotify Player ist nicht bereit oder kein Song ausgewählt.');
        return;
    }

    logoButton.classList.add('inactive'); // Logo-Button deaktivieren während der Wiedergabe
    resolveButton.classList.add('hidden'); // Auflösen-Button verstecken

    try {
        // Starte die Wiedergabe des Tracks an der zufälligen Position
        await player.seek(currentTrackPosition);
        await player.resume();

        // Stoppe die Wiedergabe nach der festgelegten Dauer
        setTimeout(async () => {
            await player.pause();
            console.log('Songausschnitt beendet.');
            attemptsMadeThisRound++;

            if (isSpeedRoundActive) {
                // Im Speed-Round wird der Auflösen-Button nicht angezeigt, bis der Timer abläuft
                // Die Auflösung erfolgt automatisch durch den Speed-Round Timer
            } else {
                if (attemptsMadeThisRound < currentListenAttempts) {
                    logoButton.classList.remove('inactive'); // Aktiviere Logo-Button für weitere Versuche
                } else {
                    logoButton.classList.add('inactive'); // Deaktiviere Logo-Button, wenn keine Versuche mehr übrig sind
                }
                resolveButton.classList.remove('hidden'); // Zeige den Auflösen-Button
            }
        }, currentGameDuration);

    } catch (error) {
        console.error('Fehler beim Abspielen des Songs:', error);
        alert('Fehler beim Abspielen des Songs. Bitte versuche es erneut.');
        logoButton.classList.remove('inactive'); // Aktiviere Button wieder bei Fehler
    }
}

// --- Phasenlogik ---

/**
 * Überprüft die Geräteausrichtung und den Vollbildmodus.
 */
function checkOrientationAndFullscreen() {
    // Wenn nicht eingeloggt, zeige Login-Bildschirm
    if (!accessToken) {
        showScreen(loginScreen);
        return;
    }

    // Priorität 2: Ausrichtung
    if (window.matchMedia("(orientation: portrait)").matches) {
        toggleOverlay(orientationOverlay, true);
        toggleOverlay(fullscreenScreen, false); // Vollbild-Screen verstecken
        gameScreens.classList.add('hidden'); // Spielbildschirme verstecken
        return;
    } else {
        toggleOverlay(orientationOverlay, false);
    }

    // Priorität 3: Vollbild-Modus (nur im Querformat)
    if (!document.fullscreenElement) {
        toggleOverlay(fullscreenScreen, true);
        gameScreens.classList.add('hidden'); // Spielbildschirme verstecken
        return;
    } else {
        toggleOverlay(fullscreenScreen, false);
    }

    // Wenn alle Bedingungen erfüllt sind, starte die Begrüßungsanimation oder das Spiel
    if (!isIntroAnimationPlayed) {
        startIntroAnimation();
    } else {
        startGamePhase(); // Gehe direkt zur Spielphase, wenn Animation schon lief
    }
}

/**
 * Startet die einmalige Begrüßungsanimation.
 */
function startIntroAnimation() {
    toggleOverlay(introAnimationContainer, true);
    introLogo.style.animation = 'bounce 1s ease-out forwards'; // Animation starten

    introLogo.addEventListener('animationend', () => {
        isIntroAnimationPlayed = true;
        sessionStorage.setItem('introAnimationPlayed', 'true'); // Vermerk setzen
        toggleOverlay(introAnimationContainer, false); // Overlay ausblenden
        startGamePhase(); // Gehe zur Spielphase
    }, { once: true }); // Event Listener nur einmal ausführen
}

/**
 * Startet die eigentliche Spielphase nach der Initialisierung.
 */
function startGamePhase() {
    showScreen(gameScreens); // Zeige den Haupt-Spielcontainer
    showGameSection(logoButton); // Zeige den Logo-Button als Startpunkt
    logoButton.classList.remove('inactive'); // Logo-Button aktivieren
    changeBackgroundColor('#000'); // Hintergrund auf Schwarz setzen
    isGameStarted = false; // Spiel ist noch nicht gestartet, wartet auf ersten Klick auf Logo
}

/**
 * Startet eine neue Spielrunde.
 */
function startNewRound() {
    // Verstecke alle Spielsektionen
    document.querySelectorAll('.game-section').forEach(section => section.classList.add('hidden'));

    // Zeige den Würfel-Bildschirm
    showGameSection(diceScreen);
    diceAnimation.classList.remove('hidden'); // Würfel-Animation anzeigen
    diceButtonsContainer.classList.add('hidden'); // Würfel-Buttons verstecken

    setTimeout(() => {
        diceAnimation.classList.add('hidden'); // Würfel-Animation ausblenden
        diceButtonsContainer.classList.remove('hidden'); // Würfel-Buttons einblenden
    }, 4000); // 4 Sekunden Würfel-Animation
}

/**
 * Startet die Speed-Round.
 */
function startSpeedRound() {
    isSpeedRoundActive = true;
    toggleOverlay(speedRoundOverlay, true);
    speedRoundCountdown.classList.add('hidden'); // Countdown am Anfang verstecken

    // Animation des "Speed-Round" Textes
    speedRoundOverlay.querySelector('.speed-round-text').style.animation = 'zoomInFadeOut 4s forwards';

    setTimeout(() => {
        speedRoundOverlay.querySelector('.speed-round-text').style.animation = 'none'; // Animation zurücksetzen
        speedRoundCountdown.classList.remove('hidden'); // Countdown anzeigen
        startSpeedRoundCountdown(); // Countdown starten
    }, 4000); // Nach 4 Sekunden, wenn die Animation abgelaufen ist
}

/**
 * Startet den 10-Sekunden-Countdown für die Speed-Round.
 */
function startSpeedRoundCountdown() {
    let countdown = 10;
    speedRoundCountdown.textContent = countdown;

    speedRoundCountdownInterval = setInterval(() => {
        countdown--;
        speedRoundCountdown.textContent = countdown;

        if (countdown <= 0) {
            clearInterval(speedRoundCountdownInterval);
            // Timer abgelaufen, Runde automatisch auflösen
            logoButton.classList.add('inactive'); // Logo-Button deaktivieren
            player.pause(); // Song stoppen
            toggleOverlay(speedRoundOverlay, true); // Overlay wieder einblenden
            speedRoundCountdown.classList.add('hidden'); // Countdown verstecken
            resolveRound(true); // Runde auflösen (automatisch)
        }
    }, 1000);

    // Starte den Song sofort, wenn der Countdown beginnt
    playSongSnippet();
}


/**
 * Zeigt die Auflösung der Runde an (Titel, Interpret, Cover).
 * @param {boolean} autoResolve - True, wenn die Auflösung automatisch erfolgt (z.B. bei Speed-Round).
 */
async function resolveRound(autoResolve = false) {
    // Verstecke den Logo-Button und den Auflösen-Button
    logoButton.classList.add('inactive');
    resolveButton.classList.add('hidden');

    // Hole Song-Informationen
    const currentTrackData = await fetch(`https://api.spotify.com/v1/tracks/${currentTrackUri.split(':')[2]}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    }).then(res => res.json());

    albumCover.src = currentTrackData.album.images[0].url;
    songTitle.textContent = currentTrackData.name;
    songArtist.textContent = currentTrackData.artists.map(a => a.name).join(', ');
    songInfo.classList.remove('hidden'); // Song-Info anzeigen

    // Zeige RICHTIG/FALSCH Buttons
    correctButton.classList.remove('hidden');
    wrongButton.classList.remove('hidden');

    // Wenn automatische Auflösung (z.B. Speed-Round), blende das Overlay aus, nachdem die Buttons erscheinen
    if (autoResolve) {
        toggleOverlay(speedRoundOverlay, true); // Sicherstellen, dass das Overlay sichtbar ist
        speedRoundCountdown.classList.add('hidden'); // Countdown verstecken
        // Gib dem Benutzer eine kurze Zeit, um die Auflösung zu sehen, bevor die Buttons erscheinen
        setTimeout(() => {
            correctButton.classList.remove('hidden');
            wrongButton.classList.remove('hidden');
            // Das Overlay bleibt sichtbar, bis der Benutzer RICHTIG/FALSCH klickt
        }, 500);
    }
}

/**
 * Beendet das Spiel und zeigt die Endpunktstände an.
 */
function endGame() {
    showScreen(scoreScreen);
    player1FinalScore.textContent = `Spieler 1: ${player1Score}`;
    player2FinalScore.textContent = `Spieler 2: ${player2Score}`;
    changeBackgroundColor('linear-gradient(to right, #00BFFF, #FF1493)'); // Hintergrundverlauf

    setTimeout(() => {
        // Spiel zurücksetzen für eine neue Runde
        player1Score = 0;
        player2Score = 0;
        currentPlayer = 1;
        currentRound = 1;
        isGameStarted = false;
        player1SpeedRound = Math.floor(Math.random() * 10) + 1;
        player2SpeedRound = Math.floor(Math.random() * 10) + 1;

        showScreen(gameScreens); // Zurück zum Spielbildschirm
        showGameSection(logoButton); // Zeige den Logo-Button
        logoButton.classList.remove('inactive'); // Aktiviere Logo-Button
        changeBackgroundColor('#000'); // Hintergrund auf Schwarz
    }, 7000); // 7 Sekunden Anzeige der Punkte
}


// --- Event Listener ---

// Phase 1.1: Login-Button
loginButton.addEventListener('click', startSpotifyAuth);

// Phase 1.2: Orientierungsprüfung
window.addEventListener('orientationchange', checkOrientationAndFullscreen);
window.matchMedia("(orientation: portrait)").addEventListener("change", checkOrientationAndFullscreen);

// Phase 1.3: Vollbild-Modus
fullscreenScreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            checkOrientationAndFullscreen(); // Nach erfolgreichem Vollbild weiter
        }).catch(err => {
            console.error('Fehler beim Aktivieren des Vollbildmodus:', err);
            alert('Vollbildmodus konnte nicht aktiviert werden. Bitte versuche es erneut.');
        });
    }
});
document.addEventListener('fullscreenchange', checkOrientationAndFullscreen);

// Phase 2.2: Spielstart-Logik (Klick auf Logo-Button)
logoButton.addEventListener('click', () => {
    if (!isGameStarted) {
        isGameStarted = true;
        logoButton.classList.add('inactive'); // Logo-Button inaktiv machen
        logoButton.querySelector('img').style.animation = 'bounce 0.5s ease-out forwards'; // Bounce-Effekt

        // Hintergrundfarbe wechseln nach kurzer Verzögerung für Bounce-Effekt
        setTimeout(() => {
            changeBackgroundColor('#00BFFF'); // Blau für Spieler 1
            logoButton.querySelector('img').style.animation = 'none'; // Animation zurücksetzen
            startNewRound(); // Starte die erste Runde
        }, 500); // Warte, bis der Bounce-Effekt abgeschlossen ist
    } else {
        // Wenn das Spiel bereits gestartet ist, dient der Logo-Button als Play-Button
        if (!logoButton.classList.contains('inactive')) {
            playSongSnippet();
        }
    }
});

// Phase 3.2: Würfel-Logik
diceButtonsContainer.addEventListener('click', (event) => {
    const targetButton = event.target.closest('.dice-button');
    if (targetButton) {
        currentDiceValue = parseInt(targetButton.dataset.diceValue);
        console.log('Würfelwert gewählt:', currentDiceValue);

        // Setze Spielparameter basierend auf Würfelwert
        if (currentDiceValue === 7) {
            currentGameDuration = 2000; // 2 Sekunden
            currentListenAttempts = 1; // Nur ein Versuch
        } else {
            currentGameDuration = 7000; // 7 Sekunden
            currentListenAttempts = currentDiceValue; // Anzahl der Versuche entspricht Würfelwert
        }
        currentMaxPoints = currentDiceValue;

        // Gehe zum Genre-Bildschirm
        showGameSection(genreScreen);

        // Überprüfe Speed-Round und aktiviere Genre-Auswahl-Logik
        const currentPlayersRound = (currentPlayer === 1) ? Math.ceil(currentRound / 2) : Math.ceil((currentRound - 1) / 2);
        const isCurrentPlayerSpeedRound = (currentPlayer === 1 && currentPlayersRound === player1SpeedRound) ||
                                          (currentPlayer === 2 && currentPlayersRound === player2SpeedRound);

        if (currentDiceValue !== 7 && !isCurrentPlayerSpeedRound) {
            // Fall A: Zufällige Genre-Auswahl (für Würfel 3, 4, 5, wenn keine Speed-Round)
            genreButtons.forEach(button => button.classList.add('inactive')); // Alle inaktiv machen für Animation

            let blinkInterval = setInterval(() => {
                const randomButton = genreButtons[Math.floor(Math.random() * genreButtons.length)];
                genreButtons.forEach(button => button.classList.add('inactive'));
                randomButton.classList.remove('inactive');
            }, 100); // Schnelles Blinken

            setTimeout(() => {
                clearInterval(blinkInterval);
                const randomIndex = Math.floor(Math.random() * genreButtons.length);
                const selectedRandomGenreButton = genreButtons[randomIndex];
                genreButtons.forEach(button => button.classList.add('inactive')); // Alle wieder inaktiv
                selectedRandomGenreButton.classList.remove('inactive'); // Nur der zufällige ist aktiv
                selectedGenrePlaylists = genrePlaylists[selectedRandomGenreButton.dataset.genre];
                console.log('Zufällig gewähltes Genre:', selectedRandomGenreButton.dataset.genre);
            }, 4000); // 4 Sekunden Animation
        } else {
            // Fall B: Spieler wählt Genre selbst (für Würfel 7 oder Speed-Round)
            genreButtons.forEach(button => button.classList.remove('inactive')); // Alle aktiv
        }
    }
});

// Phase 3.4: Genre-Auswahl-Logik
genreButtonsContainer.addEventListener('click', async (event) => {
    const targetButton = event.target.closest('.genre-button');
    if (targetButton && !targetButton.classList.contains('inactive')) {
        const selectedGenre = targetButton.dataset.genre;
        selectedGenrePlaylists = genrePlaylists[selectedGenre];
        console.log('Genre gewählt:', selectedGenre);

        // Überprüfe, ob es eine Speed-Round ist
        const currentPlayersRound = (currentPlayer === 1) ? Math.ceil(currentRound / 2) : Math.ceil((currentRound - 1) / 2);
        const isCurrentPlayerSpeedRound = (currentPlayer === 1 && currentPlayersRound === player1SpeedRound) ||
                                          (currentPlayer === 2 && currentPlayersRound === player2SpeedRound);

        if (isCurrentPlayerSpeedRound) {
            await startSpeedRound(); // Starte die Speed-Round
        } else {
            // Gehe direkt zum Rate-Bildschirm
            showGameSection(guessScreen);
            logoButton.classList.remove('inactive'); // Logo-Button als Play-Button aktivieren
            // Lade den ersten Song für die Runde
            await getRandomTrackFromPlaylist(getRandomPlaylistId());
        }
    }
});


// Phase 4.3: Auflösen-Button
resolveButton.addEventListener('click', () => {
    resolveRound();
});

// Phase 4.4: RICHTIG/FALSCH-Buttons
correctButton.addEventListener('click', () => {
    const pointsEarned = calculatePoints(currentDiceValue, attemptsMadeThisRound);
    if (currentPlayer === 1) {
        player1Score += pointsEarned;
    } else {
        player2Score += pointsEarned;
    }
    console.log(`Spieler ${currentPlayer} hat RICHTIG geraten und ${pointsEarned} Punkte erhalten.`);
    console.log(`Aktueller Punktestand: Spieler 1: ${player1Score}, Spieler 2: ${player2Score}`);

    toggleOverlay(speedRoundOverlay, false); // Speed-Round Overlay ausblenden, falls aktiv
    updateGameProgressAndSwitchPlayer();
});

wrongButton.addEventListener('click', () => {
    console.log(`Spieler ${currentPlayer} hat FALSCH geraten.`);
    toggleOverlay(speedRoundOverlay, false); // Speed-Round Overlay ausblenden, falls aktiv
    updateGameProgressAndSwitchPlayer();
});


// --- Initialisierung beim Laden der Seite ---
window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        // Wenn ein Autorisierungscode vorhanden ist, tausche ihn gegen ein Token
        history.replaceState({}, document.title, REDIRECT_URI); // Entferne den Code aus der URL
        exchangeCodeForToken(code);
    } else {
        // Überprüfe, ob bereits ein Access Token im Local Storage vorhanden ist
        accessToken = localStorage.getItem('access_token');
        refreshToken = localStorage.getItem('refresh_token');

        if (accessToken) {
            // Wenn Token vorhanden, versuche SDK zu initialisieren
            initializeSpotifySdk();
        } else {
            // Andernfalls zeige den Login-Bildschirm
            showScreen(loginScreen);
        }
    }

    // Führe die erste Überprüfung der Ausrichtung und des Vollbildmodus durch
    checkOrientationAndFullscreen();
};

