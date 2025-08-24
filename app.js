const clientId = '53257f6a1c144d3f929a60d691a0c6f6';
const redirectUri = 'https://dookye.github.io/TRACK-ATTACK/';

// PKCE Helper
function generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}

async function sha256(baseString) {
    const encoder = new TextEncoder();
    const data = encoder.encode(baseString);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Spotify Login Button
document.getElementById('spotifyLogin').addEventListener('click', async () => {
    const codeVerifier = generateRandomString(128);
    localStorage.setItem('code_verifier', codeVerifier);
    const codeChallenge = await sha256(codeVerifier);

    const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=streaming%20user-read-email%20user-read-private%20user-modify-playback-state&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge_method=S256&code_challenge=${codeChallenge}`;
    window.location = authUrl;
});
