import { SPOTIFY_API_BASE_URL, PLAYLIST_ID, DICE_PARAMETERS } from './constants.js';
import { player, accessToken, activeDeviceId, isPlayerReady, currentPlaylistTracks, currentPlayingTrack, currentDiceRoll, currentSongRepetitionsLeft, currentMaxPointsForSong, currentPlayStartPosition, setPlayer, setActiveDeviceId, setIsPlayerReady, setCurrentPlaylistTracks, setCurrentPlayingTrack, setCurrentSongRepetitionsLeft, setCurrentMaxPointsForSong, setCurrentPlayStartPosition, setIsResolvingSong } from './gameState.js';
import { playbackStatus, logo } from './domElements.js';
import { showLoginScreen, setLogoAsPlayButton } from './uiManager.js';
import { startResolutionPhase } from './gameLogic.js';

// Importiere handlePlayerReady aus main.js, um eine Zirkelabhängigkeit zu vermeiden
// Diese Funktion wird vom Player aufgerufen, sobald er bereit ist.
import { handlePlayerReady } from './main.js'; 

/**
 * Initialisiert und verbindet den Spotify Player.
 */
export async function initializeSpotifyPlayer() {
    console.log('initializeSpotifyPlayer: Versuche Spotify Player zu initialisieren...');

    if (!isPlayerReady) { 
        if (!accessToken || localStorage.getItem('expires_in') < Date.now()) {
            console.warn('initializeSpotifyPlayer: Access Token fehlt oder ist abgelaufen. Zeige Login-Screen.');
            playbackStatus.textContent = 'Fehler: Spotify Session abgelaufen oder nicht angemeldet. Bitte neu anmelden.';
            showLoginScreen();
            return;
        }

        if (player) {
            console.log('initializeSpotifyPlayer: Spotify Player bereits initialisiert. Nichts zu tun.');
            playbackStatus.textContent = 'Spotify Player verbunden!';
            handlePlayerReady(); // Rufe den globalen Ready-Handler auf
            return;
        }

        if (typeof Spotify === 'undefined' || typeof Spotify.Player === 'undefined') {
            console.error('initializeSpotifyPlayer: Spotify Web Playback SDK (Spotify.Player) ist nicht verfügbar.');
            playbackStatus.textContent = 'Spotify SDK nicht geladen. Bitte überprüfe deine Internetverbindung.';
            return;
        }

        playbackStatus.textContent = 'Spotify Player wird verbunden...';
        const newPlayer = new Spotify.Player({
            name: 'TRACK ATTACK Player',
            getOAuthToken: cb => { cb(accessToken); },
            volume: 0.5
        });
        setPlayer(newPlayer); // Setze den Player im globalen Zustand

        newPlayer.addListener('ready', ({ device_id }) => {
            console.log('Player.ready: Spotify Player ist bereit auf Gerät-ID:', device_id);
            setActiveDeviceId(device_id);
            setIsPlayerReady(true);
            playbackStatus.textContent = 'Spotify Player verbunden!';
            transferPlayback(device_id);
            console.log("Spotify Player ready! Du bist jetzt eingeloggt und der Player ist bereit.");
            handlePlayerReady(); // Rufe den globalen Ready-Handler auf
        });

        newPlayer.addListener('not_ready', ({ device_id }) => {
            console.warn('Player.not_ready: Gerät-ID nicht bereit:', device_id);
            playbackStatus.textContent = 'Spotify Player ist nicht bereit. Ist Spotify im Browser offen?';
            setIsPlayerReady(false);
        });

        newPlayer.addListener('initialization_error', ({ message }) => {
            console.error('Player.initialization_error:', message);
            playbackStatus.textContent = `Fehler beim Initialisieren des Players: ${message}`;
            setIsPlayerReady(false);
            alert('Fehler beim Initialisieren des Spotify Players. Versuche es erneut.');
            showLoginScreen();
        });

        newPlayer.addListener('authentication_error', ({ message }) => {
            console.error('Player.authentication_error:', message);
            playbackStatus.textContent = 'Authentifizierungsfehler. Bitte logge dich erneut ein.';
            alert('Deine Spotify-Sitzung ist abgelaufen oder ungültig. Bitte logge dich erneut ein.');
            setIsPlayerReady(false);
            showLoginScreen();
        });

        newPlayer.addListener('account_error', ({ message }) => {
            console.error('Player.account_error:', message);
            playbackStatus.textContent = 'Account-Fehler. Hast du einen Spotify Premium Account?';
            alert('Es gab einen Fehler mit deinem Spotify Account. Für dieses Spiel ist ein Premium Account erforderlich.');
            setIsPlayerReady(false);
            showLoginScreen();
        });

        newPlayer.addListener('playback_error', ({ message }) => {
            console.error('Player.playback_error:', message);
            playbackStatus.textContent = `Wiedergabefehler: ${message}`;
        });

        newPlayer.addListener('player_state_changed', (state) => {
            if (!state) {
                return;
            }
        });

        newPlayer.connect().then(success => {
            if (success) {
                console.log('Player.connect: Der Web Playback SDK Player wurde erfolgreich verbunden (wartet auf "ready"-Status).');
            } else {
                console.warn('Player.connect: Verbindung zum Web Playback SDK Player fehlgeschlagen.');
                playbackStatus.textContent = 'Verbindung zum Spotify Player fehlgeschlagen.';
            }
        }).catch(err => {
            console.error('Player.connect Fehler:', err);
            playbackStatus.textContent = `Verbindung zum Player fehlgeschlagen: ${err.message}`;
        });
    } else {
        console.log("initializeSpotifyPlayer: Player ist bereits bereit, überspringe Initialisierung.");
        handlePlayerReady(); // Rufe den globalen Ready-Handler auf
    }
}

/**
 * Überträgt die Wiedergabe auf den neu erstellten Web Playback SDK Player.
 * @param {string} deviceId - Die ID des Players, auf den übertragen werden soll.
 */
export async function transferPlayback(deviceId) {
    console.log('transferPlayback: Versuche Wiedergabe auf Gerät', deviceId, 'zu übertragen.');
    try {
        const response = await fetch(`${SPOTIFY_API_BASE_URL}/me/player`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Fehler beim Übertragen der Wiedergabe: ${response.status} - ${errorData.error.message || response.statusText}`);
        }
        console.log('transferPlayback: Wiedergabe auf neuen Player übertragen.');

    } catch (error) {
        console.error('transferPlayback Fehler:', error);
        playbackStatus.textContent = `Fehler beim Aktivieren des Players: ${error.message}`;
    }
}

/**
 * Holt die Tracks einer bestimmten Playlist.
 * @returns {Promise<Array>} Ein Array von Track-Objekten.
 */
export async function getPlaylistTracks() {
    if (currentPlaylistTracks.length > 0) {
        return currentPlaylistTracks;
    }
    console.log('getPlaylistTracks: Lade Tracks aus Playlist...');
    try {
        let allTracks = [];
        let nextUrl = `${SPOTIFY_API_BASE_URL}/playlists/${PLAYLIST_ID}/tracks?limit=100`;

        while (nextUrl) {
            const response = await fetch(nextUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Fehler beim Laden der Playlist-Tracks: ${response.status} - ${errorData.error.message || response.statusText}`);
            }

            const data = await response.json();
            allTracks = allTracks.concat(data.items.filter(item => item.track && !item.track.is_local));
            nextUrl = data.next;
        }
        setCurrentPlaylistTracks(allTracks);
        console.log(`getPlaylistTracks: Geladene Tracks aus Playlist: ${currentPlaylistTracks.length}`);
        if (currentPlaylistTracks.length === 0) {
            console.warn('getPlaylistTracks: Keine spielbaren Tracks in der Playlist gefunden.');
            playbackStatus.textContent = 'Achtung: Keine spielbaren Tracks in der Playlist gefunden. Stelle sicher, dass die Playlist Tracks enthält und in deinem Markt verfügbar sind.';
        }
        return currentPlaylistTracks;
    } catch (error) {
        console.error('getPlaylistTracks Fehler:', error);
        playbackStatus.textContent = `Fehler beim Laden der Playlist: ${error.message}`;
        return [];
    }
}

/**
 * Wählt einen zufälligen Song aus der globalen Playlist aus.
 * @returns {Promise<Object|null>} Ein Track-Objekt von Spotify oder null bei Fehler.
 */
export async function selectRandomSongForRound() {
    try {
        const tracks = await getPlaylistTracks(); // Stelle sicher, dass diese Funktion die Tracks liefert
        if (tracks.length === 0) {
            console.warn('Keine Tracks verfügbar für die Auswahl.');
            return null;
        }
        const randomTrackItem = tracks[Math.floor(Math.random() * tracks.length)];
        return randomTrackItem;
    } catch (error) {
        console.error("Fehler beim Auswählen eines zufälligen Songs:", error);
        return null;
    }
}

/**
 * Spielt den aktuellen Song basierend auf den Würfelparametern ab.
 * Startet an einer zufälligen Position und spielt für die definierte Dauer.
 */
export async function playSongBasedOnDice() {
    if (!currentPlayingTrack) { // Wenn noch kein Song ausgewählt wurde (erster Durchgang)
        const track = await selectRandomSongForRound(); // Holt einen neuen zufälligen Song
        setCurrentPlayingTrack(track);
        if (!currentPlayingTrack) {
            playbackStatus.textContent = 'Fehler: Konnte keinen Song auswählen.';
            return;
        }
    }

    if (!isPlayerReady || !player || !activeDeviceId) {
        playbackStatus.textContent = 'Spotify Player ist noch nicht bereit oder verbunden. Bitte warten...';
        return;
    }

    playbackStatus.textContent = 'Spiele Song...';
    logo.classList.remove('active-logo');
    logo.classList.add('inactive-logo'); // Logo inaktiv machen, während Song läuft

    const trackUri = currentPlayingTrack.track.uri;
    const trackDurationMs = currentPlayingTrack.track.duration_ms;
    const playDurationMs = DICE_PARAMETERS[currentDiceRoll].playDurationSec * 1000;

    // Eine neue zufällige Startposition für jede Wiederholung
    const maxStartPositionMs = trackDurationMs - playDurationMs - 1000; // Mindestens 1 Sekunde Puffer am Ende
    setCurrentPlayStartPosition(Math.floor(Math.random() * (maxStartPositionMs > 0 ? maxStartPositionMs : 0)));
    if (currentPlayStartPosition < 0) setCurrentPlayStartPosition(0); // Sicherstellen, dass es nicht negativ wird

    console.log(`Spiele ${currentPlayingTrack.track.name} von ${currentPlayingTrack.track.artists[0].name} ` +
                `ab Position ${currentPlayStartPosition}ms für ${playDurationMs}ms.`);

    try {
        await player.activateElement();

        await fetch(`${SPOTIFY_API_BASE_URL}/me/player/play?device_id=${activeDeviceId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                uris: [trackUri],
                position_ms: currentPlayStartPosition
            })
        });

        setCurrentSongRepetitionsLeft(currentSongRepetitionsLeft - 1); // Eine Wiederholung verbraucht
        setCurrentMaxPointsForSong(Math.max(0, currentMaxPointsForSong - 1)); // Punkte abziehen (Minimum 0)

        setTimeout(async () => {
            await player.pause();
            playbackStatus.textContent = `Song beendet. ${currentSongRepetitionsLeft + 1} Hördurchgänge verbleiben.`;
            // currentGameState = 'playing'; // Zurück zum Zustand, wo man auf den Logo-Button klicken kann

            if (currentSongRepetitionsLeft < 0) { // Alle Versuche aufgebraucht (0 oder weniger, da es runterzählt)
                console.log("Alle Hördurchgänge verbraucht. Zeige Auflösen-Buttons.");
                startResolutionPhase(); // Leite zur Auflösungsphase über
            } else {
                setLogoAsPlayButton(true); // Logo wieder aktivieren für nächste Wiederholung
            }
        }, playDurationMs);

    } catch (error) {
        console.error('playSongBasedOnDice Fehler:', error);
        playbackStatus.textContent = `Fehler beim Abspielen: ${error.message}`;
        // Hier könntest du spezifischere Fehlermeldungen anzeigen, z.B. bei Premium-Fehlern
    }
}
