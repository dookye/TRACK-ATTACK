// Wichtiger Hinweis: Dieser Code muss von einem Webserver bereitgestellt werden (z.B. über "Live Server" in VS Code).
// Ein direktes Öffnen der HTML-Datei im Browser funktioniert wegen der Sicherheitsrichtlinien (CORS) bei API-Anfragen nicht.

document.addEventListener('DOMContentLoaded', () => {
    // =======================================================================
    // 1. KONSTANTEN & VARIABLEN
    // =======================================================================

    // --- API Endpunkte ---
    const API_ENDPOINTS = {
        SPOTIFY_AUTH: 'https://accounts.spotify.com/authorize',
        SPOTIFY_TOKEN: 'https://accounts.spotify.com/api/token',
        SPOTIFY_PLAYLIST_TRACKS: (playlistId) => `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        SPOTIFY_PLAYER_PLAY: (deviceId) => `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
    };

    // --- Spielkonstanten ---
    const CLIENT_ID = "53257f6a1c144d3f929a60d691a0c6f6";
    const REDIRECT_URI = "https://dookye.github.io/TRACK-ATTACK/";
    const TOTAL_ROUNDS = 20;
    const LOGIN_TIMEOUT_MS = 500;
    const DICE_ANIMATION_MS = 2000;
    const GAME_START_DELAY_MS = 800;
    const RESOLUTION_DELAY_MS = 200;
    const FADE_OUT_DURATION_MS = 500;
    const FADE_IN_DURATION_MS = 2000;
    const POINTS_ANIMATION_POP_IN_MS = 300;
    const POINTS_ANIMATION_FLY_MS = 500;
    const SCORE_SCREEN_DISPLAY_MS = 8000;
    const SPEED_ROUND_ANIMATION_MS = 3500;
    const SPEED_ROUND_TIMER_MS = 7000;

    const digitalDiceImages = {
        1: 'assets/digi-1.png',
        2: 'assets/digi-2.png',
        3: 'assets/digi-3.png',
        4: 'assets/digi-4.png',
        5: 'assets/digi-5.png',
        7: 'assets/digi-ta.png'
    };
    const digitalDiceAnimationGif = 'assets/digi-ani.gif';
    const digitalDiceStartImage = 'assets/digi-ta.png';
    const DICE_POSSIBLE_VALUES = [1, 2, 3, 4, 5, 7];

    // Konfiguration für jeden Würfelwert
    const diceConfig = {
        1: { attempts: 1, duration: 7000 },
        2: { attempts: 2, duration: 7000 },
         3: { attempts: 3, duration: 7000 },
        4: { attempts: 4, duration: 7000 },
        5: { attempts: 5, duration: 7000 },
        7: { attempts: 7, duration: 2000 }
    };

    const playlists = {
        'pop hits 2000-2025': ['6mtYuOxzl58vSGnEDtZ9uB', '34NbomaTu7YuOYnky8nLXL'],
        'die größten hits aller zeiten': ['2si7ChS6Y0hPBt4FsobXpg', '2y09fNnXHvoqc1WGHvbhkZ'],
        'deutsch songs von früher bis heute': ['7h64UGKHGWM5ucefn99frR', '4ytdW13RHl5u9dbRWAgxSZ'],
        'party hits': ['53r5W67KJNIeHWAhVOWPDr'],
        'skate-punk': ['7qGvinYjBfVpl1FJFkzGqV', '77IXl4Gh7AZLyVLx66NkqV'],
        'deutsch-punk': ['3sQLh9hYyJQZ0qWrtJG1OO', '4iR7Xq1wP9GRbGLm2qFBYw'],
        'top 100 one hit wonders': ['1t1iRfYh9is6FH6hvn58lt'],
        'girl- and boybands': ['11Q0O9t6MGGXrKFaeqRRwm'],
        'deutsche disney-songs': ['6CdPoZsFja4LOrTYTvHrY5'],
        'lagerfeuer klassiker': ['3TfJ6iMeqPXPLW8sxuQgcd'],
        'rock songs': ['6QrVkClF1eJSjb9FDfqtJ8'],
        rocklegenden: ['3sdqSseSnwb4A0RqP93SUH'],
        'alte schlagerschoten': ['68SxsyVUJ1DEGByUcEMrr4', '7dmg14Fnm9stKYkU4IthAG'],
        lovesongs: ['6oNsYDhN95gkENsdFcAwTh'],
        'serien unserer kindheit': ['1De2vLmWkrNE11JjrC8OTj', '2Gg5uCtOsdZ9UShBCp3Ekt'],
        'deutscher hip hop': ['1bG3S6G5BmmgN08EBDfzE5', '54Ac6qneIdV0VEXewKyI3W'],
        'internationale rapsongs': ['0h8A0Qt4TD2cl74CrgldWj'],
        'deutscher pop-sommer 2025': ['6Aq2xcWvFXBoExv64eGm5o']
    };

    // --- DOM-Elemente ---
    const dom = {
        appContainer: document.getElementById('app-container'),
        loginScreen: document.getElementById('login-screen'),
        gameScreen: document.getElementById('game-screen'),
        rotateDeviceOverlay: document.getElementById('rotate-device-overlay'),
        logoButton: document.getElementById('logo-button'),
        diceContainer: document.getElementById('dice-container'),
        diceAnimation: document.getElementById('dice-animation'),
        diceSelection: document.getElementById('dice-selection'),
        genreContainer: document.getElementById('genre-container'),
        revealButton: document.getElementById('reveal-button'),
        revealContainer: document.getElementById('reveal-container'),
        scoreScreen: document.getElementById('score-screen'),
        speedRoundTextDisplay: document.getElementById('speed-round-text-display'),
        speedRoundTimer: document.getElementById('speed-round-timer'),
        countdownDisplay: document.getElementById('countdown-display'),
        trackAlbum: document.getElementById('track-album'),
        trackYear: document.getElementById('track-year'),
        correctButton: document.getElementById('correct-button'),
        wrongButton: document.getElementById('wrong-button'),
        tokenTimer: document.getElementById('token-timer'),
        digitalDiceArea: document.getElementById('digital-dice-area'),
        digitalDiceMainImage: document.getElementById('digital-dice-main-image'),
        startGenreSelectionContainer: document.getElementById('start-genre-selection-container'),
        allGenresScrollbox: document.getElementById('all-genres-scrollbox'),
        digitalDiceSound: document.getElementById('digital-dice-sound'),
        logoFlyInSound: document.getElementById('logo-fly-in-sound'),
        loadingOverlay: document.getElementById('loading-overlay')
    };

    // --- Spielstatus-Variablen ---
    let spotifyPlayer;
    let deviceId;
    let accessToken;
    let lastGameScreenVisible = '';
    let gameState = {
        player1Score: 0,
        player2Score: 0,
        currentPlayer: 1,
        totalRounds: TOTAL_ROUNDS,
        currentRound: 0,
        diceValue: 0,
        attemptsMade: 0,
        maxAttempts: 0,
        trackDuration: 0,
        currentTrack: null,
        player1SpeedRound: Math.floor(Math.random() * 10) + 1,
        player2SpeedRound: Math.floor(Math.random() * 10) + 1,
        isSpeedRound: false,
        timeouts: {
            speedRound: null,
            spotifyPlay: null,
            diceAnimation: null,
            scoreScreen: null
        },
        intervals: {
            countdown: null,
            fade: null
        },
        isSongPlaying: false,
        currentSongVolume: 0,
        selectedPlayableGenres: [],
    };

    // =======================================================================
    // 2. INITIALISIERUNG & SETUP
    // =======================================================================

    function init() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
            window.history.pushState({}, '', REDIRECT_URI);
            dom.loadingOverlay.classList.remove('hidden');
            getAccessToken(code).then(token => {
                accessToken = token;
                dom.loginScreen.classList.add('hidden');
                initializePlayer();
                startTokenTimer();
                setTimeout(() => {
                    dom.loadingOverlay.classList.add('hidden');
                    window.addEventListener('resize', checkOrientation);
                    checkOrientation();
                }, LOGIN_TIMEOUT_MS);
            }).catch(error => {
                dom.loadingOverlay.classList.add('hidden');
                console.error("Fehler beim Abrufen des Access Tokens:", error);
                alert("Anmeldung bei Spotify fehlgeschlagen. Bitte versuchen Sie es erneut.");
                dom.loginScreen.classList.remove('hidden');
                setupLoginButton();
            });
        } else {
            dom.loginScreen.classList.remove('hidden');
            setupLoginButton();
        }
        setupEventListeners();
    }

    function setupLoginButton() {
        const loginButton = document.getElementById('login-button');
        loginButton.removeEventListener('click', redirectToAuthCodeFlow);
        loginButton.addEventListener('click', redirectToAuthCodeFlow);
    }

    function setupEventListeners() {
        dom.digitalDiceMainImage.addEventListener('click', rollDigitalDice);
        dom.diceAnimation.addEventListener('click', handleDiceAnimationEnd);
        dom.revealButton.addEventListener('click', handleRevealClick);
        dom.correctButton.addEventListener('click', () => handleFeedback(true));
        dom.wrongButton.addEventListener('click', () => handleFeedback(false));
        dom.scoreScreen.addEventListener('click', handleScoreScreenEnd);
        document.querySelectorAll('.dice-option').forEach(dice => {
            dice.addEventListener('click', handlePhysicalDiceSelection);
        });
    }

    // --- Autorisierungs-Helferfunktionen ---
    async function generateCodeChallenge(codeVerifier) {
        const data = new TextEncoder().encode(codeVerifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function generateRandomString(length) {
        let text = '';
        let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    async function redirectToAuthCodeFlow() {
        const verifier = generateRandomString(128);
        const challenge = await generateCodeChallenge(verifier);
        localStorage.setItem("verifier", verifier);
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            response_type: "code",
            redirect_uri: REDIRECT_URI,
            scope: "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state",
            code_challenge_method: "S256",
            code_challenge: challenge,
        });
        document.location = `${API_ENDPOINTS.SPOTIFY_AUTH}?${params.toString()}`;
    }

    async function getAccessToken(code) {
        const verifier = localStorage.getItem("verifier");
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: "authorization_code",
            code: code,
            redirect_uri: REDIRECT_URI,
            code_verifier: verifier,
        });

        const result = await fetch(API_ENDPOINTS.SPOTIFY_TOKEN, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params
        });

        if (!result.ok) {
            throw new Error(`HTTP-Fehler! Status: ${result.status}`);
        }
        const { access_token } = await result.json();
        return access_token;
    }

    function initializePlayer() {
        const script = document.createElement('script');
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            spotifyPlayer = new Spotify.Player({
                name: 'TRACK ATTACK',
                getOAuthToken: cb => { cb(accessToken); }
            });

            spotifyPlayer.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);
                deviceId = device_id;
            });

            spotifyPlayer.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
            });

            spotifyPlayer.connect();
        };
    }

    // =======================================================================
    // 3. SPIEL-LOGIK & PHASEN-MANAGEMENT
    // =======================================================================

    function checkOrientation() {
        if (window.innerHeight > window.innerWidth) {
            dom.rotateDeviceOverlay.classList.remove('hidden');
        } else {
            dom.rotateDeviceOverlay.classList.add('hidden');
            if (accessToken && dom.gameScreen.classList.contains('hidden') && dom.loginScreen.classList.contains('hidden')) {
                startGameAfterOrientation();
            }
        }
    }

    function startGameAfterOrientation() {
        dom.gameScreen.classList.remove('hidden');
        dom.startGenreSelectionContainer.classList.remove('hidden');
        renderPreselectionGenres();
        playSound(dom.logoFlyInSound, 0.3);
        dom.logoButton.classList.remove('hidden');
        dom.logoButton.classList.add('initial-fly-in');
        dom.logoButton.addEventListener('click', startGame, { once: true });
    }

    function startGame() {
        triggerBounce(dom.logoButton);
        dom.logoButton.classList.add('inactive');
        lastGameScreenVisible = 'logo-button';

        dom.startGenreSelectionContainer.classList.add('hidden');

        setTimeout(() => {
            dom.appContainer.style.backgroundColor = `var(--player${gameState.currentPlayer}-color)`;
            dom.logoButton.classList.add('hidden');
            showDiceScreen();
        }, GAME_START_DELAY_MS);
    }

    function showDiceScreen() {
        resetRoundUI();
        gameState.currentRound++;

        if (gameState.currentRound > gameState.totalRounds) {
            endGame();
            return;
        }

        dom.appContainer.style.backgroundColor = `var(--player${gameState.currentPlayer}-color)`;
        dom.diceContainer.classList.remove('hidden');
        dom.diceAnimation.classList.remove('hidden');
        dom.diceSelection.classList.add('hidden');
        dom.digitalDiceArea.classList.add('hidden');

        dom.digitalDiceMainImage.src = digitalDiceStartImage;
        dom.digitalDiceMainImage.classList.remove('no-interaction', 'rolling');
        dom.digitalDiceMainImage.style.cursor = 'pointer';

        lastGameScreenVisible = 'dice-container';
        gameState.timeouts.diceAnimation = setTimeout(() => {
            handleDiceAnimationEnd();
        }, DICE_ANIMATION_MS);
    }

    async function showGenreScreen() {
        dom.genreContainer.classList.remove('hidden');
        dom.genreContainer.innerHTML = '';
        lastGameScreenVisible = 'genre-container';

        const playableGenresForDisplay = gameState.selectedPlayableGenres.length > 0 ?
            gameState.selectedPlayableGenres :
            Object.keys(playlists);

        const genreButtons = playableGenresForDisplay.filter(genreName => playlists[genreName] && playlists[genreName].length > 0)
            .map(genreName => {
                const button = document.createElement('button');
                button.classList.add('genre-button');
                button.dataset.genre = genreName;
                button.innerText = formatGenreName(genreName);
                button.addEventListener('click', handleGenreSelection, { once: true });
                dom.genreContainer.appendChild(button);
                return button;
            });

        await runGenreAnimation(genreButtons);
        applyGenreSelectionLogic(genreButtons);
    }

    async function prepareAndShowRateScreen(genre) {
        dom.loadingOverlay.classList.remove('hidden');
        gameState.currentTrack = await getTrack(genre);
        dom.loadingOverlay.classList.add('hidden');
        
        if (!gameState.currentTrack) return;

        dom.logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
        dom.logoButton.removeEventListener('click', playTrackSnippet);
        dom.logoButton.addEventListener('click', playTrackSnippet);
        lastGameScreenVisible = 'reveal-container';
    }

    function showResolution() {
        clearAllTimers();
        fadeAudioOut().then(() => {
            if (gameState.isSongPlaying && spotifyPlayer) {
                spotifyPlayer.pause();
                gameState.isSongPlaying = false;
            }
            updateResolutionUI();
            playSongForResolution();
        });
    }

    function endGame() {
        dom.gameScreen.classList.add('hidden');
        dom.scoreScreen.classList.remove('hidden');
        dom.appContainer.style.backgroundColor = 'transparent';
        lastGameScreenVisible = 'score-screen';

        const p1ScoreEl = document.getElementById('player1-score-display');
        const p2ScoreEl = document.getElementById('player2-score-display');
        p1ScoreEl.innerText = gameState.player1Score;
        p2ScoreEl.innerText = gameState.player2Score;
        p1ScoreEl.style.opacity = '1';
        p2ScoreEl.style.opacity = '1';

        setTimeout(() => {
            p1ScoreEl.style.opacity = '0';
            p2ScoreEl.style.opacity = '0';
        }, SCORE_SCREEN_DISPLAY_MS - 1000);

        gameState.timeouts.scoreScreen = setTimeout(handleScoreScreenEnd, SCORE_SCREEN_DISPLAY_MS);
    }

    function resetGame() {
        dom.scoreScreen.classList.add('hidden');
        dom.appContainer.style.backgroundColor = 'var(--black)';
        Object.assign(gameState, {
            player1Score: 0,
            player2Score: 0,
            currentPlayer: Math.random() < 0.5 ? 1 : 2,
            currentRound: 0,
            diceValue: 0,
            attemptsMade: 0,
            maxAttempts: 0,
            trackDuration: 0,
            currentTrack: null,
            isSpeedRound: false,
            player1SpeedRound: Math.floor(Math.random() * 10) + 1,
            player2SpeedRound: Math.floor(Math.random() * 10) + 1,
            selectedPlayableGenres: [],
        });
        
        dom.allGenresScrollbox.innerHTML = '';
        dom.gameScreen.classList.remove('hidden');
        dom.logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
        dom.logoButton.removeEventListener('click', startGame);
        dom.logoButton.addEventListener('click', startGame, { once: true });
        lastGameScreenVisible = '';
        dom.startGenreSelectionContainer.classList.remove('hidden');
        renderPreselectionGenres();
    }

    // =======================================================================
    // 4. HELPER-FUNKTIONEN
    // =======================================================================

    function clearAllTimers() {
        clearTimeout(gameState.timeouts.speedRound);
        clearInterval(gameState.intervals.countdown);
        clearTimeout(gameState.timeouts.spotifyPlay);
        clearInterval(gameState.intervals.fade);
        clearTimeout(gameState.timeouts.diceAnimation);
        clearTimeout(gameState.timeouts.scoreScreen);
    }

    function triggerBounce(element) {
        element.classList.remove('bounce');
        void element.offsetWidth;
        element.classList.add('bounce');
    }

    function playSound(audioElement, volume) {
        if (audioElement) {
            audioElement.currentTime = 0;
            audioElement.volume = volume;
            audioElement.play().catch(error => console.warn("Autoplay blockiert oder Fehler:", error));
        }
    }

    function formatGenreName(name) {
        return name.split(/(?=[A-Z])/)
            .join(' ')
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function updateResolutionUI() {
        dom.countdownDisplay.classList.add('hidden');
        dom.countdownDisplay.classList.remove('countdown-animated');
        dom.countdownDisplay.innerText = '';

        dom.logoButton.classList.add('inactive', 'hidden');
        dom.revealButton.classList.add('hidden');
        dom.speedRoundTextDisplay.classList.add('hidden');

        document.getElementById('album-cover').src = gameState.currentTrack.album.images[0].url;
        document.getElementById('track-title').innerText = gameState.currentTrack.name;
        document.getElementById('track-artist').innerText = gameState.currentTrack.artists.map(a => a.name).join(', ');
        dom.trackAlbum.innerText = gameState.currentTrack.album.name;
        dom.trackYear.innerText = `(${gameState.currentTrack.album.release_date.substring(0, 4)})`;

        dom.revealContainer.classList.remove('hidden');
    }

    // =======================================================================
    // 5. EVENT HANDLER
    // =======================================================================

    function handleDiceAnimationEnd() {
        clearTimeout(gameState.timeouts.diceAnimation);
        dom.diceAnimation.classList.add('hidden');
        dom.diceSelection.classList.remove('hidden');
        dom.digitalDiceArea.classList.remove('hidden');
        document.querySelectorAll('.dice-option').forEach(dice => dice.classList.remove('no-interaction'));
    }

    function handlePhysicalDiceSelection(e) {
        const selectedValue = parseInt(e.target.dataset.value);
        gameState.diceValue = selectedValue;

        const config = diceConfig[selectedValue];
        if (!config) {
            console.error(`Konfiguration für Würfelwert ${selectedValue} nicht gefunden!`);
            return;
        }

        setTimeout(() => {
            gameState.trackDuration = config.duration;
            gameState.maxAttempts = config.attempts;
            gameState.attemptsMade = 0;
            dom.diceContainer.classList.add('hidden');
            showGenreScreen();
        }, RESOLUTION_DELAY_MS);
    }

    async function handleGenreSelection(e) {
        const selectedGenre = e.target.dataset.genre;
        dom.genreContainer.classList.add('hidden');
        document.querySelectorAll('.genre-button').forEach(btn => btn.removeEventListener('click', handleGenreSelection));

        const playerRound = Math.ceil(gameState.currentRound / 2);
        gameState.isSpeedRound = (gameState.currentPlayer === 1 && playerRound === gameState.player1SpeedRound) ||
            (gameState.currentPlayer === 2 && playerRound === gameState.player2SpeedRound);

        if (gameState.isSpeedRound) {
            await showSpeedRoundAnimation();
        }

        await prepareAndShowRateScreen(selectedGenre);
    }

    async function handleRevealClick() {
        dom.revealButton.classList.add('no-interaction');
        await new Promise(resolve => setTimeout(resolve, RESOLUTION_DELAY_MS));
        await fadeAudioOut();
        showResolution();
    }

    function handleScoreScreenEnd() {
        clearTimeout(gameState.timeouts.scoreScreen);
        dom.scoreScreen.classList.add('hidden');
        document.getElementById('player1-score-display').style.opacity = '0';
        document.getElementById('player2-score-display').style.opacity = '0';
        resetGame();
    }

    // =======================================================================
    // 6. SPEZIFISCHE UI- & ANIMATIONS-FUNKTIONEN
    // =======================================================================

    function startTokenTimer() {
        const totalDuration = 60 * 60;
        let timeLeft = totalDuration;
        dom.tokenTimer.classList.remove('hidden');

        function updateTimerDisplay() {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            dom.tokenTimer.innerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        updateTimerDisplay();
        const timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                dom.tokenTimer.innerText = 'Token abgelaufen!';
            }
        }, 1000);
    }

    function renderPreselectionGenres() {
        dom.allGenresScrollbox.innerHTML = '';
        const allAvailableGenres = Object.keys(playlists);
        allAvailableGenres.forEach(genreName => {
            const button = document.createElement('button');
            button.classList.add('preselect-genre-button');
            button.dataset.genre = genreName;
            button.innerText = formatGenreName(genreName);

            if (gameState.selectedPlayableGenres.includes(genreName)) {
                button.classList.add('selected');
            }

            button.addEventListener('click', () => {
                toggleGenreSelection(genreName, button);
            });
            dom.allGenresScrollbox.appendChild(button);
        });
    }

    function toggleGenreSelection(genreName, buttonElement) {
        const index = gameState.selectedPlayableGenres.indexOf(genreName);
        if (index > -1) {
            gameState.selectedPlayableGenres.splice(index, 1);
            buttonElement.classList.remove('selected');
        } else {
            gameState.selectedPlayableGenres.push(genreName);
            buttonElement.classList.add('selected');
        }
        console.log("Aktuell ausgewählte Genres:", gameState.selectedPlayableGenres);
    }

    function rollDigitalDice() {
        dom.digitalDiceMainImage.classList.add('no-interaction', 'rolling');
        dom.digitalDiceMainImage.style.cursor = 'default';
        dom.digitalDiceMainImage.src = digitalDiceAnimationGif;
        playSound(dom.digitalDiceSound, 0.3);

        setTimeout(() => {
            dom.digitalDiceMainImage.classList.remove('rolling');
            const randomIndex = Math.floor(Math.random() * DICE_POSSIBLE_VALUES.length);
            const randomDiceValue = DICE_POSSIBLE_VALUES[randomIndex];
            dom.digitalDiceMainImage.src = digitalDiceImages[randomDiceValue];
            dom.digitalDiceMainImage.classList.remove('no-interaction');
            dom.digitalDiceMainImage.style.cursor = 'pointer';
        }, 1800);
    }

    function applyGenreSelectionLogic(buttons) {
        if (gameState.diceValue === 7) {
            const randomIndex = Math.floor(Math.random() * buttons.length);
            buttons[randomIndex].disabled = true;
            buttons[randomIndex].classList.add('disabled-genre');
        } else {
            buttons.forEach(btn => btn.disabled = true);
            const randomIndex = Math.floor(Math.random() * buttons.length);
            buttons[randomIndex].disabled = false;
        }
    }

    async function getTrack(selectedGenreName) {
        const playlistPool = playlists[selectedGenreName];
        if (!playlistPool || playlistPool.length === 0) {
            alert(`Fehler: Für das Genre "${selectedGenreName}" sind keine Playlists verfügbar.`);
            showGenreScreen();
            return null;
        }

        const randomPlaylistId = playlistPool[Math.floor(Math.random() * playlistPool.length)];
        try {
            const response = await fetch(API_ENDPOINTS.SPOTIFY_PLAYLIST_TRACKS(randomPlaylistId), {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) {
                throw new Error(`Fehler beim Abrufen der Playlist-Tracks: ${response.status}`);
            }
            const data = await response.json();
            const playableTracks = data.items.filter(item => item.track);
            if (playableTracks.length === 0) {
                throw new Error(`Keine abspielbaren Tracks in der Playlist ${randomPlaylistId}.`);
            }
            return playableTracks[Math.floor(Math.random() * playableTracks.length)].track;
        } catch (error) {
            console.error(error.message);
            alert(`Ein Fehler ist aufgetreten: ${error.message}. Bitte versuchen Sie ein anderes Genre.`);
            showGenreScreen();
            return null;
        }
    }

    async function playTrackSnippet() {
        if ((!gameState.isSpeedRound && gameState.attemptsMade >= gameState.maxAttempts) || (gameState.isSpeedRound && gameState.attemptsMade > 0)) {
            return;
        }
        dom.loadingOverlay.classList.remove('hidden');
        triggerBounce(dom.logoButton);
        dom.logoButton.classList.add('inactive');
        gameState.attemptsMade++;

        const trackDurationMs = gameState.currentTrack.duration_ms;
        const randomStartPosition = Math.floor(Math.random() * (trackDurationMs - gameState.trackDuration));

        try {
            const response = await fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), {
                method: 'PUT',
                body: JSON.stringify({
                    uris: [gameState.currentTrack.uri],
                    position_ms: randomStartPosition
                }),
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) throw new Error(`Fehler beim Abspielen: ${response.status}`);
            
            dom.loadingOverlay.classList.add('hidden');
            gameState.isSongPlaying = true;

            if (gameState.isSpeedRound) {
                startVisualSpeedRoundCountdown();
            } else {
                gameState.timeouts.spotifyPlay = setTimeout(() => {
                    spotifyPlayer.pause();
                    gameState.isSongPlaying = false;
                    if (gameState.attemptsMade < gameState.maxAttempts) {
                        dom.logoButton.classList.remove('inactive');
                    }
                }, gameState.trackDuration);
                if (gameState.attemptsMade === 1) {
                    dom.revealButton.classList.remove('hidden');
                    dom.revealButton.classList.remove('no-interaction');
                }
            }
        } catch (error) {
            console.error("Fehler beim Abspielen des Tracks:", error);
            alert("Konnte den Song nicht abspielen. Stellen Sie sicher, dass ein Gerät ausgewählt ist.");
            dom.loadingOverlay.classList.add('hidden');
            dom.logoButton.classList.remove('inactive');
        }
    }

    async function playSongForResolution() {
        if (!gameState.currentTrack || !deviceId) return;
        
        const startPositionMs = 30 * 1000;
        const targetVolume = 80;
        const fadeStep = 5;
        const intervalTime = FADE_IN_DURATION_MS / (targetVolume / fadeStep);

        try {
            await spotifyPlayer.setVolume(0);
            gameState.currentSongVolume = 0;
            
            const response = await fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), {
                method: 'PUT',
                body: JSON.stringify({ uris: [gameState.currentTrack.uri], position_ms: startPositionMs }),
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) throw new Error(`Fehler beim Starten des Songs für Auflösung: ${response.status}`);
            
            gameState.isSongPlaying = true;
            gameState.intervals.fade = setInterval(() => {
                if (gameState.currentSongVolume < targetVolume) {
                    gameState.currentSongVolume = Math.min(gameState.currentSongVolume + fadeStep, targetVolume);
                    spotifyPlayer.setVolume(gameState.currentSongVolume / 100);
                } else {
                    clearInterval(gameState.intervals.fade);
                }
            }, intervalTime);
        } catch (error) {
            console.error("Fehler beim Abspielen für Auflösung:", error);
        }
    }

    function fadeAudioOut() {
        return new Promise(resolve => {
            if (!spotifyPlayer || !gameState.isSongPlaying) {
                resolve();
                return;
            }
            clearInterval(gameState.intervals.fade);

            const currentVolumePercent = gameState.currentSongVolume;
            const fadeStep = 5;
            const intervalTime = FADE_OUT_DURATION_MS / (currentVolumePercent / fadeStep);

            gameState.intervals.fade = setInterval(() => {
                if (gameState.currentSongVolume > 0) {
                    gameState.currentSongVolume = Math.max(0, gameState.currentSongVolume - fadeStep);
                    spotifyPlayer.setVolume(gameState.currentSongVolume / 100);
                } else {
                    clearInterval(gameState.intervals.fade);
                    gameState.intervals.fade = null;
                    resolve();
                }
            }, intervalTime);
        });
    }

    function handleFeedback(isCorrect) {
        dom.correctButton.classList.add('no-interaction');
        dom.wrongButton.classList.add('no-interaction');

        fadeAudioOut().then(() => {
            if (gameState.isSongPlaying && spotifyPlayer) {
                spotifyPlayer.pause();
                gameState.isSongPlaying = false;
            }

            let pointsAwarded = isCorrect ? Math.max(1, gameState.diceValue - (gameState.attemptsMade - 1)) : 0;
            if (isCorrect) {
                if (gameState.currentPlayer === 1) {
                    gameState.player1Score += pointsAwarded;
                } else {
                    gameState.player2Score += pointsAwarded;
                }
            }

            displayPointsAnimation(pointsAwarded, gameState.currentPlayer).then(() => {
                gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
                dom.appContainer.style.backgroundColor = `var(--player${gameState.currentPlayer}-color)`;
                lastGameScreenVisible = '';
                setTimeout(showDiceScreen, RESOLUTION_DELAY_MS);
            });
        });
    }

    function displayPointsAnimation(points, player) {
        return new Promise(resolve => {
            const displayEl = dom.countdownDisplay;
            displayEl.classList.remove('hidden', 'countdown-animated', 'fly-to-corner-player1', 'fly-to-corner-player2', 'points-pop-in');
            displayEl.innerText = `+${points}`;
            displayEl.style.color = `var(--punktefarbe-player${player})`;
            displayEl.style.opacity = '0';
            displayEl.style.transform = 'translate(-50%, -50%) scale(0.8)';
            displayEl.style.left = '50%';
            displayEl.style.top = '50%';
            void displayEl.offsetWidth;
            displayEl.classList.add('points-pop-in');

            setTimeout(() => {
                displayEl.classList.remove('points-pop-in');
                displayEl.classList.add(`fly-to-corner-player${player}`);
            }, POINTS_ANIMATION_POP_IN_MS);

            setTimeout(() => {
                displayEl.classList.add('hidden');
                displayEl.classList.remove(`fly-to-corner-player${player}`);
                displayEl.innerText = '';
                resolve();
            }, POINTS_ANIMATION_POP_IN_MS + POINTS_ANIMATION_FLY_MS);
        });
    }

    function showSpeedRoundAnimation() {
        return new Promise(resolve => {
            dom.speedRoundTextDisplay.classList.remove('hidden');
            setTimeout(() => {
                dom.speedRoundTextDisplay.classList.add('hidden');
                resolve();
            }, SPEED_ROUND_ANIMATION_MS);
        });
    }

    function startVisualSpeedRoundCountdown() {
        let timeLeft = 7;
        dom.countdownDisplay.classList.remove('hidden');

        gameState.timeouts.speedRound = setTimeout(showResolution, SPEED_ROUND_TIMER_MS);
        
        function updateCountdown() {
            if (timeLeft < 0) {
                clearInterval(gameState.intervals.countdown);
                dom.countdownDisplay.classList.add('hidden');
                dom.countdownDisplay.innerText = '';
                return;
            }
            dom.countdownDisplay.innerText = timeLeft;
            dom.countdownDisplay.classList.remove('countdown-animated');
            void dom.countdownDisplay.offsetWidth;
            dom.countdownDisplay.classList.add('countdown-animated');
            timeLeft--;
        }

        updateCountdown();
        gameState.intervals.countdown = setInterval(updateCountdown, 1000);
    }

    // =======================================================================
    // 7. START
    // =======================================================================

    init();
});
