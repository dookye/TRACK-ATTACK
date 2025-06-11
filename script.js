const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';
let accessToken = null;
let player = null;
let deviceId = null;
let isPlayerReady = false;
let currentPlaylistTracks = [];

// === Mehrere Playlisten ===
const playlistIds = [
//    '3Bilb56eeS7db5f3DTEwMR', //disney
    '36UqUEUrE2siIfs7lsWw4x', //raten2
    '2ZnrLLb3q9qEmpzDApzKMe' //raten1
];

let selectedPlaylistId = null;

// === DOM-Elemente ===
const loginBtn = document.getElementById('login-btn');
const startGameBtn = document.getElementById('start-game-btn');
const gameScreen = document.getElementById('game-screen');
const playbackStatus = document.getElementById('playback-status');

// === Spotify Login mit PKCE ===
loginBtn.addEventListener('click', async () => {
    const codeVerifier = generateCodeVerifier(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    localStorage.setItem('code_verifier', codeVerifier);

    const params = new URLSearchParams({
        client_id: 'YOUR_CLIENT_ID',
        response_type: 'code',
        redirect_uri: 'https://dookye.github.io/musik-raten/',
        scope: 'streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state',
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    });

    window.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
});

// === Access Token holen ===
window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        await fetchAccessToken(code);
        await initializePlayer();
    }
};

// === Token holen mit Authorization Code Flow ===
async function fetchAccessToken(code) {
    const codeVerifier = localStorage.getItem('code_verifier');

    const body = new URLSearchParams({
        client_id: '53257f6a1c144d3f929a60d691a0c6f6',
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'YOUR_REDIRECT_URI',
        code_verifier: codeVerifier
    });

    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });

    const data = await response.json();
    accessToken = data.access_token;
    console.log('Access token:', accessToken);
}

// === Web Playback SDK initialisieren ===
async function initializePlayer() {
    await waitForSpotifyWebPlaybackSDK();

    player = new Spotify.Player({
        name: 'Track Attack Player',
        getOAuthToken: cb => cb(accessToken),
        volume: 0.8
    });

    player.addListener('ready', ({ device_id }) => {
        console.log('Player bereit mit Device ID', device_id);
        deviceId = device_id;
        isPlayerReady = true;
        startGameBtn.disabled = false;
    });

    player.addListener('not_ready', ({ device_id }) => {
        console.warn('Gerät nicht bereit:', device_id);
        isPlayerReady = false;
    });

    player.addListener('initialization_error', ({ message }) => {
        console.error('Initialisierungsfehler:', message);
    });

    player.addListener('authentication_error', ({ message }) => {
        console.error('Authentifizierungsfehler:', message);
    });

    player.addListener('account_error', ({ message }) => {
        console.error('Account-Fehler:', message);
    });

    await player.connect();
}

// === Hilfsfunktion: SDK laden ===
function waitForSpotifyWebPlaybackSDK() {
    return new Promise(resolve => {
        if (window.Spotify) {
            resolve();
        } else {
            window.onSpotifyWebPlaybackSDKReady = () => resolve();
        }
    });
}

// === START BUTTON: TRACK ATTACK ===
startGameBtn.addEventListener('click', async () => {
    if (!accessToken || !isPlayerReady) {
        console.warn('Token oder Player nicht bereit');
        return;
    }

    // Zufällige Playlist auswählen
    selectedPlaylistId = playlistIds[Math.floor(Math.random() * playlistIds.length)];
    console.log('Zufällige Playlist:', selectedPlaylistId);

    await getPlaylistTracks(selectedPlaylistId);

    if (currentPlaylistTracks.length > 0) {
        await playFirstTrack();
        showGameScreen();
        playbackStatus.textContent = `🎵 Spielt aus Playlist: ${selectedPlaylistId}`;
    } else {
        playbackStatus.textContent = '❌ Fehler: Playlist leer oder nicht geladen.';
    }
});

// === Playlist-Tracks abrufen ===
async function getPlaylistTracks(playlistId) {
    if (!playlistId) {
        console.warn('Keine Playlist-ID übergeben');
        return;
    }

    const endpoint = `${SPOTIFY_API_BASE_URL}/playlists/${playlistId}/tracks`;
    try {
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Fehler beim Abrufen der Playlist: ${response.status} – ${errorData.error.message}`);
        }

        const data = await response.json();
        currentPlaylistTracks = data.items.filter(item => item.track && item.track.preview_url);
        console.log(`Playlist (${playlistId}) geladen. Tracks:`, currentPlaylistTracks.length);
    } catch (error) {
        console.error('Fehler bei getPlaylistTracks():', error);
        currentPlaylistTracks = [];
    }
}

// === Song zufällig auswählen und abspielen ===
async function playFirstTrack() {
    const track = currentPlaylistTracks[Math.floor(Math.random() * currentPlaylistTracks.length)].track;

    const playEndpoint = `${SPOTIFY_API_BASE_URL}/me/player/play?device_id=${deviceId}`;
    const body = {
        uris: [track.uri],
        position_ms: 0
    };

    try {
        await fetch(playEndpoint, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        setTimeout(() => pausePlayback(), 5000); // 5 Sekunden abspielen
    } catch (error) {
        console.error('Fehler beim Abspielen:', error);
    }
}

// === Wiedergabe pausieren ===
async function pausePlayback() {
    const endpoint = `${SPOTIFY_API_BASE_URL}/me/player/pause?device_id=${deviceId}`;
    try {
        await fetch(endpoint, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
    } catch (error) {
        console.error('Fehler beim Pausieren:', error);
    }
}

// === Spiel-Screen anzeigen ===
function showGameScreen() {
    gameScreen.style.display = 'block';
}
