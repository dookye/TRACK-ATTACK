
import { CLIENT_ID, REDIRECT_URI, SCOPES, GenreName, GENRES } from '../constants';
import { SpotifyPlayer, SpotifyTrack } from '../types';

// PKCE Helper functions
const generateCodeVerifier = (length: number): string => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

const generateCodeChallenge = async (codeVerifier: string): Promise<string> => {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

// Authentication
export const redirectToAuthCodeFlow = async (): Promise<void> => {
  const verifier = generateCodeVerifier(128);
  localStorage.setItem("verifier", verifier);
  const challenge = await generateCodeChallenge(verifier);

  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("response_type", "code");
  params.append("redirect_uri", REDIRECT_URI);
  params.append("scope", SCOPES);
  params.append("code_challenge_method", "S256");
  params.append("code_challenge", challenge);

  document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
};

export const getAccessToken = async (code: string): Promise<string> => {
  const verifier = localStorage.getItem("verifier");
  if (!verifier) {
    throw new Error("Code verifier not found!");
  }

  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", REDIRECT_URI);
  params.append("code_verifier", verifier);

  const result = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const { access_token } = await result.json();
  return access_token;
};

// Spotify Player SDK
export const initSpotifyPlayer = (token: string): Promise<SpotifyPlayer> => {
    return new Promise((resolve) => {
        window.onSpotifyWebPlaybackSDKReady = () => {
            const player = new window.Spotify.Player({
                name: 'TRACK ATTACK',
                getOAuthToken: (cb: (token: string) => void) => {
                    cb(token);
                },
                volume: 0.5,
            });
            resolve(player as unknown as SpotifyPlayer);
        };
    });
};

// API Calls
const fetchWebApi = async (endpoint: string, method: string, token: string, body?: any) => {
    const res = await fetch(`https://api.spotify.com/${endpoint}`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        method,
        body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return {}; // Handle no content responses
    return await res.json();
}

export const fetchRandomTrack = async (token: string, genre: GenreName): Promise<SpotifyTrack> => {
  try {
    const genreData = GENRES[genre];
    const playlistId = genreData.playlists[Math.floor(Math.random() * genreData.playlists.length)];
    
    const playlist = await fetchWebApi(`v1/playlists/${playlistId}/tracks?limit=50`, 'GET', token);
    
    const tracks = playlist.items.filter((item: any) => item.track && item.track.preview_url);
    if(tracks.length === 0) {
        // Fallback if no tracks with preview_url are found
        const allTracks = playlist.items.filter((item: any) => item.track);
        if(allTracks.length === 0) throw new Error('Playlist is empty');
        const randomTrackItem = allTracks[Math.floor(Math.random() * allTracks.length)];
        const track = randomTrackItem.track;
        return {
          id: track.id,
          uri: track.uri,
          name: track.name,
          artist: track.artists.map((a: any) => a.name).join(', '),
          album: {
            name: track.album.name,
            imageUrl: track.album.images[0]?.url || 'https://picsum.photos/300/300',
          },
        };
    }
    
    const randomTrackItem = tracks[Math.floor(Math.random() * tracks.length)];
    const track = randomTrackItem.track;

    return {
        id: track.id,
        uri: track.uri,
        name: track.name,
        artist: track.artists.map((a: any) => a.name).join(', '),
        album: {
            name: track.album.name,
            imageUrl: track.album.images[0]?.url || 'https://picsum.photos/300/300',
        },
    };
  } catch (error) {
    console.error("Error fetching random track:", error);
    // Return a dummy track on error to prevent crashing
    return {
      id: 'dummy',
      uri: 'dummy',
      name: 'Error Track',
      artist: 'System',
      album: { name: 'Error', imageUrl: 'https://picsum.photos/300/300' }
    };
  }
};


export const playTrackSnippet = async (token: string, deviceId: string, trackUri: string, durationMs: number): Promise<void> => {
    const trackInfo = await fetchWebApi(`v1/tracks/${trackUri.split(':')[2]}`, 'GET', token);
    const trackDurationMs = trackInfo.duration_ms;
    
    const maxStartPosition = Math.max(0, trackDurationMs - durationMs - 5000); // Leave 5s buffer
    const randomStartPosition = Math.floor(Math.random() * maxStartPosition);

    await fetchWebApi(`v1/me/player/play?device_id=${deviceId}`, 'PUT', token, {
        uris: [trackUri],
        position_ms: randomStartPosition,
    });
    
    // The Web Playback SDK does not have a method to stop after a duration.
    // We rely on a timeout to pause playback.
    setTimeout(async () => {
         try {
            await fetchWebApi(`v1/me/player/pause?device_id=${deviceId}`, 'PUT', token);
         } catch(e) {
            console.error("Could not pause track", e);
         }
    }, durationMs);
};
