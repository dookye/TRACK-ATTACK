// js/spotifyPlayer.js

import { SPOTIFY_API_BASE_URL, PLAYLIST_ID, DICE_PARAMETERS } from './constants.js';
// Importiere benötigte Variablen direkt aus gameState.js
import { player, accessToken, activeDeviceId, isPlayerReady, currentPlaylistTracks, currentPlayingTrack, currentDiceRoll, currentSongRepetitionsLeft, currentMaxPointsForSong, currentPlayStartPosition, setPlayer, setActiveDeviceId, setIsPlayerReady, setCurrentPlaylistTracks, setCurrentPlayingTrack, setCurrentSongRepetitionsLeft, setCurrentMaxPointsForSong, setCurrentPlayStartPosition, setIsResolvingSong } from './gameState.js';
import { playbackStatus, logo } from './domElements.js';
import { showLoginScreen, setLogoAsPlayButton } from './uiManager.js';

// Wichtig: handlePlayerReady wird von main.js exportiert und hier importiert.
// Dadurch vermeiden wir Zirkelabhängigkeiten.
import { handlePlayerReady } from './main.js';
// Importiere gameLogic für startResolutionPhase, wird benötigt, wenn ein Song endet
// Dies ist ein dynamischer Import, da spotifyPlayer.js in spotifyAuth.js dynamisch importiert wird,
// und gameLogic.js wiederum spotifyPlayer.js importiert.
// Um Zirkelabhängigkeiten zu vermeiden, laden wir gameLogic bei Bedarf dynamisch.

/**
 * Initialisiert und verbindet den Spotify Player.
 * Diese Funktion wird von spotifyAuth.js (direkt oder via window.onSpotifyWebPlaybackSDKReady) aufgerufen.
 */
export async function initializeSpotifyPlayer() {
    console.log('initializeSpotifyPlayer: Versuche Spotify Player zu initialisieren...');

    // Prüfe, ob der Player bereits bereit ist, um Mehrfachinitialisierungen zu vermeiden
    if (isPlayerReady) {
        console.log('initializeSpotifyPlayer: Spotify Player bereits initialisiert und bereit. Nichts zu tun.');
        playbackStatus.textContent = 'Spotify Player verbunden!';
        handlePlayerReady(); // Rufe den globalen Ready-Handler auf
        return;
    }

    // Stelle sicher, dass ein Access Token vorhanden und gültig ist
    if (!accessToken || localStorage.getItem('expires_in') < Date.now()) {
        console.warn('initializeSpotifyPlayer: Access Token fehlt oder ist abgelaufen. Zeige Login-Screen.');
        playbackStatus.textContent = 'Fehler: Spotify Session abgelaufen oder nicht angemeldet. Bitte neu anmelden.';
        showLoginScreen();
        return;
    }

    // Prüfe, ob das Spotify SDK geladen ist
    if (typeof Spotify === 'undefined' || typeof Spotify.Player === 'undefined') {
        console.error('initializeSpotifyPlayer: Spotify Web Playback SDK (Spotify.Player) ist nicht verfügbar.');
        playbackStatus.textContent = 'Spotify SDK nicht geladen. Bitte überprüfe deine Internetverbindung oder Ad-Blocker.';
        return;
    }

    playbackStatus.textContent = 'Spotify Player wird verbunden...';

    // Erstelle eine neue Spotify.Player Instanz
    const newPlayer = new Spotify.Player({
        name: 'TRACK ATTACK Player',
        getOAuthToken: cb => { cb(accessToken); }, // Verwende das Access Token aus dem gameState
        volume: 0.5
    });
    setPlayer(newPlayer); // Setze den Player im gameState

    // Füge Event Listener für den Player hinzu
    newPlayer.addListener('ready', async ({ device_id }) => {
        console.log('Player.ready: Spotify Player ist bereit auf Gerät-ID:', device_id);
        setActiveDeviceId(device_id); // Gerät-ID im gameState speichern
        setIsPlayerReady(true); // Player-Bereitschaft im gameState setzen
        playbackStatus.textContent = 'Spotify Player verbunden!';
        await transferPlayback(device_id); // Wiedergabe auf diesen Player übertragen
        console.log("Spotify Player ready! Du bist jetzt eingeloggt und der Player ist bereit.");
        handlePlayerReady(); // Rufe den globalen Ready-Handler in main.js auf
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
        // Hier können wir auf Änderungen im Player-Status reagieren, falls nötig
    });

    // Verbinde den Player
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
                'Authorization': `Bearer ${accessToken}` // Verwende das Access Token aus dem gameState
            },
            body: JSON.stringify({
                device_ids: [deviceId],
                play: false // Starte nicht automatisch die Wiedergabe
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
        // Hier könntest du eine Fehlermeldung im UI anzeigen
    }
}

/**
 * Holt die Tracks einer bestimmten Playlist.
 * @returns {Promise<Array>} Ein Array von Track-Objekten.
 */
export async function getPlaylistTracks() {
    // Wenn Tracks bereits geladen sind, gib sie direkt zurück
    if (currentPlaylistTracks.length > 0) {
        return currentPlaylistTracks;
    }
    console.log('getPlaylistTracks: Lade Tracks aus Playlist...');
    try {
        let allTracks = [];
        let nextUrl = `${SPOTIFY_API_BASE_URL}/playlists/${PLAYLIST_ID}/tracks?limit=100`; // Max. 100 Tracks pro Anfrage

        // Lade alle Seiten der Playlist (falls mehr als 100 Tracks)
        while (nextUrl) {
            const response = await fetch(nextUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}` // Verwende das Access Token
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Fehler beim Laden der Playlist-Tracks: ${response.status} - ${errorData.error.message || response.statusText}`);
            }

            const data = await response.json();
            // Filtere nur echte Tracks, keine lokalen oder null-Einträge
            allTracks = allTracks.concat(data.items.filter(item => item.track && !item.track.is_local && item.track.preview_url)); // Nur Tracks mit Preview URL
            nextUrl = data.next; // URL für die nächste Seite
        }
        setCurrentPlaylistTracks(allTracks); // Tracks im gameState speichern
        console.log(`getPlaylistTracks: Geladene spielbare Tracks aus Playlist: ${currentPlaylistTracks.length}`);
        if (currentPlaylistTracks.length === 0) {
            console.warn('getPlaylistTracks: Keine spielbaren Tracks in der Playlist gefunden. Stelle sicher, dass die Playlist Tracks mit verfügbaren Preview-URLs enthält und in deinem Markt verfügbar sind.');
            playbackStatus.textContent = 'Achtung: Keine spielbaren Tracks in der Playlist gefunden.';
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
            console.warn('selectRandomSongForRound: Keine Tracks verfügbar für die Auswahl.');
            return null;
        }
        const randomTrackItem = tracks[Math.floor(Math.random() * tracks.length)];
        setCurrentPlayingTrack(randomTrackItem); // Setze den ausgewählten Track im gameState
        console.log(`selectRandomSongForRound: Ausgewählter Track: ${randomTrackItem.track.name} von ${randomTrackItem.track.artists[0].name}`);
        return randomTrackItem;
    } catch (error) {
        console.error("selectRandomSongForRound: Fehler beim Auswählen eines zufälligen Songs:", error);
        return null;
    }
}

/**
 * Spielt den aktuellen Song basierend auf den Würfelparametern ab.
 * Startet an einer zufälligen Position und spielt für die definierte Dauer.
 */
export async function playSongBasedOnDice() {
    // Überprüfe, ob ein Song zum Spielen vorhanden ist
    if (!currentPlayingTrack) {
        console.error("playSongBasedOnDice: Kein Track zum Abspielen ausgewählt.");
        playbackStatus.textContent = 'Fehler: Kein Song zum Abspielen gefunden.';
        return;
    }

    // Überprüfe, ob der Player und das Gerät bereit sind
    if (!isPlayerReady || !player || !activeDeviceId) {
        playbackStatus.textContent = 'Spotify Player ist noch nicht bereit oder verbunden. Bitte warten...';
        console.warn("playSongBasedOnDice: Player nicht bereit.");
        return;
    }

    playbackStatus.textContent = 'Spiele Song...';
    logo.classList.remove('active-logo', 'action-button');
    logo.classList.add('inactive-logo'); // Logo inaktiv machen, während Song läuft

    const trackUri = currentPlayingTrack.track.uri;
    const trackDurationMs = currentPlayingTrack.track.duration_ms;
    const playDurationMs = DICE_PARAMETERS[currentDiceRoll].playDurationSec * 1000;

    // Eine neue zufällige Startposition für jede Wiederholung
    // Stellen Sie sicher, dass die Wiedergabedauer nicht die Tracklänge überschreitet
    const maxStartPositionMs = trackDurationMs - playDurationMs - 1000; // Mindestens 1 Sekunde Puffer am Ende
    const newPlayStartPosition = Math.floor(Math.random() * (maxStartPositionMs > 0 ? maxStartPositionMs : 0));
    setCurrentPlayStartPosition(newPlayStartPosition < 0 ? 0 : newPlayStartPosition); // Sicherstellen, dass es nicht negativ wird

    console.log(`playSongBasedOnDice: Spiele ${currentPlayingTrack.track.name} von ${currentPlayingTrack.track.artists[0].name} ` +
                `ab Position ${currentPlayStartPosition}ms für ${playDurationMs}ms. ` +
                `Verbleibende Hördurchgänge: ${currentSongRepetitionsLeft}`);

    try {
        await player.activateElement(); // Stellt sicher, dass Audio abgespielt werden kann (für iOS/Safari)

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

        // Verringere die verbleibenden Hördurchgänge und Punkte
        setCurrentSongRepetitionsLeft(currentSongRepetitionsLeft - 1);
        // currentMaxPointsForSong wird bereits in gameLogic.js gesetzt und hier nur verwendet
        // currentMaxPointsForSong - 1 passiert bei jeder Wiedergabe in gameLogic.js,
        // um die "verbleibenden" Punkte für die Rate-Phase zu verfolgen.

        setTimeout(async () => {
            await player.pause(); // Song pausieren nach der definierten Dauer
            playbackStatus.textContent = `Song pausiert. Verbleibend: ${currentSongRepetitionsLeft + 1} Hördurchgänge.`; // +1, da es schon um 1 reduziert wurde

            if (currentSongRepetitionsLeft < 0) { // Alle Versuche aufgebraucht (0 oder weniger, da es runterzählt)
                console.log("playSongBasedOnDice: Alle Hördurchgänge verbraucht. Leite zur Auflösungsphase über.");
                // Dynamischer Import von gameLogic.js, um Zirkelabhängigkeiten zu vermeiden
                const { startResolutionPhase } = await import('./gameLogic.js');
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
