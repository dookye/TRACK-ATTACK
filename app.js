// --- Grundlegende Daten und Spotify Konfiguration ---
const clientId = '53257f6a1c144d3f929a60d691a0c6f6';
const redirectUri = 'https://dookye.github.io/musik-raten/';
let accessToken = null;
let spotifyPlayer = null;
let currentTrack = null;
let currentPlaybackDuration = 30000; // Standard: 30 Sekunden (Normalo)
let currentGenrePlaylists = [];
let listenAgainCount = 4;
let pointsPerGuess = 5;

// Spielstatus Variablen
let scoreTeam1 = 0;
let scoreTeam2 = 0;
let currentPlayer = 1; // 1 für Team 1, 2 für Team 2
let songsPlayedInRound = 0; // Zählt die gespielten Songs in der aktuellen Runde (insgesamt 20)
let gameStarted = false; // Flag, um den Spielstatus zu verfolgen


// Spotify Playlist IDs
const playlists = {
    'punk-rock': [
        '39sVxPTg7BKwrf2MfgrtcD', // Punk Rock (90's & 00')
        // Platzhalter für weitere Punk Rock Playlists
    ],
    'pop-hits': [
        '6mtYuOxzl58vSGnEDtZ9uB', // Pop Hits 2000-2025
        // Platzhalter für weitere Pop Hits Playlists
    ],
    'all-time-hits': [
        '2si7ChS6Y0hPBt4FsobXpg', // Die größten Hits aller Zeiten
        // Platzhalter für weitere All Time Hits Playlists
    ]
};

// --- DOM Elemente ---
const welcomeScreen = document.getElementById('welcome-screen');
const gameModeScreen = document.getElementById('game-mode-screen');
const genreScreen = document.getElementById('genre-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');

const loginButton = document.getElementById('login-button');
const modeNormaloButton = document.getElementById('mode-normalo');
const modeProButton = document.getElementById('mode-pro');
const modeGeilButton = document.getElementById('mode-geil');

const genrePunkRockButton = document.getElementById('genre-punk-rock');
const genrePopHitsButton = document.getElementById('genre-pop-hits');
const genreAllTimeHitsButton = document.getElementById('genre-all-time-hits');

const scoreTeam1Display = document.getElementById('score-team1');
const scoreTeam2Display = document.getElementById('score-team2');
const scoreTeam1GameDisplay = document.getElementById('score-team1-game');
const scoreTeam2GameDisplay = document.getElementById('score-team2-game');
const currentGenreDisplay = document.getElementById('current-genre-display');
const currentPlayerInfo = document.getElementById('current-player-info');

const trackAttackButton = document.getElementById('track-attack-button');
const listenAgainButton = document.getElementById('listen-again-button');
const revealButton = document.getElementById('reveal-button');
const correctButton = document.getElementById('correct-button');
const wrongButton = document.getElementById('wrong-button');

const songInfoDiv = document.getElementById('song-info');
const songArtistSpan = document.getElementById('song-artist');
const songTitleSpan = document.getElementById('song-title');

const finalScoreTeam1 = document.getElementById('final-score-team1');
const finalScoreTeam2 = document.getElementById('final-score-team2');
const playAgainButton = document.getElementById('play-again-button');

// --- Spotify PKCE Login Flow Funktionen (aus deinem Anhang übernommen) ---

function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function redirectToSpotifyAuth() {
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await sha256(codeVerifier);

    localStorage.setItem('code_verifier', codeVerifier);

    const args = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: 'user-read-playback-state user-modify-playback-state streaming user-read-email user-read-private', // Erforderliche Scopes für Web Playback SDK
        redirect_uri: redirectUri,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    });

    window.location = 'https://accounts.spotify.com/authorize?' + args.toString();
}

async function fetchAccessToken(code) {
    const codeVerifier = localStorage.getItem('code_verifier');

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier
    });

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
        return;
    }

    const data = await response.json();
    accessToken = data.access_token;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', data.refresh_token); // Speichern des Refresh Tokens
    localStorage.setItem('expires_in', Date.now() + data.expires_in * 1000); // Speichern der Ablaufzeit
    console.log('Access Token erhalten:', accessToken);
    initSpotifyPlayer(); // Spotify Player nach erfolgreichem Login initialisieren
}

// Funktion zum Auffrischen des Tokens (optional, aber empfohlen für längere Sessions)
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;

    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId
    });

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
    });

    if (!response.ok) {
        console.error('Fehler beim Auffrischen des Access Tokens:', await response.json());
        // Bei Fehler zum Login zurückleiten
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
    localStorage.setItem('expires_in', Date.now() + data.expires_in * 1000);
    console.log('Access Token erfolgreich aufgefrischt.');
    return true;
}

// --- Spotify Web Playback SDK Initialisierung ---
window.onSpotifyWebPlaybackSDKReady = () => {
    initSpotifyPlayer();
};

async function initSpotifyPlayer() {
    if (!accessToken) {
        console.warn("Kein Access Token verfügbar, Spotify Player kann nicht initialisiert werden.");
        return;
    }

    // Prüfen, ob der Token noch gültig ist, ggf. auffrischen
    const expiresIn = localStorage.getItem('expires_in');
    if (expiresIn && Date.now() >= parseInt(expiresIn) - (60 * 1000)) { // 1 Minute vor Ablauf auffrischen
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            console.error("Token-Refresh fehlgeschlagen, kann Player nicht initialisieren.");
            return;
        }
    }

    spotifyPlayer = new Spotify.Player({
        name: 'TRACK ATTACK Player',
        getOAuthToken: cb => { cb(accessToken); },
        volume: 0.5
    });

    // Ready
    spotifyPlayer.addListener('ready', ({ device_id }) => {
        console.log('Ready with Device ID', device_id);
        // Optional: Automatisch das Gerät aktivieren, wenn der Player bereit ist
        transferPlaybackToDevice(device_id);
    });

    // Not Ready
    spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        console.log('Device ID has gone offline', device_id);
    });

    // Error
    spotifyPlayer.addListener('initialization_error', ({ message }) => { console.error('Initialization Error:', message); });
    spotifyPlayer.addListener('authentication_error', async ({ message }) => {
        console.error('Authentication Error:', message);
        // Bei Authentifizierungsfehler versuchen, Token aufzufrischen oder neu anmelden
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            console.log("Token erneuert, Player neu initialisieren...");
            initSpotifyPlayer();
        } else {
            alert('Ihre Spotify-Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.');
            showScreen(welcomeScreen);
        }
    });
    spotifyPlayer.addListener('account_error', ({ message }) => { console.error('Account Error:', message); });
    spotifyPlayer.addListener('playback_error', ({ message }) => { console.error('Playback Error:', message); });

    // Connect to the player!
    spotifyPlayer.connect();
}

async function transferPlaybackToDevice(deviceId) {
    if (!accessToken) return;

    try {
        await fetch('https://api.spotify.com/v1/me/player', {
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
        console.log('Playback transferred to new device:', deviceId);
    } catch (error) {
        console.error('Fehler beim Übertragen der Wiedergabe auf Gerät:', error);
    }
}

// --- UI Management ---
function showScreen(screenToShow) {
    const screens = [welcomeScreen, gameModeScreen, genreScreen, gameScreen, endScreen];
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    screenToShow.classList.add('active');

    // Scoreboard in Game und Genre Screen aktualisieren
    if (screenToShow === genreScreen || screenToShow === gameScreen) {
        updateScoreDisplays();
        updatePlayerInfo();
    }
}

function updateScoreDisplays() {
    scoreTeam1Display.textContent = scoreTeam1;
    scoreTeam2Display.textContent = scoreTeam2;
    scoreTeam1GameDisplay.textContent = scoreTeam1;
    scoreTeam2GameDisplay.textContent = scoreTeam2;
}

function updatePlayerInfo() {
    currentPlayerInfo.textContent = `Team ${currentPlayer} ist an der Reihe. Wähle ein Genre.`;
}

// --- Spiel Logik ---

async function fetchPlaylistTracks(playlistId) {
    if (!accessToken) {
        console.error('Access Token nicht verfügbar.');
        return [];
    }
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?market=DE`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            if (response.status === 401) {
                 // Token expired, try to refresh
                 const refreshed = await refreshAccessToken();
                 if (refreshed) {
                     return fetchPlaylistTracks(playlistId); // Retry after refresh
                 }
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        // Filtern, um nur Tracks mit Vorschau-URL (preview_url) zu erhalten, falls nötig
        // Das Web Playback SDK kann jedoch auch vollständige Tracks spielen, wenn Premium-User angemeldet ist.
        // Wir verlassen uns hier auf das SDK für die Wiedergabe des vollen Tracks.
        return data.items.filter(item => item.track && item.track.uri).map(item => item.track);
    } catch (error) {
        console.error('Fehler beim Abrufen der Playlist-Tracks:', error);
        return [];
    }
}

async function playRandomSong() {
    if (!spotifyPlayer || !accessToken) {
        alert('Spotify Player ist nicht bereit oder Sie sind nicht angemeldet.');
        return;
    }

    if (currentGenrePlaylists.length === 0) {
        alert('Bitte wählen Sie zuerst ein Genre aus.');
        return;
    }

    const allTracks = [];
    for (const pId of currentGenrePlaylists) {
        const tracks = await fetchPlaylistTracks(pId);
        allTracks.push(...tracks);
    }

    if (allTracks.length === 0) {
        alert('Keine Songs in den ausgewählten Playlists gefunden oder Fehler beim Laden.');
        return;
    }

    const randomTrackIndex = Math.floor(Math.random() * allTracks.length);
    currentTrack = allTracks[randomTrackIndex];

    if (!currentTrack || !currentTrack.uri) {
        console.error("Ausgewählter Track hat keine URI:", currentTrack);
        alert("Fehler: Konnte keinen spielbaren Song finden.");
        return;
    }

    const deviceId = spotifyPlayer._options.id;
    if (!deviceId) {
        alert('Spotify Player-Gerät nicht gefunden. Stellen Sie sicher, dass Spotify geöffnet ist.');
        console.error('Spotify Player-Gerät ID nicht verfügbar.');
        return;
    }

    let startMs = 0;
    if (currentTrack.duration_ms) {
        // Start an zufälliger Stelle, aber mindestens 5 Sekunden vor Ende
        startMs = Math.floor(Math.random() * (currentTrack.duration_ms - Math.min(5000, currentTrack.duration_ms - 1000)));
        if (startMs < 0) startMs = 0; // Sicherstellen, dass startMs nicht negativ ist
    }

    try {
        await spotifyPlayer.play({
            uris: [currentTrack.uri],
            position_ms: startMs,
            device_id: deviceId
        });
        console.log(`Playing: ${currentTrack.name} by ${currentTrack.artists[0].name} from ${startMs}ms`);

        // Timer zum Stoppen der Wiedergabe nach Spieldauer
        setTimeout(async () => {
            if (spotifyPlayer) {
                await spotifyPlayer.pause();
                console.log('Playback paused.');
            }
        }, currentPlaybackDuration);

    } catch (error) {
        console.error("Fehler beim Abspielen des Songs:", error);
        alert("Fehler beim Abspielen des Songs. Stellen Sie sicher, dass Ihr Spotify Premium-Konto aktiv ist und Spotify geöffnet ist.");
    }
}

async function listenAgain() {
    if (!currentTrack || !spotifyPlayer) {
        alert('Kein Song zum erneuten Hören verfügbar.');
        return;
    }

    listenAgainCount--;
    listenAgainButton.textContent = `NOCHMAL HÖREN (${listenAgainCount})`;
    pointsPerGuess = Math.max(0, pointsPerGuess - 1); // Punkte reduzieren, aber nicht unter 0

    // Neue zufällige Startposition
    let startMs = 0;
    if (currentTrack.duration_ms) {
        startMs = Math.floor(Math.random() * (currentTrack.duration_ms - Math.min(5000, currentTrack.duration_ms - 1000)));
        if (startMs < 0) startMs = 0;
    }

    try {
        const deviceId = spotifyPlayer._options.id;
        await spotifyPlayer.play({
            uris: [currentTrack.uri],
            position_ms: startMs,
            device_id: deviceId
        });
        console.log(`Re-playing: ${currentTrack.name} from ${startMs}ms`);

        setTimeout(async () => {
            if (spotifyPlayer) {
                await spotifyPlayer.pause();
            }
        }, currentPlaybackDuration);

        if (listenAgainCount === 0) {
            listenAgainButton.disabled = true;
        }
    } catch (error) {
        console.error("Fehler beim erneuten Abspielen des Songs:", error);
        alert("Fehler beim erneuten Abspielen des Songs.");
    }
}

function revealSongInfo() {
    if (currentTrack) {
        songArtistSpan.textContent = currentTrack.artists.map(artist => artist.name).join(', ');
        songTitleSpan.textContent = currentTrack.name;
        songInfoDiv.classList.remove('hidden');
        trackAttackButton.disabled = true; // Button deaktivieren
        listenAgainButton.disabled = true; // Button deaktivieren
        revealButton.disabled = true; // Button deaktivieren
        correctButton.disabled = false; // RICHTIG/FALSCH aktivieren
        wrongButton.disabled = false; // RICHTIG/FALSCH aktivieren
    }
}

function finishTurn() {
    songsPlayedInRound++;
    resetGameButtons();
    songInfoDiv.classList.add('hidden'); // Song Info wieder verstecken

    // Spielerwechsel
    currentPlayer = currentPlayer === 1 ? 2 : 1;

    if (songsPlayedInRound >= 20) {
        // Spiel beendet
        showEndScreen();
    } else {
        // Nächster Spieler wählt Genre
        showScreen(genreScreen);
    }
}

function resetGameButtons() {
    trackAttackButton.textContent = 'TRACK ATTACK';
    trackAttackButton.disabled = false;
    listenAgainButton.textContent = 'NOCHMAL HÖREN (4)';
    listenAgainButton.classList.add('hidden');
    listenAgainButton.disabled = true;
    revealButton.classList.add('hidden');
    revealButton.disabled = true;
    correctButton.classList.add('hidden');
    correctButton.disabled = true;
    wrongButton.classList.add('hidden');
    wrongButton.disabled = true;

    listenAgainCount = 4; // Zähler zurücksetzen
    pointsPerGuess = 5; // Punkte zurücksetzen
    currentTrack = null; // Aktuellen Track zurücksetzen
}

function showEndScreen() {
    finalScoreTeam1.textContent = scoreTeam1;
    finalScoreTeam2.textContent = scoreTeam2;
    showScreen(endScreen);
}

function restartGame() {
    scoreTeam1 = 0;
    scoreTeam2 = 0;
    currentPlayer = 1;
    songsPlayedInRound = 0;
    resetGameButtons();
    showScreen(gameModeScreen);
}

// --- Event Listeners ---
loginButton.addEventListener('click', redirectToSpotifyAuth);

modeNormaloButton.addEventListener('click', () => {
    currentPlaybackDuration = 30000;
    showScreen(genreScreen);
    gameStarted = true;
    updatePlayerInfo();
});

modeProButton.addEventListener('click', () => {
    currentPlaybackDuration = 10000;
    showScreen(genreScreen);
    gameStarted = true;
    updatePlayerInfo();
});

modeGeilButton.addEventListener('click', () => {
    currentPlaybackDuration = 2000;
    showScreen(genreScreen);
    gameStarted = true;
    updatePlayerInfo();
});

genrePunkRockButton.addEventListener('click', () => {
    currentGenrePlaylists = playlists['punk-rock'];
    currentGenreDisplay.textContent = 'Genre: Punk Rock (90\'s & 00\')';
    showScreen(gameScreen);
});

genrePopHitsButton.addEventListener('click', () => {
    currentGenrePlaylists = playlists['pop-hits'];
    currentGenreDisplay.textContent = 'Genre: Pop Hits 2000-2025';
    showScreen(gameScreen);
});

genreAllTimeHitsButton.addEventListener('click', () => {
    currentGenrePlaylists = playlists['all-time-hits'];
    currentGenreDisplay.textContent = 'Genre: Die größten Hits aller Zeiten';
    showScreen(gameScreen);
});


trackAttackButton.addEventListener('click', async () => {
    trackAttackButton.disabled = true;
    listenAgainButton.classList.remove('hidden');
    listenAgainButton.disabled = false;
    revealButton.classList.remove('hidden');
    revealButton.disabled = false; // "AUFLÖSEN" nach dem ersten Abspielen aktivieren
    await playRandomSong();
    trackAttackButton.textContent = 'NOCHMAL HÖREN'; // Ändert sich nach dem ersten Klick
});

listenAgainButton.addEventListener('click', listenAgain);
revealButton.addEventListener('click', revealSongInfo);

correctButton.addEventListener('click', () => {
    if (currentPlayer === 1) {
        scoreTeam1 += pointsPerGuess;
    } else {
        scoreTeam2 += pointsPerGuess;
    }
    updateScoreDisplays();
    finishTurn();
});

wrongButton.addEventListener('click', () => {
    // Falsch geraten gibt 0 Punkte, 
