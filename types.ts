export enum GamePhase {
  LOGIN,
  SETUP_ORIENTATION,
  SETUP_FULLSCREEN,
  WELCOME_ANIMATION,
  IDLE,
  DICE_ANIMATION,
  DICE_SELECTION,
  GENRE_ANIMATION,
  GENRE_SELECTION,
  SPEED_ROUND_ANNOUNCEMENT,
  GUESSING,
  REVEAL,
  PLAYER_SWITCH,
  END_SCREEN,
}

export type Player = 1 | 2;

export interface RoundData {
  diceValue: number;
  maxAttempts: number;
  playDuration: number;
  genre: string;
  track: SpotifyTrack | null;
  attemptsMade: number;
  isSpeedRound: boolean;
}

export interface GameState {
  phase: GamePhase;
  currentPlayer: Player;
  player1Score: number;
  player2Score: number;
  totalRound: number;
  roundData: RoundData | null;
}

export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: {
    name: string;
    imageUrl: string;
  };
}

// This is a simplified version of the Spotify Player object
export interface SpotifyPlayer {
  _options: {
    getOAuthToken: (cb: (token: string) => void) => void;
    id: string;
  };
  connect: () => Promise<boolean>;
  disconnect: () => void;
  getCurrentState: () => Promise<any>;
  getVolume: () => Promise<number>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  addListener: (event: string, callback: (...args: any[]) => void) => boolean;
  removeListener: (event: string) => boolean;
  resume: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (position_ms: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setName: (name: string) => Promise<void>;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: {
      Player: new (options: any) => any;
    };
  }
}
