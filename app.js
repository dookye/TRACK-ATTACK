// Wichtiger Hinweis: Dieser Code muss von einem Webserver bereitgestellt werden (z.B. über "Live Server" in VS Code).
// Ein direktes Öffnen der HTML-Datei im Browser funktioniert wegen der Sicherheitsrichtlinien (CORS) bei API-Anfragen nicht.

document.addEventListener('DOMContentLoaded', () => {

    // --- Entwickler-Schalter zum Freischalten von Inhalten (für Tests) ---
    // Wenn auf 'true' gesetzt, werden diese Inhalte automatisch zum Testen freigeschaltet.
    // Für die finale App auf 'false' setzen oder entfernen, wenn die IAK-Logik integriert ist.
    const DEBUG_UNLOCK_ALL_GENRES = true; // Schaltet alle definierten Genres frei
    const DEBUG_UNLOCK_BAND_MODE = true; // Schaltet den Band-Modus frei
    // --- Ende Entwickler-Schalter ---


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
    const speedRoundTextDisplay = document.getElementById('speed-round-text-display');
    const speedRoundTimer = document.getElementById('speed-round-timer'); // Referenz nicht in HTML gefunden, prüfen.
    const countdownDisplay = document.getElementById('countdown-display');

    // NEU: DOM-Elemente für den Modus-Auswahl-Bildschirm
    const modeSelectionScreen = document.getElementById('mode-selection-screen');
    const multiGenreModeButton = document.getElementById('multi-genre-mode-button');
    const singleGenreModeButton = document.getElementById('single-genre-mode-button');
    const bandModeButton = document.getElementById('band-mode-button');

    // NEU: DOM-Elemente für den Band-Modus Bildschirm
    const bandModeScreen = document.getElementById('band-mode-screen'); // Muss noch in HTML ergänzt werden
    const bandSearchInput = document.getElementById('band-search-input'); // Muss noch in HTML ergänzt werden
    const bandSearchButton = document.getElementById('band-search-button'); // Muss noch in HTML ergänzt werden
    const bandModeDescription = document.getElementById('band-mode-description'); // Muss noch in HTML ergänzt werden
    const bandModePurchaseLink = document.getElementById('band-mode-purchase-link'); // Muss noch in HTML ergänzt werden


    // --- Spotify-Parameter (Phase 1.1) ---
    const CLIENT_ID = "53257f6a1c144d3f929a60d691a0c6f6";
    const REDIRECT_URI = "https://dookye.github.io/TRACK-ATTACK/"; // Später für Hybrid-App anpassen

    // NEU: Konfiguration für jeden Würfelwert
    const diceConfig = {
        1: { attempts: 1, duration: 7000 },
        2: { attempts: 2, duration: 7000 },
        3: { attempts: 3, duration: 7000 },
        4: { attempts: 4, duration: 7000 },
        5: { attempts: 5, duration: 7000 },
        7: { attempts: 7, duration: 2000 }
    };
            
    // --- Spielstatus-Variablen ---
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
        spotifyPlayTimeout: null,
        isSongPlaying: false,
        fadeInterval: null,
        currentSongVolume: 0,
        // NEU: Spielmodus
        currentMode: null, // 'multi-genre', 'single-genre', 'band-mode'
        selectedSingleGenre: null, // Für den Single-Genre-Modus

        // NEU: Kaufstatus (wird später von localStorage geladen und von IAKs aktualisiert)
        unlockedGenres: [], // Enthält IDs der freigeschalteten Genres
        hasBandMode: false, // True, wenn Band-Modus gekauft wurde
    };

    // NEU: Variable zum Speichern des letzten sichtbaren Spiel-Screens
    let lastGameScreenVisible = '';
            
    // NEU: Zentralisierte Definition ALLER Genres
    const allGenres = {
        // Standard-Genres (immer verfügbar)
        'pop': { name: 'Pop Hits 2000-2025', playlists: ['6mtYuOxzl58vSGnEDtZ9uB', '34NbomaTu7YuOYnky8nLXL'], default: true },
        'alltime': { name: 'Die größten Hits aller Zeiten', playlists: ['2si7ChS6Y0hPBt4FsobXpg', '2y09fNnXHvoqc1WGHvbhkZ'], default: true },
        'deutsch': { name: 'deutsche Größen von früher bis heute', playlists: ['7h64UGKHGWM5ucefn99frR', '4ytdW13RHl5u9dbRWAgxSZ'], default: true },
        'party': { name: 'Partyhits', playlists: ['53r5W67KJNIeHWAhVOWPDr', '37i9dQZF1DX9WU5Losjsy8'], default: true },

        // Kaufbare Genres (müssen freigeschaltet werden)
        'punk': { name: 'Punk Rock (90\'s & 00\')', playlists: ['0XfFzQ1234567890abcdef', '0YfFzQ1234567890abcdef'], default: false }, // Beispiel-Playlist-IDs
        'dpunk': { name: 'Deutscher Punk', playlists: ['1XfFzQ1234567890abcdef', '1YfFzQ1234567890abcdef'], default: false },
        'disney': { name: 'Disney Songs', playlists: ['2XfFzQ1234567890abcdef', '2YfFzQ1234567890abcdef'], default: false },
        'schlager': { name: 'Best Of Schlagerparty', playlists: ['3XfFzQ1234567890abcdef', '3YfFzQ1234567890abcdef'], default: false },
        'boygirlgroup': { name: 'Boy- and Girlgroups', playlists: ['4XfFzQ1234567890abcdef', '4YfFzQ1234567890abcdef'], default: false },
        'xmas': { name: 'Weihnachten', playlists: ['5XfFzQ1234567890abcdef', '5YfFzQ1234567890abcdef'], default: false }
    };

    // Deine ursprüngliche 'playlists' Variable wird durch 'allGenres' ersetzt,
    // oder 'getTrack' muss angepasst werden, um 'allGenres' zu nutzen.
    // Wir passen 'getTrack' an, da 'playlists' nur eine Untermenge ist.

    // Hilfsfunktion zum Laden des Spielstatus (inkl. Kaufstatus)
    function loadGameState() {
        const savedState = localStorage.getItem('musicQuizGameState');
        if (savedState) {
            const parsedState = JSON.parse(savedState);
            gameState.unlockedGenres = parsedState.unlockedGenres || [];
            gameState.hasBandMode = parsedState.hasBandMode || false;
            // Lade auch andere relevante Spielzustände wie Highscores etc.
            gameState.player1Score = parsedState.player1Score || 0;
            gameState.player2Score = parsedState.player2Score || 0;
            gameState.currentPlayer = parsedState.currentPlayer || 1;
            gameState.currentRound = parsedState.currentRound || 0;
            // Füge hier weitere Zustände hinzu, die du beibehalten möchtest
        }

        // Stelle sicher, dass die Standardgenres immer freigeschaltet sind
        Object.keys(allGenres).forEach(genreId => {
            if (allGenres[genreId].default && !gameState.unlockedGenres.includes(genreId)) {
                gameState.unlockedGenres.push(genreId);
            }
        });

        // DEBUG-Logik: Schalte Inhalte für Tests frei
        if (DEBUG_UNLOCK_ALL_GENRES) {
            Object.keys(allGenres).forEach(genreId => {
                if (!gameState.unlockedGenres.includes(genreId)) {
                    gameState.unlockedGenres.push(genreId);
                }
            });
        }
        if (DEBUG_UNLOCK_BAND_MODE) {
            gameState.hasBandMode = true;
        }

        // Optional: Entferne Duplikate, falls durch Debug-Logic welche entstehen
        gameState.unlockedGenres = [...new Set(gameState.unlockedGenres)];
    }

    // Hilfsfunktion zum Speichern des Spielstatus
    function saveGameState() {
        localStorage.setItem('musicQuizGameState', JSON.stringify({
            player1Score: gameState.player1Score,
            player2Score: gameState.player2Score,
            currentPlayer: gameState.currentPlayer,
            currentRound: gameState.currentRound,
            unlockedGenres: gameState.unlockedGenres,
            hasBandMode: gameState.hasBandMode,
            // Füge hier weitere Zustände hinzu, die du speichern möchtest
        }));
    }


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
        document.location = `https://accounts.spotify.com/authorize?${params.toString()}`; // Korrigierte Spotify Auth URL
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

        const result = await fetch("https://accounts.spotify.com/api/token", { // Korrigierte Spotify Token URL
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params
        });

        if (!result.ok) {
            console.error("Failed to get access token:", result.status, await result.text());
            alert("Fehler bei der Spotify-Anmeldung. Bitte versuchen Sie es erneut.");
            return null; // Im Fehlerfall null zurückgeben
        }

        const { access_token } = await result.json();
        return access_token;
    }

    // Initialisierung nach dem Laden der Seite
    loadGameState(); // Lade den Spielstatus frühzeitig
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
        // Wir kommen von der Spotify-Weiterleitung zurück
        window.history.pushState({}, '', REDIRECT_URI.split('?')[0]); // URL aufräumen, ohne Query-Parameter
        getAccessToken(code).then(token => {
            if (token) {
                accessToken = token;
                loginScreen.classList.add('hidden');
                fullscreenScreen.classList.remove('hidden'); // Erst zum Fullscreen-Screen
                initializePlayer();
                // NEU: Orientierungsprüfung und Listener nach erfolgreichem Login aktivieren
                window.addEventListener('resize', checkOrientation);
                checkOrientation();
            } else {
                // Fehler beim Token-Abruf, zurück zum Login
                loginScreen.classList.remove('hidden');
                document.getElementById('login-button').addEventListener('click', redirectToAuthCodeFlow);
            }
        });
    } else {
        // Standard-Ansicht: Login-Bildschirm oder, wenn schon eingeloggt, direkt zum Fullscreen
        if (localStorage.getItem('spotifyAccessToken')) { // Annahme: Token wird im localStorage gespeichert
            accessToken = localStorage.getItem('spotifyAccessToken'); // Token laden
            loginScreen.classList.add('hidden');
            fullscreenScreen.classList.remove('hidden');
            initializePlayer();
            window.addEventListener('resize', checkOrientation);
            checkOrientation();
        } else {
            loginScreen.classList.remove('hidden');
            document.getElementById('login-button').addEventListener('click', redirectToAuthCodeFlow);
        }
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
                // Optional: Speichere den Access Token, damit du nicht jedes Mal neu authentifizieren musst
                localStorage.setItem('spotifyAccessToken', accessToken);
            });

            spotifyPlayer.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
                // Hier könntest du den Nutzer zurück zum Login schicken oder eine Meldung anzeigen
            });

            spotifyPlayer.connect();
        };
    }

    // NEU: Event Listener für das Verlassen des Vollbildmodus
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            // Vollbildmodus wurde verlassen
            // Speichere den Zustand, BEVOR alles versteckt wird
            if (!logoButton.classList.contains('hidden') && !logoButton.classList.contains('initial-fly-in')) {
                lastGameScreenVisible = 'logo-button';
            } else if (!diceContainer.classList.contains('hidden')) {
                lastGameScreenVisible = 'dice-container';
            } else if (!genreContainer.classList.contains('hidden')) {
                lastGameScreenVisible = 'genre-container';
            } else if (!revealContainer.classList.contains('hidden')) {
                lastGameScreenVisible = 'reveal-container';
            } else if (!modeSelectionScreen.classList.contains('hidden')) { // NEU: Modus-Auswahl-Screen
                lastGameScreenVisible = 'mode-selection-screen';
            } else if (!bandModeScreen.classList.contains('hidden')) { // NEU: Band-Modus Screen
                lastGameScreenVisible = 'band-mode-screen';
            }
             else {
                lastGameScreenVisible = ''; // Wenn nichts Spezielles sichtbar war
            }


            // Alle Spiel-Elemente verstecken
            gameScreen.classList.add('hidden');
            revealContainer.classList.add('hidden');
            diceContainer.classList.add('hidden');
            genreContainer.classList.add('hidden');
            logoButton.classList.add('hidden');
            speedRoundTextDisplay.classList.add('hidden');
            revealButton.classList.add('hidden'); // AUFLÖSEN Button auch verstecken
            modeSelectionScreen.classList.add('hidden'); // NEU
            bandModeScreen.classList.add('hidden'); // NEU

            // Spotify-Player pausieren
            if (spotifyPlayer && gameState.isSongPlaying) { // Nur pausieren, wenn Song spielt
                spotifyPlayer.pause();
                gameState.isSongPlaying = false;
            }
            clearTimeout(gameState.speedRoundTimeout); // Speed-Round-Timer stoppen
            clearInterval(gameState.countdownInterval); // Countdown stoppen
            clearTimeout(gameState.spotifyPlayTimeout); // Song-Play-Timeout stoppen
            clearInterval(gameState.fadeInterval); // Fade-Interval stoppen


            // Den Vollbild-Screen wieder anzeigen
            fullscreenScreen.classList.remove('hidden');
        }
    });

            
    // 1.4: Vollbild-Modus aktivieren
    fullscreenScreen.addEventListener('click', () => {
        document.documentElement.requestFullscreen().then(() => {
            fullscreenScreen.classList.add('hidden');
            // gameScreen.classList.remove('hidden'); // Dies wird jetzt durch die Start-Modus-Funktion gesteuert

            // NEU: Stelle den letzten Zustand wieder her, oder zeige den Modus-Auswahl-Bildschirm
            if (lastGameScreenVisible === 'dice-container') {
                showDiceScreen();
            } else if (lastGameScreenVisible === 'genre-container') {
                showGenreScreen();
            } else if (lastGameScreenVisible === 'reveal-container') {
                showResolution(); // Zeigt nur die Auflösung, nicht das Abspielen
            } else if (lastGameScreenVisible === 'band-mode-screen') { // NEU: Band-Modus wiederherstellen
                showBandModeScreen();
            } else if (lastGameScreenVisible === 'score-screen') { // NEU: Score-Screen nach Spielende
                endGame(); // Zeigt den Score-Screen wieder an
            } else if (lastGameScreenVisible === 'logo-button') { // Wenn das Spiel im Logo-Zustand war
                gameScreen.classList.remove('hidden');
                logoButton.classList.remove('hidden');
                logoButton.addEventListener('click', startGame, { once: true }); // Listener wieder anfügen
            }
            else {
                // Wenn kein spezieller Zustand gespeichert ist oder das Spiel neu startet,
                // zeige den Modus-Auswahl-Bildschirm an
                showModeSelectionScreen();
            }
            // Stelle sicher, dass der gameScreen sichtbar ist, wenn wir in einen Spielmodus wechseln
            if (lastGameScreenVisible !== 'score-screen' && lastGameScreenVisible !== 'mode-selection-screen' && lastGameScreenVisible !== 'band-mode-screen') {
                 gameScreen.classList.remove('hidden');
            }
        });
    });

    //=======================================================================
    // NEU: Phase 2: Modus-Auswahl & Spielstart
    //=======================================================================

    // NEU: Funktion zum Anzeigen des Modus-Auswahl-Bildschirms
    function showModeSelectionScreen() {
        gameScreen.classList.remove('hidden'); // Sicherstellen, dass gameScreen sichtbar ist
        modeSelectionScreen.classList.remove('hidden');
        multiGenreModeButton.classList.remove('hidden'); // Sicherstellen, dass Standard-Modus-Buttons sichtbar sind
        singleGenreModeButton.classList.remove('hidden');


        // Band-Modus Button initialisieren (aktiv/inaktiv basierend auf Kaufstatus)
        if (!gameState.hasBandMode) {
            bandModeButton.disabled = true;
            bandModeButton.classList.add('locked-mode'); // CSS-Klasse für gesperrten Button
        } else {
            bandModeButton.disabled = false;
            bandModeButton.classList.remove('locked-mode');
        }

        // Event-Listener für die Modus-Buttons
        multiGenreModeButton.addEventListener('click', startMultiGenreMode, { once: true });
        singleGenreModeButton.addEventListener('click', startSingleGenreMode, { once: true });
        bandModeButton.addEventListener('click', startBandMode, { once: true });

        // Speichere den Zustand: Modus-Auswahl
        lastGameScreenVisible = 'mode-selection-screen';
    }

    // NEU: Start des Multi-Genre-Modus (dein aktuelles Spiel)
    function startMultiGenreMode() {
        gameState.currentMode = 'multi-genre';
        modeSelectionScreen.classList.add('hidden');
        logoButton.classList.remove('hidden', 'inactive'); // Logo sichtbar machen
        logoButton.classList.add('initial-fly-in'); // Fly-In Animation
        logoButton.addEventListener('click', startGameRound, { once: true }); // Startet die erste Runde
        appContainer.style.backgroundColor = 'var(--player1-color)'; // Farbe für Spieler 1

        resetGame(); // Spielzustand für neue Runde zurücksetzen (Punkte, Runden, etc.)
        lastGameScreenVisible = 'logo-button'; // Setze den Zustand für den Start des Spiels
    }

    // NEU: Start des Single-Genre-Modus
    function startSingleGenreMode() {
        gameState.currentMode = 'single-genre';
        modeSelectionScreen.classList.add('hidden');
        showSingleGenreSelectionScreen(); // Zeigt den Auswahlbildschirm für ein einzelnes Genre
        resetGame(); // Spielzustand zurücksetzen
    }

    // NEU: Start/Anzeige des Band-Modus
    function startBandMode() {
        gameState.currentMode = 'band-mode';
        modeSelectionScreen.classList.add('hidden');
        showBandModeScreen(); // Zeigt den Band-Modus Bildschirm
        resetGame(); // Spielzustand zurücksetzen
    }

    function triggerBounce() {
    const logoButton = document.getElementById('logo-button');
    logoButton.classList.add('bounce');
    logoButton.addEventListener('animationend', () => {
        logoButton.classList.remove('bounce');
    }, { once: true });
}

    // NEU: Anpassung der startGame-Funktion, die jetzt die erste Runde initiiert
    function startGameRound() {
        triggerBounce(logoButton);
        logoButton.classList.add('inactive'); // Button nach dem Klick inaktiv machen

        setTimeout(() => {
            // appContainer.style.backgroundColor wird schon in startMultiGenreMode gesetzt
            logoButton.classList.add('hidden');
            showDiceScreen(); // Startet die Würfel-Phase für die erste Runde
        }, 800);
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
            const selectedValue = parseInt(e.target.dataset.value);
            gameState.diceValue = selectedValue;

            // Prüfen, ob der ausgewählte Würfel in unserer Konfiguration existiert
            const config = diceConfig[selectedValue];
            if (!config) {
                console.error(`Konfiguration für Würfelwert ${selectedValue} nicht gefunden!`);
                return; // Beende die Funktion, um Fehler zu vermeiden
            }

            setTimeout(() => {
                gameState.trackDuration = config.duration;
                gameState.maxAttempts = config.attempts;
                gameState.attemptsMade = 0;

                diceContainer.classList.add('hidden');
                // Hier verzweigen wir basierend auf dem Spielmodus
                if (gameState.currentMode === 'single-genre') {
                    // Im Single-Genre-Modus direkt zum Raten, da Genre schon gewählt
                    handleGenreSelection({ target: { dataset: { genre: gameState.selectedSingleGenre } } });
                } else {
                    showGenreSelectionScreen(); // Rufe die umbenannte Funktion auf
                }
            }, 150);
        });
    });
            
    // NEU: Funktion zur Ausführung der Blink-Animation
    function runGenreAnimation(buttons) {
        return new Promise(resolve => {
            buttons.forEach(btn => btn.classList.add('no-interaction'));
            const blinkInterval = setInterval(() => {
                buttons.forEach(btn => btn.classList.toggle('random-blink'));
            }, 100);

            setTimeout(() => {
                clearInterval(blinkInterval);
                buttons.forEach(btn => btn.classList.remove('random-blink'));
                buttons.forEach(btn => btn.classList.remove('no-interaction'));
                resolve(); // Löst das Promise auf, wenn die Animation fertig ist
            }, 4000);
        });
    }
            
    // NEU: Umbenannt von showGenreScreen zu showGenreSelectionScreen
    async function showGenreSelectionScreen() {
        genreContainer.classList.remove('hidden');
        // Entferne alte Buttons, um sie neu zu rendern basierend auf gekauftem Status
        genreContainer.innerHTML = ''; 

        const availableGenres = Object.keys(allGenres).filter(genreId => gameState.unlockedGenres.includes(genreId));
        const purchasableGenres = Object.keys(allGenres).filter(genreId => !gameState.unlockedGenres.includes(genreId));

        // Erstelle Buttons für verfügbare Genres
        availableGenres.forEach(genreId => {
            const genreData = allGenres[genreId];
            const button = document.createElement('button');
            button.classList.add('genre-button');
            button.dataset.genre = genreId;
            button.innerText = genreData.name;
            genreContainer.appendChild(button);
            // Füge Event-Listener für aktive Buttons hinzu
            button.addEventListener('click', handleGenreSelection, { once: true });
        });

        // Erstelle Buttons für kaufbare Genres (ausgegraut)
        purchasableGenres.forEach(genreId => {
            const genreData = allGenres[genre.id]; // Hier war ein Fehler, sollte genreId sein
            const button = document.createElement('button');
            button.classList.add('genre-button', 'locked-genre'); // Neue Klasse für ausgegraut
            button.dataset.genre = genreId;
            button.innerText = genreData.name + ' (Kaufen)'; // Text anpassen
            button.disabled = true; // Zunächst deaktivieren, da nur zum Anzeigen
            genreContainer.appendChild(button);
            // Optional: Event-Listener hier für Kaufprozess hinzufügen
            // button.addEventListener('click', () => showPurchasePrompt(genreId));
        });

        const buttons = document.querySelectorAll('.genre-button'); // Neue Referenz nach HTML-Update
        buttons.forEach(btn => {
            btn.disabled = false; // Setze alle Buttons erst einmal auf klickbar (wird unten überschrieben)
            btn.classList.remove('random-blink');
        });

        // Speichere den Zustand: Genre-Bildschirm
        lastGameScreenVisible = 'genre-container';

        // Führe die gleiche Blink-Animation für beide Fälle aus
        await runGenreAnimation(buttons);

        // Die Logik für die Button-Aktivierung/-Deaktivierung kommt jetzt NACH der Animation
        // DIESE LOGIK GILT NUR FÜR DEN MULTI-GENRE-MODUS (UND IST DEINE BESTEHENDE LOGIK)
        // Im Single-Genre-Modus ist dies anders.
        if (gameState.currentMode === 'multi-genre') {
            if (gameState.diceValue === 7) { // Fall B: WÜRFEL 7
                        
                // 1. Alle freigeschalteten Genre-Buttons sind klickbar (standardmäßig)
                document.querySelectorAll('.genre-button:not(.locked-genre)').forEach(btn => btn.disabled = false);

                // 2. Wähle ein zufälliges freigeschaltetes Genre aus, das inaktiv sein soll
                const activeButtons = Array.from(document.querySelectorAll('.genre-button:not(.locked-genre)'));
                if (activeButtons.length > 0) {
                    const randomIndex = Math.floor(Math.random() * activeButtons.length);
                    const disabledButton = activeButtons[randomIndex];
                            
                    // 3. Deaktiviere das ausgewählte Genre
                    disabledButton.disabled = true;
                    disabledButton.classList.add('disabled-genre');
                }
                        
                // Füge Event-Listener für alle AKTIVEN Buttons hinzu (nicht für die gesperrten oder deaktivierten)
                document.querySelectorAll('.genre-button:not(.locked-genre):not(.disabled-genre)').forEach(btn => {
                    btn.addEventListener('click', handleGenreSelection, { once: true });
                });

            } else { // Fall A: WÜRFEL 1-5
                        
                // 1. Erst alle freigeschalteten Buttons deaktivieren
                document.querySelectorAll('.genre-button:not(.locked-genre)').forEach(btn => btn.disabled = true);
                        
                // 2. Dann ein zufälliges freigeschaltetes Genre auswählen und aktivieren
                const activeButtons = Array.from(document.querySelectorAll('.genre-button:not(.locked-genre)'));
                if (activeButtons.length > 0) {
                    const randomIndex = Math.floor(Math.random() * activeButtons.length);
                    const activeButton = activeButtons[randomIndex];

                    activeButton.disabled = false;
                    activeButton.classList.remove('disabled-genre'); // Optional: Entferne eine mögliche visuelle Klasse

                    // Füge den Event-Listener nur für den aktiven Button hinzu
                    activeButton.addEventListener('click', handleGenreSelection, { once: true });
                }
            }
        } else if (gameState.currentMode === 'single-genre') {
            // Im Single-Genre-Modus sind alle freigeschalteten Genres direkt klickbar.
            document.querySelectorAll('.genre-button:not(.locked-genre)').forEach(btn => {
                btn.disabled = false;
                btn.classList.remove('disabled-genre');
                btn.addEventListener('click', (e) => {
                    // Speichere das einmalig ausgewählte Genre für den Single-Genre-Modus
                    gameState.selectedSingleGenre = e.target.dataset.genre;
                    handleGenreSelection(e); // Führt die normale Genre-Handhabung aus
                }, { once: true });
            });
            // Gesperrte Genres bleiben disabled und sehen so aus wie 'locked-genre'
        }
    }

    async function handleGenreSelection(e) {
        const selectedGenre = e.target.dataset.genre;
        genreContainer.classList.add('hidden');
        // Entferne alle Event-Listener von Genre-Buttons, um doppelte Aufrufe zu vermeiden
        document.querySelectorAll('.genre-button').forEach(btn => btn.removeEventListener('click', handleGenreSelection));
                
        // NEU: Speed-Round Check NACHDEM Genre gewählt wurde, aber VOR dem Track-Laden
        const playerRound = Math.ceil(gameState.currentRound / 2);
        if ((gameState.currentPlayer === 1 && playerRound === gameState.player1SpeedRound) ||
            (gameState.currentPlayer === 2 && playerRound === gameState.player2SpeedRound)) {
            gameState.isSpeedRound = true;
            // Zeige die "Speed-Round" Animation, bevor der Track geladen wird
            await showSpeedRoundAnimation();
        }

        await prepareAndShowRateScreen(selectedGenre);
    }

    //=======================================================================
    // Phase 4: Rate-Bildschirm & Spielerwechsel
    //=======================================================================
            
    // NEU: getTrack Funktion angepasst, um allGenres zu nutzen und Abspielbarkeit zu prüfen
    async function getTrack(genreId) {
        const genreData = allGenres[genreId];
        if (!genreData || !genreData.playlists || genreData.playlists.length === 0) {
            console.error(`Keine Playlist-Daten für Genre-ID: ${genreId}`);
            alert("Fehler: Genre-Daten nicht gefunden. Bitte versuchen Sie es erneut.");
            showGenreSelectionScreen(); // Zurück zur Genre-Auswahl
            return null;
        }

        const playlistPool = genreData.playlists;
        const maxAttemptsOverall = 10; // Sicherheitsnetz für die gesamte Suche
        let currentOverallAttempts = 0;

        while (currentOverallAttempts < maxAttemptsOverall) {
            const randomPlaylistId = playlistPool[Math.floor(Math.random() * playlistPool.length)];
                    
            try {
                const response = await fetch(`https://api.spotify.com/v1/playlists/${randomPlaylistId}/tracks`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                if (!response.ok) {
                    console.warn(`Fehler beim Abrufen der Playlist-Tracks von ${randomPlaylistId}:`, response.status, response.statusText);
                    currentOverallAttempts++;
                    continue; // Versuche nächste Playlist
                }

                const data = await response.json();
                const tracks = data.items;

                if (!tracks || tracks.length === 0) {
                    console.warn(`Keine Tracks in Playlist ${randomPlaylistId} gefunden.`);
                    currentOverallAttempts++;
                    continue; // Versuche nächste Playlist
                }

                let track = null;
                let attemptsInPlaylist = 0;
                const maxAttemptsInPlaylist = 10; // Sicherheitsnetz pro Playlist

                // Schleife, um einen abspielbaren Song aus dieser Playlist zu finden
                while (track === null && attemptsInPlaylist < maxAttemptsInPlaylist) {
                    const randomIndex = Math.floor(Math.random() * tracks.length);
                    const potentialTrack = tracks[randomIndex].track;

                    // Überprüfen, ob der Song existiert, abspielbar ist und die Mindestdauer erfüllt
                    if (potentialTrack && potentialTrack.is_playable && potentialTrack.duration_ms >= (gameState.trackDuration + 5000)) {
                        track = potentialTrack;
                    } else {
                        attemptsInPlaylist++;
                        // console.warn(`Versuch ${attemptsInPlaylist}: Song "${potentialTrack?.name || 'Unbekannt'}" nicht passend (is_playable: ${potentialTrack?.is_playable}, duration: ${potentialTrack?.duration_ms}).`);
                    }
                }

                if (track) {
                    return track; // Abspielbarer Track gefunden
                } else {
                    console.warn(`Konnte in Playlist ${randomPlaylistId} keinen passenden Track nach ${maxAttemptsInPlaylist} Versuchen finden.`);
                    currentOverallAttempts++;
                }

            } catch (error) {
                console.error(`Fehler beim Verarbeiten der Playlist ${randomPlaylistId}:`, error);
                currentOverallAttempts++;
            }
        }

        alert("Konnte nach mehreren Versuchen keinen spielbaren Song finden. Bitte wähle ein anderes Genre oder versuche es später erneut.");
        showGenreSelectionScreen(); // Zurück zur Genre-Auswahl
        return null;
    }
    
    // NEU: Funktion zum Abrufen eines Tracks im Band-Modus (angepasst)
    async function getTrackFromArtist(artistName) {
        if (!artistName) return null;

        const maxAttemptsOverall = 10; // Sicherheitsnetz für die gesamte Suche
        let currentOverallAttempts = 0;
        let track = null;

        while (track === null && currentOverallAttempts < maxAttemptsOverall) {
            try {
                // 1. Künstler-ID suchen
                const artistSearchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                if (!artistSearchResponse.ok) {
                    console.error("Fehler bei Künstlersuche:", artistSearchResponse.status, artistSearchResponse.statusText);
                    // Hier brechen wir ab, da der Künstler nicht gefunden wurde
                    alert("Künstler konnte nicht gefunden werden. Bitte versuchen Sie es erneut.");
                    return null;
                }
                const artistSearchData = await artistSearchResponse.json();
                const artistId = artistSearchData.artists.items[0]?.id;

                if (!artistId) {
                    alert("Künstler nicht gefunden. Bitte versuchen Sie einen anderen Namen.");
                    return null;
                }

                // NEU: Alben des Künstlers abrufen
                const albumsResponse = await fetch(`https://accounts.spotify.com/api/token65{artistId}/albums?include_groups=album,single&market=DE&limit=50`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                if (!albumsResponse.ok) {
                    console.error("Fehler beim Abrufen der Alben:", albumsResponse.status, albumsResponse.statusText);
                    alert("Alben für diesen Künstler konnten nicht geladen werden.");
                    currentOverallAttempts++;
                    continue;
                }
                const albumsData = await albumsResponse.json();
                const albums = albumsData.items;

                if (!albums || albums.length === 0) {
                    console.warn(`Keine Alben für Künstler ${artistName} gefunden.`);
                    alert("Konnte keine Alben für diesen Künstler finden. Versuchen Sie einen anderen.");
                    return null;
                }

                let currentAlbumAttempts = 0;
                const maxAlbumAttempts = 5; // Versuche, ein Album mit spielbaren Tracks zu finden

                while (track === null && currentAlbumAttempts < maxAlbumAttempts) {
                    const randomAlbum = albums[Math.floor(Math.random() * albums.length)];

                    // 2. Tracks des zufällig ausgewählten Albums abrufen
                    const albumTracksResponse = await fetch(`https://accounts.spotify.com/api/token66{randomAlbum.id}/tracks?market=DE`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    if (!albumTracksResponse.ok) {
                        console.warn(`Fehler beim Abrufen der Tracks von Album ${randomAlbum.name}:`, albumTracksResponse.status, albumTracksResponse.statusText);
                        currentAlbumAttempts++;
                        continue;
                    }
                    const albumTracksData = await albumTracksResponse.json();
                    const albumTracks = albumTracksData.items;

                    if (!albumTracks || albumTracks.length === 0) {
                        console.warn(`Keine Tracks in Album ${randomAlbum.name} gefunden.`);
                        currentAlbumAttempts++;
                        continue;
                    }

                    let attemptsInAlbum = 0;
                    const maxAttemptsInAlbum = 10; // Sicherheitsnetz pro Album

                    // Schleife, um einen abspielbaren Song aus diesem Album zu finden
                    while (track === null && attemptsInAlbum < maxAttemptsInAlbum) {
                        const randomIndex = Math.floor(Math.random() * albumTracks.length);
                        const potentialTrack = albumTracks[randomIndex]; // Hier ist es direkt der Track

                        // Überprüfen, ob der Song existiert, abspielbar ist und die Mindestdauer erfüllt
                        if (potentialTrack && potentialTrack.is_playable && potentialTrack.duration_ms >= (gameState.trackDuration + 5000)) {
                            track = potentialTrack;
                        } else {
                            attemptsInAlbum++;
                            // console.warn(`Versuch ${attemptsInAlbum}: Song "${potentialTrack?.name || 'Unbekannt'}" im Album "${randomAlbum.name}" nicht passend.`);
                        }
                    }

                    if (track) {
                        return track; // Abspielbarer Track gefunden
                    } else {
                        console.warn(`Konnte in Album ${randomAlbum.name} keinen passenden Track nach ${maxAttemptsInAlbum} Versuchen finden.`);
                        currentAlbumAttempts++;
                    }
                }

                if (track === null) {
                    console.warn(`Konnte nach ${maxAlbumAttempts} Album-Versuchen keinen passenden Track für Künstler ${artistName} finden.`);
                    currentOverallAttempts++;
                }

            } catch (error) {
                console.error(`Fehler beim Abrufen von Künstler-Tracks (${artistName}):`, error);
                currentOverallAttempts++;
            }
        }

        alert("Konnte nach mehreren Versuchen keinen spielbaren Song von diesem Künstler finden. Versuchen Sie einen anderen Künstler.");
        return null;
    }

    async function prepareAndShowRateScreen(genreOrArtistData) {
        if (gameState.currentMode === 'band-mode') {
            gameState.currentTrack = await getTrackFromArtist(genreOrArtistData); // genreOrArtistData ist hier der Künstlername
        } else {
            gameState.currentTrack = await getTrack(genreOrArtistData); // genreOrArtistData ist hier die Genre-ID
        }
        
        if (!gameState.currentTrack) {
            // Fehler wurde bereits in getTrack/getTrackFromArtist behandelt, zurück zum vorherigen Screen
            if (gameState.currentMode === 'band-mode') {
                showBandModeScreen();
            } else {
                showGenreSelectionScreen();
            }
            return;
        }
        
        console.log("Selected Track:", gameState.currentTrack.name, "by", gameState.currentTrack.artists.map(a => a.name).join(', '));

        // Alle relevanten Bildschirme ausblenden
        if (gameState.currentMode === 'band-mode') {
            bandModeScreen.classList.add('hidden');
        } else {
            genreContainer.classList.add('hidden');
        }
        
        logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
        logoButton.removeEventListener('click', playTrackSnippet); // Sicherstellen, dass nur ein Listener aktiv ist
        logoButton.addEventListener('click', playTrackSnippet);

        // Speichere den Zustand: Raten-Bildschirm
        lastGameScreenVisible = 'reveal-container';
    }

    function playTrackSnippet() {
        if (gameState.attemptsMade >= gameState.maxAttempts && !gameState.isSpeedRound) {
            // Im normalen Modus: Keine weiteren Versuche
            return;
        }
        if (gameState.isSpeedRound && gameState.attemptsMade > 0) {
            // In der Speed-Round: Nur ein Versuch erlaubt (erster Klick)
            return;
        }

        triggerBounce(logoButton);
        logoButton.classList.add('inactive'); // Button nach dem Klick inaktiv machen
        gameState.attemptsMade++;

        const trackDurationMs = gameState.currentTrack.duration_ms;
        const randomStartPosition = Math.floor(Math.random() * (trackDurationMs - gameState.trackDuration));

        fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, { // Korrigierte Spotify Play URL
            method: 'PUT',
            body: JSON.stringify({
                uris: [gameState.currentTrack.uri],
                position_ms: randomStartPosition
            }),
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }).then(response => {
            if (!response.ok) { // Fehlerbehandlung für Play-Request
                console.error("Fehler beim Abspielen des Tracks:", response.status, response.statusText);
                alert("Konnte den Song nicht abspielen. Stellen Sie sicher, dass ein Gerät ausgewählt ist und Spotify Premium aktiv ist.");
                logoButton.classList.remove('inactive'); // Button wieder aktiv machen
                return;
            }
            gameState.isSongPlaying = true; // Song spielt

            if (gameState.isSpeedRound) {
                startVisualSpeedRoundCountdown(); // Startet den 7s Countdown
                // Der Song wird nur einmal gespielt. Nach 7s wird aufgelöst.
            } else {
                // Normaler Modus: Song pausiert nach trackDuration
                gameState.spotifyPlayTimeout = setTimeout(() => {
                    if (spotifyPlayer && gameState.isSongPlaying) {
                        spotifyPlayer.pause();
                        gameState.isSongPlaying = false;
                    }
                    if (gameState.attemptsMade < gameState.maxAttempts) {
                        logoButton.classList.remove('inactive'); // Wieder aktiv, wenn noch Versuche da sind
                    }
                }, gameState.trackDuration);
            }
        }).catch(error => { // Fehlerbehandlung für den Fetch-Request selbst
            console.error("Netzwerkfehler beim Abspielen des Tracks:", error);
            alert("Problem beim Verbinden mit Spotify. Bitte überprüfen Sie Ihre Internetverbindung.");
            logoButton.classList.remove('inactive');
        });

        // "AUFLÖSEN"-Button nach 1. Versuch anzeigen (gilt auch für Speed-Round, aber wird dann durch Timer überschrieben)
        if (gameState.attemptsMade === 1) {
            revealButton.classList.remove('hidden');
        }
    }

    function showResolution() {
        // Alle Timer und Intervalle der Speed-Round stoppen
        clearTimeout(gameState.speedRoundTimeout);
        clearInterval(gameState.countdownInterval);
        clearTimeout(gameState.spotifyPlayTimeout); // Auch den Song-Pause-Timer stoppen
        clearInterval(gameState.fadeInterval); // WICHTIG: Fade-In-Intervall stoppen
        
        // Spotify Player pausieren, falls noch aktiv
        if (gameState.isSongPlaying && spotifyPlayer) {
            spotifyPlayer.pause();
            gameState.isSongPlaying = false;
        }

        // UI-Elemente ausblenden
        countdownDisplay.classList.add('hidden');
        countdownDisplay.classList.remove('countdown-animated'); // Animationsklasse entfernen
        countdownDisplay.innerText = ''; // Inhalt leeren

        logoButton.classList.add('inactive', 'hidden');
        revealButton.classList.add('hidden');
        speedRoundTextDisplay.classList.add('hidden'); // Der Speed-Round Text sollte auch weg

        // Track-Infos anzeigen
        document.getElementById('album-cover').src = gameState.currentTrack.album.images[0].url;
        document.getElementById('track-title').innerText = gameState.currentTrack.name;
        document.getElementById('track-artist').innerText = gameState.currentTrack.artists.map(a => a.name).join(', ');
                
        revealContainer.classList.remove('hidden');
        // Speichere den Zustand: Auflösung-Bildschirm
        lastGameScreenVisible = 'reveal-container';
                
        // NEU: Song bei Auflösung abspielen
        playSongForResolution();
    }

    // NEU: Funktion zum Abspielen des Songs bei Auflösung
    async function playSongForResolution() {
        if (!gameState.currentTrack || !deviceId) {
            console.warn("Kein Track oder Gerät verfügbar, kann Song nicht abspielen.");
            return;
        }

        const startPositionMs = 30 * 1000; // 30 Sekunden in Millisekunden
        const targetVolume = 80; // Ziel-Lautstärke in %
        const fadeDuration = 2000; // Fade-In Dauer in Millisekunden (z.B. 2 Sekunden)
        const fadeStep = 5; // Schrittweite für die Lautstärkeanpassung
        const intervalTime = fadeDuration / (targetVolume / fadeStep); // Intervallzeit für jeden Schritt

        // Sicherstellen, dass die Lautstärke auf 0 gesetzt ist, bevor wir starten
        if (spotifyPlayer) {
            spotifyPlayer.setVolume(0).then(() => {
                gameState.currentSongVolume = 0; // Setze interne Volume auf 0

                // Song bei Sekunde 30 starten
                fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        uris: [gameState.currentTrack.uri],
                        position_ms: startPositionMs
                    }),
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                }).then(response => {
                    if (!response.ok) {
                        console.error("Fehler beim Starten des Songs für Auflösung:", response.status, response.statusText);
                        return;
                    }
                    gameState.isSongPlaying = true; // Song spielt jetzt

                    // Starte Fade-In
                    gameState.fadeInterval = setInterval(() => {
                        if (gameState.currentSongVolume < targetVolume) {
                            gameState.currentSongVolume = Math.min(gameState.currentSongVolume + fadeStep, targetVolume);
                            spotifyPlayer.setVolume(gameState.currentSongVolume / 100); // Spotify Volume erwartet 0.0 bis 1.0
                        } else {
                            clearInterval(gameState.fadeInterval); // Fade-In beendet
                            gameState.fadeInterval = null;
                        }
                    }, intervalTime);
                }).catch(error => {
                    console.error("Netzwerkfehler beim Starten des Songs für Auflösung:", error);
                });
            }).catch(error => {
                console.error("Fehler beim Setzen der Initiallautstärke auf 0:", error);
            });
        }
    }

    // NEU: Funktion für Fade-Out
    function fadeAudioOut() {
        return new Promise(resolve => {
            if (!spotifyPlayer || !gameState.isSongPlaying) {
                resolve(); // Nichts zu faden oder Song spielt nicht
                return;
            }

            clearInterval(gameState.fadeInterval); // Sicherstellen, dass kein Fade-In mehr läuft

            const fadeDuration = 500; // Fade-Out Dauer in Millisekunden (z.B. 0.5 Sekunden)
            const fadeStep = 5; // Schrittweite für die Lautstärkeanpassung
            const currentVolumePercent = gameState.currentSongVolume; // Letzte Lautstärke vom Fade-In

            // Berechne die Intervallzeit basierend auf der aktuellen Lautstärke
            const intervalTime = fadeDuration / (currentVolumePercent / fadeStep);

            gameState.fadeInterval = setInterval(() => {
                if (gameState.currentSongVolume > 0) {
                    gameState.currentSongVolume = Math.max(0, gameState.currentSongVolume - fadeStep);
                    spotifyPlayer.setVolume(gameState.currentSongVolume / 100);
                } else {
                    clearInterval(gameState.fadeInterval);
                    gameState.fadeInterval = null;
                    resolve(); // Fade-Out abgeschlossen
                }
            }, intervalTime);
        });
    }

    revealButton.addEventListener('click', showResolution);

    function handleFeedback(isCorrect) {
        // NEU: Starte den Fade-Out, bevor der Rest der Logik ausgeführt wird
        fadeAudioOut().then(() => {
            // Dieser Code wird ausgeführt, NACHDEM der Fade-Out beendet ist
            if (gameState.isSongPlaying && spotifyPlayer) {
                spotifyPlayer.pause();
                gameState.isSongPlaying = false;
            }
            
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
            
        }); 
    }

    document.getElementById('correct-button').addEventListener('click', () => handleFeedback(true));
    document.getElementById('wrong-button').addEventListener('click', () => handleFeedback(false));

    function resetRoundUI() {
        revealContainer.classList.add('hidden');
        logoButton.classList.add('hidden');
        genreContainer.classList.add('hidden');
        diceContainer.classList.add('hidden');
        revealButton.classList.add('hidden'); // Stellen Sie sicher, dass der Reveal-Button versteckt ist
        speedRoundTextDisplay.classList.add('hidden'); // Stellen Sie sicher, dass der speedRoundTextDisplay versteckt ist
        
        // Entfernen Sie den Listener, um mehrfaches Hinzufügen zu vermeiden,
        // wenn der Logo-Button wieder verwendet wird.
        logoButton.removeEventListener('click', playTrackSnippet);

        //NEU:
        // Sicherstellen, dass alle Timer und Intervalle der vorherigen Runde gestoppt sind
        clearTimeout(gameState.speedRoundTimeout);
        clearInterval(gameState.countdownInterval);
        clearTimeout(gameState.spotifyPlayTimeout);
        clearInterval(gameState.fadeInterval);

        // Spotify Player pausieren, falls noch aktiv
        if (gameState.isSongPlaying && spotifyPlayer) {
            spotifyPlayer.pause();
            gameState.isSongPlaying = false;
        }

        // NEU: Lautstärke auf 100% zurücksetzen, BEVOR der nächste Song startet
        if (spotifyPlayer) { // Prüfen, ob der Player initialisiert ist
            spotifyPlayer.setVolume(1.0) // 1.0 entspricht 100%
                .then(() => {
                    console.log("Lautstärke für Rateteil auf 100% zurückgesetzt.");
                })
                .catch(error => {
                    console.error("Fehler beim Zurücksetzen der Lautstärke:", error);
                });
        }
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
                
        // Spielstatus zurücksetzen (für eine neue Spielsession)
        gameState.player1Score = 0;
        gameState.player2Score = 0;
        gameState.currentPlayer = 1;
        gameState.currentRound = 0;
        gameState.diceValue = 0;
        gameState.attemptsMade = 0;
        gameState.maxAttempts = 0;
        gameState.trackDuration = 0;
        gameState.currentTrack = null;
        gameState.isSpeedRound = false;
        clearTimeout(gameState.speedRoundTimeout);
                
        gameState.player1SpeedRound = Math.floor(Math.random() * 10) + 1;
        gameState.player2SpeedRound = Math.floor(Math.random() * 10) + 1;

        // Nach einem Spielende zurück zur Modus-Auswahl
        showModeSelectionScreen();
        // lastGameScreenVisible wird in showModeSelectionScreen gesetzt
    }

    //=======================================================================
    // Phase 6: Sonderfunktion "Speed-Round"
    //=======================================================================

    function showSpeedRoundAnimation() {
        return new Promise(resolve => {
            speedRoundTextDisplay.classList.remove('hidden');
            setTimeout(() => {
                speedRoundTextDisplay.classList.add('hidden');
                resolve();
            }, 4000);
        });
    }

    // NEU / ÜBERARBEITET: startVisualSpeedRoundCountdown
    function startVisualSpeedRoundCountdown() {
        let timeLeft = 7; // Startwert des Countdowns
        countdownDisplay.classList.remove('hidden');

        gameState.speedRoundTimeout = setTimeout(() => {
            showResolution();
        }, 7000);

        countdownDisplay.innerText = timeLeft;
        countdownDisplay.classList.remove('countdown-animated');
        void countdownDisplay.offsetWidth;
        countdownDisplay.classList.add('countdown-animated');

        gameState.countdownInterval = setInterval(() => {
            timeLeft--;

            if (timeLeft >= 0) {
                countdownDisplay.innerText = timeLeft;
                countdownDisplay.classList.remove('countdown-animated');
                void countdownDisplay.offsetWidth;
                countdownDisplay.classList.add('countdown-animated');
            }

            if (timeLeft < 0) {
                clearInterval(gameState.countdownInterval);
                countdownDisplay.classList.add('hidden');
                countdownDisplay.innerText = '';
            }
        }, 1000);
    }


    //=======================================================================
    // NEU: Funktionen für den Band-Modus (noch zu implementieren)
    //=======================================================================

    // NEU: Funktion zum Anzeigen des Band-Modus Bildschirms
    function showBandModeScreen() {
        gameScreen.classList.remove('hidden'); // Sicherstellen, dass gameScreen sichtbar ist
        bandModeScreen.classList.remove('hidden');
        
        // Zeige die Band-Suche oder die Kaufaufforderung
        if (gameState.hasBandMode) {
            bandSearchInput.disabled = false;
            bandSearchButton.disabled = false;
            bandModeDescription.classList.add('hidden');
            bandModePurchaseLink.classList.add('hidden');
            // Event-Listener für Band-Suche hinzufügen
            bandSearchButton.addEventListener('click', handleBandSearch, { once: true });
        } else {
            bandSearchInput.disabled = true;
            bandSearchButton.disabled = true;
            bandModeDescription.classList.remove('hidden');
            bandModePurchaseLink.classList.remove('hidden');
            // Hier könnte man einen Event-Listener für den Kauf-Link hinzufügen
            // bandModePurchaseLink.addEventListener('click', showBandModePurchasePrompt);
        }

        // Speichere den Zustand: Band-Modus-Bildschirm
        lastGameScreenVisible = 'band-mode-screen';
    }

    // NEU: Logik, wenn der Nutzer im Band-Modus eine Band sucht
    async function handleBandSearch() {
        const artistName = bandSearchInput.value.trim();
        if (!artistName) {
            alert("Bitte gib einen Künstlernamen ein!");
            return;
        }

        // Deaktiviere Eingabe und Button während der Suche
        bandSearchInput.disabled = true;
        bandSearchButton.disabled = true;

        // Versuche, einen Track vom Künstler abzurufen
        gameState.currentTrack = await getTrackFromArtist(artistName);

        if (gameState.currentTrack) {
            // Track gefunden, starte das Spiel mit diesem Track
            // Zurücksetzen der Versuche für die neue Runde
            gameState.attemptsMade = 0; 
            gameState.maxAttempts = diceConfig[gameState.diceValue].attempts; // Nutze den aktuellen Würfelwert
            gameState.trackDuration = diceConfig[gameState.diceValue].duration;

            bandModeScreen.classList.add('hidden');
            // Zeige das Logo an und starte den Runden-Flow
            logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
            logoButton.addEventListener('click', playTrackSnippet, { once: true });
            lastGameScreenVisible = 'reveal-container'; // Wird dann später der Rateteil
        } else {
            // Kein Track gefunden, reaktiviere Eingabe und Button
            bandSearchInput.disabled = false;
            bandSearchButton.disabled = false;
            // Fehler wurde schon in getTrackFromArtist behandelt
        }
    }


}); // Ende DOMContentLoaded
