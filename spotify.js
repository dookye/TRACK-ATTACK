// Mapping von Genre zu Playlist-IDs (Beispiele, ersetzen!)
const GENRE_PLAYLISTS = {
    'punk': ['37i9dQZF1DXd6tJtrHszdU', '37i9dQZF1DX3LDIBRoaCDQ'] // Beispiel Punk Playlists
    // 'pop': ['PLAYLIST_ID_POP_1', 'PLAYLIST_ID_POP_2']
};

let allTracksForGame = []; // Wird mit Tracks aus den gewählten Playlists gefüllt

async function fetchWebApi(endpoint, method = 'GET', body) {
    if (!accessToken || !isTokenValid()) {
        console.error('Kein gültiger Access Token vorhanden.');
        redirectToSpotifyLogin(); // Oder eine andere Fehlerbehandlung
        return null;
    }
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`
        },
        method,
        body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
        console.error("API Fehler:", res.status, await res.text());
        if (res.status === 401) { // Token expired or invalid
            logout();
        }
        return null;
    }
    return await res.json();
}

async function fetchTracksFromPlaylist(playlistId) {
    const data = await fetchWebApi(`/playlists/${playlistId}/tracks?fields=items(track(name,artists(name),album(images),preview_url,id,duration_ms))`);
    if (!data || !data.items) return [];
    // Filtere Tracks, die keine preview_url haben, da wir diese für die einfache Wiedergabe brauchen
    // oder eine duration_ms haben für die zufällige Wiedergabe (falls wir volle Tracks hätten)
    return data.items
        .map(item => item.track)
        .filter(track => track && (track.preview_url || track.duration_ms));
}

async function loadTracksForGenre(genre) {
    allTracksForGame = [];
    const playlistIds = GENRE_PLAYLISTS[genre];
    if (!playlistIds) {
        console.error("Keine Playlists für Genre:", genre);
        return false;
    }

    console.log(`Lade Tracks für Genre: ${genre} von Playlists: ${playlistIds.join(', ')}`);
    for (const id of playlistIds) {
        const tracks = await fetchTracksFromPlaylist(id);
        allTracksForGame.push(...tracks);
    }
    // Duplikate entfernen (basierend auf Track-ID)
    allTracksForGame = allTracksForGame.filter((track, index, self) =>
        track && track.id && index === self.findIndex((t) => (
            t.id === track.id
        ))
    );

    console.log(`Insgesamt ${allTracksForGame.length} einzigartige Tracks geladen.`);
    if (allTracksForGame.length < 20) { // Mindestanzahl für ein volles Spiel
        alert("Nicht genügend Songs für das ausgewählte Genre gefunden. Wähle andere Playlists oder ein anderes Genre.");
        return false;
    }
    return true;
}

function getRandomTrack() {
    if (allTracksForGame.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * allTracksForGame.length);
    return allTracksForGame[randomIndex];
}
