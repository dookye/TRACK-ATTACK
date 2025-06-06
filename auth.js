// WICHTIG: Ersetze dies mit deiner echten Client ID und Redirect URI
const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6'; // Hier deine Client ID eintragen
const REDIRECT_URI = window.location.origin + window.location.pathname; // Für GitHub Pages: https://dookye.github.io/musik-raten/
// Falls du eine callback.html hast: const REDIRECT_URI = 'https://dookye.github.io/musik-raten/callback.html';

const scopes = [
    'user-read-private',
    'user-read-email',
    'playlist-read-private',
    // 'streaming' // Nur nötig für Web Playback SDK Steuerung von vollen Songs
];

function redirectToSpotifyLogin() {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(scopes.join(' '))}&show_dialog=true`;
    window.location = authUrl;
}

function getAccessToken() {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');

    if (token) {
        // Token im localStorage speichern und Hash entfernen, damit er nicht in der URL bleibt
        localStorage.setItem('spotify_access_token', token);
        localStorage.setItem('spotify_token_expires_at', Date.now() + parseInt(params.get('expires_in')) * 1000);
        window.location.hash = ''; // Clean the URL
        return token;
    }
    return localStorage.getItem('spotify_access_token');
}

function isTokenValid() {
    const expiresAt = localStorage.getItem('spotify_token_expires_at');
    return expiresAt && Date.now() < parseInt(expiresAt);
}

function logout() {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expires_at');
    // Hier könntest du auch zu Spotify navigieren, um die App-Berechtigung zu widerrufen,
    // aber ein lokales Logout reicht meistens für client-seitige Apps.
    window.location.reload();
}

// Initialisiere Authentifizierung beim Laden
let accessToken = null;
window.addEventListener('load', () => {
    accessToken = getAccessToken();
    if (accessToken && isTokenValid()) {
        console.log("Spotify Access Token vorhanden:", accessToken);
        // UI aktualisieren, um den angemeldeten Zustand anzuzeigen
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('setup-container').classList.remove('hidden');
    } else if (window.location.hash.includes('error=')) {
        console.error("Spotify Login Fehler:", window.location.hash);
        window.location.hash = ''; // Fehler aus URL entfernen
        // UI für Fehler anzeigen
    } else {
         // Noch nicht eingeloggt oder Token abgelaufen
        document.getElementById('login-container').classList.remove('hidden');
        document.getElementById('setup-container').classList.add('hidden');
        localStorage.removeItem('spotify_access_token'); // Alten Token entfernen
        localStorage.removeItem('spotify_token_expires_at');
    }

    const loginButton = document.getElementById('login-button');
    if (loginButton) { // Sicherstellen, dass der Button existiert (falls wir auf einer callback Seite wären)
        loginButton.addEventListener('click', redirectToSpotifyLogin);
    }
});
