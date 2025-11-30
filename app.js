// TRACK ATTACK


// --- API Endpunkte --- NEU HINZUGEFÜGT
const API_ENDPOINTS = {
    SPOTIFY_AUTH: 'https://accounts.spotify.com/authorize',
    SPOTIFY_TOKEN: 'https://accounts.spotify.com/api/token',
    SPOTIFY_PLAYLIST_TRACKS: (playlistId) => `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    SPOTIFY_PLAYER_PLAY: (deviceId) => `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
	SPOTIFY_PLAYER_TRANSFER: 'https://api.spotify.com/v1/me/player',
	SPOTIFY_PLAYER_STATE: 'https://api.spotify.com/v1/me/player'
};


// ----------------------------------------------------------------------
// GLOBALE VARIABLE FÜR ANIMATIONS-STEUERUNG
// ----------------------------------------------------------------------
let isInitialFlyInDone = false; 

// ----------------------------------------------------------------------
// FUNKTION: Wird aufgerufen, sobald die Fly-in Animation abgeschlossen ist
// ----------------------------------------------------------------------
function handleFlyInEnd() {
    const logoButton = document.getElementById('logo-button');
    if (isInitialFlyInDone) return; 

    // 1. Die Fly-in Klasse entfernen, damit sie nie wieder startet
    logoButton.classList.remove('initial-fly-in');
    isInitialFlyInDone = true;

    // 2. Button aktivieren und Pulsing starten
    logoButton.classList.remove('inactive'); 
    logoButton.classList.add('logo-pulsing');

    // 3. Den Event Listener für das Animationsende entfernen
    logoButton.removeEventListener('animationend', handleFlyInEnd);
    
    // WICHTIG: Der Klick-Listener wird zentral in startGameAfterOrientation verwaltet!
}


document.addEventListener('DOMContentLoaded', () => {

    // --- DOM-Elemente ---
    const appContainer = document.getElementById('app-container');
    const loginScreen = document.getElementById('login-screen');
    const gameScreen = document.getElementById('game-screen');
    const rotateDeviceOverlay = document.getElementById('rotate-device-overlay');
    // logoButton ist im Scope definiert
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
	const gameFooter = document.getElementById('game-footer');


    // NEU: Konstante für das EINE digitale Würfelbild
    const digitalDiceArea = document.getElementById('digital-dice-area');
    const digitalDiceMainImage = document.getElementById('digital-dice-main-image');

    // NEU: DOM-Elemente für die Start-Genre-Auswahl
    const startGenreSelectionContainer = document.getElementById('start-genre-selection-container');
    const allGenresScrollbox = document.getElementById('all-genres-scrollbox');


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
    // 'poll_delay' ist die Wartezeit auf die Spotify Event-Meldung, bevor wir POLLEN.
    1: { attempts: 1, duration: 7350, poll_delay: 1500 }, 
    2: { attempts: 2, duration: 7350, poll_delay: 1500 }, 
    3: { attempts: 3, duration: 7350, poll_delay: 1500 }, 
    4: { attempts: 4, duration: 7350, poll_delay: 1500 }, 
    5: { attempts: 5, duration: 7350, poll_delay: 1500 }, 
    7: { attempts: 7, duration: 2350, poll_delay: 1500 } 
};

    // --- Spielstatus-Variablen ---
    let playbackStateListener = null; // Eine globale Variable, die den Verweis auf den Status-Änderungs-Listener enthält
	let pollingIntervalTimer = null;
	let fallbackPlayTimer = null;
    let accessToken = null;
    let deviceId = null;
    let spotifyPlayer = null;
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
        // --- ÄNDERUNG: Neue Variable für das Netzwerk-Intervall ---
        networkCheckInterval: null, 
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
		'test': ['4EA0uV0i0c7RJNxWZpwcmM'],
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

    // 1.4: Querformat-Prüfung
    function checkOrientation() {
        // Führe die Start-Logik nur aus, wenn der Token da ist und der GameScreen noch versteckt ist
        if (accessToken && gameScreen.classList.contains('hidden') && loginScreen.classList.contains('hidden')) {
            startGameAfterOrientation();
        }
    }
    
    // --- ÄNDERUNG: Funktion startet nun das Netzwerk-Intervall ---
    function startGameAfterOrientation() {
        
        // 1. Initialer Netzwerk-Check (ohne Blockierung)
        checkConnectionSpeed();

        // 2. Intervall starten: Alle 60 Sekunden (60000ms) prüfen
        if (!gameState.networkCheckInterval) {
            gameState.networkCheckInterval = setInterval(checkConnectionSpeed, 60000);
        }
        
        // HINWEIS: Spielstart wird NICHT blockiert, Spiel läuft weiter
     
        gameScreen.classList.remove('hidden');

        // NEU: Sound für das einfliegende Logo abspielen
        if (logoFlyInSound) {
            logoFlyInSound.currentTime = 0; // Setzt den Sound auf den Anfang zurück
            logoFlyInSound.volume = 0.3;
            logoFlyInSound.play().catch(error => {
                console.warn("Autoplay für Logo-Sound blockiert oder Fehler:", error);
            });
        }
        
        // WICHTIG: Den Click-Listener hinzufügen, BEVOR die Fly-in Logik startet!
        // Der Listener wird beim Klick dank {once: true} wieder entfernt.
        logoButton.removeEventListener('click', startGame); // Entferne Duplikate
        logoButton.addEventListener('click', startGame, { once: true });


        if (!isInitialFlyInDone) {
            // Beim ersten Start: Fly-in Animation auslösen
            logoButton.classList.remove('hidden');
            logoButton.classList.add('inactive'); // Inaktiv halten, bis Fly-in vorbei ist
            
            // Listener hinzufügen, der auf das Ende der Fly-in-Animation wartet
            logoButton.removeEventListener('animationend', handleFlyInEnd); // Entferne Duplikate
            logoButton.addEventListener('animationend', handleFlyInEnd);
            
            // Startet die Fly-in Animation
            logoButton.classList.add('initial-fly-in');

        } else {
            // Wenn die Animation bereits gelaufen ist:
            
            // Standard: Nur Pulsing starten (ready for next round/click)
            logoButton.classList.remove('hidden');
            logoButton.classList.remove('inactive');
            logoButton.classList.add('logo-pulsing');
            
            // NEU: Stelle den letzten Zustand wieder her, oder starte neu
            if (lastGameScreenVisible === 'dice-container') {
                // showDiceScreen(); 
            } else if (lastGameScreenVisible === 'genre-container') {
                // showGenreScreen(); 
            } else if (lastGameScreenVisible === 'reveal-container') {
                // showResolution(); 
            }
        }

        // NEU: Zeige die Genre-Vorauswahl an und rendere die Buttons
        startGenreSelectionContainer.classList.remove('hidden');
        // Genres nur beim ersten Start oder nach einem Reset neu rendern
        if (allGenresScrollbox.children.length === 0) { // Vermeidet redundantes Rendern
            renderPreselectionGenres();
        }
    }

    function startTokenTimer() {

		gameFooter.classList.remove('hidden');
		
        const totalDuration = 60 * 60; // 60 Minuten in Sekunden
        let timeLeft = totalDuration;

        tokenTimer.classList.remove('hidden');

        // Countdown-Anzeige initialisieren
        function updateTimerDisplay() {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            tokenTimer.innerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }

        updateTimerDisplay(); // Initialen Wert setzen

        const timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();

            // Timer stoppen, wenn 0 erreicht ist
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
            startTokenTimer(); // start des timer für Access Token 60min zur visualisierung
            
           
            setTimeout(() => {
                // Diese beiden Zeilen werden erst nach der Verzögerung ausgeführt
                window.addEventListener('resize', checkOrientation);
                checkOrientation(); // Initial die Orientierung prüfen -> ruft startGameAfterOrientation auf
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
    }

// 1.3: Spotify Web Player SDK laden und initialisieren (MODIFIZIERT)
    function initializePlayer() {
        // ... (Die Funktion initializePlayer bleibt unverändert)
        return new Promise((resolve, reject) => {
            // Nur das SDK laden, wenn es noch nicht da ist
            if (!window.Spotify) {
                const script = document.createElement('script');
                script.src = "https://sdk.scdn.co/spotify-player.js";
                script.async = true;
                document.body.appendChild(script);
            }

            window.onSpotifyWebPlaybackSDKReady = () => {
                // Nur einen neuen Player erstellen, wenn noch keiner existiert
                if (spotifyPlayer) {
                    // Wenn der Player schon existiert und verbunden ist, sofort auflösen
                    if (deviceId) {
                        resolve(deviceId);
                    }
                    return;
                }
                
                spotifyPlayer = new Spotify.Player({
                    name: 'TRACK ATTACK',
                    getOAuthToken: cb => { cb(accessToken); }
                });

                // Fehler-Listener
                spotifyPlayer.addListener('initialization_error', ({ message }) => { 
                    console.error('Initialization Error:', message);
                    reject('Fehler bei der Initialisierung des Players.');
                });
                spotifyPlayer.addListener('authentication_error', ({ message }) => {
                    console.error('Authentication Error:', message);
                    reject('Fehler bei der Authentifizierung des Players.');
                });
                spotifyPlayer.addListener('account_error', ({ message }) => {
                    console.error('Account Error:', message);
                    reject('Account-Fehler: Spotify Premium wird benötigt.');
                });
                 spotifyPlayer.addListener('playback_error', ({ message }) => {
                    console.error('Playback Error:', message);
                    // Dies ist kein reject, da es oft temporär ist
                });

                // Erfolgs-Listener
                spotifyPlayer.addListener('ready', ({ device_id }) => {
                    console.log('Ready with Device ID', device_id);
                    deviceId = device_id;
                    resolve(device_id); // Promise mit der deviceId auflösen
                });

                spotifyPlayer.addListener('not_ready', ({ device_id }) => {
                    console.log('Device ID has gone offline', device_id);
                });

                spotifyPlayer.connect().then(success => {
                    if (!success) {
                        reject('Der Spotify Player konnte nicht verbunden werden.');
                    }
                });
            };
        });
    }

    // --- ÄNDERUNG: NETZWERK - GESCHWINDIGKEITS - ABFRAGE (NEU) ----------------
   async function checkConnectionSpeed() {
    // 🚨 WICHTIG: Diesen Pfad auf eine 1MB-Testdatei auf Ihrem Server anpassen
    const TEST_FILE_URL = 'dummy/dummy.bin'; 
    
    const FILE_SIZE_MB = 1.0; 
    
    // --- SCHWELLENWERT-EINSTELLUNG ---
    // Hier stellen Sie ein, ab welcher echten Geschwindigkeit (Mbit/s) die Warnung erscheinen soll.
    // 1.0 Mbit/s ist oft ein guter Startpunkt für Streaming-Anwendungen.
    const SLOW_THRESHOLD_MBIT = 1.0; 
    // ---------------------------------

    const startTime = performance.now();
    let isTooSlow = false;
    let speedKbit = 'N/A';
    
    // 1. Datei herunterladen und Caching verhindern
    try {
        const cacheBusterURL = `${TEST_FILE_URL}?r=${Math.random()}`;
        
        const response = await fetch(cacheBusterURL, { cache: 'no-store' });
        
        if (!response.ok) throw new Error("Testdatei nicht verfügbar oder Server-Fehler.");
        
        // Lesen des Streams, um sicherzustellen, dass die gesamte Datei heruntergeladen wird
        // Wenn die Datei sehr groß ist, response.text() durch response.blob() ersetzen
        await response.text(); 
        
    } catch (error) {
        console.error("Geschwindigkeitstest konnte nicht durchgeführt werden:", error.message);
        // Bei einem Fehler (z.B. Server nicht erreichbar) die Warnung anzeigen
        isTooSlow = true;
        speedKbit = 'Failed';
        
    } finally {
        const endTime = performance.now();
        const durationSeconds = (endTime - startTime) / 1000;

        // 2. Geschwindigkeit nur berechnen, wenn kein Fehler aufgetreten ist
        if (speedKbit !== 'Failed') {
            // (MB * 8) / Sekunden = Mbit/s
            const speedMbit = (FILE_SIZE_MB * 8) / durationSeconds;
            // Auf 2 Nachkommastellen runden
            speedKbit = (Math.round(speedMbit * 100) / 100).toFixed(2); 
            
            // 3. Ergebnis bewerten
            if (speedMbit < SLOW_THRESHOLD_MBIT) {
                isTooSlow = true;
            }
        }
        
        // 4. Konsole-Eintrag mit gemessener Geschwindigkeit
        console.log(`[REAL SPEED TEST] Gemessene Geschwindigkeit: ${speedKbit} Mbit/s.`);
    }

    // 5. Anzeige-Logik steuern
    const networkToast = document.getElementById('network-toast');
    const networkMessageSpan = document.getElementById('network-toast-message');

    if (isTooSlow) {
        if (networkMessageSpan) {
            networkMessageSpan.innerText = `Network too slow (${speedKbit} Mbit/s). Needs > ${SLOW_THRESHOLD_MBIT} Mbit/s.`;
        }
        if (networkToast) {
            networkToast.classList.add('show');
        }
    } else {
        if (networkToast) {
            networkToast.classList.remove('show');
        }
    }
}
    // --- NETZWERK - ENDE ---------------- 
    
	// --- NEU: Funktion: Genres für die Vorauswahl rendern ---
    function renderPreselectionGenres() {
        // Zuerst sicherstellen, dass die Scrollbox leer ist, bevor neue Buttons hinzugefügt werden
        allGenresScrollbox.innerHTML = '';
        const allAvailableGenres = Object.keys(playlists); 

        allAvailableGenres.forEach(genreName => {
            const button = document.createElement('button');
            button.classList.add('preselect-genre-button');
            button.dataset.genre = genreName; 
            button.innerText = genreName.split(/(?=[A-Z])/).join(' ').replace(/\b\w/g, char => char.toUpperCase());

            // Überprüfen, ob das Genre bereits ausgewählt ist
            if (gameState.selectedPlayableGenres.includes(genreName)) {
                button.classList.add('selected');
            }

            button.addEventListener('click', () => {
                toggleGenreSelection(genreName, button);
            });
            allGenresScrollbox.appendChild(button);
        });
    }

    // --- NEU: Funktion: Genre in der Vorauswahl auswählen/abwählen ---
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

    //=======================================================================
    // Phase 2: Spielstart & UI-Grundlagen
    //=======================================================================

    function triggerBounce(element) {
        element.classList.remove('bounce');
        void element.offsetWidth; // Trigger reflow
        element.classList.add('bounce');
    }

// KORRIGIERT: startGame-Funktion (VERWENDET {once: true} VON startGameAfterOrientation)
    async function startGame() {

        logoButton.classList.add('inactive'); // Button wird unklickbar/inaktiv
        logoButton.classList.remove('logo-pulsing'); // Pulsing stoppen
		triggerBounce(logoButton);
        
        // Player nur initialisieren, wenn wir noch keine deviceId haben.
        if (!deviceId) {
            try {
                console.log("Initialisiere Spotify Player durch Benutzerklick...");
                await initializePlayer();
                console.log("Player erfolgreich initialisiert und verbunden.");

                // --- WICHTIG: DER iOS-FIX ---
                console.log("Versuche, den Player aufzuwecken (resume)...");
                await spotifyPlayer.resume();
                console.log("Player erfolgreich aufgeweckt.");

            } catch (error) {
                console.error("Fehler bei der Player-Initialisierung oder beim Aufwecken:", error);
                alert("Der Spotify Player konnte nicht gestartet werden. Bitte stelle sicher, dass du Spotify Premium hast und lade die Seite neu. Fehlermeldung: " + error);
                
                // Füge den Listener wieder hinzu, da die Funktion abgebrochen wird,
                // ABER {once: true} ihn bereits entfernt hat.
                logoButton.addEventListener('click', startGame, { once: true }); 
                logoButton.classList.remove('inactive');
                logoButton.classList.add('logo-pulsing'); // Pulsing wieder starten
                return; // Breche die Funktion ab, wenn es fehlschlägt.
            }
        }
        
        lastGameScreenVisible = 'logo-button';
        startGenreSelectionContainer.classList.add('hidden');

        setTimeout(() => {
            appContainer.style.backgroundColor = 'var(--player1-color)';
            logoButton.classList.add('hidden');
            showDiceScreen();
        }, 800);
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
				// ⭐️ NEU: Dedizierte Variable für die maximalen Punkte einführen
                gameState.maxScore = config.attempts;
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
            // ⭐️ FIX: maxScore auf 15 überschreiben
            gameState.maxScore = 15;  // hier maxscore - PUNKTE FÜR DIE SPEEDROUND
            // ⭐️ ZUSÄTZLICH: MAXIMALE VERSUCHE auf 1 setzen, falls die Logik es benötigt
            // gameState.maxAttempts = 1;
            // Zeige die "Speed-Round" Animation, bevor der Track geladen wird
            await showSpeedRoundAnimation();
        }

        await prepareAndShowRateScreen(selectedGenre);
    }

    //=======================================================================
    // Phase 4: Rate-Bildschirm & Spielerwechsel
    //=======================================================================

// AKTUALISIERT: getTrack-Funktion
async function getTrack(selectedGenreName) { // Habe den Parameter-Namen zur Klarheit geändert
    // 'selectedGenreName' ist das spezifische Genre, das der Spieler im Spiel geklickt hat.
    // Wir müssen hier KEINE weitere zufällige Auswahl treffen.
    // Wir nutzen einfach direkt den Namen des geklickten Genres.

    const playlistPool = playlists[selectedGenreName]; // <-- KORREKTUR: Nutze DIREKT den übergebenen Genre-Namen!

    if (!playlistPool || playlistPool.length === 0) {
        console.error(`Keine Playlists für Genre "${selectedGenreName}" definiert oder Pool ist leer.`);
        alert(`Fehler: Für das Genre "${selectedGenreName}" sind keine Playlists verfügbar. Bitte wähle ein anderes Genre.`);
        showGenreScreen(); // Gehe zurück zum Genre-Auswahlbildschirm
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

// Globale Variable, um laufende Toast-Timer zu verwalten
let toastTimeout = null;

/**
 * Zeigt eine non-blocking Toast-Nachricht am oberen Bildschirmrand an.
 * @param {string} message Die anzuzeigende Nachricht.
 * @param {number} [duration=3000] Die Dauer in Millisekunden (optional).
 */
function showToast(message, duration = 3000) {
    const toastElement = document.getElementById('toast-notification');
    const messageElement = document.getElementById('toast-message');

    if (!toastElement || !messageElement) {
        console.error("Toast-Elemente nicht im DOM gefunden!");
        return;
    }

    // Setze die Nachricht
    messageElement.innerText = message;

    // --- [START KORREKTUR FÜR ANIMATION] ---

    // 1. Laufenden Timer löschen, falls ein neuer Toast kommt, bevor der alte weg ist
    if (toastTimeout) {
        clearTimeout(toastTimeout);
        toastTimeout = null;
    }

    // 2. Klasse entfernen, um die "Aus"-Position zu erzwingen
    // (Selbst wenn sie nicht da ist, das setzt einen sauberen Startpunkt)
    toastElement.classList.remove('show');

    // 3. WICHTIG: Einen "Reflow" erzwingen.
    // Dieser Befehl zwingt den Browser, die CSS-Änderungen (das .remove('show'))
    // sofort zu verarbeiten, anstatt sie zu bündeln.
    void toastElement.offsetWidth;

    // 4. Starte die Einblend-Animation im "nächsten Frame"
    // Ein minimaler Timeout (selbst 10ms) reicht aus, damit der Browser
    // den "Aus"-Zustand (top: -100px) verarbeitet hat, bevor der "Ein"-Zustand
    // (top: 30px) animiert wird.
    setTimeout(() => {
        toastElement.classList.add('show');

        // 5. Timer setzen, um den Toast nach 'duration' wieder auszublenden
        toastTimeout = setTimeout(() => {
            toastElement.classList.remove('show');
            toastTimeout = null;
        }, duration);
    }, 10); // 10ms Verzögerung für den sauberen Animationsstart
    
    // --- [ENDE KORREKTUR] ---
}

	/**
 * Wird aufgerufen, wenn ein Track nicht abgespielt werden kann (z.B. 403/404).
 * Lädt automatisch einen neuen Track aus dem aktuellen Genre.
 * @param {function | null} listenerToRemove - Der 'player_state_changed'-Listener, der bereinigt werden muss.
 */
async function handleTrackPlaybackError(listenerToRemove) {
    // 1. Wichtig: Listener aufräumen, falls er existiert
    if (listenerToRemove && spotifyPlayer) {
        spotifyPlayer.removeListener('player_state_changed', listenerToRemove);
        // Setze die globale Variable zurück, da der Listener entfernt wurde
        playbackStateListener = null; 
    }

    console.log(`Versuche, einen neuen Track für das Genre '${gameState.currentGenre}' zu laden.`);
    
    // 2. User informieren (non-blocking Toast statt alert)
    // Der Code läuft jetzt SOFORT weiter, während der Toast angezeigt wird.
    showToast("Oops, an error occurred, please try again.", 3500); // 3,5 Sekunden
    // ------------------

    // 3. Neuen Track holen (nutzt das gespeicherte Genre)
    const newTrack = await getTrack(gameState.currentGenre);

    if (newTrack) {
        // 4. Neuen Track im State speichern
        gameState.currentTrack = newTrack;
        console.log(`Neuer Track erfolgreich geladen: "${newTrack.name}"`);

        // 5. UI zurücksetzen, damit der User erneut klicken kann.
        // Der Versuch wurde dank der Code-Änderung oben NICHT gezählt.
        logoButton.classList.remove('inactive');
        logoButton.classList.add('logo-pulsing');
        
    } else {
        // 6. Fallback, falls getTrack() fehlschlägt
        console.error("Konnte keinen neuen Track laden. getTrack() ist fehlgeschlagen.");
        // In diesem Fall sollte getTrack() bereits zum Genre-Screen navigiert sein.
    }
}


    async function prepareAndShowRateScreen(genre) {
		// Speichere das ausgewählte Genre im globalen State.
        // Das brauchen wir, um bei einem Fehler einen neuen Track aus DEMSELBEN Genre zu laden.
        gameState.currentGenre = genre;
        gameState.currentTrack = await getTrack(genre);
		// WICHTIG: Prüfen, ob getTrack() erfolgreich war, bevor wir weitermachen
        if (!gameState.currentTrack) {
            console.warn("prepareAndShowRateScreen: getTrack hat 'null' zurückgegeben. Breche ab.");
            // getTrack() sollte in diesem Fall bereits showGenreScreen() aufgerufen haben.
            return; 
        }
        console.log("Selected Track:", gameState.currentTrack.name); // Zum Debuggen

        logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
		logoButton.classList.add('logo-pulsing');
        logoButton.removeEventListener('click', playTrackSnippet);
        logoButton.addEventListener('click', playTrackSnippet);

        // Speichere den Zustand: Raten-Bildschirm
        lastGameScreenVisible = 'reveal-container'; // Obwohl es der Rate-Bildschirm ist, steht reveal-container für die Auflösung
    }

// ################################################################### paytrack snippet

async function playTrackSnippet() {
    // ########### 1. Vorbereitung und Checks ###########
    const currentDiceValue = gameState.diceValue;
    const config = diceConfig[currentDiceValue];

    // Vorab-Checks
    if (!config) {
        console.error(`FEHLER: Konfiguration für Würfelwert ${currentDiceValue} fehlt.`);
        logoButton.classList.remove('inactive');
        logoButton.classList.add('logo-pulsing');
        return;
    }
    if ((gameState.attemptsMade >= gameState.maxAttempts && !gameState.isSpeedRound) || (gameState.isSpeedRound && gameState.attemptsMade > 0)) {
        return;
    }

    triggerBounce(logoButton);
    logoButton.classList.add('inactive');
	logoButton.classList.remove('logo-pulsing');

    const trackDurationMs = gameState.currentTrack.duration_ms;
    // const desiredDuration = gameState.trackDuration;
	const desiredDuration = config.duration;
    
    // Zufällige Startposition bestimmen
    const maxStart = trackDurationMs - desiredDuration - 500;
    if (maxStart <= 0) {
        console.error("Track zu kurz für die gewünschte Dauer.");
        logoButton.classList.remove('inactive');
		logoButton.classList.add('logo-pulsing');
        return;
    }
    const randomStartPosition = Math.floor(Math.random() * maxStart);

    // Löscht alte Timeouts & Polling-Timer
    if (gameState.spotifyPlayTimeout) {
        clearTimeout(gameState.spotifyPlayTimeout);
        gameState.spotifyPlayTimeout = null;
    }
    if (fallbackPlayTimer) { 
        clearTimeout(fallbackPlayTimer);
        fallbackPlayTimer = null;
    }
    if (pollingIntervalTimer) { 
        clearTimeout(pollingIntervalTimer);
        pollingIntervalTimer = null;
    }

    // Listener bereinigen und vorbereiten
    if (playbackStateListener) {
        spotifyPlayer.removeListener('player_state_changed', playbackStateListener);
        playbackStateListener = null; 
    }
    gameState.spotifyPlayTimeout = null;
    
    // ====================================================================
    // 🎯 PWA/Fokus Logik (Bleibt unverändert)
    // ====================================================================
    try {
        if (spotifyPlayer) {
            await spotifyPlayer.activateElement(); 
        } 
        if (!deviceId) {
            await initializePlayer(); 
        }
        if (!deviceId) {
            throw new Error("Device ID konnte nicht abgerufen werden. Player Initialisierung fehlgeschlagen.");
        }
        if (spotifyPlayer) {
            await spotifyPlayer.activateElement(); 
        }

        const transferResponse = await fetch(API_ENDPOINTS.SPOTIFY_PLAYER_TRANSFER, {
            method: 'PUT',
            body: JSON.stringify({ device_ids: [deviceId], play: false }),
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!transferResponse.ok && transferResponse.status !== 204) {
            if (transferResponse.status === 404 || transferResponse.status === 405) {
                throw new Error(`Device connection failed (Status ${transferResponse.status}).`);
            }
        }
    } catch (error) {
        console.error("[Kritischer Fehler] Player-Aktivierung oder Übertragung fehlgeschlagen:", error);
        
        if (error.message.includes("Device connection failed")) {
             alert("Kritischer Player-Fehler. (Status 404/405). Stelle sicher, dass deine API-Endpunkte korrekt sind.");
        } else {
            alert("Fehler beim Abspielen (Player-Verbindung). Hast du Spotify Premium und sind deine API-Endpunkte korrekt?");
        }
        
        logoButton.classList.remove('inactive');
		logoButton.classList.add('logo-pulsing');
        return; 
    }
    // ====================================================================


    // ########### 2. Zentralisierte Runden-Start Logik ###########
    /**
     * Startet die zentrale Rundenlogik (Zähler, Button, Stopp-Timer).
     * @param {number} statePosition - Die Startposition des Songs vom Spotify-Event.
     * @param {boolean} isFallback - Wurde die Funktion vom Fallback-Timer/Polling aufgerufen?
     * @param {number} [stopDuration] - Optional: Spezifische Dauer des Stopp-Timers.
     */
    const startRoundTimers = (statePosition, isFallback = false, stopDuration = desiredDuration) => { 
        // Den Versuch ZENTRAL an dieser Stelle ZÄHLEN
        gameState.attemptsMade++; 
        
        // Reveal-Button anzeigen (nur im Normalmodus beim ersten Versuch)
        if (gameState.attemptsMade === 1 && !gameState.isSpeedRound) {
            revealButton.classList.remove('hidden');
            revealButton.classList.remove('no-interaction');
        }

        if (gameState.isSpeedRound) {
            startVisualSpeedRoundCountdown(); // Muss global definiert sein!
        } else {
            // Normalmodus: Starte den (ungenauen) Timer, der den Song stoppt.
            gameState.spotifyPlayTimeout = setTimeout(() => {
                spotifyPlayer.pause();
                gameState.isSongPlaying = false;

                if (gameState.attemptsMade < gameState.maxAttempts) {
                    logoButton.classList.remove('inactive');
                    logoButton.classList.add('logo-pulsing');
                }

                // Logging
                if (!isFallback) {
                    spotifyPlayer.getCurrentState().then(finalState => {
                        const finalPosition = finalState ? finalState.position : 'N/A';
                        console.log(`[STOP] Wiedergabe gestoppt bei Position: ${finalPosition}ms.`);
                        if (finalState) {
                            const actualDuration = finalPosition - statePosition; 
                            console.log(`[ERGEBNIS] Tatsächliche Abspieldauer: ${actualDuration}ms.`);
                        }
                    });
                } else {
                     console.log("[STOP] Wiedergabe gestoppt nach Polling (Dauer: " + stopDuration + "ms).");
                }
            }, stopDuration);
        }
    };

    // ########### 3. Polling Fallback Funktion ###########
    const startPollingFallback = async (isRetry = false) => {
        if (pollingIntervalTimer) clearTimeout(pollingIntervalTimer);
        pollingIntervalTimer = null;
        
        console.log(`[POLL] Starte ${isRetry ? 'erneute' : 'erste'} Abfrage des Player-Status...`);

        try {
            const response = await fetch(API_ENDPOINTS.SPOTIFY_PLAYER_STATE, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (response.status === 204) {
                // Kein Inhalt, kein aktiver Player.
                console.log("[POLL] 204 No Content: Player nicht aktiv. Wiederhole Polling.");
                pollingIntervalTimer = setTimeout(() => startPollingFallback(true), config.poll_delay);
                return;
            }

            if (!response.ok) {
                throw new Error(`Spotify Player State API failed: ${response.status}`);
            }
            
            const state = await response.json();

            if (state && state.is_playing && state.item && state.item.uri === gameState.currentTrack.uri) {
                // FALLBACK ERFOLG: Song spielt!
                console.log("[POLL ERFOLG] Player spielt den korrekten Track. Übernehme Kontrolle.");

                // 1. Player Listener entfernen (falls er später doch kommt)
                if (playbackStateListener) {
                    spotifyPlayer.removeListener('player_state_changed', playbackStateListener);
                    playbackStateListener = null;
                }

                const position = state.progress_ms; // Tatsächliche Abspielposition
                const timeElapsed = position - randomStartPosition; // Vergangene Zeit seit dem befohlenen Startpunkt
                
                // Berechnung der Restzeit
                let remainingTime = desiredDuration - timeElapsed;
                remainingTime = Math.max(0, remainingTime); // Zeit kann nicht negativ sein

                // 2. Start Round Timers mit der berechneten Restzeit
                startRoundTimers(position, true, remainingTime); 
                
            } else {
                // Song spielt noch nicht / falscher Track. Erneuter Versuch.
                if (isRetry || !state) {
                     console.log("[POLL] Songstatus unklar oder noch nicht gestartet. Wiederhole Polling.");
                     pollingIntervalTimer = setTimeout(() => startPollingFallback(true), config.poll_delay);
                } else {
                     // Beim ersten Poll keine Klarheit, aber Player existiert. Wiederhole mit kürzerem Timeout
                     pollingIntervalTimer = setTimeout(() => startPollingFallback(true), 500); 
                }
            }
            
        } catch (error) {
            console.error("[POLL FEHLER] Fehler beim Abrufen des Player-Status:", error);
            // Bei Fehler warten und erneut versuchen
            pollingIntervalTimer = setTimeout(() => startPollingFallback(true), config.poll_delay * 2); 
        }
    };
    
    // ########### 4. Status-Änderungs-Listener (Erfolg) ###########
    playbackStateListener = (state) => {
        if (state && state.track_window.current_track.uri === gameState.currentTrack.uri) {
            if (!state.paused && state.position > 0) {
                
                // 🛑 KRITISCH: Polling-Prozess sofort beenden, wenn das Event eintrifft.
                if (fallbackPlayTimer) clearTimeout(fallbackPlayTimer);
                if (pollingIntervalTimer) clearTimeout(pollingIntervalTimer); 
                fallbackPlayTimer = null;
                pollingIntervalTimer = null;
                console.log("[PLAYBACK EVENT] Spotify Event empfangen. Polling/Warte-Timer gestoppt.");

                spotifyPlayer.removeListener('player_state_changed', playbackStateListener);
                playbackStateListener = null;

                console.log(`[START] Wiedergabe hat bei Position: ${state.position}ms begonnen.`);
                // Runde über die zentrale Funktion starten mit der vollen Dauer
                startRoundTimers(state.position, false); 
            }
        }
    };
    if (spotifyPlayer) {
        spotifyPlayer.addListener('player_state_changed', playbackStateListener);
    }

    // ########### 5. Initialer Polling-Start-Warte-Timer ###########
    // Wir warten 'poll_delay' auf das Spotify Event, bevor wir das Polling starten.
    if (!gameState.isSpeedRound && config && config.poll_delay) {
        const initialWait = config.poll_delay; 
        
        fallbackPlayTimer = setTimeout(() => {
            console.warn(`[FALLBACK INIT] Spotify PLAY-Rückmeldung nach ${initialWait}ms nicht erhalten. Starte Polling-Fallback.`);
            fallbackPlayTimer = null; 
            
            // Startet den eigentlichen Polling-Prozess
            startPollingFallback(false);
            
        }, initialWait);
    }
    // ########### ENDE: Initialer Polling-Start ###########

    // ########### 6. Web-API Playback Call ###########
    // Merke: Der Play-Befehl wird hier GESENDET, die Reaktion (Event/Polling) steuert den Ablauf.
    fetch(API_ENDPOINTS.SPOTIFY_PLAYER_PLAY(deviceId), {
        method: 'PUT',
        body: JSON.stringify({
            uris: [gameState.currentTrack.uri],
            position_ms: randomStartPosition
        }),
        headers: { 'Authorization': `Bearer ${accessToken}` }
    }).then(async response => { 
        if (!response.ok) {
            console.error("Fehler beim Abspielen des Tracks (Web API):", response.status, response.statusText);
            
            // WICHTIG: Warte- und Polling-Timer stoppen bei API-Fehler
            if (fallbackPlayTimer) clearTimeout(fallbackPlayTimer);
            if (pollingIntervalTimer) clearTimeout(pollingIntervalTimer);
            fallbackPlayTimer = null;
            pollingIntervalTimer = null;
            
            const status = response.status;
            if (status === 403 || status === 404) {
                console.warn(`Track nicht abspielbar (Status ${status}). Versuche, einen neuen Track zu laden...`);
                await handleTrackPlaybackError(playbackStateListener);
                return; 
            }

            // ... (Restliche Fehlerbehandlung) ...
            if (spotifyPlayer) {
                spotifyPlayer.activateElement().catch(e => console.warn("Re-Aktivierung nach Fehler fehlgeschlagen:", e));
            }
            
            alert("Konnte den Song nicht abspielen. Möglicherweise ist Spotify auf keinem aktiven Gerät.");
            logoButton.classList.remove('inactive');
            logoButton.classList.add('logo-pulsing');
            
            // Bereinige den Listener
            if (playbackStateListener) {
                spotifyPlayer.removeListener('player_state_changed', playbackStateListener);
                playbackStateListener = null;
            }
            // --- ENDE RESTLICHE FEHLERBEHANDLUNG ---

        } else {
            console.log("Spotify Playback-Befehl erfolgreich gesendet.");
        }
    }).catch(error => {
        console.error("Netzwerkfehler beim Abspielen des Tracks:", error);
        
        // WICHTIG: Warte- und Polling-Timer stoppen bei Netzwerkfehler
        if (fallbackPlayTimer) clearTimeout(fallbackPlayTimer);
        if (pollingIntervalTimer) clearTimeout(pollingIntervalTimer);
        fallbackPlayTimer = null;
        pollingIntervalTimer = null;
        
        alert("an error has occurred, a new track is being loaded");
        logoButton.classList.remove('inactive');
        logoButton.classList.add('logo-pulsing');
        if (playbackStateListener) {
            spotifyPlayer.removeListener('player_state_changed', playbackStateListener);
            playbackStateListener = null;
        }
    });
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
		logoButton.classList.remove('logo-pulsing');
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
        const fadeDuration = 3000; // Fade-In Dauer in Millisekunden (z.B. 3 Sekunden)
        const fadeStep = 5; // Schrittweite für die Lautstärkeanpassung
        const intervalTime = fadeDuration / (targetVolume / fadeStep); // Intervallzeit für jeden Schritt

        // Sicherstellen, dass die Lautstärke auf 0 gesetzt ist, bevor wir starten
        spotifyPlayer.setVolume(0).then(() => {
            gameState.currentSongVolume = 0; // Setze interne Volume auf 0

            // Song bei Sekunde 30 starten
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
                //    if (gameState.isSongPlaying && spotifyPlayer) {
                //        spotifyPlayer.pause();
                //        gameState.isSongPlaying = false;
                //    }
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

            const fadeDuration = 1500; // Fade-Out Dauer in Millisekunden (z.B. 1,5 Sekunden)
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

			// ⭐️ NEU: LOGIK FÜR FALSCHE ANTWORT IN DER SPEED ROUND  -  MINUS PUNKTE ⭐️
            if (!isCorrect && gameState.isSpeedRound) {
                // Bei Speed Round UND falscher Antwort: -15 Punkte
                pointsAwarded = -15; 

                // Punkte sofort zum aktuellen Spieler addieren (subtrahieren)
                if (gameState.currentPlayer === 1) {
                    gameState.player1Score += pointsAwarded;
                } else {
                    gameState.player2Score += pointsAwarded;
                }
            
            // Wichtig: Wenn falsch und KEINE Speed Round, bleiben pointsAwarded 0.
            // Der Code geht dann zur Animation, die "+0" anzeigt.
            }
            // ⭐️ ENDE DER NEUEN FALSCHE ANTWORT LOGIK IN DER SPEED ROUND  -  MISNUS PUNKTE⭐️

            if (isCorrect) {
                // 5.1: Punkte berechnen und speichern
                // - alte zeile-> pointsAwarded = Math.max(1, gameState.diceValue - (gameState.attemptsMade - 1)); // Punkte berechnen
				
				// ⭐️ START DER NEUEN SPEED ROUND PUNKTEBERECHNUNG  --  PUNKTE ÄNDERN IN DER async function handleGenreSelection ZEILE 746⭐️
                if (gameState.isSpeedRound) {
                    // Speed Round: Punkte sind der feste Wert (15), keine Abzüge.
                    pointsAwarded = gameState.maxScore; 
                } else {
                    // Normalrunde: Punkte sind Würfelwert (maxScore/diceValue) abzüglich Abzüge.
                    // Wir verwenden hier die neue Variable maxScore (die dem diceValue entspricht).
                    pointsAwarded = Math.max(1, gameState.maxScore - (gameState.attemptsMade - 1)); 
                }
                // ⭐️ ENDE DER NEUEN PUNKTEBERECHNUNG ⭐️
                
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
            // alt -> countdownDisplay.innerText = `+${points}`;

			// ⭐️ KORRIGIERTE LOGIK HIER ⭐️
            // Fügt das Pluszeichen nur hinzu, wenn die Punktzahl positiv ist
            const sign = points > 0 ? '+' : ''; 
            countdownDisplay.innerText = `${sign}${points}`;

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
            const flyAnimationDuration = 300; // Dauer der "Wegfliegen"-Animation (0.5 Sekunden, passt zur CSS)

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

    // RESET ROUND ---------------------------------------------------------------------------------------------------------------
    function resetRoundUI() {
        // Verstecke alle relevanten UI-Elemente
        revealContainer.classList.add('hidden');
        logoButton.classList.add('hidden');
		logoButton.classList.remove('logo-pulsing');
        genreContainer.classList.add('hidden');
        diceContainer.classList.add('hidden');
        revealButton.classList.add('hidden'); // Stellen Sie sicher, dass der Reveal-Button versteckt ist
        speedRoundTextDisplay.classList.add('hidden'); // Stellen Sie sicher, dass der speedRoundTextDisplay versteckt ist

        // Setze die Interaktivität der Antwort-Buttons zurück
        correctButton.classList.remove('no-interaction');
        wrongButton.classList.remove('no-interaction');

        // Entfernen Sie den Listener vom Logo-Button, um mehrfaches Hinzufügen zu vermeiden,
        // wenn der Logo-Button wieder verwendet wird.
        logoButton.removeEventListener('click', playTrackSnippet);

        // Digitalen Würfel-Bereich IMMER verstecken, wenn eine Runde vorbei ist
        digitalDiceArea.classList.add('hidden');

        // Setze das digitale Würfelbild auf seinen initialen Zustand zurück
        digitalDiceMainImage.src = digitalDiceStartImage;
        digitalDiceMainImage.classList.remove('no-interaction', 'rolling');
        digitalDiceMainImage.style.cursor = 'pointer'; // Sicherstellen, dass es klickbar ist

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

        // Lautstärke auf 100% zurücksetzen, BEVOR der nächste Song startet
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

    // Scorescree funktion ----
    // Bei Klick auf den Score-Screen soll das Spiel sofort zurückgesetzt werden
    scoreScreen.addEventListener('click', handleScoreScreenEnd);
    // NEU: Funktion, die die Aktionen nach dem Score-Screen ausführt
    function handleScoreScreenEnd() {
        // Stoppt den laufenden Timeout für den Score-Screen, falls er noch aktiv ist
        clearTimeout(gameState.scoreScreenTimeout);

        scoreScreen.classList.add('hidden'); // Score-Screen ausblenden

        // Setze die Deckkraft der Punkteanzeigen zurück, falls sie noch nicht auf 0 sind
        // Dies ist wichtig, wenn man den Screen überspringt, bevor die normale Fade-Out-Animation beendet ist.
        document.getElementById('player1-score-display').style.opacity = '0';
        document.getElementById('player2-score-display').style.opacity = '0';

        // Hier kommt die Logik, die nach dem Score-Screen passieren soll.
        // In deinem Fall ist das der Reset des Spiels und das Zurückkehren zum Startlogo.
        resetGame(); // Ruft die resetGame-Funktion auf, um das Spiel zurückzusetzen und neu zu starten
    }

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

        // Der Fade-Out der Punkteanzeige bleibt bestehen, da er schön aussieht.
        setTimeout(() => {
            p1ScoreEl.style.opacity = '0';
            p2ScoreEl.style.opacity = '0';
        }, 7000); // Dieser Timer lässt die Punkte 7 Sekunden lang sichtbar sein und dann ausfaden

        // NEU: Verwende gameState.scoreScreenTimeout für den Timeout des Score-Screens
        // Dieser Timeout ruft jetzt die neue Helferfunktion auf
        gameState.scoreScreenTimeout = setTimeout(() => {
            handleScoreScreenEnd(); // Ruft die neue Funktion auf
        }, 8000); // Nach 8 Sekunden (7s für Punkte-Fade-Out + 1s Puffer)
    }

    // AKTUALISIERT: resetGame-Funktion
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

        // NEU: Ausgewählte Genres zurücksetzen
        gameState.selectedPlayableGenres = [];
        // Und die scrollbox leeren, damit sie beim nächsten startGameAfterOrientation() neu gefüllt wird
        allGenresScrollbox.innerHTML = '';

        // Zurück zum Start (ohne Einflug-Animation)
        gameScreen.classList.remove('hidden');
        logoButton.classList.remove('hidden', 'inactive', 'initial-fly-in');
		logoButton.classList.add('logo-pulsing');
        logoButton.removeEventListener('click', startGame); // Sicherstellen, dass kein alter Listener hängt
        logoButton.addEventListener('click', startGame, { once: true }); // NEU: Listener hier neu setzen, da er ja einmalig ist

        // Setze den letzten sichtbaren Screen zurück, da das Spiel neu startet
        lastGameScreenVisible = '';

        // NEU: Die Genre-Vorauswahl auf der Startseite wieder anzeigen und neu rendern
        startGenreSelectionContainer.classList.remove('hidden');
        renderPreselectionGenres(); // Und die Buttons neu rendern
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
        let timeLeft = 10; // Startwert des Countdowns
        countdownDisplay.classList.remove('hidden'); // Countdown-Anzeige einblenden

        // Timer für die automatische Auflösung nach 10 Sekunden
        gameState.speedRoundTimeout = setTimeout(() => {
            showResolution(); // Auflösung nach 10 Sekunden
        }, 10000);

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
