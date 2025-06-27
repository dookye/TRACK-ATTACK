// --- PKCE HELPER-FUNKTIONEN ---

/**
 * Generiert einen zufälligen String für den Code Verifier.
 * @param {number} length - Die gewünschte Länge des Strings.
 * @returns {string} Ein zufällig generierter String.
 */
export function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Generiert den Code Challenge aus dem Code Verifier.
 * @param {string} codeVerifier - Der Code Verifier String.
 * @returns {Promise<string>} Ein Promise, das den Base64-URL-encoded Code Challenge zurückgibt.
 */
export async function generateCodeChallenge(codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
