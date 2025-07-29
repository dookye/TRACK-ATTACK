// Wichtiger Hinweis: Dieser Code muss von einem Webserver bereitgestellt werden (z.B. über "Live Server" in VS Code).
// Ein direktes Öffnen der HTML-Datei im Browser funktioniert wegen der Sicherheitsrichtlinien (CORS) bei API-Anfragen nicht.


// --- API Endpunkte --- NEU HINZUGEFÜGT
const API_ENDPOINTS = {
    SPOTIFY_AUTH: 'https://accounts.spotify.com/authorize',
    SPOTIFY_TOKEN: 'https://accounts.spotify.com/api/token',
    SPOTIFY_PLAYLIST_TRACKS: (playlistId) => `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    SPOTIFY_PLAYER_PLAY: (deviceId) => `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
};

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM-Elemente ---
    const appContainer = document.getElementById('app-container');
    const loginScreen = document.getElementById('login-screen');
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
    const speedRoundTimer = document.getElementById('speed-round-timer');
    const countdownDisplay = document.getElementById('countdown-display');
    const trackAlbum = document.getElementById('track-album');
    const trackYear = document.getElementById('track-year');
    const correctButton = document.getElementById('correct-button');
    const wrongButton = document.getElementById('wrong-button');

    // NEU: Konstante für das EINE digitale Würfelbild
    const digitalDiceArea = document.getElementById('digital-dice-area');
    const digitalDiceMainImage = document.getElementById('digital-dice-main-image');

    // NEU: DOM-Elemente für die Start-Genre-Auswahl
    const startGenreSelectionContainer = document.getElementById('start-genre-selection-container');
    const allGenresScrollbox = document.getElementById('all-genres-scrollbox');

    // NEU: Statusbereich Elemente
    const statusArea = document.getElementById('status-area');
    const tokenTimerDisplay = document.getElementById('token-timer');
    const loadingSpinner = document.getElementById('loading-spinner');


    const digitalDiceImages = {
        1: 'assets/digi-1.png',
        2: 'assets/digi-2.png',
        3: 'assets/digi-3.png',
        4: 'assets/digi-4.png',
        5: 'assets/digi-5.png',
        7: 'assets/digi-ta.png'
    };

    // Pfad zur digitalen Animation und dem Standard-Startbild
    const digitalDiceAnimationGif = 'assets/digi-ani.gif';
    const digitalDiceStartImage = 'assets/digi-ta.png'; // Das Bild, das standardmäßig angezeigt wird

    // Sounds
    const digitalDiceSound = document.getElementById('digital-dice-sound');
    const logoFlyInSound = document.getElementById('logo-fly-in-sound');

    // --- Spotify-Parameter (Phase 1.1) ---
    const CLIENT_ID = "53257f6a1c144d3f929a60d691a0c6f6";
    const REDIRECT_URI = "https://dookye.github.io/TRACK-ATTACK/";

    // Konfiguration für jeden Würfelwert
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
        totalRounds: 20, // wert auf 20 setzen, wenn jeder spieler 10 runden spielt
        currentRound: 0,
        diceValue: 0,
        attemptsMade: 0,
        maxAttempts: 0,
        trackDuration: 0,
        currentTrack: null,
        player1SpeedRound: Math.floor(Math.random() * 10) + 1, // wert auf 10 heisst speedround wird zwischen 1 und 10 stattfinden
        player2SpeedRound: Math.floor(Math.random() * 10) + 1,
        isSpeedRound: false,
        speedRoundTimeout: null,
        countdownInterval: null,
        spotifyPlayTimeout: null, // NEU: Timeout für das Pausieren des Songs
        isSongPlaying: false, // NEU: Flag, ob Song gerade spielt
        fadeInterval: null, // NEU: Für den Fade-In-Intervall
        currentSongVolume: 0, // NEU: Aktuelle Lautstärke für Fade-In
        diceAnimationTimeout: null, // NEU: Timeout für die Würfel-Animation
        scoreScreenTimeout: null,

        // NEU: Array für die ausgewählten Genres auf der Startseite
        selectedPlayableGenres: [],

        // NEU: Für den Token-Timer
        tokenRefreshInterval: null,
        tokenExpiryTime: null,
    };

    // NEU: Zufälligen Startspieler festlegen
    // Diese Zeile sollte NACH der gameState-Definition stehen,
    // idealerweise in deiner initGame() Funktion oder dort, wo das Spiel gestartet wird.
    gameState.currentPlayer = Math.random() < 0.5 ? 1 : 2;
    // Eine 50/50 Chance: Wenn Math.random() < 0.5, ist es Spieler 1, sonst Spieler 2.

    console.log(`Zufälliger Startspieler ist Spieler ${gameState.currentPlayer}`);

    // NEU: Variable zum Speichern des letzten sichtbaren Spiel-Screens
    let lastGameScreenVisible = '';

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
        'deutscher hip hop': ['1bG3S6G5BmmgN08EBDfzE5']
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
            // Wenn die Ausrichtung korrekt ist, starte das Spiel (falls noch nicht gestartet)
            if (accessToken && gameScreen.classList.contains('hidden') && loginScreen.classList.contains('hidden')) {
                startGameAfterOrientation();
            }
        }
    }

    // NEU: Funktion, die nach korrekter Orientierung das Spiel startet
    function startGameAfterOrientation() {
        gameScreen.classList.remove('hidden');

        // NEU: Sound für das einfliegende Logo abspielen
        if (logoFlyInSound) {
            logoFlyInSound.currentTime = 0; // Setzt den Sound auf den Anfang zurück
            logoFlyInSound.volume = 0.3; // Optional: Passe die Lautstärke an (z.B. 50%)
            logoFlyInSound.play().catch(error => {
                console.warn("Autoplay für Logo-Sound blockiert oder Fehler:", error);
            });
        }

        // NEU: Stelle den letzten Zustand wieder her, oder starte neu
        if (lastGameScreenVisible === 'dice-container') {
            showDiceScreen();
        } else if (lastGameScreenVisible === 'genre-container') {
            showGenreScreen();
        } else if (lastGameScreenVisible === 'reveal-container') {
            showResolution();
        } else {
            // Wenn kein spezieller Zustand gespeichert ist, starte neu mit dem Logo
            logoButton.classList.remove('hidden');
            logoButton.classList.add('initial-fly-in');
            logoButton.addEventListener('click', startGame, { once: true });

            // NEU: Zeige die Genre-Vorauswahl an und rendere die Buttons
            startGenreSelectionContainer.classList.remove('hidden');
            // Genres nur beim ersten Start oder nach einem Reset neu rendern
            if (allGenresScrollbox.children.length === 0) { // Vermeidet redundantes Rendern
                renderPreselectionGenres();
            }
        }
    }

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

    // --- NEU: Funktionen für den Token-Timer ---
    function startTokenTimer() {
        // Berechne die Ablaufzeit (Spotify-Tokens sind meist 3600 Sekunden = 60 Minuten gültig)
        // Sicherheitshalber setzen wir ihn auf 59 Minuten, um Puffer zu haben.
        gameState.tokenExpiryTime = Date.now() + (59 * 60 * 1000); // 59 Minuten in Millisekunden

        statusArea.classList.remove('hidden'); // Statusbereich einblenden

        // Clear existing interval to prevent duplicates
        if (gameState.tokenRefreshInterval) {
            clearInterval(gameState.tokenRefreshInterval);
        }

        gameState.tokenRefreshInterval = setInterval(updateTokenTimer, 1000); // Jede Sekunde aktualisieren
        updateTokenTimer(); // Sofortige erste Aktualisierung
    }

    function updateTokenTimer() {
        const timeLeftMs = gameState.tokenExpiryTime - Date.now();

        if (timeLeftMs <= 0) {
            clearInterval(gameState.tokenRefreshInterval);
            tokenTimerDisplay.innerText = "Sitzung abgelaufen";
            tokenTimerDisplay.style.color = 'var(--red)'; // Optional: Rot einfärben
            return;
        }

        const minutes = Math.floor(timeLeftMs / (60 * 1000));
        // const seconds = Math.floor((timeLeftMs % (60 * 1000)) / 1000); -- für sekunden anzeige

        // tokenTimerDisplay.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`; -- ffür sekunden anzeige
        tokenTimerDisplay.innerText = `${minutes}`; // für nur minuten anzeige
        tokenTimerDisplay.style.color = 'var(--white)'; // Sicherstellen, dass die Farbe weiß ist
    }

    function stopTokenTimer() {
        clearInterval(gameState.tokenRefreshInterval);
        gameState.tokenRefreshInterval = null;
        tokenTimerDisplay.innerText = ''; // Timer leeren
        statusArea.classList.add('hidden'); // Statusbereich ausblenden
    }

    // --- NEU: Funktionen für den Lade-Spinner ---
    function showLoadingSpinner() {
        loadingSpinner.classList.add('active');
    }

    function hideLoadingSpinner() {
        loadingSpinner.classList.remove('active');
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
        document.location = `${API_ENDPOINTS.SPOTIFY_AUTH}?${params.toString()}`; // NEUE ZEILE
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

        const result = await fetch(API_ENDPOINTS.SPOTIFY_TOKEN, { // NEUE ZEILE
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
            accessToken = token; // Hier wird der Access Token gesetzt!
            loginScreen.classList.add('hidden'); // Login-Screen ausblenden
            initializePlayer(); // Spotify-Player initialisieren
            startTokenTimer(); // NEU: Starte den Token-Timer

            // HIER WIRD DER TIMEOUT EINGEFÜGT!
            // Er gibt iOS eine kurze Pause, um die UI-Änderungen zu verarbeiten.
            setTimeout(() => {
                // Diese beiden Zeilen werden erst nach der Verzögerung ausgeführt
                window.addEventListener('resize', checkOrientation);
                checkOrientation(); // Initial die Orientierung prüfen
            }, 500); // 500 Millisekunden (0.5 Sekunden) Verzögerung

        }).catch(error => {
            console.error("Fehler beim Abrufen des Access Tokens:", error);
            alert("Anmeldung bei Spotify fehlgeschlagen. Bitte versuchen Sie es erneut.");
            // Zurück zum Login-Screen, falls Fehler
            loginScreen.classList.remove('hidden');
            // Stelle sicher, dass der 'login-button' Listener noch aktiv ist
            document.getElementById('login-button').removeEventListener('click', redirectToAuthCodeFlow); // Duplizierte Listener vermeiden
            document.getElementById('login-button').addEventListener('click', redirectToAuthCodeFlow);
            stopTokenTimer(); // NEU: Timer auch bei Fehler stoppen/ausblenden
        });

    } else {
        // Standard-Ansicht (noch nicht von Spotify zurückgekommen)
        loginScreen.classList.remove('hidden');
        document.getElementById('login-button').addEventListener('click', redirectToAuthCodeFlow);
        stopTokenTimer(); // NEU: Timer stoppen/ausblenden, wenn kein Code vorhanden ist
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

    // --- NEU: Funktion: Genres für die Vorauswahl rendern ---
    function renderPreselectionGenres() {
        // Zuerst sicherstellen, dass die Scrollbox leer ist, bevor neue Buttons hinzugefügt werden
        allGenresScrollbox.innerHTML = '';

        // ---- Optional: Einen Titel hinzufügen
        // const title = document.createElement('h3');
        // title.innerText = 'Genre-Auswahl:';
        // allGenresScrollbox.appendChild(title);

        const allAvailableGenres = Object.keys(playlists); // Alle Genre-Namen aus dem playlists-Objekt

        allAvailableGenres.forEach(genreName => {
            const button = document.createElement('button');
            button.classList.add('preselect-genre-button');
            button.dataset.genre = genreName; // Speichert den Genre-Namen als Datenattribut
            // Optional: Genre-Namen besser lesbar machen (z.B. "hiphop" -> "Hip Hop")
            button.innerText = genreName.split(/(?=[A-Z])/).join(' ').replace(/\b\w/g, char => char.toUpperCase());

            // Überprüfen, ob das Genre bereits ausgewählt ist (relevant bei Reset oder Navigation)
            if (gameState.selectedPlayableGenres.includes(genreName)) {
                button.classList.add('selected');
            }

            button.addEventListener('click', () => {
                // Genre zum gameState hinzufügen/entfernen
                toggleGenreSelection(genreName, button);
            });
            allGenresScrollbox.appendChild(button);
        });
    }

    // --- NEU: Funktion: Genre in der Vorauswahl auswählen/abwählen ---
    function toggleGenreSelection(genreName, buttonElement) {
        const index = gameState.selectedPlayableGenres.indexOf(genreName);

        if (index > -1) {
            // Genre ist bereits ausgewählt, also entfernen
            gameState.selectedPlayableGenres.splice(index, 1);
            buttonElement.classList.remove('selected');
        } else {
            // Genre ist nicht ausgewählt, also hinzufügen
            gameState.selectedPlayableGenres.push(genreName);
            buttonElement.classList.add('selected');
        }
        console.log("Aktuell ausgewählte Genres:", gameState.selectedPlayableGenres);
    }

    //=======================================================================
    // Phase 2: Spielstart & UI-Grundlagen
    //=======================================================================

    function triggerBounce(element) {
        element.classList.remove('bounce');
        void element.offsetWidth; // Trigger reflow
        element.classList.add('bounce');
    }

    // AKTUALISIERT: startGame-Funktion
    function startGame() {
        triggerBounce(logoButton);
        logoButton.classList.add('inactive');

        // Speichere den Zustand, dass das Spiel gestartet wurde (Logo-Phase)
        lastGameScreenVisible = 'logo-button';

        // NEU: Genre-Vorauswahl ausblenden, sobald das Spiel richtig startet
        startGenreSelectionContainer.classList.add('hidden');

        setTimeout(() => {
            appContainer.style.backgroundColor = 'var(--player1-color)';
            logoButton.classList.add('hidden');
            showDiceScreen();
        }, 800); // Warten, bis Bounce-Effekt und Blur sichtbar sind
    }

    //=======================================================================
    // Phase 3: Würfel- & Genre-Auswahl
    //=======================================================================

    // NEU: Funktion, die die Aktionen nach der Würfelanimation ausführt
    function handleDiceAnimationEnd() {
        // Stoppt den laufenden Timeout, falls er noch aktiv ist
        // Dies ist wichtig, wenn die Animation manuell übersprungen wird,
        // damit der setTimeout nicht später noch einmal triggert.
        clearTimeout(gameState.diceAnimationTimeout);

        diceAnimation.classList.add('hidden'); // Haupt-Würfelanimation ausblenden
        diceSelection.classList.remove('hidden'); // Würfelauswahl anzeigen

        // Den digitalen Würfelbereich anzeigen
        digitalDiceArea.classList.remove('hidden');

        // Aktiviere die Möglichkeit, die physischen Würfel auszuwählen
        document.querySelectorAll('.dice-option').forEach(dice => {
            dice.classList.remove('no-interaction');
        });
    }

    function showDiceScreen() {
        resetRoundUI();
        gameState.currentRound++;
        gameState.isSpeedRound = false;

        // Check für Spielende
        if (gameState.currentRound > gameState.totalRounds) {
            endGame();
            return;
        }

        // NEU: Setze die Hintergrundfarbe basierend auf dem aktuellen Spieler.
        // Dies geschieht JEDES MAL, wenn der Würfel-Screen angezeigt wird.
        appContainer.style.backgroundColor = gameState.currentPlayer === 1 ? 'var(--player1-color)' : 'var(--player2-color)';
        console.log(`Hintergrundfarbe gesetzt für Spieler ${gameState.currentPlayer}`); // Optional zur Überprüfung

        diceContainer.classList.remove('hidden');
        diceAnimation.classList.remove('hidden');
        diceSelection.classList.add('hidden');

        // Verstecke den gesamten Bereich des digitalen Würfels während der Haupt-Animation
        digitalDiceArea.classList.add('hidden');

        // NEU: Setze das digitale Würfelbild auf das Startbild und mache es klickbar
        digitalDiceMainImage.src = digitalDiceStartImage;
        digitalDiceMainImage.classList.remove('no-interaction', 'rolling'); // Sicherstellen, dass es klickbar ist
        digitalDiceMainImage.style.cursor = 'pointer'; // Cursor als Zeiger anzeigen

        // Speichere den Zustand: Würfel-Bildschirm
        lastGameScreenVisible = 'dice-container';

        // Setze den Timeout für die Haupt-Würfel-Animation
        // Dieser Timeout ruft jetzt die neue Helferfunktion auf
        gameState.diceAnimationTimeout = setTimeout(() => {
            handleDiceAnimationEnd(); // Ruft die neue Funktion auf
        }, 2000); // 2 Sekunden Dauer der Haupt-Würfel-Animation
    }

    // --- Event Listener für den digitalen Würfel-Button (bleibt unverändert) ---
    digitalDiceMainImage.addEventListener('click', rollDigitalDice);

    // NEU: Event Listener für das Überspringen der Würfel-Animation
    // Bei Klick auf die Würfel-Animation soll das gleiche passieren wie nach dem Timeout
    diceAnimation.addEventListener('click', handleDiceAnimationEnd);

    // --- NEU: Funktion für den digitalen Würfelwurf ---
    function rollDigitalDice() {
        // Mache das Bild während der Animation nicht klickbar
        digitalDiceMainImage.classList.add('no-interaction');
        digitalDiceMainImage.classList.add('rolling'); // Füge CSS-Klasse für Animationseffekte hinzu
        digitalDiceMainImage.style.cursor = 'default'; // Cursor auf Standard setzen während Animation

        // Setze die Quelle des Bildes auf das ANIMIERTE GIF
        digitalDiceMainImage.src = digitalDiceAnimationGif;

        // NEU: Sound abspielen
        if (digitalDiceSound) { // Sicherstellen, dass das Audio-Element gefunden wurde
            digitalDiceSound.currentTime = 0; // Setzt den Sound auf den Anfang zurück, falls er schonmal gespielt wurde
            // --- HIER DIE LAUTSTÄRKE ANPASSEN ---
            digitalDiceSound.volume = 0.3; // Beispiel: 30% der Originallautstärke. Spiele mit diesem Wert!
            // 0.1 = 10%, 0.5 = 50%, 0.8 = 80% usw.
            digitalDiceSound.play().catch(error => {
                // Fehlerbehandlung für Autoplay-Richtlinien (z.B. auf mobilen Geräten)
                console.warn("Autoplay für digitalen Würfel Sound blockiert oder Fehler:", error);
                // Hier könntest du eine alternative Aktion planen oder den Benutzer informieren
            });
        }

        // Die Animation läuft einmal durch (ca. 1.5 Sekunden)
        setTimeout(() => {
            digitalDiceMainImage.classList.remove('rolling'); // Animationsklasse entfernen

            // Zufälligen Würfelwert auswählen
            const possibleDiceValues = [1, 2, 3, 4, 5, 7];
            const randomIndex = Math.floor(Math.random() * possibleDiceValues.length);
            const randomDiceValue = possibleDiceValues[randomIndex];

            // Setze die Quelle des Bildes auf das ZUFÄLLIGE ERGEBNISBILD
            digitalDiceMainImage.src = digitalDiceImages[randomDiceValue];

            // Mache das Bild wieder klickbar, damit man erneut würfeln kann
            digitalDiceMainImage.classList.remove('no-interaction');
            digitalDiceMainImage.style.cursor = 'pointer'; // Cursor wieder als Zeiger anzeigen

        }, 1800); // Dauer der digital-dice Animation in Millisekunden (1.8 Sekunden)
    }

    // --- Event Listener für den digitalen Würfel-Button ---
    digitalDiceMainImage.addEventListener('click', rollDigitalDice);

    // NEU: Event-Listener für das Überspringen der Würfel-Animation
    diceAnimation.addEventListener('click', () => {
        clearTimeout(gameState.diceAnimationTimeout); // Stoppt den automatischen Timeout
        diceAnimation.classList.add('hidden');
        diceSelection.classList.remove('hidden');
    });

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
                // Die Werte werden jetzt direkt aus dem Konfigurationsobjekt ausgelesen
                gameState.trackDuration = config.duration;
                gameState.maxAttempts = config.attempts;
                gameState.attemptsMade = 0;

                diceContainer.classList.add('hidden');
                showGenreScreen();

            }, 200);
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
            }, 1800);
        });
    }

    // AKTUALISIERT: showGenreScreen-Funktion
    async function showGenreScreen() {
        genreContainer.classList.remove('hidden');

        // Alte Buttons entfernen (um sie mit den gefilterten neu zu erstellen)
        genreContainer.innerHTML = '';

        // Optional: Titel für diesen Screen
        const title = document.createElement('h2');
        // title.innerText = 'Wähle ein Genre für diese Runde:';
        genreContainer.appendChild(title);

        // NEU: Hole die Genres, die im gameState ausgewählt wurden
        // Fallback: Wenn keine Genres vorausgewählt wurden, zeige alle verfügbaren Genres
        const playableGenresForDisplay = gameState.selectedPlayableGenres.length > 0 ?
            gameState.selectedPlayableGenres :
            Object.keys(playlists);

        const genreButtons = []; // Sammle die Buttons, um sie nach dem Erstellen zu animieren

        playableGenresForDisplay.forEach(genreName => {
            // Nur wenn das Genre auch wirklich in den Playlists existiert und Playlists hat
            if (playlists[genreName] && playlists[genreName].length > 0) {
                const button = document.createElement('button');
                button.classList.add('genre-button'); // Nutze deine bestehende genre-button Klasse
                button.dataset.genre = genreName;
                button.innerText = genreName.split(/(?=[A-Z])/).join(' ').replace(/\b\w/g, char => char.toUpperCase());
                button.addEventListener('click', handleGenreSelection, { once: true }); // Listener bleibt hier
                genreContainer.appendChild(button);
                genreButtons.push(button);
            }
        });

        // Speichere den Zustand: Genre-Bildschirm
        lastGameScreenVisible = 'genre-container';

        // Führe die gleiche Blink-Animation für alle (jetzt gefilterten) Buttons aus
        await runGenreAnimation(genreButtons);

        // Die Logik für die Button-Aktivierung/-Deaktivierung kommt jetzt NACH der Animation
        if (gameState.diceValue === 7) { // Fall B: WÜRFEL 7
            // 1. Alle Buttons sind klickbar (standardmäßig)
            genreButtons.forEach(btn => btn.disabled = false);

            // 2. Wähle ein zufälliges Genre aus, das inaktiv sein soll
            const randomIndex = Math.floor(Math.random() * genreButtons.length);
            const disabledButton = genreButtons[randomIndex];

            // 3. Deaktiviere das ausgewählte Genre
            disabledButton.disabled = true;
            // Optional: Füge eine visuelle Klasse hinzu, um es zu markieren
            disabledButton.classList.add('disabled-genre');

            // Event-Listener wurden bereits beim Erstellen hinzugefügt
        } else { // Fall A: WÜRFEL 1-5
            // 1. Erst alle Buttons deaktivieren
            genreButtons.forEach(btn => btn.disabled = true);

            // 2. Dann ein zufälliges Genre auswählen und aktivieren
            const randomIndex = Math.floor(Math.random() * genreButtons.length);
            const activeButton = genreButtons[randomIndex];

            activeButton.disabled = false;
            // Optional: Entferne eine mögliche visuelle Klasse
            activeButton.classList.remove('disabled-genre');

            // Event-Listener wurde bereits beim Erstellen hinzugefügt
        }
    }

    async function handleGenreSelection(e) {
        const selectedGenre = e.target.dataset.genre;

        await new Promise(resolve => setTimeout(resolve, 200)); // kurze Verzögerung zum nächsten screen
        genreContainer.classList.add('hidden');
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

    // AKTUALISIERT: getTrack-Funktion (unverändert aus Ihrer letzten Version)
    async function getTrack(selectedGenreName) {
        const playlistPool = playlists[selectedGenreName];

        if (!playlistPool || playlistPool.length === 0) {
            console.error(`Keine Playlists für Genre "${selectedGenreName}" definiert oder Pool ist leer.`);
            alert(`Fehler: Für das Genre "${selectedGenreName}" sind keine Playlists verfügbar. Bitte wähle ein anderes Genre.`);
            showGenreScreen();
            return null;
        }

        const randomPlaylistId = playlistPool[Math.floor(Math.random() * playlistPool.length)];
        console.log(`DEBUG: Ausgewähltes Genre (vom Spieler geklickt): "${selectedGenreName}", Playlist-ID (zufällig aus diesem Genre): "${randomPlaylistId}"`);

        try {
            const response = await fetch(API_ENDPOINTS.SPOTIFY_PLAYLIST_TRACKS(randomPlaylistId), {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                console.error("Fehler beim Abrufen der Playlist-tracks:", response.status, response.statusText, `Playlist ID: ${randomPlaylistId}`);
                alert(`Fehler beim Laden der Songs für das ausgewählte Genre. (Code: ${response.status}). Bitte versuchen Sie ein anderes Genre.`);
                showGenreScreen();
                return null;
            }

            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                console.warn(`Die Playlist ${randomPlaylistId} enthält keine abspielbaren Tracks.`);
                alert(`Die ausgewählte Playlist hat keine Songs. Bitte wählen Sie ein anderes Genre.`);
                showGenreScreen();
                return null;
            }

            const playableTracks = data.items.filter(item => item.track);

            if (playableTracks.length === 0) {
                console.warn(`Die Playlist ${randomPlaylistId} enthält keine abspielbaren oder gültigen Tracks nach Filterung.`);
                alert(`Keine gültigen Songs in der Playlist gefunden. Bitte versuchen Sie ein anderes Genre.`);
                showGenreScreen();
                return null;
            }

            const randomTrack = playableTracks[Math.floor(Math.random() * playableTracks.length)].track;

            if (randomTrack) {
                console.log(`DEBUG: Ausgewählter Song: "${randomTrack.name}" von "${randomTrack.artists.map(a => a.name).join(', ')}" (ID: ${randomTrack.id})`);
            } else {
                console.error("DEBUG: Zufällig ausgewählter Track ist unerwarteterweise null oder ungültig nach Filterung.");
                alert("Ein unerwarteter Fehler beim Auswählen des Songs ist aufgetreten. Bitte versuchen Sie es erneut.");
                showGenreScreen();
                return null;
            }

            return randomTrack;
        } catch (error) {
            console.error("Netzwerkfehler beim Abrufen der Playlist-Tracks:", error);
            alert(`Hoppla! Es gab ein Problem mit deiner Internetverbindung oder Spotify. Bitte überprüfe dein Internet und versuche es erneut. (Fehler: ${error.message})`);
            showGenreScreen();
            return null;
        }
    }


    // NEUER VERSUCH: prepareAndShowRateScreen-Funktion für Preloading
    async function prepareAndShowRateScreen(genre) {
        showLoadingSpinner(); // NEU: Spinner anzeigen, bevor der Track geladen wird

        gameState.currentTrack = await getTrack(genre);

        if (!gameState.currentTrack) {
            hideLoadingSpinner(); // NEU: Spinner ausblenden, wenn getTrack fehlgeschlagen ist
            return;
        }

        // Stellen Sie sicher, dass spotifyPlayer und deviceId verfügbar sind
        if (!spotifyPlayer || !deviceId) {
            console.warn("Spotify Player oder Device ID nicht bereit. Kann nicht preloade/spielen.");
            alert("Konnte den Spotify Player nicht initialisieren. Bitte lade die Seite neu und stelle sicher, dass Spotify läuft.");
            showGenreScreen(); // Fallback zur Genre-Auswahl
            hideLoadingSpinner(); // NEU: Spinner ausblenden, wenn Player nicht bereit ist
            return;
        }

        try {
            // Den Track zum Preloading starten und sofort stumm schalten
            console.log(`Versuche, Track "${gameState.currentTrack.name}" stumm vorzuladen...`);
            await fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), {
                method: 'PUT',
                body: JSON.stringify({
                    uris: [gameState.currentTrack.uri],
                    position_ms: 0 // Song am Anfang starten
                }),
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            // Die Lautstärke direkt nach dem Start auf 0 setzen
            await spotifyPlayer.setVolume(0);
            gameState.isSongPlaying = true; // Setzen, dass der Song im Hintergrund läuft

            console.log(`Track "${gameState.currentTrack.name}" erfolgreich stumm vorgeladen und läuft im Hintergrund.`);
            hideLoadingSpinner(); // NEU: Spinner ausblenden, sobald der Song erfolgreich vorgeladen ist

        } catch (error) {
            console.error("Fehler beim Vorladen/stumm Starten des Tracks:", error);
            alert(`Konnte den Song "${gameState.currentTrack.name}" nicht vorbereiten. Bitte versuche ein anderes Genre. (Fehler: ${error.message})`);
            showGenreScreen(); // Bei Fehler zurück zur Genre-Auswahl
            hideLoadingSpinner(); // NEU: Spinner ausblenden bei Fehler
            return;
        }

        // UI-Elemente für den Rate-Bildschirm vorbereiten
        logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
        logoButton.removeEventListener('click', playTrackSnippet); // Alten Listener entfernen, falls vorhanden
        logoButton.addEventListener('click', playTrackSnippet); // Neuen Listener hinzufügen

        // Speichere den Zustand: Raten-Bildschirm
        lastGameScreenVisible = 'reveal-container';
    }

    // playTrackSnippet (unverändert von Ihrer letzten Version)
    function playTrackSnippet() {
        if (logoButton.classList.contains('inactive')) {
            return;
        }

        if (gameState.attemptsMade >= gameState.maxAttempts && !gameState.isSpeedRound) {
            return;
        }
        if (gameState.isSpeedRound && gameState.attemptsMade > 0) {
            return;
        }

        triggerBounce(logoButton);
        logoButton.classList.add('inactive');
        gameState.attemptsMade++;

        const trackDurationMs = gameState.currentTrack.duration_ms;
        const randomStartPosition = Math.floor(Math.random() * (trackDurationMs - gameState.trackDuration));

        if (spotifyPlayer && gameState.isSongPlaying) {
            // SCHRITT 1: Zuerst den Play-Request senden, um den Song zur neuen Position zu springen.
            // Die Lautstärke bleibt zu diesem Zeitpunkt noch auf 0.
            fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), {
                method: 'PUT',
                body: JSON.stringify({
                    uris: [gameState.currentTrack.uri], // URI immer mitsenden, um den Kontext zu sichern
                    position_ms: randomStartPosition
                }),
                headers: { 'Authorization': `Bearer ${accessToken}` }
            })
                .then(response => {
                    if (!response.ok) {
                        console.error("Fehler beim Abspielen/Springen des Tracks:", response.status, response.statusText);
                        alert("Konnte den Song nicht abspielen. Stellen Sie sicher, dass ein Gerät ausgewählt ist.");
                        logoButton.classList.remove('inactive');
                        throw new Error("Fehler beim Abspielen/Springen des Tracks"); // Fehler weitergeben
                    }
                    // SCHRITT 2: Wenn der Sprung erfolgreich war, die Lautstärke erhöhen.
                    return spotifyPlayer.setVolume(1.0);
                })
                .then(() => {
                    console.log("Snippet gestartet: Gesprungen zu", randomStartPosition, "ms und Lautstärke auf 1.0 gesetzt.");

                    if (gameState.isSpeedRound) {
                        startVisualSpeedRoundCountdown();
                    } else {
                        gameState.spotifyPlayTimeout = setTimeout(() => {
                            spotifyPlayer.setVolume(0)
                                .then(() => {
                                    console.log("Snippet beendet, Song stumm weiterlaufend.");
                                    if (gameState.attemptsMade < gameState.maxAttempts) {
                                        logoButton.classList.remove('inactive');
                                    }
                                })
                                .catch(error => console.error("Fehler beim Stummschalten nach Snippet:", error));
                        }, gameState.trackDuration);
                    }
                })
                .catch(error => {
                    console.error("Fehler im Play-Snippet-Prozess:", error);
                    // Alert wurde bereits im ersten Catch abgefangen, hier nur konsistent machen
                    if (!error.message.includes("Fehler beim Abspielen/Springen des Tracks")) { // Vermeide Doppel-Alerts
                        alert("Problem beim Verbinden mit Spotify. Bitte überprüfen Sie Ihre Internetverbindung.");
                    }
                    logoButton.classList.remove('inactive');
                });
        } else {
            // Fallback: Wenn der Song aus irgendeinem Grund nicht stumm läuft (sollte durch Preload nicht passieren)
            console.warn("Song nicht vorgeladen oder Player nicht bereit in playTrackSnippet. Fallback zum direkten Play-Request.");
            fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), {
                method: 'PUT',
                body: JSON.stringify({
                    uris: [gameState.currentTrack.uri],
                    position_ms: randomStartPosition
                }),
                headers: { 'Authorization': `Bearer ${accessToken}` }
            }).then(response => {
                if (!response.ok) {
                    console.error("Fehler beim Abspielen des Tracks (Fallback):", response.status, response.statusText);
                    alert("Konnte den Song nicht abspielen. Stellen Sie sicher, dass ein Gerät ausgewählt ist.");
                    logoButton.classList.remove('inactive');
                    return;
                }
                // Auch hier: Lautstärke erst nach erfolgreichem Play setzen
                spotifyPlayer.setVolume(1.0);
                gameState.isSongPlaying = true; // Song spielt jetzt

                if (gameState.isSpeedRound) {
                    startVisualSpeedRoundCountdown();
                } else {
                    gameState.spotifyPlayTimeout = setTimeout(() => {
                        spotifyPlayer.setVolume(0)
                            .then(() => {
                                console.log("Fallback Snippet beendet, Song stumm weiterlaufend.");
                                if (gameState.attemptsMade < gameState.maxAttempts) {
                                    logoButton.classList.remove('inactive');
                                }
                            })
                            .catch(error => console.error("Fehler beim Stummschalten nach Fallback-Snippet:", error));
                    }, gameState.trackDuration);
                }
            }).catch(error => {
                console.error("Netzwerkfehler beim Abspielen des Tracks (Fallback):", error);
                alert("Problem beim Verbinden mit Spotify. Bitte überprüfen Sie Ihre Internetverbindung.");
                logoButton.classList.remove('inactive');
            });
        }

        if (gameState.attemptsMade === 1 && !gameState.isSpeedRound) {
            revealButton.classList.remove('hidden');
            revealButton.classList.remove('no-interaction');
        }
    }

    // AKTUALISIERT: showResolution-Funktion
    function showResolution() {
        console.log("showResolution() aufgerufen.");
        // Zuerst alle relevanten Timer und Intervalle stoppen
        clearTimeout(gameState.speedRoundTimeout);
        clearInterval(gameState.countdownInterval);
        clearTimeout(gameState.spotifyPlayTimeout);
        clearInterval(gameState.fadeInterval);

        // Spotify Player explizit pausieren
        if (spotifyPlayer && gameState.isSongPlaying) {
            spotifyPlayer.pause();
            gameState.isSongPlaying = false;
            console.log("Song bei Auflösung explizit pausiert.");
        }

        // UI-Elemente ausblenden
        countdownDisplay.classList.add('hidden');
        countdownDisplay.classList.remove('countdown-animated');
        countdownDisplay.innerText = '';

        logoButton.classList.add('inactive', 'hidden');
        revealButton.classList.add('hidden');
        speedRoundTextDisplay.classList.add('hidden');

        // WICHTIG: Diese Buttons NICHT ausblenden, da sie im Auflösungsbildschirm benötigt werden
        // correctButton.classList.add('hidden'); // Diese Zeile ENTFÄLLT
        // wrongButton.classList.add('hidden'); // Diese Zeile ENTFÄLLT

        // Track-Infos im Reveal-Container aktualisieren
        if (gameState.currentTrack) {
            document.getElementById('album-cover').src = gameState.currentTrack.album.images[0].url;
            document.getElementById('track-title').innerText = gameState.currentTrack.name;
            document.getElementById('track-artist').innerText = gameState.currentTrack.artists.map(a => a.name).join(', ');
            // KORREKTUR: Sicherstellen, dass die IDs für Album und Jahr existieren und korrekt sind
            const trackAlbum = document.getElementById('track-album');
            const trackYear = document.getElementById('track-year');
            if (trackAlbum) trackAlbum.innerText = gameState.currentTrack.album.name;
            if (trackYear) trackYear.innerText = `(${gameState.currentTrack.album.release_date.substring(0, 4)})`;
        } else {
            console.warn("Kein aktueller Track beim Versuch, die Auflösung anzuzeigen.");
            document.getElementById('track-title').innerText = "Song-Informationen nicht verfügbar";
            // Sicherstellen, dass Album/Jahr auch geleert werden, wenn Track fehlt
            const trackAlbum = document.getElementById('track-album');
            const trackYear = document.getElementById('track-year');
            if (trackAlbum) trackAlbum.innerText = '';
            if (trackYear) trackYear.innerText = '';
        }

        // Reveal-Container einblenden (dies ist der eigentliche Screen-Wechsel)
        revealContainer.classList.remove('hidden');
        console.log("revealContainer sollte jetzt sichtbar sein.");

        // Speichere den Zustand: Auflösung-Bildschirm
        lastGameScreenVisible = 'reveal-container';

        // Song bei Auflösung abspielen (startet nach dem Screen-Wechsel)
        playSongForResolution();
    }

    // playSongForResolution (unverändert von Ihrer letzten Version)
    async function playSongForResolution() {
        if (!gameState.currentTrack || !deviceId) {
            console.warn("Kein Track oder Gerät verfügbar, kann Song nicht abspielen.");
            return;
        }

        const startPositionMs = 30 * 1000;
        const targetVolume = 80;
        const fadeDuration = 2000;
        const fadeStep = 5;
        const intervalTime = fadeDuration / (targetVolume / fadeStep);

        try {
            await spotifyPlayer.setVolume(0);
            gameState.currentSongVolume = 0;

            const response = await fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), {
                method: 'PUT',
                body: JSON.stringify({
                    uris: [gameState.currentTrack.uri],
                    position_ms: startPositionMs
                }),
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                console.error("Fehler beim Starten des Songs für Auflösung:", response.status, response.statusText);
                return;
            }
            gameState.isSongPlaying = true;

            gameState.fadeInterval = setInterval(() => {
                if (gameState.currentSongVolume < targetVolume) {
                    gameState.currentSongVolume = Math.min(gameState.currentSongVolume + fadeStep, targetVolume);
                    spotifyPlayer.setVolume(gameState.currentSongVolume / 100);
                } else {
                    clearInterval(gameState.fadeInterval);
                }
            }, intervalTime);
        } catch (error) {
            console.error("Fehler in playSongForResolution:", error);
            alert("Konnte den Auflösungs-Song nicht abspielen. Bitte versuchen Sie es erneut.");
        }
    }

    // fadeAudioOut (unverändert von Ihrer letzten Version)
    function fadeAudioOut() {
        return new Promise(resolve => {
            if (!spotifyPlayer) {
                console.log("fadeAudioOut: Spotify Player nicht verfügbar, sofort aufgelöst.");
                resolve();
                return;
            }

            clearInterval(gameState.fadeInterval);
            clearTimeout(gameState.spotifyPlayTimeout);

            if (!gameState.isSongPlaying || gameState.currentSongVolume <= 0) {
                spotifyPlayer.setVolume(0)
                    .then(() => spotifyPlayer.pause())
                    .then(() => {
                        gameState.isSongPlaying = false;
                        console.log("fadeAudioOut: Song war bereits stumm oder pausiert, direkt pausiert und aufgelöst.");
                        resolve();
                    })
                    .catch(error => {
                        console.error("fadeAudioOut: Fehler beim Stummschalten/Pausieren eines nicht spielenden Songs:", error);
                        resolve();
                    });
                return;
            }

            const fadeDuration = 500;
            const fadeStep = 5;
            const initialVolume = gameState.currentSongVolume || 100;
            const intervalTime = fadeDuration / (initialVolume / fadeStep);

            gameState.fadeInterval = setInterval(() => {
                if (gameState.currentSongVolume > 0) {
                    gameState.currentSongVolume = Math.max(0, gameState.currentSongVolume - fadeStep);
                    spotifyPlayer.setVolume(gameState.currentSongVolume / 100);
                } else {
                    clearInterval(gameState.fadeInterval);
                    gameState.fadeInterval = null;
                    spotifyPlayer.pause();
                    gameState.isSongPlaying = false;
                    console.log("fadeAudioOut: Song vollständig ausgeblendet und pausiert.");
                    resolve();
                }
            }, intervalTime);
        });
    }

    // revealButton.addEventListener (unverändert von Ihrer letzten Version, außer Hinzufügen von console.logs)
    revealButton.addEventListener('click', async () => {
        console.log("Klick auf 'Auflösen' erkannt.");
        revealButton.classList.add('no-interaction');

        console.log("Warte 200ms für Button-Animation...");
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log("200ms Wartezeit beendet.");

        console.log("Starte fadeAudioOut()...");
        await fadeAudioOut();
        console.log("fadeAudioOut() abgeschlossen. Song sollte pausiert sein.");

        console.log("Rufe showResolution() auf...");
        showResolution();
        console.log("showResolution() wurde aufgerufen.");
    });

    // handleFeedback (unverändert von Ihrer letzten Version)
    function handleFeedback(isCorrect) {
        correctButton.classList.add('no-interaction');
        wrongButton.classList.add('no-interaction');

        fadeAudioOut().then(() => {
            let pointsAwarded = 0;

            if (isCorrect) {
                pointsAwarded = Math.max(1, gameState.diceValue - (gameState.attemptsMade - 1));
                if (gameState.currentPlayer === 1) {
                    gameState.player1Score += pointsAwarded;
                } else {
                    gameState.player2Score += pointsAwarded;
                }
            }

            displayPointsAnimation(pointsAwarded, gameState.currentPlayer)
                .then(() => {
                    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
                    appContainer.style.backgroundColor = gameState.currentPlayer === 1 ? 'var(--player1-color)' : 'var(--player2-color)';

                    lastGameScreenVisible = '';
                    setTimeout(showDiceScreen, 500);
                });
        });
    }

    // displayPointsAnimation (unverändert von Ihrer letzten Version)
    function displayPointsAnimation(points, player) {
        return new Promise(resolve => {
            countdownDisplay.classList.remove('hidden', 'countdown-animated', 'fly-to-corner-player1', 'fly-to-corner-player2', 'points-pop-in');
            countdownDisplay.innerText = `+${points}`;

            countdownDisplay.style.opacity = '0';
            countdownDisplay.style.transform = 'translate(-50%, -50%) scale(0.8)';
            countdownDisplay.style.top = '50%';

            if (player === 1) {
                countdownDisplay.style.color = 'var(--punktefarbe-player1)';
                countdownDisplay.style.left = '50%';
            } else {
                countdownDisplay.style.color = 'var(--punktefarbe-player2)';
                countdownDisplay.style.left = '50%';
            }

            void countdownDisplay.offsetWidth;

            countdownDisplay.classList.add('points-pop-in');

            const popInDuration = 300;
            const flyAnimationDuration = 500;

            setTimeout(() => {
                countdownDisplay.classList.remove('points-pop-in');
                if (player === 1) {
                    countdownDisplay.classList.add('fly-to-corner-player1');
                } else {
                    countdownDisplay.classList.add('fly-to-corner-player2');
                }
            }, popInDuration);

            setTimeout(() => {
                countdownDisplay.classList.add('hidden');
                countdownDisplay.classList.remove('fly-to-corner-player1', 'fly-to-corner-player2');
                countdownDisplay.innerText = '';

                countdownDisplay.style.color = 'var(--white)';
                countdownDisplay.style.left = '50%';
                countdownDisplay.style.top = '50%';
                countdownDisplay.style.opacity = '1';
                countdownDisplay.style.transform = 'translate(-50%, -50%) scale(1)';
                resolve();
            }, popInDuration + flyAnimationDuration);
        });
    }
    document.getElementById('correct-button').addEventListener('click', () => handleFeedback(true));
    document.getElementById('wrong-button').addEventListener('click', () => handleFeedback(false));

    // RESET ROUND ---------------------------------------------------------------------------------------------------------------
    // resetRoundUI (unverändert von Ihrer letzten Version)
    function resetRoundUI() {
        revealContainer.classList.add('hidden');
        logoButton.classList.add('hidden');
        genreContainer.classList.add('hidden');
        diceContainer.classList.add('hidden');
        revealButton.classList.add('hidden');
        speedRoundTextDisplay.classList.add('hidden');

        correctButton.classList.remove('no-interaction');
        wrongButton.classList.remove('no-interaction');

        logoButton.removeEventListener('click', playTrackSnippet);

        digitalDiceArea.classList.add('hidden');

        digitalDiceMainImage.src = digitalDiceStartImage;
        digitalDiceMainImage.classList.remove('no-interaction', 'rolling');
        digitalDiceMainImage.style.cursor = 'pointer';

        clearTimeout(gameState.speedRoundTimeout);
        clearInterval(gameState.countdownInterval);
        clearTimeout(gameState.spotifyPlayTimeout);
        clearInterval(gameState.fadeInterval);
        clearTimeout(gameState.diceAnimationTimeout);

        if (spotifyPlayer) {
            spotifyPlayer.pause();
            gameState.isSongPlaying = false;
            spotifyPlayer.setVolume(1.0)
                .then(() => console.log("Lautstärke auf 100% zurückgesetzt."))
                .catch(error => console.error("Fehler beim Zurücksetzen der Lautstärke:", error));
        }
    }

    //=======================================================================
    // Phase 5: Spielende & Reset
    //=======================================================================

    scoreScreen.addEventListener('click', handleScoreScreenEnd);

    function handleScoreScreenEnd() {
        clearTimeout(gameState.scoreScreenTimeout);

        scoreScreen.classList.add('hidden');

        document.getElementById('player1-score-display').style.opacity = '0';
        document.getElementById('player2-score-display').style.opacity = '0';

        resetGame();
    }

    function endGame() {
        gameScreen.classList.add('hidden');
        scoreScreen.classList.remove('hidden');
        appContainer.style.backgroundColor = 'transparent';

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

        gameState.scoreScreenTimeout = setTimeout(() => {
            handleScoreScreenEnd();
        }, 8000);
    }

    // AKTUALISIERT: resetGame-Funktion (unverändert von Ihrer letzten Version)
    function resetGame() {
        scoreScreen.classList.add('hidden');
        appContainer.style.backgroundColor = 'var(--black)';

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

        gameState.selectedPlayableGenres = [];
        allGenresScrollbox.innerHTML = '';

        gameScreen.classList.remove('hidden');
        logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
        logoButton.removeEventListener('click', startGame);
        logoButton.addEventListener('click', startGame, { once: true });

        lastGameScreenVisible = '';

        startGenreSelectionContainer.classList.remove('hidden');
        renderPreselectionGenres();

        stopTokenTimer(); // NEU: Token-Timer stoppen/ausblenden bei Spiel-Reset
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
            }, 3500);
        });
    }

    // startVisualSpeedRoundCountdown (unverändert von Ihrer letzten Version)
    function startVisualSpeedRoundCountdown() {
        let timeLeft = 7;
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

}); // Ende DOMContentLoaded
