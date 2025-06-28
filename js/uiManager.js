// js/uiManager.js

// Importiere benötigte DOM-Elemente
import { initialClickBlocker, spotifyLoginButton, loginArea, logo, logoContainer, orientationMessage, fullscreenMessage, playbackStatus, scoreDisplay, roundDisplay, resolutionButtonsContainer, correctButton, passButton, skipButton, diceAnimation, diceButtons, playerDisplay, gameContainer, gameElementsContainer } from './domElements.js';
// Importiere benötigte Zustandsvariablen und Setter aus gameState
import { currentGameState, isPlayerReady, player, isSpotifySDKLoaded, introAnimationPlayed, currentScore, currentRound, currentPlayer, currentDiceRoll, setIntroAnimationPlayed, setCurrentGameState, setFullscreenRequested, playerScores } from './gameState.js';
// Importiere Konstanten für Animationen und Spielregeln
import { ANIMATION_DURATIONS, TOTAL_GAME_ROUNDS, MAX_ROUNDS_PER_PLAYER } from './constants.js';

// Temporäre Imports, da playSongBasedOnDice und handleResolution/Pass/Skip noch nicht existieren
// Diese werden später hinzugefügt, wenn spotifyPlayer.js und gameLogic.js implementiert sind.
// import { playSongBasedOnDice } from './spotifyPlayer.js';
// import { handleResolution, handlePass, handleSkip } from './gameLogic.js';


let introAnimationFinished = false; // Um zu verfolgen, ob die Intro-Animation schon gelaufen ist

// --- ALLGEMEINE UI-FUNKTIONEN ---

/**
 * Zeigt den Login-Bildschirm an und versteckt andere Spiel-Elemente.
 */
export function showLoginScreen() {
    console.log("showLoginScreen: Zeige Login-Bereich.");
    loginArea.classList.remove('hidden'); // Zeigt den Login-Bereich
    logoContainer.classList.add('hidden', 'initial-hidden'); // Logo ausblenden
    gameElementsContainer.classList.add('hidden'); // Alle Spiel-Elemente ausblenden
    gameContainer.style.background = 'black'; // Hintergrund auf Schwarz zurücksetzen
    hideMessage(orientationMessage); // Orientierungs-Nachricht ausblenden
    hideMessage(fullscreenMessage); // Fullscreen-Nachricht ausblenden
}

/**
 * Blendet eine Nachricht ein.
 * @param {HTMLElement} element - Das anzuzeigende HTML-Element.
 */
export function showMessage(element) {
    if (element) {
        element.classList.remove('hidden');
    }
}

/**
 * Blendet eine Nachricht aus.
 * @param {HTMLElement} element - Das auszublendende HTML-Element.
 */
export function hideMessage(element) {
    if (element) {
        element.classList.add('hidden');
    }
}

/**
 * Aktiviert den Vollbildmodus und entfernt den Click-Listener, damit er nur einmal auslöst.
 * @param {Event} event - Das Klick-Event.
 */
export function activateFullscreenAndRemoveListener(event) {
    console.log("activateFullscreenAndRemoveListener: Versuch, Fullscreen zu aktivieren.");
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
            console.log("Fullscreen aktiviert.");
            hideMessage(fullscreenMessage);
            setFullscreenRequested(true);
            // Wenn die Intro-Animation noch nicht gelaufen ist, zeige das Logo
            if (!introAnimationFinished) {
                showLogoButton();
            } else {
                // Ansonsten zeige den aktuellen Spielzustand
                if (currentGameState === 'startScreen') {
                     showLogoButton();
                } else if (currentGameState === 'diceRoll') {
                    showDice();
                } else if (currentGameState === 'resolution') {
                    showResolutionButtons();
                } else if (currentGameState === 'playing') {
                    setLogoAsPlayButton(true); // Logo wieder als Play-Button aktivieren
                }
            }
        }).catch(err => {
            console.error(`Fehler beim Aktivieren des Fullscreen-Modus: ${err.message} (${err.name})`);
            // Optional: Zeige eine Fehlermeldung an den Benutzer
        });
    } else {
        // Falls Fullscreen schon aktiv ist, einfach die Meldung ausblenden und Logo zeigen
        hideMessage(fullscreenMessage);
        if (!introAnimationFinished) {
            showLogoButton();
        }
    }
    // Entferne den Listener, da er nur einmal auslösen soll
    event.currentTarget.removeEventListener('click', activateFullscreenAndRemoveListener);
}

// --- LOGO-SCREEN MANAGEMENT ---

/**
 * Zeigt den Logo-Button an und startet die Intro-Animation, falls noch nicht erfolgt.
 */
export function showLogoButton() {
    console.log("showLogoButton: Zeige Logo-Button.");
    hideMessage(fullscreenMessage); // Sicherstellen, dass Fullscreen-Meldung ausgeblendet ist
    hideMessage(orientationMessage); // Sicherstellen, dass Orientierungs-Meldung ausgeblendet ist

    loginArea.classList.add('hidden'); // Login-Bereich ausblenden
    gameElementsContainer.classList.add('hidden'); // Spiel-Elemente ausblenden
    logoContainer.classList.remove('hidden'); // Logo-Container einblenden

    if (!introAnimationFinished) {
        logo.classList.add('initial-hidden'); // Starte mit verstecktem Logo für die Animation
        setTimeout(() => {
            logo.classList.remove('initial-hidden'); // Logo einblenden
            logo.classList.add('fall-in-animation'); // Fall-in Animation starten
            gameContainer.style.transition = `background ${ANIMATION_DURATIONS.backgroundTransition / 1000}s ease-in-out`;
            gameContainer.style.background = 'radial-gradient(circle at center, rgba(30, 0, 70, 0.9) 0%, rgba(0,0,0,1) 100%)'; // Lila Hintergrund
            setIntroAnimationPlayed(true); // Zustand aktualisieren
        }, 50); // Kleine Verzögerung, um CSS-Transitionen zu gewährleisten

        // Listener, der nach Abschluss der Fall-in-Animation ausgelöst wird
        logo.addEventListener('animationend', (event) => {
            if (event.animationName === 'fall-in-animation') { // Stelle sicher, dass es die richtige Animation ist
                logo.classList.remove('fall-in-animation');
                logo.classList.add('active-logo'); // Setze auf aktive Klasse
                introAnimationFinished = true; // Animation ist abgeschlossen
                console.log("showLogoButton: Intro-Animation beendet.");
                setLogoAsPlayButton(true); // Logo als Play-Button aktivieren
                setCurrentGameState('startScreen'); // Spielzustand auf Startbildschirm setzen
            }
        }, { once: true }); // Entfernt den Listener nach dem ersten Auslösen
    } else {
        logo.classList.add('active-logo'); // Direkt aktive Klasse hinzufügen, wenn Animation schon gelaufen
        setLogoAsPlayButton(true); // Logo als Play-Button aktivieren
        setCurrentGameState('startScreen'); // Spielzustand auf Startbildschirm setzen
    }
}

/**
 * Konfiguriert das Logo als Play-Button (klickbar) oder deaktiviert es.
 * @param {boolean} isActive - True, um als Play-Button zu aktivieren, False um zu deaktivieren.
 */
export function setLogoAsPlayButton(isActive) {
    if (isActive) {
        logo.classList.add('action-button');
        logo.classList.remove('inactive-logo');
        // Entferne alten Listener, um Doppelungen zu vermeiden, bevor neuer hinzugefügt wird
        logo.removeEventListener('click', handleLogoClick);
        logo.addEventListener('click', handleLogoClick);
        console.log("setLogoAsPlayButton: Logo als Play-Button aktiviert.");
    } else {
        logo.classList.remove('action-button');
        logo.classList.add('inactive-logo');
        logo.removeEventListener('click', handleLogoClick);
        console.log("setLogoAsPlayButton: Logo als Play-Button deaktiviert.");
    }
}

/**
 * Behandelt den Klick auf das Logo, wenn es als Play-Button fungiert.
 */
function handleLogoClick() {
    if (!isPlayerReady) {
        playbackStatus.textContent = 'Spotify Player ist noch nicht bereit. Bitte warten...';
        return;
    }
    console.log("handleLogoClick: Logo geklickt, starte neue Runde.");
    logo.classList.add('logo-bounce'); // Animation hinzufügen
    // Die 'animationend' Listener in main.js kümmert sich um das Entfernen der Klasse.
    // In diesem Modul rufen wir lediglich die Logik in gameLogic.js auf.
    // WICHTIG: Sobald gameLogic.js existiert, wirst du hier `startNewRound()` aufrufen.
    // Im Moment lassen wir das leer oder fügen einen Platzhalter ein.
    // Hier rufen wir stattdessen temporär `console.log` auf
    console.log("handleLogoClick: Hier sollte später `startNewRound()` aufgerufen werden.");
    // Beispiel: setTimeout(() => { logo.classList.remove('logo-bounce'); startNewRound(); }, ANIMATION_DURATIONS.logoBounce);
}


// --- WÜRFEL UND SCORE-ANZEIGE ---

/**
 * Zeigt den Würfelbereich und versteckt das Logo.
 */
export function showDice() {
    console.log("showDice: Zeige Würfel.");
    logoContainer.classList.add('hidden'); // Logo verstecken
    gameElementsContainer.classList.remove('hidden'); // Haupt-Spiel-Elemente-Container einblenden
    diceArea.classList.remove('hidden'); // Würfelbereich einblenden
    diceAnimation.classList.remove('hidden'); // Würfelanimation einblenden
    diceButtons.forEach(button => button.classList.remove('hidden')); // Würfel-Buttons einblenden
    // Hintergrund zum Würfelhintergrund ändern
    gameContainer.style.background = 'radial-gradient(circle at center, rgba(0, 70, 70, 0.9) 0%, rgba(0,0,0,1) 100%)';
}

/**
 * Versteckt den Würfelbereich.
 */
export function hideDice() {
    console.log("hideDice: Verstecke Würfel.");
    diceArea.classList.add('hidden'); // Würfelbereich komplett verstecken
    diceAnimation.classList.add('hidden');
    diceButtons.forEach(button => button.classList.add('hidden'));
}

/**
 * Aktualisiert die Anzeige des Scores.
 */
export function updateScoreDisplay() {
    if (scoreDisplay) {
        // Nutze playerScores, um die Punktzahl beider Spieler anzuzeigen
        scoreDisplay.textContent = `Punkte: Spieler 1: ${playerScores[0]} | Spieler 2: ${playerScores[1]}`;
    } else {
        console.warn("Score-Anzeige-Element nicht gefunden.");
    }
}

/**
 * Aktualisiert die Anzeige der aktuellen Runde.
 */
export function updateRoundDisplay() {
    if (roundDisplay) {
        roundDisplay.textContent = `Runde: ${currentRound} / ${TOTAL_GAME_ROUNDS}`;
    } else {
        console.warn("Runden-Anzeige-Element nicht gefunden.");
    }
}

/**
 * Aktualisiert die Anzeige des aktuellen Spielers.
 */
export function updatePlayerDisplay() {
    if (playerDisplay) {
        playerDisplay.textContent = `Aktueller Spieler: ${currentPlayer}`;
    } else {
        console.warn("Spieler-Anzeige-Element (playerDisplay) nicht gefunden.");
    }
}


// --- AUFLÖSUNGS-BUTTONS ---

/**
 * Zeigt die Auflösungs-Buttons an.
 */
export function showResolutionButtons() {
    console.log("showResolutionButtons: Zeige Auflösungs-Buttons.");
    gameElementsContainer.classList.remove('hidden'); // Haupt-Spiel-Elemente-Container einblenden
    resolutionButtonsContainer.classList.remove('hidden'); // Buttons einblenden
    logoContainer.classList.add('hidden'); // Logo verstecken, wenn Buttons da sind
    hideDice(); // Würfel verstecken

    // Event Listener für die Buttons hinzufügen
    // Die tatsächlichen Handler (handleResolution etc.) werden von gameLogic.js importiert,
    // sobald diese Datei existiert. Hier sind es noch Platzhalter.
    correctButton.removeEventListener('click', () => console.log('Correct clicked (Placeholder)'));
    passButton.removeEventListener('click', () => console.log('Pass clicked (Placeholder)'));
    skipButton.removeEventListener('click', () => console.log('Skip clicked (Placeholder)'));

    correctButton.addEventListener('click', () => console.log('Correct clicked (Placeholder)')); // Später: handleResolution('correct')
    passButton.addEventListener('click', () => console.log('Pass clicked (Placeholder)'));     // Später: handleResolution('pass')
    skipButton.addEventListener('click', () => console.log('Skip clicked (Placeholder)'));     // Später: handleResolution('skip')

    // Hintergrundfarbe ändern
    gameContainer.style.background = 'radial-gradient(circle at center, rgba(70, 30, 0, 0.9) 0%, rgba(0,0,0,1) 100%)';
}

/**
 * Versteckt die Auflösungs-Buttons.
 */
export function hideResolutionButtons() {
    console.log("hideResolutionButtons: Verstecke Auflösungs-Buttons.");
    resolutionButtonsContainer.classList.add('hidden');
}


// --- FULLSCREEN BLOCKER ---

/**
 * Zeigt einen Blocker an, der Klicks verhindert, bis die Seite bereit ist (z.B. nach der Fullscreen-Aufforderung).
 */
export function showInitialClickBlocker() {
    initialClickBlocker.classList.remove('hidden');
}

/**
 * Versteckt den initialen Klick-Blocker.
 */
export function hideInitialClickBlocker() {
    initialClickBlocker.classList.add('hidden');
}
