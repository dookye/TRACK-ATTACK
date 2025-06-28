import { spotifyLoginButton, logo, diceButtons, gameContainer, loginArea, logoContainer, orientationMessage, fullscreenMessage, playbackStatus } from './domElements.js'; // playbackStatus hier importieren
import { checkSpotifyLoginStatus, redirectToSpotifyAuthorize } from './spotifyAuth.js';
import { showLoginScreen, showMessage, hideMessage, activateFullscreenAndRemoveListener, showLogoButton, setLogoAsPlayButton } from './uiManager.js';
import { isPlayerReady, currentGameState, setIsPlayerReady, setFullscreenRequested, fullscreenRequested } from './gameState.js';
// import { DICE_PARAMETERS } from './constants.js'; // Nicht direkt hier benötigt

/**
 * Überprüft die Geräteorientierung und den Fullscreen-Status und zeigt entsprechende Meldungen an.
 */
export function checkOrientationAndFullscreen() {
    console.log("checkOrientationAndFullscreen: Überprüfe Orientierung und Fullscreen.");
    setFullscreenRequested(false); // Reset des Flags für neue Fullscreen-Aufforderung

    if (window.innerHeight > window.innerWidth) { // Hochformat (Portrait)
        console.log("checkOrientationAndFullscreen: Hochformat erkannt. Zeige Orientierungs-Meldung.");
        showMessage(orientationMessage);
        hideMessage(fullscreenMessage);
        // Listener entfernen, falls er noch aktiv ist, da Orientierung falsch
        document.removeEventListener('click', activateFullscreenAndRemoveListener);
    } else { // Querformat (Landscape)
        console.log("checkOrientationAndFullscreen: Querformat erkannt.");
        hideMessage(orientationMessage);

        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msRequestFullscreen) {
            console.log("checkOrientationAndFullscreen: Zeige Fullscreen-Aufforderung.");
            showMessage(fullscreenMessage);
            // Listener hinzufügen, wenn noch nicht im Vollbild. { once: true } entfernt ihn nach dem Klick.
            document.addEventListener('click', activateFullscreenAndRemoveListener, { once: true });
        } else {
            console.log("checkOrientationAndFullscreen: Bereits im Vollbildmodus. Zeige Logo.");
            hideMessage(fullscreenMessage);
            showLogoButton(); // Zeige das Logo mit Animation (oder ohne, je nach introAnimationPlayed)
        }
    }
}


/**
 * Wird aufgerufen, wenn der Spotify Player erfolgreich initialisiert wurde.
 * Leitet zur Orientierungs-/Fullscreen-Prüfung weiter.
 * Diese Funktion wird vom spotifyPlayer.js aufgerufen.
 */
export function handlePlayerReady() { // <-- DIESE FUNKTION WIRD HIER EXPORTIERT
    console.log("main.js handlePlayerReady: Spotify Player ist verbunden. Starte Orientierungs-/Fullscreen-Check.");
    loginArea.classList.add('hidden'); // Login-Bereich ausblenden
    checkOrientationAndFullscreen(); // Jetzt den Orientierungs- und Fullscreen-Check starten
}


// --- INITIALISIERUNG BEIM LADEN DER SEITE ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: Seite geladen.");

    // Füge diesen Listener hinzu, damit die 'logo-bounce' Klasse
    // nach jeder Klick-Animation automatisch entfernt wird.
    if (logo) {
        logo.addEventListener('animationend', (event) => {
            if (event.animationName === 'press-down-bounce') {
                logo.classList.remove('logo-bounce');
            }
        });
        console.log("DOMContentLoaded: Logo AnimationEnd Listener für Klick-Bounce hinzugefügt.");
    } else {
        console.error("DOMContentLoaded: Logo-Element (ID: game-logo) nicht gefunden, kann Klick-Bounce Listener nicht hinzufügen.");
    }

    // --- NEU: AnimationEnd-Listener für die Würfel-Buttons hinzufügen ---
    diceButtons.forEach(button => {
        button.addEventListener('animationend', (event) => {
            if (event.animationName === 'press-down-bounce') {
                event.target.classList.remove('logo-bounce');
            }
        });
    });
    console.log("DOMContentLoaded: Würfel-Buttons AnimationEnd Listener für Klick-Bounce hinzugefügt.");
    // --- ENDE NEU ---

    // Spotify SDK Skript dynamisch laden
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    document.body.appendChild(script);
    console.log("DOMContentLoaded: Spotify SDK Skript geladen von " + script.src);

    // Initialisiere den Login-Button Listener
    if (spotifyLoginButton) {
        spotifyLoginButton.addEventListener('click', redirectToSpotifyAuthorize);
        console.log("DOMContentLoaded: Spotify Login Button Event Listener hinzugefügt.");
    } else {
        console.error("DOMContentLoaded: Login-Button (ID: spotify-login-button) nicht im DOM gefunden.");
    }

    // Beim Laden der Seite direkt den Spotify Login-Bereich anzeigen
    loginArea.classList.remove('hidden');
    logoContainer.classList.add('hidden', 'initial-hidden'); // Logo verstecken und initial positionieren
    
    // VERSCHOBEN: playbackStatus Initialisierung in den DOMContentLoaded-Block
    if (playbackStatus) { // Zusätzliche Prüfung, um Sicherzustellen, dass es existiert
        playbackStatus.textContent = ''; // Anfangs leer
    } else {
        console.error("DOMContentLoaded: playbackStatus-Element nicht gefunden.");
    }

    // Prüfe den Login-Status sofort
    await checkSpotifyLoginStatus();

    // Event Listener für Orientierungsänderungen und Fenstergrößenänderungen
    window.addEventListener('resize', () => {
        if (isPlayerReady) { // Nur prüfen, wenn Player bereit ist (nach Login)
            checkOrientationAndFullscreen();
        }
    });
    window.addEventListener('orientationchange', () => {
        if (isPlayerReady) { // Nur prüfen, wenn Player bereit ist (nach Login)
            checkOrientationAndFullscreen();
        }
    });

    // Listener für das Beenden des Fullscreen-Modus
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            console.log("Fullscreen verlassen.");
            setFullscreenRequested(false);
            if (isPlayerReady) {
                checkOrientationAndFullscreen();
            } else {
                showLoginScreen(); // Wenn Player nicht bereit, zurück zum Login
            }
        } else {
            console.log("Fullscreen aktiviert.");
            // Wenn Fullscreen aktiviert wird und wir im Startscreen sind, direkt Logo zeigen
            if (currentGameState === 'startScreen' || currentGameState === 'loading') { // Auch wenn noch 'loading'
                showLogoButton();
            }
        }
    });
});
