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
    // const rotateDeviceOverlay = document.getElementById('rotate-device-overlay'); // ENTFERNT
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
    const tokenTimer = document.getElementById('token-timer');

    // NEU: Konstante für das EINE digitale Würfelbild
    const digitalDiceArea = document.getElementById('digital-dice-area');
    const digitalDiceMainImage = document.getElementById('digital-dice-main-image');

    // NEU: DOM-Elemente für die Start-Genre-Auswahl
    const startGenreSelectionContainer = document.getElementById('start-genre-selection-container');
    const allGenresScrollbox = document.getElementById('all-genres-scrollbox');
    const preselectionStartButton = document.getElementById('preselection-start-button'); // NEU
    const preselectionTitle = document.getElementById('preselection-title'); // NEU

    const HIDDEN_CLASS = 'hidden';
    const INACTIVE_CLASS = 'inactive';
    const INITIAL_FLY_IN_CLASS = 'initial-fly-in';
    const FADE_IN_CLASS = 'fade-in-visible'; // NEU: Klasse für das sanfte Einblenden

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
        'deutscher hip hop': ['1bG3S6G5BmmgN08EBDfzE5', '54Ac6qneIdV0VEXewKyI3W'],
        'internationale rapsongs': ['0h8A0Qt4TD2cl74CrgldWj'],
        'deutscher pop-sommer 2025': ['6Aq2xcWvFXBoExv64eGm5o']
    };

    //=======================================================================
    // Phase 1: Setup, Authentifizierung & Initialisierung
    //=======================================================================

    // NEU: Funktion, die das Spiel direkt startet, da keine Orientierung geprüft wird
function startGameOnLoad() {
    gameScreen.classList.remove(HIDDEN_CLASS);

    // Der Logo-Button ist von Anfang an klickbar
    logoButton.classList.remove(HIDDEN_CLASS, INACTIVE_CLASS);
    logoButton.classList.add(INITIAL_FLY_IN_CLASS);

    if (logoFlyInSound) {
        logoFlyInSound.currentTime = 0;
        logoFlyInSound.volume = 0.3;
        logoFlyInSound.play().catch(error => {
            console.warn("Autoplay für Logo-Sound blockiert oder Fehler:", error);
        });
    }

    // Wenn der Benutzer auf das Logo klickt, wird die Genre-Auswahl angezeigt
    logoButton.addEventListener('click', handleLogoClick, { once: true });
    
    // Die Genres einmalig rendern
    renderPreselectionGenres();
    
    // Füge den Klick-Listener für den "LET'S GO"-Button hinzu
    preselectionStartButton.addEventListener('click', () => {
        if (!preselectionStartButton.disabled) {
            // Genre-Auswahl ausblenden
            startGenreSelectionContainer.classList.remove(FADE_IN_CLASS);
            startGenreSelectionContainer.classList.add(HIDDEN_CLASS);
            // Spiel starten
            startGame();
        }
    });
}

    // NEU: Separater Handler für den Logo-Klick
function handleLogoClick() {
    // Stoppt die Animation des Logos
    logoButton.classList.remove(INITIAL_FLY_IN_CLASS);
    
    // Versteckt das Logo
    logoButton.classList.add(HIDDEN_CLASS);
    
    // Zeigt die Genre-Vorauswahl an und startet den Fade-In
    startGenreSelectionContainer.classList.remove(HIDDEN_CLASS);
    setTimeout(() => {
        startGenreSelectionContainer.classList.add(FADE_IN_CLASS);
    }, 10);
}

    function startTokenTimer() {
        const totalDuration = 60 * 60; // 60 Minuten in Sekunden
        let timeLeft = totalDuration;

        tokenTimer.classList.remove('hidden');

        function updateTimerDisplay() {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            tokenTimer.innerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        updateTimerDisplay(); // Initialen Wert setzen

        const timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                tokenTimer.innerText = 'Token abgelaufen!';
            }
        }, 1000); // Jede Sekunde aktualisieren
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
        document.location = `${API_ENDPOINTS.SPOTIFY_AUTH}?${params.toString()}`;
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

        const result = await fetch(API_ENDPOINTS.SPOTIFY_TOKEN, {
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
        window.history.pushState({}, '', REDIRECT_URI);

        getAccessToken(code).then(token => {
            accessToken = token;
            loginScreen.classList.add('hidden');
            initializePlayer();
            startTokenTimer();
            
            // RUFT JETZT DIE NEUE FUNKTION FÜR DEN SPIELSTART AUF
            startGameOnLoad();

        }).catch(error => {
            console.error("Fehler beim Abrufen des Access Tokens:", error);
            alert("Anmeldung bei Spotify fehlgeschlagen. Bitte versuchen Sie es erneut.");
            loginScreen.classList.remove('hidden');
            document.getElementById('login-button').removeEventListener('click', redirectToAuthCodeFlow);
            document.getElementById('login-button').addEventListener('click', redirectToAuthCodeFlow);
        });

    } else {
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

// --- NEU: Funktion: Genres für die Vorauswahl rendern ---
function renderPreselectionGenres() {
    allGenresScrollbox.innerHTML = '';
    const allAvailableGenres = Object.keys(playlists);
    
    // Sortiere die Genres alphabetisch, um eine konsistente Reihenfolge zu gewährleisten
    allAvailableGenres.sort();

    allAvailableGenres.forEach(genreName => {
        const button = document.createElement('button');
        button.classList.add('preselect-genre-button');
        button.dataset.genre = genreName;
        // Passe den Text für die Anzeige an: "pop hits 2000-2025" -> "Pop Hits 2000-2025"
        const formattedGenreName = genreName.split(' ').map(word => {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');

        button.innerText = formattedGenreName;

        if (gameState.selectedPlayableGenres.includes(genreName)) {
            button.classList.add('selected');
        }
        button.addEventListener('click', () => {
            toggleGenreSelection(genreName, button);
        });
        allGenresScrollbox.appendChild(button);
    });
    // Überprüfe den Status des Buttons nach dem Rendern
    updatePreselectionButtonState();
}

    // --- NEU: Funktion: Genre in der Vorauswahl auswählen/abwählen ---
function toggleGenreSelection(genreName, buttonElement) {
    const index = gameState.selectedPlayableGenres.indexOf(genreName);

    if (index > -1) {
        // Genre abwählen
        gameState.selectedPlayableGenres.splice(index, 1);
        buttonElement.classList.remove('selected');
    } else {
        // Genre auswählen
        gameState.selectedPlayableGenres.push(genreName);
        buttonElement.classList.add('selected');
    }
    console.log("Aktuell ausgewählte Genres:", gameState.selectedPlayableGenres);
    // Überprüfe den Status des Buttons nach jeder Auswahl
    updatePreselectionButtonState();
}

    // NEU: Funktion zum Aktualisieren des "LET'S GO"-Buttons
function updatePreselectionButtonState() {
    if (gameState.selectedPlayableGenres.length >= 3) {
        preselectionStartButton.classList.remove('disabled');
        preselectionStartButton.disabled = false;
    } else {
        preselectionStartButton.classList.add('disabled');
        preselectionStartButton.disabled = true;
    }
}

// NEU: Event-Listener für den "LET'S GO"-Button
preselectionStartButton.addEventListener('click', () => {
    // Wenn der Button aktiv ist...
    if (!preselectionStartButton.classList.contains('disabled')) {
        startGenreSelectionContainer.classList.add('hidden');
        logoButton.classList.remove('hidden');
        
        // Führe die Logik für den Start des Spiels aus
        startGame();
    }
});

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
    // Entferne die sanfte Einblendung
    startGenreSelectionContainer.classList.remove(FADE_IN_CLASS);
    // Verstecke den Container nach dem Klick
    startGenreSelectionContainer.classList.add(HIDDEN_CLASS);

    // Füge die Startlogik hier ein, da das Spiel jetzt vom "LET'S GO"-Button gestartet wird
    appContainer.style.backgroundColor = 'var(--player1-color)';
    logoButton.classList.add(HIDDEN_CLASS);
    showDiceScreen();
}

    //=======================================================================
    // Phase 3: Würfel- & Genre-Auswahl
    //=======================================================================

    function handleDiceAnimationEnd() {
        clearTimeout(gameState.diceAnimationTimeout);
        diceAnimation.classList.add('hidden');
        diceSelection.classList.remove('hidden');
        digitalDiceArea.classList.remove('hidden');
        document.querySelectorAll('.dice-option').forEach(dice => {
            dice.classList.remove('no-interaction');
        });
    }

    function showDiceScreen() {
        resetRoundUI();
        gameState.currentRound++;
        gameState.isSpeedRound = false;

        if (gameState.currentRound > gameState.totalRounds) {
            endGame();
            return;
        }

        appContainer.style.backgroundColor = gameState.currentPlayer === 1 ? 'var(--player1-color)' : 'var(--player2-color)';
        console.log(`Hintergrundfarbe gesetzt für Spieler ${gameState.currentPlayer}`);

        diceContainer.classList.remove('hidden');
        diceAnimation.classList.remove('hidden');
        diceSelection.classList.add('hidden');
        digitalDiceArea.classList.add('hidden');
        digitalDiceMainImage.src = digitalDiceStartImage;
        digitalDiceMainImage.classList.remove('no-interaction', 'rolling');
        digitalDiceMainImage.style.cursor = 'pointer';

        lastGameScreenVisible = 'dice-container';

        gameState.diceAnimationTimeout = setTimeout(() => {
            handleDiceAnimationEnd();
        }, 2000);
    }

    digitalDiceMainImage.addEventListener('click', rollDigitalDice);

    diceAnimation.addEventListener('click', handleDiceAnimationEnd);

    function rollDigitalDice() {
        digitalDiceMainImage.classList.add('no-interaction');
        digitalDiceMainImage.classList.add('rolling');
        digitalDiceMainImage.style.cursor = 'default';
        digitalDiceMainImage.src = digitalDiceAnimationGif;

        if (digitalDiceSound) {
            digitalDiceSound.currentTime = 0;
            digitalDiceSound.volume = 0.3;
            digitalDiceSound.play().catch(error => {
                console.warn("Autoplay für digitalen Würfel Sound blockiert oder Fehler:", error);
            });
        }

        setTimeout(() => {
            digitalDiceMainImage.classList.remove('rolling');
            const possibleDiceValues = [1, 2, 3, 4, 5, 7];
            const randomIndex = Math.floor(Math.random() * possibleDiceValues.length);
            const randomDiceValue = possibleDiceValues[randomIndex];
            digitalDiceMainImage.src = digitalDiceImages[randomDiceValue];
            digitalDiceMainImage.classList.remove('no-interaction');
            digitalDiceMainImage.style.cursor = 'pointer';
        }, 1800);
    }

    digitalDiceMainImage.addEventListener('click', rollDigitalDice);

    diceAnimation.addEventListener('click', () => {
        clearTimeout(gameState.diceAnimationTimeout);
        diceAnimation.classList.add('hidden');
        diceSelection.classList.remove('hidden');
    });

    document.querySelectorAll('.dice-option').forEach(dice => {
        dice.addEventListener('click', (e) => {
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

                diceContainer.classList.add('hidden');
                showGenreScreen();
            }, 200);
        });
    });

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
                resolve();
            }, 1800);
        });
    }

    async function showGenreScreen() {
        genreContainer.classList.remove('hidden');
        genreContainer.innerHTML = '';

        const title = document.createElement('h2');
        genreContainer.appendChild(title);

        const playableGenresForDisplay = gameState.selectedPlayableGenres.length > 0 ?
            gameState.selectedPlayableGenres :
            Object.keys(playlists);

        const genreButtons = [];

        playableGenresForDisplay.forEach(genreName => {
            if (playlists[genreName] && playlists[genreName].length > 0) {
                const button = document.createElement('button');
                button.classList.add('genre-button');
                button.dataset.genre = genreName;
                button.innerText = genreName.split(/(?=[A-Z])/).join(' ').replace(/\b\w/g, char => char.toUpperCase());
                button.addEventListener('click', handleGenreSelection, { once: true });
                genreContainer.appendChild(button);
                genreButtons.push(button);
            }
        });

        lastGameScreenVisible = 'genre-container';

        await runGenreAnimation(genreButtons);

        if (gameState.diceValue === 7) {
            genreButtons.forEach(btn => btn.disabled = false);
            const randomIndex = Math.floor(Math.random() * genreButtons.length);
            const disabledButton = genreButtons[randomIndex];
            disabledButton.disabled = true;
            disabledButton.classList.add('disabled-genre');
        } else {
            genreButtons.forEach(btn => btn.disabled = true);
            const randomIndex = Math.floor(Math.random() * genreButtons.length);
            const activeButton = genreButtons[randomIndex];
            activeButton.disabled = false;
            activeButton.classList.remove('disabled-genre');
        }
    }

    async function handleGenreSelection(e) {
        const selectedGenre = e.target.dataset.genre;
        await new Promise(resolve => setTimeout(resolve, 200));
        genreContainer.classList.add('hidden');
        document.querySelectorAll('.genre-button').forEach(btn => btn.removeEventListener('click', handleGenreSelection));

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
        const response = await fetch(API_ENDPOINTS.SPOTIFY_PLAYLIST_TRACKS(randomPlaylistId), {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            console.error("Fehler beim Abrufen der Playlist-Tracks:", response.status, response.statusText, `Playlist ID: ${randomPlaylistId}`);
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
    }

    async function prepareAndShowRateScreen(genre) {
        gameState.currentTrack = await getTrack(genre);
        console.log("Selected Track:", gameState.currentTrack.name);

        logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
        logoButton.removeEventListener('click', playTrackSnippet);
        logoButton.addEventListener('click', playTrackSnippet);

        lastGameScreenVisible = 'reveal-container';
    }

    function playTrackSnippet() {
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

        fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), {
            method: 'PUT',
            body: JSON.stringify({
                uris: [gameState.currentTrack.uri],
                position_ms: randomStartPosition
            }),
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }).then(response => {
            if (!response.ok) {
                console.error("Fehler beim Abspielen des Tracks:", response.status, response.statusText);
                alert("Konnte den Song nicht abspielen. Stellen Sie sicher, dass ein Gerät ausgewählt ist.");
                logoButton.classList.remove('inactive');
                return;
            }
            gameState.isSongPlaying = true;

            if (gameState.isSpeedRound) {
                startVisualSpeedRoundCountdown();
            } else {
                gameState.spotifyPlayTimeout = setTimeout(() => {
                    spotifyPlayer.pause();
                    gameState.isSongPlaying = false;
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

        if (gameState.attemptsMade === 1 && !gameState.isSpeedRound) {
            revealButton.classList.remove('hidden');
            revealButton.classList.remove('no-interaction');
        }
    }

    function showResolution() {
        clearTimeout(gameState.speedRoundTimeout);
        clearInterval(gameState.countdownInterval);
        clearTimeout(gameState.spotifyPlayTimeout);
        clearInterval(gameState.fadeInterval);

        if (gameState.isSongPlaying && spotifyPlayer) {
            spotifyPlayer.pause();
            gameState.isSongPlaying = false;
        }

        countdownDisplay.classList.add('hidden');
        countdownDisplay.classList.remove('countdown-animated');
        countdownDisplay.innerText = '';

        logoButton.classList.add('inactive', 'hidden');
        revealButton.classList.add('hidden');
        speedRoundTextDisplay.classList.add('hidden');

        document.getElementById('album-cover').src = gameState.currentTrack.album.images[0].url;
        document.getElementById('track-title').innerText = gameState.currentTrack.name;
        document.getElementById('track-artist').innerText = gameState.currentTrack.artists.map(a => a.name).join(', ');
        trackAlbum.innerText = gameState.currentTrack.album.name;
        trackYear.innerText = `(${gameState.currentTrack.album.release_date.substring(0, 4)})`;

        revealContainer.classList.remove('hidden');
        lastGameScreenVisible = 'reveal-container';

        playSongForResolution();
    }

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

        spotifyPlayer.setVolume(0).then(() => {
            gameState.currentSongVolume = 0;
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
                gameState.isSongPlaying = true;
                gameState.fadeInterval = setInterval(() => {
                    if (gameState.currentSongVolume < targetVolume) {
                        gameState.currentSongVolume = Math.min(gameState.currentSongVolume + fadeStep, targetVolume);
                        spotifyPlayer.setVolume(gameState.currentSongVolume / 100);
                    } else {
                        clearInterval(gameState.fadeInterval);
                    }
                }, intervalTime);
            }).catch(error => {
                console.error("Netzwerkfehler beim Starten des Songs für Auflösung:", error);
            });
        }).catch(error => {
            console.error("Fehler beim Setzen der Initiallautstärke auf 0:", error);
        });
    }

    function fadeAudioOut() {
        return new Promise(resolve => {
            if (!spotifyPlayer || !gameState.isSongPlaying) {
                resolve();
                return;
            }
            clearInterval(gameState.fadeInterval);
            const fadeDuration = 500;
            const fadeStep = 5;
            const currentVolumePercent = gameState.currentSongVolume;
            const intervalTime = fadeDuration / (currentVolumePercent / fadeStep);

            gameState.fadeInterval = setInterval(() => {
                if (gameState.currentSongVolume > 0) {
                    gameState.currentSongVolume = Math.max(0, gameState.currentSongVolume - fadeStep);
                    spotifyPlayer.setVolume(gameState.currentSongVolume / 100);
                } else {
                    clearInterval(gameState.fadeInterval);
                    gameState.fadeInterval = null;
                    resolve();
                }
            }, intervalTime);
        });
    }

    revealButton.addEventListener('click', async () => {
        revealButton.classList.add('no-interaction');
        await new Promise(resolve => setTimeout(resolve, 200));
        await fadeAudioOut();

        if (gameState.isSongPlaying && spotifyPlayer) {
            spotifyPlayer.pause();
            gameState.isSongPlaying = false;
        }
        showResolution();
    });

    function handleFeedback(isCorrect) {
        correctButton.classList.add('no-interaction');
        wrongButton.classList.add('no-interaction');

        fadeAudioOut().then(() => {
            if (gameState.isSongPlaying && spotifyPlayer) {
                spotifyPlayer.pause();
                gameState.isSongPlaying = false;
            }
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

    // NEU: Funktion zur Anzeige der animierten Punkte - FÜR HOCHFORMAT (OBEN/UNTEN)
    function displayPointsAnimation(points, player) {
        return new Promise(resolve => {
            const isPlayer1 = player === 1;
            const scoreDisplayId = isPlayer1 ? 'player1-score-display' : 'player2-score-display';
            const scoreDisplayElement = document.getElementById(scoreDisplayId);
            
            // Setze die Hintergrundfarbe des appContainers, um die Punkt-Animation sichtbar zu machen
            appContainer.style.backgroundColor = 'transparent';
    
            // 1. Alle vorherigen Animationsklassen entfernen und Element für den Start vorbereiten
            countdownDisplay.classList.remove(
                'hidden',
                'countdown-animated',
                'fly-up-player1', // NEU: Klasse für Spieler 1 nach oben
                'fly-down-player2', // NEU: Klasse für Spieler 2 nach unten
                'points-pop-in'
            );
            countdownDisplay.innerText = `+${points}`;
            countdownDisplay.style.opacity = '0';
            countdownDisplay.style.transform = 'translate(-50%, -50%) scale(0.8)';
            countdownDisplay.style.top = '50%';
            countdownDisplay.style.left = '50%';
            
            // Setze die Farbe basierend auf der Spielerhälfte
            if (isPlayer1) {
                countdownDisplay.style.color = 'var(--punktefarbe-player1)'; // Blau
            } else {
                countdownDisplay.style.color = 'var(--punktefarbe-player2)'; // Pink
            }
    
            // Reflow erzwingen
            void countdownDisplay.offsetWidth;
    
            // 2. Phase 1: Punkte sanft einblenden (Pop-in)
            countdownDisplay.classList.add('points-pop-in');
            const popInDuration = 300;
            const flyAnimationDuration = 500;
    
            // 3. Phase 2: Nach dem Einblenden die "Wegfliegen"-Animation starten
            setTimeout(() => {
                countdownDisplay.classList.remove('points-pop-in');
                if (isPlayer1) {
                    countdownDisplay.classList.add('fly-up-player1'); // Animiert nach oben
                } else {
                    countdownDisplay.classList.add('fly-down-player2'); // Animiert nach unten
                }
            }, popInDuration);
    
            // 4. Nach der Animation das Element verstecken und Promise auflösen
            setTimeout(() => {
                countdownDisplay.classList.add('hidden');
                countdownDisplay.classList.remove('fly-up-player1', 'fly-down-player2');
                countdownDisplay.innerText = '';
                countdownDisplay.style.color = '';
                countdownDisplay.style.left = '';
                countdownDisplay.style.top = '';
                countdownDisplay.style.opacity = '1';
                countdownDisplay.style.transform = '';

                // Aktualisiere die Score-Anzeige nach der Animation
                scoreDisplayElement.innerText = gameState[isPlayer1 ? 'player1Score' : 'player2Score'];
                scoreDisplayElement.style.opacity = '1';

                resolve();
            }, popInDuration + flyAnimationDuration);
        });
    }

    document.getElementById('correct-button').addEventListener('click', () => handleFeedback(true));
    document.getElementById('wrong-button').addEventListener('click', () => handleFeedback(false));

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

        if (gameState.isSongPlaying && spotifyPlayer) {
            spotifyPlayer.pause();
            gameState.isSongPlaying = false;
        }

        if (spotifyPlayer) {
            spotifyPlayer.setVolume(1.0)
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

    gameScreen.classList.remove(HIDDEN_CLASS);
    logoButton.classList.remove(HIDDEN_CLASS);
    logoButton.classList.add(INITIAL_FLY_IN_CLASS); // Starte mit der Animation

     // Stelle sicher, dass der Logo-Button sichtbar ist und die Animation startet
    logoButton.classList.remove(HIDDEN_CLASS, INACTIVE_CLASS);
    logoButton.classList.add(INITIAL_FLY_IN_CLASS);

    lastGameScreenVisible = '';

    startGenreSelectionContainer.classList.add(HIDDEN_CLASS);
    startGenreSelectionContainer.classList.remove(FADE_IN_CLASS); // Stelle sicher, dass der Fade-In-Zustand zurückgesetzt wird

    // Füge den Klick-Listener für einen neuen Durchgang hinzu
    logoButton.addEventListener('click', handleLogoClick, { once: true });
    
    renderPreselectionGenres();
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
