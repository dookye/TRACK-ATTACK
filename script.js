// --- Global Variables ---
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6';
const REDIRECT_URI = 'https://dookye.github.io/TRACK-ATTACK/';
const SCOPES = 'streaming user-read-email user-read-private';

let accessToken = '';
let codeVerifier = '';
let player = null; // Spotify Web Playback SDK player object
let currentDeviceId = '';
let currentVolume = 0.5;

let isFullscreen = false;
let isOrientationCorrect = false;
let initialAnimationShown = sessionStorage.getItem('initialAnimationShown') === 'true';

const app = document.getElementById('app');
const loginScreen = document.getElementById('login-screen');
const loginButton = document.getElementById('login-button');
const orientationOverlay = document.getElementById('orientation-overlay');
const fullscreenScreen = document.getElementById('fullscreen-screen');
const gameStartScreen = document.getElementById('game-start-screen');
const logoButton = document.getElementById('logo-button');

// Screen elements for later phases
const diceScreen = document.getElementById('dice-screen');
const diceAnimation = document.getElementById('dice-animation');
const diceButtonsContainer = document.getElementById('dice-buttons');
const genreScreen = document.getElementById('genre-screen');
const genreButtonsContainer = document.getElementById('genre-buttons-container');
const guessScreen = document.getElementById('guess-screen');
const guessLogoButton = document.getElementById('guess-logo-button');
const revealButton = document.getElementById('reveal-button');
const songInfo = document.getElementById('song-info');
const albumCover = document.getElementById('album-cover');
const songTitle = document.getElementById('song-title');
const songArtist = document.getElementById('song-artist');
const judgementButtons = document.getElementById('judgement-buttons');
const correctButton = document.getElementById('correct-button');
const wrongButton = document.getElementById('wrong-button');
const scoreScreen = document.getElementById('score-screen');
const player1ScoreDisplay = document.querySelector('.player1-score');
const player2ScoreDisplay = document.querySelector('.player2-score');
const speedRoundOverlay = document.getElementById('speed-round-overlay');
const speedRoundText = document.getElementById('speed-round-text');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');


// Game State Variables
let currentPlayer = 1; // 1 or 2
let currentRound = 1; // Max 10 rounds per player
let player1Score = 0;
let player2Score = 0;
let diceValue = 0;
let attemptsMade = 0;
let currentSongUri = '';
let currentSongDuration = 0; // ms
let currentSongPlaybackStartTime = 0; // ms
let currentGenrePlaylists = [];

const GENRES = {
    'Punk Rock (90\'s & 00\')': ['39sVxPTg7BKwrf2MfgrtcD', '7ITmaFa2rOhXAmKmUUCG9E'],
    'Pop Hits 2000-2025': ['6mtYuOxzl58vSGnEDtZ9uB', '34NbomaTu7YuOYnky8nLXL'],
    'Die größten Hits aller Zeiten': ['2si7ChS6Y0hPBt4FsobXpg', '2y09fNnXHvoqc1WGHvbhkZ'],
    'Disney Songs': ['3Bilb56eeS7db5f3DTEwMR', '2bhbwexk7c6yJrEB4CtuY8']
};

let player1SpeedRound = Math.floor(Math.random() * 10) + 1;
let player2SpeedRound = Math.floor(Math.random() * 10) + 1;


// --- Utility Functions ---

function showScreen(screenElement) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    screenElement.classList.add('active');
}

function showOverlay(overlayElement) {
    document.querySelectorAll('.overlay').forEach(overlay => {
        overlay.classList.remove('active');
    });
    overlayElement.classList.add('active');
}

function hideOverlay(overlayElement) {
    overlayElement.classList.remove('active');
}

// PKCE Functions
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.map(byte => possible[byte % possible.length]).join('');
}

function sha256(plain) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    return window.crypto.subtle.digest('SHA-256', data);
}

function base64encode(input) {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

async function generateCodeChallenge(codeVerifier) {
    const hashed = await sha256(codeVerifier);
    return base64encode(hashed);
}

// --- Phase 1: Authentication & Device Setup ---

// Step 1.1: Enforce Spotify Login
async function redirectToSpotifyAuth() {
    codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const authUrl = new URL("https://accounts.spotify.com/authorize");
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

async function handleSpotifyCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        try {
            // Retrieve code_verifier from sessionStorage if it was stored
            const storedCodeVerifier = sessionStorage.getItem('spotify_code_verifier');
            if (!storedCodeVerifier) {
                console.error("Code verifier not found in session storage.");
                // Fallback or error handling if code verifier is missing
                alert("Login error: Missing code verifier. Please try again.");
                showScreen(loginScreen); // Go back to login
                return;
            }
            codeVerifier = storedCodeVerifier; // Use the retrieved code verifier

            const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
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
                }),
            });

            const data = await tokenResponse.json();
            if (data.access_token) {
                accessToken = data.access_token;
                sessionStorage.setItem('spotify_access_token', accessToken);
                // Clear the code from the URL and remove code verifier from session storage
                window.history.replaceState({}, document.title, REDIRECT_URI);
                sessionStorage.removeItem('spotify_code_verifier');
                initializeSpotifySDK();
                // Proceed to orientation check after successful login
                checkOrientationAndProceed();
            } else {
                console.error('Failed to get access token:', data);
                alert('Spotify-Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.');
                showScreen(loginScreen); // Stay on login screen
            }
        } catch (error) {
            console.error('Error during token exchange:', error);
            alert('Ein Fehler ist bei der Anmeldung aufgetreten. Bitte versuchen Sie es erneut.');
            showScreen(loginScreen); // Stay on login screen
        }
    } else {
        // No code in URL, meaning it's either first visit or a failed login attempt without a code
        const storedToken = sessionStorage.getItem('spotify_access_token');
        if (storedToken) {
            accessToken = storedToken;
            initializeSpotifySDK();
            checkOrientationAndProceed();
        } else {
            showScreen(loginScreen);
        }
    }
}


// Step 1.2: Enforce Device Orientation
function checkOrientation() {
    if (window.innerWidth < window.innerHeight) {
        // Portrait mode
        isOrientationCorrect = false;
        showOverlay(orientationOverlay);
        hideOverlay(fullscreenScreen); // Hide fullscreen prompt if portrait
    } else {
        // Landscape mode
        isOrientationCorrect = true;
        hideOverlay(orientationOverlay);
        if (accessToken && !isFullscreen) {
            showScreen(fullscreenScreen);
        } else if (accessToken && isFullscreen) {
            // If already in fullscreen and landscape, proceed to game start or next step
            proceedAfterSetup();
        }
    }
}

function checkOrientationAndProceed() {
    // Check immediately
    checkOrientation();

    // Set up continuous checking
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
}

// Step 1.3: Enforce Fullscreen Mode
function requestFullscreen() {
    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) { /* Firefox */
        document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) { /* Chrome, Safari & Opera */
        document.documentElement.webkitRequestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) { /* IE/Edge */
        document.documentElement.msRequestFullscreen();
    }
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { /* Firefox */
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { /* Chrome, Safari and Opera */
        document.documentElement.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE/Edge */
        document.documentElement.msExitFullscreen();
    }
}

function handleFullscreenChange() {
    if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
        isFullscreen = true;
        hideOverlay(fullscreenScreen);
        // Once fullscreen and orientation is correct, proceed to initial animation
        proceedAfterSetup();
    } else {
        isFullscreen = false;
        // If not fullscreen and orientation is correct, show fullscreen prompt again
        if (isOrientationCorrect && accessToken) {
            showScreen(fullscreenScreen);
        }
    }
}

function proceedAfterSetup() {
    if (accessToken && isOrientationCorrect && isFullscreen) {
        if (!initialAnimationShown) {
            showInitialAnimation();
        } else {
            showScreen(gameStartScreen);
            logoButton.classList.remove('inactive'); // Ensure logo is active for new game
        }
    }
}


// Step 1.4: One-time Welcome Animation
function showInitialAnimation() {
    showScreen(gameStartScreen);
    logoButton.classList.remove('inactive'); // Ensure it's clickable
    logoButton.classList.add('bounce');
    logoButton.style.backgroundImage = 'url("logo3.png")'; // Set logo image

    logoButton.addEventListener('animationend', () => {
        logoButton.classList.remove('bounce');
        initialAnimationShown = true;
        sessionStorage.setItem('initialAnimationShown', 'true');
    }, { once: true }); // Ensure this only runs once per animation
}


// --- Spotify Web Playback SDK Initialization ---
function initializeSpotifySDK() {
    return new Promise((resolve, reject) => {
        window.onSpotifyWebPlaybackSDKReady = () => {
            player = new Spotify.Player({
                name: 'TRACK ATTACK Player',
                getOAuthToken: cb => { cb(accessToken); },
                volume: currentVolume
            });

            // Ready
            player.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);
                currentDeviceId = device_id;
                resolve();
            });

            // Not Ready
            player.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
                reject('Device not ready');
            });

            // Playback Error
            player.addListener('playback_error', ({ message }) => {
                console.error('Playback error:', message);
                alert('Ein Wiedergabefehler ist aufgetreten. Bitte versuchen Sie es erneut.');
            });

            // Account Error
            player.addListener('account_error', ({ message }) => {
                console.error('Account error:', message);
                alert('Probleme mit Ihrem Spotify-Premium-Konto. Bitte überprüfen Sie es.');
            });

            // Autoplay blocked
            player.addListener('autoplay_failed', () => {
                console.log('Autoplay is not allowed by the browser');
                alert('Autoplay wurde blockiert. Bitte klicken Sie, um die Wiedergabe zu starten.');
            });

            player.connect().then(success => {
                if (success) {
                    console.log('The Web Playback SDK successfully connected to Spotify!');
                } else {
                    console.error('Failed to connect to Spotify Web Playback SDK.');
                    reject('Failed to connect to SDK');
                }
            });
        };
    });
}

// --- Event Listeners ---
loginButton.addEventListener('click', () => {
    sessionStorage.setItem('spotify_code_verifier', codeVerifier); // Store code verifier before redirect
    redirectToSpotifyAuth();
});

fullscreenScreen.addEventListener('click', requestFullscreen);

document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

window.addEventListener('load', () => {
    handleSpotifyCallback(); // Check for Spotify callback on load
});

// Initial orientation check
checkOrientation();


// --- Placeholder Functions for Future Phases (to prevent errors) ---

function startGame() {
    console.log('Game started!');
    logoButton.classList.add('inactive'); // Deactivate logo button
    app.style.backgroundColor = 'var(--player1-color)'; // Change background to blue for Player 1
    setTimeout(() => {
        showDiceScreen();
    }, 800); // Wait for bounce animation to finish + a little more
}

function showDiceScreen() {
    showScreen(diceScreen);
    diceAnimation.classList.remove('hidden');
    diceButtonsContainer.classList.add('hidden');
    setTimeout(() => {
        diceAnimation.classList.add('hidden');
        diceButtonsContainer.classList.remove('hidden');
    }, 4000);
}

function showGenreScreen() {
    showScreen(genreScreen);
    renderGenreButtons();
}

function showGuessScreen() {
    showScreen(guessScreen);
    guessLogoButton.classList.remove('inactive'); // Make play button active
    revealButton.classList.add('hidden');
    songInfo.classList.add('hidden');
    judgementButtons.classList.add('hidden');
}

function showScoreScreen() {
    showScreen(scoreScreen);
    player1ScoreDisplay.textContent = player1Score;
    player2ScoreDisplay.textContent = player2Score;
    setTimeout(() => {
        resetGame();
    }, 7000);
}

function renderGenreButtons() {
    genreButtonsContainer.innerHTML = ''; // Clear previous buttons
    for (const genreName in GENRES) {
        const button = document.createElement('button');
        button.classList.add('genre-button');
        button.textContent = genreName;
        button.dataset.genre = genreName;
        genreButtonsContainer.appendChild(button);
        button.addEventListener('click', handleGenreSelection);
    }
}

function handleGenreSelection(event) {
    const selectedGenre = event.target.dataset.genre;
    console.log('Selected genre:', selectedGenre);
    currentGenrePlaylists = GENRES[selectedGenre];
    if (diceValue === 7) {
        // Player chooses genre directly for dice 7
        showGuessScreen();
    } else {
        // Random genre selection for other dice values
        startRandomGenreAnimation();
    }
}

function startRandomGenreAnimation() {
    // Implement random genre selection animation
    let interval;
    let counter = 0;
    const genreButtons = document.querySelectorAll('.genre-button');
    const animationDuration = 4000; // 4 seconds

    interval = setInterval(() => {
        genreButtons.forEach(button => button.classList.add('inactive'));
        const randomIndex = Math.floor(Math.random() * genreButtons.length);
        genreButtons[randomIndex].classList.remove('inactive');
        counter += 100;
        if (counter >= animationDuration) {
            clearInterval(interval);
            // After animation, randomly select one and keep it active
            genreButtons.forEach(button => button.classList.add('inactive'));
            const finalRandomIndex = Math.floor(Math.random() * genreButtons.length);
            genreButtons[finalRandomIndex].classList.remove('inactive');
            genreButtons[finalRandomIndex].classList.remove('inactive'); // Make it truly active again
            console.log("Randomly selected genre:", genreButtons[finalRandomIndex].dataset.genre);
            currentGenrePlaylists = GENRES[genreButtons[finalRandomIndex].dataset.genre]; // Set the selected genre
        }
    }, 100); // Blink every 100ms
}


diceButtonsContainer.addEventListener('click', (event) => {
    const target = event.target.closest('.dice-choice-button');
    if (target) {
        diceValue = parseInt(target.dataset.dice);
        console.log('Dice value:', diceValue);
        showGenreScreen();
    }
});

guessLogoButton.addEventListener('click', () => {
    console.log('Play song!');
    guessLogoButton.classList.add('bounce');
    guessLogoButton.addEventListener('animationend', () => {
        guessLogoButton.classList.remove('bounce');
    }, { once: true });
    // In a real scenario, this would play the song and manage attempts
    if (player) {
        playRandomSongSnippet();
    }
});

revealButton.addEventListener('click', () => {
    // In a real scenario, this would reveal song info
    songInfo.classList.remove('hidden');
    judgementButtons.classList.remove('hidden');
    revealButton.classList.add('hidden');
    guessLogoButton.classList.add('inactive'); // Deactivate play button after revealing
    console.log('Reveal song info!');
});

correctButton.addEventListener('click', () => {
    const points = calculatePoints(diceValue, attemptsMade);
    if (currentPlayer === 1) {
        player1Score += points;
    } else {
        player2Score += points;
    }
    console.log(`Player ${currentPlayer} got ${points} points. Total: P1=${player1Score}, P2=${player2Score}`);
    nextRound();
});

wrongButton.addEventListener('click', () => {
    console.log(`Player ${currentPlayer} got 0 points.`);
    nextRound();
});

function calculatePoints(diceValue, attemptsMade) {
    const points = diceValue - (attemptsMade - 1);
    return Math.max(1, points); // Minimum 1 point
}

function nextRound() {
    attemptsMade = 0; // Reset attempts for next round
    app.style.backgroundColor = currentPlayer === 1 ? 'var(--player2-color)' : 'var(--player1-color)';
    setTimeout(() => {
        if (currentPlayer === 1) {
            currentPlayer = 2;
        } else {
            currentPlayer = 1;
            currentRound++;
        }

        if (currentRound > 10) { // 10 rounds per player means 20 songs played
            showScoreScreen();
        } else {
            showDiceScreen(); // Back to dice screen for the next player/round
        }
    }, 500); // Allow background transition
}

function resetGame() {
    app.style.backgroundColor = 'black';
    currentPlayer = 1;
    currentRound = 1;
    player1Score = 0;
    player2Score = 0;
    diceValue = 0;
    attemptsMade = 0;
    initialAnimationShown = true; // No animation on reset
    sessionStorage.setItem('initialAnimationShown', 'true');
    showScreen(gameStartScreen);
    logoButton.classList.remove('inactive');
    player1SpeedRound = Math.floor(Math.random() * 10) + 1;
    player2SpeedRound = Math.floor(Math.random() * 10) + 1;
    console.log(`New game. Player 1 speed round: ${player1SpeedRound}, Player 2 speed round: ${player2SpeedRound}`);
}

// Function to play a random song snippet (Mock-up for now)
async function playRandomSongSnippet() {
    if (!player || !currentDeviceId || currentGenrePlaylists.length === 0) {
        console.error("Player not ready or no genre selected.");
        alert("Bitte warten Sie, bis der Spotify-Player bereit ist, oder wählen Sie ein Genre aus.");
        return;
    }

    guessLogoButton.classList.add('inactive'); // Disable button while playing

    try {
        // Pick a random playlist from the selected genre
        const randomPlaylistId = currentGenrePlaylists[Math.floor(Math.random() * currentGenrePlaylists.length)];
        const playlistUrl = `https://api.spotify.com/v1/playlists/${randomPlaylistId}/tracks?limit=50`;

        const response = await fetch(playlistUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const data = await response.json();
        const tracks = data.items.map(item => item.track).filter(track => track && track.preview_url); // Filter for tracks with preview URLs

        if (tracks.length === 0) {
            console.warn("No playable tracks found in the selected playlist.");
            alert("Keine abspielbaren Songs in dieser Wiedergabeliste gefunden. Bitte versuchen Sie es mit einem anderen Genre.");
            guessLogoButton.classList.remove('inactive');
            return;
        }

        const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
        currentSongUri = randomTrack.uri;
        currentSongDuration = (diceValue === 7) ? 2000 : 7000; // 2 seconds for dice 7, 7 seconds otherwise

        // Seek to a random position within the first 30 seconds (Spotify preview limit)
        const maxSeekPosition = Math.min(25000, randomTrack.duration_ms - currentSongDuration); // Ensure we don't go past song end
        currentSongPlaybackStartTime = Math.floor(Math.random() * maxSeekPosition);

        player.play({
            uris: [currentSongUri],
            position_ms: currentSongPlaybackStartTime,
            device_id: currentDeviceId
        }).then(() => {
            console.log(`Playing ${randomTrack.name} by ${randomTrack.artists[0].name} from ${currentSongPlaybackStartTime}ms for ${currentSongDuration}ms`);
            attemptsMade++;

            setTimeout(async () => {
                await player.pause();
                console.log("Song snippet paused.");
                if (attemptsMade < diceValue) { // If attempts left, make button active
                    guessLogoButton.classList.remove('inactive');
                } else {
                    guessLogoButton.classList.add('inactive'); // No more attempts
                }
                revealButton.classList.remove('hidden'); // Show reveal button after first listen
            }, currentSongDuration);
        }).catch(e => {
            console.error("Error playing song:", e);
            alert("Fehler beim Abspielen des Songs. Bitte versuchen Sie es erneut.");
            guessLogoButton.classList.remove('inactive');
        });

    } catch (error) {
        console.error("Error fetching playlist tracks:", error);
        alert("Fehler beim Laden der Songs. Bitte versuchen Sie es erneut.");
        guessLogoButton.classList.remove('inactive');
    }
}


// --- Game Start Trigger ---
logoButton.addEventListener('click', () => {
    logoButton.classList.add('bounce');
    logoButton.addEventListener('animationend', () => {
        logoButton.classList.remove('bounce');
        startGame();
    }, { once: true });
});
