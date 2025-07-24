// Wichtiger Hinweis: Dieser Code muss von einem Webserver bereitgestellt werden (z.B. über "Live Server" in VS Code).
// Ein direktes Öffnen der HTML-Datei im Browser funktioniert wegen der Sicherheitsrichtlinien (CORS) bei API-Anfragen nicht.

// --- API Endpunkte ---
// Zentralisierte Verwaltung der API-Endpunkte für einfache Wartung.
const API_ENDPOINTS = {
    SPOTIFY_AUTH: 'https://accounts.spotify.com/authorize',
    SPOTIFY_TOKEN: 'https://accounts.spotify.com/api/token',
    SPOTIFY_PLAYLIST_TRACKS: (playlistId) => `https://api.spotify.com/v1/playlists/$${playlistId}/tracks`,
    SPOTIFY_PLAYER_PLAY: (deviceId) => `https://api.spotify.com/v1/me/player/play?device_id=$${deviceId}`
};

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM-Elemente ---
    // Alle relevanten DOM-Elemente werden hier einmalig abgerufen, um wiederholte Zugriffe zu vermeiden.
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
    const speedRoundTimer = document.getElementById('speed-round-timer'); // Nicht direkt verwendet, aber im Code vorhanden
    const countdownDisplay = document.getElementById('countdown-display');
    const trackAlbum = document.getElementById('track-album');
    const trackYear = document.getElementById('track-year');
    const correctButton = document.getElementById('correct-button');
    const wrongButton = document.getElementById('wrong-button');
    const nextRoundButton = document.getElementById('next-round-button'); // NEU: Für den "NÄCHSTE RUNDE" Button
    const playerScoresIngame = document.getElementById('player-scores-ingame'); // NEU: Container für In-Game Punkte
    const player1ScoreIngame = document.getElementById('player1-score-ingame'); // NEU: Spieler 1 In-Game Punkte
    const player2ScoreIngame = document.getElementById('player2-score-ingame'); // NEU: Spieler 2 In-Game Punkte

    // --- Spotify-Parameter ---
    const CLIENT_ID = "53257f6a1c144d3f929a60d691a0c6f6";
    const REDIRECT_URI = "https://dookye.github.io/TRACK-ATTACK/";

    // Konfiguration für jeden Würfelwert: Versuche und Abspieldauer des Snippets.
    const diceConfig = {
        1: { attempts: 1, duration: 7000 },
        2: { attempts: 2, duration: 7000 },
        3: { attempts: 3, duration: 7000 },
        4: { attempts: 4, duration: 7000 },
        5: { attempts: 5, duration: 7000 },
        7: { attempts: 7, duration: 2000 } // Speed Round: Mehr Versuche, kürzere Dauer
    };

    // --- Spielstatus-Variablen ---
    // Zentrales Objekt zur Verwaltung des gesamten Spielzustands.
    let spotifyPlayer; // Das Spotify Web Playback SDK Player-Objekt
    let deviceId;      // Die Spotify Device ID für die Wiedergabe
    let accessToken;   // Der Spotify OAuth Access Token

    let gameState = {
        player1Score: 0,
        player2Score: 0,
        currentPlayer: Math.random() < 0.5 ? 1 : 2, // Zufälliger Startspieler (1 oder 2)
        totalRounds: 20, // Gesamtzahl der Runden (10 Runden pro Spieler)
        currentRound: 0,
        diceValue: 0,
        attemptsMade: 0,
        maxAttempts: 0,
        trackDuration: 0, // Dauer des abgespielten Song-Snippets in ms
        currentTrack: null, // Der aktuell geratene Track
        player1SpeedRound: Math.floor(Math.random() * 10) + 1, // Zufällige Speed-Round für Spieler 1 (Runde 1-10)
        player2SpeedRound: Math.floor(Math.random() * 10) + 1, // Zufällige Speed-Round für Spieler 2 (Runde 1-10)
        isSpeedRound: false,
        speedRoundTimeout: null, // Timeout-ID für das automatische Auflösen der Speed-Round
        countdownInterval: null, // Interval-ID für den visuellen Speed-Round Countdown
        spotifyPlayTimeout: null, // Timeout-ID für das Pausieren des Songs im normalen Modus
        isSongPlaying: false, // Flag, ob der Song gerade über den Player läuft
        fadeInterval: null, // Interval-ID für den Fade-In/Out der Lautstärke
        currentSongVolume: 0, // Aktuelle Lautstärke für Fade-Effekte (0-100)
        diceAnimationTimeout: null, // Timeout-ID für die Würfel-Animation
    };

    // Variable zum Speichern des letzten sichtbaren Spiel-Screens, für den Fall, dass der Vollbildmodus verlassen wird.
    let lastGameScreenVisible = '';

    // Definiert die verfügbaren Genres und ihre zugehörigen Spotify Playlist IDs.
    const playlists = {
        pop: ['6mtYuOxzl58vSGnEDtZ9uB', '34NbomaTu7YuOYnky8nLXL'],
        alltime: ['2si7ChS6Y0hPBt4FsobXpg', '2y09fNnXHvoqc1WGHvbhkZ'],
        deutsch: ['7h64UGKHGWM5ucefn99frR', '4ytdW13RHl5u9dbRWAgxSZ'],
        party: ['53r5W67KJNIeHWAhVOWPDr']
    };

    //=======================================================================
    // Phase 1: Setup, Authentifizierung & Initialisierung
    //=======================================================================

    /**
     * Überprüft die Geräteausrichtung und zeigt bei Hochformat ein Overlay an.
     */
    function checkOrientation() {
        if (window.innerHeight > window.innerWidth) {
            rotateDeviceOverlay.classList.remove('hidden');
        } else {
            rotateDeviceOverlay.classList.add('hidden');
        }
    }

    /**
     * Generiert den Code Challenge für den PKCE-Flow.
     * @param {string} codeVerifier - Der generierte Code Verifier.
     * @returns {Promise<string>} Der Base64url-codierte SHA256-Hash des Code Verifiers.
     */
    async function generateCodeChallenge(codeVerifier) {
        const data = new TextEncoder().encode(codeVerifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
            .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    /**
     * Generiert einen zufälligen String für den Code Verifier.
     * @param {number} length - Die gewünschte Länge des Strings.
     * @returns {string} Ein zufälliger alphanumerischer String.
     */
    function generateRandomString(length) {
        let text = '';
        let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < length; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Leitet den Benutzer zum Spotify-Authentifizierungs-Flow weiter (PKCE).
     */
    async function redirectToAuthCodeFlow() {
        const verifier = generateRandomString(128);
        const challenge = await generateCodeChallenge(verifier);
        localStorage.setItem("verifier", verifier); // Speichert den Verifier für den Token-Austausch
        const params = new URLSearchParams();
        params.append("client_id", CLIENT_ID);
        params.append("response_type", "code");
        params.append("redirect_uri", REDIRECT_URI);
        params.append("scope", "streaming user-read-email user-read-private user-modify-playback-state user-read-playback-state");
        params.append("code_challenge_method", "S256");
        params.append("code_challenge", challenge);
        document.location = `${API_ENDPOINTS.SPOTIFY_AUTH}?${params.toString()}`;
    }

    /**
     * Ruft den Access Token von Spotify unter Verwendung des Authorization Codes und Code Verifiers ab.
     * @param {string} code - Der von Spotify zurückgegebene Authorization Code.
     * @returns {Promise<string>} Der Spotify Access Token.
     */
    async function getAccessToken(code) {
        const verifier = localStorage.getItem("verifier");
        const params = new URLSearchParams();
        params.append("client_id", CLIENT_ID);
        params.append("grant_type", "authorization_code");
        params.append("code", code);
        params.append("redirect_uri", REDIRECT_URI);
        params.append("code_verifier", verifier);

        try {
            const result = await fetch(API_ENDPOINTS.SPOTIFY_TOKEN, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params
            });

            if (!result.ok) {
                const errorData = await result.json().catch(() => ({}));
                const errorMessage = errorData.error && errorData.error.message ? errorData.error.message : result.statusText;
                console.error("Fehler beim Abrufen des Access Tokens:", result.status, errorMessage);
                alert(`Authentifizierung fehlgeschlagen: ${errorMessage}. Bitte versuchen Sie es erneut.`);
                // Bei Fehler zum Login-Screen zurückkehren
                loginScreen.classList.remove('hidden');
                document.getElementById('login-button').addEventListener('click', redirectToAuthCodeFlow);
                return null;
            }

            const { access_token } = await result.json();
            return access_token;
        } catch (error) {
            console.error("Netzwerkfehler beim Abrufen des Access Tokens:", error);
            alert("Netzwerkfehler während der Authentifizierung. Bitte überprüfen Sie Ihre Internetverbindung.");
            loginScreen.classList.remove('hidden');
            document.getElementById('login-button').addEventListener('click', redirectToAuthCodeFlow);
            return null;
        }
    }

    // Initialisierung nach dem Laden der Seite
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
        // Wenn ein Authorization Code in der URL ist, kommen wir von der Spotify-Weiterleitung zurück.
        window.history.pushState({}, '', REDIRECT_URI); // URL aufräumen
        getAccessToken(code).then(token => {
            if (token) {
                accessToken = token;
                loginScreen.classList.add('hidden');
                fullscreenScreen.classList.remove('hidden');
                initializePlayer(); // Spotify Player initialisieren
                window.addEventListener('resize', checkOrientation);
                checkOrientation(); // Initialprüfung der Orientierung
            } else {
                // Token konnte nicht abgerufen werden (Fehlerbehandlung in getAccessToken übernimmt die UI-Anpassung)
                console.warn("Access Token konnte nicht abgerufen werden, kehre zum Login zurück.");
            }
        });
    } else {
        // Standard-Ansicht: Zeige den Login-Screen.
        loginScreen.classList.remove('hidden');
        document.getElementById('login-button').addEventListener('click', redirectToAuthCodeFlow);
    }

    /**
     * Lädt das Spotify Web Player SDK und initialisiert den Player.
     */
    function initializePlayer() {
        // Vermeidet mehrfaches Laden des Skripts
        if (document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]')) {
            console.warn("Spotify SDK bereits geladen.");
            return;
        }

        const script = document.createElement('script');
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            spotifyPlayer = new Spotify.Player({
                name: 'TRACK ATTACK',
                getOAuthToken: cb => { cb(accessToken); }
            });

            // Listener für Player-Bereitschaft
            spotifyPlayer.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);
                deviceId = device_id;
            });

            // Listener für Player-Offline-Status
            spotifyPlayer.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
                // Hier könnte man den Benutzer informieren, dass der Player offline ist.
                alert("Dein Spotify-Gerät ist offline gegangen. Bitte überprüfe deine Spotify-App.");
            });

            // NEU: Listener für Änderungen des Player-Zustands (z.B. extern pausiert)
            spotifyPlayer.addListener('player_state_changed', state => {
                if (state) {
                    gameState.isSongPlaying = !state.paused;

                    // Wenn der Song pausiert wurde (z.B. extern), und wir einen Timeout haben, lösche ihn.
                    if (state.paused && gameState.spotifyPlayTimeout) {
                        clearTimeout(gameState.spotifyPlayTimeout);
                        gameState.spotifyPlayTimeout = null;
                        // Im normalen Modus den Play-Button wieder aktivieren, wenn pausiert wurde
                        if (!gameState.isSpeedRound && gameState.attemptsMade < gameState.maxAttempts) {
                             logoButton.classList.remove('inactive');
                        }
                    }
                }
            });

            // Verbindung zum Player herstellen
            spotifyPlayer.connect().then(success => {
                if (success) {
                    console.log('Spotify Player erfolgreich verbunden!');
                } else {
                    console.error('Verbindung zum Spotify Player fehlgeschlagen.');
                    alert("Konnte keine Verbindung zum Spotify Player herstellen. Bitte stellen Sie sicher, dass Spotify geöffnet ist.");
                }
            }).catch(error => {
                console.error("Fehler beim Verbinden des Spotify Players:", error);
                alert("Ein unerwarteter Fehler ist beim Verbinden mit Spotify aufgetreten.");
            });
        };
    }

    // Event Listener für das Verlassen des Vollbildmodus.
    // Speichert den aktuellen Spielzustand, um ihn beim erneuten Eintritt wiederherzustellen.
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            // Vollbildmodus wurde verlassen: Speichere den sichtbaren Screen.
            if (!logoButton.classList.contains('hidden')) {
                lastGameScreenVisible = 'logo-button';
            } else if (!diceContainer.classList.contains('hidden')) {
                lastGameScreenVisible = 'dice-container';
            } else if (!genreContainer.classList.contains('hidden')) {
                lastGameScreenVisible = 'genre-container';
            } else if (!revealContainer.classList.contains('hidden')) {
                lastGameScreenVisible = 'reveal-container';
            } else if (!scoreScreen.classList.contains('hidden')) { // Berücksichtige auch den Score-Screen
                lastGameScreenVisible = 'score-screen';
            } else {
                lastGameScreenVisible = '';
            }

            // Alle Spiel-Elemente verstecken und laufende Prozesse stoppen
            gameScreen.classList.add('hidden');
            revealContainer.classList.add('hidden');
            diceContainer.classList.add('hidden');
            genreContainer.classList.add('hidden');
            logoButton.classList.add('hidden');
            speedRoundTextDisplay.classList.add('hidden');
            revealButton.classList.add('hidden');
            playerScoresIngame.classList.add('hidden'); // In-Game Scores verstecken

            // Alle Timer und den Spotify Player stoppen
            if (spotifyPlayer) {
                spotifyPlayer.pause().catch(e => console.error("Fehler beim Pausieren des Players:", e));
            }
            // Umfassendes Aufräumen aller Timer und Intervalle
            clearTimeout(gameState.speedRoundTimeout);
            clearInterval(gameState.countdownInterval);
            clearTimeout(gameState.spotifyPlayTimeout);
            clearInterval(gameState.fadeInterval);
            clearTimeout(gameState.diceAnimationTimeout);
            gameState.isSongPlaying = false; // Setze Flag zurück
            
            // Den Vollbild-Screen wieder anzeigen
            fullscreenScreen.classList.remove('hidden');
        }
    });

    // Event Listener für das Aktivieren des Vollbildmodus.
    // Stellt den Spielzustand wieder her, der vor dem Verlassen des Vollbildmodus gespeichert wurde.
    fullscreenScreen.addEventListener('click', () => {
        document.documentElement.requestFullscreen().then(() => {
            fullscreenScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            playerScoresIngame.classList.remove('hidden'); // In-Game Scores wieder anzeigen
            updateInGameScores(); // Stellt sicher, dass die Punktanzeige aktuell ist

            // Stelle den letzten gespeicherten Zustand wieder her
            if (lastGameScreenVisible === 'dice-container') {
                showDiceScreen();
            } else if (lastGameScreenVisible === 'genre-container') {
                showGenreScreen();
            } else if (lastGameScreenVisible === 'reveal-container') {
                showResolution(); // Zeigt nur die Auflösung, ohne den Song neu zu starten
            } else if (lastGameScreenVisible === 'score-screen') {
                endGame(); // Zeigt den Score-Screen wieder an
            }
            else {
                // Wenn kein spezieller Zustand gespeichert ist, starte neu mit dem Logo.
                logoButton.classList.remove('hidden');
                logoButton.classList.add('initial-fly-in');
                logoButton.removeEventListener('click', startGame); // Sicherstellen, dass nur ein Listener aktiv ist
                logoButton.addEventListener('click', startGame, { once: true });
            }
        }).catch(error => {
            console.error("Fehler beim Anfordern des Vollbildmodus:", error);
            alert("Vollbildmodus konnte nicht aktiviert werden. Möglicherweise blockiert Ihr Browser dies.");
        });
    });

    //=======================================================================
    // Phase 2: Spielstart & UI-Grundlagen
    //=======================================================================

    /**
     * Führt eine "Bounce"-Animation auf einem Element aus.
     * @param {HTMLElement} element - Das zu animierende DOM-Element.
     */
    function triggerBounce(element) {
        element.classList.remove('bounce');
        void element.offsetWidth; // Erzwingt einen Reflow, um die Animation zurückzusetzen.
        element.classList.add('bounce');
    }

    /**
     * Startet das Spiel vom Logo-Screen aus.
     */
    function startGame() {
        triggerBounce(logoButton);
        logoButton.classList.add('inactive'); // Button während der Animation inaktiv machen.

        lastGameScreenVisible = 'logo-button'; // Zustand speichern.

        setTimeout(() => {
            appContainer.style.backgroundColor = 'var(--player1-color)'; // Startfarbe für Spieler 1.
            logoButton.classList.add('hidden');
            playerScoresIngame.classList.remove('hidden'); // In-Game Score anzeigen.
            updateInGameScores(); // Initial die Punkte aktualisieren (0:0) und aktiven Spieler hervorheben.
            showDiceScreen(); // Zum Würfel-Screen wechseln.
        }, 800); // Wartet, bis der Bounce-Effekt sichtbar war.
    }

    //=======================================================================
    // Phase 3: Würfel- & Genre-Auswahl
    //=======================================================================

    /**
     * Zeigt den Würfel-Auswahlbildschirm an.
     * Setzt die UI zurück und bereitet die nächste Runde vor.
     */
    function showDiceScreen() {
        resetRoundUI(); // Reinigt die UI und stoppt alle Timer der vorherigen Runde.
        gameState.currentRound++; // Erhöht die Rundenzahl.
        gameState.isSpeedRound = false; // Setzt den Speed-Round-Status zurück.

        // Überprüft, ob das Spielende erreicht ist.
        if (gameState.currentRound > gameState.totalRounds) {
            endGame();
            return;
        }

        // Setzt die Hintergrundfarbe basierend auf dem aktuellen Spieler.
        appContainer.style.backgroundColor = gameState.currentPlayer === 1 ? 'var(--player1-color)' : 'var(--player2-color)';
        console.log(`Hintergrundfarbe gesetzt für Spieler ${gameState.currentPlayer}.`);

        diceContainer.classList.remove('hidden');
        diceAnimation.classList.remove('hidden'); // Würfel-Animation anzeigen.
        diceSelection.classList.add('hidden'); // Würfel-Auswahl verstecken.

        lastGameScreenVisible = 'dice-container'; // Zustand speichern.

        // Setzt den Timeout für die Würfel-Animation, danach wird die Auswahl sichtbar.
        gameState.diceAnimationTimeout = setTimeout(() => {
            diceAnimation.classList.add('hidden');
            diceSelection.classList.remove('hidden');
        }, 2000); // 2 Sekunden Animationszeit.
    }

    // Event-Listener für das Überspringen der Würfel-Animation durch Klick.
    diceAnimation.addEventListener('click', () => {
        clearTimeout(gameState.diceAnimationTimeout); // Stoppt den automatischen Timeout.
        gameState.diceAnimationTimeout = null; // Zurücksetzen der ID.
        diceAnimation.classList.add('hidden');
        diceSelection.classList.remove('hidden');
    });

    // Event-Listener für die Auswahl eines Würfelwerts.
    document.querySelectorAll('.dice-option').forEach(dice => {
        dice.addEventListener('click', (e) => {
            const selectedValue = parseInt(e.target.dataset.value);
            gameState.diceValue = selectedValue;

            // Prüft, ob der ausgewählte Würfel in der Konfiguration existiert.
            const config = diceConfig[selectedValue];
            if (!config) {
                console.error(`Konfiguration für Würfelwert ${selectedValue} nicht gefunden!`);
                alert("Fehler: Ungültiger Würfelwert ausgewählt. Bitte versuchen Sie es erneut.");
                return;
            }

            // Kurze Verzögerung für visuellen Effekt vor dem Bildschirmwechsel.
            setTimeout(() => {
                gameState.trackDuration = config.duration;
                gameState.maxAttempts = config.attempts;
                gameState.attemptsMade = 0; // Setzt die Versuche für die neue Runde zurück.

                diceContainer.classList.add('hidden');
                showGenreScreen();
            }, 200);
        });
    });

    /**
     * Führt eine Blink-Animation für die Genre-Buttons aus.
     * @param {NodeListOf<Element>} buttons - Die zu animierenden Buttons.
     * @returns {Promise<void>} Ein Promise, das aufgelöst wird, wenn die Animation abgeschlossen ist.
     */
    function runGenreAnimation(buttons) {
        return new Promise(resolve => {
            buttons.forEach(btn => btn.classList.add('no-interaction')); // Deaktiviert Interaktionen während der Animation.
            const blinkInterval = setInterval(() => {
                buttons.forEach(btn => btn.classList.toggle('random-blink')); // Schaltet Blink-Klasse um.
            }, 100);

            setTimeout(() => {
                clearInterval(blinkInterval);
                buttons.forEach(btn => btn.classList.remove('random-blink'));
                buttons.forEach(btn => btn.classList.remove('no-interaction')); // Aktiviert Interaktionen wieder.
                resolve();
            }, 1800); // Dauer der gesamten Blink-Animation.
        });
    }

    /**
     * Zeigt den Genre-Auswahlbildschirm an und wählt ein Genre basierend auf dem Würfelwert aus.
     */
    async function showGenreScreen() {
        genreContainer.classList.remove('hidden');
        const buttons = document.querySelectorAll('.genre-button');

        // Zuerst alle bestehenden Listener entfernen, um Dopplungen zu vermeiden.
        // Setzt auch alle Buttons auf ihren Standardzustand zurück.
        buttons.forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('random-blink', 'disabled-genre');
            btn.removeEventListener('click', handleGenreSelection); // Wichtig: Alte Listener entfernen.
        });

        lastGameScreenVisible = 'genre-container'; // Zustand speichern.

        await runGenreAnimation(buttons); // Führt die Blink-Animation aus.

        if (gameState.diceValue === 7) { // Fall: Würfelwert ist 7 (aktive Auswahl)
            // Alle Buttons sind klickbar.
            buttons.forEach(btn => btn.disabled = false);

            // Wähle ein zufälliges Genre aus, das inaktiv sein soll.
            const randomIndex = Math.floor(Math.random() * buttons.length);
            const disabledButton = buttons[randomIndex];

            // Deaktiviere das ausgewählte Genre und markiere es visuell.
            disabledButton.disabled = true;
            disabledButton.classList.add('disabled-genre');

            // Füge Event-Listener für alle Buttons (außer dem deaktivierten) hinzu.
            buttons.forEach(btn => {
                if (!btn.disabled) { // Füge nur Listener zu aktiven Buttons hinzu.
                    btn.addEventListener('click', handleGenreSelection);
                }
            });

        } else { // Fall: Würfelwert ist 1-5 (zufälliges Genre wird vorgegeben)
            // Erst alle Buttons deaktivieren.
            buttons.forEach(btn => btn.disabled = true);

            // Dann ein zufälliges Genre auswählen und aktivieren.
            const randomIndex = Math.floor(Math.random() * buttons.length);
            const activeButton = buttons[randomIndex];

            activeButton.disabled = false;
            activeButton.classList.remove('disabled-genre'); // Sicherstellen, dass die visuelle Markierung entfernt ist.

            // Füge den Event-Listener nur für den aktiven Button hinzu.
            activeButton.addEventListener('click', handleGenreSelection);
        }
    }

    /**
     * Behandelt die Auswahl eines Genres.
     * @param {Event} e - Das Klick-Event.
     */
    async function handleGenreSelection(e) {
        const selectedGenre = e.target.dataset.genre;

        // Sofort alle Genre-Buttons deaktivieren und ihre Listener entfernen,
        // um weitere Klicks während der Animation oder des Ladens zu verhindern.
        document.querySelectorAll('.genre-button').forEach(btn => {
            btn.disabled = true;
            btn.removeEventListener('click', handleGenreSelection); // Wichtig: Listener entfernen.
        });

        await new Promise(resolve => setTimeout(resolve, 200)); // Kurze Verzögerung für visuellen Übergang.
        genreContainer.classList.add('hidden');

        // Speed-Round Check NACHDEM Genre gewählt wurde, aber VOR dem Track-Laden.
        const playerRound = Math.ceil(gameState.currentRound / 2);
        if ((gameState.currentPlayer === 1 && playerRound === gameState.player1SpeedRound) ||
            (gameState.currentPlayer === 2 && playerRound === gameState.player2SpeedRound)) {
            gameState.isSpeedRound = true;
            await showSpeedRoundAnimation(); // Zeigt die "Speed-Round" Animation.
        }

        await prepareAndShowRateScreen(selectedGenre); // Bereitet den Rate-Screen vor und lädt den Track.
    }

    //=======================================================================
    // Phase 4: Rate-Bildschirm & Spielerwechsel
    //=======================================================================

    /**
     * Ruft einen zufälligen Track aus einer Playlist des ausgewählten Genres ab.
     * @param {string} genre - Das ausgewählte Genre.
     * @returns {Promise<Object|null>} Der zufällig ausgewählte Track oder null bei Fehler.
     */
    async function getTrack(genre) {
        const playlistPool = playlists[genre];
        if (!playlistPool || playlistPool.length === 0) {
            console.error(`Keine Playlists für Genre "${genre}" definiert oder Pool ist leer.`);
            alert(`Fehler: Für das Genre "${genre}" sind keine Playlists verfügbar. Bitte versuchen Sie ein anderes Genre.`);
            showGenreScreen(); // Bei Fehler, zurück zum Genre-Auswahlbildschirm.
            return null;
        }

        const randomPlaylistId = playlistPool[Math.floor(Math.random() * playlistPool.length)];
        console.log(`DEBUG: Ausgewähltes Genre: "${genre}", Playlist-ID: "${randomPlaylistId}"`);

        try {
            const response = await fetch(API_ENDPOINTS.SPOTIFY_PLAYLIST_TRACKS(randomPlaylistId), {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                // Versucht, eine spezifischere Fehlermeldung vom Spotify-Server zu bekommen.
                const errorData = await response.json().catch(() => ({})); // Fängt Parsing-Fehler ab.
                const errorMessage = errorData.error && errorData.error.message ? errorData.error.message : response.statusText;
                console.error("Fehler beim Abrufen der Playlist-Tracks:", response.status, errorMessage, `Playlist ID: ${randomPlaylistId}`);
                alert(`Fehler beim Laden der Songs (Code: ${response.status}: ${errorMessage}). Bitte versuchen Sie ein anderes Genre oder überprüfen Sie Ihre Internetverbindung.`);
                showGenreScreen();
                return null;
            }

            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                console.warn(`Die Playlist ${randomPlaylistId} enthält keine abspielbaren Tracks.`);
                alert(`Die ausgewählte Playlist hat keine Songs oder ist leer. Bitte wählen Sie ein anderes Genre.`);
                showGenreScreen();
                return null;
            }

            // Filtert Tracks, die nicht null sind (manchmal gibt es "leere" Items).
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
        } catch (error) { // Fängt Netzwerkfehler oder andere unerwartete Fehler ab.
            console.error("Netzwerkfehler beim Abrufen der Playlist-Tracks:", error);
            alert("Ein Netzwerkfehler ist aufgetreten. Bitte überprüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.");
            showGenreScreen();
            return null;
        }
    }

    /**
     * Bereitet den Bildschirm für das Raten des Songs vor.
     * @param {string} genre - Das ausgewählte Genre.
     */
    async function prepareAndShowRateScreen(genre) {
        gameState.currentTrack = await getTrack(genre);
        if (!gameState.currentTrack) {
            // Wenn getTrack null zurückgibt (Fehler beim Laden),
            // kehren wir zur Genre-Auswahl zurück (wird in getTrack selbst gehandhabt).
            // Hier brauchen wir nichts weiter zu tun, außer die Funktion zu beenden.
            return;
        }

        console.log("Selected Track:", gameState.currentTrack.name);

        logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
        // Entfernt den Event-Listener, um sicherzustellen, dass er nur einmal hinzugefügt wird.
        logoButton.removeEventListener('click', playTrackSnippet);
        logoButton.addEventListener('click', playTrackSnippet);

        lastGameScreenVisible = 'reveal-container'; // Der Rate-Bildschirm wird unter 'reveal-container' zusammengefasst.
    }

    /**
     * Spielt ein Snippet des aktuellen Tracks ab.
     * Verwaltet die Anzahl der Versuche und die Wiedergabedauer.
     */
    function playTrackSnippet() {
        // Prüft, ob ein Gerät verbunden ist, bevor der Play-Request gesendet wird.
        if (!deviceId) {
            console.error("Spotify-Gerät nicht verbunden. Bitte stellen Sie sicher, dass Spotify geöffnet und verbunden ist.");
            alert("Spotify-Player ist nicht bereit. Bitte stellen Sie sicher, dass die Spotify-App geöffnet und ein Gerät ausgewählt ist, dann versuchen Sie es erneut.");
            logoButton.classList.remove('inactive'); // Button wieder aktiv machen.
            return;
        }

        // Im normalen Modus: Keine weiteren Versuche, wenn das Maximum erreicht ist.
        if (gameState.attemptsMade >= gameState.maxAttempts && !gameState.isSpeedRound) {
            return;
        }
        // In der Speed-Round: Nur ein Versuch erlaubt (erster Klick).
        if (gameState.isSpeedRound && gameState.attemptsMade > 0) {
            return;
        }

        triggerBounce(logoButton);
        logoButton.classList.add('inactive'); // Button nach dem Klick inaktiv machen.
        gameState.attemptsMade++;

        const trackDurationMs = gameState.currentTrack.duration_ms;
        // Stellt sicher, dass die Startposition nicht über das Ende des Tracks hinausgeht.
        const maxStartPosition = Math.max(0, trackDurationMs - gameState.trackDuration);
        const randomStartPosition = Math.floor(Math.random() * maxStartPosition);

        fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), {
            method: 'PUT',
            body: JSON.stringify({
                uris: [gameState.currentTrack.uri],
                position_ms: randomStartPosition
            }),
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }).then(response => {
            if (!response.ok) {
                response.json().then(errorData => {
                    const errorMessage = errorData.error && errorData.error.message ? errorData.error.message : response.statusText;
                    console.error("Fehler beim Abspielen des Tracks:", response.status, errorMessage);
                    alert(`Konnte den Song nicht abspielen (Code: ${response.status}). Möglicherweise ist kein aktives Spotify-Gerät ausgewählt oder es gibt ein Problem mit dem Access Token. ${errorMessage}`);
                    logoButton.classList.remove('inactive'); // Button wieder aktiv machen.
                }).catch(() => {
                    // Fallback, wenn JSON-Parsing der Fehlermeldung fehlschlägt.
                    console.error("Fehler beim Abspielen des Tracks:", response.status, response.statusText);
                    alert(`Konnte den Song nicht abspielen (Code: ${response.status}). Bitte stellen Sie sicher, dass ein aktives Spotify-Gerät ausgewählt ist.`);
                    logoButton.classList.remove('inactive');
                });
                return;
            }
            gameState.isSongPlaying = true; // Setzt das Flag, dass der Song spielt.

            if (gameState.isSpeedRound) {
                startVisualSpeedRoundCountdown(); // Startet den visuellen 7-Sekunden-Countdown.
                // Der Song wird in der Speed-Round nach 7 Sekunden automatisch pausiert und aufgelöst.
            } else {
                // Normaler Modus: Song pausiert nach der festgelegten trackDuration.
                gameState.spotifyPlayTimeout = setTimeout(() => {
                    spotifyPlayer.pause().catch(e => console.error("Fehler beim Pausieren des Players nach Timeout:", e));
                    gameState.isSongPlaying = false;
                    // Button wieder aktiv machen, wenn noch Versuche übrig sind.
                    if (gameState.attemptsMade < gameState.maxAttempts) {
                        logoButton.classList.remove('inactive');
                    }
                }, gameState.trackDuration);
            }
        }).catch(error => {
            console.error("Netzwerkfehler beim Abspielen des Tracks:", error);
            alert("Problem beim Verbinden mit Spotify. Bitte überprüfen Sie Ihre Internetverbindung.");
            logoButton.classList.remove('inactive');
        });

        // "AUFLÖSEN"-Button nach dem ersten Versuch anzeigen (nicht in Speed-Round, da dort automatisch aufgelöst wird).
        if (gameState.attemptsMade === 1 && !gameState.isSpeedRound) {
            revealButton.classList.remove('hidden');
            revealButton.classList.remove('no-interaction'); // Ermöglicht Klick auf den Button.
        }
    }

    /**
     * Zeigt die Auflösung des Tracks an (Titel, Künstler, Album) und spielt den Song ab.
     */
    function showResolution() {
        // Alle Timer und Intervalle der Speed-Round und des Song-Timings stoppen.
        clearTimeout(gameState.speedRoundTimeout);
        clearInterval(gameState.countdownInterval);
        clearTimeout(gameState.spotifyPlayTimeout);
        clearInterval(gameState.fadeInterval);

        // Spotify Player pausieren, falls noch aktiv.
        if (gameState.isSongPlaying && spotifyPlayer) {
            spotifyPlayer.pause().catch(e => console.error("Fehler beim Pausieren des Players für Auflösung:", e));
            gameState.isSongPlaying = false;
        }

        // UI-Elemente ausblenden/zurücksetzen.
        countdownDisplay.classList.add('hidden');
        countdownDisplay.classList.remove('countdown-animated');
        countdownDisplay.innerText = '';

        logoButton.classList.add('inactive', 'hidden');
        revealButton.classList.add('hidden');
        speedRoundTextDisplay.classList.add('hidden');

        // Track-Informationen anzeigen.
        document.getElementById('album-cover').src = gameState.currentTrack.album.images[0].url;
        document.getElementById('track-title').innerText = gameState.currentTrack.name;
        document.getElementById('track-artist').innerText = gameState.currentTrack.artists.map(a => a.name).join(', ');
        trackAlbum.innerText = gameState.currentTrack.album.name;
        trackYear.innerText = `(${gameState.currentTrack.album.release_date.substring(0, 4)})`;

        revealContainer.classList.remove('hidden');
        lastGameScreenVisible = 'reveal-container'; // Zustand speichern.

        playSongForResolution(); // Spielt den Song bei der Auflösung ab.
    }

    /**
     * Spielt den vollständigen Song bei der Auflösung ab, mit Fade-In-Effekt.
     */
    async function playSongForResolution() {
        if (!gameState.currentTrack || !deviceId) {
            console.warn("Kein Track oder Gerät verfügbar, kann Song nicht abspielen.");
            return;
        }

        const startPositionMs = 30 * 1000; // Startet den Song bei 30 Sekunden.
        const targetVolume = 80; // Ziel-Lautstärke in Prozent.
        const fadeDuration = 2000; // Fade-In Dauer in Millisekunden (2 Sekunden).
        const fadeStep = 5; // Schrittweite für die Lautstärkeanpassung.
        const intervalTime = fadeDuration / (targetVolume / fadeStep); // Berechnet das Intervall für jeden Schritt.

        // Sicherstellen, dass die Lautstärke auf 0 gesetzt ist, bevor der Song startet, um einen sauberen Fade-In zu gewährleisten.
        spotifyPlayer.setVolume(0).then(() => {
            gameState.currentSongVolume = 0; // Setzt die interne Volume auf 0.

            // Startet den Song bei der festgelegten Position.
            fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), {
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
                gameState.isSongPlaying = true; // Song spielt jetzt.

                // Startet den Fade-In-Effekt.
                gameState.fadeInterval = setInterval(() => {
                    if (gameState.currentSongVolume < targetVolume) {
                        gameState.currentSongVolume = Math.min(gameState.currentSongVolume + fadeStep, targetVolume);
                        spotifyPlayer.setVolume(gameState.currentSongVolume / 100).catch(e => console.error("Fehler beim Setzen der Lautstärke:", e));
                    } else {
                        clearInterval(gameState.fadeInterval); // Beendet den Fade-In, wenn die ZIel-Lautstärke erreicht ist.
                        gameState.fadeInterval = null;
                    }
                }, intervalTime);
            }).catch(error => {
                console.error("Netzwerkfehler beim Starten des Songs für Auflösung:", error);
                alert("Problem beim Abspielen des Songs für die Auflösung. Bitte überprüfen Sie Ihre Internetverbindung.");
            });
        }).catch(error => {
            console.error("Fehler beim Setzen der Initiallautstärke auf 0:", error);
            alert("Ein Problem ist aufgetreten beim Vorbereiten der Audiowiedergabe.");
        });
    }

    /**
     * Führt einen sanften Fade-Out des aktuell spielenden Audiotracks durch.
     * @returns {Promise<void>} Ein Promise, das aufgelöst wird, wenn der Fade-Out abgeschlossen ist.
     */
    function fadeAudioOut() {
        return new Promise(resolve => {
            // Wenn kein Player oder kein Song spielt, direkt auflösen.
            if (!spotifyPlayer || !gameState.isSongPlaying) {
                resolve();
                return;
            }

            clearInterval(gameState.fadeInterval); // Stellt sicher, dass kein Fade-In mehr läuft.

            const fadeDuration = 500; // Fade-Out Dauer in Millisekunden (0.5 Sekunden).
            const fadeStep = 5; // Schrittweite für die Lautstärkeanpassung.
            // Nutzt die letzte bekannte Lautstärke vom Fade-In als Startpunkt.
            const currentVolumePercent = gameState.currentSongVolume;

            // Berechnet die Intervallzeit basierend auf der aktuellen Lautstärke und Fade-Dauer.
            const intervalTime = fadeDuration / (currentVolumePercent / fadeStep);

            gameState.fadeInterval = setInterval(() => {
                if (gameState.currentSongVolume > 0) {
                    gameState.currentSongVolume = Math.max(0, gameState.currentSongVolume - fadeStep);
                    spotifyPlayer.setVolume(gameState.currentSongVolume / 100).catch(e => console.error("Fehler beim Fade-Out Lautstärke setzen:", e));
                } else {
                    clearInterval(gameState.fadeInterval); // Stoppt den Interval, wenn Lautstärke 0 erreicht.
                    gameState.fadeInterval = null;
                    resolve(); // Fade-Out abgeschlossen.
                }
            }, intervalTime);
        });
    }

    // Event Listener für den "AUFLÖSEN"-Button.
    revealButton.addEventListener('click', async () => {
        revealButton.classList.add('no-interaction'); // Verhindert Doppelklicks.

        // Kurze Verzögerung für eine bessere visuelle Erfahrung (z.B. Pulldown-Effekt des Buttons).
        await new Promise(resolve => setTimeout(resolve, 200));

        await fadeAudioOut(); // Führt den Fade-Out des Songs durch.

        // Pausiert den Song endgültig, falls er noch spielt.
        if (gameState.isSongPlaying && spotifyPlayer) {
            spotifyPlayer.pause().catch(e => console.error("Fehler beim Pausieren des Players nach Fade-Out:", e));
            gameState.isSongPlaying = false;
        }

        showResolution(); // Zeigt die Track-Informationen an.
    });

    /**
     * Verarbeitet das Feedback des Spielers (richtig/falsch).
     * @param {boolean} isCorrect - True, wenn die Antwort richtig war, sonst False.
     */
    function handleFeedback(isCorrect) {
        correctButton.classList.add('no-interaction'); // Deaktiviert Buttons, um Mehrfachklicks zu verhindern.
        wrongButton.classList.add('no-interaction');

        // Startet den Fade-Out des Songs, bevor die Punktelogik ausgeführt wird.
        fadeAudioOut().then(() => {
            // Song pausieren, falls er noch spielt (redundant, aber sicherheitshalber).
            if (gameState.isSongPlaying && spotifyPlayer) {
                spotifyPlayer.pause().catch(e => console.error("Fehler beim Pausieren des Players in handleFeedback:", e));
                gameState.isSongPlaying = false;
            }

            let pointsAwarded = 0;

            if (isCorrect) {
                // Berechnet die vergebenen Punkte basierend auf Würfelwert und Versuchen.
                pointsAwarded = Math.max(1, gameState.diceValue - (gameState.attemptsMade - 1));
                if (gameState.currentPlayer === 1) {
                    gameState.player1Score += pointsAwarded;
                } else {
                    gameState.player2Score += pointsAwarded;
                }
                updateInGameScores(); // Aktualisiert die In-Game-Punktanzeige.
            }

            // Zeigt die Animation der vergebenen Punkte an.
            displayPointsAnimation(pointsAwarded, gameState.currentPlayer)
                .then(() => {
                    // Spielerwechsel und Hintergrundfarben-Anpassung.
                    gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
                    appContainer.style.backgroundColor = gameState.currentPlayer === 1 ? 'var(--player1-color)' : 'var(--player2-color)';
                    updateInGameScores(); // Aktualisiert die In-Game-Punktanzeige für den neuen Spieler.

                    // Feedback-Buttons verstecken, "NÄCHSTE RUNDE" Button anzeigen.
                    document.getElementById('feedback-buttons').classList.add('hidden');
                    nextRoundButton.classList.remove('hidden'); // Macht den "NÄCHSTE RUNDE" Button sichtbar.
                });
        });
    }

    /**
     * Aktualisiert die In-Game-Punktanzeige für Spieler 1 und Spieler 2.
     * Hebt den aktuell spielenden Spieler visuell hervor.
     */
    function updateInGameScores() {
        player1ScoreIngame.innerText = `Player 1: ${gameState.player1Score}`;
        player2ScoreIngame.innerText = `Player 2: ${gameState.player2Score}`;

        if (gameState.currentPlayer === 1) {
            player1ScoreIngame.classList.add('active-player-score');
            player2ScoreIngame.classList.remove('active-player-score');
        } else {
            player2ScoreIngame.classList.add('active-player-score');
            player1ScoreIngame.classList.remove('active-player-score');
        }
    }

    /**
     * Zeigt eine animierte Punkteanzeige, die zu den entsprechenden Spielern fliegt.
     * @param {number} points - Die Anzahl der Punkte, die angezeigt werden sollen.
     * @param {number} player - Der Spieler (1 oder 2), dem die Punkte zugeordnet werden.
     * @returns {Promise<void>} Ein Promise, das aufgelöst wird, wenn die Animation beendet ist.
     */
    function displayPointsAnimation(points, player) {
        return new Promise(resolve => {
            // Alle vorherigen Animationsklassen entfernen und Element für den Start vorbereiten.
            countdownDisplay.classList.remove('hidden', 'countdown-animated', 'fly-to-corner-player1', 'fly-to-corner-player2', 'points-pop-in');
            countdownDisplay.innerText = points > 0 ? `+${points}` : ''; // Zeigt Punkte nur an, wenn > 0.

            // Start-Stile für die Punkteanzeige setzen (für die 'pop-in' Animation).
            countdownDisplay.style.opacity = '0';
            countdownDisplay.style.transform = 'translate(-50%, -50%) scale(0.8)';
            countdownDisplay.style.top = '50%'; // Vertikale Mitte.

            if (player === 1) {
                countdownDisplay.style.color = 'var(--punktefarbe-player1)';
                countdownDisplay.style.left = '50%'; // Startet mittig.
            } else {
                countdownDisplay.style.color = 'var(--punktefarbe-player2)';
                countdownDisplay.style.left = '50%'; // Startet mittig.
            }

            void countdownDisplay.offsetWidth; // Erzwingt Reflow, damit Start-Stile angewendet werden.

            // Phase 1: Punkte sanft einblenden (Pop-in).
            if (points > 0) { // Nur animieren, wenn Punkte vergeben werden.
                countdownDisplay.classList.add('points-pop-in');
            }

            const popInDuration = 1000; // Dauer des Einblendens (passt zur CSS-Transition).
            const flyAnimationDuration = 400; // Dauer der "Wegfliegen"-Animation (passt zur CSS-Transition).

            // Phase 2: Nach dem Einblenden die "Wegfliegen"-Animation starten.
            setTimeout(() => {
                countdownDisplay.classList.remove('points-pop-in');
                if (player === 1) {
                    countdownDisplay.classList.add('fly-to-corner-player1');
                } else {
                    countdownDisplay.classList.add('fly-to-corner-player2');
                }
            }, popInDuration);

            // Nach der gesamten Animationsdauer das Element verstecken und Promise auflösen.
            setTimeout(() => {
                countdownDisplay.classList.add('hidden');
                // Animationsklassen entfernen, damit sie beim nächsten Mal sauber starten.
                countdownDisplay.classList.remove('fly-to-corner-player1', 'fly-to-corner-player2');
                countdownDisplay.innerText = '';

                // Stile auf den Standardwert zurücksetzen, falls countdownDisplay auch für den Countdown genutzt wird.
                countdownDisplay.style.color = 'var(--white)';
                countdownDisplay.style.left = '50%';
                countdownDisplay.style.top = '50%';
                countdownDisplay.style.opacity = '1';
                countdownDisplay.style.transform = 'translate(-50%, -50%) scale(1)';
                resolve(); // Promise auflösen, damit der nächste Schritt ausgeführt werden kann.
            }, popInDuration + flyAnimationDuration);
        });
    }

    // Event-Listener für die Feedback-Buttons.
    document.getElementById('correct-button').addEventListener('click', () => handleFeedback(true));
    document.getElementById('wrong-button').addEventListener('click', () => handleFeedback(false));

    // NEU: Event-Listener für den "NÄCHSTE RUNDE" Button.
    nextRoundButton.addEventListener('click', () => {
        nextRoundButton.classList.add('hidden'); // Versteckt den Button sofort.
        // Die Feedback-Buttons werden in resetRoundUI wieder sichtbar gemacht.
        resetRoundUI(); // Bereinigt die UI und setzt Timer zurück.
        showDiceScreen(); // Startet die nächste Runde mit dem Würfel-Screen.
    });

    /**
     * Setzt die UI-Elemente für eine neue Runde zurück und stoppt alle aktiven Timer/Intervalle.
     * Dies ist entscheidend für die Robustheit der Anwendung und zur Vermeidung von Memory Leaks.
     */
    function resetRoundUI() {
        // UI-Elemente verstecken.
        revealContainer.classList.add('hidden');
        logoButton.classList.add('hidden');
        genreContainer.classList.add('hidden');
        diceContainer.classList.add('hidden');
        revealButton.classList.add('hidden');
        speedRoundTextDisplay.classList.add('hidden');
        playerScoresIngame.classList.remove('hidden'); // In-Game Scores bleiben sichtbar.

        // Feedback- und Next-Round-Buttons zurücksetzen.
        correctButton.classList.remove('no-interaction');
        wrongButton.classList.remove('no-interaction');
        nextRoundButton.classList.add('hidden');
        document.getElementById('feedback-buttons').classList.remove('hidden');

        // Entfernen Sie alle spezifischen Event-Listener von Elementen,
        // die in der nächsten Phase neue Listener erhalten.
        logoButton.removeEventListener('click', playTrackSnippet);
        document.querySelectorAll('.genre-button').forEach(btn => btn.removeEventListener('click', handleGenreSelection));


        // Alle laufenden Timer und Intervalle beenden und ihre Referenzen zurücksetzen.
        // Dies verhindert, dass alte Funktionen nach dem Rundenwechsel ausgeführt werden.
        clearTimeout(gameState.speedRoundTimeout);
        gameState.speedRoundTimeout = null;
        clearInterval(gameState.countdownInterval);
        gameState.countdownInterval = null;
        clearTimeout(gameState.spotifyPlayTimeout);
        gameState.spotifyPlayTimeout = null;
        clearInterval(gameState.fadeInterval);
        gameState.fadeInterval = null;
        clearTimeout(gameState.diceAnimationTimeout);
        gameState.diceAnimationTimeout = null;

        // Spotify Player pausieren, falls noch aktiv, und Lautstärke zurücksetzen.
        if (spotifyPlayer) {
            if (gameState.isSongPlaying) {
                spotifyPlayer.pause().catch(e => console.error("Fehler beim Pausieren des Players in resetRoundUI:", e));
                gameState.isSongPlaying = false;
            }
            spotifyPlayer.setVolume(1.0) // Setzt die Lautstärke auf 100% für den nächsten Rateversuch.
                .then(() => console.log("Lautstärke auf 100% zurückgesetzt."))
                .catch(error => console.error("Fehler beim Zurücksetzen der Lautstärke:", error));
        }

        // Countdown-Display zurücksetzen, falls es aktiv war oder für Punkteanzeige genutzt wurde.
        countdownDisplay.classList.add('hidden');
        countdownDisplay.classList.remove('countdown-animated', 'fly-to-corner-player1', 'fly-to-corner-player2', 'points-pop-in');
        countdownDisplay.innerText = '';
        countdownDisplay.style.opacity = '1'; // Opacity zurücksetzen.
        countdownDisplay.style.transform = 'translate(-50%, -50%) scale(1)'; // Transform zurücksetzen.
        countdownDisplay.style.color = 'var(--white)'; // Auf Standardfarbe zurücksetzen.
        countdownDisplay.style.left = '50%'; // Position zurücksetzen.
        countdownDisplay.style.top = '50%'; // Position zurücksetzen.

        // Entfernen der spezifischen CSS-Klasse von deaktivierten Genre-Buttons.
        document.querySelectorAll('.genre-button').forEach(btn => {
            btn.classList.remove('disabled-genre');
        });
    }

    //=======================================================================
    // Phase 5: Spielende & Reset
    //=======================================================================

    /**
     * Beendet das Spiel und zeigt den Punktestand an.
     */
    function endGame() {
        gameScreen.classList.add('hidden');
        scoreScreen.classList.remove('hidden');
        appContainer.style.backgroundColor = 'transparent';
        playerScoresIngame.classList.add('hidden'); // In-Game Scores verstecken.

        lastGameScreenVisible = 'score-screen'; // Zustand speichern.

        const p1ScoreEl = document.getElementById('player1-score-display');
        const p2ScoreEl = document.getElementById('player2-score-display');
        p1ScoreEl.innerText = gameState.player1Score;
        p2ScoreEl.innerText = gameState.player2Score;
        p1ScoreEl.style.opacity = '1'; // Macht die Punkte sichtbar.
        p2ScoreEl.style.opacity = '1';

        // Nach 7 Sekunden werden die Punkte ausgeblendet.
        setTimeout(() => {
            p1ScoreEl.style.opacity = '0';
            p2ScoreEl.style.opacity = '0';
        }, 7000);

        // Nach 8 Sekunden wird das Spiel zurückgesetzt und zum Startbildschirm gewechselt.
        setTimeout(resetGame, 8000);
    }

    /**
     * Setzt den gesamten Spielstatus und die UI auf den Ausgangszustand zurück.
     */
    function resetGame() {
        scoreScreen.classList.add('hidden');
        appContainer.style.backgroundColor = 'var(--black)';

        // Rufe resetRoundUI auf, um alle Timer und UI-Elemente zu bereinigen,
        // bevor der Spielstatus zurückgesetzt wird. Dies ist ein umfassendes Aufräumen.
        resetRoundUI();

        // Setzt alle Spielstatus-Variablen auf ihre Initialwerte zurück.
        gameState.player1Score = 0;
        gameState.player2Score = 0;
        gameState.currentPlayer = Math.random() < 0.5 ? 1 : 2; // Zufälligen Startspieler für das neue Spiel.
        gameState.currentRound = 0;
        gameState.diceValue = 0;
        gameState.attemptsMade = 0;
        gameState.maxAttempts = 0;
        gameState.trackDuration = 0;
        gameState.currentTrack = null;
        gameState.player1SpeedRound = Math.floor(Math.random() * 10) + 1;
        gameState.player2SpeedRound = Math.floor(Math.random() * 10) + 1;
        gameState.isSpeedRound = false;

        // Zeigt den Game-Screen und den Logo-Button für einen Neustart an.
        gameScreen.classList.remove('hidden');
        logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
        logoButton.removeEventListener('click', startGame); // Entfernt alte Listener.
        logoButton.addEventListener('click', startGame, { once: true }); // Fügt neuen Listener hinzu.

        lastGameScreenVisible = ''; // Setzt den gespeicherten Zustand zurück.
    }

    //=======================================================================
    // Phase 6: Sonderfunktion "Speed-Round"
    //=======================================================================

    /**
     * Zeigt die visuelle Animation für den Beginn einer Speed-Round an.
     * @returns {Promise<void>} Ein Promise, das aufgelöst wird, wenn die Animation abgeschlossen ist.
     */
    function showSpeedRoundAnimation() {
        return new Promise(resolve => {
            speedRoundTextDisplay.classList.remove('hidden'); // Zeigt den Speed-Round Text an.
            setTimeout(() => {
                speedRoundTextDisplay.classList.add('hidden'); // Versteckt den Text nach einer kurzen Zeit.
                resolve();
            }, 3500); // Dauer der Speed-Round Textanzeige.
        });
    }

    /**
     * Startet den visuellen Countdown für die Speed-Round.
     * Nach Ablauf des Countdowns wird die Auflösung automatisch ausgelöst.
     */
    function startVisualSpeedRoundCountdown() {
        let timeLeft = 7; // Countdown beginnt bei 7 Sekunden.
        countdownDisplay.classList.remove('hidden'); // Macht die Countdown-Anzeige sichtbar.

        // Timer für die automatische Auflösung nach der vollen Dauer der Speed-Round (7 Sekunden).
        gameState.speedRoundTimeout = setTimeout(() => {
            showResolution(); // Löst die Anzeige der Track-Informationen aus.
        }, 7000);

        // Zeigt sofort die erste Zahl an und animiert sie.
        countdownDisplay.innerText = timeLeft;
        countdownDisplay.classList.remove('countdown-animated');
        void countdownDisplay.offsetWidth; // Erzwingt Reflow, um Animation zurückzusetzen.
        countdownDisplay.classList.add('countdown-animated');

        // Interval für den visuellen Countdown, aktualisiert jede Sekunde.
        gameState.countdownInterval = setInterval(() => {
            timeLeft--; // Verringert die verbleibende Zeit.

            if (timeLeft >= 0) { // Solange die Zahl 0 oder größer ist.
                countdownDisplay.innerText = timeLeft;
                countdownDisplay.classList.remove('countdown-animated');
                void countdownDisplay.offsetWidth; // Erzwingt Reflow für neue Animation.
                countdownDisplay.classList.add('countdown-animated');
            }

            if (timeLeft < 0) { // Wenn Countdown abgelaufen ist (nach 0).
                clearInterval(gameState.countdownInterval); // Stoppt den Interval.
                gameState.countdownInterval = null; // Zurücksetzen der ID.
                countdownDisplay.classList.add('hidden'); // Countdown ausblenden.
                countdownDisplay.innerText = ''; // Inhalt leeren.
                // showResolution wird bereits durch speedRoundTimeout ausgelöst.
            }
        }, 1000); // Aktualisiert jede Sekunde.
    }

}); // Ende DOMContentLoaded-Event-Listener
