
export const CLIENT_ID = "53257f6a1c144d3f929a60d691a0c6f6";
export const REDIRECT_URI = "https://dookye.github.io/TRACK-ATTACK/";
export const SCOPES = "streaming user-read-email user-read-private";

export const TOTAL_ROUNDS_PER_PLAYER = 10;

export const PLAYER_COLORS = {
  1: {
    bg: 'bg-blue-600',
    border: 'border-blue-500',
    gradientFrom: 'from-blue-600',
  },
  2: {
    bg: 'bg-pink-600',
    border: 'border-pink-500',
    gradientTo: 'to-pink-600',
  },
};

export const GENRES = {
  "Punk Rock (90's & 00's)": {
    playlists: ["39sVxPTg7BKwrf2MfgrtcD", "7ITmaFa2rOhXAmKmUUCG9E"],
  },
  "Pop Hits 2000-2025": {
    playlists: ["6mtYuOxzl58vSGnEDtZ9uB", "34NbomaTu7YuOYnky8nLXL"],
  },
  "Die größten Hits aller Zeiten": {
    playlists: ["2si7ChS6Y0hPBt4FsobXpg", "2y09fNnXHvoqc1WGHvbhkZ"],
  },
  "Disney Songs": {
    playlists: ["3Bilb56eeS7db5f3DTEwMR", "2bhbwexk7c6yJrEB4CtuY8"],
  },
};

export type GenreName = keyof typeof GENRES;