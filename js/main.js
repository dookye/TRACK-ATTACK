// js/main.js

// Importiere benötigte Funktionen und Variablen aus anderen Modulen
import { spotifyLoginButton, logo, initialClickBlocker, fullscreenMessage, orientationMessage, gameContainer } from './domElements.js';
import { showLoginScreen, showMessage, hideMessage, showLogoButton, activateFullscreenAndRemoveListener } from './uiManager.js';
import { checkSpotifyLoginStatus } from './spotifyAuth.js';
import { isPlayerReady, setIntroAnimationPlayed, setCurrentGameState } from './gameState.js';
import { initializeGame } from './gameLogic.js'; // gameLogic.js wird hier benötigt
import { ANIMATION_DURATIONS } from './constants.js';


/**
 * Exportiert, damit spotifyAuth.js darauf zugreifen kann.
 * Wird aufgerufen, wenn der Spotify Player initialisiert und bereit ist.
 */
export function handlePlayerReady() {
    console.log("handlePlayerReady: Spotify Player ist spielbereit! Initialisiere Spiel.");
    // Nachdem der Player bereit ist, können wir den Initial-Click-Blocker entfernen
    hideMessage(initialClickBlocker);
    // Und direkt den Startbildschirm (Logo-Screen) anzeigen
    showLogoButton();
    initializeGame(); // Starte die Spiellogik (setzt Spielzustand auf 'startScreen')
}

/**
 * Überprüft die Bildschirmausrichtung und zeigt eine Meldung an, falls sie nicht im Querformat ist.
 */
function checkOrientation() {
    if (window.innerHeight > window.innerWidth) {
        showMessage(orientationMessage);
        gameContainer.classList.add('blurred'); // Spielcontainer unscharf machen
    } else {
        hideMessage(orientationMessage);
        gameContainer.classList.remove('blurred'); // Unschärfe entfernen
    }
}

/**
 * Zeigt die Vollbild-Nachricht an und registriert den Listener.
 */
function showFullscreenPrompt() {
    // Wenn Intro-Animation noch nicht gelaufen ist, zeige den Fullscreen-Prompt
    // (und erst danach ggf. das Logo)
    if (!introAnimationPlayed) {
        showMessage(fullscreenMessage);
        // Füge den Listener zum gesamten Dokument hinzu, um einen Klick abzufangen
        document.addEventListener('click', activateFullscreenAndRemoveListener, { once: true });
        console.log("showFullscreenPrompt: Fullscreen-Aufforderung angezeigt.");
    } else {
        // Wenn Intro-Animation schon lief, aber kein Fullscreen, zeige nur Fullscreen-Meldung
        // (Szenario: User hat Fullscreen verlassen oder es wurde nicht erlaubt)
        if (!document.fullscreenElement) {
             showMessage(fullscreenMessage);
             document.addEventListener('click', activateFullscreenAndRemoveListener, { once: true });
        } else {
            // Fullscreen ist aktiv und Intro lief bereits, zeige direkt Logo
            showLogoButton();
        }
    }
}

/**
 * Initialisiert alle Event-Listener beim Start der Anwendung.
 */
function setupEventListeners() {
    console.log("setupEventListeners: Event-Listener werden eingerichtet.");

    // Event-Listener für den Spotify Login Button
    spotifyLoginButton.addEventListener('click', () => {
        console.log("Spotify Login Button geklickt.");
        // Dynamischer Import, um Zirkelabhängigkeiten zu vermeiden, da spotifyAuth wiederum main importiert
        import('./spotifyAuth.js').then(({ redirectToSpotifyAuthorize }) => {
            redirectToSpotifyAuthorize();
        });
    });

    // Event-Listener für das Logo, wenn es als "Play"-Button fungiert
    // Die Logik für den Klick (startNewRound) ist in uiManager.js. Hier nur die Animation.
    logo.addEventListener('animationend', (event) => {
        if (event.animationName === 'logo-bounce') {
            logo.classList.remove('logo-bounce');
            console.log("Logo-Bounce Animation beendet.");
            // Nach der Animation sollte die Spiellogik eine neue Runde starten
            // Das wird vom handleLogoClick in uiManager.js ausgelöst, der wiederum gameLogic aufruft
        }
    });

    // Event-Listener für die Bildschirmausrichtung
    window.addEventListener('orientationchange', checkOrientation);
    window.addEventListener('resize', checkOrientation);

    // Initialen Click-Blocker für Fullscreen anzeigen, bis bereit
    initialClickBlocker.addEventListener('click', showFullscreenPrompt, { once: true });
}

/**
 * Die Hauptfunktion, die beim Laden der Seite aufgerufen wird.
 * Startet den Anwendungsfluss.
 */
async function initializeApp() {
    console.log("initializeApp: Anwendung wird gestartet.");

    // Zuerst die Event Listener einrichten
    setupEventListeners();

    // CSS-Klassen für den initialen Zustand setzen
    gameContainer.classList.add('initial-state'); // Hintergrund schwarz, Blocker an
    showInitialClickBlocker(); // Zeigt den Klick-Blocker an

    // Fullscreen-Prompt anzeigen, sobald die Seite initial geladen ist
    // Wir verwenden einen kleinen Timeout, um sicherzustellen, dass das DOM vollständig gerendert ist
    setTimeout(() => {
        // Prüfe die Ausrichtung, bevor der Fullscreen-Prompt angezeigt wird
        checkOrientation(); // Zeigt ggf. die Orientierungs-Nachricht
        if (!orientationMessage.classList.contains('hidden')) {
            console.log("Orientierungs-Nachricht ist sichtbar. Warte auf korrekte Ausrichtung.");
            // Wenn die Orientierungs-Nachricht sichtbar ist, den Fullscreen-Prompt noch nicht anzeigen.
            // Er wird angezeigt, sobald die Orientierung korrekt ist und die Nachricht ausgeblendet wird.
        } else {
            showFullscreenPrompt(); // Zeigt den Fullscreen-Prompt
        }
    }, 100); // Kurze Verzögerung nach dem DOM-Laden


    // Spotify SDK laden (muss nach dem DOM geladen werden, aber vor der Player-Initialisierung)
    // Dieser Script-Tag wird dynamisch hinzugefügt
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/playback/beta/sdk.js';
    script.async = true;
    document.body.appendChild(script);

    // Initialen Login-Status überprüfen (führt ggf. zum Login-Screen oder initialisiert Player)
    await checkSpotifyLoginStatus();

    // Das Spiel initialisieren, wenn der Player bereits bereit war (z.B. nach einem Reload mit Token)
    // Dies ist eine Fallback-Lösung, da `handlePlayerReady` auch von `spotifyAuth.js` aufgerufen wird.
    if (isPlayerReady) {
        console.log("initializeApp: Player ist sofort bereit. Zeige Logo-Button.");
        showLogoButton();
        initializeGame();
    }
}

// Startet die Anwendung, sobald das DOM vollständig geladen ist
document.addEventListener('DOMContentLoaded', initializeApp);
