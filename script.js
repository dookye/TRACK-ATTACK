// Referenzen auf HTML-Elemente
const logo = document.getElementById('game-logo');
const loginArea = document.getElementById('login-area');
const spotifyLoginButton = document.getElementById('spotify-login-button');
const initialClickBlocker = document.getElementById('initial-click-blocker');
const orientationMessage = document.getElementById('orientation-message');
const fullscreenMessage = document.getElementById('fullscreen-message');
const gameContainer = document.querySelector('.game-container'); // Der Hauptcontainer für Spiel und Logo

// Variable, um zu verfolgen, ob der Vollbildmodus schon angefordert wurde
let fullscreenRequested = false;

// Funktion zum Erzwingen des Vollbildmodus
function requestFullscreen() {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
    } else if (docEl.mozRequestFullScreen) { /* Firefox */
        docEl.mozRequestFullScreen();
    } else if (docEl.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) { /* IE/Edge */
        docEl.msRequestFullscreen();
    }
}

// Funktion, die den Vollbildmodus auslöst und den Listener entfernt
function activateFullscreenAndRemoveListener() {
    if (!fullscreenRequested) {
        requestFullscreen();
        fullscreenRequested = true;
        // Listener für den ersten Klick entfernen
        document.removeEventListener('click', activateFullscreenAndRemoveListener);
        // Nach dem Klick zur Vollbild-Aufforderung -> zeige den Game-Container
        hideMessage(fullscreenMessage);
        showGameContent();
    }
}

// Hilfsfunktionen zum Anzeigen/Verstecken von Nachrichten
function showMessage(element) {
    element.classList.remove('hidden');
    element.classList.add('visible');
}

function hideMessage(element) {
    element.classList.remove('visible');
    element.classList.add('hidden');
}

// Funktion zur Prüfung der Orientierung und Anzeige der entsprechenden Meldung
function checkOrientationAndProceed() {
    if (window.innerHeight > window.innerWidth) { // Hochformat (Portrait)
        hideGameContent();
        hideMessage(fullscreenMessage); // Falls sichtbar, verstecken
        showMessage(orientationMessage); // Zeige "Rotate device"
    } else { // Querformat (Landscape)
        hideMessage(orientationMessage); // Verstecke "Rotate device"
        // Jetzt den Vollbild-Prompt anzeigen, wenn noch nicht im Vollbild
        if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
             showMessage(fullscreenMessage); // Zeige "Click to fullscreen"
             // Der EventListener für den ersten Klick wird hier gesetzt
             // Er muss hier neu gesetzt werden, falls der Nutzer von Portrait zu Landscape wechselt
             // und der Listener vorher entfernt wurde.
             document.addEventListener('click', activateFullscreenAndRemoveListener);
        } else {
             // Bereits im Vollbild oder schon einmal ausgelöst, direkt Game Content zeigen
             showGameContent();
        }
    }
}

// Funktionen zum Anzeigen/Verstecken des Hauptspielinhalts
function showGameContent() {
    gameContainer.classList.remove('hidden');
    gameContainer.classList.add('visible');
    initialClickBlocker.style.display = 'none'; // Blocker entfernen
    // Nach der Animation des Logos den Login-Bereich einblenden
    setTimeout(() => {
        logo.classList.remove('active-logo'); // Abdunkeln des Logos
        logo.classList.add('inactive-logo');

        setTimeout(() => {
            loginArea.classList.remove('hidden');
            loginArea.classList.add('visible');
        }, 500); // 0.5 Sekunden nach Abdunkeln des Logos
    }, 1500); // 1.5 Sekunden Verzögerung, bevor das Logo abdunkelt
}

function hideGameContent() {
    gameContainer.classList.remove('visible');
    gameContainer.classList.add('hidden');
    // Blocker wieder aktivieren, solange die Meldungen sichtbar sind
    initialClickBlocker.style.display = 'block';
}


// --- Initialisierung beim Laden der Seite ---
window.onload = () => {
    checkOrientationAndProceed(); // Starte die Logik beim Laden
};

// Listener für Orientierungsänderungen und Fenstergrößenänderungen
window.addEventListener('resize', checkOrientationAndProceed);
window.addEventListener('orientationchange', checkOrientationAndProceed);


// Event Listener für den Bounce-Effekt beim Klick auf das Logo
logo.addEventListener('click', () => {
    if (logo.classList.contains('active-logo')) {
        logo.classList.remove('logo-bounce');
        void logo.offsetWidth;
        logo.classList.add('logo-bounce');
        console.log("Logo bouncet! (Aktiver Zustand)");
    } else {
        console.log("Logo ist inaktiv, kein Bounce.");
    }
});

// Event Listener für den Spotify Login Button (Platzhalter für deinen Code)
spotifyLoginButton.addEventListener('click', () => {
    console.log("Spotify Login Button geklickt!");
    // HIER kommt dein Spotify Login Code rein
});
