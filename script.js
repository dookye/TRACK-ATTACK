// Block 1: Konstanten und UI-Elemente
// Dieser erste Block enthält alle Konstanten und die Referenzen zu den HTML-UI-Elementen.

// --- KONSTANTEN ---
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6';
const REDIRECT_URI = 'https://dookye.github.io/musik-raten/';
const SCOPES = [
    'user-read-private',
    'user-read-email',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state'
];

// SPOTIFY API ENDPUNKTE (DIES SIND DIE KORREKTEN FÜR DEIN PROJEKT)
const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'; // Direkter Autorisierungs-Endpunkt für den Browser-Redirect
const SPOTIFY_TOKEN_URL     = 'https://accounts.spotify.com/api/token';  // Direkter Token-Austausch-Endpunkt (Accounts Service)
const SPOTIFY_API_BASE_URL  = 'https://api.spotify.com/v1'; // Basis-URL für die Spotify Web API (Player, Playlists, etc.)

// Genre-Definitionen mit zugehörigen Spotify Playlist-IDs
const GENRES = {
    'Punk Rock (90s & 00s)': ['39sVxPTg7BKwrf2MfgrtcD', '7qGvinYjBfVpl1FJFkzGqV'],
    'Disney Songs': ['3Bilb56eeS7db5f3DTEwMR'],
    'TEST': ['2ZnrLLb3q9qEmpzDApzKMe', '36UqUEUrE2siIfs7lsWw4x'],
    'Pop Hits (2000-2025)': ['6mtYuOxzl58vSGnEDtZ9uB'],
    'Top 100 Hits Of All Time': ['6i2Qd6OpeRBAzxfscNXeWp']
    // HIER KÖNNTEN SPÄTER WEITERE GENRES HINZUGEFÜGT WERDEN
};

// --- UI-ELEMENTE ---
const loginScreen = document.getElementById('login-screen');
const gamemodeSelectionScreen = document.getElementById('gamemode-selection-screen');
const genreSelectionScreen = document.getElementById('genre-selection-screen');
const gameScreen = document.getElementById('game-screen');
const gameEndScreen = document.getElementById('game-end-screen');

const spotifyLoginButton = document.getElementById('spotify-login-button');

const gamemodeButtons = document.querySelectorAll('.gamemode-button');
const genreButtonsContainer = document.getElementById('genre-buttons');

const trackAttackButton = document.getElementById('track-attack-button');
const revealButton = document.getElementById('reveal-button');
const correctButton = document.getElementById('correct-button');
const wrongButton = document.getElementById('wrong-button');
const nextAttackButton = document.getElementById('next-attack-button');

const guessControls = document.getElementById('guess-controls');
const feedbackMessage = document.getElementById('feedback-message');
const playerIndicator = document.getElementById('player-indicator');
const currentPlayerNameDisplay = document.getElementById('current-player-name');
const scoreBlueDisplay = document.getElementById('score-blue');
const scoreYellowDisplay = document.getElementById('score-yellow');
const currentSongNumberDisplay = document.getElementById('current-song-number');
const finalScoreBlueDisplay = document.getElementById('final-score-blue');
const finalScoreYellowDisplay = document.getElementById('final-score-yellow');

const playbackStatus = document.getElementById('playback-status');

// --- GLOBALE ZUSTANDSVARIABLEN ---
let accessToken = '';
let player = null;
let currentPlaylistTracks = [];
let activeDeviceId = null;
let isPlayerReady = false;
let isSpotifySDKLoaded = false;

// Spielzustand
let selectedPlayDuration = 0; // Abspieldauer in Millisekunden
let selectedGenrePlaylists = []; // Array der Playlist-IDs für das ausgewählte Genre
let currentTrack = null; // Speichert das aktuelle Song-Objekt (für Titel, Interpret)
let playAttempts = 0; // Zähler für TRACK ATTACK / ATTACK AGAIN
let currentPlayPosition = 0; // Speichert die Startposition des aktuell gespielten Songs

// Spieler- und Spielrunden-Management
const MAX_SONGS_PER_PLAYER = 10;
const MAX_ATTACKS = 4; // 1 (TRACK ATTACK) + 3 (ATTACK AGAIN)
let currentPlayer = 'blue'; // 'blue' oder 'yellow'
let songsPlayedBlue = 0;
let songsPlayedYellow = 0;
let scoreBlue = 0;
let scoreYellow = 0;
let currentRoundScore = 0; // Punkte für den aktuell zu ratenden Song

// Block 2: PKCE Helfer-Funktionen und Spotify Auth/API Funktionen (Teil 1)
// Dieser Block beinhaltet die Funktionen zur PKCE-Authentifizierung und den ersten Teil der Spotify-API-Interaktionen.

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

// --- SPOTIFY AUTH & API FUNKTIONEN ---

/**
 * Leitet den Benutzer zum Spotify-Login weiter (PKCE Flow).
 */
async function redirectToSpotifyAuthorize() {
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
    const codeVerifier = localStorage.getItem('code_verifier');
    if (!codeVerifier) {
        console.error('Code Verifier nicht gefunden. Kann Token nicht austauschen.');
        alert('Fehler: Code Verifier nicht gefunden. Bitte versuche den Login erneut.');
        showLoginScreen();
        return;
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

        console.log('Access Token erfolgreich erhalten und gespeichert.');
        localStorage.removeItem('code_verifier'); // Code Verifier ist jetzt nicht mehr nötig

    } catch (error) {
        console.error('Fehler beim Token-Austausch:', error);
        alert('Fehler beim Spotify Login. Bitte versuche es erneut. Stelle sicher, dass du einen Premium Account hast.');
        showLoginScreen();
    }
}

// Block 3: Spotify Player Initialisierung und Wiedergabesteuerung
// Dieser Block kümmert sich um die Einbindung und Steuerung des Spotify Web Playback SDK Players sowie das Übertragen der Wiedergabe.

/**
 * Initialisiert und verbindet den Spotify Player.
 * Wird aufgerufen, wenn sowohl das SDK geladen als auch der Access Token verfügbar ist.
 */
async function initializeSpotifyPlayer() {
    console.log('Versuche Spotify Player zu initialisieren...');

    // Prüfe nochmals, ob alles bereit ist
    if (!isSpotifySDKLoaded) {
        console.warn('initializeSpotifyPlayer aufgerufen, aber SDK noch nicht geladen.');
        return; // Warte auf window.onSpotifyWebPlaybackSDKReady
    }
    if (!accessToken || localStorage.getItem('expires_in') < Date.now()) {
        console.warn('initializeSpotifyPlayer aufgerufen, aber Access Token fehlt oder ist abgelaufen. Zeige Login-Screen.');
        playbackStatus.textContent = 'Fehler: Spotify Session abgelaufen oder nicht angemeldet. Bitte neu anmelden.';
        showLoginScreen();
        return;
    }

    // Wenn der Player bereits initialisiert ist, nichts tun
    if (player) {
        console.log('Spotify Player bereits initialisiert.');
        showGamemodeSelectionScreen(); // Zeige Spielmodus-Screen, falls noch nicht geschehen
        return;
    }

    player = new Spotify.Player({
        name: 'TRACK ATTACK Player',
        getOAuthToken: cb => { cb(accessToken); },
        volume: 0.5
    });

    player.addListener('ready', ({ device_id }) => {
        console.log('Spotify Player ist bereit auf Gerät-ID:', device_id);
        activeDeviceId = device_id;
        isPlayerReady = true;
        playbackStatus.textContent = 'Spotify Player verbunden!';
        transferPlayback(device_id); // Übertrage die Wiedergabe auf unseren Player
        showGamemodeSelectionScreen(); // Weiter zur Spielmodus-Auswahl!
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.warn('Gerät-ID nicht bereit:', device_id);
        playbackStatus.textContent = 'Spotify Player ist nicht bereit. Ist Spotify im Browser offen?';
        isPlayerReady = false;
    });

    player.addListener('initialization_error', ({ message }) => {
        console.error('Initialisierungsfehler des Spotify Players:', message);
        playbackStatus.textContent = `Fehler beim Initialisieren des Players: ${message}`;
        isPlayerReady = false;
        alert('Fehler beim Initialisieren des Spotify Players. Versuche es erneut.');
        showLoginScreen(); // Zurück zum Login
    });

    player.addListener('authentication_error', ({ message }) => {
        console.error('Authentifizierungsfehler des Spotify Players:', message);
        playbackStatus.textContent = 'Authentifizierungsfehler. Bitte logge dich erneut ein.';
        alert('Deine Spotify-Sitzung ist abgelaufen oder ungültig. Bitte logge dich erneut ein.');
        isPlayerReady = false;
        showLoginScreen();
    });

    player.addListener('account_error', ({ message }) => {
        console.error('Account-Fehler des Spotify Players:', message);
        playbackStatus.textContent = 'Account-Fehler. Hast du einen Spotify Premium Account?';
        alert('Es gab einen Fehler mit deinem Spotify Account. Für dieses Spiel ist ein Premium Account erforderlich.');
        isPlayerReady = false;
        showLoginScreen();
    });

    player.addListener('playback_error', ({ message }) => {
        console.error('Wiedergabefehler des Spotify Players:', message);
        playbackStatus.textContent = `Wiedergabefehler: ${message}`;
    });

    player.addListener('player_state_changed', (state) => {
        if (!state) {
            return;
        }
        // console.log('Player State Changed:', state);
        // Hier könnten wir später den UI-Status aktualisieren, z.B. wenn ein Song endet.
    });

    // Versuche, den Player zu verbinden
    player.connect().then(success => {
        if (success) {
            console.log('Der Web Playback SDK Player wurde erfolgreich verbunden (wartet auf "ready"-Status).');
        } else {
            console.warn('Verbindung zum Web Playback SDK Player fehlgeschlagen.');
            playbackStatus.textContent = 'Verbindung zum Spotify Player fehlgeschlagen.';
        }
    }).catch(err => {
        console.error('Fehler beim Verbinden des Players:', err);
        playbackStatus.textContent = `Verbindung zum Player fehlgeschlagen: ${err.message}`;
    });
}

/**
 * Globaler Callback für das Spotify Web Playback SDK.
 * WIRD VOM SDK AUFGERUFEN, SOBALD ES GELADEN IST.
 */
window.onSpotifyWebPlaybackSDKReady = () => {
    console.log('Spotify Web Playback SDK ist bereit (onSpotifyWebPlaybackSDKReady wurde ausgelöst).');
    isSpotifySDKLoaded = true; // Setze das Flag

    // Wenn der Access Token bereits verfügbar ist, können wir den Player jetzt initialisieren
    if (accessToken) {
        initializeSpotifyPlayer();
    }
};

/**
 * Überträgt die Wiedergabe auf den neu erstellten Web Playback SDK Player.
 * @param {string} deviceId - Die ID des Players, auf den übertragen werden soll.
 */
async function transferPlayback(deviceId) {
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
        console.log('Wiedergabe auf neuen Player übertragen.');

    } catch (error) {
        console.error('Fehler beim Übertragen der Wiedergabe:', error);
        playbackStatus.textContent = `Fehler beim Aktivieren des Players: ${error.message}`;
    }
}

// Block 4: UI-Steuerungsfunktionen und Genre-Logik
// Dieser Block enthält die Funktionen, die den Wechsel zwischen den verschiedenen Bildschirmen steuern, und die Logik zum Rendern und Auswählen der Genres.

// --- UI STEUERUNGSFUNKTIONEN ---
function showScreen(screenId) {
    // Alle Bildschirme ausblenden
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    // Den gewünschten Bildschirm einblenden
    document.getElementById(screenId).classList.add('active');
}

function showLoginScreen() {
    showScreen('login-screen');
    document.body.className = ''; // Hintergrundfarbe zurücksetzen
}

function showGamemodeSelectionScreen() {
    showScreen('gamemode-selection-screen');
    document.body.className = ''; // Hintergrundfarbe zurücksetzen
}

function showGenreSelectionScreen() {
    showScreen('genre-selection-screen');
    document.body.className = ''; // Hintergrundfarbe zurücksetzen
    renderGenreButtons(); // Rendere die Genre-Buttons neu
}

function showGameScreen() {
    showScreen('game-screen');
    updatePlayerUI(); // Spieler-UI aktualisieren (Name, Farben)
    // Setze die Anzeige für den Song-Zähler zurück, wenn ein neues Spiel beginnt
    currentSongNumberDisplay.textContent = (currentPlayer === 'blue' ? songsPlayedBlue : songsPlayedYellow) + 1;
    // Beim ersten Betreten des GameScreens, setze den Track Attack Button zurück
    resetGameRoundUI();
    startSongRound();
}

function showGameEndScreen() {
    showScreen('game-end-screen');
    finalScoreBlueDisplay.textContent = scoreBlue;
    finalScoreYellowDisplay.textContent = scoreYellow;
    document.body.className = ''; // Hintergrundfarbe zurücksetzen
}

// Funktion zum Aktualisieren der Spieler-UI (Farbe, Name, Scores)
function updatePlayerUI() {
    if (currentPlayer === 'blue') {
        document.body.className = 'player-blue';
        currentPlayerNameDisplay.textContent = 'BLAU';
    } else {
        document.body.className = 'player-yellow';
        currentPlayerNameDisplay.textContent = 'GELB';
    }
    scoreBlueDisplay.textContent = scoreBlue;
    scoreYellowDisplay.textContent = scoreYellow;
}

// --- NEUE SPIEL-LOGIK FUNKTIONEN ---

/**
 * Rendert die Genre-Buttons dynamisch basierend auf der GENRES-Konstante.
 */
function renderGenreButtons() {
    genreButtonsContainer.innerHTML = ''; // Vorherige Buttons entfernen
    for (const genreName in GENRES) {
        const button = document.createElement('button');
        button.classList.add('genre-button');
        button.textContent = genreName;
        button.addEventListener('click', () => {
            selectedGenrePlaylists = GENRES[genreName];
            console.log(`Genre gewählt: ${genreName}, Playlists:`, selectedGenrePlaylists);
            showGameScreen(); // Weiter zum Spielbildschirm
        });
        genreButtonsContainer.appendChild(button);
    }
}

// Block 5: Spielrunden-Logik und Raten-Mechanik
// Dieser Block enthält die Hauptlogik für das Starten von Song-Runden, das erneute Abspielen von Songs, das Raten und das Auflösen.

/**
 * Startet eine neue Song-Runde: Wählt einen Song, spielt ihn ab und setzt die UI zurück.
 */
async function startSongRound() {
    if (!isPlayerReady || !player || !activeDeviceId) {
        playbackStatus.textContent = 'Spotify Player ist noch nicht bereit oder verbunden. Bitte warten...';
        console.warn('Song-Runde blockiert: Player nicht bereit oder kein aktives Gerät gefunden.');
        return;
    }

    // Spielerwechsel-Logik
    if (currentPlayer === 'blue' && songsPlayedBlue >= MAX_SONGS_PER_PLAYER) {
        currentPlayer = 'yellow';
        alert("Spieler BLAU hat 10 Songs gespielt. Spieler GELB ist an der Reihe!");
        showGenreSelectionScreen(); // Gelb wählt Genre
        return;
    } else if (currentPlayer === 'yellow' && songsPlayedYellow >= MAX_SONGS_PER_PLAYER) {
        // Spielende
        showGameEndScreen();
        return;
    }

    // UI für neue Runde zurücksetzen
    resetGameRoundUI();
    updatePlayerUI(); // Aktualisiere die Spieler-Anzeige
    currentSongNumberDisplay.textContent = (currentPlayer === 'blue' ? songsPlayedBlue : songsPlayedYellow) + 1;

    playbackStatus.textContent = 'Lade Song...'; // Für den Status auf dem Login-Screen

    try {
        // Wähle eine Playlist aus dem ausgewählten Genre
        if (selectedGenrePlaylists.length === 0) {
            alert('Bitte wähle zuerst ein Genre aus der Auswahlseite!');
            showGenreSelectionScreen();
            return;
        }
        const randomPlaylistId = selectedGenrePlaylists[Math.floor(Math.random() * selectedGenrePlaylists.length)];
        console.log(`Lade Tracks aus Playlist: ${randomPlaylistId}`);

        // Holt die Tracks aus der ausgewählten Playlist
        let allTracks = [];
        let nextUrl = `${SPOTIFY_API_BASE_URL}/playlists/${randomPlaylistId}/tracks?limit=100`;

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
            // Wir filtern nur noch nach 'is_local' Tracks, da Premium-User volle Tracks streamen können, nicht nur Previews.
            allTracks = allTracks.concat(data.items.filter(item => item.track && !item.track.is_local));
            
            // Filtere nach Tracks, die keine lokalen Dateien sind und eine Preview-URL haben (Wichtig für Playback)
            // allTracks = allTracks.concat(data.items.filter(item => item.track && !item.track.is_local && item.track.preview_url));
            nextUrl = data.next;
        }

        if (allTracks.length === 0) {
            console.warn('Keine spielbaren Tracks in der Playlist gefunden.');
            playbackStatus.textContent = 'Achtung: Keine spielbaren Tracks in der Playlist gefunden. Wähle ein anderes Genre oder Playlist.';
            alert('In diesem Genre sind keine spielbaren Songs verfügbar. Bitte wähle ein anderes Genre.');
            showGenreSelectionScreen();
            return;
        }

        currentTrack = allTracks[Math.floor(Math.random() * allTracks.length)].track; // Speichere das gesamte Track-Objekt
        currentRoundScore = 5; // Setze Basis-Punkte für diese Runde

        // Spielt den Song an einer zufälligen Position
        const trackDurationMs = currentTrack.duration_ms;
        // Bestimme die tatsächliche Abspieldauer, die kürzer als der Song sein muss
        const actualPlayDuration = Math.min(selectedPlayDuration, trackDurationMs - 1000); // Mindestens 1 Sekunde vor Ende stoppen

        const maxStartPositionMs = Math.max(0, trackDurationMs - actualPlayDuration - 1000); // Stelle sicher, dass der Song nicht über das Ende hinaus geht
        currentPlayPosition = Math.floor(Math.random() * maxStartPositionMs);

        console.log(`Versuche abzuspielen: ${currentTrack.name} von ${currentTrack.artists[0].name} (${currentTrack.uri})`);
        console.log(`Startposition: ${currentPlayPosition}ms, Dauer: ${actualPlayDuration / 1000}s`);

        await player.activateElement(); // Wichtig für Nutzerinteraktion

        const playResponse = await fetch(`${SPOTIFY_API_BASE_URL}/me/player/play?device_id=${activeDeviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                uris: [currentTrack.uri],
                position_ms: currentPlayPosition
            })
        });

        if (!playResponse.ok) {
            const errorData = await playResponse.json();
            console.error('Fehler-Response von /me/player/play:', errorData);
            throw new Error(`Fehler beim Starten der Wiedergabe: ${playResponse.status} - ${errorData.error.message || playResponse.statusText}`);
        }

        playbackStatus.textContent = 'Spiele Song... Rate den Titel!';
        console.log('Song gestartet über Web API.');

        // Deaktiviere TRACK ATTACK/ATTACK AGAIN während der Song spielt
        trackAttackButton.disabled = true;

        // Song nach der festgelegten Dauer stoppen
        setTimeout(() => {
            player.pause().then(() => {
                playbackStatus.textContent = 'Song beendet. Zeit zu raten oder erneut hören!';
                console.log(`Song nach ${actualPlayDuration / 1000} Sekunden gestoppt.`);
                // Aktiviere Rate-Buttons und TRACK ATTACK/ATTACK AGAIN (wenn noch Versuche übrig)
                guessControls.style.display = 'block';
                trackAttackButton.disabled = false; // Aktiviere Button wieder
                if (playAttempts >= MAX_ATTACKS - 1) { // -1 weil playAttempts bei 0 startet
                    trackAttackButton.disabled = true; // Nach 4 Versuchen inaktiv
                    trackAttackButton.textContent = 'Keine Versuche mehr';
                }
            }).catch(pauseError => {
                console.error('Fehler beim Pausieren des Songs via SDK:', pauseError);
                playbackStatus.textContent = `Fehler beim Stoppen: ${pauseError.message}`;
            });
        }, actualPlayDuration);

    } catch (error) {
        console.error('Fehler beim Abspielen des zufälligen Songs:', error);
        playbackStatus.textContent = `Fehler beim Abspielen: ${error.message}`;
        alert('Fehler beim Abspielen des Songs. Bitte versuche es erneut oder wähle ein anderes Genre. Stelle sicher, dass du einen aktiven Spotify Premium Account hast.');
        showGenreSelectionScreen(); // Zurück zur Genre-Auswahl
    }
}

// Funktion für TRACK ATTACK / ATTACK AGAIN Logik
async function handleTrackAttack() {
    if (!currentTrack || !isPlayerReady || !activeDeviceId) {
        console.warn("TRACK ATTACK/AGAIN geklickt, aber kein Song geladen oder Player nicht bereit.");
        return;
    }

    playAttempts++;
    currentRoundScore = Math.max(1, 5 - playAttempts); // Punkte reduzieren, Minimum 1

    if (playAttempts >= MAX_ATTACKS) {
        trackAttackButton.disabled = true;
        trackAttackButton.textContent = 'Keine Versuche mehr';
        return;
    }

    trackAttackButton.disabled = true; // Deaktiviere Button während Song spielt
    trackAttackButton.textContent = `ATTACK AGAIN (${MAX_ATTACKS - 1 - playAttempts} übrig)`; // Zähler aktualisieren

    playbackStatus.textContent = 'Spiele Song erneut...';

    try {
        const trackDurationMs = currentTrack.duration_ms;
        const actualPlayDuration = Math.min(selectedPlayDuration, trackDurationMs - 1000);
        const maxStartPositionMs = Math.max(0, trackDurationMs - actualPlayDuration - 1000);
        const newPlayPosition = Math.floor(Math.random() * maxStartPositionMs);

        const playResponse = await fetch(`${SPOTIFY_API_BASE_URL}/me/player/play?device_id=${activeDeviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                uris: [currentTrack.uri],
                position_ms: newPlayPosition
            })
        });

        if (!playResponse.ok) {
            const errorData = await playResponse.json();
            throw new Error(`Fehler beim erneuten Abspielen: ${playResponse.status} - ${errorData.error.message || response.statusText}`);
        }

        console.log(`Song erneut gestartet bei ${newPlayPosition}ms für ${actualPlayDuration / 1000}s`);

        setTimeout(() => {
            player.pause().then(() => {
                playbackStatus.textContent = 'Song beendet. Zeit zu raten oder erneut hören!';
                trackAttackButton.disabled = false; // Aktiviere Button wieder
                if (playAttempts >= MAX_ATTACKS -1) {
                    trackAttackButton.disabled = true;
                    trackAttackButton.textContent = 'Keine Versuche mehr';
                }
            }).catch(pauseError => {
                console.error('Fehler beim Pausieren des Songs via SDK:', pauseError);
                playbackStatus.textContent = `Fehler beim Stoppen: ${pauseError.message}`;
            });
        }, actualPlayDuration);

    } catch (error) {
        console.error('Fehler beim erneuten Abspielen:', error);
        playbackStatus.textContent = `Fehler: ${error.message}`;
        trackAttackButton.disabled = false; // Aktiviere Button wieder bei Fehler
    }
}

// Funktion für "RICHTIG" / "FALSCH"
function handleGuess(isCorrect) {
    guessControls.style.display = 'none'; // Rate-Buttons ausblenden
    trackAttackButton.disabled = true; // TRACK ATTACK Button deaktivieren

    if (isCorrect) {
        feedbackMessage.textContent = `Richtig! Der Song war "${currentTrack.name}" von "${currentTrack.artists[0].name}".`;
        feedbackMessage.style.color = 'green';
        if (currentPlayer === 'blue') {
            scoreBlue += currentRoundScore;
        } else {
            scoreYellow += currentRoundScore;
        }
    } else {
        feedbackMessage.textContent = `Falsch! Der Song war "${currentTrack.name}" von "${currentTrack.artists[0].name}".`;
        feedbackMessage.style.color = 'red';
        // 0 Punkte, nichts zum Score addieren
    }
    updatePlayerUI(); // Scores aktualisieren
    feedbackMessage.style.display = 'block'; // Zeige Feedback

    // Nächsten Spieler vorbereiten
    if (currentPlayer === 'blue') {
        songsPlayedBlue++;
    } else {
        songsPlayedYellow++;
    }

    // Wartezeit für Feedback, dann nächste Runde starten
    setTimeout(() => {
        startSongRound(); // Startet die nächste Runde
    }, 3000); // 3 Sekunden Wartezeit für Feedback
}

// Funktion für "AUFLÖSEN"
function handleReveal() {
    feedbackMessage.textContent = `Der Song war: "${currentTrack.name}" von "${currentTrack.artists[0].name}".`;
    feedbackMessage.style.color = 'blue'; // Oder eine andere Farbe für Auflösung
    // Bei Auflösung gibt es 0 Punkte, da nicht geraten wurde.
    if (currentPlayer === 'blue') {
        songsPlayedBlue++;
    } else {
        songsPlayedYellow++;
    }
    updatePlayerUI(); // Scores aktualisieren
    feedbackMessage.style.display = 'block';

    guessControls.style.display = 'none'; // Rate-Buttons ausblenden
    trackAttackButton.disabled = true; // TRACK ATTACK Button deaktivieren

    setTimeout(() => {
        startSongRound(); // Startet die nächste Runde
    }, 3000); // 3 Sekunden Wartezeit für Feedback
}

// Funktion zum Zurücksetzen der UI für eine neue Runde
function resetGameRoundUI() {
    playAttempts = 0;
    trackAttackButton.textContent = 'TRACK ATTACK';
    trackAttackButton.disabled = false; // Initial aktiv
    guessControls.style.display = 'none'; // Rate-Buttons verstecken
    feedbackMessage.textContent = '';
    feedbackMessage.style.display = 'none';
    currentTrack = null; // Aktuellen Track zurücksetzen
}

// Funktion zum Starten eines neuen Spiels (vom Game-End-Screen)
function startNewGame() {
    // Alle Spielzustände zurücksetzen
    currentPlayer = 'blue';
    songsPlayedBlue = 0;
    songsPlayedYellow = 0;
    scoreBlue = 0;
    scoreYellow = 0;
    currentRoundScore = 0;
    selectedPlayDuration = 0;
    selectedGenrePlaylists = [];
    currentTrack = null;
    playAttempts = 0;
    currentPlayPosition = 0;

    updatePlayerUI(); // UI auf Startwerte setzen
    showGamemodeSelectionScreen(); // Zurück zur Spielmodus-Auswahl
}

// Block 6: Initialisierung und Event Listener
// Der letzte Block enthält die DOMContentLoaded-Logik, die alle Event Listener einrichtet und den Startpunkt der Anwendung nach dem Laden der Seite definiert.

// --- INITIALISIERUNG BEIM LADEN DER SEITE ---
document.addEventListener('DOMContentLoaded', async () => {
    // Event Listener für Buttons hinzufügen
    if (spotifyLoginButton) {
        spotifyLoginButton.addEventListener('click', redirectToSpotifyAuthorize);
    } else {
        console.error("Login-Button (ID: spotify-login-button) nicht im DOM gefunden.");
    }

    // Event Listener für Spielmodus-Buttons
    gamemodeButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const duration = event.target.dataset.duration;
            if (duration === 'random') {
                // Zufällige Dauer zwischen 2 und 30 Sekunden
                selectedPlayDuration = Math.floor(Math.random() * (30 - 2 + 1) + 2) * 1000;
            } else {
                selectedPlayDuration = parseInt(duration) * 1000;
            }
            console.log(`Spielmodus gewählt: Abspieldauer ${selectedPlayDuration / 1000} Sekunden.`);
            showGenreSelectionScreen(); // Weiter zur Genre-Auswahl
        });
    });

    // Event Listener für den TRACK ATTACK / ATTACK AGAIN Button
    if (trackAttackButton) {
        trackAttackButton.addEventListener('click', handleTrackAttack);
    } else {
        console.error("TRACK ATTACK Button (ID: track-attack-button) nicht im DOM gefunden.");
    }

    // Event Listener für Raten- und Auflösen-Buttons
    if (revealButton) {
        revealButton.addEventListener('click', handleReveal);
    } else {
        console.error("AUFLÖSEN Button (ID: reveal-button) nicht im DOM gefunden.");
    }
    if (correctButton) {
        correctButton.addEventListener('click', () => handleGuess(true)); // Wahr für RICHTIG
    } else {
        console.error("RICHTIG Button (ID: correct-button) nicht im DOM gefunden.");
    }
    if (wrongButton) {
        wrongButton.addEventListener('click', () => handleGuess(false)); // Falsch für FALSCH
    } else {
        console.error("FALSCH Button (ID: wrong-button) nicht im DOM gefunden.");
    }

    // Event Listener für den "NEUES SPIEL STARTEN" Button
    if (nextAttackButton) {
        nextAttackButton.addEventListener('click', startNewGame);
    } else {
        console.error("NEUES SPIEL STARTEN Button (ID: next-attack-button) nicht im DOM gefunden.");
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
        console.log('Authorization Code erhalten, tausche ihn gegen Access Token.');
        await exchangeCodeForTokens(code); // Warten, bis der Token-Austausch abgeschlossen ist
        history.replaceState({}, document.title, REDIRECT_URI); // Saubere URL
        initializeSpotifyPlayer(); // Initialisiere Player
    } else if (localStorage.getItem('access_token') && localStorage.getItem('expires_in') > Date.now()) {
        console.log('Vorhandenen Access Token aus localStorage geladen.');
        accessToken = localStorage.getItem('access_token');
        initializeSpotifyPlayer(); // Initialisiere Player
    } else {
        console.log('Kein gültiger Access Token vorhanden. Zeige Login-Screen.');
        showLoginScreen();
    }
});
