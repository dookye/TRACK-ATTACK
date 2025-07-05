// Wichtiger Hinweis: Dieser Code muss von einem Webserver bereitgestellt werden (z.B. über "Live Server" in VS Code).
// Ein direktes Öffnen der HTML-Datei im Browser funktioniert wegen der Sicherheitsrichtlinien (CORS) bei API-Anfragen nicht.

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM-Elemente ---
    const appContainer = document.getElementById('app-container');
    const loginScreen = document.getElementById('login-screen');
    const fullscreenScreen = document.getElementById('fullscreen-screen');
    const gameScreen = document.getElementById('game-screen');
    const rotateDeviceOverlay = document.getElementById('rotate-device-overlay');
    const logoButton = document.getElementById('logo-button');
    const diceContainer = document.getElementById('dice-container');
    const diceAnimation = document.getElementById('dice-animation');
    const diceSelection = document.getElementById('dice-selection');
    const genreContainer = document.getElementById('genre-container');
    const revealButton = document.getElementById('reveal-button');
    const revealContainer = document.getElementById('reveal-container');
    const scoreScreen = document.getElementById('score-screen');
    const speedRoundIndicator = document.getElementById('speed-round-indicator');
    const speedRoundTimer = document.getElementById('speed-round-timer');
    const countdownDisplay = document.getElementById('countdown-display');

    // --- Spotify-Parameter (Phase 1.1) ---
    const CLIENT_ID = "53257f6a1c144d3f929a60d691a0c6f6";
    const REDIRECT_URI = "https://dookye.github.io/TRACK-ATTACK/";

    // --- Spielstatus-Variablen ---
    let player;
    let spotifyPlayer;
    let deviceId;
    let accessToken;
    let gameState = {
        player1Score: 0,
        player2Score: 0,
        currentPlayer: 1,
        totalRounds: 20,
        currentRound: 0,
        diceValue: 0,
        attemptsMade: 0,
        maxAttempts: 0,
        trackDuration: 0,
        currentTrack: null,
        player1SpeedRound: Math.floor(Math.random() * 10) + 1,
        player2SpeedRound: Math.floor(Math.random() * 10) + 1,
        isSpeedRound: false,
        speedRoundTimeout: null,
        countdownInterval: null,
    };

    // NEU: Variable zum Speichern des letzten sichtbaren Spiel-Screens
    let lastGameScreenVisible = '';
    
    const playlists = {
        punk: ['39sVxPTg7BKwrf2MfgrtcD', '7ITmaFa2rOhXAmKmUUCG9E'],
        pop: ['6mtYuOxzl58vSGnEDtZ9uB', '34NbomaTu7YuOYnky8nLXL'],
        alltime: ['2si7ChS6Y0hPBt4FsobXpg', '2y09fNnXHvoqc1WGHvbhkZ'],
        disney: ['3Bilb56eeS7db5f3DTEwMR', '2bhbwexk7c6yJrEB4CtuY8']
    };

    //=======================================================================
    // Phase 1: Setup, Authentifizierung & Initialisierung
    //=======================================================================

    // 1.4: Querformat-Prüfung
    function checkOrientation() {
        if (window.innerHeight > window.innerWidth) {
            rotateDeviceOverlay.classList.remove('hidden');
        } else {
            rotateDeviceOverlay.classList.add('hidden');
        }
    }

    // alte rotations abfrage
    // window.addEventListener('resize', checkOrientation);
    // checkOrientation();

    // 1.2: PKCE-Flow Helferfunktionen
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

    // 1.2: Login-Prozess starten
    async function redirectToAuthCodeFlow() {
        const verifier = generateRandomString(128);
        const challenge = await generateCodeChallenge(verifier);
        localStorage.setItem("verifier", verifier);
        const params = new URLSearchParams();
        params.append("client_id", CLIENT_ID);
        params.append("response_type", "code");
        params.append("redirect_uri", REDIRECT_URI);
        params.append("scope", "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state");
        params.append("code_challenge_method", "S256");
        params.append("code_challenge", challenge);
        document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
    }

    // 1.2: Access Token abrufen
    async function getAccessToken(code) {
        const verifier = localStorage.getItem("verifier");
        const params = new URLSearchParams();
        params.append("client_id", CLIENT_ID);
        params.append("grant_type", "authorization_code");
        params.append("code", code);
        params.append("redirect_uri", REDIRECT_URI);
        params.append("code_verifier", verifier);

        const result = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params
        });

        const { access_token } = await result.json();
        return access_token;
    }

    // Initialisierung nach dem Laden der Seite
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
        // Wir kommen von der Spotify-Weiterleitung zurück
        window.history.pushState({}, '', REDIRECT_URI); // URL aufräumen
        getAccessToken(code).then(token => {
            accessToken = token;
            loginScreen.classList.add('hidden');
            fullscreenScreen.classList.remove('hidden');
            initializePlayer();
            // NEU: Orientierungsprüfung und Listener nach erfolgreichem Login aktivieren
            window.addEventListener('resize', checkOrientation);
            checkOrientation();
        });
    } else {
        // Standard-Ansicht
        loginScreen.classList.remove('hidden');
        document.getElementById('login-button').addEventListener('click', redirectToAuthCodeFlow);
    }

    // 1.3: Spotify Web Player SDK laden und initialisieren
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

    // NEU: Event Listener für das Verlassen des Vollbildmodus
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            // Vollbildmodus wurde verlassen
            // Speichere den Zustand, BEVOR alles versteckt wird
            if (!logoButton.classList.contains('hidden')) {
                lastGameScreenVisible = 'logo-button';
            } else if (!diceContainer.classList.contains('hidden')) {
                lastGameScreenVisible = 'dice-container';
            } else if (!genreContainer.classList.contains('hidden')) {
                lastGameScreenVisible = 'genre-container';
            } else if (!revealContainer.classList.contains('hidden')) {
                lastGameScreenVisible = 'reveal-container';
            } else {
                lastGameScreenVisible = ''; // Wenn nichts Spezielles sichtbar war
            }


            // Alle Spiel-Elemente verstecken
            gameScreen.classList.add('hidden');
            revealContainer.classList.add('hidden');
            diceContainer.classList.add('hidden');
            genreContainer.classList.add('hidden');
            logoButton.classList.add('hidden');
            speedRoundIndicator.classList.add('hidden');
            revealButton.classList.add('hidden'); // AUFLÖSEN Button auch verstecken

            // Spotify-Player pausieren
            if (spotifyPlayer) {
                spotifyPlayer.pause();
            }
            clearTimeout(gameState.speedRoundTimeout); // Speed-Round-Timer stoppen

            // Den Vollbild-Screen wieder anzeigen
            fullscreenScreen.classList.remove('hidden');
        }
    });

    
    // 1.4: Vollbild-Modus aktivieren
    fullscreenScreen.addEventListener('click', () => {
        document.documentElement.requestFullscreen().then(() => {
            fullscreenScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            // NEU: Stelle den letzten Zustand wieder her, oder starte neu
            if (lastGameScreenVisible === 'dice-container') {
                showDiceScreen();
            } else if (lastGameScreenVisible === 'genre-container') {
                showGenreScreen();
            } else if (lastGameScreenVisible === 'reveal-container') {
                showResolution(); // Zeigt nur die Auflösung, nicht das Abspielen
                // Hier müsste man überlegen, ob der Track weiterlaufen soll
                // oder ob man ihn pausiert hat und jetzt fortsetzen will.
                // Fürs Erste zeige ich nur die Auflösung.
            } else {
                // Wenn kein spezieller Zustand gespeichert ist, starte neu mit dem Logo
                logoButton.classList.remove('hidden');
                logoButton.classList.add('initial-fly-in');
                logoButton.addEventListener('click', startGame, { once: true });
            }
        });
    });

    //=======================================================================
    // Phase 2: Spielstart & UI-Grundlagen
    //=======================================================================

    function triggerBounce(element) {
        element.classList.remove('bounce');
        void element.offsetWidth; // Trigger reflow
        element.classList.add('bounce');
    }

    function startGame() {
        triggerBounce(logoButton);
        logoButton.classList.add('inactive');

        // Speichere den Zustand, dass das Spiel gestartet wurde (Logo-Phase)
        lastGameScreenVisible = 'logo-button';
        
        setTimeout(() => {
            appContainer.style.backgroundColor = 'var(--player1-color)';
            logoButton.classList.add('hidden');
            showDiceScreen();
        }, 800); // Warten, bis Bounce-Effekt und Blur sichtbar sind
    }
    
    //=======================================================================
    // Phase 3: Würfel- & Genre-Auswahl
    //=======================================================================

    function showDiceScreen() {
        resetRoundUI();
        gameState.currentRound++;
        gameState.isSpeedRound = false;

        // Check für Spielende
        if (gameState.currentRound > gameState.totalRounds) {
            endGame();
            return;
        }

        diceContainer.classList.remove('hidden');
        diceAnimation.classList.remove('hidden');
        diceSelection.classList.add('hidden');

        // Speichere den Zustand: Würfel-Bildschirm
        lastGameScreenVisible = 'dice-container';
        
        setTimeout(() => {
            diceAnimation.classList.add('hidden');
            diceSelection.classList.remove('hidden');
        }, 4000);
    }

    document.querySelectorAll('.dice-option').forEach(dice => {
        dice.addEventListener('click', (e) => {
            gameState.diceValue = parseInt(e.target.dataset.value);
            
            // 3.2: Spieldauer, Punkte, Versuche festlegen
            gameState.trackDuration = gameState.diceValue === 7 ? 2000 : 7000; // in ms
            gameState.maxAttempts = gameState.diceValue;
            gameState.attemptsMade = 0;

            diceContainer.classList.add('hidden');
            showGenreScreen();
        });
    });

    function showGenreScreen() {
        genreContainer.classList.remove('hidden');
        const buttons = document.querySelectorAll('.genre-button');
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('random-blink');
        });

         // Speichere den Zustand: Genre-Bildschirm
        lastGameScreenVisible = 'genre-container';

        // 3.4: Genre-Auswahl-Logik
        if (gameState.diceValue === 7) { // Fall B: Spieler wählt
            buttons.forEach(btn => btn.addEventListener('click', handleGenreSelection));
        } else { // Fall A: Zufällige Auswahl
            buttons.forEach(btn => btn.disabled = true);
            const blinkInterval = setInterval(() => {
                buttons.forEach(btn => btn.classList.toggle('random-blink'));
            }, 200);

            setTimeout(() => {
                clearInterval(blinkInterval);
                const randomIndex = Math.floor(Math.random() * buttons.length);
                buttons.forEach((btn, index) => {
                    btn.classList.remove('random-blink');
                    if (index !== randomIndex) {
                        btn.disabled = true;
                    } else {
                        btn.disabled = false;
                        btn.addEventListener('click', handleGenreSelection, { once: true });
                    }
                });
            }, 4000);
        }
    }

    async function handleGenreSelection(e) {
        const selectedGenre = e.target.dataset.genre;
        genreContainer.classList.add('hidden');
        document.querySelectorAll('.genre-button').forEach(btn => btn.removeEventListener('click', handleGenreSelection));
        
        // Phase 6: Speed-Round Check
        const playerRound = Math.ceil(gameState.currentRound / 2);
        if ((gameState.currentPlayer === 1 && playerRound === gameState.player1SpeedRound) ||
            (gameState.currentPlayer === 2 && playerRound === gameState.player2SpeedRound)) {
            gameState.isSpeedRound = true;
            await showSpeedRoundAnimation();
        }

        await prepareAndShowRateScreen(selectedGenre);
    }

    //=======================================================================
    // Phase 4: Rate-Bildschirm & Spielerwechsel
    //=======================================================================
    
    async function getTrack(genre) {
        const playlistPool = playlists[genre];
        const randomPlaylistId = playlistPool[Math.floor(Math.random() * playlistPool.length)];
        
        const response = await fetch(`https://api.spotify.com/v1/playlists/${randomPlaylistId}/tracks`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const data = await response.json();
        
        const randomTrack = data.items[Math.floor(Math.random() * data.items.length)].track;
        return randomTrack;
    }

    async function prepareAndShowRateScreen(genre) {
        gameState.currentTrack = await getTrack(genre);
        console.log("Selected Track:", gameState.currentTrack.name); // Zum Debuggen

        logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
        logoButton.removeEventListener('click', playTrackSnippet);
        logoButton.addEventListener('click', playTrackSnippet);

        // Speichere den Zustand: Raten-Bildschirm
        lastGameScreenVisible = 'reveal-container'; // Obwohl es der Rate-Bildschirm ist, steht reveal-container für die Auflösung

        // Der Speed-Round Indicator soll kurz angezeigt werden, bevor der Countdown kommt
        if (gameState.isSpeedRound) {
            await showSpeedRoundAnimation(); // Zeigt "Speed-Round" an
            // Countdown startet ERST wenn playTrackSnippet aufgerufen wird
        }
    }

    function playTrackSnippet() {
        if (gameState.attemptsMade >= gameState.maxAttempts) return;

        triggerBounce(logoButton);
        logoButton.classList.add('inactive');
        gameState.attemptsMade++;

        const trackDurationMs = gameState.currentTrack.duration_ms;
        const randomStartPosition = Math.floor(Math.random() * (trackDurationMs - gameState.trackDuration));

        fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        // ??? fetch(`${SPOTIFY_PLAY_URL}${deviceId}`, { // KORRIGIERT
            method: 'PUT',
            body: JSON.stringify({
                uris: [gameState.currentTrack.uri],
                position_ms: randomStartPosition
            }),
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }).then(() => {
            // Wenn der Track erfolgreich gestartet wurde
            if (gameState.isSpeedRound) {
                // Hier startet der visuelle Countdown und der Timer für die Auflösung
                startVisualSpeedRoundCountdown(); 
            } else {
                // Normaler Modus: Track stoppt nach trackDuration
                setTimeout(() => {
                    spotifyPlayer.pause();
                    if (gameState.attemptsMade < gameState.maxAttempts) { // Prüfen, ob noch Versuche übrig sind
                        logoButton.classList.remove('inactive');
                    }
                }, gameState.trackDuration);
        });
        
        // 4.3: "AUFLÖSEN"-Button nach 1. Versuch anzeigen
        if (gameState.attemptsMade === 1) {
            revealButton.classList.remove('hidden');
        }
    }

    function showResolution() {
        clearTimeout(gameState.speedRoundTimeout); // Sicherstellen, dass Timer gestoppt ist
        clearInterval(gameState.countdownInterval); // Sicherstellen, dass visueller Countdown stoppt
        countdownDisplay.classList.add('hidden'); // Countdown ausblenden

        logoButton.classList.add('inactive', 'hidden');
        revealButton.classList.add('hidden');
        speedRoundIndicator.classList.add('hidden'); // Speed Round Indicator ausblenden

        // Track-Infos anzeigen
        document.getElementById('album-cover').src = gameState.currentTrack.album.images[0].url;
        document.getElementById('track-title').innerText = gameState.currentTrack.name;
        document.getElementById('track-artist').innerText = gameState.currentTrack.artists.map(a => a.name).join(', ');
        
        revealContainer.classList.remove('hidden');
        // Speichere den Zustand: Auflösung-Bildschirm
        lastGameScreenVisible = 'reveal-container';
    }

    revealButton.addEventListener('click', showResolution);

    function handleFeedback(isCorrect) {
        if (isCorrect) {
            // 5.1: Punkte berechnen und speichern
            const points = Math.max(1, gameState.diceValue - (gameState.attemptsMade - 1));
            if (gameState.currentPlayer === 1) {
                gameState.player1Score += points;
            } else {
                gameState.player2Score += points;
            }
        }
        
        // 4.4: Spieler wechseln
        gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
        appContainer.style.backgroundColor = gameState.currentPlayer === 1 ? 'var(--player1-color)' : 'var(--player2-color)';

        // Setze den Zustand zurück, bevor die nächste Runde beginnt
        lastGameScreenVisible = '';
        setTimeout(showDiceScreen, 500); // Kurze Pause vor der nächsten Runde
    }

    document.getElementById('correct-button').addEventListener('click', () => handleFeedback(true));
    document.getElementById('wrong-button').addEventListener('click', () => handleFeedback(false));

    function resetRoundUI() {
        revealContainer.classList.add('hidden');
        logoButton.classList.add('hidden');
        genreContainer.classList.add('hidden');
        diceContainer.classList.add('hidden');
        revealButton.classList.add('hidden'); // Stellen Sie sicher, dass der Reveal-Button versteckt ist
        speedRoundIndicator.classList.add('hidden'); // Stellen Sie sicher, dass der Speed-Round-Indikator versteckt ist
        
        // Entfernen Sie den Listener, um mehrfaches Hinzufügen zu vermeiden,
        // wenn der Logo-Button wieder verwendet wird.
        logoButton.removeEventListener('click', playTrackSnippet);
    }
    
    //=======================================================================
    // Phase 5: Spielende & Reset
    //=======================================================================
    
    function endGame() {
        gameScreen.classList.add('hidden');
        scoreScreen.classList.remove('hidden');
        appContainer.style.backgroundColor = 'transparent';

        // Speichere den Zustand als Score-Screen
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
        }, 7000);

        setTimeout(resetGame, 8000); // Nach Fade-Out
    }

    function resetGame() {
        scoreScreen.classList.add('hidden');
        appContainer.style.backgroundColor = 'var(--black)';
        
        // Spielstatus zurücksetzen
        gameState.player1Score = 0;
        gameState.player2Score = 0;
        gameState.currentPlayer = 1;
        gameState.currentRound = 0;
        gameState.diceValue = 0; // Neu hinzugefügt
        gameState.attemptsMade = 0; // Neu hinzugefügt
        gameState.maxAttempts = 0; // Neu hinzugefügt
        gameState.trackDuration = 0; // Neu hinzugefügt
        gameState.currentTrack = null; // Neu hinzugefügt
        gameState.isSpeedRound = false; // Neu hinzugefügt
        clearTimeout(gameState.speedRoundTimeout); // Neu hinzugefügt
        
        gameState.player1SpeedRound = Math.floor(Math.random() * 10) + 1;
        gameState.player2SpeedRound = Math.floor(Math.random() * 10) + 1;

        // Zurück zum Start (ohne Einflug-Animation)
        gameScreen.classList.remove('hidden');
        logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
        logoButton.addEventListener('click', startGame, { once: true });

        // Setze den letzten sichtbaren Screen zurück, da das Spiel neu startet
        lastGameScreenVisible = '';
    }

    //=======================================================================
    // Phase 6: Sonderfunktion "Speed-Round"
    //=======================================================================

    function showSpeedRoundAnimation() {
        return new Promise(resolve => {
            speedRoundIndicator.classList.remove('hidden');
            setTimeout(() => {
                speedRoundIndicator.classList.add('hidden');
                resolve();
            }, 4000);
        });
    }

     // NEU: Visueller Countdown für Speed-Round
    function startVisualSpeedRoundCountdown() {
        let timeLeft = 10;
        countdownDisplay.classList.remove('hidden');
        countdownDisplay.innerText = timeLeft;

        // Timer für die Auflösung nach 10 Sekunden (wenn der Countdown endet)
        gameState.speedRoundTimeout = setTimeout(() => {
            showResolution();
        }, 10000);

        // Interval für den visuellen Countdown
        gameState.countdownInterval = setInterval(() => {
            timeLeft--;
            countdownDisplay.innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(gameState.countdownInterval);
                countdownDisplay.classList.add('hidden');
                // showResolution wird bereits durch speedRoundTimeout aufgerufen
            }
        }, 1000); // Aktualisiert jede Sekunde
    }
});
