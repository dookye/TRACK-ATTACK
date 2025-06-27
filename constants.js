// --- ALLGEMEINE KONSTANTEN ---
export const CLIENT_ID = '53257f6a1c144d3f929a60d691a0c6f6';
export const REDIRECT_URI = 'https://dookye.github.io/TRACK-ATTACK/'; // Deine GitHub Pages URL
export const PLAYLIST_ID = '39sVxPTg7BKwrf2MfgrtcD'; // Punk Rock (90's & 00's)
export const SCOPES = [
    'user-read-private',
    'user-read-email',
    'streaming',
    'user-read-playback-state',
    'user-modify-playback-state'
];

// --- SPOTIFY API ENDPUNKTE (KORREKTE SPOTIFY-URLS!) ---
export const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
export const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
export const SPOTIFY_API_BASE_URL = 'https://api.spotify.com/v1';

// NEU für Spieler & Rundenmanagement
export const MAX_ROUNDS_PER_PLAYER = 10; // Max. Runden pro Spieler
export const TOTAL_GAME_ROUNDS = MAX_ROUNDS_PER_PLAYER * 2; // Gesamtrunden (20 Songs)

// NEU für Würfel & Song-Parameter
export const DICE_PARAMETERS = {
    3: { maxPoints: 3, playDurationSec: 7, repetitions: 2 }, // 3 Hördurchgänge (1. Hören + 2 Wiederholungen)
    4: { maxPoints: 4, playDurationSec: 7, repetitions: 3 }, // 4 Hördurchgänge
    5: { maxPoints: 5, playDurationSec: 7, repetitions: 4 }, // 5 Hördurchgänge
    7: { maxPoints: 7, playDurationSec: 2, repetitions: 7 }  // 8 Hördurchgänge
};

// UI Animationsdauern
export const ANIMATION_DURATIONS = {
    logoFallIn: 900, // in ms
    logoBounce: 200, // in ms
    diceAnimation: 2000, // in ms
    backgroundTransition: 2000 // in ms
};
