import { logo, logoContainer, loginArea, initialClickBlocker, orientationMessage, fullscreenMessage, gameContainer, diceContainer, diceAnimation, diceButtonsContainer, diceButtons, playbackStatus } from './domElements.js';
import { currentGameState, isPlayerReady, player, isSpotifySDKLoaded, introAnimationPlayed, currentScore, currentRound, currentPlayer, currentDiceRoll, TOTAL_GAME_ROUNDS, MAX_ROUNDS_PER_PLAYER, setIntroAnimationPlayed, setCurrentGameState, setFullscreenRequested } from './gameState.js';
import { checkOrientationAndFullscreen } from './main.js'; // Main wird importiert für den Check
import { startDiceRollPhase } from './gameLogic.js'; // GameLogic wird importiert
import { playSongBasedOnDice } from './spotifyPlayer.js'; // KORRIGIERT: playSongBasedOnDice kommt von spotifyPlayer.js


/**
 * Zeigt den Login-Screen an.
 */
export function showLoginScreen() {
    console.log("showLoginScreen: Zeige Login-Bereich.");
    logoContainer.classList.add('hidden', 'initial-hidden'); // Logo ausblenden und initial positionieren
    loginArea.classList.remove('hidden');
    // Stellen Sie sicher, dass der Hintergrund wieder schwarz ist, wenn zum Login gewechselt wird
    gameContainer.classList.remove('player1-active-bg', 'player2-active-bg', 'score-screen-bg');
    gameContainer.style.backgroundColor = 'black';
    console.log("Spielhintergrund auf Schwarz zurückgesetzt (Login Screen).");
    setCurrentGameState('loading'); // Oder 'loginScreen'
}

/**
 * Zeigt eine Overlay-Nachricht an (z.B. Orientierung, Fullscreen).
 * @param {HTMLElement} element - Das anzuzeigende DOM-Element.
 */
export function showMessage(element) {
    element.classList.remove('hidden');
    element.classList.add('visible');
    element.style.pointerEvents = 'auto'; // Klicks auf die Nachricht erlauben
    initialClickBlocker.classList.remove('hidden'); // Blocker anzeigen
}

/**
 * Versteckt eine Overlay-Nachricht.
 * @param {HTMLElement} element - Das zu versteckende DOM-Element.
 */
export function hideMessage(element) {
    element.classList.remove('visible');
    element.classList.add('hidden');
    element.style.pointerEvents = 'none'; // Klicks durch die Nachricht hindurchlassen
    initialClickBlocker.classList.add('hidden'); // Blocker ausblenden
}

/**
 * Fordert den Vollbildmodus an.
 */
export function requestFullscreen() {
    console.log("requestFullscreen: Anforderung Vollbildmodus.");
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
    } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
    } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
    }
}

/**
 * Wird bei Klick auf die Fullscreen-Aufforderung aufgerufen.
 * Leitet die Fullscreen-Anforderung ein und zeigt danach das Logo.
 */
export function activateFullscreenAndRemoveListener(event) {
    console.log("activateFullscreenAndRemoveListener: Vollbildmodus-Aktivierung durch Klick.");

    // Nur reagieren, wenn der Klick auf der Fullscreen-Nachricht selbst war.
    if (!fullscreenMessage.contains(event.target)) {
        console.log("activateFullscreenAndRemoveListener: Klick nicht auf Fullscreen-Nachricht, ignoriere.");
        // Da Listener mit { once: true } gesetzt ist, muss er bei ignoriertem Klick neu hinzugefügt werden.
        document.addEventListener('click', activateFullscreenAndRemoveListener, { once: true });
        return;
    }

    if (!fullscreenRequested) {
        requestFullscreen();
        setFullscreenRequested(true);
        // Listener wird durch { once: true } automatisch entfernt

        // Nach erfolgreicher Fullscreen-Anforderung das Logo anzeigen
        showLogoButton();
    }
}

/**
 * Zeigt das TRACK ATTACK Logo mit der Reinfall-Animation.
 * Aktiviert den Klick-Listener nach Abschluss der Animation.
 */
export function showLogoButton() {
    // Bedingung: Wenn die Intro-Animation schon einmal lief und wir nicht im Startbildschirm-Zustand sind (z.B. Spiel läuft)
    if (introAnimationPlayed && currentGameState !== 'startScreen') {
        console.log("showLogoButton: Intro-Animation wurde bereits abgespielt. Zeige Logo ohne Animation.");
        loginArea.classList.add('hidden'); // Login ausblenden
        logoContainer.classList.remove('hidden');
        logoContainer.classList.remove('initial-hidden');
        logoContainer.style.animation = ''; // Sicherstellen, dass keine Animation aktiv ist

        // WICHTIG: Hier Logo inaktiv machen, wenn das Spiel läuft und nicht gerade ein Song ansteht
        if (currentGameState === 'playing') { // 'playing' bedeutet, wir warten auf den ersten Song-Start nach Würfeln/Genre
             setLogoAsPlayButton(true); // Logo als Play-Button aktivieren (Bereit zum ersten Song-Play)
             playbackStatus.textContent = 'Klicke auf das Logo zum Abspielen des Songs!';
        } else if (currentGameState === 'songPlaying' || currentGameState === 'resolutionPhase') {
            setLogoAsPlayButton(false);
        } else { // Wenn der Zustand "playing" ist und wir zum Abspielen bereit sind
            setLogoAsPlayButton(true); // Logo als Play-Button aktivieren
        }
        return;
    }
    // Wenn die Animation schon lief, aber wir noch im Startscreen sind (z.B. nach Fullscreen-Wechsel vor Spielstart)
    else if (introAnimationPlayed && currentGameState === 'startScreen') {
        console.log("showLogoButton: Intro-Animation lief schon, zeige Logo für Spielstart (ohne Re-Animation).");
        loginArea.classList.add('hidden'); // Login ausblenden
        logoContainer.classList.remove('hidden');
        logoContainer.classList.remove('initial-hidden');
        logoContainer.style.animation = ''; // Sicherstellen, dass keine Animation aktiv ist

        // Setze den Klick-Listener für den Spielstart
        if (logoClickListener) {
            logo.removeEventListener('pointerup', logoClickListener);
        }
        const newListener = function(event) {
            event.preventDefault(); // Verhindert Standardverhalten (z.g. bei Touch)
            console.log("Logo geklickt zum Spielstart (ohne Re-Animation)!");
            logo.classList.remove('logo-bounce');
            void logo.offsetWidth;
            logo.classList.add('logo-bounce');

            if (currentGameState === 'startScreen') {
                if (isPlayerReady) {
                    console.log("Spiel wird gestartet!");
                    playbackStatus.textContent = 'Bereit zum Abspielen!';
                    setCurrentGameState('diceRoll'); // NEUER Zustand

                    // NEU: updatePlayerBackground mit Callback
                    updatePlayerBackground(() => {
                        startDiceRollPhase(); // Startet die Würfelphase nach dem Hintergrundübergang
                    });
                } else {
                    console.warn("Player ist noch nicht bereit, kann Spiel nicht starten.");
                    playbackStatus.textContent = 'Spotify Player ist noch nicht bereit. Bitte warten...';
                }
            }
        };
        logo.addEventListener('pointerup', newListener);
        setLogoClickListener(newListener); // Speichere den neuen Listener
        setCurrentGameState('startScreen');
        return; // Funktion hier beenden
    }


    // Dieser Teil wird nur ausgeführt, wenn die Intro-Animation noch NICHT lief
    console.log("showLogoButton: Starte Logo-Reinfall-Animation.");
    loginArea.classList.add('hidden');
    hideMessage(fullscreenMessage);
    hideMessage(orientationMessage);

    logoContainer.classList.remove('hidden');
    logoContainer.classList.remove('initial-hidden');

    // Hier die Geschwindigkeit anpassen, z.B. 1s
    logoContainer.style.animation = 'fall-in 0.9s ease-out forwards'; // Geschwindigkeit hier einstellen!

    logoContainer.addEventListener('animationend', function handler(event) {
        if (event.animationName === 'fall-in') {
            console.log("fall-in Animation beendet. Logo ist bereit für Klicks.");
            logoContainer.removeEventListener('animationend', handler); // Listener entfernen
            logoContainer.style.animation = ''; // Animation zurücksetzen, um Styling Konflikte zu vermeiden

            setIntroAnimationPlayed(true); // Markiere, dass die Animation gelaufen ist

            // Jetzt den Klick-Listener für den Spielstart aktivieren
            if (logoClickListener) { // Alten Listener entfernen, falls vorhanden
                logo.removeEventListener('pointerdown', logoClickListener);
            }
            const newListener = function(event) {
                event.preventDefault(); // Verhindert Standardverhalten (z.B. bei Touch)
                console.log("Logo geklickt zum Spielstart!");
                // Füge den kleinen Bounce-Effekt bei jedem Klick hinzu
                logo.classList.remove('logo-bounce');
                void logo.offsetWidth; // Force reflow
                logo.classList.add('logo-bounce');

                if (currentGameState === 'startScreen') {
                    if (isPlayerReady) {
                        console.log("Spiel wird gestartet!");
                        playbackStatus.textContent = 'Bereit zum Abspielen!';
                        setCurrentGameState('diceRoll'); // Zustandswechsel

                        // NEU: updatePlayerBackground mit Callback
                        updatePlayerBackground(() => {
                            startDiceRollPhase(); // Startet die Würfelphase nach dem Hintergrundübergang
                        });

                    } else {
                        console.warn("Player ist noch nicht bereit, kann Spiel nicht starten.");
                        playbackStatus.textContent = 'Spotify Player ist noch nicht bereit. Bitte warten...';
                    }
                }
                    // Hinzugefügte Logik für den späteren Song-Play/Repeat
                else if (currentGameState === 'playing' || currentGameState === 'songPaused') {
                    if (isPlayerReady && currentDiceRoll) {
                        if (currentSongRepetitionsLeft >= 0) { // Ermöglicht das erste Hören und weitere
                            playSongBasedOnDice(); // Funktion für die Song-Wiedergabelogik
                            // Logo direkt nach Klick inaktiv machen, während der Song spielt
                            setLogoAsPlayButton(false);
                            setCurrentGameState('songPlaying');
                        } else {
                            console.log("Keine weiteren Hördurchgänge für diesen Song mehr.");
                            playbackStatus.textContent = 'Keine weiteren Versuche. Löse den Song auf!';
                            // Logo bleibt inaktiv, da jetzt aufgelöst wird
                            setLogoAsPlayButton(false);
                        }
                    } else {
                        console.warn("Player ist nicht bereit oder kein Würfelwert gesetzt.");
                        playbackStatus.textContent = 'System nicht bereit oder Würfel fehlt.';
                    }
                }
            };
            logo.addEventListener('pointerdown', newListener);
            setLogoClickListener(newListener); // Speichere den neuen Listener

            // Setze den initialen Spielzustand nach der Animation
            setCurrentGameState('startScreen');
            logo.classList.add('active-logo'); // Sicherstellen, dass es am Start aktiv ist
        }
    });
}

/**
 * Konfiguriert den Logo-Button als Play/Pause-Button für das Spiel.
 * @param {boolean} activate - True, um den Button zu aktivieren, False, um ihn zu deaktivieren.
 */
export function setLogoAsPlayButton(activate = true) {
    if (logoClickListener) {
        logo.removeEventListener('pointerdown', logoClickListener);
    }

    if (activate) {
        console.log("setLogoAsPlayButton: Logo wird zum aktiven Play-Button.");
        logo.classList.remove('inactive-logo');
        logo.classList.add('active-logo');
        const newListener = function(event) {
            event.preventDefault();
            console.log("Play/Repeat-Button (Logo) geklickt!");
            logo.classList.remove('logo-bounce');
            void logo.offsetWidth;
            logo.classList.add('logo-bounce');

            if (isPlayerReady && currentDiceRoll) {
                if (currentSongRepetitionsLeft >= 0) { // Ermöglicht das erste Hören und weitere
                    playSongBasedOnDice(); // Funktion für die Song-Wiedergabelogik
                    // Logo direkt nach Klick inaktiv machen, während der Song spielt
                    setLogoAsPlayButton(false);
                    setCurrentGameState('songPlaying');
                } else {
                    console.log("Keine weiteren Hördurchgänge für diesen Song mehr.");
                    playbackStatus.textContent = 'Keine weiteren Versuche. Löse den Song auf!';
                    // Logo bleibt inaktiv, da jetzt aufgelöst wird
                    setLogoAsPlayButton(false);
                }
            } else {
                console.warn("Player ist nicht bereit oder kein Würfelwert gesetzt.");
                playbackStatus.textContent = 'System nicht bereit oder Würfel fehlt.';
            }
        };
        logo.addEventListener('pointerdown', newListener);
        setLogoClickListener(newListener); // Speichere den neuen Listener
    } else {
        console.log("setLogoAsPlayButton: Logo wird inaktiv.");
        logo.classList.remove('active-logo');
        logo.classList.add('inactive-logo');
        // Klick-Listener bleibt entfernt
    }
}

/**
 * Aktualisiert den Hintergrund des Spielcontainers basierend auf dem aktiven Spieler
 * und startet optional einen Callback nach Abschluss der Hintergrund-Transition.
 * @param {function} [callback] - Eine optionale Funktion, die nach der Hintergrund-Transition ausgeführt wird.
 */
export function updatePlayerBackground(callback = null) {
    // ZUERST: Sicherstellen, dass jeder zuvor gesetzte Inline-Style entfernt wird
    gameContainer.style.backgroundColor = ''; // <-- NEU: Inline-Hintergrundfarbe entfernen!
    
    // Sicherstellen, dass alle spezifischen Hintergrundklassen entfernt werden, bevor eine neue hinzugefügt wird
    gameContainer.classList.remove('player1-active-bg', 'player2-active-bg', 'score-screen-bg');

    // NEU: Erzwinge einen Reflow (macht den Browser auf CSS-Änderung aufmerksam)
    void gameContainer.offsetWidth;

    // Füge die Klasse für den aktiven Spieler hinzu
    if (activePlayer === 1) { // activePlayer muss importiert werden
        gameContainer.classList.add('player1-active-bg');
    } else {
        gameContainer.classList.add('player2-active-bg');
    }
    console.log(`Hintergrund aktualisiert für Spieler ${activePlayer}`);

    const backgroundTransitionDurationMs = 2000; // Aus Konstanten übernehmen

    if (callback && typeof callback === 'function') {
        setTimeout(callback, backgroundTransitionDurationMs);
    }
}

/**
 * Hilfsfunktion zum Ausblenden aller relevanten Game-UI-Elemente,
 * bevor eine neue Phase (z.B. Würfeln) beginnt.
 * Diese Funktion muss erweitert werden, sobald du mehr UI-Elemente hast.
 */
export function hideAllGameUI() {
    console.log("Alle Game UI Elemente ausgeblendet.");
    // NEU: Dice Container ausblenden
    diceContainer.classList.add('hidden');
    diceAnimation.classList.add('hidden');
    diceButtonsContainer.classList.add('hidden');

    // Beispiel: Auflösen-Button, Richtig/Falsch-Buttons, Titel/Interpret-Anzeige
    // Diese Elemente werden später implementiert. Füge hier deren `classList.add('hidden');` hinzu.
}

/**
 * Aktualisiert die Anzeige der Spielerpunkte.
 * Diese Funktion muss die HTML-Elemente ansprechen, die die Punkte anzeigen.
 * (Muss noch in HTML und hier implementiert werden)
 */
export function updatePlayerScoresDisplay() {
    // Importiere playerScores aus gameState.js
    // Da `playerScores` und `activePlayer` nun direkt importiert werden, ist der Workaround `window.gameState` nicht mehr nötig.
    console.log(`Spielstand: Spieler 1: ${playerScores[1]}, Spieler 2: ${playerScores[2]}`);
    // Beispiel: Wenn du P-Tags mit IDs 'player1-score' und 'player2-score' hast:
    // document.getElementById('player1-score').textContent = `Spieler 1: ${playerScores[1]} Punkte`;
    // document.getElementById('player2-score').textContent = `Spieler 2: ${playerScores[2]} Punkte`;
    // FÜGE HIER DIE LOGIK HINZU, UM DEINE PUNKTANZEIGE ZU AKTUALISIEREN
}
