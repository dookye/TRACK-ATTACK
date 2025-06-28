// js/utils.js

/**
 * Generiert einen zufälligen String einer bestimmten Länge.
 * Wird für den code_verifier im PKCE-Flow benötigt.
 * @param {number} length - Die gewünschte Länge des Strings.
 * @returns {string} Ein zufälliger String, bestehend aus alphanumerischen Zeichen.
 */
export function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.map(x => possible[x % possible.length]).join('');
}

/**
 * Generiert einen Code Challenge aus einem Code Verifier (PKCE-Flow).
 * @param {string} codeVerifier - Der zufällig generierte Code Verifier.
 * @returns {Promise<string>} Der base64url-enkodierte SHA256-Hash des codeVerifier.
 */
export async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return base64urlencode(digest);
}

/**
 * Konvertiert einen ArrayBuffer in einen base64url-enkodierten String.
 * @param {ArrayBuffer} buffer - Der zu enkodierende ArrayBuffer.
 * @returns {string} Der base64url-enkodierte String.
 */
function base64urlencode(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}
