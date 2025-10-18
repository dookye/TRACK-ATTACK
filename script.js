document.addEventListener('DOMContentLoaded', () => {

    // --- API Endpunkte ---
    const API_ENDPOINTS = {
        SPOTIFY_AUTH: 'https://accounts.spotify.com/authorize',
        SPOTIFY_TOKEN: 'https://accounts.spotify.com/api/token',
        SPOTIFY_PLAYLIST_TRACKS: (playlistId) => `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        SPOTIFY_PLAYER_PLAY: (deviceId) => `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
    };

    // --- DOM-Elemente ---
    const appContainer = document.getElementById('app-container');
    const loginScreen = document.getElementById('login-screen');
    const gameScreen = document.getElementById('game-screen');
    
    const logoButton = document.getElementById('logo-button');
    const animatedTextOverlay = document.getElementById('animated-text-overlay');
    const animatedTextContent = document.getElementById('animated-text-content');

    const genrePreselectionContainer = document.getElementById('genre-preselection-container');
    const wheel = document.getElementById('wheel');
    const startGameButton = document.getElementById('start-game-button');
    
    const diceContainer = document.getElementById('dice-container');
    const digitalDiceImage = document.getElementById('digital-dice-image');

    const genreContainer = document.getElementById('genre-container');
    const gameWheel = document.getElementById('game-wheel');

    const rateContainer = document.getElementById('rate-container');
    const rateLogoButton = document.getElementById('rate-logo-button');

    const revealContainer = document.getElementById('reveal-container');
    const revealButton = document.getElementById('reveal-button');
    const correctButton = document.getElementById('correct-button');
    const wrongButton = document.getElementById('wrong-button');

    const pointsOverlay = document.getElementById('points-overlay');
    const pointsDisplay = document.getElementById('points-display');
    
    const scoreScreen = document.getElementById('score-screen');
    const p1ScoreEl = document.getElementById('player1-score-display');
    const p2ScoreEl = document.getElementById('player2-score-display');
    const tokenTimer = document.getElementById('token-timer');

    // --- Sounds ---
    const digitalDiceSound = document.getElementById('digital-dice-sound');
    const logoFlyInSound = document.getElementById('logo-fly-in-sound');
    const wheelSpinSound = document.getElementById('wheel-spin-sound');

    // --- Spotify-Parameter ---
    const CLIENT_ID = "53257f6a1c144d3f929a60d691a0c6f6";
    const REDIRECT_URI = "https://dookye.github.io/TRACK-ATTACK/";

    // --- Konfigurationen ---
    const diceConfig = {
        1: { attempts: 1, duration: 7000 }, 2: { attempts: 2, duration: 7000 },
        3: { attempts: 3, duration: 7000 }, 4: { attempts: 4, duration: 7000 },
        5: { attempts: 5, duration: 7000 }, 7: { attempts: 7, duration: 2000 }
    };
    const digitalDiceImages = {
        1: 'assets/digi-1.png', 2: 'assets/digi-2.png', 3: 'assets/digi-3.png',
        4: 'assets/digi-4.png', 5: 'assets/digi-5.png', 7: 'assets/digi-ta.png'
    };
    const digitalDiceAnimationGif = 'assets/digi-ani.gif';
    const MIN_GENRES_REQUIRED = 3;

    // --- Spielstatus-Variablen ---
    let spotifyPlayer, deviceId, accessToken;
    let gameState = {};
    let wheelLogic = {
        isDragging: false,
        startY: 0,
        startScrollTop: 0,
        scrollTimeout: null,
        isAutoScrolling: false
    };

    function resetGameState() {
        gameState = {
            player1Score: 0, player2Score: 0,
            currentPlayer: Math.random() < 0.5 ? 1 : 2,
            totalRounds: 20, currentRound: 0, diceValue: 0,
            attemptsMade: 0, maxAttempts: 0, trackDuration: 0,
            currentTrack: null, isSpeedRound: false, isSongPlaying: false,
            player1SpeedRound: Math.floor(Math.random() * 10) + 1,
            player2SpeedRound: Math.floor(Math.random() * 10) + 1,
            activeTimers: [], selectedPlayableGenres: [],
        };
    }

    const playlists = {
        'pop hits 2000-2025': ['6mtYuOxzl58vSGnEDtZ9uB', '34NbomaTu7YuOYnky8nLXL'],
        'die größten hits aller zeiten': ['2si7ChS6Y0hPBt4FsobXpg', '2y09fNnXHvoqc1WGHvbhkZ'],
        'deutsch songs von früher bis heute': ['7h64UGKHGWM5ucefn99frR', '4ytdW13RHl5u9dbRWAgxSZ'],
        'party hits': ['53r5W67KJNIeHWAhVOWPDr'], 'skate-punk': ['7qGvinYjBfVpl1FJFkzGqV', '77IXl4Gh7AZLyVLx66NkqV'],
        'deutsch-punk': ['3sQLh9hYyJQZ0qWrtJG1OO', '4iR7Xq1wP9GRbGLm2qFBYw'], 'top 100 one hit wonders': ['1t1iRfYh9is6FH6eGm5o'],
        'girl- and boybands': ['11Q0O9t6MGGXrKFaeqRRwm'], 'deutsche disney-songs': ['6CdPoZsFja4LOrTYTvHrY5'],
        'lagerfeuer klassiker': ['3TfJ6iMeqPXPLW8sxuQgcd'], 'rock songs': ['6QrVkClF1eJSjb9FDfqtJ8'],
        'rocklegenden': ['3sdqSseSnwb4A0RqP93SUH'], 'alte schlagerschoten': ['68SxsyVUJ1DEGByUcEMrr4', '7dmg14Fnm9stKYkU4IthAG'],
        'lovesongs': ['6oNsYDhN95gkENsdFcAwTh'], 'serien unserer kindheit': ['1De2vLmWkrNE11JjrC8OTj', '2Gg5uCtOsdZ9UShBCp3Ekt'],
        'deutscher hip hop': ['1bG3S6G5BmmgN08EBDfzE5', '54Ac6qneIdV0VEXewKyI3W'], 'internationale rapsongs': ['0h8A0Qt4TD2cl74CrgldWj'],
        'deutscher pop-sommer 2025': ['6Aq2xcWvFXBoExv64eGm5o']
    };

    //=======================================================================
    // 1. Setup & Authentifizierung
    //=======================================================================
    if (window.location.search.includes("code=")) handleRedirect();
    else {
        showScreen(loginScreen);
        document.getElementById('login-button').addEventListener('click', redirectToAuthCodeFlow);
    }

    async function redirectToAuthCodeFlow() {
        const verifier = generateRandomString(128);
        const challenge = await generateCodeChallenge(verifier);
        localStorage.setItem("verifier", verifier);
        const params = new URLSearchParams({
            client_id: CLIENT_ID, response_type: "code", redirect_uri: REDIRECT_URI,
            scope: "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state",
            code_challenge_method: "S256", code_challenge: challenge
        });
        document.location = `${API_ENDPOINTS.SPOTIFY_AUTH}?${params.toString()}`;
    }

    async function handleRedirect() {
        const code = new URLSearchParams(window.location.search).get("code");
        window.history.pushState({}, '', REDIRECT_URI);
        try {
            accessToken = await getAccessToken(code);
            showScreen(gameScreen);
            logoButton.classList.remove('hidden');
            logoButton.classList.add('initial-fly-in');
            playSound(logoFlyInSound, 0.3);
            logoButton.addEventListener('click', showGenreIntro, { once: true });
            startTokenTimer();
        } catch (error) {
            console.error("Token-Fehler:", error);
            alert("Anmeldung fehlgeschlagen.");
            showScreen(loginScreen);
        }
    }

    async function getAccessToken(code) {
        const verifier = localStorage.getItem("verifier");
        const params = new URLSearchParams({
            client_id: CLIENT_ID, grant_type: "authorization_code", code: code,
            redirect_uri: REDIRECT_URI, code_verifier: verifier,
        });
        const result = await fetch(API_ENDPOINTS.SPOTIFY_TOKEN, {
            method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params
        });
        if (!result.ok) throw new Error('Token request failed');
        const { access_token } = await result.json();
        return access_token;
    }

    function initializePlayer() {
        return new Promise((resolve, reject) => {
            if (window.Spotify) { // SDK already loaded
                if (spotifyPlayer) {
                    if (deviceId) resolve(deviceId);
                    return;
                }
            } else {
                const script = document.createElement('script');
                script.src = "https://sdk.scdn.co/spotify-player.js";
                script.async = true;
                document.body.appendChild(script);
            }
            window.onSpotifyWebPlaybackSDKReady = () => {
                spotifyPlayer = new Spotify.Player({ name: 'TRACK ATTACK', getOAuthToken: cb => cb(accessToken) });
                spotifyPlayer.addListener('ready', ({ device_id }) => { deviceId = device_id; resolve(device_id); });
                spotifyPlayer.addListener('initialization_error', e => reject(e.message));
                spotifyPlayer.addListener('authentication_error', e => reject(e.message));
                spotifyPlayer.addListener('account_error', e => reject(e.message));
                spotifyPlayer.connect().then(success => { if (!success) reject('Player connection failed'); });
            };
        });
    }

    //=======================================================================
    // 2. Spiel-Fluss Steuerung
    //=======================================================================
    function showGenreIntro() {
        triggerBounce(logoButton);
        logoButton.classList.add('inactive');
        runWithTimeout(() => {
            logoButton.classList.add('hidden');
            showAnimatedText(["WÄHLE", "DIE", "SPIEL-GENRE"], [0.8, 0.8, 1.2]).then(showGenrePreselection);
        }, 2000);
    }
    
    function showGenrePreselection() {
        resetGameState();
        renderWheel(wheel, Object.keys(playlists));
        showScreen(genrePreselectionContainer);
    }

    async function handleStartGameClick() {
        startGameButton.disabled = true;
        try {
            if (!deviceId) {
                await initializePlayer();
                await spotifyPlayer.resume(); // ** APPLE FIX **
            }
            showPlayerIndicator();
        } catch (error) {
            console.error("Player-Fehler:", error);
            alert("Spotify Player konnte nicht gestartet werden. (Premium benötigt?)");
            startGameButton.disabled = false;
        }
    }

    function showPlayerIndicator() {
        const playerText = gameState.currentPlayer === 1 ? "SPIELER BLAU" : "SPIELER PINK";
        const [word1, word2] = playerText.split(" ");
        appContainer.style.backgroundColor = gameState.currentPlayer === 1 ? 'var(--player1-color)' : 'var(--player2-color)';
        showAnimatedText([word1, word2], [0.8, 1.2]).then(showDiceScreen);
    }

    function showDiceScreen() {
        gameState.currentRound++;
        if (gameState.currentRound > gameState.totalRounds) { endGame(); return; }
        resetRoundUI();
        showScreen(diceContainer);
        rollDigitalDice();
    }
    
    function rollDigitalDice() {
        digitalDiceImage.src = digitalDiceAnimationGif;
        digitalDiceImage.classList.add('rolling');
        playSound(digitalDiceSound, 0.3);
        runWithTimeout(() => {
            digitalDiceImage.classList.remove('rolling');
            const possibleValues = [1, 2, 3, 4, 5, 7];
            gameState.diceValue = possibleValues[Math.floor(Math.random() * possibleValues.length)];
            digitalDiceImage.src = digitalDiceImages[gameState.diceValue];
            Object.assign(gameState, diceConfig[gameState.diceValue]);
            runWithTimeout(showGenreScreen, 2000);
        }, 2000);
    }

    function showGenreScreen() {
        showScreen(genreContainer);
        renderWheel(gameWheel, gameState.selectedPlayableGenres);
        if (gameState.diceValue === 7) gameWheel.parentElement.classList.remove('no-interaction');
        else {
            gameWheel.parentElement.classList.add('no-interaction');
            const targetIndex = Math.floor(Math.random() * gameState.selectedPlayableGenres.length);
            const duration = Math.random() * 2000 + 2000;
            spinWheel(gameWheel, targetIndex, duration).then(selectedGenre => {
                runWithTimeout(() => handleGameGenreClick({ target: { dataset: { genre: selectedGenre } } }), 2000);
            });
        }
    }

    async function handleGameGenreClick(e) {
        const selectedGenre = e.target.dataset.genre;
        if (!selectedGenre || wheelLogic.isAutoScrolling) return;
        gameWheel.parentElement.classList.add('no-interaction');
        const playerRound = Math.ceil(gameState.currentRound / 2);
        if ((gameState.currentPlayer === 1 && playerRound === gameState.player1SpeedRound) ||
            (gameState.currentPlayer === 2 && playerRound === gameState.player2SpeedRound)) {
            gameState.isSpeedRound = true;
            await showAnimatedText(["SPEEDROUND"], [1.5]);
        }
        prepareAndShowRateScreen(selectedGenre);
    }

    async function prepareAndShowRateScreen(genre) {
        try {
            gameState.currentTrack = await getTrack(genre);
            showScreen(rateContainer, [revealButton]);
            rateLogoButton.classList.remove('inactive');
            rateLogoButton.addEventListener('click', playTrackSnippet, { once: true });
        } catch (error) {
            alert("Song konnte nicht geladen werden.");
            showGenreScreen();
        }
    }

    async function playTrackSnippet() {
        triggerBounce(rateLogoButton);
        rateLogoButton.classList.add('inactive');
        const startPos = Math.max(0, Math.floor(Math.random() * (gameState.currentTrack.duration_ms - gameState.trackDuration)));
        try {
            await spotifyPlayer.activateElement();
            const response = await fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), {
                method: 'PUT',
                body: JSON.stringify({ uris: [gameState.currentTrack.uri], position_ms: startPos }),
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error(`Spotify API Error: ${response.status}`);
            gameState.isSongPlaying = true;
            gameState.attemptsMade++;
            if (!gameState.isSpeedRound) {
                runWithTimeout(() => { if (gameState.isSongPlaying) spotifyPlayer.pause(); }, gameState.trackDuration);
            }
        } catch (error) {
            alert("Song konnte nicht abgespielt werden.");
            rateLogoButton.classList.remove('inactive');
            rateLogoButton.addEventListener('click', playTrackSnippet, { once: true });
        }
    }

    function showResolution() {
        clearAllTimers();
        if (gameState.isSongPlaying) spotifyPlayer.pause();
        gameState.isSongPlaying = false;
        document.getElementById('album-cover').src = gameState.currentTrack.album.images[0]?.url || 'assets/cover-placeholder.png';
        document.getElementById('track-title').innerText = gameState.currentTrack.name;
        document.getElementById('track-artist').innerText = gameState.currentTrack.artists.map(a => a.name).join(', ');
        document.getElementById('track-album').innerText = gameState.currentTrack.album.name;
        document.getElementById('track-year').innerText = `(${gameState.currentTrack.album.release_date.substring(0, 4)})`;
        showScreen(revealContainer, [correctButton, wrongButton]);
        playSongForResolution();
    }

    function handleFeedback(isCorrect) {
        let pointsAwarded = 0;
        if (isCorrect) {
            pointsAwarded = Math.max(1, (gameState.diceValue === 7 ? 1 : gameState.diceValue) - (gameState.attemptsMade - 1));
            if (gameState.currentPlayer === 1) gameState.player1Score += pointsAwarded;
            else gameState.player2Score += pointsAwarded;
        }
        displayPointsAnimation(pointsAwarded, gameState.currentPlayer).then(() => {
            gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
            runWithTimeout(showPlayerIndicator, 500);
        });
    }
    
    function endGame() {
        showScreen(scoreScreen);
        appContainer.style.backgroundColor = 'transparent';
        p1ScoreEl.innerText = gameState.player1Score;
        p2ScoreEl.innerText = gameState.player2Score;
        setTimeout(() => { p1ScoreEl.style.opacity = '1'; p2ScoreEl.style.opacity = '1'; }, 100);
        scoreScreen.addEventListener('click', () => {
             p1ScoreEl.style.opacity = '0'; p2ScoreEl.style.opacity = '0';
             runWithTimeout(() => {
                appContainer.style.backgroundColor = 'var(--black)';
                showScreen(gameScreen);
                logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
                logoButton.addEventListener('click', showGenreIntro, { once: true });
             }, 1000);
        }, { once: true });
    }

    //=======================================================================
    // 3. Glücksrad-Logik
    //=======================================================================
    function renderWheel(wheelElement, genreList) {
        const container = wheelElement.parentElement;
        const itemHeight = container.clientHeight / 10; // 10 items visible
        const buffer = 5;
        const listToRender = [...genreList.slice(-buffer), ...genreList, ...genreList.slice(0, buffer)];
        wheelElement.innerHTML = listToRender.map(genre => `<div class="wheel-item" data-genre="${genre}">${genre}</div>`).join('');
        Object.assign(wheelElement.style, { height: `${listToRender.length * itemHeight}px`, top: `-${(genreList.length) * itemHeight}px` });
        Array.from(wheelElement.children).forEach((item, i) => item.style.height = `${itemHeight}px`);
        if (wheelElement.id === 'wheel') wheel.parentElement.addEventListener('click', handlePreselectionClick);
        else gameWheel.parentElement.addEventListener('click', handleGameGenreClick);
    }
    
    function handlePreselectionClick() {
        const item = getCenterItem(wheel);
        const genreName = item.dataset.genre;
        if (gameState.selectedPlayableGenres.includes(genreName)) {
            gameState.selectedPlayableGenres = gameState.selectedPlayableGenres.filter(g => g !== genreName);
            item.classList.remove('selected');
        } else {
            gameState.selectedPlayableGenres.push(genreName);
            item.classList.add('selected');
        }
        startGameButton.disabled = gameState.selectedPlayableGenres.length < MIN_GENRES_REQUIRED;
    }

    function spinWheel(wheelElement, targetIndex, duration) {
        return new Promise(resolve => {
            playSound(wheelSpinSound, 0.2, true);
            wheelLogic.isAutoScrolling = true;
            const container = wheelElement.parentElement;
            const itemHeight = container.clientHeight / 10;
            const genreList = gameState.selectedPlayableGenres;
            const finalIndex = targetIndex + genreList.length * 3; // 3 full spins
            const targetTop = finalIndex * itemHeight;
            Object.assign(wheelElement.style, {
                transition: `top ${duration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`,
                top: `-${targetTop}px`
            });
            runWithTimeout(() => {
                wheelElement.style.transition = 'none';
                wheelElement.style.top = `-${(targetIndex + genreList.length) * itemHeight}px`;
                if (wheelSpinSound) { wheelSpinSound.pause(); wheelSpinSound.currentTime = 0; }
                wheelLogic.isAutoScrolling = false;
                resolve(genreList[targetIndex]);
            }, duration);
        });
    }

    function getCenterItem(wheelElement) {
        const container = wheelElement.parentElement;
        const itemHeight = container.clientHeight / 10;
        const centerOffset = Math.abs(parseInt(wheelElement.style.top, 10)) + (container.clientHeight / 2);
        const centerIndex = Math.round(centerOffset / itemHeight);
        return wheelElement.children[centerIndex];
    }


    //=======================================================================
    // 4. Spotify-API & Audio
    //=======================================================================
    async function getTrack(genre) {
        const playlistPool = playlists[genre];
        if (!playlistPool?.length) throw new Error(`No playlists for ${genre}`);
        const playlistId = playlistPool[Math.floor(Math.random() * playlistPool.length)];
        const response = await fetch(API_ENDPOINTS.SPOTIFY_PLAYLIST_TRACKS(playlistId), {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error('Failed to fetch playlist');
        const data = await response.json();
        const playableTracks = data.items.filter(item => item.track);
        if (playableTracks.length === 0) throw new Error('Playlist empty');
        return playableTracks[Math.floor(Math.random() * playableTracks.length)].track;
    }

    async function playSongForResolution() {
        if (!gameState.currentTrack || !deviceId) return;
        try {
            await spotifyPlayer.setVolume(0);
            await fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), {
                method: 'PUT',
                body: JSON.stringify({ uris: [gameState.currentTrack.uri], position_ms: 30000 }),
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            gameState.isSongPlaying = true;
            let vol = 0;
            const fader = setInterval(() => {
                vol = Math.min(1, vol + 0.1);
                spotifyPlayer.setVolume(vol);
                if (vol >= 1) clearInterval(fader);
            }, 100);
            gameState.activeTimers.push(fader);
        } catch(e) { console.error("Resolution song error", e); }
    }

    //=======================================================================
    // 5. Helferfunktionen
    //=======================================================================
    function showScreen(activeScreen, visibleButtons = []) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        [revealButton, correctButton, wrongButton].forEach(b => b.classList.add('hidden'));
        if (activeScreen.id.includes('login') || activeScreen.id.includes('score')) {
            activeScreen.classList.remove('hidden');
        } else {
            gameScreen.classList.remove('hidden');
            activeScreen.classList.remove('hidden');
        }
        visibleButtons.forEach(b => b.classList.remove('hidden'));
    }

    function showAnimatedText(lines, sizes) {
        return new Promise(resolve => {
            animatedTextContent.innerHTML = lines.map((line, i) => 
                `<div style="font-size: ${sizes[i] * 2.5}rem;">${line}</div>`).join('');
            animatedTextOverlay.classList.remove('hidden');
            runWithTimeout(() => {
                animatedTextOverlay.classList.add('hidden');
                resolve();
            }, 2000);
        });
    }

    function displayPointsAnimation(points, player) {
        return new Promise(resolve => {
            if (points === 0) { resolve(); return; }
            pointsDisplay.textContent = `+${points}`;
            pointsDisplay.style.color = player === 1 ? 'var(--player1-color)' : 'var(--player2-color)';
            pointsDisplay.className = 'pop-in';
            pointsDisplay.classList.add(player === 1 ? 'fly-to-bottom' : 'fly-to-top');
            pointsOverlay.classList.remove('hidden');
            runWithTimeout(() => {
                pointsOverlay.classList.add('hidden');
                resolve();
            }, 800);
        });
    }

    function resetRoundUI() {
        clearAllTimers();
        if (gameState.isSongPlaying) { spotifyPlayer.pause(); gameState.isSongPlaying = false; }
        if(spotifyPlayer) spotifyPlayer.setVolume(1.0);
        rateLogoButton.removeEventListener('click', playTrackSnippet);
        gameState.isSpeedRound = false;
    }

    function runWithTimeout(cb, delay) { gameState.activeTimers.push(setTimeout(cb, delay)); }
    function clearAllTimers() { gameState.activeTimers.forEach(t => clearTimeout(t)); gameState.activeTimers = []; }
    function playSound(sound, vol, loop = false) {
        if (sound) { sound.currentTime = 0; sound.volume = vol; sound.loop = loop; sound.play().catch(e => {}); }
    }
    function triggerBounce(el) { el.classList.remove('bounce'); void el.offsetWidth; el.classList.add('bounce'); }
    function generateRandomString(len) { let s = ''; 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.split('').forEach(c => { for (let i = 0; i < len; i++) s += c.charAt(Math.floor(Math.random() * c.length)); }); return s.slice(0, len); }
    async function generateCodeChallenge(v) {
        const d = new TextEncoder().encode(v);
        const h = await crypto.subtle.digest('SHA-256', d);
        return btoa(String.fromCharCode.apply(null, [...new Uint8Array(h)])).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    function startTokenTimer() {
        let timeLeft = 3600;
        tokenTimer.classList.remove('hidden');
        const i = setInterval(() => {
            timeLeft--;
            const m = Math.floor(timeLeft / 60), s = timeLeft % 60;
            tokenTimer.innerText = `${m}:${s.toString().padStart(2, '0')}`;
            if (timeLeft <= 0) { clearInterval(i); alert("Sitzung abgelaufen."); window.location.reload(); }
        }, 1000);
    }
    
    // Event Listeners
    startGameButton.addEventListener('click', handleStartGameClick);
    revealButton.addEventListener('click', showResolution);
    correctButton.addEventListener('click', () => handleFeedback(true));
    wrongButton.addEventListener('click', () => handleFeedback(false));
});
