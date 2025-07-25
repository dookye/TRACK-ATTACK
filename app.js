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
    // const fullscreenScreen = document.getElementById('fullscreen-screen'); // ENTFERNT
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

    // Konstanten für die neuen Digitalen Würfel-Elemente
    const digitalDiceArea = document.getElementById('digital-dice-area');
    const digitalDiceButton = document.getElementById('digital-dice-button');
    const digitalDiceResult = document.getElementById('digital-dice-result');

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

     // Map für die Bildpfade der digitalen Würfel-Ergebnisse
    const digitalDiceImages = {
        1: 'assets/digi-1.png',
        2: 'assets/digi-2.png',
        3: 'assets/digi-3.png',
        4: 'assets/digi-4.png',
        5: 'assets/digi-5.png',
        7: 'assets/digi-tg.png' // Für den "Teamgeist" / 7er-Würfel
};
    
    // --- Spielstatus-Variablen ---
    // let player;
    let spotifyPlayer;
    let deviceId;
    let accessToken;
    let gameState = {
        player1Score: 0,
        player2Score: 0,
        currentPlayer: 1,
        totalRounds: 4, // wert auf 20 setzen, wenn jeder spieler 10 runden spielt
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
        pop: ['6mtYuOxzl58vSGnEDtZ9uB', '34NbomaTu7YuOYnky8nLXL'],
        alltime: ['2si7ChS6Y0hPBt4FsobXpg', '2y09fNnXHvoqc1WGHvbhkZ'],
        deutsch: ['7h64UGKHGWM5ucefn99frR', '4ytdW13RHl5u9dbRWAgxSZ'],
        party: ['53r5W67KJNIeHWAhVOWPDr'],
        skate: ['7qGvinYjBfVpl1FJFkzGqV'],
        dpunk: ['3sQLh9hYyJQZ0qWrtJG1OO', '4iR7Xq1wP9GRbGLm2qFBYw'],
        onehit: ['1t1iRfYh9is6FH6hvn58lt', '77IXl4Gh7AZLyVLx66NkqV']
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
        // document.location = `https://accounts.spotify.com/authorize?$$${params.toString()}`; // ALTE ZEILE
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

        // const result = await fetch("https://accounts.spotify.com/api/token", { // ALTE ZEILE
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
            // fullscreenScreen.classList.remove('hidden'); // ENTFERNT (wie von dir vermerkt)
            initializePlayer(); // Spotify-Player initialisieren

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
        });

    } else {
        // Standard-Ansicht (noch nicht von Spotify zurückgekommen)
        loginScreen.classList.remove('hidden');
        document.getElementById('login-button').addEventListener('click', redirectToAuthCodeFlow);
        // Sicherstellen, dass Overlay beim Start nicht sichtbar ist (falls du ein rotateDeviceOverlay hast)
        // rotateDeviceOverlay.classList.add('hidden'); // Nur wenn dieses Element existiert und versteckt werden soll
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

    // NEU: Event Listener für das Verlassen des Vollbildmodus (nicht mehr nötig, da Fullscreen-Screen entfernt)
    // document.addEventListener('fullscreenchange', () => {
    //     if (!document.fullscreenElement) {
    //         // Vollbildmodus wurde verlassen
    //         // Speichere den Zustand, BEVOR alles versteckt wird
    //         if (!logoButton.classList.contains('hidden')) {
    //             lastGameScreenVisible = 'logo-button';
    //         } else if (!diceContainer.classList.contains('hidden')) {
    //             lastGameScreenVisible = 'dice-container';
    //         } else if (!genreContainer.classList.contains('hidden')) {
    //             lastGameScreenVisible = 'genre-container';
    //         } else if (!revealContainer.classList.contains('hidden')) {
    //             lastGameScreenVisible = 'reveal-container';
    //         } else {
    //             lastGameScreenVisible = ''; // Wenn nichts Spezielles sichtbar war
    //         }


    //         // Alle Spiel-Elemente verstecken
    //         gameScreen.classList.add('hidden');
    //         revealContainer.classList.add('hidden');
    //         diceContainer.classList.add('hidden');
    //         genreContainer.classList.add('hidden');
    //         logoButton.classList.add('hidden');
    //         speedRoundTextDisplay.classList.add('hidden');
    //         revealButton.classList.add('hidden'); // AUFLÖSEN Button auch verstecken

    //         // Spotify-Player pausieren
    //         if (spotifyPlayer) {
    //             spotifyPlayer.pause();
    //         }
    //         clearTimeout(gameState.speedRoundTimeout); // Speed-Round-Timer stoppen
    //         clearTimeout(gameState.diceAnimationTimeout); // NEU: Würfel-Animation stoppen

    //         // Den Vollbild-Screen wieder anzeigen
    //         // fullscreenScreen.classList.remove('hidden'); // ENTFERNT
    //     }
    // });

    
    // 1.4: Vollbild-Modus aktivieren (Dieser Abschnitt wurde entfernt, da der Fullscreen-Screen entfernt wurde)
    // fullscreenScreen.addEventListener('click', () => {
    //     document.documentElement.requestFullscreen().then(() => {
    //         fullscreenScreen.classList.add('hidden');
    //         gameScreen.classList.remove('hidden');
    //         // NEU: Stelle den letzten Zustand wieder her, oder starte neu
    //         if (lastGameScreenVisible === 'dice-container') {
    //             showDiceScreen();
    //         } else if (lastGameScreenVisible === 'genre-container') {
    //             showGenreScreen();
    //         } else if (lastGameScreenVisible === 'reveal-container') {
    //             showResolution(); // Zeigt nur die Auflösung, nicht das Abspielen
    //             // Hier müsste man überlegen, ob der Track weiterlaufen soll
    //             // oder ob man ihn pausiert hat und jetzt fortsetzen will.
    //             // Fürs Erste zeige ich nur die Auflösung.
    //         } else {
    //             // Wenn kein spezieller Zustand gespeichert ist, starte neu mit dem Logo
    //             logoButton.classList.remove('hidden');
    //             logoButton.classList.add('initial-fly-in');
    //             logoButton.addEventListener('click', startGame, { once: true });
    //         }
    //     });
    // });

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

        // NEU: Setze die Hintergrundfarbe basierend auf dem aktuellen Spieler.
        // Dies geschieht JEDES MAL, wenn der Würfel-Screen angezeigt wird.
        appContainer.style.backgroundColor = gameState.currentPlayer === 1 ? 'var(--player1-color)' : 'var(--player2-color)';
        console.log(`Hintergrundfarbe gesetzt für Spieler ${gameState.currentPlayer}`); // Optional zur Überprüfung

        diceContainer.classList.remove('hidden');
        diceAnimation.classList.remove('hidden');
        diceSelection.classList.add('hidden');

        // Speichere den Zustand: Würfel-Bildschirm
        lastGameScreenVisible = 'dice-container';
        
        // Setze den Timeout für die Würfel-Animation
        gameState.diceAnimationTimeout = setTimeout(() => {
            diceAnimation.classList.add('hidden');
            diceSelection.classList.remove('hidden');
        }, 2000);
    }

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
    
    async function showGenreScreen() {
    genreContainer.classList.remove('hidden');
    const buttons = document.querySelectorAll('.genre-button');
    
    buttons.forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('random-blink');
    });

    // Speichere den Zustand: Genre-Bildschirm
    lastGameScreenVisible = 'genre-container';

    // Führe die gleiche Blink-Animation für beide Fälle aus
    await runGenreAnimation(buttons);

    // Die Logik für die Button-Aktivierung/-Deaktivierung kommt jetzt NACH der Animation
    if (gameState.diceValue === 7) { // Fall B: WÜRFEL 7
        
        // 1. Alle Buttons sind klickbar (standardmäßig)
        buttons.forEach(btn => btn.disabled = false);

        // 2. Wähle ein zufälliges Genre aus, das inaktiv sein soll
        const randomIndex = Math.floor(Math.random() * buttons.length);
        const disabledButton = buttons[randomIndex];
        
        // 3. Deaktiviere das ausgewählte Genre
        disabledButton.disabled = true;
        // Optional: Füge eine visuelle Klasse hinzu, um es zu markieren
        disabledButton.classList.add('disabled-genre');
        
        // Füge Event-Listener für alle Buttons hinzu
        buttons.forEach(btn => {
            btn.addEventListener('click', handleGenreSelection, { once: true });
        });

    } else { // Fall A: WÜRFEL 1-5
        
        // 1. Erst alle Buttons deaktivieren
        buttons.forEach(btn => btn.disabled = true);
        
        // 2. Dann ein zufälliges Genre auswählen und aktivieren
        const randomIndex = Math.floor(Math.random() * buttons.length);
        const activeButton = buttons[randomIndex];

        activeButton.disabled = false;
        // Optional: Entferne eine mögliche visuelle Klasse
        activeButton.classList.remove('disabled-genre');

        // Füge den Event-Listener nur für den aktiven Button hinzu
        activeButton.addEventListener('click', handleGenreSelection, { once: true });
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
    
    async function getTrack(genre) {
        const playlistPool = playlists[genre];
        if (!playlistPool || playlistPool.length === 0) {
            console.error(`Keine Playlists für Genre "${genre}" definiert oder Pool ist leer.`);
            alert(`Fehler: Für das Genre "${genre}" sind keine Playlists verfügbar.`);
            showGenreScreen();
            return null;
        }

        const randomPlaylistId = playlistPool[Math.floor(Math.random() * playlistPool.length)];
        // NEU: Loggen der ausgewählten Playlist-ID
        console.log(`DEBUG: Ausgewähltes Genre: "${genre}", Playlist-ID: "${randomPlaylistId}"`);

        // const response = await fetch(`https://api.spotify.com/v1/playlists/$$${randomPlaylistId}/tracks`, { // ALTE ZEILE
        const response = await fetch(API_ENDPOINTS.SPOTIFY_PLAYLIST_TRACKS(randomPlaylistId), { // NEUE ZEILE
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

        // Filterung, wie zuvor besprochen (optional: .explicit === false hinzufügen)
        const playableTracks = data.items.filter(item => item.track);  
        // Für explizite Inhalte: const playableTracks = data.items.filter(item => item.track && item.track.explicit === false);


        if (playableTracks.length === 0) {
            console.warn(`Die Playlist ${randomPlaylistId} enthält keine abspielbaren oder gültigen Tracks nach Filterung.`);
            alert(`Keine gültigen Songs in der Playlist gefunden. Bitte versuchen Sie ein anderes Genre.`);
            showGenreScreen();
            return null;
        }

        const randomTrack = playableTracks[Math.floor(Math.random() * playableTracks.length)].track;

        // NEU: Loggen des ausgewählten Songs, bevor er zurückgegeben wird
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
        console.log("Selected Track:", gameState.currentTrack.name); // Zum Debuggen

        logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
        logoButton.removeEventListener('click', playTrackSnippet);
        logoButton.addEventListener('click', playTrackSnippet);

        // Speichere den Zustand: Raten-Bildschirm
        lastGameScreenVisible = 'reveal-container'; // Obwohl es der Rate-Bildschirm ist, steht reveal-container für die Auflösung
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

        // fetch(`https://api.spotify.com/v1/me/player/play?device_id=$$${deviceId}`, { // ALTE ZEILE
        fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), { // NEUE ZEILE
            method: 'PUT',
            body: JSON.stringify({
                uris: [gameState.currentTrack.uri],
                position_ms: randomStartPosition
            }),
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }).then(response => {
            if (!response.ok) { // Fehlerbehandlung für Play-Request
                console.error("Fehler beim Abspielen des Tracks:", response.status, response.statusText);
                alert("Konnte den Song nicht abspielen. Stellen Sie sicher, dass ein Gerät ausgewählt ist.");
                logoButton.classList.remove('inactive'); // Button wieder aktiv machen
                return;
            }
            gameState.isSongPlaying = true; // Song spielt

            if (gameState.isSpeedRound) {
                startVisualSpeedRoundCountdown(); // Startet den 10s Countdown
                // Der Song wird nur einmal gespielt. Nach 10s wird aufgelöst.
                // spotifyPlayer.pause() wird im countdown-timer gemacht oder durch showResolution
            } else {
                // Normaler Modus: Song pausiert nach trackDuration
                gameState.spotifyPlayTimeout = setTimeout(() => {
                    spotifyPlayer.pause();
                    gameState.isSongPlaying = false;
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
        if (gameState.attemptsMade === 1 && !gameState.isSpeedRound) {
            revealButton.classList.remove('hidden');

            // --------------------------------------- wenn verzögerung nicht klappt, nächste zeile wieder löschen --------------------------------------
            revealButton.classList.remove('no-interaction');
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
        trackAlbum.innerText = gameState.currentTrack.album.name; // NEU
        trackYear.innerText = `(${gameState.currentTrack.album.release_date.substring(0, 4)})`; // NEU: Nur das Jahr
        
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
    spotifyPlayer.setVolume(0).then(() => {
        gameState.currentSongVolume = 0; // Setze interne Volume auf 0

        // Song bei Sekunde 30 starten
        // fetch(`https://api.spotify.com/v1/me/player/play?device_id=$$${deviceId}`, { // ALTE ZEILE
        fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), { // NEUE ZEILE
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
                }
            }, intervalTime); // Intervall für den Fade-In

            // Optional: Timer, um den Song am Ende zu pausieren, falls nicht geklickt wird
            // Dies ist nicht unbedingt nötig, da Spotify den Track automatisch beendet.
            // Wenn der Track sehr lang ist und du ihn explizit pausieren willst:
            // const remainingTime = gameState.currentTrack.duration_ms - startPositionMs;
            // gameState.spotifyPlayTimeout = setTimeout(() => {
            //     if (gameState.isSongPlaying && spotifyPlayer) {
            //         spotifyPlayer.pause();
            //         gameState.isSongPlaying = false;
            //     }
            // }, remainingTime + 1000); // Kleine Pufferzeit
        }).catch(error => {
            console.error("Netzwerkfehler beim Starten des Songs für Auflösung:", error);
        });
    }).catch(error => {
        console.error("Fehler beim Setzen der Initiallautstärke auf 0:", error);
    });
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

    // alt einfach diese Zeile hier: revealButton.addEventListener('click', showResolution);
    
    // ------------------------mit verzögerung zur Auflösung:.............................................
    revealButton.addEventListener('click', async () => {  
    // Blende den Button sofort aus, um Doppelklicks zu vermeiden
    revealButton.classList.add('no-interaction');  

    // NEU: Verzögerung HIER einfügen, direkt nach dem Klick und dem Ausblenden des Buttons.
    // Das gibt dem Browser Zeit, die Pulldown-Animation zu rendern,
    // bevor der Rest des Skripts (und damit der Screen-Wechsel) abläuft.
    await new Promise(resolve => setTimeout(resolve, 200)); // Kurze Verzögerung für die Button-Animation

    // Song ausblenden (falls noch nicht geschehen)
    await fadeAudioOut();  
    
    // Song pausieren
    if (gameState.isSongPlaying && spotifyPlayer) {
        spotifyPlayer.pause();
        gameState.isSongPlaying = false;
    }

    // Zeige die Auflösung an (Titel, Album, etc.)
    showResolution();  
});
    // ---------------------------verzögerung ende----------------------------------------------------

// ... (bestehender Code vor handleFeedback) ...

function handleFeedback(isCorrect) {
    correctButton.classList.add('no-interaction');
    wrongButton.classList.add('no-interaction');
    
    // NEU: Starte den Fade-Out, bevor der Rest der Logik ausgeführt wird
    fadeAudioOut().then(() => {
        // Dieser Code wird ausgeführt, NACHDEM der Fade-Out beendet ist
        if (gameState.isSongPlaying && spotifyPlayer) {
            spotifyPlayer.pause();
            gameState.isSongPlaying = false;
        }

        let pointsAwarded = 0; // NEU: Variable für die vergebenen Punkte

        if (isCorrect) {
            // 5.1: Punkte berechnen und speichern
            pointsAwarded = Math.max(1, gameState.diceValue - (gameState.attemptsMade - 1)); // Punkte berechnen
            if (gameState.currentPlayer === 1) {
                gameState.player1Score += pointsAwarded;
            } else {
                gameState.player2Score += pointsAwarded;
            }
        }

        // NEU: Animation der vergebenen Punkte anzeigen
        displayPointsAnimation(pointsAwarded, gameState.currentPlayer)
            .then(() => { // <--- HIER beginnt der .then()-Block für displayPointsAnimation
                // 4.4: Spieler wechseln
                gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
                appContainer.style.backgroundColor = gameState.currentPlayer === 1 ? 'var(--player1-color)' : 'var(--player2-color)';

                // Setze den Zustand zurück, bevor die nächste Runde beginnt
                lastGameScreenVisible = '';
                setTimeout(showDiceScreen, 500); // Kurze Pause vor der nächsten Runde
            }); // <--- HIER endet der .then()-Block für displayPointsAnimation
    }); // <--- HIER endet der .then()-Block für fadeAudioOut
}

// NEU: Funktion zur Anzeige der animierten Punkte
function displayPointsAnimation(points, player) {
    return new Promise(resolve => {
        // 1. Alle vorherigen Animationsklassen entfernen und Element für den Start vorbereiten
        countdownDisplay.classList.remove('hidden', 'countdown-animated', 'fly-to-corner-player1', 'fly-to-corner-player2', 'points-pop-in'); // 'points-pop-in' auch entfernen
        countdownDisplay.innerText = `+${points}`;

        // 2. Start-Stile für die Punkteanzeige setzen (für die 'pop-in' Animation)
        countdownDisplay.style.opacity = '0'; // Startet transparent
        countdownDisplay.style.transform = 'translate(-50%, -50%) scale(0.8)'; // Startet kleiner
        countdownDisplay.style.top = '50%'; // Vertikale Mitte

        if (player === 1) {
            countdownDisplay.style.color = 'var(--punktefarbe-player1)';
            countdownDisplay.style.left = '50%'; // 25% für Linke Hälfte für Spieler 1
        } else {
            countdownDisplay.style.color = 'var(--punktefarbe-player2)';
            countdownDisplay.style.left = '50%'; // 75% für Rechte Hälfte für Spieler 2
        }

        // Reflow erzwingen, damit die Start-Stile angewendet werden, bevor die Animation beginnt
        void countdownDisplay.offsetWidth;

        // 3. Phase 1: Punkte sanft einblenden (Pop-in)
        countdownDisplay.classList.add('points-pop-in'); // Neue Klasse für den sanften Pop-in-Effekt

        const popInDuration = 1000; // Dauer des Einblendens (0.3 Sekunden, passt zur CSS)
        const flyAnimationDuration = 400; // Dauer der "Wegfliegen"-Animation (0.5 Sekunden, passt zur CSS)

        // 4. Phase 2: Nach dem Einblenden die "Wegfliegen"-Animation starten
        setTimeout(() => {
            countdownDisplay.classList.remove('points-pop-in'); // Pop-in-Klasse entfernen
            if (player === 1) {
                countdownDisplay.classList.add('fly-to-corner-player1');
            } else {
                countdownDisplay.classList.add('fly-to-corner-player2');
            }
        }, popInDuration); // Startet nach dem Einblenden

        // 5. Nach der gesamten Animationsdauer das Element verstecken und Promise auflösen
        setTimeout(() => {
            countdownDisplay.classList.add('hidden');
            // Animationsklassen entfernen, damit sie beim nächsten Mal sauber starten
            countdownDisplay.classList.remove('fly-to-corner-player1', 'fly-to-corner-player2');
            countdownDisplay.innerText = ''; // Text leeren

            // Stile auf den Standardwert zurücksetzen, falls countdownDisplay auch für den Countdown genutzt wird
            countdownDisplay.style.color = 'var(--white)';
            countdownDisplay.style.left = '50%';
            countdownDisplay.style.top = '50%';
            countdownDisplay.style.opacity = '1'; // Opacity zurücksetzen
            countdownDisplay.style.transform = 'translate(-50%, -50%) scale(1)'; // Transform zurücksetzen
            resolve(); // Promise auflösen, damit der nächste Schritt in handleFeedback ausgeführt werden kann
        }, popInDuration + flyAnimationDuration); // Gesamtdauer: Einblenden + Fliegen
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
        correctButton.classList.remove('no-interaction');
        wrongButton.classList.remove('no-interaction');          
        
        // Entfernen Sie den Listener, um mehrfaches Hinzufügen zu vermeiden,
        // wenn der Logo-Button wieder verwendet wird.
        logoButton.removeEventListener('click', playTrackSnippet);

        //NEU:
        // Sicherstellen, dass alle Timer und Intervalle der vorherigen Runde gestoppt sind
    clearTimeout(gameState.speedRoundTimeout);
    clearInterval(gameState.countdownInterval);
    clearTimeout(gameState.spotifyPlayTimeout);
    clearInterval(gameState.fadeInterval);
    clearTimeout(gameState.diceAnimationTimeout); // NEU: Würfel-Animations-Timeout auch hier stoppen

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
        logoButton.removeEventListener('click', startGame); // Sicherstellen, dass kein alter Listener hängt
        logoButton.addEventListener('click', startGame, { once: true });

        // Setze den letzten sichtbaren Screen zurück, da das Spiel neu startet
        lastGameScreenVisible = '';
    }

    //=======================================================================
    // Phase 6: Sonderfunktion "Speed-Round"
    //=======================================================================

    function showSpeedRoundAnimation() {
    return new Promise(resolve => {
        speedRoundTextDisplay.classList.remove('hidden'); // Jetzt das neue Element
        setTimeout(() => {
            speedRoundTextDisplay.classList.add('hidden'); // Und hier
            resolve();
        }, 3500);
    });
}

      // NEU / ÜBERARBEITET: startVisualSpeedRoundCountdown
    function startVisualSpeedRoundCountdown() {
        let timeLeft = 7; // Startwert des Countdowns
        countdownDisplay.classList.remove('hidden'); // Countdown-Anzeige einblenden

        // Timer für die automatische Auflösung nach 10 Sekunden
        gameState.speedRoundTimeout = setTimeout(() => {
            showResolution(); // Auflösung nach 10 Sekunden
        }, 7000);

        // Sofort die erste Zahl anzeigen und animieren
        countdownDisplay.innerText = timeLeft;
        countdownDisplay.classList.remove('countdown-animated');
        void countdownDisplay.offsetWidth; // Reflow
        countdownDisplay.classList.add('countdown-animated');

        // Interval für den visuellen Countdown jede Sekunde
        gameState.countdownInterval = setInterval(() => {
            timeLeft--; // Zahl verringern

            if (timeLeft >= 0) { // Solange die Zahl 0 oder größer ist
                countdownDisplay.innerText = timeLeft; // Zahl aktualisieren
                countdownDisplay.classList.remove('countdown-animated'); // Animation entfernen
                void countdownDisplay.offsetWidth; // Reflow erzwingen
                countdownDisplay.classList.add('countdown-animated'); // Animation hinzufügen
            }

            if (timeLeft < 0) { // Wenn Countdown abgelaufen ist (nach 0)
                clearInterval(gameState.countdownInterval); // Interval stoppen
                countdownDisplay.classList.add('hidden'); // Countdown ausblenden
                countdownDisplay.innerText = ''; // Inhalt leeren
                // showResolution wird bereits durch speedRoundTimeout ausgelöst
            }
        }, 1000); // Jede Sekunde aktualisieren
    }

}); // Ende DOMContentLoaded
